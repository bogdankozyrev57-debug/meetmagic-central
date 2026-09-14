<?php

declare(strict_types=1);

namespace Sbor;

/**
 * Единый формат JSON-ответов REST API.
 */
final class Response
{
    /**
     * @param mixed $data
     */
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function error(string $code, string $message, int $status): void
    {
        self::json(['error' => ['code' => $code, 'message' => $message]], $status);
    }

    public static function csv(string $filename, array $header, array $rows): void
    {
        http_response_code(200);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $out = fopen('php://output', 'w');
        fputcsv($out, $header);
        foreach ($rows as $row) {
            fputcsv($out, array_values($row));
        }
        fclose($out);
    }
}
