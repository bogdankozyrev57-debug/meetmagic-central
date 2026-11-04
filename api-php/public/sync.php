<?php

declare(strict_types=1);

/**
 * Синхронизация: забирает актуальную базу с сайта и загружает её в MySQL (XAMPP),
 * после чего phpMyAdmin показывает те же данные, что и сайт.
 * Открыть: http://localhost:8000/sync.php  (или php api-php/public/sync.php)
 */

require_once dirname(__DIR__) . '/src/Env.php';

use Sbor\Env;

header('Content-Type: text/plain; charset=utf-8');

$site = rtrim((string) Env::get('SITE_URL', 'https://meetmagic-central.lovable.app'), '/');
$token = (string) Env::get('SITE_SYNC_TOKEN', '');
if ($token === '') {
    http_response_code(500);
    exit("Не задан SITE_SYNC_TOKEN в api-php/.env (ключ на странице «Копии» сайта)\n");
}

$ctx = stream_context_create(['http' => [
    'header' => "Authorization: Bearer $token\r\n",
    'timeout' => 60,
    'ignore_errors' => true,
]]);
$dump = @file_get_contents($site . '/api/public/sync-dump', false, $ctx);
$status = isset($http_response_header[0]) ? $http_response_header[0] : '';
if ($dump === false || !str_contains($status, '200')) {
    http_response_code(502);
    exit("Сайт не отдал базу ($status). Проверьте SITE_URL и ключ.\n");
}

preg_match('/host=([^;]+)/', (string) Env::get('DB_DSN', ''), $h);
preg_match('/port=(\d+)/', (string) Env::get('DB_DSN', ''), $p);
$db = new mysqli($h[1] ?? '127.0.0.1', (string) Env::get('DB_USER', 'root'),
    (string) Env::get('DB_PASSWORD', ''), '', (int) ($p[1] ?? 3306));
$db->set_charset('utf8mb4');

if (!$db->multi_query($dump)) {
    http_response_code(500);
    exit('Ошибка MySQL: ' . $db->error . "\n");
}
do {
    if ($r = $db->store_result()) $r->free();
} while ($db->more_results() && $db->next_result());
if ($db->errno) {
    http_response_code(500);
    exit('Ошибка MySQL: ' . $db->error . "\n");
}

echo 'Готово: база «sbor» обновлена с сайта ' . $site . ' в ' . date('H:i:s') . "\n";
