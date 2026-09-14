<?php

declare(strict_types=1);

namespace Sbor;

/**
 * Проверка входных данных до обращения к базе.
 */
final class Validator
{
    public static function isUuid(string $value): bool
    {
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
            $value
        );
    }

    public static function isTicketCode(string $value): bool
    {
        return (bool) preg_match('/^[0-9a-zA-Z_-]{6,64}$/', $value);
    }
}
