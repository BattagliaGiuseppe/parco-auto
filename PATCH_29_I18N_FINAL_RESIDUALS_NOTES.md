# PATCH 29 - i18n residuali finali da screenshot

Patch mirata sui residui evidenziati negli ultimi screenshot dell'audit manuale.

## Metodo

- Nessuna traduzione automatica globale.
- Nessun `MutationObserver`.
- Nessuna scansione di `document.body`.
- Nessuna traduzione dei dati dinamici inseriti dagli utenti o letti dal database: nomi auto, codici, descrizioni libere, note, file, SKU e valori tecnici restano invariati.
- Le traduzioni sono state aggiunte come testi statici/di sistema nel catalogo `lib/i18n.ts` e applicate nei componenti/pagine dove il testo era stampato direttamente.

## Aree coperte

- Team & Access: matrice permessi, descrizioni permessi, pulsanti salvataggio membro.
- Attendance: QR evento/pista, kiosk presenze, nuovo staff, campi badge/PIN e azioni principali.
- Telemetry: upload file, archivio telemetria, warning import, stato collegamento turno e pulsanti archivio.
- Console turni: KPI, fuel prediction, campi pre/post run, label tecniche e riepiloghi.
- Console mezzo evento: driver disponibili, giri/minuti, fuel consumato, acqua/olio max, setup/check-up.
- Mounts: form montaggio, filtri, note automatiche di montaggio e stato montato/smontato.
- Components/Spare parts: nuovo componente, soglie, stato montaggio, dettagli componente e modali componente.
- Cars/Schede mezzo: elenco cars, configurazione componenti standard, scelta file, salvataggio scheda, panoramica auto.
- Dashboard: stato componente smontato/montato nella card criticità.

## File inclusi

- `lib/i18n.ts`
- `app/settings/team/page.tsx`
- `app/telemetry/page.tsx`
- `app/components/page.tsx`
- `app/components/[id]/page.tsx`
- `app/cars/page.tsx`
- `app/cars/[id]/page.tsx`
- `app/calendar/[eventId]/car/[eventCarId]/page.tsx`
- `app/calendar/[eventId]/car/[eventCarId]/turns/page.tsx`
- `app/calendar/[eventId]/car/[eventCarId]/setup-scheda.tsx`
- `app/dashboard/page.tsx`

## Verifiche

- `lib/i18n.ts` controllato con TypeScript isolato: OK.
- Controllato che non sia stato reintrodotto `MutationObserver`.
- Controllato che non sia stata reintrodotta scansione globale del DOM.

Nota: nel sandbox non ci sono `node_modules`, quindi il build completo Next/Vercel va verificato dopo l'applicazione della patch nel repository reale.
