-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Конференция',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  venue_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  capacity INTEGER NOT NULL DEFAULT 100,
  price INTEGER NOT NULL DEFAULT 0,
  cover_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_public_read" ON public.events FOR SELECT USING (is_published = true);
CREATE POLICY "events_owner_read" ON public.events FOR SELECT TO authenticated USING (auth.uid() = organizer_id);
CREATE POLICY "events_owner_insert" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "events_owner_update" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "events_owner_delete" ON public.events FOR DELETE TO authenticated USING (auth.uid() = organizer_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- registrations
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ticket_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9), 'hex'),
  status TEXT NOT NULL DEFAULT 'registered',
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registrations_own_read" ON public.registrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "registrations_organizer_read" ON public.registrations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));
CREATE POLICY "registrations_insert_own" ON public.registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "registrations_delete_own" ON public.registrations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "registrations_organizer_update" ON public.registrations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));

-- reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- check-in by ticket code (organizer only)
CREATE OR REPLACE FUNCTION public.check_in_ticket(_ticket_code TEXT)
RETURNS TABLE (registration_id UUID, event_title TEXT, attendee TEXT, checked_in_at TIMESTAMPTZ, already BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.registrations%ROWTYPE;
  e public.events%ROWTYPE;
  was_checked BOOLEAN;
BEGIN
  SELECT * INTO r FROM public.registrations WHERE ticket_code = _ticket_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Билет не найден'; END IF;
  SELECT * INTO e FROM public.events WHERE id = r.event_id;
  IF e.organizer_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Нет доступа к этому мероприятию'; END IF;
  was_checked := r.checked_in_at IS NOT NULL;
  IF NOT was_checked THEN
    UPDATE public.registrations SET checked_in_at = now(), status = 'attended' WHERE id = r.id RETURNING * INTO r;
  END IF;
  RETURN QUERY
    SELECT r.id, e.title, COALESCE(p.full_name, 'Участник'), r.checked_in_at, was_checked
    FROM public.profiles p WHERE p.id = r.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.check_in_ticket(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(TEXT) TO authenticated;

-- demo events
INSERT INTO public.events (title, description, category, starts_at, ends_at, venue_name, address, lat, lng, capacity, price)
VALUES
('TechMeet 2026: Будущее веба', 'Однодневная конференция о современных веб-технологиях, производительности и дизайне интерфейсов. Доклады, воркшопы и нетворкинг.', 'Конференция', now() + interval '21 days', now() + interval '21 days 8 hours', 'Цифровое деловое пространство', 'Москва, ул. Покровка, 47', 55.7614, 37.6534, 300, 0),
('Product Design Weekend', 'Практический интенсив по UX/UI: от исследования до прототипа. Работа в командах над реальными кейсами.', 'Воркшоп', now() + interval '10 days', now() + interval '12 days', 'Loft Hall', 'Санкт-Петербург, наб. Обводного канала, 118', 59.9092, 30.3200, 80, 2500),
('Startup Night: питч-сессия', 'Вечер презентаций молодых команд перед инвесторами и сообществом. 10 питчей по 5 минут и свободный нетворкинг.', 'Нетворкинг', now() + interval '4 days', now() + interval '4 days 5 hours', 'Коворкинг «Точка»', 'Казань, ул. Баумана, 44', 55.7903, 49.1150, 120, 0),
('Data & AI Summit', 'Большая встреча инженеров данных и ML-специалистов: архитектуры, MLOps, продуктовые кейсы.', 'Конференция', now() + interval '45 days', now() + interval '46 days', 'Конгресс-холл', 'Новосибирск, ул. Кирова, 3', 55.0084, 82.9357, 500, 4900),
('Городской забег сообщества', 'Утренний забег на 5 и 10 км с последующим завтраком и обсуждением планов сообщества.', 'Спорт', now() + interval '2 days', now() + interval '2 days 4 hours', 'Парк Горького', 'Москва, Крымский Вал, 9', 55.7298, 37.6013, 200, 0);