# Patch 4C — Dark Race Control hardening

Questa patch corregge il problema della 4B: le modifiche erano troppo leggere e non intercettavano alcune modali/card che usavano utility Tailwind chiare o venivano renderizzate fuori dal wrapper principale.

## Tipo patch

Solo frontend / CSS.

Non richiede query Supabase.

## Cosa cambia

- Conversione più decisa delle vecchie utility chiare (`bg-white`, `bg-neutral-50`, `bg-gray-50`, ecc.) al tema Dark Race Control.
- Correzione globale dei testi scuri (`text-neutral-*`, `text-gray-*`, `text-slate-*`, ecc.) su fondi dark.
- Modali e overlay più coerenti con il tema scuro, anche quando il markup è renderizzato fuori dalla shell principale.
- Input, select, textarea, date picker e placeholder più leggibili su dark.
- Tabelle e righe legacy rese coerenti con il tema scuro.
- Stati colorati mantenuti leggibili: giallo/rosso/blu/verde.

## Pagine da controllare

- Eventi: modale nuovo evento e card eventi registrati.
- Montaggi: form montaggio rapido e filtri storico.
- Manutenzioni: modale aggiungi manutenzione.
- Componenti: elenco componenti, filtri e card componente.
- Auto: ricerca mezzi e card auto.
- Dashboard: quadro operativo e righe mezzi/componenti.

## Verifiche locali

- `npm ci --ignore-scripts --no-audit --no-fund`: OK
- `npx tsc --noEmit --pretty false`: OK

## Supabase

Nessuna query da eseguire.
