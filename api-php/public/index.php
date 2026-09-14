<?php

declare(strict_types=1);

/**
 * Точка входа PHP REST-сервиса «Сбор».
 * Маршрутизация без внешних зависимостей, все ответы — JSON (кроме CSV-отчёта).
 */

spl_autoload_register(static function (string $class): void {
    $prefix = 'Sbor\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $file = dirname(__DIR__) . '/src/' . substr($class, strlen($prefix)) . '.php';
    if (is_readable($file)) {
        require_once $file;
    }
});

use Sbor\CheckinController;
use Sbor\EventsController;
use Sbor\Response;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/');
if ($path === '') {
    $path = '/';
}

$raw = file_get_contents('php://input') ?: '';
$body = $raw !== '' ? json_decode($raw, true) : [];
if (!is_array($body)) {
    $body = [];
}

try {
    if ($method === 'GET' && $path === '/api/health') {
        Response::json(['status' => 'ok', 'service' => 'sbor-php-api']);
    } elseif ($method === 'GET' && $path === '/api/events') {
        EventsController::list($_GET);
    } elseif ($method === 'GET' && preg_match('#^/api/events/([^/]+)$#', $path, $m)) {
        EventsController::show($m[1]);
    } elseif ($method === 'GET' && preg_match('#^/api/events/([^/]+)/reviews$#', $path, $m)) {
        EventsController::reviews($m[1]);
    } elseif ($method === 'GET' && preg_match('#^/api/events/([^/]+)/stats$#', $path, $m)) {
        EventsController::stats($m[1]);
    } elseif ($method === 'POST' && $path === '/api/checkin') {
        CheckinController::checkin($body);
    } elseif ($method === 'GET' && $path === '/api/report/attendance.csv') {
        CheckinController::attendanceReport();
    } else {
        Response::error('not_found', 'Метод не найден', 404);
    }
} catch (Throwable $e) {
    error_log('[sbor-api] ' . $e->getMessage());
    Response::error('server_error', 'Внутренняя ошибка сервиса', 500);
}
