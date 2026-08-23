# P0-E.2B — Permission map

| Area | Operazione | Permesso DB |
|---|---|---|
| Tasks | leggere | `tasks.view` |
| Tasks | creare/modificare | `tasks.edit` |
| Tasks | assegnare/riassegnare | `tasks.assign` |
| Tasks | eliminare | `tasks.delete` |
| Presenze | leggere | `attendance.view` |
| Presenze | timbrare per sé | `attendance.clock_self` |
| Presenze | amministrare | `attendance.manage` |
| Presenze | kiosk | `attendance.kiosk` |
| Presenze | export UI | `attendance.export` |
| Impostazioni | modificare configurazione | `settings.manage` |
| Team | membri, inviti, override | `team.manage` |
| Storage Auto | leggere/scrivere | `cars.view` / `cars.edit` |
| Storage Piloti | leggere/scrivere | `drivers.view` / `drivers.edit` |
| Storage Telemetria | leggere/scrivere | `telemetry.view` / `telemetry.edit` |
| Storage Magazzino immagini | scrivere | `inventory.edit` |
| Branding team-files | leggere/scrivere | membership / `settings.manage` |

## Owner
Il ruolo `owner` è intenzionalmente non riducibile da override individuali, sia frontend sia backend.
