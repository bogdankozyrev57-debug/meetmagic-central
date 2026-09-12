export type EventRow = {
  id: string;
  organizer_id: string | null;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  capacity: number;
  price: number;
  cover_url: string | null;
  is_published: boolean;
  created_at: string;
};

export type RegistrationRow = {
  id: string;
  event_id: string;
  user_id: string;
  ticket_code: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

export const CATEGORIES = [
  "Конференция",
  "Воркшоп",
  "Нетворкинг",
  "Спорт",
  "Концерт",
  "Встреча",
] as const;

export function mapEmbedUrl(lat: number, lng: number) {
  const d = 0.006;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}
