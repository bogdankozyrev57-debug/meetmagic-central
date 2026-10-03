CREATE POLICY events_admin_update ON public.events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, DELETE ON public.user_roles TO authenticated;
CREATE POLICY user_roles_admin_insert ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY user_roles_admin_delete ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') AND user_id <> auth.uid());