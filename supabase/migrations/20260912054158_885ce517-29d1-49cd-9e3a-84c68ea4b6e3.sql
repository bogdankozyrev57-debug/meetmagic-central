REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_in_ticket(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(TEXT) TO authenticated;