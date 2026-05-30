# Patch 8B — Presenze e timbrature base

Modulo aggiunto: **Presenze** (`/attendance`).

## Cosa aggiunge

- Nuova voce sidebar: **Presenze**.
- Nuova pagina `/attendance` in stile Dark Race Control.
- Timbratura personale da account webapp:
  - Entrata;
  - Uscita;
  - luogo: sede/officina, pista/evento, altro;
  - collegamento opzionale a un evento;
  - nota rapida su entrata/uscita.
- Vista sintetica di default:
  - stato dello staff;
  - presenti/assenti;
  - luogo timbratura;
  - ora entrata;
  - durata corrente.
- Vista a schede per storico timbrature degli ultimi 21 giorni.
- Statistiche rapide:
  - presenti ora;
  - persone in pista;
  - ore registrate oggi;
  - staff attivo.
- Creazione membri staff manuali per owner/admin.
- Creazione automatica del profilo staff per gli utenti già presenti in `team_users`.

## Database

Eseguire in Supabase SQL Editor:

```sql
db/attendance_presenze_patch.sql
```

La patch crea:

- `team_staff_members`
- `attendance_records`

Funzioni RPC:

- `attendance_ensure_staff_member`
- `attendance_clock_in`
- `attendance_clock_out`

Permessi applicativi:

- `attendance.view`
- `attendance.clock_self`
- `attendance.manage`
- `attendance.kiosk`
- `attendance.export`

Il modulo viene attivato in `app_settings.modules.attendance = true`.

## Note privacy

Questa prima versione non fa tracciamento continuo. Permette solo di indicare il luogo operativo della timbratura e predisposizione campi GPS puntuali per una futura opzione esplicita.

## Verifiche eseguite

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit --pretty false
npm run build
```

`npm run build` compila CSS/webpack e supera il controllo TypeScript; nel container va in timeout alla fase interna Next `Collecting page data`, come già accaduto nelle patch precedenti.

## Test consigliati

1. Eseguire `db/attendance_presenze_patch.sql`.
2. Deploy Vercel.
3. Aprire **Presenze** dalla sidebar.
4. Fare una timbratura entrata in sede.
5. Fare uscita.
6. Fare una timbratura con luogo `Pista / evento` collegandola a un evento.
7. Verificare vista sintetica e vista schede.
8. Come owner/admin, creare un membro staff manuale.
