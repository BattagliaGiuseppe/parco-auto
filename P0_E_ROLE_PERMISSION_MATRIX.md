# P0-E — Ruoli e permessi effettivi

## Stato live verificato

- Owner: 31 permessi
- Admin: 31 permessi
- Engineer: 21 permessi
- Mechanic: 19 permessi
- Viewer: 14 permessi
- Override utente presenti al momento dell'audit: 0

## Regola di risoluzione

1. membership attiva nel team richiesto;
2. Owner: sempre autorizzato per codici presenti in `app_permissions`;
3. eventuale override in `team_user_permissions`;
4. fallback sui permessi di ruolo in `role_permissions`.

## Enforcement P0-E.2A

La prima fase protegge le SCRITTURE. Le SELECT rimangono temporaneamente membership-based per evitare regressioni nelle pagine che leggono tabelle correlate.

| Tabelle | Permesso write |
|---|---|
| cars | cars.edit |
| components, component_revisions | components.edit |
| car_components | mounts.edit |
| maintenances | maintenances.edit |
| inventory_items, inventory_movements | inventory.edit |
| drivers + licenze/documenti/safety/event entries/performance | drivers.edit |
| events, circuits, event_sessions, event_cars, event_car_data, turns/metrics/drivers | events.edit |
| telemetry_files/channels/laps/samples/insights | telemetry.edit |

RPC hardenizzati: inventory movement, maintenance+revision, mount/unmount, save/delete turn, telemetry parse save, settings bundle, team invite.

## Verifica Engineer live (transazione con rollback)

- cars update: BLOCCATO
- events update: CONSENTITO
- components update: CONSENTITO
- inventory update: BLOCCATO
- drivers update: BLOCCATO

Questo coincide con `role_permissions`.

## Da fare nella fase successiva

1. enforcement dei permessi `.view` sulle SELECT, dopo audit delle dipendenze tra moduli;
2. attendance: policy dedicate a `attendance.view/manage/clock_self/kiosk/export`;
3. tasks: `tasks.view/edit/assign/delete`;
4. settings/team: sostituire progressivamente `is_team_manager()` con `settings.manage` / `team.manage` dove appropriato;
5. storage: permessi read/write per bucket/area;
6. allineare definitivamente `event_console.*` oppure rimuoverlo se ridondante rispetto a `events.*`;
7. frontend: impedire override che possano togliere permessi all'Owner, per coerenza con il resolver DB.
