import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QrCode, Search, Ticket, BarChart3 } from "lucide-react";

import heroImage from "@/assets/hero-event.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EventCard } from "@/components/EventCard";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import type { EventRow } from "@/lib/events";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Сбор — мероприятия, QR-билеты и аналитика" },
      {
        name: "description",
        content:
          "Найдите встречу или конференцию, зарегистрируйтесь за минуту и проходите на вход по QR-билету.",
      },
      { property: "og:title", content: "Сбор — мероприятия, QR-билеты и аналитика" },
      {
        property: "og:description",
        content:
          "Найдите встречу или конференцию, зарегистрируйтесь за минуту и проходите на вход по QR-билету.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", "published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_published", true)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as unknown as EventRow[];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set((events ?? []).map((e) => e.category))),
    [events],
  );

  const filtered = (events ?? []).filter((event) => {
    const matchesQuery =
      query.trim().length === 0 ||
      `${event.title} ${event.description} ${event.venue_name} ${event.address}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesCategory = !category || event.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <PageShell>
      <section className="hero-surface border-b border-border/70">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
          <div>
            <Badge variant="secondary" className="mb-4">
              Регистрация · QR-вход · Аналитика
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              Проводите мероприятия, а гостей пускайте по QR-коду
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Создайте событие, откройте регистрацию, отправьте участникам электронные билеты и
              отмечайте приход одним сканированием. Отзывы и статистика посещаемости — в кабинете
              организатора.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/organizer">Создать мероприятие</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/tickets">Мои билеты</Link>
              </Button>
            </div>

            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Ticket, title: "Билеты", text: "Уникальный код для каждого участника" },
                { icon: QrCode, title: "Вход по QR", text: "Сканер прямо в браузере" },
                { icon: BarChart3, title: "Аналитика", text: "Регистрации, приход, отзывы" },
              ].map((item) => (
                <div key={item.title} className="card-surface p-4">
                  <item.icon className="size-5 text-primary" />
                  <dt className="mt-2 font-display text-sm font-semibold">{item.title}</dt>
                  <dd className="text-sm text-muted-foreground">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>

          <img
            src={heroImage}
            alt="Зал конференции с участниками перед сценой"
            width={1600}
            height={900}
            className="w-full rounded-2xl border border-border object-cover shadow-2xl"
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Ближайшие мероприятия</h2>
            <p className="text-sm text-muted-foreground">
              Выберите событие и зарегистрируйтесь — билет появится в разделе «Мои билеты».
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию или городу"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant={category === null ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategory(null)}
          >
            Все
          </Button>
          {categories.map((item) => (
            <Button
              key={item}
              variant={category === item ? "default" : "secondary"}
              size="sm"
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Ничего не нашлось. Попробуйте другой запрос.</p>
          )}
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
