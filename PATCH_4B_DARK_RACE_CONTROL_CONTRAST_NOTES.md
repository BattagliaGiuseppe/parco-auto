# Patch 4B — Dark Race Control contrast refinement

Questa micro-patch corregge i problemi emersi dagli screenshot della Patch 4.

## Obiettivo

Rendere coerenti con il tema Dark Race Control anche le pagine che usavano ancora utility Tailwind chiare (`bg-white`, `bg-neutral-*`, `text-neutral-*`, ecc.) in modo diretto.

## Problemi corretti

- Modali ancora troppo bianche rispetto al tema scuro.
- Card evento/componenti/manutenzioni ancora chiare in alcune pagine.
- Testi poco leggibili su pannelli scuri, soprattutto dove erano rimaste classi `text-neutral-*`, `text-gray-*`, `text-slate-*` o `text-zinc-*`.
- Input/select/textarea non sempre coerenti con il tema scuro.
- Stati hover, bordi e divisori ancora troppo chiari o troppo spenti.
- Righe operative dashboard più leggibili su fondo scuro.

## File modificati

- `app/globals.css`

## Supabase

Nessuna query Supabase da eseguire.

## Note

La patch è volutamente CSS-only: non modifica logica dati, RPC, tabelle, trigger o comportamento applicativo.
