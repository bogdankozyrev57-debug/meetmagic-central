-- Журнал ошибок приложения: сюда браузер и сервер пишут сбои,
-- администратор смотрит их в панели на вкладке «Журнал».
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  source text NOT NULL DEFAULT 'client',
  message text NOT NULL,
  stack text,
  url text,
  user_agent text
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Писать в журнал может любой посетитель (даже без входа), читать и чистить — только админ.
CREATE POLICY error_logs_insert ON public.error_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY error_logs_admin_select ON public.error_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY error_logs_admin_delete ON public.error_logs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT INSERT ON public.error_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.error_logs TO authenticated;

CREATE INDEX IF NOT EXISTS error_logs_created_idx ON public.error_logs (created_at DESC);