-- Уточнение политик корзины «backups»: читать список и содержимое файлов может
-- только вошедший пользователь, а изменять — администратор (has_role('admin')).
DROP POLICY IF EXISTS "backups_read" ON storage.objects;

CREATE POLICY "backups_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'backups');