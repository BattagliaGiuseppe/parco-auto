# Patch 5A build fix

Correzione rapida della Patch 5A.

## Problema risolto

La build Vercel falliva su `app/globals.css` con:

```text
Unexpected } at line 466
```

La causa era una graffa di chiusura in più nel blocco `@layer components` di `app/globals.css`.

## Modifica

- Rimossa la graffa extra che chiudeva prematuramente `@layer components`.
- Nessuna modifica a database, Supabase o logica applicativa.

## Verifiche

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit --pretty false
npm run build
```

Risultato:

- `npm ci`: OK
- `tsc`: OK
- `next build`: CSS/webpack compilano correttamente; nel container la build arriva a `Collecting page data ...` e poi va in timeout come già avvenuto nelle patch precedenti.
