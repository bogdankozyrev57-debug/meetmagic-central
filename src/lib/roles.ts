/**
 * Разграничение прав (пользователь / организатор / администратор).
 * Роли хранятся в таблице user_roles и читаются из неё — подделать их на клиенте
 * нельзя, потому что доступ к данным дополнительно проверяется правилами RLS
 * в базе данных через функцию public.has_role(). Хук нужен только для того,
 * чтобы показать в интерфейсе нужные разделы.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "admin" | "organizer" | "user";

/** Подписи ролей для интерфейса. */
export const ROLE_NAME: Record<AppRole, string> = {
  admin: "Администратор",
  organizer: "Организатор",
  user: "Пользователь",
};

/** Порядок важности ролей: главная роль показывается первой. */
const RANK: AppRole[] = ["admin", "organizer", "user"];

export function useRole() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["my-role", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<AppRole[]> => {
      // Политика user_roles_own_read пропускает только строки самого пользователя
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const owned = new Set<AppRole>((data ?? []).map((r) => r.role as AppRole));
      if (owned.size === 0) owned.add("user");
      return RANK.filter((r) => owned.has(r));
    },
  });

  const roles = query.data ?? (["user"] as AppRole[]);
  return {
    roles,
    /** Главная роль: администратор > организатор > пользователь. */
    role: roles[0] ?? "user",
    isAdmin: roles.includes("admin"),
    isOrganizer: roles.includes("organizer"),
    loading: query.isLoading,
  };
}
