import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { EventRow } from "@/lib/events";

export function EventCard({ event, registered }: { event: EventRow; registered?: number }) {
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="card-surface group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-1"
    >
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">{event.category}</Badge>
        <span className="font-display text-sm font-semibold text-primary">
          {formatPrice(event.price)}
        </span>
      </div>

      <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-primary">
        {event.title}
      </h3>

      <p className="line-clamp-2 text-sm text-muted-foreground">{event.description}</p>

      <div className="mt-auto space-y-1.5 pt-2 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-accent" />
          {formatDateTime(event.starts_at)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-accent" />
          <span className="truncate">{event.venue_name || event.address}</span>
        </p>
        <p className="flex items-center gap-2">
          <Users className="size-4 shrink-0 text-accent" />
          {registered ?? 0} из {event.capacity} мест занято
        </p>
      </div>
    </Link>
  );
}
