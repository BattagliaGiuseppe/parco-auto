# PATCH 16 — i18n safe mode, step 1: Magazzino / Inventario

Questa patch continua il lavoro multilingua con un metodo più sicuro e professionale:

- nessuna traduzione automatica globale del DOM;
- nessun MutationObserver;
- nessuna scansione di tabelle, righe inventario o dati provenienti dal database;
- traduzione solo dei testi statici della pagina tramite `t(...)` / `tr(...)` al momento del render.

## File modificati

- `app/inventory/page.tsx`
- `lib/i18n.ts`

## Cosa è stato tradotto nella pagina Magazzino

- intestazione pagina e sottotitoli;
- pulsanti azione principali;
- statistiche riepilogative;
- sezione import/export;
- filtri e placeholder di ricerca;
- empty state;
- intestazioni tabella;
- card articolo;
- azioni articolo: modifica, carico, scarico, rettifica, impegno, storico;
- modale nuovo/modifica articolo;
- form articolo, label, hint e placeholder;
- modale movimento magazzino;
- storico movimenti;
- modale ordine colonne;
- import guidato CSV;
- messaggi di feedback principali.

## Cosa resta volutamente non tradotto

- nomi articoli;
- SKU, barcode, codici fornitore/OEM;
- marca, fornitore, categoria, posizione, note salvate dall’utente;
- nomi file CSV caricati;
- valori e intestazioni provenienti dal file importato;
- messaggi tecnici originali provenienti da Supabase o dal browser.

Questi contenuti sono dati dinamici/utente e non vanno tradotti automaticamente.

## Verifica

Ho eseguito `npx --no-install tsc --noEmit --pretty false` nel sandbox.
Il controllo completo non è attendibile perché lo ZIP non contiene `node_modules`, quindi mancano i tipi React/Next/lucide/Supabase e compaiono molti errori non collegati a questa patch.
Nel filtro sugli errori della pagina Inventario non risultano errori sintattici specifici della patch; gli errori mostrati dipendono dall’assenza dei tipi React nel sandbox.
