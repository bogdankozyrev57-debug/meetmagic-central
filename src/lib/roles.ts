/**
 * Разграничение прав (пользователь / администратор).
 * Роль читается из таблицы user_roles — её нельзя подделать на клиенте,
 * потому что доступ к данным дополнительно проверяется правилами RLS в БД
 * через функцию public.has_role(). Хук нужен только для отображения интерфейса.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "admin" | "user";

export function useRole() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["my-role", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<AppRole> => {
      // Пользователь видит только свои роли (политика user_roles_own_read)
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data?.some((r) => r.role === "admin") ? "admin" : "user";
    },
  });
  return { role: query.data ?? "user", isAdmin: query.data === "admin", loading: query.isLoading };
}
