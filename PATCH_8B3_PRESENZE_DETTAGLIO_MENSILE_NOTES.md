# Patch 8B.3 — Scheda membro e dettaglio mensile presenze

Questa patch estende il modulo Presenze con una vista di dettaglio per singolo membro staff.

## Cosa aggiunge

- Pulsante `Dettaglio` nel riepilogo ore per utente.
- Pulsante `Dettaglio` nella console presenze sintetica.
- Modale `Scheda presenze` per ogni membro staff.
- Selettore mese con ultimi 18 mesi.
- Riepilogo mensile con:
  - ore del mese;
  - giorni lavorati;
  - numero timbrature;
  - stato presente/assente.
- Elenco raggruppato per giorno con:
  - entrata;
  - uscita;
  - durata;
  - luogo entrata/uscita;
  - evento collegato;
  - note;
  - stato timbratura aperta/chiusa;
  - modifica rapida per owner/admin.

## Note tecniche

- Nessuna modifica al database.
- Nessuna query Supabase da lanciare.
- Il dettaglio mensile carica le timbrature del membro selezionato direttamente da `attendance_records`, filtrando per mese.
- La modifica amministrativa usa la RPC già esistente `attendance_admin_update_record`.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` OK.
- `npx tsc --noEmit --pretty false` OK.
- `npm run build` compila CSS/webpack e typecheck, poi va in timeout nella fase statica come già visto in container.
