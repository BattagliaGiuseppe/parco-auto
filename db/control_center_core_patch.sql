-- =========================================================
-- CONTROL CENTER CORE PATCH
-- Trasforma Impostazioni in fonte centrale di configurazione:
-- - estende labels e modules con tutti i moduli moderni;
-- - aggiunge opzioni configurabili anche agli item checklist;
-- - aggiorna il salvataggio transazionale per persistere le opzioni checklist.
-- =========================================================

alter table public.team_checklist_items
  add column if not exists options jsonb not null default '[]'::jsonb;

update public.app_settings
set labels = coalesce(labels, '{}'::jsonb) || jsonb_build_object(
  'vehicle', coalesce(labels->>'vehicle', 'Auto'),
  'driver', coalesce(labels->>'driver', 'Pilota'),
  'event', coalesce(labels->>'event', 'Evento'),
  'turn', coalesce(labels->>'turn', 'Turno'),
  'component', coalesce(labels->>'component', 'Componente'),
  'maintenance', coalesce(labels->>'maintenance', 'Manutenzione'),
  'inventory', coalesce(labels->>'inventory', 'Magazzino'),
  'mounts', coalesce(labels->>'mounts', 'Montaggi'),
  'telemetry', coalesce(labels->>'telemetry', 'Telemetria'),
  'tasks', coalesce(labels->>'tasks', 'Attività'),
  'attendance', coalesce(labels->>'attendance', 'Presenze'),
  'settings', coalesce(labels->>'settings', 'Impostazioni'),
  'team_access', coalesce(labels->>'team_access', 'Team & Accessi'),
  'documents', coalesce(labels->>'documents', 'Documenti')
),
modules = coalesce(modules, '{}'::jsonb) || jsonb_build_object(
  'cars', coalesce((modules->>'cars')::boolean, true),
  'components', coalesce((modules->>'components')::boolean, true),
  'mounts', coalesce((modules->>'mounts')::boolean, true),
  'maintenances', coalesce((modules->>'maintenances')::boolean, enable_maintenances, true),
  'events', coalesce((modules->>'events')::boolean, enable_events, true),
  'drivers', coalesce((modules->>'drivers')::boolean, true),
  'inventory', coalesce((modules->>'inventory')::boolean, true),
  'telemetry', coalesce((modules->>'telemetry')::boolean, true),
  'documents', coalesce((modules->>'documents')::boolean, true),
  'tasks', coalesce((modules->>'tasks')::boolean, true),
  'attendance', coalesce((modules->>'attendance')::boolean, true)
),
updated_at = now();

-- Salvataggio transazionale dell'intero Control Center.
create or replace function public.save_team_settings_bundle(
  p_team_id uuid,
  p_settings jsonb,
  p_component_definitions jsonb default '[]'::jsonb,
  p_checklists jsonb default '[]'::jsonb,
  p_setup_fields jsonb default '[]'::jsonb,
  p_dashboard_widgets jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group jsonb;
  v_item jsonb;
  v_field jsonb;
  v_widget jsonb;
  v_definition jsonb;
  v_checklist_id uuid;
begin
  if not public.is_team_manager(p_team_id) then
    raise exception 'Solo owner/admin possono salvare le impostazioni del team';
  end if;

  insert into public.app_settings (
    team_id,
    team_name,
    team_subtitle,
    primary_color,
    secondary_color,
    accent_color,
    vehicle_type,
    default_warning_hours,
    default_revision_hours,
    default_expiry_alert_days,
    modules,
    dashboard_layout,
    labels,
    updated_at
  ) values (
    p_team_id,
    coalesce(nullif(p_settings->>'team_name', ''), 'Team'),
    nullif(p_settings->>'team_subtitle', ''),
    coalesce(nullif(p_settings->>'primary_color', ''), '#171717'),
    coalesce(nullif(p_settings->>'secondary_color', ''), '#262626'),
    coalesce(nullif(p_settings->>'accent_color', ''), '#facc15'),
    coalesce(nullif(p_settings->>'vehicle_type', ''), 'auto'),
    coalesce((p_settings->>'default_warning_hours')::integer, 0),
    coalesce((p_settings->>'default_revision_hours')::integer, 0),
    coalesce((p_settings->>'default_expiry_alert_days')::integer, 30),
    coalesce(p_settings->'modules', '{}'::jsonb),
    coalesce(p_settings->'dashboard_layout', '{}'::jsonb),
    coalesce(p_settings->'labels', '{}'::jsonb),
    now()
  )
  on conflict (team_id) do update set
    team_name = excluded.team_name,
    team_subtitle = excluded.team_subtitle,
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    accent_color = excluded.accent_color,
    vehicle_type = excluded.vehicle_type,
    default_warning_hours = excluded.default_warning_hours,
    default_revision_hours = excluded.default_revision_hours,
    default_expiry_alert_days = excluded.default_expiry_alert_days,
    modules = excluded.modules,
    dashboard_layout = excluded.dashboard_layout,
    labels = excluded.labels,
    updated_at = now();

  delete from public.team_component_definitions where team_id = p_team_id;
  for v_definition in select value from jsonb_array_elements(coalesce(p_component_definitions, '[]'::jsonb)) loop
    if coalesce(v_definition->>'code', '') <> '' and coalesce(v_definition->>'label', '') <> '' then
      insert into public.team_component_definitions (
        team_id, code, label, category, is_required, tracks_hours, has_expiry, default_expiry_years, order_index
      ) values (
        p_team_id,
        v_definition->>'code',
        v_definition->>'label',
        coalesce(nullif(v_definition->>'category', ''), 'base'),
        coalesce((v_definition->>'is_required')::boolean, true),
        coalesce((v_definition->>'tracks_hours')::boolean, false),
        coalesce((v_definition->>'has_expiry')::boolean, false),
        nullif(v_definition->>'default_expiry_years', '')::integer,
        coalesce((v_definition->>'order_index')::integer, 1)
      );
    end if;
  end loop;

  delete from public.team_checklist_items where team_id = p_team_id;
  delete from public.team_checklists where team_id = p_team_id;
  for v_group in select value from jsonb_array_elements(coalesce(p_checklists, '[]'::jsonb)) loop
    if coalesce(v_group->>'name', '') <> '' then
      insert into public.team_checklists (team_id, name, order_index)
      values (
        p_team_id,
        v_group->>'name',
        coalesce((v_group->>'order_index')::integer, 1)
      )
      returning id into v_checklist_id;

      for v_item in select value from jsonb_array_elements(coalesce(v_group->'items', '[]'::jsonb)) loop
        if coalesce(v_item->>'label', '') <> '' then
          insert into public.team_checklist_items (
            team_id, checklist_id, label, input_type, options, is_required, order_index
          ) values (
            p_team_id,
            v_checklist_id,
            v_item->>'label',
            coalesce(nullif(v_item->>'input_type', ''), 'status'),
            coalesce(v_item->'options', '[]'::jsonb),
            coalesce((v_item->>'is_required')::boolean, true),
            coalesce((v_item->>'order_index')::integer, 1)
          );
        end if;
      end loop;
    end if;
  end loop;

  delete from public.team_setup_fields where team_id = p_team_id;
  for v_field in select value from jsonb_array_elements(coalesce(p_setup_fields, '[]'::jsonb)) loop
    if coalesce(v_field->>'field_key', '') <> '' and coalesce(v_field->>'label', '') <> '' then
      insert into public.team_setup_fields (
        team_id, field_key, label, group_name, field_type, unit, options, position, order_index, is_required
      ) values (
        p_team_id,
        v_field->>'field_key',
        v_field->>'label',
        coalesce(nullif(v_field->>'group_name', ''), 'Generale'),
        coalesce(nullif(v_field->>'field_type', ''), 'text'),
        nullif(v_field->>'unit', ''),
        coalesce(v_field->'options', '[]'::jsonb),
        coalesce(nullif(v_field->>'position', ''), 'left'),
        coalesce((v_field->>'order_index')::integer, 1),
        coalesce((v_field->>'is_required')::boolean, false)
      );
    end if;
  end loop;

  delete from public.team_dashboard_widgets where team_id = p_team_id;
  for v_widget in select value from jsonb_array_elements(coalesce(p_dashboard_widgets, '[]'::jsonb)) loop
    if coalesce(v_widget->>'widget_code', '') <> '' then
      insert into public.team_dashboard_widgets (
        team_id, role_scope, widget_code, label, is_enabled, size, order_index, config
      ) values (
        p_team_id,
        coalesce(nullif(v_widget->>'role_scope', ''), 'all'),
        v_widget->>'widget_code',
        coalesce(nullif(v_widget->>'label', ''), v_widget->>'widget_code'),
        coalesce((v_widget->>'is_enabled')::boolean, true),
        coalesce(nullif(v_widget->>'size', ''), 'md'),
        coalesce((v_widget->>'order_index')::integer, 1),
        coalesce(v_widget->'config', '{}'::jsonb)
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.save_team_settings_bundle(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
