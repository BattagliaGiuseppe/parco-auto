select
  has_function_privilege('authenticated', 'public.telemetry_archive_page(uuid,text,integer,integer)', 'EXECUTE') as archive_auth,
  has_function_privilege('anon', 'public.telemetry_archive_page(uuid,text,integer,integer)', 'EXECUTE') as archive_anon,
  has_function_privilege('authenticated', 'public.telemetry_analysis_bundle(uuid,uuid)', 'EXECUTE') as analysis_auth,
  has_function_privilege('anon', 'public.telemetry_analysis_bundle(uuid,uuid)', 'EXECUTE') as analysis_anon,
  has_function_privilege('authenticated', 'public.telemetry_comparison_candidates(uuid,uuid,integer)', 'EXECUTE') as compare_auth,
  has_function_privilege('anon', 'public.telemetry_comparison_candidates(uuid,uuid,integer)', 'EXECUTE') as compare_anon;
