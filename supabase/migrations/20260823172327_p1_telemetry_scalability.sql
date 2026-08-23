-- P1 Telemetry Scalability
-- Additive RPC layer for paginated archive + single-call analysis bundles.

create or replace function public.telemetry_archive_page(
  p_team_id uuid,
  p_search text default '',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset integer;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if not public.has_team_permission(p_team_id, 'telemetry.view') then
    raise exception 'Utente non autorizzato per il team %', p_team_id;
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with filtered as materialized (
    select tf.*
    from public.telemetry_files tf
    left join public.cars c
      on c.id = tf.car_id and c.team_id = tf.team_id
    left join public.drivers d
      on d.id = tf.driver_id and d.team_id = tf.team_id
    left join public.events e
      on e.id = tf.event_id and e.team_id = tf.team_id
    left join public.event_sessions s
      on s.id = tf.session_id and s.team_id = tf.team_id
    where tf.team_id = p_team_id
      and (
        v_search is null
        or coalesce(tf.file_name, '') ilike '%' || v_search || '%'
        or coalesce(tf.notes, '') ilike '%' || v_search || '%'
        or coalesce(tf.source_software, '') ilike '%' || v_search || '%'
        or coalesce(tf.file_category, '') ilike '%' || v_search || '%'
        or coalesce(tf.data_format, '') ilike '%' || v_search || '%'
        or coalesce(tf.logger_model, '') ilike '%' || v_search || '%'
        or coalesce(tf.track_name, '') ilike '%' || v_search || '%'
        or exists (
          select 1
          from unnest(coalesce(tf.tags, array[]::text[])) tag
          where tag ilike '%' || v_search || '%'
        )
        or coalesce(c.name, '') ilike '%' || v_search || '%'
        or coalesce(d.first_name, '') ilike '%' || v_search || '%'
        or coalesce(d.last_name, '') ilike '%' || v_search || '%'
        or coalesce(d.nickname, '') ilike '%' || v_search || '%'
        or coalesce(e.name, '') ilike '%' || v_search || '%'
        or coalesce(s.name, '') ilike '%' || v_search || '%'
      )
  ),
  page_rows as (
    select f.*
    from filtered f
    order by f.created_at desc, f.id desc
    limit v_page_size
    offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc) from page_rows p),
      '[]'::jsonb
    ),
    'total_count', (select count(*) from filtered),
    'page', v_page,
    'page_size', v_page_size,
    'stats', jsonb_build_object(
      'files_count', (
        select count(*) from public.telemetry_files tf where tf.team_id = p_team_id
      ),
      'linked_turns_count', (
        select count(distinct tf.event_car_turn_id)
        from public.telemetry_files tf
        where tf.team_id = p_team_id and tf.event_car_turn_id is not null
      ),
      'pending_parse_count', (
        select count(*)
        from public.telemetry_files tf
        where tf.team_id = p_team_id and tf.import_status = 'pending_parse'
      ),
      'insights_count', (
        select count(*) from public.telemetry_insights ti where ti.team_id = p_team_id
      )
    )
  )
  into v_result;

  return coalesce(v_result, jsonb_build_object(
    'items', '[]'::jsonb,
    'total_count', 0,
    'page', v_page,
    'page_size', v_page_size,
    'stats', jsonb_build_object(
      'files_count', 0,
      'linked_turns_count', 0,
      'pending_parse_count', 0,
      'insights_count', 0
    )
  ));
end;
$$;

create or replace function public.telemetry_analysis_bundle(
  p_team_id uuid,
  p_telemetry_file_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.has_team_permission(p_team_id, 'telemetry.view') then
    raise exception 'Utente non autorizzato per il team %', p_team_id;
  end if;

  if not exists (
    select 1
    from public.telemetry_files tf
    where tf.id = p_telemetry_file_id
      and tf.team_id = p_team_id
  ) then
    raise exception 'File telemetria non trovato o non appartenente al team.';
  end if;

  select jsonb_build_object(
    'samples', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ts.id,
          'telemetry_file_id', ts.telemetry_file_id,
          'sample_index', ts.sample_index,
          'time_seconds', ts.time_seconds,
          'distance_m', ts.distance_m,
          'lap_number', ts.lap_number,
          'values_json', ts.values_json
        ) order by ts.sample_index
      )
      from public.telemetry_samples ts
      where ts.team_id = p_team_id
        and ts.telemetry_file_id = p_telemetry_file_id
    ), '[]'::jsonb),
    'channels', coalesce((
      select jsonb_agg(to_jsonb(tc) order by tc.channel_key)
      from public.telemetry_channels tc
      where tc.team_id = p_team_id
        and tc.telemetry_file_id = p_telemetry_file_id
    ), '[]'::jsonb),
    'laps', coalesce((
      select jsonb_agg(to_jsonb(tl) order by tl.lap_number)
      from public.telemetry_laps tl
      where tl.team_id = p_team_id
        and tl.telemetry_file_id = p_telemetry_file_id
    ), '[]'::jsonb),
    'stored_points_count', (
      select count(*)
      from public.telemetry_samples ts
      where ts.team_id = p_team_id
        and ts.telemetry_file_id = p_telemetry_file_id
    )
  )
  into v_result;

  return coalesce(v_result, jsonb_build_object(
    'samples', '[]'::jsonb,
    'channels', '[]'::jsonb,
    'laps', '[]'::jsonb,
    'stored_points_count', 0
  ));
end;
$$;

create or replace function public.telemetry_comparison_candidates(
  p_team_id uuid,
  p_exclude_file_id uuid default null,
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 250), 1), 500);
  v_result jsonb;
begin
  if not public.has_team_permission(p_team_id, 'telemetry.view') then
    raise exception 'Utente non autorizzato per il team %', p_team_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb)
  into v_result
  from (
    select
      tf.id,
      tf.file_name,
      tf.car_id,
      tf.driver_id,
      tf.event_id,
      tf.session_id,
      tf.event_car_turn_id,
      tf.track_name,
      tf.created_at,
      tf.sampled_points_count,
      tf.samples_count,
      tf.laps_count,
      tf.best_lap_seconds,
      tf.duration_seconds
    from public.telemetry_files tf
    where tf.team_id = p_team_id
      and tf.sampled_points_count > 0
      and (p_exclude_file_id is null or tf.id <> p_exclude_file_id)
    order by tf.created_at desc, tf.id desc
    limit v_limit
  ) x;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function public.telemetry_archive_page(uuid, text, integer, integer) from public, anon;
revoke all on function public.telemetry_analysis_bundle(uuid, uuid) from public, anon;
revoke all on function public.telemetry_comparison_candidates(uuid, uuid, integer) from public, anon;

grant execute on function public.telemetry_archive_page(uuid, text, integer, integer) to authenticated;
grant execute on function public.telemetry_analysis_bundle(uuid, uuid) to authenticated;
grant execute on function public.telemetry_comparison_candidates(uuid, uuid, integer) to authenticated;
