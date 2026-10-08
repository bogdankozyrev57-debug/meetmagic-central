-- Хранилище аватаров (закрытая корзина «avatars»): файл лежит в папке с id пользователя.
-- Владелец может загружать, заменять и удалять свой файл; любой вошедший пользователь может его просмотреть.
CREATE POLICY "avatars_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_auth_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');