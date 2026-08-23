# P0-B.1 — Driver documents + TeamFile image UX

Patch codice successiva a P0-B Storage Isolation.

## Nessuna modifica database
Non eseguire SQL. Non modificare bucket o policy Supabase.

## File inclusi
- `components/TeamFileAsset.tsx`
- `lib/driverDocumentStorage.ts` (nuovo)
- `app/drivers/page.tsx`
- `app/drivers/[id]/page.tsx`

## Cosa corregge
1. Elimina il flash visibile dell'immagine fallback mentre viene generato l'URL firmato di `team-files`.
2. Unifica la lettura dei documenti pilota:
   - formato legacy: `file_url` / `storage_path` su `team-files`;
   - formato corrente: `file_path` su bucket privato `driver-documents`.
3. I nuovi documenti caricati dalla scheda singolo pilota vengono ora salvati nel bucket privato `driver-documents`, come già avveniva nell'Archivio Piloti.
4. `Apri file` funziona per entrambi i formati.
5. La scheda singolo pilota permette di modificare titolo, tipo, scadenza e opzionalmente sostituire il file.
6. La sostituzione file converte automaticamente quel documento al formato corrente `driver-documents` e rimuove il vecchio oggetto Storage dopo l'aggiornamento DB.
7. L'eliminazione prova a rimuovere anche il relativo file dallo Storage, sia legacy sia corrente.
8. Dall'Archivio Piloti il pulsante Modifica porta alla sezione documenti della scheda pilota.

## Installazione
Copia il contenuto di questa cartella nella root del progetto e sostituisci i file esistenti. Il file `lib/driverDocumentStorage.ts` va aggiunto.

## Test dopo deploy
1. Auto con foto: entrando nella pagina non deve più comparire per un istante la foto di default.
2. Scheda pilota: il documento legacy deve mostrare `Apri file` e aprirsi.
3. Documento recente con `file_path`: deve mostrare `Apri file` e aprirsi.
4. Cliccare `Modifica` su un documento, cambiare il titolo e salvare.
5. Modificare nuovamente lo stesso documento sostituendo il file; dopo refresh deve aprirsi il nuovo file.
6. Caricare un nuovo documento dalla scheda pilota; dopo refresh deve restare apribile.
