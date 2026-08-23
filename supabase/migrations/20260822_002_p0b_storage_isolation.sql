-- P0-B Storage Isolation
-- Prerequisito: deploy del client compatibile con URL firmati (PATCH_P0_B_STORAGE_ISOLATION).
-- Non sposta, rinomina o cancella oggetti esistenti.

begin;

-- 1) Il bucket non deve più essere scaricabile tramite URL pubblico.
update storage.buckets
set public = false
where id = 'team-files';

-- 2) Rimuove le policy legacy che consentono a qualsiasi autenticato
--    di operare su qualunque oggetto del bucket.
drop policy if exists team_files_read on storage.objects;
drop policy if exists team_files_insert on storage.objects;
drop policy if exists team_files_update on storage.objects;
drop policy if exists team_files_delete on storage.objects;

-- Il primo segmento del path deve essere un UUID valido e l'utente deve
-- appartenere a quel team. CASE evita cast UUID su path malformati.
create policy team_files_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'team-files'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_team_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy team_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'team-files'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_team_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy team_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'team-files'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_team_member(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  bucket_id = 'team-files'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_team_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy team_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'team-files'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_team_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

commit;
