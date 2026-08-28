create or replace function public.get_connected_device_circuits(p_device_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','extensions'
as $function$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  v_hash text;
begin
  if coalesce(char_length(p_device_key),0) < 20 then raise exception 'Chiave dispositivo non valida'; end if;
  v_hash := encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys
    where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now())
    order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices
    where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;

  return jsonb_build_object(
    'device_id', d.id,
    'car_id', d.car_id,
    'circuits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'city', c.city,
        'country', c.country,
        'lap_gate_configured', (c.lap_gate_latitude is not null and c.lap_gate_longitude is not null and c.lap_gate_radius_m is not null),
        'has_reference', exists(
          select 1 from public.connected_reference_laps r
          where r.team_id=d.team_id and r.circuit_id=c.id and r.is_active
            and ((d.default_driver_id is not null and r.driver_id=d.default_driver_id)
              or (d.default_driver_id is null and r.driver_id is null and r.car_id=d.car_id))
        )
      ) order by c.name)
      from public.circuits c where c.team_id=d.team_id
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_connected_device_circuits(text) from public;
grant execute on function public.get_connected_device_circuits(text) to anon, authenticated, service_role;
