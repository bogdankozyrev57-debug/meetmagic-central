/**
 * Страница «Права доступа» (/access) — наглядная демонстрация на прототипе:
 *  1) текущая роль (гость / пользователь / организатор / администратор);
 *  2) матрица прав по ролям;
 *  3) карта маршрутов с живой проверкой доступа;
 *  4) живые запросы к БД: сколько строк видит текущий пользователь (RLS).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock, X } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Права доступа и маршруты — Сбор" },
      { name: "description", content: "Наглядная схема ролей, прав доступа, маршрутов и данных из базы в сервисе Сбор." },
      { property: "og:title", content: "Права доступа и маршруты — Сбор" },
      { property: "og:description", content: "Роли пользователь, организатор и админ, личный кабинет, роутинг и данные из БД." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessPage,
});

type Level = "guest" | "user" | "organizer" | "admin";

/** Столбцы матрицы прав — в том же порядке, что и роли в интерфейсе. */
const LEVELS: Level[] = ["guest", "user", "organizer", "admin"];

// Матрица прав: [действие, гость, пользователь, организатор, администратор]
const MATRIX: [string, boolean, boolean, boolean, boolean][] = [
  ["Смотреть афишу, карточку мероприятия, карту и отзывы", true, true, true, true],
  ["Регистрироваться на мероприятия, получать QR-билет", false, true, true, true],
  ["Личный кабинет /profile: имя, аватар, свои билеты", false, true, true, true],
  ["Создавать и редактировать свои мероприятия, отмечать приход по QR", false, true, true, true],
  ["Видеть чужие билеты и неопубликованные мероприятия", false, false, false, true],
  ["Панель /admin: чужие мероприятия, статусы, удаление", false, false, false, true],
  ["Назначать и снимать роли «организатор» и «администратор»", false, false, false, true],
];

// Карта маршрутов: путь, назначение, минимальный уровень
const ROUTES: { to: string; label: string; min: Level }[] = [
  { to: "/", label: "Список мероприятий (поиск, фильтры)", min: "guest" },
  { to: "/docs", label: "Документация и API", min: "guest" },
  { to: "/auth", label: "Вход и регистрация", min: "guest" },
  { to: "/profile", label: "Личный кабинет", min: "user" },
  { to: "/tickets", label: "Мои билеты", min: "user" },
  { to: "/organizer", label: "Мои мероприятия (CRUD)", min: "user" },
  { to: "/admin", label: "Панель администратора", min: "admin" },
];

const RANK: Record<Level, number> = { guest: 0, user: 1, organizer: 1, admin: 2 };
const LEVEL_NAME: Record<Level, string> = {
  guest: "Гость",
  user: "Пользователь",
  organizer: "Организатор",
  admin: "Администратор",
};

function AccessPage() {
  const { user } = useAuth();
  const { isAdmin, isOrganizer } = useRole();
  const level: Level = !user ? "guest" : isAdmin ? "admin" : isOrganizer ? "organizer" : "user";

  // Живые запросы: одна и та же выборка возвращает разное число строк в зависимости от роли
  const { data, isLoading } = useQuery({
    queryKey: ["access-counts", user?.id, level],
    queryFn: async () => {
      const count = async (table: "events" | "registrations" | "reviews" | "user_roles") => {
        const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
        return error ? null : count ?? 0;
      };
      const [events, registrations, reviews, roles] = await Promise.all([
        count("events"), count("registrations"), count("reviews"), count("user_roles"),
      ]);
      return { events, registrations, reviews, roles };
    },
  });

  const col = LEVELS.indexOf(level) + 1;

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-12">
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-bold">Права доступа и маршруты</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Вы сейчас:</span>
            <Badge variant={level === "admin" ? "default" : "secondary"}>{LEVEL_NAME[level]}</Badge>
            {user && <span className="text-muted-foreground">{user.email}</span>}
            {!user && <Button asChild size="sm"><Link to="/auth">Войти, чтобы сменить роль</Link></Button>}
          </div>
        </header>

        <section className="card-surface overflow-x-auto p-6">
          <h2 className="mb-4 font-display text-xl font-semibold">1. Матрица прав</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2">Действие</th>
                {LEVELS.map((l, i) => (
                  <th key={l} className={`py-2 text-center ${i + 1 === col ? "text-primary" : ""}`}>
                    {LEVEL_NAME[l]}{i + 1 === col && " (вы)"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([label, ...allowed]) => (
                <tr key={label} className="border-b border-border/60">
                  <td className="py-2">{label}</td>
                  {allowed.map((ok, i) => (
                    <td key={i} className={`py-2 text-center ${i + 1 === col ? "bg-primary/5" : ""}`}>
                      {ok ? <Check className="mx-auto size-4 text-accent" /> : <X className="mx-auto size-4 text-destructive" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            Роль «Организатор» выдаётся автоматически, когда пользователь создаёт первое мероприятие,
            и снимается администратором. Она отмечает ведущих события и сама по себе доступ к чужим
            данным не расширяет.
          </p>
        </section>

        <section className="card-surface p-6">
          <h2 className="mb-4 font-display text-xl font-semibold">2. Маршруты и переходы</h2>
          <ul className="divide-y divide-border">
            {ROUTES.map((r) => {
              const ok = RANK[level] >= RANK[r.min];
              return (
                <li key={r.to} className="flex flex-wrap items-center gap-3 py-3">
                  <code className="w-24 text-sm font-semibold">{r.to}</code>
                  <span className="flex-1 text-sm">{r.label}</span>
                  <Badge variant="outline">от: {LEVEL_NAME[r.min]}</Badge>
                  {ok ? (
                    <Button asChild size="sm" variant="secondary"><Link to={r.to}>Открыть</Link></Button>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Lock className="size-4" />
                      {r.min === "user" ? "переадресация на /auth" : "нет прав — переход на /access"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card-surface p-6">
          <h2 className="mb-1 font-display text-xl font-semibold">3. Данные из базы (живой запрос)</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Один и тот же запрос «посчитать все строки» — база сама отдаёт только разрешённое вашей роли.
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["Мероприятия", data?.events, "гость — только опубликованные"],
              ["Билеты", data?.registrations, "пользователь — только свои"],
              ["Отзывы", data?.reviews, "видны всем"],
              ["Роли", data?.roles, "админ — все, иначе только своя"],
            ].map(([label, value, hint]) => (
              <div key={label as string} className="rounded-lg border border-border p-4">
                <p className="text-3xl font-bold">{isLoading ? "…" : value ?? "нет доступа"}</p>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
