-- =========================================
-- PARCO AUTO · PATCH 9A
-- Settings hardening & salvataggio atomico
-- =========================================

-- Colonne usate dal Control Center moderno.
alter table public.app_settings
  add column if not exists labels jsonb not null default '{"vehicle": "Auto", "driver": "Pilota", "event": "Evento", "turn": "Turno", "component": "Componente", "maintenance": "Manutenzione", "inventory": "Magazzino"}'::jsonb,
  add column if not exists dashboard_layout jsonb not null default '{}'::jsonb,
  add column if not exists modules jsonb not null default '{"drivers": true, "performance": true, "inventory": true, "telemetry": true, "documents": true, "mounts": true, "tasks": true, "attendance": true}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.team_setup_fields
  add column if not exists options jsonb not null default '[]'::jsonb;

-- RLS: tutti i membri possono leggere le configurazioni del team,
-- ma solo owner/admin possono modificare il Control Center.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_settings',
        'team_component_definitions',
        'team_checklists',
        'team_checklist_items',
        'team_setup_fields',
        'team_dashboard_widgets'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;
end $$;

create policy app_settings_select_team
on public.app_settings
for select
using (public.is_team_member(team_id));

create policy app_settings_insert_manager
on public.app_settings
for insert
with check (public.is_team_manager(team_id));

create policy app_settings_update_manager
on public.app_settings
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy app_settings_delete_manager
on public.app_settings
for delete
using (public.is_team_manager(team_id));

create policy team_component_definitions_select_team
on public.team_component_definitions
for select
using (public.is_team_member(team_id));

create policy team_component_definitions_insert_manager
on public.team_component_definitions
for insert
with check (public.is_team_manager(team_id));

create policy team_component_definitions_update_manager
on public.team_component_definitions
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy team_component_definitions_delete_manager
on public.team_component_definitions
for delete
using (public.is_team_manager(team_id));

create policy team_checklists_select_team
on public.team_checklists
for select
using (public.is_team_member(team_id));

create policy team_checklists_insert_manager
on public.team_checklists
for insert
with check (public.is_team_manager(team_id));

create policy team_checklists_update_manager
on public.team_checklists
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy team_checklists_delete_manager
on public.team_checklists
for delete
using (public.is_team_manager(team_id));

create policy team_checklist_items_select_team
on public.team_checklist_items
for select
using (public.is_team_member(team_id));

create policy team_checklist_items_insert_manager
on public.team_checklist_items
for insert
with check (public.is_team_manager(team_id));

create policy team_checklist_items_update_manager
on public.team_checklist_items
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy team_checklist_items_delete_manager
on public.team_checklist_items
for delete
using (public.is_team_manager(team_id));

create policy team_setup_fields_select_team
on public.team_setup_fields
for select
using (public.is_team_member(team_id));

create policy team_setup_fields_insert_manager
on public.team_setup_fields
for insert
with check (public.is_team_manager(team_id));

create policy team_setup_fields_update_manager
on public.team_setup_fields
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy team_setup_fields_delete_manager
on public.team_setup_fields
for delete
using (public.is_team_manager(team_id));

create policy team_dashboard_widgets_select_team
on public.team_dashboard_widgets
for select
using (public.is_team_member(team_id));

create policy team_dashboard_widgets_insert_manager
on public.team_dashboard_widgets
for insert
with check (public.is_team_manager(team_id));

create policy team_dashboard_widgets_update_manager
on public.team_dashboard_widgets
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy team_dashboard_widgets_delete_manager
on public.team_dashboard_widgets
for delete
using (public.is_team_manager(team_id));

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
            team_id, checklist_id, label, input_type, is_required, order_index
          ) values (
            p_team_id,
            v_checklist_id,
            v_item->>'label',
            coalesce(nullif(v_item->>'input_type', ''), 'status'),
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
