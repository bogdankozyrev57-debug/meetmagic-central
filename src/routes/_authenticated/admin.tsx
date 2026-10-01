/**
 * Панель администратора (/admin) — страница вывода списка сущностей из БД.
 * Интерфейс скрыт от обычных пользователей, но настоящая защита — в БД:
 * политики events_admin_read / events_admin_delete пропускают только
 * пользователей с ролью admin (функция has_role).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Панель администратора — Сбор" },
      { name: "description", content: "Управление всеми мероприятиями платформы." },
      { property: "og:title", content: "Панель администратора — Сбор" },
      { property: "og:description", content: "Управление всеми мероприятиями платформы." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useRole();
  const queryClient = useQueryClient();

  // Список всех мероприятий (включая неопубликованные) — только для admin
  const { data: events = [] } = useQuery({
    queryKey: ["admin-events"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, category, starts_at, is_published")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    if (!confirm("Удалить мероприятие?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { toast.error("Нет прав или ошибка удаления"); return; }
    toast.success("Удалено");
    queryClient.invalidateQueries({ queryKey: ["admin-events"] });
  }

  if (loading) return <PageShell><p className="p-12 text-center">Загрузка…</p></PageShell>;

  // Пользователь без роли admin видит сообщение об отказе в доступе
  if (!isAdmin)
    return (
      <PageShell>
        <div className="mx-auto max-w-md p-12 text-center">
          <h1 className="font-display text-2xl font-bold">Доступ запрещён</h1>
          <p className="mt-2 text-sm text-muted-foreground">Раздел доступен только администраторам.</p>
          <Button asChild className="mt-6"><Link to="/profile">В личный кабинет</Link></Button>
        </div>
      </PageShell>
    );

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Все мероприятия</h1>
        <div className="card-surface mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="p-3">Название</th><th className="p-3">Категория</th><th className="p-3">Дата</th><th className="p-3">Статус</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3">
                    <Link to="/events/$id" params={{ id: e.id }} className="font-medium hover:text-primary">{e.title}</Link>
                  </td>
                  <td className="p-3">{e.category}</td>
                  <td className="p-3">{formatDateTime(e.starts_at)}</td>
                  <td className="p-3"><Badge variant="secondary">{e.is_published ? "Опубликовано" : "Скрыто"}</Badge></td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => remove(e.id)}>Удалить</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
