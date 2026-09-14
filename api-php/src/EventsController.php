<?php

declare(strict_types=1);

namespace Sbor;

/**
 * Публичные чтения афиши и статистика мероприятий.
 */
final class EventsController
{
    public static function list(array $query): void
    {
        $search = trim((string) ($query['q'] ?? ''));
        $category = trim((string) ($query['category'] ?? ''));

        $sql = 'SELECT id, title, description, category, starts_at, ends_at, venue_name,
                       address, lat, lng, capacity, price, cover_url
                  FROM public.events
                 WHERE is_published = true';
        $params = [];

        if ($search !== '') {
            $sql .= ' AND (title ILIKE :search OR venue_name ILIKE :search)';
            $params['search'] = '%' . $search . '%';
        }
        if ($category !== '') {
            $sql .= ' AND category = :category';
            $params['category'] = $category;
        }

        $sql .= ' ORDER BY starts_at ASC LIMIT 200';

        Response::json(['items' => Database::select($sql, $params)]);
    }

    public static function show(string $id): void
    {
        if (!Validator::isUuid($id)) {
            Response::error('bad_request', 'Некорректный идентификатор мероприятия', 400);
            return;
        }

        $event = Database::selectOne(
            'SELECT id, title, description, category, starts_at, ends_at, venue_name,
                    address, lat, lng, capacity, price, cover_url
               FROM public.events
              WHERE id = :id AND is_published = true',
            ['id' => $id]
        );

        if ($event === null) {
            Response::error('not_found', 'Мероприятие не найдено', 404);
            return;
        }

        $rating = Database::selectOne(
            'SELECT ROUND(AVG(rating)::numeric, 2) AS average, COUNT(*) AS total
               FROM public.reviews WHERE event_id = :id',
            ['id' => $id]
        );

        $event['rating'] = [
            'average' => $rating['average'] !== null ? (float) $rating['average'] : null,
            'total' => (int) ($rating['total'] ?? 0),
        ];

        Response::json($event);
    }

    public static function reviews(string $id): void
    {
        if (!Validator::isUuid($id)) {
            Response::error('bad_request', 'Некорректный идентификатор мероприятия', 400);
            return;
        }

        $rows = Database::select(
            'SELECT r.id, r.rating, r.comment, r.created_at, COALESCE(p.full_name, :anon) AS author
               FROM public.reviews r
               LEFT JOIN public.profiles p ON p.id = r.user_id
              WHERE r.event_id = :id
              ORDER BY r.created_at DESC
              LIMIT 100',
            ['id' => $id, 'anon' => 'Участник']
        );

        Response::json(['items' => $rows]);
    }

    public static function stats(string $id): void
    {
        Auth::requireToken();

        if (!Validator::isUuid($id)) {
            Response::error('bad_request', 'Некорректный идентификатор мероприятия', 400);
            return;
        }

        $row = Database::selectOne(
            'SELECT COUNT(*) AS registered,
                    COUNT(checked_in_at) AS attended
               FROM public.registrations WHERE event_id = :id',
            ['id' => $id]
        );

        $registered = (int) ($row['registered'] ?? 0);
        $attended = (int) ($row['attended'] ?? 0);

        Response::json([
            'event_id' => $id,
            'registered' => $registered,
            'attended' => $attended,
            'attendance_rate' => $registered > 0 ? round($attended / $registered * 100, 1) : 0.0,
        ]);
    }
}
