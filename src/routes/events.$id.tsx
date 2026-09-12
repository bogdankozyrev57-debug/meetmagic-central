import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, MapPin, Star, Ticket, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/PageShell";
import { TicketQr } from "@/components/TicketQr";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { mapEmbedUrl, type EventRow, type RegistrationRow, type ReviewRow } from "@/lib/events";

export const Route = createFileRoute("/events/$id")({
  head: () => ({
    meta: [
      { title: "Мероприятие — Сбор" },
      {
        name: "description",
        content: "Программа, место проведения, отзывы и регистрация с электронным QR-билетом.",
      },
      { property: "og:title", content: "Мероприятие — Сбор" },
      {
        property: "og:description",
        content: "Программа, место проведения, отзывы и регистрация с электронным QR-билетом.",
      },
    ],
  }),
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as EventRow | null;
    },
  });

  const registrationQuery = useQuery({
    queryKey: ["registration", id, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RegistrationRow | null;
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const reviews = (data ?? []) as unknown as ReviewRow[];
      const ids = Array.from(new Set(reviews.map((r) => r.user_id)));
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        names = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || "Участник"]),
        );
      }
      return reviews.map((r) => ({ ...r, author: names[r.user_id] ?? "Участник" }));
    },
  });

  const event = eventQuery.data;
  const registration = registrationQuery.data;
  const reviews = reviewsQuery.data ?? [];
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  async function handleRegister() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("registrations")
      .insert({ event_id: id, user_id: user.id });
    setBusy(false);
    if (error) {
      toast.error("Не удалось зарегистрироваться");
      return;
    }
    toast.success("Вы зарегистрированы! QR-билет готов.");
    queryClient.invalidateQueries({ queryKey: ["registration", id, user.id] });
  }

  async function handleCancel() {
    if (!registration) return;
    setBusy(true);
    const { error } = await supabase.from("registrations").delete().eq("id", registration.id);
    setBusy(false);
    if (error) {
      toast.error("Не удалось отменить регистрацию");
      return;
    }
    toast.success("Регистрация отменена");
    queryClient.invalidateQueries({ queryKey: ["registration", id, user?.id] });
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("reviews")
      .upsert({ event_id: id, user_id: user.id, rating, comment }, { onConflict: "event_id,user_id" });
    setBusy(false);
    if (error) {
      toast.error("Не удалось сохранить отзыв");
      return;
    }
    setComment("");
    toast.success("Спасибо за отзыв!");
    queryClient.invalidateQueries({ queryKey: ["reviews", id] });
  }

  if (eventQuery.isLoading) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl px-4 py-12">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (!event) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Мероприятие не найдено</h1>
          <Button asChild className="mt-6">
            <Link to="/">Ко всем мероприятиям</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="hero-surface border-b border-border/70">
        <div className="mx-auto w-full max-w-5xl px-4 py-12">
          <Badge variant="secondary">{event.category}</Badge>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{event.title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              {formatDateTime(event.starts_at)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-4 text-accent" />
              {event.venue_name}, {event.address}
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4 text-accent" />
              {event.capacity} мест
            </span>
            {avgRating && (
              <span className="flex items-center gap-2">
                <Star className="size-4 text-primary" />
                {avgRating} / 5 · отзывов: {reviews.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <section className="card-surface p-6">
            <h2 className="font-display text-xl font-semibold">О мероприятии</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </section>

          {event.lat != null && event.lng != null && (
            <section className="card-surface overflow-hidden">
              <div className="p-6 pb-3">
                <h2 className="font-display text-xl font-semibold">Место проведения</h2>
                <p className="text-sm text-muted-foreground">
                  {event.venue_name} · {event.address}
                </p>
              </div>
              <iframe
                title="Карта места проведения"
                src={mapEmbedUrl(event.lat, event.lng)}
                className="h-72 w-full border-0"
                loading="lazy"
              />
            </section>
          )}

          <section className="card-surface p-6">
            <h2 className="font-display text-xl font-semibold">Отзывы</h2>

            <form onSubmit={handleReview} className="mt-4 space-y-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-label={`Оценка ${value}`}
                  >
                    <Star
                      className={
                        value <= rating
                          ? "size-6 fill-primary text-primary"
                          : "size-6 text-muted-foreground"
                      }
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Как прошло мероприятие?"
                rows={3}
              />
              <Button type="submit" disabled={busy} size="sm">
                {user ? "Оставить отзыв" : "Войти и оставить отзыв"}
              </Button>
            </form>

            <div className="mt-6 space-y-4">
              {reviews.length === 0 && (
                <p className="text-sm text-muted-foreground">Отзывов пока нет — будьте первым.</p>
              )}
              {reviews.map((review) => (
                <div key={review.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{review.author}</span>
                    <span className="flex items-center gap-1 text-sm text-primary">
                      <Star className="size-4 fill-primary" />
                      {review.rating}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            <p className="font-display text-2xl font-bold text-primary">
              {formatPrice(event.price)}
            </p>

            {registration ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <TicketQr code={registration.ticket_code} size={170} />
                  <p className="text-center text-xs text-muted-foreground">
                    Код билета: <span className="font-mono">{registration.ticket_code}</span>
                  </p>
                  {registration.checked_in_at && (
                    <Badge className="bg-success text-success-foreground">Приход отмечен</Badge>
                  )}
                </div>
                <Button variant="secondary" className="w-full" onClick={handleCancel} disabled={busy}>
                  Отменить регистрацию
                </Button>
              </div>
            ) : (
              <Button className="mt-4 w-full" onClick={handleRegister} disabled={busy}>
                <Ticket className="size-4" />
                {user ? "Зарегистрироваться" : "Войти и зарегистрироваться"}
              </Button>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              После регистрации билет с QR-кодом появится в разделе «Мои билеты». Покажите его на
              входе — организатор отсканирует код.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
