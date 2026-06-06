# Patch 6B — Estensione vista sintetica e filtri ordinati

Questa patch prosegue la logica introdotta con la Patch 6A: ridurre l'impatto iniziale delle pagine più dense e offrire sempre una vista compatta/sintetica come punto di partenza.

## Modifiche principali

### Piloti
- Aggiunto toggle `Sintetica / Schede`.
- La vista sintetica diventa il default e mostra una riga per pilota con:
  - nome / numero gara;
  - contatti principali;
  - scadenze principali;
  - performance essenziale;
  - stato;
  - azioni rapide.
- La vista a schede resta disponibile per la consultazione dettagliata con documenti, performance e gestione completa.
- Preferenza salvata in `localStorage` con chiave `drivers-view-mode`.

### Magazzino
- Aggiunto toggle `Sintetica / Schede` anche al magazzino.
- La vista sintetica resta la tabella compatta, più adatta alla consultazione rapida e alla gestione di molti articoli.
- La vista a schede mostra card articolo più leggibili per consultazione visiva, con:
  - foto;
  - stato scorta;
  - disponibilità/minima/riservata;
  - azioni rapide.
- Preferenza salvata in `localStorage` con chiave `inventory-view-mode`.

### Telemetria
- L'archivio telemetria ora parte di default dalla vista sintetica.
- Il selettore vista è stato allineato meglio al tema Dark Race Control.
- La vista dettagliata resta disponibile per analisi più approfondite.

## Moduli non toccati in questa patch

### Impostazioni
La pagina Impostazioni non è una lista operativa come Auto, Componenti, Manutenzioni, Magazzino o Piloti. Per questo non è stata forzata una vista sintetica/dettagliata: verrà trattata in un refactor dedicato quando verrà riorganizzata in sezioni più compatte.

## Supabase
Nessuna query da eseguire. La patch è solo frontend/UX.

## File modificati
- `app/drivers/page.tsx`
- `app/inventory/page.tsx`
- `app/telemetry/page.tsx`

## Test consigliati
1. Aprire Piloti e verificare che parta in vista sintetica.
2. Passare Piloti a Schede e ricaricare la pagina: la preferenza deve restare salvata.
3. Aprire Magazzino e verificare tabella sintetica + toggle Schede.
4. Passare Magazzino a Schede e provare azioni rapide.
5. Aprire Telemetria e verificare che l'archivio parta in Sintetica.
