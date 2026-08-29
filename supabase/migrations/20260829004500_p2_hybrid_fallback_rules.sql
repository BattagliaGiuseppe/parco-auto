-- P2.8.3 Hybrid Fallback Rules
-- External logger remains primary. Smartphone can take temporary authority only
-- after a verified stale logger heartbeat and an explicit fallback activation.

alter table public.connected_devices add column if not exists hybrid_fallback_enabled boolean not null default false;
alter table public.connected_devices add column if not exists hybrid_fallback_after_seconds integer not null default 30;
alter table public.connected_devices add column if not exists hybrid_fallback_activated_at timestamptz;

alter table public.connected_devices drop constraint if exists connected_devices_hybrid_fallback_after_check;
alter table public.connected_devices add constraint connected_devices_hybrid_fallback_after_check
  check (hybrid_fallback_after_seconds between 15 and 300);

alter table public.connected_devices drop constraint if exists connected_devices_mode_authority_consistency_check;
alter table public.connected_devices add constraint connected_devices_mode_authority_consistency_check check (
  (acquisition_mode='smartphone' and session_authority='smartphone') or
  (acquisition_mode='external_logger' and session_authority='external_logger') or
  (acquisition_mode='hybrid' and session_authority in ('external_logger','smartphone'))
);

create or replace function public.set_connected_device_acquisition_mode(p_team_id uuid,p_device_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path='public' as $function$
declare d public.connected_devices%rowtype;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
  if p_mode not in ('smartphone','external_logger','hybrid') then raise exception 'Modalità acquisizione non valida'; end if;

  update public.connected_devices
     set acquisition_mode=p_mode,
         session_authority=case when p_mode='smartphone' then 'smartphone' else 'external_logger' end,
         hybrid_fallback_enabled=case when p_mode='hybrid' then true else hybrid_fallback_enabled end,
         hybrid_fallback_activated_at=null
   where id=p_device_id and team_id=p_team_id
   returning * into d;

  if not found then raise exception 'Dispositivo non trovato'; end if;
  return jsonb_build_object(
    'id',d.id,
    'acquisition_mode',d.acquisition_mode,
    'session_authority',d.session_authority,
    'hybrid_fallback_enabled',d.hybrid_fallback_enabled,
    'hybrid_fallback_after_seconds',d.hybrid_fallback_after_seconds
  );
end;
$function$;
revoke all on function public.set_connected_device_acquisition_mode(uuid,uuid,text) from public;
grant execute on function public.set_connected_device_acquisition_mode(uuid,uuid,text) to authenticated,service_role;

create or replace function public.set_connected_device_hybrid_fallback(
  p_team_id uuid,
  p_device_id uuid,
  p_enabled boolean,
  p_after_seconds integer default 30
) returns jsonb
language plpgsql security definer set search_path='public' as $function$
declare d public.connected_devices%rowtype; v_after integer;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
  v_after:=greatest(15,least(300,coalesce(p_after_seconds,30)));
  select * into d from public.connected_devices where id=p_device_id and team_id=p_team_id for update;
  if not found then raise exception 'Dispositivo non trovato'; end if;
  if d.acquisition_mode<>'hybrid' then raise exception 'Fallback configurabile solo in modalità ibrida'; end if;

  update public.connected_devices
     set hybrid_fallback_enabled=coalesce(p_enabled,false),
         hybrid_fallback_after_seconds=v_after,
         session_authority=case when coalesce(p_enabled,false) then session_authority else 'external_logger' end,
         hybrid_fallback_activated_at=case when coalesce(p_enabled,false) then hybrid_fallback_activated_at else null end
   where id=d.id returning * into d;

  return jsonb_build_object(
    'id',d.id,
    'hybrid_fallback_enabled',d.hybrid_fallback_enabled,
    'hybrid_fallback_after_seconds',d.hybrid_fallback_after_seconds,
    'session_authority',d.session_authority,
    'hybrid_fallback_activated_at',d.hybrid_fallback_activated_at
  );
end;
$function$;
revoke all on function public.set_connected_device_hybrid_fallback(uuid,uuid,boolean,integer) from public;
grant execute on function public.set_connected_device_hybrid_fallback(uuid,uuid,boolean,integer) to authenticated,service_role;

create or replace function public.activate_connected_hybrid_fallback(p_device_key text)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $function$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  s public.connected_device_live_state%rowtype;
  v_hash text;
  v_age numeric;
begin
  if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys
   where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now())
   order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;

  select * into d from public.connected_devices
   where id=k.device_id and team_id=k.team_id and status='active' for update;
  if not found then raise exception 'Dispositivo non attivo'; end if;
  if d.acquisition_mode<>'hybrid' then raise exception 'Fallback disponibile solo in modalità ibrida'; end if;
  if not d.hybrid_fallback_enabled then raise exception 'Fallback smartphone disabilitato'; end if;

  select * into s from public.connected_device_live_state where device_id=d.id;
  if not found then raise exception 'Fallback non disponibile: nessun heartbeat logger precedente'; end if;

  v_age:=extract(epoch from(now()-s.updated_at));
  if v_age < d.hybrid_fallback_after_seconds then
    raise exception 'Logger ancora online o soglia offline non raggiunta (% s)',round(v_age);
  end if;

  update public.connected_devices
     set session_authority='smartphone',hybrid_fallback_activated_at=now()
   where id=d.id returning * into d;
  update public.connected_device_keys set last_used_at=now() where id=k.id;

  return jsonb_build_object(
    'ok',true,
    'device_id',d.id,
    'session_authority',d.session_authority,
    'hybrid_fallback_activated_at',d.hybrid_fallback_activated_at,
    'logger_age_seconds',round(v_age),
    'fallback_after_seconds',d.hybrid_fallback_after_seconds
  );
end;
$function$;
revoke all on function public.activate_connected_hybrid_fallback(text) from public;
grant execute on function public.activate_connected_hybrid_fallback(text) to anon,authenticated,service_role;

create or replace function public.get_connected_device_runtime_config(p_device_key text)
returns jsonb language plpgsql stable security definer set search_path='public','extensions' as $function$
declare k public.connected_device_keys%rowtype; d public.connected_devices%rowtype; v_hash text;
begin
  if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys
   where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now())
   order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;
  return jsonb_build_object(
    'device_id',d.id,
    'car_id',d.car_id,
    'name',d.name,
    'source_type',d.source_type,
    'acquisition_mode',d.acquisition_mode,
    'session_authority',d.session_authority,
    'hybrid_fallback_enabled',d.hybrid_fallback_enabled,
    'hybrid_fallback_after_seconds',d.hybrid_fallback_after_seconds,
    'hybrid_fallback_activated_at',d.hybrid_fallback_activated_at,
    'default_driver_id',d.default_driver_id,
    'capabilities',coalesce(d.capabilities,'{}'::jsonb)
  );
end;
$function$;
revoke all on function public.get_connected_device_runtime_config(text) from public;
grant execute on function public.get_connected_device_runtime_config(text) to anon,authenticated,service_role;

-- Any fresh external logger live-state packet immediately restores logger authority.
create or replace function public.restore_hybrid_logger_authority_on_live_state()
returns trigger language plpgsql security definer set search_path='public' as $function$
begin
  update public.connected_devices
     set session_authority='external_logger',hybrid_fallback_activated_at=null
   where id=new.device_id and acquisition_mode='hybrid' and session_authority='smartphone';
  return new;
end;
$function$;
drop trigger if exists trg_restore_hybrid_logger_authority on public.connected_device_live_state;
create trigger trg_restore_hybrid_logger_authority
  after insert or update on public.connected_device_live_state
  for each row execute function public.restore_hybrid_logger_authority_on_live_state();

-- Tag smartphone stream sessions as fallback while hybrid authority is temporarily smartphone,
-- and reject overlaps between logger official sessions and fallback sessions.
create or replace function public.guard_hybrid_session_overlap()
returns trigger language plpgsql set search_path='public' as $function$
declare d public.connected_devices%rowtype;
begin
  select * into d from public.connected_devices where id=new.device_id;
  if d.acquisition_mode<>'hybrid' then return new; end if;

  if new.source='stream_segmenter' and d.session_authority='smartphone' and d.hybrid_fallback_activated_at is not null then
    new.source:='smartphone_fallback';
    new.metadata:=coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
      'hybrid_fallback',true,
      'fallback_activated_at',d.hybrid_fallback_activated_at,
      'primary_authority','external_logger'
    );
  end if;

  if new.source in ('external_logger','smartphone_fallback') and exists(
    select 1 from public.connected_sessions s
     where s.device_id=new.device_id
       and s.id is distinct from new.id
       and s.source in ('external_logger','smartphone_fallback')
       and s.source<>new.source
       and s.started_at < coalesce(new.ended_at,new.started_at+interval '48 hours')
       and coalesce(s.ended_at,s.started_at+interval '48 hours') > new.started_at
  ) then
    raise exception 'Conflitto sessione ibrida: dati logger e fallback smartphone sovrapposti. Nessuna ora duplicata applicata.';
  end if;

  return new;
end;
$function$;
drop trigger if exists trg_guard_hybrid_session_overlap on public.connected_sessions;
create trigger trg_guard_hybrid_session_overlap
  before insert or update of started_at,ended_at,source on public.connected_sessions
  for each row execute function public.guard_hybrid_session_overlap();
