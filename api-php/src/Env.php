<?php

declare(strict_types=1);

namespace Sbor;

/**
 * Чтение конфигурации из окружения или файла api-php/.env.
 */
final class Env
{
    /** @var array<string, string>|null */
    private static ?array $file = null;

    public static function get(string $key, ?string $default = null): ?string
    {
        $fromEnv = getenv($key);
        if (is_string($fromEnv) && $fromEnv !== '') {
            return $fromEnv;
        }

        if (self::$file === null) {
            self::$file = self::loadFile(dirname(__DIR__) . '/.env');
        }

        return self::$file[$key] ?? $default;
    }

    /**
     * @return array<string, string>
     */
    private static function loadFile(string $path): array
    {
        if (!is_readable($path)) {
            return [];
        }

        $values = [];
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $values[trim($key)] = trim(trim($value), "\"'");
        }

        return $values;
    }
}
