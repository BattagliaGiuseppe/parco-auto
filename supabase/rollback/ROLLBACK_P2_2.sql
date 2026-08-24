-- Emergency rollback for P2.2 schema/function additions. Review before use on a database containing reconciled sessions.
drop function if exists public.reconcile_connected_session_for_team(uuid,uuid);
drop function if exists public.reconcile_connected_session(uuid,boolean);
drop index if exists public.event_car_turns_connected_session_uidx;
drop index if exists public.event_sessions_connected_session_uidx;
drop index if exists public.connected_sessions_reconciliation_idx;
alter table public.event_car_turns drop column if exists connected_session_id, drop column if exists hours_source;
alter table public.event_sessions drop column if exists connected_session_id, drop column if exists source;
alter table public.connected_sessions drop column if exists reconciliation_status, drop column if exists reconciled_at, drop column if exists reconciliation_message;
-- Restore ingest_connected_session / connected_devices_page / turn trigger from the prior P2.1 migration before using this rollback in production.
