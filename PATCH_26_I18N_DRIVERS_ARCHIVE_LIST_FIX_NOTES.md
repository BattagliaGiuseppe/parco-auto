# PATCH 26 - i18n Piloti: archivio e lista piloti

Correzione mirata per la sezione Piloti, in particolare la scheda Archivio e le righe/card dell'elenco piloti.

## File modificati

- `app/drivers/page.tsx`
- `lib/i18n.ts`

## Cosa corregge

- I filtri dell'archivio piloti ora usano chiavi esplicite:
  - Tutti / Attivi / Non attivi / Con scadenze
- I fallback nella riga pilota ora usano chiavi esplicite:
  - Profilo pilota
  - Email non inserita
  - Telefono non inserito
  - Nessun nickname
- I badge scadenze non usano più traduzioni generiche `ui.*`, ma chiavi dedicate:
  - Licenza / Medica
  - non inserita / scaduta / in scadenza / valida
- I pulsanti dell'elenco piloti ora usano chiavi dirette:
  - Apri / Chiudi / Modifica
- Nella riga performance vengono tradotti:
  - turni / sessions
  - Best
  - stato Attivo / Non attivo / Da verificare

## Sicurezza

- Nessun `MutationObserver` reintrodotto.
- Nessuna scansione del DOM.
- Nessuna traduzione automatica di dati dinamici: nomi piloti, email reali, telefono reale, note, documenti e valori database restano invariati.
