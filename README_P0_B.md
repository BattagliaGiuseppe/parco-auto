# PATCH P0-B — Storage Isolation (`team-files`)

## Scopo
Rendere `team-files` privato e isolato per team senza spostare/cancellare file e senza rompere gli URL storici già salvati nel database.

## Stato live verificato prima della patch
- bucket `team-files`: **public = true**
- oggetti presenti: **13**
- oggetti con prefisso team UUID non valido: **0**
- oggetti con prefisso UUID non corrispondente a un team esistente: **0**
- tutti gli oggetti sono già nel formato `<team_id>/<area>/<record>/<file>`
- policy legacy: SELECT/INSERT/UPDATE/DELETE limitate solo a `bucket_id = 'team-files'`, senza isolamento team
- riferimenti legacy `.../object/public/team-files/...` rilevati nel DB:
  - `cars.image_url`: 1
  - `drivers.photo_url`: 1
  - `driver_documents.file_url`: 1
  - `telemetry_files.file_url`: 2
  - `documents.file_url`: 0
  - `app_settings.dashboard_layout`: 0

## Modifica client
- `uploadTeamFile()` continua a salvare il file sotto il workspace attivo.
- I nuovi upload memorizzano un locator stabile `team-file://<path>` invece di un URL pubblico.
- Gli URL pubblici legacy già esistenti vengono riconosciuti automaticamente.
- Immagini e allegati `team-files` vengono aperti tramite URL firmati temporanei.
- Il client verifica che il primo segmento del path coincida con il workspace attivo prima di chiedere un signed URL.
- Link esterni normali (http/https non appartenenti a `team-files`) restano invariati.

## Modifica database
La migration:
1. imposta `storage.buckets.public = false` per `team-files`;
2. sostituisce le quattro policy legacy;
3. consente SELECT/INSERT/UPDATE/DELETE solo ad `authenticated` e solo quando il primo segmento del path è un UUID valido di un team di cui `auth.uid()` è membro.

Non modifica tabelle applicative, non rinomina file e non cancella oggetti.

## Ordine operativo OBBLIGATORIO
1. **Deploy prima dei file client di questa patch.**
2. Con bucket ancora pubblico, verificare dall'app almeno: immagine auto, foto pilota, apertura documento pilota, apertura file telemetria.
3. Solo dopo il deploy client, applicare `supabase/migrations/20260822_002_p0b_storage_isolation.sql`.
4. Eseguire/verificare il post-check.
5. Ripetere i test UI principali.

NON applicare la migration prima del deploy client.

## Rollback
Se la UI presenta regressioni dopo la migration:
- applicare `supabase/rollback/20260822_002_p0b_storage_isolation_rollback.sql`;
- il bucket torna pubblico e vengono ripristinate le policy legacy.

Il rollback DB non richiede rollback dei file client: il nuovo client è compatibile anche con bucket pubblico.

## Validazione eseguita sulla patch
- audit di tutti gli usi di `team-files` nello ZIP caricato;
- nessun `href={row.file_url}` residuo per allegati protetti;
- nessun `<img>` residuo che consumi direttamente `cars.image_url` / `drivers.photo_url` di `team-files`;
- nessun nuovo caller usa `upload.publicUrl`; tutti i caller noti usano `upload.storageRef`;
- parser verificato sia con URL legacy Supabase sia con `team-file://`;
- controllo sintattico TypeScript sui file modificati: nessun errore di parsing TS1xxx. Il build completo non è stato eseguito perché lo ZIP non include `node_modules` e l'installazione dipendenze nel runtime non si è completata.
