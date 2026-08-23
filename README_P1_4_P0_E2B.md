# P1.4 + P0-E.2B — Scalability & granular security

## Stato
Le migration contenute in questo pacchetto sono **GIÀ APPLICATE sul database Supabase live**.

**NON eseguire manualmente i file SQL.**
Servono a mantenere il repository allineato allo stato del database e a documentare rollback/verifiche.

## File applicativi modificati
- `app/drivers/[id]/performance/page.tsx`
- `app/attendance/page.tsx`
- `app/settings/team/page.tsx`
- `lib/permissions.ts`
- `components/Sidebar.tsx`

## P1.4 — Performance Pilota
La pagina Performance Pilota non scarica più tutta la carriera attraverso query separate a turni, metriche, eventi, event-car e auto.

Nuovo RPC:
- `driver_performance_page(team_id, driver_id, page, page_size)`
- 50 righe per pagina lato UI
- riepilogo globale calcolato lato database
- accesso protetto da `drivers.view`

## P0-E.2B — Tasks
RLS:
- SELECT → `tasks.view`
- INSERT / UPDATE → `tasks.edit`
- DELETE → `tasks.delete`
- checklist/commenti ereditano i permessi Tasks appropriati

Trigger:
- `tasks.assign` è richiesto solamente quando viene impostato o cambiato l'assegnatario
- l'assegnatario deve appartenere allo stesso team ed essere attivo
- non è consentito spostare un Task tra team modificando `team_id`

## P0-E.2B — Presenze
Backend e UI usano i codici granulari:
- `attendance.view`
- `attendance.clock_self`
- `attendance.manage`
- `attendance.export`
- `attendance.kiosk`

Le RPC amministrative non dipendono più dal vecchio controllo owner/admin; usano `attendance.manage`.
Timbratura personale richiede `attendance.clock_self` e kiosk richiede `attendance.kiosk`.

## P0-E.2B — Impostazioni / Team
- scritture configurazione → `settings.manage`
- gestione membri/inviti/override → `team.manage`
- corretto `teams_select`: membership verificata con `team_users.team_id = teams.id`
- Owner non può ricevere override negativi: mantiene sempre tutti i permessi

## P0-E.2B — Frontend permission parity
Rimosso il fallback basato sul ruolo dopo il calcolo dei permessi effettivi.
Questo era importante perché un override `DENY` poteva essere annullato dal fallback Engineer/Admin.

Adesso:
- i permission code effettivi sono autoritativi
- Owner resta sempre full-access, coerentemente con il resolver DB
- Sidebar, Presenze e Gestione Team rispettano gli override granulari

## P0-E.2B — Storage
`team-files` resta privato e viene autorizzato per area:
- branding: lettura membri, scrittura `settings.manage`
- `car-images` / `car-documents`: `cars.view` / `cars.edit`
- `driver-documents` / `driver-profile`: `drivers.view` / `drivers.edit`
- `telemetry`: `telemetry.view` / `telemetry.edit`

Bucket dedicati:
- `driver-documents`: privato, `drivers.view/edit`
- `driver-photos`: pubblico in lettura per CDN, scrittura `drivers.edit`
- `inventory-images`: pubblico in lettura per CDN, scrittura `inventory.edit`

Le immagini non sensibili restano pubbliche intenzionalmente per evitare signed URL e round-trip aggiuntivi sulle liste. I documenti restano privati.

## Verifiche live già eseguite
- 65 policy granulari nei moduli interessati
- 0 vecchie policy target membership/manager
- 0 policy residue basate su `is_team_manager` nei moduli migrati
- Owner overrides presenti: 0
- Owner override negativo: bloccato dal trigger in test transazionale
- Engineer: `tasks.assign=true`, `tasks.delete=false`
- Engineer: Auto Storage write=false, Telemetry Storage write=true
- `driver_performance_page`: authenticated=true, anon=false
- `team_file_has_permission`: authenticated=true, anon=false
- Performance Pilota live: 3 turni correnti restituiti correttamente
- tutte le prove di mutazione sono state eseguite in transazione con rollback

## Build frontend
I 5 file modificati hanno superato il controllo sintattico TypeScript (`transpileModule`).
Il type-check completo locale non è stato considerato valido perché la copia dell'ambiente non contiene tutte le type definitions del progetto; il build Vercel resta quindi la verifica completa.

## Deploy
1. Copiare il contenuto di questo pacchetto nella root del progetto.
2. **Non eseguire SQL.**
3. Commit + push.
4. Verificare il build Vercel.

## Rollback
La cartella `supabase/rollback` contiene rollback separati per area. Il rollback Governance mantiene volutamente la correzione della policy `teams_select`, perché ripristinare il precedente refuso sarebbe una regressione di sicurezza.
