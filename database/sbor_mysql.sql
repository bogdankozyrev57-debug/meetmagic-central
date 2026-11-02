-- База данных проекта «Сбор» для импорта в phpMyAdmin (MySQL 5.7+/MariaDB 10.3+)
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

INSERT INTO profiles (id, full_name, avatar_url, created_at) VALUES
('fa822928-5a24-4f2d-9165-6c57978e4933','Алексанр Redeviu',NULL,'2026-09-30 17:42:14'),
('0aea3337-ad3e-4294-99e8-b79ad32f78d5','Алексанр Redevioii',NULL,'2026-09-30 17:44:01'),
('7d683bbc-b23d-4cf8-8077-dab78face9e1','Богдан Козырев',NULL,'2026-10-06 15:52:11'),
('c6f3505e-2a4e-42ea-8372-b96634423a95','Богдан Redevi',NULL,'2026-10-10 13:21:58'),
('31fd0600-6217-447b-a0bc-6f834c4be5e0','Богдан Redevi',NULL,'2026-10-10 13:24:53');

INSERT INTO user_roles (id, user_id, role, created_at) VALUES
('7a61096e-ed03-490a-89a8-be0324751821','fa822928-5a24-4f2d-9165-6c57978e4933','user','2026-10-01 11:19:57'),
('20bfca65-3e61-4d24-8a8a-78a87f19aa72','0aea3337-ad3e-4294-99e8-b79ad32f78d5','user','2026-10-01 11:19:57'),
('ea3135d9-741c-4cea-ac74-2da2089be51e','7d683bbc-b23d-4cf8-8077-dab78face9e1','user','2026-10-06 15:52:11'),
('598b11a0-c38f-4ac6-a84f-efade2551970','7d683bbc-b23d-4cf8-8077-dab78face9e1','admin','2026-10-06 15:52:11'),
('7d39fbfa-c43d-4492-bc6b-bdaddd04231a','c6f3505e-2a4e-42ea-8372-b96634423a95','user','2026-10-10 13:21:58'),
(UUID(),'31fd0600-6217-447b-a0bc-6f834c4be5e0','user','2026-10-10 13:24:53');

INSERT INTO events (id, organizer_id, title, description, category, starts_at, ends_at, venue_name, address, lat, lng, capacity, price, cover_url, is_published, created_at, updated_at) VALUES
('2f18880a-6c72-4ced-8c47-60481004f930',NULL,'TechMeet 2026: Будущее веба','Однодневная конференция о современных веб-технологиях, производительности и дизайне интерфейсов. Доклады, воркшопы и нетворкинг.','Конференция','2026-10-03 05:41:47','2026-10-03 13:41:47','Цифровое деловое пространство','Москва, ул. Покровка, 47',55.7614,37.6534,300,0,NULL,1,'2026-09-12 05:41:47','2026-09-12 05:41:47'),
('16f8286e-a4df-4d1c-922d-292ccb5c6cbd',NULL,'Product Design Weekend','Практический интенсив по UX/UI: от исследования до прототипа. Работа в командах над реальными кейсами.','Воркшоп','2026-09-22 05:41:47','2026-09-24 05:41:47','Loft Hall','Санкт-Петербург, наб. Обводного канала, 118',59.9092,30.32,80,2500,NULL,1,'2026-09-12 05:41:47','2026-09-12 05:41:47'),
('a3838c8c-9628-436d-9a4f-736fbc7d85d6',NULL,'Startup Night: питч-сессия','Вечер презентаций молодых команд перед инвесторами и сообществом. 10 питчей по 5 минут и свободный нетворкинг.','Нетворкинг','2026-09-16 05:41:47','2026-09-16 10:41:47','Коворкинг «Точка»','Казань, ул. Баумана, 44',55.7903,49.115,120,0,NULL,1,'2026-09-12 05:41:47','2026-09-12 05:41:47'),
('b7c86eab-7626-427c-ada0-6267846acf7c',NULL,'Data & AI Summit','Большая встреча инженеров данных и ML-специалистов: архитектуры, MLOps, продуктовые кейсы.','Конференция','2026-10-27 05:41:47','2026-10-28 05:41:47','Конгресс-холл','Новосибирск, ул. Кирова, 3',55.0084,82.9357,500,4900,NULL,1,'2026-09-12 05:41:47','2026-09-12 05:41:47'),
('8a4085e3-a4c1-4210-a34e-9e357ee1843d',NULL,'Городской забег сообщества','Утренний забег на 5 и 10 км с последующим завтраком и обсуждением планов сообщества.','Спорт','2026-09-14 05:41:47','2026-09-14 09:41:47','Парк Горького','Москва, Крымский Вал, 9',55.7298,37.6013,200,0,NULL,1,'2026-09-12 05:41:47','2026-09-12 05:41:47');

SET FOREIGN_KEY_CHECKS=1;
