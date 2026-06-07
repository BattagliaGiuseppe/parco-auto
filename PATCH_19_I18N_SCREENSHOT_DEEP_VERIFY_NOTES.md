# PATCH 19 - i18n screenshot deep verify

Questa patch prosegue l'approccio sicuro introdotto con il safe mode i18n: nessuna traduzione automatica del DOM, nessun MutationObserver e nessuna scansione dei dati dinamici.

## Obiettivo

Correggere le parti non tradotte evidenziate negli screenshot inviati, intervenendo direttamente sui componenti e sulle pagine che stampavano ancora testi statici o helper locali non translation-aware.

## Moduli coperti

- Dashboard
- Sidebar/etichette già coperte dal catalogo i18n precedente
- Car / lista schede
- Scheda mezzo
- Stampa scheda mezzo
- Documenti mezzo
- Components / Ricambi
- Scheda componente
- Mounts / Montaggi
- Maintenance / Manutenzioni
- Calendar / Events
- Drivers
- Telemetry
- Tasks
- Attendance
- Settings / Control Center
- Team & Access

## Cosa è stato corretto

- Espanso il catalogo `lib/i18n.ts` con un blocco dedicato `PATCH_19_SCREENSHOT_UI_TEXTS` basato sulle diciture cerchiate negli screenshot.
- Resi translation-aware diversi helper locali che prima stampavano direttamente `label`, `value`, `helper`, `hint` o `children`:
  - mini card statistiche;
  - campi form;
  - pill/stati;
  - box informativi;
  - metriche di diagnostica;
  - righe di stampa/documento;
  - componenti di riepilogo nelle pagine evento/turni.
- Aggiunta traduzione esplicita per pulsanti, messaggi, helper e testi di onboarding rimasti hardcoded nelle pagine principali.
- Aggiunto controllo su chiavi usate da `LocalizedText`, `tr(...)` e `t("ui...")`: nessuna chiave nuova risulta mancante nel catalogo.

## Cosa NON viene tradotto intenzionalmente

Per evitare rallentamenti e comportamenti pericolosi, restano non tradotti:

- nomi auto, piloti, componenti, eventi e articoli inseriti dall'utente;
- note operative e descrizioni salvate nel database;
- codici tecnici, SKU, identificativi, file name e valori di telemetria;
- etichette configurabili salvate nel Control Center quando sono dati modificabili dall'utente.

Se in futuro vuoi che anche le etichette configurabili salvate nel database siano multilingua, conviene creare una struttura dati dedicata tipo `{ it, en, fr, es, de }`, non tradurle automaticamente.

## Verifiche eseguite nel sandbox

- Controllo statico delle chiamate i18n aggiunte: nessuna chiave mancante tra `LocalizedText`, `tr(...)` e `t("ui...")`.
- Ricerca di errori sintattici/undefined più critici nel log TypeScript: nessun `Cannot find name 'tr'`, nessun `Cannot find name 't'`, nessun errore sintattico TSX rilevato.
- Confermato che non viene reintrodotto `MutationObserver` o traduzione post-render globale.

Nota: il `tsc --noEmit` completo nel sandbox resta limitato perché lo ZIP non contiene `node_modules`, quindi mancano tipi React/Next/Node/Supabase. Gli errori residui del log sono quelli attesi per dipendenze non installate.
