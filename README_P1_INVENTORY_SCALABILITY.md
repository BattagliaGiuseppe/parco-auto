# P1 – Inventory scalability

## Stato database
La migration `p1_inventory_scalability_foundation` è già stata applicata al Supabase live e verificata.
**Non eseguire SQL manualmente.**

## File applicativi modificati
- `app/inventory/page.tsx`
- `lib/i18n.ts`

## Cosa cambia
- massimo 50 articoli renderizzati per pagina;
- ricerca lato server con debounce (300 ms);
- ricerca indicizzata su nome, SKU, categoria, marca, fornitore, codici, barcode, posizione e note;
- filtri lato server (sotto minima, impegnati, con foto, senza foto);
- statistiche aggregate calcolate dal DB tramite `get_inventory_stats`;
- query con colonne esplicite invece di `select("*")`;
- immagini con `loading="lazy"` e `decoding="async"`;
- paginazione con conteggio risultati.

## Obiettivo
Il browser elabora un massimo di 50 record per volta anche quando il team avrà migliaia o decine di migliaia di articoli.
