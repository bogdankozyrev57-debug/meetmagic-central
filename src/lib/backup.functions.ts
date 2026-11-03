/**
 * Резервные копии базы данных.
 *
 * Файл копии хранится в закрытой корзине «backups» хранилища Lovable Cloud, то есть
 * на том же аккаунте, где уже живёт база проекта: его не нужно носить на флешке, он
 * доступен из любого места после входа. Списком файлов и их скачиванием заведует
 * политика «backups_read», а создавать, заменять и удалять файлы может только
 * администратор (политики «backups_admin_*» через public.has_role).
 *
 * Копию собирает сервер: читаются все таблицы (клиентский запрос к чужим регистрациям
 * или ролям правила RLS не пропустили бы), текст оформляется под MySQL, чтобы файл
 * можно было импортировать в phpMyAdmin, и загружается в хранилище.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BACKUP_BUCKET = "backups";

/** Структура таблиц в формате MySQL — тот же файл открывает phpMyAdmin. */
const DDL = `-- База данных проекта «Сбор» (MySQL 5.7+/MariaDB 10.3+)
-- Импорт: phpMyAdmin -> Импорт -> выбрать этот файл -> Вперёд
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
CREATE DATABASE IF NOT EXISTS sbor DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sbor;

DROP TABLE IF EXISTS reviews, registrations, user_roles, events, profiles;

CREATE TABLE profiles (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Профили пользователей';

CREATE TABLE user_roles (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin','organizer','user') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_role (user_id, role),
  CONSTRAINT fk_roles_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Роли пользователей';

CREATE TABLE events (
  id CHAR(36) PRIMARY KEY,
  organizer_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  venue_name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  capacity INT NOT NULL DEFAULT 100,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cover_url TEXT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_events_start (starts_at),
  CONSTRAINT fk_events_org FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Мероприятия';

CREATE TABLE registrations (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  ticket_code VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'registered',
  checked_in_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reg (event_id, user_id),
  CONSTRAINT fk_reg_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_reg_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Регистрации и QR-билеты';

CREATE TABLE reviews (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (event_id, user_id),
  CONSTRAINT fk_rev_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Отзывы';
`;

/** Порядок и состав таблиц, которые попадают в резервную копию. */
export type DumpTableName = "profiles" | "user_roles" | "events" | "registrations" | "reviews";

export const DUMP_TABLES: { name: DumpTableName; columns: string[] }[] = [
  { name: "profiles", columns: ["id", "full_name", "avatar_url", "created_at"] },
  { name: "user_roles", columns: ["id", "user_id", "role", "created_at"] },
  {
    name: "events",
    columns: [
      "id",
      "organizer_id",
      "title",
      "description",
      "category",
      "starts_at",
      "ends_at",
      "venue_name",
      "address",
      "lat",
      "lng",
      "capacity",
      "price",
      "cover_url",
      "is_published",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "registrations",
    columns: ["id", "event_id", "user_id", "ticket_code", "status", "checked_in_at", "created_at"],
  },
  { name: "reviews", columns: ["id", "event_id", "user_id", "rating", "comment", "created_at"] },
];

export type DumpTable = { name: string; columns: string[]; rows: Record<string, unknown>[] };

/** Значение поля -> текст для вставки в MySQL (кавычки, NULL, даты, флаги). */
function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (value instanceof Date) return sqlDate(value.toISOString());
  if (typeof value === "object") return escapeText(JSON.stringify(value));
  const text = String(value);
  // Дата из базы приходит строкой вида 2026-10-03T05:41:47.123456+00:00
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) return sqlDate(text);
  return escapeText(text);
}

function escapeText(text: string): string {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `'${escaped}'`;
}

/** ISO-дата -> формат DATETIME для MySQL (без миллисекунд и часового пояса). */
function sqlDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "NULL";
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `'${stamp}'`;
}

/** Строки таблицы -> блок INSERT INTO ... VALUES. */
function insertBlock(table: DumpTable): string {
  if (!table.rows.length) return `-- ${table.name}: записей нет\n`;
  const values = table.rows.map(
    (row) => `(${table.columns.map((column) => sqlValue(row[column])).join(", ")})`,
  );
  return `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES\n${values.join(",\n")};\n`;
}

/** Собрать текст резервной копии: структура таблиц + все данные. */
export function buildDumpSql(tables: DumpTable[]): string {
  return `${DDL}\n${tables.map(insertBlock).join("\n")}\nSET FOREIGN_KEY_CHECKS=1;\n`;
}

/** Имя файла копии с меткой времени: sbor-2026-11-03-0657.sql */
export function backupFileName(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `sbor-${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}` +
    `-${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}.sql`
  );
}

/**
 * Создать резервную копию: собрать текст базы и положить его в закрытую корзину
 * «backups». Раздел доступен только администраторам — роль проверяется на сервере
 * по токену сессии, а не по данным браузера.
 */
export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ path: string; size: number }> => {
    const { data: adminRole, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (roleError) throw roleError;
    if (!adminRole?.length) throw new Error("Резервные копии доступны только администраторам");

    // Полное чтение базы и запись в хранилище — привилегированная операция,
    // поэтому серверный клиент подключается уже после проверки роли.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tables: DumpTable[] = [];
    for (const table of DUMP_TABLES) {
      const { data, error } = await supabaseAdmin.from(table.name).select("*");
      if (error) throw new Error(`Не удалось прочитать таблицу ${table.name}`);
      tables.push({ ...table, rows: (data ?? []) as unknown as Record<string, unknown>[] });
    }

    const dump = buildDumpSql(tables);
    const bytes = new TextEncoder().encode(dump);
    const path = backupFileName(new Date());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .upload(path, bytes, { contentType: "text/sql; charset=utf-8", upsert: true });
    if (uploadError) throw new Error("Не удалось сохранить копию в хранилище");

    return { path, size: bytes.length };
  });
