/**
 * Серверная проверка ролей. Вызывается из загрузчика маршрута /admin, чтобы
 * панель не показывалась пользователю без прав, а не скрывалась уже после
 * открытия страницы. Роль читается с сервера по токену сессии, поэтому
 * подставить себе роль через браузер нельзя.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServerRole = "admin" | "organizer" | "user";

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServerRole[]> => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw error;
    const roles = (data ?? []).map((r) => r.role as ServerRole);
    return roles.length ? roles : ["user"];
  });
