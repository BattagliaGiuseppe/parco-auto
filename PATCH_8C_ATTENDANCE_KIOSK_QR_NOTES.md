# Patch 8C — Presenze Badge / QR / Kiosk

Questa patch estende il modulo Presenze con una modalità tablet/kiosk e credenziali rapide per lo staff.

## Supabase

Eseguire solo:

```sql
db/attendance_kiosk_badge_patch.sql
```

Non rilanciare le patch precedenti.

## Funzioni aggiunte

- Nuova pagina `/attendance/kiosk` per tablet/officina/pista.
- Badge personale per ogni membro staff.
- PIN rapido come alternativa al badge.
- Generazione/rigenerazione badge e PIN da pagina Presenze per owner/admin.
- QR badge personale: scansionandolo si apre il kiosk con badge già compilato.
- QR evento/pista: apre il kiosk con evento e luogo già precompilati, poi il dipendente inserisce badge o PIN.
- RPC Supabase:
  - `attendance_generate_badge_credentials`
  - `attendance_kiosk_clock`

## Sicurezza

- I codici badge e PIN sono salvati nel database come hash SHA-256.
- Il codice completo viene mostrato solo dopo la generazione. Se viene perso, va rigenerato.
- Il kiosk richiede comunque una sessione webapp con permesso `attendance.kiosk`.
- Il QR evento non identifica il dipendente: serve sempre badge o PIN.

## Nota QR

La visualizzazione del QR usa un servizio immagine QR esterno partendo da un token casuale/link kiosk. Il codice e il PIN sono comunque token non direttamente leggibili come dati personali. Se in futuro vuoi una generazione QR 100% interna, possiamo aggiungere una libreria dedicata e rimuovere la dipendenza visiva esterna.

## Verifiche effettuate

- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila CSS/webpack e passa typecheck, poi nel container si ferma per timeout/SIGTERM in `Collecting page data`, come già osservato nelle patch precedenti.
