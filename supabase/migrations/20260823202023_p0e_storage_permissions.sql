-- P0-E.2B: granular Storage permissions, preserving public CDN reads for non-sensitive image buckets.

-- Private driver documents.
drop policy if exists driver_documents_select_team_members on storage.objects;
drop policy if exists driver_documents_insert_team_members on storage.objects;
drop policy if exists driver_documents_update_team_members on storage.objects;
drop policy if exists driver_documents_delete_team_members on storage.objects;
create policy driver_documents_select_permission on storage.objects
for select to authenticated using (
  bucket_id='driver-documents'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.view') else false end
);
create policy driver_documents_insert_permission on storage.objects
for insert to authenticated with check (
  bucket_id='driver-documents'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
);
create policy driver_documents_update_permission on storage.objects
for update to authenticated using (
  bucket_id='driver-documents'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
) with check (
  bucket_id='driver-documents'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
);
create policy driver_documents_delete_permission on storage.objects
for delete to authenticated using (
  bucket_id='driver-documents'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
);

-- Public image buckets remain public for reads, but writes require module edit permission.
drop policy if exists driver_photos_insert_team_members on storage.objects;
drop policy if exists driver_photos_update_team_members on storage.objects;
drop policy if exists driver_photos_delete_team_members on storage.objects;
create policy driver_photos_insert_permission on storage.objects for insert to authenticated with check (
  bucket_id='driver-photos' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
);
create policy driver_photos_update_permission on storage.objects for update to authenticated using (
  bucket_id='driver-photos' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
) with check (
  bucket_id='driver-photos' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
);
create policy driver_photos_delete_permission on storage.objects for delete to authenticated using (
  bucket_id='driver-photos' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'drivers.edit') else false end
);

drop policy if exists inventory_images_insert_team_members on storage.objects;
drop policy if exists inventory_images_update_team_members on storage.objects;
drop policy if exists inventory_images_delete_team_members on storage.objects;
create policy inventory_images_insert_permission on storage.objects for insert to authenticated with check (
  bucket_id='inventory-images' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'inventory.edit') else false end
);
create policy inventory_images_update_permission on storage.objects for update to authenticated using (
  bucket_id='inventory-images' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'inventory.edit') else false end
) with check (
  bucket_id='inventory-images' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'inventory.edit') else false end
);
create policy inventory_images_delete_permission on storage.objects for delete to authenticated using (
  bucket_id='inventory-images' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then public.has_team_permission(((storage.foldername(name))[1])::uuid,'inventory.edit') else false end
);

-- Generic private team-files: first folder is team id, second folder maps to a module.
create or replace function public.team_file_has_permission(p_name text, p_write boolean default false)
returns boolean
language plpgsql
security definer
stable
set search_path=public,storage
as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_team_id uuid;
  v_area text;
  v_permission text;
begin
  if auth.uid() is null or array_length(v_parts,1) < 2 then return false; end if;
  begin v_team_id := v_parts[1]::uuid; exception when others then return false; end;
  v_area := coalesce(v_parts[2],'');

  if v_area in ('branding-favicon','branding-logo','team-sidebar-logo','team-header-logo','team-print-logo') then
    if p_write then return public.has_team_permission(v_team_id,'settings.manage'); end if;
    return public.is_team_member(v_team_id);
  elsif v_area in ('car-images','car-documents') then
    v_permission := case when p_write then 'cars.edit' else 'cars.view' end;
  elsif v_area in ('driver-documents','driver-profile') then
    v_permission := case when p_write then 'drivers.edit' else 'drivers.view' end;
  elsif v_area='telemetry' then
    v_permission := case when p_write then 'telemetry.edit' else 'telemetry.view' end;
  else
    -- Unknown/legacy areas remain team-isolated for reads; writes require team governance.
    if p_write then return public.has_team_permission(v_team_id,'team.manage'); end if;
    return public.is_team_member(v_team_id);
  end if;

  return public.has_team_permission(v_team_id,v_permission);
end;
$$;
revoke all on function public.team_file_has_permission(text,boolean) from public,anon;
grant execute on function public.team_file_has_permission(text,boolean) to authenticated,service_role;

drop policy if exists team_files_read on storage.objects;
drop policy if exists team_files_insert on storage.objects;
drop policy if exists team_files_update on storage.objects;
drop policy if exists team_files_delete on storage.objects;
create policy team_files_read_permission on storage.objects
for select to authenticated using (bucket_id='team-files' and public.team_file_has_permission(name,false));
create policy team_files_insert_permission on storage.objects
for insert to authenticated with check (bucket_id='team-files' and public.team_file_has_permission(name,true));
create policy team_files_update_permission on storage.objects
for update to authenticated using (bucket_id='team-files' and public.team_file_has_permission(name,true))
with check (bucket_id='team-files' and public.team_file_has_permission(name,true));
create policy team_files_delete_permission on storage.objects
for delete to authenticated using (bucket_id='team-files' and public.team_file_has_permission(name,true));
