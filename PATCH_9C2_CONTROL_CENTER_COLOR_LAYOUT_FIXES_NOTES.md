# Patch 9C.2 — Control Center color semantics & dashboard layout fixes

## Obiettivo
Correzione mirata dopo il test della Patch 9C.1.

## Correzioni incluse

### 1. Semantica colori branding
- `primary_color` ora viene usato per dare una tinta reale allo sfondo della sidebar e alle superfici di identità del team.
- Il testo del menu selezionato non usa più il primary color: resta bianco per preservare leggibilità.
- I titoli e gli indicatori principali usano di nuovo soprattutto `accent_color`, così il primary non trasforma testi e titoli in modo inatteso.
- La sidebar mantiene overlay scuri per evitare problemi se il primary scelto è molto acceso.

### 2. Dashboard widget layout
- Le dimensioni widget sono state rese più conservative e leggibili.
- `Ampio` su desktop normali usa una riga larga/intera invece di generare widget stretti e troppo alti.
- `Riga intera` occupa tutta la riga.
- `Compatto` differenzia realmente solo su schermi molto larghi; su desktop normali resta leggibile.
- Aggiornate le etichette nel Control Center per spiegare meglio il comportamento delle dimensioni.

## Supabase
Nessuna query Supabase richiesta.

## Verifiche
- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila CSS/webpack OK, poi resta in timeout nella fase interna Next come nelle patch precedenti.
