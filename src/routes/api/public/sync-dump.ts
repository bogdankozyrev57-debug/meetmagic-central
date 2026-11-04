/**
 * Живая выгрузка базы сайта для PHP-сервиса и phpMyAdmin.
 * PHP (api-php/sync.php) запрашивает этот адрес с ключом и загружает ответ
 * в локальный MySQL — так база в phpMyAdmin совпадает с данными сайта.
 * Адрес публичный, поэтому без верного ключа в заголовке ничего не отдаётся.
 */
import { createFileRoute } from "@tanstack/react-router";

import { collectDumpSql } from "@/lib/backup.functions";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/sync-dump")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["PHP_SYNC_TOKEN"] ?? "";
        const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!expected || !safeEqual(given, expected)) {
          return new Response("Неверный ключ синхронизации", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const dump = await collectDumpSql(supabaseAdmin);
        return new Response(dump, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
