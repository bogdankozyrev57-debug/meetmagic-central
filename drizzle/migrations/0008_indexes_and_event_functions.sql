-- Индексы для ускорения типовых запросов
CREATE INDEX IF NOT EXISTS events_published_starts_idx ON public.events (is_published, starts_at);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);
CREATE INDEX IF NOT EXISTS events_organizer_idx ON public.events (organizer_id);
CREATE INDEX IF NOT EXISTS registrations_event_idx ON public.registrations (event_id);
CREATE INDEX IF NOT EXISTS registrations_user_idx ON public.registrations (user_id);
CREATE INDEX IF NOT EXISTS registrations_event_status_idx ON public.registrations (event_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS registrations_ticket_code_key ON public.registrations (ticket_code);
CREATE INDEX IF NOT EXISTS reviews_event_idx ON public.reviews (event_id);
CREATE INDEX IF NOT EXISTS reviews_user_idx ON public.reviews (user_id);

-- Поиск опубликованных мероприятий по названию, описанию и месту
CREATE OR REPLACE FUNCTION public.search_events(_query text)
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.events
  WHERE is_published = true
    AND (
      _query IS NULL OR _query = ''
      OR title ILIKE '%' || _query || '%'
      OR description ILIKE '%' || _query || '%'
      OR venue_name ILIKE '%' || _query || '%'
      OR address ILIKE '%' || _query || '%'
    )
  ORDER BY starts_at ASC;
$$;

-- Статистика посещаемости и отзывов по мероприятию
CREATE OR REPLACE FUNCTION public.event_stats(_event_id uuid)
RETURNS TABLE(
  registered_count bigint,
  checked_in_count bigint,
  free_seats integer,
  reviews_count bigint,
  avg_rating numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.registrations r WHERE r.event_id = _event_id AND r.status <> 'cancelled'),
    (SELECT count(*) FROM public.registrations r WHERE r.event_id = _event_id AND r.checked_in_at IS NOT NULL),
    (SELECT GREATEST(e.capacity - (SELECT count(*) FROM public.registrations r WHERE r.event_id = _event_id AND r.status <> 'cancelled'), 0)::integer FROM public.events e WHERE e.id = _event_id),
    (SELECT count(*) FROM public.reviews v WHERE v.event_id = _event_id),
    (SELECT round(avg(v.rating), 2) FROM public.reviews v WHERE v.event_id = _event_id);
$$;

-- Регистрация на мероприятие с атомарной проверкой свободных мест
CREATE OR REPLACE FUNCTION public.register_for_event(_event_id uuid)
RETURNS public.registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _event public.events%ROWTYPE;
  _taken bigint;
  _reg public.registrations%ROWTYPE;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Требуется вход в систему';
  END IF;

  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Мероприятие не найдено';
  END IF;
  IF NOT _event.is_published THEN
    RAISE EXCEPTION 'Мероприятие не опубликовано';
  END IF;

  SELECT * INTO _reg FROM public.registrations
  WHERE event_id = _event_id AND user_id = _user AND status <> 'cancelled';
  IF FOUND THEN
    RETURN _reg;
  END IF;

  SELECT count(*) INTO _taken FROM public.registrations
  WHERE event_id = _event_id AND status <> 'cancelled';
  IF _taken >= _event.capacity THEN
    RAISE EXCEPTION 'Свободных мест не осталось';
  END IF;

  INSERT INTO public.registrations (event_id, user_id)
  VALUES (_event_id, _user)
  RETURNING * INTO _reg;
  RETURN _reg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_events(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_stats(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_event(uuid) TO authenticated;