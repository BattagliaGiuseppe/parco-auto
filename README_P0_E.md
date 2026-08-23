# PATCH P0-E — Permission Enforcement

Questa patch serve ad allineare il repository allo stato già applicato e verificato sul Supabase live.

## Importante

Le due migration sono GIÀ applicate sul database live con gli stessi version ID Supabase:

- `20260823153457_p0e_permission_resolver`
- `20260823153831_p0e_write_permission_enforcement`

Non eseguire manualmente questi SQL sul live.

Copia i file nel repository solo per mantenere storico/migration alignment.

## Stato dopo P0-E.2A

- 78 write policy granulari attive;
- 0 vecchie write policy membership-only sui 26 gruppi/tabelle coperti;
- 9 RPC SECURITY DEFINER hardenizzati;
- `has_team_permission()` eseguibile da authenticated/service_role, non da anon;
- letture ancora membership-based: verranno migrate nella fase successiva dopo audit dipendenze.
