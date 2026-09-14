<?php

declare(strict_types=1);

namespace Sbor;

/**
 * Проверка токена организатора для защищённых методов.
 */
final class Auth
{
    public static function requireToken(): void
    {
        $expected = Env::get('API_TOKEN', '');
        if ($expected === null || $expected === '') {
            Response::error('server_error', 'Сервис не настроен: не задан API_TOKEN', 500);
            exit;
        }

        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $provided = preg_replace('/^Bearer\s+/i', '', trim((string) $header)) ?? '';

        if ($provided === '' || !hash_equals($expected, $provided)) {
            Response::error('unauthorized', 'Требуется авторизация организатора', 401);
            exit;
        }
    }
}
