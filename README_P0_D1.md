# P0-D.1 — Magazzino: rettifica a zero + elimina sicuro

## Cosa corregge
1. **Rettifica quantità a 0**
   - Prima `confirmMovement()` rifiutava qualsiasi valore `<= 0` prima di distinguere il tipo di movimento.
   - Ora la rettifica accetta una quantità finale pari a `0` e calcola correttamente il delta negativo.
   - Gli altri movimenti (carico/scarico/impegno ecc.) continuano a richiedere una quantità `> 0`.

2. **Tasto Elimina articolo**
   - Aggiunto sia nella vista tabella sia nella vista schede.
   - Non esegue una cancellazione fisica, perché `inventory_movements.inventory_item_id` ha `ON DELETE CASCADE` e cancellerebbe anche lo storico movimenti.
   - Imposta invece `inventory_items.archived_at`; l'articolo scompare dal magazzino operativo ma lo storico resta conservato.

3. **Import e caricamento**
   - Gli articoli archiviati non vengono caricati nell'archivio operativo.
   - Le ricerche di corrispondenza durante l'import guidato ignorano gli articoli archiviati.

4. **i18n**
   - Aggiunte le nuove stringhe IT/EN/FR/ES/DE.

## Database
La migration `p0d1_inventory_archive` è già stata applicata al Supabase live dall'assistente.
**Non eseguire manualmente SQL.**

Aggiunge soltanto:
- `inventory_items.archived_at timestamptz NULL`
- indice parziale `inventory_items_team_active_name_idx`

## File da copiare nel progetto
- `app/inventory/page.tsx`
- `lib/i18n.ts`

I file SQL sono inclusi solo per versionamento/rollback.

## Test dopo deploy
1. Apri l'articolo di prova con giacenza 1.
2. `Rettifica` → quantità finale `0` → `Registra movimento`.
3. La giacenza deve diventare 0 e nello storico deve comparire una rettifica con delta `-1`.
4. Premi `Elimina` sull'articolo di prova.
5. Conferma: l'articolo deve sparire dall'archivio operativo.
6. Non deve comparire alcun errore.
