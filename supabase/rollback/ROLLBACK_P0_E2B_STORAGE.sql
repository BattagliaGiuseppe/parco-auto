-- Ripristina le precedenti policy Storage membership-based.
DROP POLICY IF EXISTS driver_documents_select_permission ON storage.objects;
DROP POLICY IF EXISTS driver_documents_insert_permission ON storage.objects;
DROP POLICY IF EXISTS driver_documents_update_permission ON storage.objects;
DROP POLICY IF EXISTS driver_documents_delete_permission ON storage.objects;
CREATE POLICY driver_documents_select_team_members ON storage.objects FOR SELECT TO authenticated USING (bucket_id='driver-documents' AND public.is_team_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY driver_documents_insert_team_members ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='driver-documents' AND public.is_team_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY driver_documents_update_team_members ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='driver-documents' AND public.is_team_member(((storage.foldername(name))[1])::uuid)) WITH CHECK (bucket_id='driver-documents' AND public.is_team_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY driver_documents_delete_team_members ON storage.objects FOR DELETE TO authenticated USING (bucket_id='driver-documents' AND public.is_team_member(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS driver_photos_insert_permission ON storage.objects;
DROP POLICY IF EXISTS driver_photos_update_permission ON storage.objects;
DROP POLICY IF EXISTS driver_photos_delete_permission ON storage.objects;
CREATE POLICY driver_photos_insert_team_members ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='driver-photos' AND public.is_team_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY driver_photos_update_team_members ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='driver-photos' AND public.is_team_member(((storage.foldername(name))[1])::uuid)) WITH CHECK (bucket_id='driver-photos' AND public.is_team_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY driver_photos_delete_team_members ON storage.objects FOR DELETE TO authenticated USING (bucket_id='driver-photos' AND public.is_team_member(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS inventory_images_insert_permission ON storage.objects;
DROP POLICY IF EXISTS inventory_images_update_permission ON storage.objects;
DROP POLICY IF EXISTS inventory_images_delete_permission ON storage.objects;
CREATE POLICY inventory_images_insert_team_members ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='inventory-images' AND public.is_team_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY inventory_images_update_team_members ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='inventory-images' AND public.is_team_member(((storage.foldername(name))[1])::uuid)) WITH CHECK (bucket_id='inventory-images' AND public.is_team_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY inventory_images_delete_team_members ON storage.objects FOR DELETE TO authenticated USING (bucket_id='inventory-images' AND public.is_team_member(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS team_files_read_permission ON storage.objects;
DROP POLICY IF EXISTS team_files_insert_permission ON storage.objects;
DROP POLICY IF EXISTS team_files_update_permission ON storage.objects;
DROP POLICY IF EXISTS team_files_delete_permission ON storage.objects;
DROP FUNCTION IF EXISTS public.team_file_has_permission(text,boolean);
CREATE POLICY team_files_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='team-files' AND CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN public.is_team_member(((storage.foldername(name))[1])::uuid) ELSE false END
);
CREATE POLICY team_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='team-files' AND CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN public.is_team_member(((storage.foldername(name))[1])::uuid) ELSE false END
);
CREATE POLICY team_files_update ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id='team-files' AND CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN public.is_team_member(((storage.foldername(name))[1])::uuid) ELSE false END
) WITH CHECK (
  bucket_id='team-files' AND CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN public.is_team_member(((storage.foldername(name))[1])::uuid) ELSE false END
);
CREATE POLICY team_files_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='team-files' AND CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN public.is_team_member(((storage.foldername(name))[1])::uuid) ELSE false END
);
