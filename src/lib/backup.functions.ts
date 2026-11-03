/**
 * Резервные копии базы данных.
 *
 * Файл копии хранится в закрытой корзине «backups» хранилища Lovable Cloud, то есть
 * на том же аккаунте, где уже живёт база проекта: его не нужно носить на флешке, он
 * доступен из любого места после входа. Списком файлов и их скачиванием заведует
 * политика «backups_read», а создавать, менять и удалять файлы может только
 * администратор (политики «backups_admin_*» через public.has_role).
 *
 * Копия собирается на сервере: читаются все таблицы (клиентский запрос к чужим
 * регистрациям или ролям правила RLS не пропустили бы), текст оформляется под MySQL,
 * чтобы файл можно было импортировать в phpMyAdmin, и загружается в хранилище.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "backups";

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

/** Значение поля -> текст для вставки в MySQL (кавычки, NULL, даты, флаги). */
function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (value instanceof Date) return sqlDate(value.toISOString());
  if (typeof value === "object") return escape(`"${JSON.stringify(value)}"`);
  const text = String(value);
  // Дата/время из базы приходит строкой вида 2026-10-03T05:41:47.123456+00:00
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) return sqlDate(text);
  return escape(`"${text}"`);
}

function escape(quoted: string): string {
  return quoted
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** ISO-дата -> формат DATETIME для MySQL (без миллисекунд и часового пояса). */
function sqlDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "NULL";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `"${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}"`;
}

/** Строки таблицы -> блок INSERT INTO ... VALUES. */
function insertBlock(table: string, columns: string[], rows: Record<string, unknown>[]): string {
  if (!rows.length) return `-- ${table}: записей нет\n`;
  const values = rows.map(
    (row) => `(${columns.map((column) => sqlValue(row[column])).join(",")})`,
  );
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values.join(",\n")};\n`;
}

/** Собрать текст резервной копии всей базы в формате MySQL. */
export async function buildBackupDump(admin: {
  from: (table: string) => { select: (columns: string) => PromiseLike<{ data: unknown; error: unknown }> };
}): Promise<string> {
  const tables: { name: string; columns: string[] }[] = [
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
    {
      name: "reviews",
      columns: ["id", "event_id", "user_id", "rating", "comment", "created_at"],
    },
  ];

  const parts = [DDL];
  for (const table of tables) {
    const { data, error } = await admin.from(table.name).select("*");
    if (error) throw new Error(`Не удалось прочитать таблицу ${table.name}`);
    const rows = (data ?? []) as Record<string, unknown>[];
    parts.push(insertBlock(table.name, table.columns, rows));
  }
  parts.push("SET FOREIGN_KEY_CHECKS=1;\n");
  return parts.join("\n");
}

/**
 * Создать резервную копию: собрать текст базы и положить его в закрытую корзину
 * «backups». Доступен только администраторам — роль проверяется на сервере по
 * токену сессии, а не по данным браузера.
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
    // поэтому клиент с правами сервера подключается уже после проверки роли.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const dump = await buildBackupDump(supabaseAdmin as never);
    const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
    const path = `sbor-${stamp}.sql`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(dump, "utf8"), {
        contentType: "text/sql; charset=utf-8",
        upsert: true,
      });
    if (uploadError) throw new Error("Не удалось сохранить копию в хранилище");

    return { path, size: Buffer.byteLength(dump, "utf8") };
  });
