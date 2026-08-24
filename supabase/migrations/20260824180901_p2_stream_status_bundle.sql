create or replace function public.connected_stream_status(p_team_id uuid) returns jsonb language sql stable security definer set search_path='public' as $$
  select case when public.has_team_permission(p_team_id,'devices.view') then jsonb_build_object(
    'stats',jsonb_build_object(
      'windows_30d',(select count(*) from public.connected_stream_windows w where w.team_id=p_team_id and w.created_at>=now()-interval '30 days'),
      'segments_30d',(select count(*) from public.connected_stream_segments s where s.team_id=p_team_id and s.created_at>=now()-interval '30 days')
    ),
    'recent_windows',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from (
      select w.id,w.external_window_id,w.started_at,w.ended_at,w.samples_count,w.segments_count,w.status,w.error_message,d.name device_name,c.name car_name,
             (select count(*) from public.connected_stream_segments s where s.stream_window_id=w.id and s.activity_type='track') track_segments,
             (select count(*) from public.connected_stream_segments s where s.stream_window_id=w.id and s.activity_type='engine_only') engine_only_segments
      from public.connected_stream_windows w
      join public.connected_devices d on d.id=w.device_id
      join public.cars c on c.id=d.car_id
      where w.team_id=p_team_id order by w.started_at desc limit 10
    ) x),'[]'::jsonb)
  ) else (select jsonb_build_object('error','Permesso devices.view richiesto')) end;
$$;
revoke all on function public.connected_stream_status(uuid) from public;
grant execute on function public.connected_stream_status(uuid) to authenticated;
