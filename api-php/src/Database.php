<?php

declare(strict_types=1);

namespace Sbor;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Подключение к PostgreSQL. Только подготовленные выражения — защита от SQL-инъекций.
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $dsn = Env::get('DB_DSN');
        $user = Env::get('DB_USER');
        $password = Env::get('DB_PASSWORD', '');

        if ($dsn === null || $user === null) {
            throw new RuntimeException('Не заданы параметры подключения к базе данных');
        }

        try {
            self::$pdo = new PDO($dsn, $user, (string) $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException('Не удалось подключиться к базе данных', 0, $e);
        }

        return self::$pdo;
    }

    /**
     * @param array<string, mixed> $params
     * @return array<int, array<string, mixed>>
     */
    public static function select(string $sql, array $params = []): array
    {
        $stmt = self::connection()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /**
     * @param array<string, mixed> $params
     * @return array<string, mixed>|null
     */
    public static function selectOne(string $sql, array $params = []): ?array
    {
        $rows = self::select($sql, $params);

        return $rows[0] ?? null;
    }

    /**
     * @param array<string, mixed> $params
     */
    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::connection()->prepare($sql);
        $stmt->execute($params);

        return $stmt->rowCount();
    }
}
