import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/organizer")({
  head: () => ({
    meta: [
      { title: "Кабинет организатора — Сбор" },
      {
        name: "description",
        content: "Создавайте мероприятия, управляйте участниками и смотрите аналитику посещаемости.",
      },
      { property: "og:title", content: "Кабинет организатора — Сбор" },
      {
        property: "og:description",
        content: "Создавайте мероприятия, управляйте участниками и смотрите аналитику посещаемости.",
      },
    ],
  }),
  component: OrganizerPage,
});

const emptyForm = {
  title: "",
  description: "",
  category: CATEGORIES[0] as string,
  starts_at: "",
  venue_name: "",
  address: "",
  capacity: "100",
  price: "0",
};

function OrganizerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data: created, error } = await supabase
      .from("events")
      .insert({
        organizer_id: user.id,
        title: form.title,
        description: form.description,
        category: form.category,
        starts_at: new Date(form.starts_at).toISOString(),
        venue_name: form.venue_name,
        address: form.address,
        capacity: Number(form.capacity) || 100,
        price: Number(form.price) || 0,
      })
      .select()
      .maybeSingle();
    setBusy(false);
    if (error || !created) {
      toast.error("Не удалось создать мероприятие");
      return;
    }
    toast.success("Мероприятие создано");
    setForm(emptyForm);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["organizer-events", user.id] });
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Кабинет организатора</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ваши мероприятия, участники, сканирование QR-билетов и статистика.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" />
            {showForm ? "Скрыть форму" : "Новое мероприятие"}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="card-surface mt-8 grid gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Категория</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="starts_at">Дата и время начала</Label>
              <Input
                id="starts_at"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue">Площадка</Label>
              <Input
                id="venue"
                value={form.venue_name}
                onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Адрес</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Вместимость</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Цена, ₽</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                Опубликовать мероприятие
              </Button>
            </div>
          </form>
        )}

        <div className="mt-10 space-y-4">
          {isLoading && <Skeleton className="h-28 w-full rounded-xl" />}
          {!isLoading && (data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Вы ещё не создали ни одного мероприятия.
            </p>
          )}
          {(data ?? []).map((event) => (
            <div
              key={event.id}
              className="card-surface flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div>
                <Badge variant="secondary">{event.category}</Badge>
                <h2 className="mt-2 font-display text-lg font-semibold">{event.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(event.starts_at)} · {event.venue_name}
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link to="/organizer/$id" params={{ id: event.id }}>
                  Участники и QR-вход
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
