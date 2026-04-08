-- =========================================
-- PARCO AUTO · TEAM INVITES PATCH
-- Da eseguire sul database live per abilitare
-- inviti team e accettazione senza onboarding
-- =========================================

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending',
  note text,
  invited_by_team_user_id uuid references public.team_users(id) on delete set null,
  invited_by_auth_user_id uuid,
  accepted_by_auth_user_id uuid,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_invites_status_check'
      and conrelid = 'public.team_invites'::regclass
  ) then
    alter table public.team_invites
      add constraint team_invites_status_check
      check (status in ('pending', 'accepted', 'revoked', 'expired'));
  end if;
end $$;

create unique index if not exists team_invites_team_email_pending_idx
  on public.team_invites (team_id, lower(email))
  where status = 'pending';

drop trigger if exists trg_set_updated_at_team_invites on public.team_invites;
create trigger trg_set_updated_at_team_invites
before update on public.team_invites
for each row execute function public.set_updated_at();

create or replace function public.get_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

create or replace function public.create_team_invite(
  p_team_id uuid,
  p_email text,
  p_role text default 'viewer',
  p_note text default null,
  p_expires_in_days integer default 7
)
returns table (
  id uuid,
  team_id uuid,
  email text,
  role text,
  token uuid,
  status text,
  expires_at timestamptz,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_inviter_team_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if not public.is_team_manager(p_team_id) then
    raise exception 'Permessi insufficienti per invitare membri in questo team';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));

  if v_email = '' then
    raise exception 'Email invito obbligatoria';
  end if;

  if p_role not in ('owner', 'admin', 'engineer', 'mechanic', 'viewer') then
    raise exception 'Ruolo invito non valido';
  end if;

  if exists (
    select 1
    from public.team_users tu
    where tu.team_id = p_team_id
      and tu.is_active = true
      and lower(coalesce(tu.email, '')) = v_email
  ) then
    raise exception 'Esiste già un membro attivo con questa email nel team';
  end if;

  select tu.id
  into v_inviter_team_user_id
  from public.team_users tu
  where tu.team_id = p_team_id
    and tu.auth_user_id = auth.uid()
    and tu.is_active = true
  limit 1;

  update public.team_invites ti
  set role = p_role,
      note = nullif(trim(coalesce(p_note, '')), ''),
      token = gen_random_uuid(),
      status = 'pending',
      expires_at = now() + make_interval(days => greatest(1, least(coalesce(p_expires_in_days, 7), 30))),
      invited_by_team_user_id = v_inviter_team_user_id,
      invited_by_auth_user_id = auth.uid(),
      accepted_by_auth_user_id = null,
      accepted_at = null,
      updated_at = now()
  where ti.team_id = p_team_id
    and lower(ti.email) = v_email
    and ti.status = 'pending';

  if found then
    return query
      select ti.id, ti.team_id, ti.email, ti.role, ti.token, ti.status, ti.expires_at, ti.note, ti.created_at
      from public.team_invites ti
      where ti.team_id = p_team_id
        and lower(ti.email) = v_email
        and ti.status = 'pending'
      order by ti.updated_at desc
      limit 1;
    return;
  end if;

  insert into public.team_invites (
    team_id,
    email,
    role,
    note,
    invited_by_team_user_id,
    invited_by_auth_user_id,
    expires_at
  )
  values (
    p_team_id,
    v_email,
    p_role,
    nullif(trim(coalesce(p_note, '')), ''),
    v_inviter_team_user_id,
    auth.uid(),
    now() + make_interval(days => greatest(1, least(coalesce(p_expires_in_days, 7), 30)))
  );

  return query
    select ti.id, ti.team_id, ti.email, ti.role, ti.token, ti.status, ti.expires_at, ti.note, ti.created_at
    from public.team_invites ti
    where ti.team_id = p_team_id
      and lower(ti.email) = v_email
      and ti.status = 'pending'
    order by ti.created_at desc
    limit 1;
end;
$$;

create or replace function public.get_public_team_invite(p_token uuid)
returns table (
  id uuid,
  team_name text,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  is_valid boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ti.id,
    t.name as team_name,
    ti.email,
    ti.role,
    ti.status,
    ti.expires_at,
    (ti.status = 'pending' and ti.expires_at > now()) as is_valid
  from public.team_invites ti
  join public.teams t on t.id = ti.team_id
  where ti.token = p_token
  limit 1
$$;

create or replace function public.list_my_pending_team_invites()
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  email text,
  role text,
  token uuid,
  status text,
  expires_at timestamptz,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ti.id,
    ti.team_id,
    t.name as team_name,
    ti.email,
    ti.role,
    ti.token,
    ti.status,
    ti.expires_at,
    ti.note,
    ti.created_at
  from public.team_invites ti
  join public.teams t on t.id = ti.team_id
  where public.get_auth_email() <> ''
    and lower(ti.email) = public.get_auth_email()
    and ti.status = 'pending'
    and ti.expires_at > now()
  order by ti.created_at asc
$$;

create or replace function public.accept_team_invite(p_token uuid)
returns table (
  team_user_id uuid,
  team_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid;
  v_email text;
  v_invite public.team_invites%rowtype;
  v_team_user_id uuid;
begin
  v_auth_user := auth.uid();
  if v_auth_user is null then
    raise exception 'Utente non autenticato';
  end if;

  v_email := public.get_auth_email();
  if v_email = '' then
    raise exception 'Email account non disponibile';
  end if;

  select *
  into v_invite
  from public.team_invites
  where token = p_token
  limit 1
  for update;

  if not found then
    raise exception 'Invito non trovato';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Questo invito non è più pendente';
  end if;

  if v_invite.expires_at <= now() then
    update public.team_invites
    set status = 'expired'
    where id = v_invite.id;

    raise exception 'Invito scaduto';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'Questo invito è associato a un''altra email';
  end if;

  insert into public.team_users (team_id, auth_user_id, email, role, is_active)
  values (v_invite.team_id, v_auth_user, v_email, v_invite.role, true)
  on conflict (team_id, auth_user_id)
  do update set
    email = excluded.email,
    role = excluded.role,
    is_active = true,
    updated_at = now()
  returning id into v_team_user_id;

  update public.team_invites
  set status = 'accepted',
      accepted_at = now(),
      accepted_by_auth_user_id = v_auth_user,
      updated_at = now()
  where id = v_invite.id;

  return query
    select v_team_user_id, v_invite.team_id;
end;
$$;

alter table public.team_invites enable row level security;

drop policy if exists team_invites_select_manager on public.team_invites;
drop policy if exists team_invites_insert_manager on public.team_invites;
drop policy if exists team_invites_update_manager on public.team_invites;
drop policy if exists team_invites_delete_manager on public.team_invites;

create policy team_invites_select_manager
on public.team_invites
for select
using (public.is_team_manager(team_id));

create policy team_invites_insert_manager
on public.team_invites
for insert
with check (public.is_team_manager(team_id));

create policy team_invites_update_manager
on public.team_invites
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy team_invites_delete_manager
on public.team_invites
for delete
using (public.is_team_manager(team_id));
