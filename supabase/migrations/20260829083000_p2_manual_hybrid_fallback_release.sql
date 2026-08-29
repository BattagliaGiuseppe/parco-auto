create or replace function public.release_connected_hybrid_fallback(p_device_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  v_hash text;
begin
  if coalesce(char_length(p_device_key),0) < 20 then
    raise exception 'Chiave dispositivo non valida';
  end if;

  v_hash := encode(digest(p_device_key,'sha256'),'hex');
  select * into k
  from public.connected_device_keys
  where key_hash=v_hash
    and revoked_at is null
    and (expires_at is null or expires_at>now())
  order by created_at desc
  limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;

  select * into d
  from public.connected_devices
  where id=k.device_id and team_id=k.team_id and status='active'
  for update;
  if not found then raise exception 'Dispositivo non attivo'; end if;
  if d.acquisition_mode <> 'hybrid' then
    raise exception 'Rilascio fallback disponibile solo in modalità ibrida';
  end if;

  update public.connected_devices
     set session_authority='external_logger',
         hybrid_fallback_activated_at=null
   where id=d.id
   returning * into d;

  update public.connected_device_keys set last_used_at=now() where id=k.id;

  return jsonb_build_object(
    'ok',true,
    'device_id',d.id,
    'session_authority',d.session_authority,
    'hybrid_fallback_activated_at',d.hybrid_fallback_activated_at,
    'released',true
  );
end;
$function$;

revoke all on function public.release_connected_hybrid_fallback(text) from public;
grant execute on function public.release_connected_hybrid_fallback(text) to anon, authenticated, service_role;
comment on function public.release_connected_hybrid_fallback(text) is 'P2.8.6 manually releases smartphone hybrid fallback and restores external logger authority without creating sessions or hours.';
