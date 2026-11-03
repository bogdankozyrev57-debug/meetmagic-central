-- Хранилище резервных копий базы (закрытая корзина «backups»).
-- Вошедший пользователь может просмотреть список файлов и скачать их (политика SELECT),
-- а создавать, заменять и удалять файлы может только администратор (has_role('admin')) —
-- обойти это нельзя даже при прямом запросе к хранилищу.
CREATE POLICY "backups_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'backups');

CREATE POLICY "backups_admin_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "backups_admin_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "backups_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::public.app_role)
);