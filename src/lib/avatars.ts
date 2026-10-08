/**
 * Аватар пользователя. Файл лежит в закрытом хранилище «avatars» в папке с
 * идентификатором пользователя, поэтому правила доступа разрешают загружать и
 * менять только свой файл. В колонке profiles.avatar_url хранится путь объекта
 * (например "…/avatar"), а ссылка для показа выдаётся «подписанной» и действует
 * ограниченное время.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
/** Сколько часов действует ссылка на файл. */
const SIGNED_URL_TTL = 60 * 60;

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Путь файла аватара в хранилище. */
export function avatarPath(userId: string) {
  return `${userId}/avatar`;
}

/** Ссылка, по которой браузер может показать аватар (null, если аватара нет). */
export async function getAvatarUrl(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(stored, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Загрузить или заменить файл аватара. Возвращает путь для сохранения в профиле. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Нужен файл изображения");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Файл больше 2 МБ");
  const path = avatarPath(userId);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error("Не удалось загрузить изображение");
  return path;
}

/** Удалить файл аватара, если он есть. */
export async function deleteAvatar(stored: string | null): Promise<void> {
  if (!stored) return;
  const { error } = await supabase.storage.from(BUCKET).remove([stored]);
  if (error) throw new Error("Не удалось удалить изображение");
}
