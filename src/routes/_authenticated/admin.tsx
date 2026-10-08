/**
 * Панель администратора (/admin).
 * Права проверяются в двух местах: загрузчик маршрута запрашивает роли на сервере
 * (без роли admin страница не открывается — идёт переход на /access), а сами
 * запросы к данным пропускаются только политиками RLS events_admin_* и
 * user_roles_admin_* (функция public.has_role), поэтому обойти панель нельзя.
 * Вкладка «Мероприятия»: поиск, фильтры, сортировка, пагинация, смена статуса,
 * редактирование и удаление. Вкладка «Пользователи»: просмотр ролей и их выдача.
 */
import { createFileRoute, Link, redirect, type ErrorComponentProps } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/events";
import { describeDbError } from "@/lib/event-schema";
import { formatDateTime } from "@/lib/format";
import { ROLE_NAME, type AppRole } from "@/lib/roles";
import { getMyRoles } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Панель администратора — Сбор" },
      { name: "description", content: "Управление мероприятиями и пользователями платформы." },
      { property: "og:title", content: "Панель администратора — Сбор" },
      { property: "og:description", content: "Управление мероприятиями и пользователями платформы." },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Проверка роли до показа страницы: без роли admin — переход на страницу «Права»
  loader: async () => {
    const roles = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/access" });
    return { roles };
  },
  errorComponent: AdminUnavailable,
  notFoundComponent: AdminUnavailable,
  component: AdminPage,
});

/** Заглушка, если права не подтвердились или запрос к серверу не удался. */
function AdminUnavailable({ error }: { error?: unknown }) {
  return (
    <PageShell>
      <div className="mx-auto max-w-md p-12 text-center">
        <h1 className="font-display text-2xl font-bold">Панель недоступна</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error && error.message
            ? error.message
            : "Раздел доступен только администраторам."}
        </p>
        <Button asChild className="mt-6">
          <Link to="/access">Права доступа</Link>
        </Button>
      </div>
    </PageShell>
  );
}

const PAGE_SIZE = 10;
const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm";

type AdminEvent = {
  id: string; title: string; category: string; starts_at: string;
  is_published: boolean; venue_name: string; address: string; capacity: number; price: number;
};

function AdminPage() {
  const [tab, setTab] = useState<"events" | "users">("events");

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Панель администратора</h1>
        <div className="mt-4 flex gap-2">
          <Button variant={tab === "events" ? "default" : "outline"} onClick={() => setTab("events")}>Мероприятия</Button>
          <Button variant={tab === "users" ? "default" : "outline"} onClick={() => setTab("users")}>Пользователи</Button>
        </div>
        {tab === "events" ? <EventsAdmin /> : <UsersAdmin />}
      </div>
    </PageShell>
  );
}

/* ---------------- Мероприятия ---------------- */
function EventsAdmin() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("starts_at:desc");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AdminEvent | null>(null);

  const [sortField, sortDir] = sort.split(":") as [string, string];

  // Серверная пагинация, сортировка и фильтрация (range + order + ilike)
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-events", q, cat, status, sort, page],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("id, title, category, starts_at, is_published, venue_name, address, capacity, price", { count: "exact" })
        .order(sortField, { ascending: sortDir === "asc" })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const term = q.trim().replace(/[%,()]/g, "");
      if (term) query = query.or(`title.ilike.%${term}%,venue_name.ilike.%${term}%,address.ilike.%${term}%`);
      if (cat !== "all") query = query.eq("category", cat);
      if (status !== "all") query = query.eq("is_published", status === "published");
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as AdminEvent[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-events"] });
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };

  async function toggleStatus(e: AdminEvent) {
    try {
      const { error } = await supabase.from("events").update({ is_published: !e.is_published }).eq("id", e.id);
      if (error) throw error;
      toast.success(e.is_published ? "Мероприятие скрыто" : "Мероприятие опубликовано");
      refresh();
    } catch (err) { toast.error(describeDbError(err)); }
  }

  async function remove(id: string) {
    if (!confirm("Удалить мероприятие?")) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Удалено");
      refresh();
    } catch (err) { toast.error(describeDbError(err)); }
  }

  function toggleSort(field: string) {
    setSort(sortField === field && sortDir === "asc" ? `${field}:desc` : `${field}:asc`);
    setPage(0);
  }
  const arrow = (f: string) => (sortField === f ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Поиск по названию или месту" className="sm:max-w-xs" />
        <select aria-label="Категория" className={selectCls} value={cat} onChange={(e) => resetPage(setCat)(e.target.value)}>
          <option value="all">Все категории</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Статус" className={selectCls} value={status} onChange={(e) => resetPage(setStatus)(e.target.value)}>
          <option value="all">Любой статус</option>
          <option value="published">Опубликовано</option>
          <option value="hidden">Скрыто</option>
        </select>
        <select aria-label="Сортировка" className={selectCls} value={sort} onChange={(e) => resetPage(setSort)(e.target.value)}>
          <option value="starts_at:desc">Сначала поздние</option>
          <option value="starts_at:asc">Сначала ранние</option>
          <option value="title:asc">Название А–Я</option>
          <option value="title:desc">Название Я–А</option>
          <option value="price:asc">Цена ↑</option>
          <option value="price:desc">Цена ↓</option>
        </select>
      </div>

      <div className="card-surface mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="cursor-pointer p-3" onClick={() => toggleSort("title")}>Название{arrow("title")}</th>
              <th className="p-3">Категория</th>
              <th className="cursor-pointer p-3" onClick={() => toggleSort("starts_at")}>Дата{arrow("starts_at")}</th>
              <th className="p-3">Статус</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr>}
            {error && <tr><td colSpan={5} className="p-6 text-center text-destructive">{describeDbError(error)}</td></tr>}
            {!isLoading && !error && rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Ничего не найдено</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3"><Link to="/events/$id" params={{ id: e.id }} className="font-medium hover:text-primary">{e.title}</Link></td>
                <td className="p-3">{e.category}</td>
                <td className="p-3">{formatDateTime(e.starts_at)}</td>
                <td className="p-3"><Badge variant={e.is_published ? "default" : "secondary"}>{e.is_published ? "Опубликовано" : "Скрыто"}</Badge></td>
                <td className="whitespace-nowrap p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(e)}>{e.is_published ? "Скрыть" : "Опубликовать"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Изменить</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(e.id)}>Удалить</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Всего: {total} · страница {page + 1} из {pages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Вперёд</Button>
        </div>
      </div>

      {editing && <EditForm event={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </>
  );
}

/** Форма редактирования мероприятия администратором с валидацией. */
function EditForm({ event, onClose, onSaved }: { event: AdminEvent; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: event.title, category: event.category, venue_name: event.venue_name,
    address: event.address, capacity: String(event.capacity), price: String(event.price),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    const t = form.title.trim();
    if (t.length < 3 || t.length > 120) e["title"] = "Название: от 3 до 120 символов";
    const cap = Number(form.capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 100000) e["capacity"] = "Вместимость: целое 1–100000";
    const pr = Number(form.price);
    if (!Number.isInteger(pr) || pr < 0 || pr > 1000000) e["price"] = "Цена: целое 0–1000000";
    if (form.venue_name.length > 160) e["venue_name"] = "Не более 160 символов";
    if (form.address.length > 240) e["address"] = "Не более 240 символов";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("events").update({
        title: form.title.trim(), category: form.category, venue_name: form.venue_name.trim(),
        address: form.address.trim(), capacity: Number(form.capacity), price: Number(form.price),
      }).eq("id", event.id);
      if (error) throw error;
      toast.success("Сохранено");
      onSaved();
    } catch (err) { toast.error(describeDbError(err)); }
    finally { setSaving(false); }
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1" />
      {errors[key] && <span className="mt-1 block text-xs text-destructive">{errors[key]}</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="font-display text-xl font-bold">Редактирование</h2>
        {field("title", "Название")}
        <label className="block text-sm">
          <span className="font-medium">Категория</span>
          <select className={`${selectCls} mt-1 w-full`} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {field("venue_name", "Площадка")}
        {field("address", "Адрес")}
        <div className="grid grid-cols-2 gap-3">
          {field("capacity", "Вместимость", "number")}
          {field("price", "Цена, ₽", "number")}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Пользователи ---------------- */
type AdminUser = { id: string; full_name: string | null; created_at: string; roles: AppRole[] };

function UsersAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  // Список профилей плюс роли каждого пользователя (политика user_roles_own_read
  // пропускает администратору все строки — см. user_roles_admin_* политики)
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", q, page],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id, full_name, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const term = q.trim().replace(/[%,()]/g, "");
      if (term) query = query.ilike("full_name", `%${term}%`);
      const { data: profiles, error, count } = await query;
      if (error) throw error;
      const ids = (profiles ?? []).map((p) => p.id);
      const { data: roles, error: rErr } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [], error: null };
      if (rErr) throw rErr;
      const byUser = new Map<string, AppRole[]>();
      for (const r of roles ?? []) {
        const list = byUser.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        byUser.set(r.user_id, list);
      }
      const rows: AdminUser[] = (profiles ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
      return { rows, total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  /** Выдать роль или снять её (политики user_roles_admin_insert / _delete). */
  async function setRole(id: string, role: AppRole, make: boolean) {
    try {
      const { error } = make
        ? await supabase.from("user_roles").insert({ user_id: id, role })
        : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", role);
      if (error) throw error;
      toast.success(make ? `Назначена роль «${ROLE_NAME[role]}»` : `Роль «${ROLE_NAME[role]}» снята`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) { toast.error(describeDbError(err)); }
  }

  return (
    <>
      <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Поиск по имени" className="mt-6 sm:max-w-xs" />
      <div className="card-surface mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-3">Имя</th><th className="p-3">Зарегистрирован</th><th className="p-3">Роли</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr>}
            {error && <tr><td colSpan={4} className="p-6 text-center text-destructive">{describeDbError(error)}</td></tr>}
            {!isLoading && !error && rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Никого не найдено</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3 font-medium">{u.full_name || "Без имени"}{u.id === user?.id && " (вы)"}</td>
                <td className="p-3">{formatDateTime(u.created_at)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length
                      ? u.roles.map((r) => (
                          <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{ROLE_NAME[r]}</Badge>
                        ))
                      : <Badge variant="outline">Пользователь</Badge>}
                  </div>
                </td>
                <td className="whitespace-nowrap p-3 text-right">
                  {/* Свою строку не правим: политики не разрешают снимать роли у себя */}
                  {u.id !== user?.id && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setRole(u.id, "organizer", !u.roles.includes("organizer"))}>
                        {u.roles.includes("organizer") ? "Снять организатора" : "Сделать организатором"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRole(u.id, "admin", !u.roles.includes("admin"))}>
                        {u.roles.includes("admin") ? "Снять админа" : "Сделать админом"}
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Всего: {data?.total ?? 0} · страница {page + 1} из {pages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Вперёд</Button>
        </div>
      </div>
    </>
  );
}
