/**
 * Валидация формы мероприятия (ключевая сущность CRUD).
 * Схема zod используется перед созданием и обновлением записи —
 * некорректные данные не уходят в БД, а пользователь видит ошибку у поля.
 */
import { z } from "zod";
import { CATEGORIES } from "@/lib/events";

export const eventFormSchema = z.object({
  title: z.string().trim().min(3, "Минимум 3 символа").max(120, "Максимум 120 символов"),
  description: z.string().trim().max(2000, "Максимум 2000 символов"),
  category: z.enum(CATEGORIES, { message: "Выберите категорию" }),
  starts_at: z
    .string()
    .min(1, "Укажите дату и время")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Некорректная дата"),
  venue_name: z.string().trim().max(160, "Максимум 160 символов"),
  address: z.string().trim().max(240, "Максимум 240 символов"),
  capacity: z.coerce.number({ message: "Введите число" }).int("Целое число").min(1, "Минимум 1").max(100000, "Слишком много"),
  price: z.coerce.number({ message: "Введите число" }).int("Целое число").min(0, "Не может быть отрицательной").max(1000000, "Слишком дорого"),
  is_published: z.boolean(),
});

export type EventFormValues = z.input<typeof eventFormSchema>;
export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

/** Возвращает либо валидные данные, либо ошибки по полям */
export function validateEventForm(values: EventFormValues) {
  const result = eventFormSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} as EventFormErrors };
  const errors: EventFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof EventFormValues;
    if (!errors[key]) errors[key] = issue.message;
  }
  return { data: null, errors };
}

/** Перевод ошибок БД/сети в понятный текст (обработка исключений) */
export function describeDbError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return "Неизвестная ошибка";
  if (e.code === "42501" || e.code === "PGRST301") return "Нет прав на это действие";
  if (e.code === "23503") return "Нельзя удалить: есть связанные записи";
  if (e.code === "23514" || e.code === "22P02") return "Данные не прошли проверку";
  if (e.message?.includes("Failed to fetch")) return "Нет соединения с сервером";
  return e.message || "Ошибка сервера";
}
