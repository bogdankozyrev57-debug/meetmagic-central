<?php

declare(strict_types=1);

namespace Sbor;

use RuntimeException;

/**
 * Автосинхронизация базы: забирает актуальный MySQL-дамп с сайта
 * и загружает его в локальную базу «sbor» (phpMyAdmin).
 *
 * Работает в двух режимах:
 *  - run()        — полная синхронизация прямо сейчас (вручную или по расписанию);
 *  - runIfStale() — если с прошлой синхронизации прошло больше SYNC_INTERVAL_MINUTES,
 *                   запускает обновление в фоне, не задерживая ответ сервиса.
 *
 * Метка времени хранится в api-php/var/last-sync.txt.
 */
final class Sync
{
    private const VAR_DIR = __DIR__ . '/../var';
    private const STAMP_FILE = self::VAR_DIR . '/last-sync.txt';

    /** Полная синхронизация. Возвращает текст результата, при сбое бросает RuntimeException. */
    public static function run(): string
    {
        $site = rtrim((string) Env::get('SITE_URL', 'https://meetmagic-central.lovable.app'), '/');
        $token = (string) Env::get('SITE_SYNC_TOKEN', '');
        if ($token === '') {
            throw new RuntimeException('Не задан SITE_SYNC_TOKEN в api-php/.env (ключ на странице «Копии» сайта)');
        }

        $ctx = stream_context_create(['http' => [
            'header' => "Authorization: Bearer $token\r\n",
            'timeout' => 60,
            'ignore_errors' => true,
        ]]);
        $dump = @file_get_contents($site . '/api/public/sync-dump', false, $ctx);
        $status = isset($http_response_header[0]) ? (string) $http_response_header[0] : '';
        if ($dump === false || !str_contains($status, '200')) {
            throw new RuntimeException("Сайт не отдал базу ($status). Проверьте SITE_URL и ключ.");
        }

        preg_match('/host=([^;]+)/', (string) Env::get('DB_DSN', ''), $h);
        preg_match('/port=(\d+)/', (string) Env::get('DB_DSN', ''), $p);
        $db = new \mysqli(
            $h[1] ?? '127.0.0.1',
            (string) Env::get('DB_USER', 'root'),
            (string) Env::get('DB_PASSWORD', ''),
            '',
            (int) ($p[1] ?? 3306),
        );
        $db->set_charset('utf8mb4');

        if (!$db->multi_query($dump)) {
            throw new RuntimeException('Ошибка MySQL: ' . $db->error);
        }
        do {
            if ($r = $db->store_result()) {
                $r->free();
            }
        } while ($db->more_results() && $db->next_result());
        if ($db->errno) {
            throw new RuntimeException('Ошибка MySQL: ' . $db->error);
        }

        self::touch();

        return 'База «sbor» обновлена с сайта ' . $site . ' в ' . date('H:i:s');
    }

    /**
     * Если база устарела (синхронизация была давно или ни разу),
     * запускает обновление в фоновом процессе и сразу возвращает управление.
     * Любые ошибки фонового запуска игнорируются — сервис не должен падать из-за синхронизации.
     */
    public static function runIfStale(): void
    {
        try {
            $interval = max(1, (int) Env::get('SYNC_INTERVAL_MINUTES', '5'));
            $last = self::lastRunAt();
            if ($last !== null && (time() - $last) < $interval * 60) {
                return; // база свежая
            }

            $script = dirname(__DIR__) . '/public/sync.php';
            if (DIRECTORY_SEPARATOR === '\\') {
                // Windows (XAMPP): start /B запускает процесс без окна
                pclose(popen('start /B "" ' . escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' auto', 'r'));
            } else {
                exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' auto > /dev/null 2>&1 &');
            }
            // Метку ставим сразу, чтобы параллельные запросы не плодили процессы;
            // при сбое фоновая синхронизация её перезапишет при следующем успехе.
            self::touch();
        } catch (\Throwable) {
            // намеренно пусто: автосинхронизация не мешает работе сервиса
        }
    }

    /** Время последней синхронизации (unix) или null, если её ещё не было. */
    public static function lastRunAt(): ?int
    {
        if (!is_file(self::STAMP_FILE)) {
            return null;
        }
        $value = (int) trim((string) file_get_contents(self::STAMP_FILE));

        return $value > 0 ? $value : null;
    }

    private static function touch(): void
    {
        if (!is_dir(self::VAR_DIR)) {
            @mkdir(self::VAR_DIR, 0775, true);
        }
        @file_put_contents(self::STAMP_FILE, (string) time());
    }
}
