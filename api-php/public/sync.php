<?php

declare(strict_types=1);

/**
 * Синхронизация: забирает актуальную базу с сайта и загружает её в MySQL (XAMPP),
 * после чего phpMyAdmin показывает те же данные, что и сайт.
 *
 * Режимы:
 *  - вручную:   http://localhost:8000/sync.php  (или php api-php/public/sync.php)
 *  - фон/авто:  php api-php/public/sync.php auto  — тихий режим для автосинхронизации
 *               и планировщика задач (без HTTP-заголовков, код выхода 0/1).
 */

require_once dirname(__DIR__) . '/src/Env.php';
require_once dirname(__DIR__) . '/src/Sync.php';

use Sbor\Sync;

$quiet = in_array('auto', $argv ?? [], true) || ($_GET['auto'] ?? '') === '1';

if (!$quiet) {
    header('Content-Type: text/plain; charset=utf-8');
}

try {
    $message = Sync::run();
    echo ($quiet ? 'OK: ' : 'Готово: ') . $message . "\n";
} catch (Throwable $e) {
    if (!$quiet) {
        http_response_code(500);
    }
    echo 'Ошибка: ' . $e->getMessage() . "\n";
    if ($quiet) {
        exit(1);
    }
}
