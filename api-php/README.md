# PHP REST-сервис «Сбор»

REST-сервис на PHP поверх базы MySQL «sbor» — той же, что открывается в phpMyAdmin.
Используется для отчётов, выгрузок и интеграций со сторонними системами.

## Запуск через XAMPP + phpMyAdmin

1. В XAMPP включить Apache и MySQL.
2. http://localhost/phpmyadmin → «Импорт» → файл `database/sbor_mysql.sql` (или свежая копия со страницы «Копии») → «Вперёд». Появится база `sbor`.
3. Скопировать `api-php/.env.example` в `api-php/.env` (там уже указан MySQL XAMPP: root без пароля).
4. Запустить: `php -S localhost:8000 -t api-php/public` и открыть http://localhost:8000/api/events.

5. Связь с сайтом: на странице сайта «Копии» нажмите «Показать ключ», впишите SITE_URL и SITE_SYNC_TOKEN в `.env` и откройте http://localhost:8000/sync.php — база в phpMyAdmin заменится текущими данными сайта. Повторяйте при каждом открытии.

Всё, что меняет PHP-сервис (например, отметки прохода), сразу видно в phpMyAdmin.

## Запуск (общий)

```bash
cp api-php/.env.example api-php/.env   # заполнить параметры подключения
php -S 0.0.0.0:8000 -t api-php/public
```

## Переменные окружения

| Имя | Описание |
| --- | --- |
| `DB_DSN` | DSN подключения, например `mysql:host=127.0.0.1;port=3306;dbname=sbor;charset=utf8mb4` (поддерживается и `pgsql:`) |
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
