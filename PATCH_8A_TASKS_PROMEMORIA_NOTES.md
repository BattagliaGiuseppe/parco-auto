# Patch 8A — Attività / Promemoria collegati

Questa patch aggiunge il primo modulo operativo per gestire task e promemoria collegati al lavoro del team.

## Supabase

Eseguire in Supabase SQL Editor solo:

```sql
db/tasks_promemoria_patch.sql
```

La patch crea:

- `tasks`
- `task_comments`
- `task_checklist_items`
- permessi `tasks.view`, `tasks.edit`, `tasks.assign`, `tasks.delete`
- policy RLS team-scoped
- modulo `tasks` attivo nelle impostazioni esistenti

## Frontend

Aggiunto nuovo modulo:

- `/tasks` — pagina Attività

Funzioni iniziali:

- vista sintetica di default;
- vista a schede opzionale;
- filtri per auto, stato, area, priorità, assegnatario;
- creazione/modifica attività;
- completamento rapido;
- eliminazione per owner/admin;
- collegamenti opzionali ad auto, componente, evento, articolo magazzino, pilota e assegnatario;
- link in sidebar;
- riepilogo attività aperte in dashboard;
- sezione attività aperte nella scheda dettaglio auto.

## File principali modificati

- `app/tasks/page.tsx`
- `app/cars/[id]/page.tsx`
- `app/dashboard/page.tsx`
- `components/Sidebar.tsx`
- `app/settings/page.tsx`
- `db/tasks_promemoria_patch.sql`

## Cosa non è incluso ancora

Questa è la prima versione operativa del modulo. Rimandati alle prossime patch:

- commenti attività in UI;
- checklist interna dei task;
- vista Kanban;
- conversione task → manutenzione;
- notifiche/scadenze automatiche.
