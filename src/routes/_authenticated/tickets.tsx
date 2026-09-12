import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/PageShell";
import { TicketQr } from "@/components/TicketQr";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { EventRow, RegistrationRow } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({
    meta: [
      { title: "Мои билеты — Сбор" },
      {
        name: "description",
        content: "Электронные QR-билеты на мероприятия, на которые вы зарегистрировались.",
      },
      { property: "og:title", content: "Мои билеты — Сбор" },
      {
        property: "og:description",
        content: "Электронные QR-билеты на мероприятия, на которые вы зарегистрировались.",
      },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const { data: regs, error } = await supabase
        .from("registrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const registrations = (regs ?? []) as unknown as RegistrationRow[];
      const ids = registrations.map((r) => r.event_id);
      if (ids.length === 0) return [];
      const { data: events } = await supabase.from("events").select("*").in("id", ids);
      const byId = new Map(
        ((events ?? []) as unknown as EventRow[]).map((event) => [event.id, event]),
      );
      return registrations
        .map((registration) => ({ registration, event: byId.get(registration.event_id) }))
        .filter((item): item is { registration: RegistrationRow; event: EventRow } =>
          Boolean(item.event),
        );
    },
  });

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Мои билеты</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Покажите QR-код на входе — организатор отсканирует его и отметит ваш приход.
        </p>

        <div className="mt-8 space-y-4">
          {isLoading && <Skeleton className="h-48 w-full rounded-xl" />}

          {!isLoading && (data ?? []).length === 0 && (
            <div className="card-surface p-8 text-center">
              <p className="text-sm text-muted-foreground">У вас пока нет билетов.</p>
              <Button asChild className="mt-4">
                <Link to="/">Выбрать мероприятие</Link>
              </Button>
            </div>
          )}

          {(data ?? []).map(({ registration, event }) => (
            <div
              key={registration.id}
              className="card-surface flex flex-col gap-5 p-5 sm:flex-row sm:items-center"
            >
              <TicketQr code={registration.ticket_code} size={150} />
              <div className="min-w-0 flex-1">
                <Badge variant="secondary">{event.category}</Badge>
                <h2 className="mt-2 font-display text-lg font-semibold">{event.title}</h2>
                <p className="text-sm text-muted-foreground">{formatDateTime(event.starts_at)}</p>
                <p className="text-sm text-muted-foreground">
                  {event.venue_name}, {event.address}
                </p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {registration.ticket_code}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {registration.checked_in_at ? (
                    <Badge className="bg-success text-success-foreground">
                      Приход отмечен {formatDateTime(registration.checked_in_at)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Ожидает входа</Badge>
                  )}
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/events/$id" params={{ id: event.id }}>
                      О мероприятии
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
