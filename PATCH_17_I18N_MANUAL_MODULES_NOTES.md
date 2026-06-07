# PATCH 17 - i18n manuale per moduli principali

Questa patch continua il lavoro in modalità sicura dopo la rimozione della traduzione automatica globale.

## Metodo usato

- Nessun `MutationObserver`.
- Nessuna scansione di `document.body`.
- Nessuna traduzione automatica di dati dinamici, articoli inventario, nomi mezzi, codici, note utente o valori database.
- I testi statici sono tradotti a render time tramite `t(...)`, `tr(...)` o il nuovo componente leggero `LocalizedText`.
- Le traduzioni restano basate su corrispondenze esatte, quindi non generano parole/frasi composte automaticamente.

## Moduli coperti in questa patch

- Dashboard
- Sidebar/status comuni già supportati dal sistema precedente
- Car / Schede mezzo
- Scheda mezzo stampabile
- Documenti mezzo
- Componenti / Ricambi
- Scheda componente
- Montaggi
- Manutenzioni
- Eventi
- Piloti
- Telemetria
- Attività / Tasks
- Presenze / Attendance
- Team & Access
- Control Center / Settings

## File modificati

- `lib/i18n.ts`
- `components/LocalizedText.tsx`
- `app/dashboard/page.tsx`
- `app/cars/page.tsx`
- `app/cars/[id]/page.tsx`
- `app/cars/[id]/documents/page.tsx`
- `app/components/page.tsx`
- `app/components/[id]/page.tsx`
- `app/mounts/page.tsx`
- `app/maintenances/page.tsx`
- `app/calendar/page.tsx`
- `app/drivers/page.tsx`
- `app/telemetry/page.tsx`
- `app/tasks/page.tsx`
- `app/attendance/page.tsx`
- `app/settings/page.tsx`
- `app/settings/team/page.tsx`

## Verifiche eseguite

Eseguito controllo TypeScript nel sandbox:

```bash
npx tsc --noEmit --pretty false --project tsconfig.json
```

Il sandbox non contiene `node_modules`, quindi restano errori attesi su moduli mancanti (`react`, `next`, `lucide-react`, `supabase`, ecc.).
Non risultano errori sintattici TSX/TS introdotti dalla patch.

## Note operative

Dopo aver applicato la patch, controllare soprattutto:

1. cambio lingua da sidebar;
2. Dashboard;
3. Car e scheda car;
4. Ricambi/componenti;
5. Montaggi;
6. Manutenzioni;
7. Eventi;
8. Piloti;
9. Telemetria;
10. Attività;
11. Presenze;
12. Settings e Team & Access.

Eventuali testi ancora non tradotti dovrebbero essere casi specifici rimasti in JSX o testi generati da dati/configurazioni del database. Quelli vanno corretti puntualmente, senza ripristinare automatismi globali.
