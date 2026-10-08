-- Роль «организатор»: выдаётся автоматически, как только пользователь создаёт первое мероприятие.
CREATE OR REPLACE FUNCTION public.assign_organizer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.organizer_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.organizer_id, 'organizer'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END
$function$;

-- Существующие организаторы получают роль (заполнение уже созданных мероприятий)
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT e.organizer_id, 'organizer'::public.app_role
FROM public.events e
WHERE e.organizer_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS on_event_created_organizer ON public.events;
CREATE TRIGGER on_event_created_organizer
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.assign_organizer_role();