-- P0-B Storage Isolation - PRECHECK (READ ONLY)
-- Non modifica alcun dato.

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'team-files';

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'team_files_%'
order by policyname;

select
  count(*)::int as total_objects,
  count(*) filter (
    where (storage.foldername(o.name))[1] is null
       or (storage.foldername(o.name))[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )::int as invalid_team_prefix_objects,
  count(*) filter (
    where (storage.foldername(o.name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and not exists (
        select 1
        from public.teams t
        where t.id = ((storage.foldername(o.name))[1])::uuid
      )
  )::int as unknown_team_prefix_objects
from storage.objects o
where o.bucket_id = 'team-files';

select 'cars.image_url' as location, count(*)::int as legacy_public_refs
from public.cars where image_url like '%/storage/v1/object/public/team-files/%'
union all
select 'drivers.photo_url', count(*)::int
from public.drivers where photo_url like '%/storage/v1/object/public/team-files/%'
union all
select 'documents.file_url', count(*)::int
from public.documents where file_url like '%/storage/v1/object/public/team-files/%'
union all
select 'driver_documents.file_url', count(*)::int
from public.driver_documents where file_url like '%/storage/v1/object/public/team-files/%'
union all
select 'telemetry_files.file_url', count(*)::int
from public.telemetry_files where file_url like '%/storage/v1/object/public/team-files/%'
union all
select 'app_settings.dashboard_layout', count(*)::int
from public.app_settings where dashboard_layout::text like '%/storage/v1/object/public/team-files/%'
order by location;
