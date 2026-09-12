const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const shortFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  return dateFmt.format(new Date(value));
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return "";
  return shortFmt.format(new Date(value));
}

export function formatPrice(price: number) {
  return price === 0 ? "Бесплатно" : `${price.toLocaleString("ru-RU")} ₽`;
}
