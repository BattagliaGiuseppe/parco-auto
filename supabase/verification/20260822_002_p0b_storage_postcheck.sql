-- P0-B Storage Isolation - POSTCHECK (READ ONLY)

select
  case when public = false
    then 'OK: team-files privato'
    else 'ERRORE: team-files ancora pubblico'
  end as bucket_status
from storage.buckets
where id = 'team-files';

select
  policyname,
  roles,
  cmd,
  case
    when coalesce(qual, with_check, '') ilike '%is_team_member%'
      or (coalesce(qual, '') ilike '%is_team_member%' and coalesce(with_check, '') ilike '%is_team_member%')
    then 'OK: isolamento team presente'
    else 'VERIFICARE POLICY'
  end as isolation_status,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'team_files_%'
order by policyname;

select
  count(*)::int as total_objects_after,
  count(*) filter (
    where (storage.foldername(o.name))[1] is null
       or (storage.foldername(o.name))[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )::int as invalid_team_prefix_objects
from storage.objects o
where o.bucket_id = 'team-files';
