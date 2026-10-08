/**
 * Личный кабинет (/profile). Доступен только после входа —
 * защиту обеспечивает родительский маршрут _authenticated/route.tsx.
 * Здесь пользователь видит свою роль и аватар, меняет имя, загружает или удаляет
 * аватар, а также может выйти из системы.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deleteAvatar, getAvatarUrl, uploadAvatar } from "@/lib/avatars";
import { ROLE_NAME, useRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Личный кабинет — Сбор" },
      { name: "description", content: "Профиль, роль, аватар и статистика участия в мероприятиях." },
      { property: "og:title", content: "Личный кабинет — Сбор" },
      { property: "og:description", content: "Профиль, роль, аватар и статистика участия." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { roles } = useRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Профиль и счётчики: RLS вернёт только собственные билеты и мероприятия
  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [profile, tickets, events] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user!.id).maybeSingle(),
        supabase.from("registrations").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("organizer_id", user!.id),
      ]);
      return {
        fullName: profile.data?.full_name ?? "",
        avatar: profile.data?.avatar_url ?? null,
        tickets: tickets.count ?? 0,
        events: events.count ?? 0,
      };
    },
  });

  // Ссылка на файл аватара «подписанная» и действует ограниченное время
  const avatarLink = useQuery({
    queryKey: ["avatar-url", data?.avatar],
    enabled: Boolean(data?.avatar),
    queryFn: () => getAvatarUrl(data?.avatar ?? null),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (data) setName(data.fullName);
  }, [data]);

  async function save() {
    // Обновление разрешено только своей строки (политика profiles_update_own)
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user!.id);
    if (error) { toast.error("Не удалось сохранить"); return; }
    toast.success("Профиль обновлён");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  /** Выбранный файл сначала попадает в хранилище, затем путь — в профиль. */
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = await uploadAvatar(user.id, file);
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (error) throw new Error("Не удалось сохранить аватар");
      toast.success("Аватар обновлён");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["avatar-url"] });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Не удалось загрузить аватар");
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (!user || !data?.avatar) return;
    setBusy(true);
    try {
      await deleteAvatar(data.avatar);
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw new Error("Не удалось удалить аватар");
      toast.success("Аватар удалён");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["avatar-url"] });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Не удалось удалить аватар");
    } finally {
      setBusy(false);
    }
  }

  // Корректный выход: отмена запросов, очистка кэша, выход, переход без возврата «назад»
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Личный кабинет</h1>

        <div className="card-surface mt-6 space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <AvatarMark src={avatarLink.data ?? undefined} name={data?.fullName || user?.email || "?"} />
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {roles.map((r) => (
                  <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{ROLE_NAME[r]}</Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "Загрузка…" : data?.avatar ? "Заменить аватар" : "Загрузить аватар"}
            </Button>
            {data?.avatar && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={removeAvatar}>Удалить аватар</Button>
            )}
            <span className="text-xs text-muted-foreground">Изображение до 2 МБ</span>
          </div>

          <label className="block text-sm font-medium">
            Имя
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Сохранить</Button>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 size-4" />
              Выйти
            </Button>
          </div>
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

        <Button asChild variant="outline" className="mt-6 mr-2">
          <Link to="/access">Что мне доступно (права и маршруты)</Link>
        </Button>
        {roles.includes("admin") && (
          <Button asChild variant="secondary" className="mt-6">
            <Link to="/admin">Перейти в панель администратора</Link>
          </Button>
        )}
      </div>
    </PageShell>
  );
}

/** Круг аватара: фото пользователя, а если его нет — инициалы. */
function AvatarMark({ src, name }: { src?: string; name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 font-display text-2xl font-bold text-primary">
      {src ? <img src={src} alt="Аватар пользователя" className="size-full object-cover" /> : initials || "?"}
    </div>
  );
}
