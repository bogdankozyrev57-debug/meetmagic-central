/**
 * Личный кабинет (/profile). Доступен только после входа —
 * защиту обеспечивает родительский маршрут _authenticated/route.tsx.
 * Пользователь видит свои данные, роль, может изменить имя.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Личный кабинет — Сбор" },
      { name: "description", content: "Ваш профиль, роль и статистика участия в мероприятиях." },
      { property: "og:title", content: "Личный кабинет — Сбор" },
      { property: "og:description", content: "Ваш профиль, роль и статистика участия." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { role, isAdmin } = useRole();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  // Профиль и счётчики: RLS вернёт только собственные билеты и мероприятия
  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [profile, tickets, events] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
        supabase.from("registrations").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("organizer_id", user!.id),
      ]);
      return {
        fullName: profile.data?.full_name ?? "",
        tickets: tickets.count ?? 0,
        events: events.count ?? 0,
      };
    },
  });

  useEffect(() => {
    if (data) setName(data.fullName);
  }, [data]);

  async function save() {
    // Обновление разрешено только своей строки (политика profiles_update_own)
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user!.id);
    if (error) return toast.error("Не удалось сохранить");
    toast.success("Профиль обновлён");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Личный кабинет</h1>
        <div className="card-surface mt-6 space-y-4 p-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {role === "admin" ? "Администратор" : "Пользователь"}
            </Badge>
          </div>
          <label className="block text-sm font-medium">
            Имя
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </label>
          <Button onClick={save}>Сохранить</Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link to="/tickets" className="card-surface p-6 hover:border-primary">
            <p className="text-3xl font-bold">{data?.tickets ?? 0}</p>
            <p className="text-sm text-muted-foreground">Мои билеты</p>
          </Link>
          <Link to="/organizer" className="card-surface p-6 hover:border-primary">
            <p className="text-3xl font-bold">{data?.events ?? 0}</p>
            <p className="text-sm text-muted-foreground">Мои мероприятия</p>
          </Link>
        </div>

        {isAdmin && (
          <Button asChild variant="secondary" className="mt-6">
            <Link to="/admin">Перейти в панель администратора</Link>
          </Button>
        )}
      </div>
    </PageShell>
  );
}
