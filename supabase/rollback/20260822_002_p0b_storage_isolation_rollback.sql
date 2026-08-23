-- P0-B Storage Isolation - ROLLBACK
-- Ripristina ESATTAMENTE il modello Storage precedente alla P0-B.
-- Usare solo se indicato durante il rollback operativo.

begin;

update storage.buckets
set public = true
where id = 'team-files';

drop policy if exists team_files_read on storage.objects;
drop policy if exists team_files_insert on storage.objects;
drop policy if exists team_files_update on storage.objects;
drop policy if exists team_files_delete on storage.objects;

create policy team_files_read
on storage.objects
for select
to authenticated
using (bucket_id = 'team-files');

create policy team_files_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'team-files');

create policy team_files_update
on storage.objects
for update
to authenticated
using (bucket_id = 'team-files')
with check (bucket_id = 'team-files');

create policy team_files_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'team-files');

commit;
