CREATE OR REPLACE FUNCTION public.assign_default_role()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  -- Назначенные администраторы получают роль admin при регистрации
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id AND lower(email) IN ('bogdankozyrev57@gmail.com','kozyrev.bogdan.03@mail.ru')) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;