/**
 * Клиентский журнал ошибок: отправляет сбои в таблицу error_logs.
 * Запись разрешена даже без входа (политика error_logs_insert),
 * поэтому ловятся и ошибки посетителей без аккаунта.
 * Журнал никогда не должен ломать приложение — все сбои глушатся.
 */
import { supabase } from "@/integrations/supabase/client";

export function reportAppError(error: unknown, source: string) {
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : JSON.stringify(error));
    void supabase
      .from("error_logs")
      .insert({
        source,
        message: err.message.slice(0, 1000),
        stack: err.stack ? err.stack.slice(0, 4000) : null,
        url: window.location.href.slice(0, 500),
        user_agent: navigator.userAgent.slice(0, 300),
      })
      .then(() => undefined);
  } catch {
    // намеренно пусто: журнал не мешает работе приложения
  }
}
