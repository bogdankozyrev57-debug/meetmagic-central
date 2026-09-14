<?php

declare(strict_types=1);

namespace Sbor;

/**
 * Отметка прохода по коду билета и выгрузка посещаемости.
 */
final class CheckinController
{
    public static function checkin(array $body): void
    {
        Auth::requireToken();

        $code = trim((string) ($body['ticket_code'] ?? ''));
        if (!Validator::isTicketCode($code)) {
            Response::error('bad_request', 'Некорректный код билета', 400);
            return;
        }

        $ticket = Database::selectOne(
            'SELECT r.id, r.checked_in_at, e.title,
                    COALESCE(p.full_name, :anon) AS attendee
               FROM public.registrations r
               JOIN public.events e ON e.id = r.event_id
               LEFT JOIN public.profiles p ON p.id = r.user_id
              WHERE r.ticket_code = :code',
            ['code' => $code, 'anon' => 'Участник']
        );

        if ($ticket === null) {
            Response::error('not_found', 'Билет не найден', 404);
            return;
        }

        if ($ticket['checked_in_at'] !== null) {
            Response::json([
                'already' => true,
                'event_title' => $ticket['title'],
                'attendee' => $ticket['attendee'],
                'checked_in_at' => $ticket['checked_in_at'],
            ]);
            return;
        }

        Database::execute(
            "UPDATE public.registrations
                SET checked_in_at = now(), status = 'attended'
              WHERE id = :id",
            ['id' => $ticket['id']]
        );

        Response::json([
            'already' => false,
            'event_title' => $ticket['title'],
            'attendee' => $ticket['attendee'],
            'checked_in_at' => date(DATE_ATOM),
        ], 200);
    }

    public static function attendanceReport(): void
    {
        Auth::requireToken();

        $rows = Database::select(
            "SELECT e.title AS event,
                    to_char(e.starts_at, 'YYYY-MM-DD HH24:MI') AS starts_at,
                    COUNT(r.id) AS registered,
                    COUNT(r.checked_in_at) AS attended
               FROM public.events e
               LEFT JOIN public.registrations r ON r.event_id = e.id
              GROUP BY e.id, e.title, e.starts_at
              ORDER BY e.starts_at DESC"
        );

        Response::csv('attendance.csv', ['Мероприятие', 'Начало', 'Записей', 'Пришло'], $rows);
    }
}
