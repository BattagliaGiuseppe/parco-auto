# Patch 5A.3 — UI Consistency Polish

Questa patch parte dalla 5A.2 validata e si concentra sulle piccole incoerenze grafiche rimaste tra le pagine principali.

## Obiettivo

Uniformare i componenti residui ancora troppo chiari o non allineati al tema **Dark Race Control**, senza cambiare logica dati o database.

## Modifiche principali

### Dettaglio auto

- Convertite le card di **Panoramica mezzo** da box bianchi a mini-panel dark coerenti.
- Convertite le card dei **componenti montati** allo stile `data-row`.
- Resi coerenti badge, metriche componente e CTA “Apri componente”.
- Corretto il doppio suffisso ore in “Ore vettura”.

### Documenti auto

- Convertito il form **Nuovo documento** al sistema `form-control-dark`.
- Reso più coerente il file input con stile dark/racing.
- Convertite le card dell’**Archivio documenti** allo stile `data-row`.
- Convertiti info box e note documento allo stile dark con accento giallo.

### Dettaglio evento / console mezzo

- Resi coerenti `StatusChip`, riepiloghi e card dei turni tecnici.
- Migliorati i bottoni secondari e quelli di eliminazione.
- Rimossi residui chiari nei pulsanti di conferma inline.

### Componenti condivisi

- `InlineConfirmButton` ora è coerente con il tema dark.
- `FormStatusBanner` ora usa superfici e colori compatibili con Dark Race Control.
- Rafforzati i CSS di `race-mini-panel` e `race-card-grid` per migliore separazione visiva.
- Aggiunto styling custom per `input[type=file]` in `form-control-dark`.

## Supabase

Nessuna query Supabase da lanciare.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila correttamente CSS/webpack e arriva alla fase interna Next di controllo tipi. Nel container va in timeout come nelle patch precedenti, ma senza errori di compilazione.

## File principali modificati

- `app/globals.css`
- `app/cars/[id]/page.tsx`
- `app/cars/[id]/documents/page.tsx`
- `app/calendar/[eventId]/page.tsx`
- `app/calendar/[eventId]/car/[eventCarId]/page.tsx`
- `components/FormStatusBanner.tsx`
- `components/InlineConfirmButton.tsx`
