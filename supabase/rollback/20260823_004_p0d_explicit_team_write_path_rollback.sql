-- Rollback P0-D: restore the exact legacy BEFORE INSERT triggers.
-- Use only if the P0-D migration must be reverted.

CREATE TRIGGER trg_app_settings_team_id BEFORE INSERT ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_car_components_team_id BEFORE INSERT ON public.car_components FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_cars_team_id BEFORE INSERT ON public.cars FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_circuits_team_id BEFORE INSERT ON public.circuits FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_component_revisions_team_id BEFORE INSERT ON public.component_revisions FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_components_team_id BEFORE INSERT ON public.components FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_document_templates_team_id BEFORE INSERT ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_documents_team_id BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_driver_documents_team_id BEFORE INSERT ON public.driver_documents FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_driver_event_entries_team_id BEFORE INSERT ON public.driver_event_entries FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_driver_licenses_team_id BEFORE INSERT ON public.driver_licenses FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_driver_session_performance_team_id BEFORE INSERT ON public.driver_session_performance FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_drivers_team_id BEFORE INSERT ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_event_car_data_team_id BEFORE INSERT ON public.event_car_data FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_event_car_drivers_team_id BEFORE INSERT ON public.event_car_drivers FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_event_car_turn_metrics_team_id BEFORE INSERT ON public.event_car_turn_metrics FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_event_car_turns_team_id BEFORE INSERT ON public.event_car_turns FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_event_cars_team_id BEFORE INSERT ON public.event_cars FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_event_sessions_team_id BEFORE INSERT ON public.event_sessions FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_events_team_id BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_inventory_items_team_id BEFORE INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_maintenances_team_id BEFORE INSERT ON public.maintenances FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_team_checklist_items_team_id BEFORE INSERT ON public.team_checklist_items FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_team_checklists_team_id BEFORE INSERT ON public.team_checklists FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_team_component_definitions_team_id BEFORE INSERT ON public.team_component_definitions FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_team_dashboard_widgets_team_id BEFORE INSERT ON public.team_dashboard_widgets FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_team_setup_fields_team_id BEFORE INSERT ON public.team_setup_fields FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();
CREATE TRIGGER trg_telemetry_files_team_id BEFORE INSERT ON public.telemetry_files FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_auth();

-- Restore the pre-P0-D authenticated helper grant established by P0-C.
GRANT EXECUTE ON FUNCTION public.current_team_id() TO authenticated;
