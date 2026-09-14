# PHP REST-сервис «Сбор»

Дополнительный публичный REST-слой на PHP поверх той же базы PostgreSQL.
Используется для отчётов, выгрузок и интеграций со сторонними системами.

## Запуск

```bash
cp api-php/.env.example api-php/.env   # заполнить параметры подключения
php -S 0.0.0.0:8000 -t api-php/public
```

## Переменные окружения

| Имя | Описание |
| --- | --- |
| `DB_DSN` | DSN подключения, например `pgsql:host=...;port=5432;dbname=postgres;sslmode=require` |
| `DB_USER` | Пользователь БД |
| `DB_PASSWORD` | Пароль |
| `API_TOKEN` | Токен организатора для защищённых методов (заголовок `Authorization: Bearer ...`) |

## Эндпойнты

| Метод | Путь | Доступ |
| --- | --- | --- |
| GET | `/api/health` | публично |
| GET | `/api/events?q=&category=` | публично |
| GET | `/api/events/{id}` | публично |
| GET | `/api/events/{id}/reviews` | публично |
| GET | `/api/events/{id}/stats` | по токену |
| POST | `/api/checkin` | по токену |
| GET | `/api/report/attendance.csv` | по токену |

Все запросы к БД выполняются подготовленными выражениями PDO.
