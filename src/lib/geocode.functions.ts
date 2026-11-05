/**
 * Геокодирование адреса через открытый API OpenStreetMap (Nominatim).
 * Вызывается из формы организатора: по адресу возвращает координаты,
 * которые сохраняются в мероприятие и показываются на карте его страницы.
 * Функция доступна только после входа — адрес ищется от имени организатора.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeocodeResult = { lat: number; lng: number; displayName: string } | null;

export const geocodeAddress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => input)
  .handler(async ({ data }): Promise<GeocodeResult> => {
    const address = data.address.trim();
    if (!address) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "sbor-events-app/1.0 (geocoding)", "Accept-Language": "ru" },
    });
    if (!res.ok) throw new Error(`Сервис карт недоступен (код ${res.status})`);
    const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const first = rows[0];
    if (!first) return null;
    return { lat: Number(first.lat), lng: Number(first.lon), displayName: first.display_name };
  });
