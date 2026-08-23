create or replace function public.has_team_permission(p_team_id uuid, p_permission_code text)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_team_user_id uuid;
  v_role text;
  v_override boolean;
begin
  if p_team_id is null or nullif(trim(coalesce(p_permission_code,'')),'') is null or auth.uid() is null then
    return false;
  end if;

  if not exists (select 1 from public.app_permissions ap where ap.code=p_permission_code) then
    return false;
  end if;

  select tu.id, tu.role
    into v_team_user_id, v_role
  from public.team_users tu
  where tu.team_id=p_team_id
    and tu.auth_user_id=auth.uid()
    and coalesce(tu.is_active,true)=true
  order by tu.created_at asc
  limit 1;

  if v_team_user_id is null then
    return false;
  end if;

  -- L'owner non può auto-escludersi dai permessi del proprio workspace.
  if v_role='owner' then
    return true;
  end if;

  select tup.is_allowed
    into v_override
  from public.team_user_permissions tup
  where tup.team_user_id=v_team_user_id
    and tup.permission_code=p_permission_code;

  if found then
    return coalesce(v_override,false);
  end if;

  return exists (
    select 1
    from public.role_permissions rp
    where rp.role=v_role
      and rp.permission_code=p_permission_code
  );
end;
$$;

revoke all on function public.has_team_permission(uuid,text) from public, anon;
grant execute on function public.has_team_permission(uuid,text) to authenticated, service_role;
