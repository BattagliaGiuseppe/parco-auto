# Patch 8D — Timbratura rapida staff + protezione Presenze

## Obiettivo

Separare in modo netto:

- **Presenze completo**: riservato a owner/admin.
- **Timbratura rapida staff**: pagina personale ultra semplice per entrata/uscita.

## Nuova pagina

- `app/attendance/quick/page.tsx`
- URL: `/attendance/quick`

La pagina è pensata per smartphone e collegamento diretto in home screen.
Lo staff vede solo:

- stato attuale: presente/non presente;
- luogo timbratura: sede/officina, pista/evento, altro;
- bottone grande `ENTRATA` o `USCITA`;
- conferma registrazione.

Non mostra riepiloghi, statistiche, elenco altri utenti o storico completo.

## Protezione modulo Presenze

`/attendance` ora è riservato ai ruoli owner/admin o a chi ha permesso gestionale presenze.
Se un utente staff con solo `attendance.clock_self` prova ad aprire `/attendance`, viene reindirizzato a `/attendance/quick`.

## Layout standalone

`/attendance/quick` e `/attendance/kiosk` non mostrano la sidebar/app shell completa, così restano adatti a smartphone e tablet.

## Database

Eseguire solo:

```sql
db/attendance_quick_staff_patch.sql
```

La patch SQL:

- rimuove `attendance.view` dai ruoli staff standard;
- mantiene `attendance.clock_self` per engineer/mechanic/viewer;
- mantiene `attendance.view/manage/kiosk/export` per owner/admin;
- restringe RLS per staff members e records: staff vede solo sé stesso, admin vede tutti;
- rende `attendance_staff_summary` accessibile solo ad owner/admin.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila CSS/webpack e typecheck, poi timeout su `Collecting page data` come nelle patch precedenti.
