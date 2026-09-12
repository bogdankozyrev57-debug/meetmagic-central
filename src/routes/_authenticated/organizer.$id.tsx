import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/PageShell";
import { QrScanner } from "@/components/QrScanner";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { EventRow, RegistrationRow, ReviewRow } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/organizer/$id")({
  head: () => ({
    meta: [
      { title: "Участники и QR-вход — Сбор" },
      {
        name: "description",
        content: "Список участников, отметка прихода по QR-коду и статистика посещаемости.",
      },
      { property: "og:title", content: "Участники и QR-вход — Сбор" },
      {
        property: "og:description",
        content: "Список участников, отметка прихода по QR-коду и статистика посещаемости.",
      },
    ],
  }),
  component: ManageEventPage,
});

function ManageEventPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["manage-event", id],
    queryFn: async () => {
      const [eventRes, regsRes, reviewsRes] = await Promise.all([
        supabase.from("events").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("registrations")
          .select("*")
          .eq("event_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("reviews").select("*").eq("event_id", id),
      ]);
      const event = eventRes.data as unknown as EventRow | null;
      const registrations = (regsRes.data ?? []) as unknown as RegistrationRow[];
      const reviews = (reviewsRes.data ?? []) as unknown as ReviewRow[];
      const ids = Array.from(new Set(registrations.map((r) => r.user_id)));
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
      return { event, registrations, reviews, names };
    },
  });

  const checkIn = useCallback(
    async (code: string) => {
      if (!code || busy) return;
      setBusy(true);
      const { data: result, error } = await supabase.rpc("check_in_ticket", {
        _ticket_code: code,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message || "Билет не принят");
        return;
      }
      const row = Array.isArray(result) ? result[0] : result;
      if (row?.already) {
        toast.warning(`Билет уже был отмечен: ${row.attendee}`);
      } else {
        toast.success(`Вход подтверждён: ${row?.attendee ?? "участник"}`);
      }
      setManualCode("");
      queryClient.invalidateQueries({ queryKey: ["manage-event", id] });
    },
    [busy, id, queryClient],
  );

  if (isLoading) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl px-4 py-12">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageShell>
    );
  }

  const event = data?.event;
  if (!event) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Мероприятие недоступно</h1>
          <Button asChild className="mt-6">
            <Link to="/organizer">В кабинет</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const registrations = data?.registrations ?? [];
  const reviews = data?.reviews ?? [];
  const names = data?.names ?? {};
  const attended = registrations.filter((r) => r.checked_in_at).length;
  const fill = Math.round((registrations.length / Math.max(event.capacity, 1)) * 100);
  const attendance = registrations.length
    ? Math.round((attended / registrations.length) * 100)
    : 0;
  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <Link to="/organizer" className="text-sm text-muted-foreground hover:underline">
          ← Кабинет организатора
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(event.starts_at)} · {event.venue_name}, {event.address}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Регистраций", value: `${registrations.length}` },
            { label: "Пришли", value: `${attended}` },
            { label: "Явка", value: `${attendance}%` },
            { label: "Средняя оценка", value: avgRating },
          ].map((stat) => (
            <div key={stat.label} className="card-surface p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="card-surface mt-6 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Заполненность зала</span>
            <span className="font-medium">
              {registrations.length} / {event.capacity}
            </span>
          </div>
          <Progress value={Math.min(fill, 100)} className="mt-3" />
        </div>

        <section className="card-surface mt-8 p-6">
          <h2 className="font-display text-xl font-semibold">Отметка прихода по QR</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Наведите камеру на QR-код участника или введите код билета вручную.
          </p>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <QrScanner onScan={checkIn} />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                checkIn(manualCode.trim());
              }}
            >
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Код билета"
                className="font-mono"
              />
              <Button type="submit" disabled={busy}>
                Отметить
              </Button>
            </form>
          </div>
        </section>

        <section className="card-surface mt-8 p-6">
          <h2 className="font-display text-xl font-semibold">Участники</h2>
          <div className="mt-4 space-y-2">
            {registrations.length === 0 && (
              <p className="text-sm text-muted-foreground">Регистраций пока нет.</p>
            )}
            {registrations.map((registration) => (
              <div
                key={registration.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-medium">{names[registration.user_id] ?? "Участник"}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {registration.ticket_code}
                  </p>
                </div>
                {registration.checked_in_at ? (
                  <Badge className="bg-success text-success-foreground">
                    Пришёл · {formatDateTime(registration.checked_in_at)}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Зарегистрирован</Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
