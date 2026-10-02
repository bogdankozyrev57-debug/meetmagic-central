/**
 * Кабинет организатора — полный CRUD для ключевой сущности «Мероприятие»:
 *  C — создание (форма «Новое мероприятие»)
 *  R — чтение списка своих мероприятий из БД
 *  U — редактирование (кнопка «Изменить» открывает ту же форму с данными)
 *  D — удаление с подтверждением
 * Валидация формы — src/lib/event-schema.ts (zod), ошибки показываются у полей.
 * Исключения БД/сети перехватываются try/catch и выводятся через toast.
 * Права проверяет RLS: изменять/удалять можно только свои мероприятия.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { CATEGORIES, type EventRow } from "@/lib/events";
import {
  describeDbError,
  validateEventForm,
  type EventFormErrors,
  type EventFormValues,
} from "@/lib/event-schema";

export const Route = createFileRoute("/_authenticated/organizer")({
  head: () => ({
    meta: [
      { title: "Кабинет организатора — Сбор" },
      {
        name: "description",
        content: "Создавайте, редактируйте и удаляйте мероприятия, управляйте участниками.",
      },
      { property: "og:title", content: "Кабинет организатора — Сбор" },
      {
        property: "og:description",
        content: "Создавайте, редактируйте и удаляйте мероприятия, управляйте участниками.",
      },
    ],
  }),
  component: OrganizerPage,
});

const emptyForm: EventFormValues = {
  title: "",
  description: "",
  category: CATEGORIES[0],
  starts_at: "",
  venue_name: "",
  address: "",
  capacity: "100",
  price: "0",
  is_published: true,
};

/** ISO-дата → значение для input[type=datetime-local] в локальном времени */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function OrganizerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EventFormValues>(emptyForm);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<EventRow | null>(null);

  // R — чтение
  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ["organizer-events", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .eq("organizer_id", user!.id)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (events ?? []) as unknown as EventRow[];
    },
  });

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(event: EventRow) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      category: (CATEGORIES as readonly string[]).includes(event.category)
        ? (event.category as EventFormValues["category"])
        : CATEGORIES[0],
      starts_at: toLocalInput(event.starts_at),
      venue_name: event.venue_name,
      address: event.address,
      capacity: String(event.capacity),
      price: String(event.price),
      is_published: event.is_published,
    });
    setErrors({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  }

  // C / U — создание или обновление
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { data: valid, errors: fieldErrors } = validateEventForm(form);
    if (!valid) {
      setErrors(fieldErrors);
      toast.error("Проверьте поля формы");
      return;
    }
    const payload = { ...valid, starts_at: new Date(valid.starts_at).toISOString() };

    setBusy(true);
    try {
      if (editingId) {
        const { data: rows, error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingId)
          .select("id");
        if (error) throw error;
        if (!rows?.length) throw { code: "42501" };
        toast.success("Изменения сохранены");
      } else {
        const { error } = await supabase
          .from("events")
          .insert({ ...payload, organizer_id: user.id });
        if (error) throw error;
        toast.success("Мероприятие создано");
      }
      closeForm();
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["organizer-events", user.id] });
    } catch (err) {
      toast.error(describeDbError(err));
    } finally {
      setBusy(false);
    }
  }

  // D — удаление
  async function confirmDelete() {
    if (!toDelete || !user) return;
    try {
      const { data: rows, error } = await supabase
        .from("events")
        .delete()
        .eq("id", toDelete.id)
        .select("id");
      if (error) throw error;
      if (!rows?.length) throw { code: "42501" };
      toast.success("Мероприятие удалено");
      if (editingId === toDelete.id) closeForm();
      await queryClient.invalidateQueries({ queryKey: ["organizer-events", user.id] });
    } catch (err) {
      toast.error(describeDbError(err));
    } finally {
      setToDelete(null);
    }
  }

  const fieldError = (key: keyof EventFormValues) =>
    errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Кабинет организатора</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Создание, редактирование и удаление мероприятий, участники и QR-вход.
            </p>
          </div>
          <Button onClick={showForm ? closeForm : openCreate}>
            <Plus className="size-4" />
            {showForm ? "Скрыть форму" : "Новое мероприятие"}
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="card-surface mt-8 grid gap-4 p-6 sm:grid-cols-2"
          >
            <h2 className="font-display text-xl font-semibold sm:col-span-2">
              {editingId ? "Редактирование мероприятия" : "Новое мероприятие"}
            </h2>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Название *</Label>
              <Input id="title" value={form.title} aria-invalid={!!errors.title}
                onChange={(e) => set("title", e.target.value)} />
              {fieldError("title")}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea id="description" rows={4} value={form.description}
                onChange={(e) => set("description", e.target.value)} />
              {fieldError("description")}
            </div>
            <div className="space-y-2">
              <Label>Категория *</Label>
              <Select value={form.category}
                onValueChange={(v) => set("category", v as EventFormValues["category"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("category")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="starts_at">Дата и время начала *</Label>
              <Input id="starts_at" type="datetime-local" value={form.starts_at}
                aria-invalid={!!errors.starts_at}
                onChange={(e) => set("starts_at", e.target.value)} />
              {fieldError("starts_at")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue">Площадка</Label>
              <Input id="venue" value={form.venue_name}
                onChange={(e) => set("venue_name", e.target.value)} />
              {fieldError("venue_name")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Адрес</Label>
              <Input id="address" value={form.address}
                onChange={(e) => set("address", e.target.value)} />
              {fieldError("address")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Вместимость *</Label>
              <Input id="capacity" type="number" min={1} value={String(form.capacity)}
                aria-invalid={!!errors.capacity}
                onChange={(e) => set("capacity", e.target.value)} />
              {fieldError("capacity")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Цена, ₽ *</Label>
              <Input id="price" type="number" min={0} value={String(form.price)}
                aria-invalid={!!errors.price}
                onChange={(e) => set("price", e.target.value)} />
              {fieldError("price")}
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch id="published" checked={form.is_published}
                onCheckedChange={(v) => set("is_published", v)} />
              <Label htmlFor="published">Опубликовать в афише</Label>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Сохранение…" : editingId ? "Сохранить изменения" : "Создать мероприятие"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>Отмена</Button>
            </div>
          </form>
        )}

        <div className="mt-10 space-y-4">
          {isLoading && <Skeleton className="h-28 w-full rounded-xl" />}
          {loadError && (
            <div className="card-surface p-5 text-sm">
              <p className="text-destructive">Не удалось загрузить: {describeDbError(loadError)}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => refetch()}>
                Повторить
              </Button>
            </div>
          )}
          {!isLoading && !loadError && (data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Вы ещё не создали ни одного мероприятия.</p>
          )}
          {(data ?? []).map((event) => (
            <div key={event.id} className="card-surface flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{event.category}</Badge>
                  {!event.is_published && <Badge variant="outline">Черновик</Badge>}
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold">{event.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(event.starts_at)} · {event.venue_name}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/organizer/$id" params={{ id: event.id }}>Участники и QR-вход</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(event)}>
                  <Pencil className="size-4" /> Изменить
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(event)}>
                  <Trash2 className="size-4" /> Удалить
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить мероприятие?</AlertDialogTitle>
            <AlertDialogDescription>
              «{toDelete?.title}» будет удалено вместе с билетами и отзывами. Действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
