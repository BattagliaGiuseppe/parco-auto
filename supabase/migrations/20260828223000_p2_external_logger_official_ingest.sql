-- P2.8.2 - External Logger Official Ingest
-- Hardens the official external-logger channel while keeping live display separate.

create or replace function public.ingest_connected_session(
  p_device_key text,
  p_external_batch_id text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  v_hash text;
  v_payload jsonb;
  v_laps jsonb;
  v_lap jsonb;
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_lap_number integer;
  v_lap_time numeric;
  v_best_lap numeric;
  v_max_lap_speed numeric;
  v_engine_seconds numeric;
  v_track_seconds numeric;
  v_laps_count integer;
  v_seen_laps integer[] := array[]::integer[];
  v_result jsonb;
begin
  if coalesce(char_length(p_device_key),0) < 20 then
    raise exception 'Chiave dispositivo non valida';
  end if;
  if coalesce(trim(p_external_batch_id),'') = '' or char_length(p_external_batch_id) > 200 then
    raise exception 'external_batch_id non valido';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload ufficiale non valido';
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
  where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;

  if d.session_authority <> 'external_logger' then
    raise exception 'Ingest logger esterno rifiutato: autorità sessione = %',d.session_authority;
  end if;
  if d.acquisition_mode not in ('external_logger','hybrid') then
    raise exception 'Ingest logger esterno non consentito in modalità %',d.acquisition_mode;
  end if;

  begin
    v_started_at := nullif(p_payload->>'started_at','')::timestamptz;
    v_ended_at := nullif(p_payload->>'ended_at','')::timestamptz;
  exception when others then
    raise exception 'started_at/ended_at non validi';
  end;
  if v_started_at is null then raise exception 'started_at obbligatorio'; end if;
  if v_ended_at is null then raise exception 'ended_at obbligatorio per una sessione ufficiale'; end if;
  if v_ended_at < v_started_at or v_ended_at > v_started_at + interval '48 hours' then
    raise exception 'Durata sessione non valida';
  end if;
  if v_started_at > now() + interval '5 minutes' or v_ended_at > now() + interval '5 minutes' then
    raise exception 'Timestamp sessione nel futuro non valido';
  end if;

  v_laps := coalesce(p_payload->'laps','[]'::jsonb);
  if jsonb_typeof(v_laps) <> 'array' then raise exception 'laps deve essere un array'; end if;
  if jsonb_array_length(v_laps) > 500 then raise exception 'Troppi giri nel payload'; end if;

  for v_lap in select value from jsonb_array_elements(v_laps) loop
    begin
      v_lap_number := nullif(v_lap->>'lap_number','')::integer;
      v_lap_time := nullif(v_lap->>'lap_time_seconds','')::numeric;
    exception when others then
      raise exception 'Dati giro non validi';
    end;
    if v_lap_number is null or v_lap_number <= 0 then raise exception 'lap_number non valido'; end if;
    if v_lap_number = any(v_seen_laps) then raise exception 'lap_number duplicato: %',v_lap_number; end if;
    v_seen_laps := array_append(v_seen_laps,v_lap_number);
    if v_lap_time is not null and (v_lap_time <= 0 or v_lap_time > 3600) then
      raise exception 'lap_time_seconds non valido al giro %',v_lap_number;
    end if;
    if v_lap_time is not null then
      v_best_lap := case when v_best_lap is null then v_lap_time else least(v_best_lap,v_lap_time) end;
    end if;
    begin
      if nullif(v_lap->>'max_speed','') is not null then
        if (v_lap->>'max_speed')::numeric < 0 or (v_lap->>'max_speed')::numeric > 600 then
          raise exception 'max_speed non valida al giro %',v_lap_number;
        end if;
        v_max_lap_speed := greatest(coalesce(v_max_lap_speed,0),(v_lap->>'max_speed')::numeric);
      end if;
    exception when invalid_text_representation then
      raise exception 'max_speed non valida al giro %',v_lap_number;
    end;
  end loop;

  begin
    v_engine_seconds := greatest(coalesce(nullif(p_payload->>'engine_seconds','')::numeric,0),0);
    v_track_seconds := greatest(coalesce(nullif(p_payload->>'track_seconds','')::numeric,0),0);
    v_laps_count := coalesce(nullif(p_payload->>'laps_count','')::integer,jsonb_array_length(v_laps));
  exception when others then
    raise exception 'Riepilogo durata/giri non valido';
  end;

  if v_engine_seconds > 172800 or v_track_seconds > 172800 then
    raise exception 'Durata sessione oltre il limite di 48 ore';
  end if;
  if v_laps_count < 0 or v_laps_count > 500 then raise exception 'laps_count non valido'; end if;
  if v_laps_count < jsonb_array_length(v_laps) then
    raise exception 'laps_count inferiore ai giri dettagliati ricevuti';
  end if;
  if v_engine_seconds = 0 and v_track_seconds = 0 and v_laps_count = 0 then
    raise exception 'Sessione ufficiale priva di attività';
  end if;

  if nullif(p_payload->>'best_lap_seconds','') is not null then
    begin
      if (p_payload->>'best_lap_seconds')::numeric <= 0 or (p_payload->>'best_lap_seconds')::numeric > 3600 then
        raise exception 'best_lap_seconds non valido';
      end if;
    exception when invalid_text_representation then
      raise exception 'best_lap_seconds non valido';
    end;
  end if;
  if nullif(p_payload->>'max_speed','') is not null then
    begin
      if (p_payload->>'max_speed')::numeric < 0 or (p_payload->>'max_speed')::numeric > 600 then
        raise exception 'max_speed non valida';
      end if;
    exception when invalid_text_representation then
      raise exception 'max_speed non valida';
    end;
  end if;
  if nullif(p_payload->>'max_rpm','') is not null then
    begin
      if (p_payload->>'max_rpm')::numeric < 0 or (p_payload->>'max_rpm')::numeric > 30000 then
        raise exception 'max_rpm non valido';
      end if;
    exception when invalid_text_representation then
      raise exception 'max_rpm non valido';
    end;
  end if;

  v_payload := p_payload || jsonb_build_object(
    'source','external_logger',
    'ingest_contract_version','p2.8.2'
  );

  if nullif(v_payload->>'best_lap_seconds','') is null and v_best_lap is not null then
    v_payload := v_payload || jsonb_build_object('best_lap_seconds',v_best_lap);
  end if;
  if nullif(v_payload->>'max_speed','') is null and v_max_lap_speed is not null then
    v_payload := v_payload || jsonb_build_object('max_speed',v_max_lap_speed);
  end if;

  v_payload := jsonb_set(
    v_payload,
    '{metadata}',
    coalesce(v_payload->'metadata','{}'::jsonb) || jsonb_build_object(
      'official_ingest',true,
      'session_authority','external_logger',
      'ingest_contract_version','p2.8.2'
    ),
    true
  );
  v_payload := jsonb_set(
    v_payload,
    '{batch_metadata}',
    coalesce(v_payload->'batch_metadata','{}'::jsonb) || jsonb_build_object(
      'channel','official_session',
      'session_authority','external_logger',
      'ingest_contract_version','p2.8.2'
    ),
    true
  );

  v_result := public.ingest_connected_session_core(p_device_key,p_external_batch_id,v_payload);
  return v_result || jsonb_build_object(
    'channel','official_session',
    'session_authority','external_logger',
    'ingest_contract_version','p2.8.2'
  );
end;
$function$;

revoke all on function public.ingest_connected_session(text,text,jsonb) from public;
grant execute on function public.ingest_connected_session(text,text,jsonb) to anon,authenticated,service_role;

comment on function public.ingest_connected_session(text,text,jsonb) is
'P2.8.2 official finalized-session ingest for external_logger/hybrid devices. Separate from connected live-state display channel.';
