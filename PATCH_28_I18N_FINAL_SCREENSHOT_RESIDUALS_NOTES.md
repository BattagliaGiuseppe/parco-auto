# PATCH 28 - i18n residuali da screenshot 21/08/2026

Patch manuale e sicura sulle difformità evidenziate negli screenshot con riquadri rossi.

## Principio applicato

- Nessun `MutationObserver`.
- Nessuna scansione di `document.body`.
- Nessuna traduzione automatica globale del DOM.
- Nessuna traduzione forzata di dati dinamici/database, nomi auto, codici, note libere o valori inventario.
- Le traduzioni sono applicate solo a testi UI statici, helper generati dall'app e valori configurabili conosciuti.

## File modificati

- `lib/i18n.ts`
  - aggiunte traduzioni esatte per residui UI da screenshot;
  - aggiunte traduzioni per permessi Team & Access;
  - aggiunte traduzioni per kiosk/presenze, console turni, schede mezzo, stampa, montaggi, componenti e impostazioni;
  - aggiunte traduzioni per testi generati dall'app, come note di montaggio iniziale.

- `app/cars/page.tsx`
  - corretti titolo/sottotitolo pagina schede mezzo;
  - corretti ricerca, elenco, etichette telaio, ore revisione/vita accumulata;
  - corretti testi modale nuova/modifica scheda e configurazione componenti.

- `app/cars/[id]/page.tsx`
  - corretti sottotitoli scheda mezzo, panoramica, attività aperte e componenti montati;
  - corretti fallback attività generale e assegnazione.

- `app/cars/[id]/print/page.tsx`
  - corretti tasti stampa/scheda mezzo;
  - corretti titolo stampa, documento, panoramica, meta e documenti collegati.

- `app/components/page.tsx`
  - corretti tasto nuovo componente e pulsante salvataggio componente.

- `app/mounts/page.tsx`
  - tradotte le note generate dall'app quando corrispondono a testo conosciuto, ad esempio "Montaggio iniziale da anagrafica componente".

- `app/attendance/page.tsx`
  - corretti select luoghi, evento QR, fallback record, staff e tasti amministrativi.

- `app/attendance/kiosk/page.tsx`
  - corretti modalità, luoghi, evento collegato, nota opzionale, pulsanti e contesto kiosk.

- `app/settings/team/page.tsx`
  - corretti permessi base per ruolo, etichette e descrizioni permessi, ruoli, stati e pulsanti salvataggio membro.

## Verifiche svolte nel sandbox

- Ricerca `Cannot find name 'tr'` / `Cannot find name 't'`: nessun risultato.
- Ricerca `MutationObserver`: non reintrodotto.
- `npx tsc --noEmit --project tsconfig.json` non è completabile in modo pulito nel sandbox perché mancano `node_modules` e i tipi React/Next/Supabase, ma non emergono errori sintattici o nomi `tr/t` fuori scope.

## Note operative

Questa patch deve essere applicata sopra le patch i18n precedenti, inclusa la patch safe-mode che ha rimosso la traduzione globale del DOM.
