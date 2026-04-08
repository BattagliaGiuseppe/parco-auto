-- =========================================
-- PARCO AUTO · PAGE PERMISSIONS PATCH
-- Applica i permessi reali ai moduli principali
-- Da eseguire DOPO team_access_patch.sql
-- =========================================

insert into public.app_permissions (code, label, description)
values
  ('maintenances.view', 'Visualizza manutenzioni', 'Accesso al modulo manutenzioni'),
  ('maintenances.edit', 'Modifica manutenzioni', 'Creazione e modifica manutenzioni'),
  ('mounts.view', 'Visualizza montaggi', 'Accesso al modulo montaggi'),
  ('mounts.edit', 'Modifica montaggi', 'Creazione montaggi e smontaggi'),
  ('drivers.view', 'Visualizza piloti', 'Accesso al modulo piloti'),
  ('drivers.edit', 'Modifica piloti', 'Creazione e aggiornamento documentale piloti'),
  ('inventory.view', 'Visualizza magazzino', 'Accesso al modulo magazzino'),
  ('inventory.edit', 'Modifica magazzino', 'Inserimento e import articoli di magazzino'),
  ('telemetry.view', 'Visualizza telemetria', 'Accesso all’archivio telemetria'),
  ('telemetry.edit', 'Modifica telemetria', 'Registrazione file telemetria'),
  ('team.manage', 'Gestisci team e accessi', 'Accesso a Team & Accessi')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.role_permissions (role, permission_code)
values
  -- owner
  ('owner', 'maintenances.view'),
  ('owner', 'maintenances.edit'),
  ('owner', 'mounts.view'),
  ('owner', 'mounts.edit'),
  ('owner', 'drivers.view'),
  ('owner', 'drivers.edit'),
  ('owner', 'inventory.view'),
  ('owner', 'inventory.edit'),
  ('owner', 'telemetry.view'),
  ('owner', 'telemetry.edit'),
  ('owner', 'team.manage'),

  -- admin
  ('admin', 'maintenances.view'),
  ('admin', 'maintenances.edit'),
  ('admin', 'mounts.view'),
  ('admin', 'mounts.edit'),
  ('admin', 'drivers.view'),
  ('admin', 'drivers.edit'),
  ('admin', 'inventory.view'),
  ('admin', 'inventory.edit'),
  ('admin', 'telemetry.view'),
  ('admin', 'telemetry.edit'),
  ('admin', 'team.manage'),

  -- engineer
  ('engineer', 'maintenances.view'),
  ('engineer', 'mounts.view'),
  ('engineer', 'drivers.view'),
  ('engineer', 'inventory.view'),
  ('engineer', 'telemetry.view'),
  ('engineer', 'telemetry.edit'),

  -- mechanic
  ('mechanic', 'maintenances.view'),
  ('mechanic', 'maintenances.edit'),
  ('mechanic', 'mounts.view'),
  ('mechanic', 'mounts.edit'),
  ('mechanic', 'drivers.view'),
  ('mechanic', 'inventory.view'),
  ('mechanic', 'inventory.edit'),
  ('mechanic', 'telemetry.view'),

  -- viewer
  ('viewer', 'maintenances.view'),
  ('viewer', 'mounts.view'),
  ('viewer', 'drivers.view'),
  ('viewer', 'inventory.view'),
  ('viewer', 'telemetry.view')
on conflict do nothing;
