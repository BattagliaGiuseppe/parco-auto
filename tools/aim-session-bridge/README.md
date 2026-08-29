# P2.9.4 – AiM Session Auto-Import Bridge

Bridge locale per importare automaticamente sessioni AiM `.xrk` / `.xrz` nella Motorsport Management Platform.

## Perché esiste

Race Studio 3 conserva i file di sessione AiM sul PC. Il bridge controlla una o più cartelle, attende che il file sia stabile, lo legge e invia **solo il riepilogo ufficiale della sessione** all'endpoint P2.8.2.

Flusso:

`AiM logger → Race Studio 3 / file XRK → bridge locale → aim_race_studio_v1 → Official Ingest → sessione/giri/ore`

Il Live Display resta un canale separato.

## Parser

La logica di parsing è isolata in `lib/aim-parser.mjs`. La prima implementazione usa `aim-xrk` 0.1.1 (MIT), così il bridge non redistribuisce DLL AiM e rimane semplice da testare. Prima dell'uso produttivo i risultati vanno confrontati su file reali con Race Studio e, dove necessario, con la DLL ufficiale AiM. Il resto del bridge non dipende dal parser e può essere sostituito in seguito.

## Installazione di sviluppo

Richiede Node.js 22+.

1. Apri PowerShell nella cartella `tools/aim-session-bridge`.
2. Esegui `npm install`.
3. Copia `config.example.json` in `config.json`.
4. In Race Studio 3 usa **Show file in Windows Explorer** oppure **Advanced → Change DB position / open current Database path** per individuare la cartella dove sono salvati i file sessione.
5. Inserisci quella cartella in `watchFolders`.
6. Per non salvare la Device Key su disco:

```powershell
$env:MM_DEVICE_KEY="LA_TUA_DEVICE_KEY"
```

## Primo test consigliato

Non invia nulla alla piattaforma:

```powershell
npm run dry-run -- --file "C:\percorso\sessione.xrk"
```

Il bridge stampa il payload che invierebbe: sessione, giri accettati, tempo pista, tempo motore ricavato da RPM, max speed e max RPM.

Quando il risultato è stato confrontato con Race Studio:

```powershell
npm run start -- --file "C:\percorso\sessione.xrk"
```

Per la modalità automatica:

```powershell
npm start
```

## Sicurezze

- importa solo `.xrk` / `.xrz`;
- aspetta che il file non cambi per almeno `stableSeconds` (default 15 s);
- usa SHA-256 del file come `external_batch_id`, quindi reinviare lo stesso file non crea una seconda sessione;
- conserva uno stato locale in `.mm-aim-bridge-state.json`;
- non carica ancora il raw XRK nel cloud: P2.9.4 invia solo il summary ufficiale;
- non modifica la session authority: il backend P2.8 resta l'autorità finale;
- se il device non è `external_logger`/`hybrid` con authority logger, l'Official Ingest viene rifiutato.

## Dati calcolati

- giri: dalla lap table XRK, con filtro per eliminare out-lap/in-lap evidenti;
- best lap: non viene forzato; P2.8.2 lo ricava dai giri accettati;
- RPM: sceglie un canale sano tra alias comuni;
- engine seconds: integra gli intervalli con RPM > 500;
- max speed: viene inviata solo quando l'unità del canale è riconosciuta;
- track seconds: somma dei giri accettati;
- timestamp: preferisce data/ora metadata AiM, altrimenti usa il `mtime` del file come fallback e lo segnala nei metadata.

## Limiti P2.9.4

Questa è la prima versione del **session bridge**, non il bridge Live Measures. Prima di renderla installabile come servizio Windows dobbiamo validarla con almeno un file XRK reale del team e confrontare: numero giri, best lap, durata, RPM, velocità e ore motore con Race Studio.

## P2.9.4.1 – Normalizzazione giri Race Studio

Dopo la validazione su un file XRK reale, il bridge tratta la lap table AiM come Race Studio:

`OUT + giri cronometrati + IN`

Con una sequenza LAP consecutiva il primo e l'ultimo segmento non vengono più inviati come giri ufficiali. `laps_count` contiene solo i giri cronometrati, mentre `track_seconds` include l'intera finestra OUT + timed + IN.

Il payload contiene in `metadata.lap_normalization` metodo, confidence, conteggi raw/timed e riepilogo OUT/IN. Se la confidence non è `high`, l'Official Ingest automatico viene bloccato; usa `--dry-run` per diagnosticare il file.

Test della regola di normalizzazione:

```powershell
npm run test:lap-normalization
```


## P2.9.4.2 — Timing provider safety

Il parser `aim-xrk` resta il provider portabile per analisi e `--dry-run`, ma l'Official Ingest e' bloccato per default finche' il timing non viene validato tramite la DLL ufficiale AiM.

Sul file reale Vallelunga usato per la validazione, i messaggi LAP XRK e Race Studio coincidono entro 0/±1 ms sui giri stabilizzati, mentre OUT, i primi giri e IN possono mostrare differenze maggiori. Il bridge non applica correzioni artificiali ai tempi.

`allowUnvalidatedTimingProvider: true` esiste solo come override tecnico esplicito e non e' consigliato in produzione.

## P2.9.4.3 — Provider DLL ufficiale AiM

Su Windows il bridge può usare la DLL ufficiale AiM come sorgente autoritativa di timing.

1. Esegui una volta:

```powershell
.\\native\\install-aim-official-dll.ps1
```

Lo script scarica l'example package direttamente dal dominio ufficiale AiM e copia la DLL x64 in `native/vendor/MatLabXRK.dll`. La DLL non viene inclusa nel repository.

2. Lascia `"timingProvider": "auto"` (consigliato) oppure imposta `"aim_official_dll"`.

In `auto`, su Windows con DLL presente viene usato `get_lap_info` della DLL AiM per i tempi ufficiali e i campioni DLL per RPM/velocità/engine time. Senza DLL il bridge ricade su `aim-xrk`, ma P2.9.4.2 continua a bloccare l'Official Ingest non validato.

È possibile usare una DLL già presente impostando `MM_AIM_DLL_PATH` oppure `aimDllPath` in `config.json`.

## P2.9.4.4 — Production Import Policy

L'import automatico usa la policy fail-closed `aim_track_session_strict_v1`.
Una sessione AiM entra nell'Official Ingest solo se:

- il timing provider e' `aim_official_dll` ed e' marcato ready;
- la lap table e' normalizzata con `race_studio_boundary_semantics_v1` e confidenza `high`;
- OUT e IN sono presenti e separati dai giri cronometrati;
- i giri ufficiali sono numerati 1..N, univoci e con tempi validi;
- `track_seconds` e' coerente con OUT + timed laps + IN;
- track/engine time restano dentro la finestra temporale della sessione;
- max speed e max RPM, se presenti, restano nei limiti plausibili.

Driver e vehicle mancanti nell'XRK sono warning e non bloccano: la piattaforma puo'
ricavarli dal connected device / evento. La decisione completa viene salvata in
`metadata.production_import_policy` insieme a SHA-256 e dimensione del file sorgente.

La DLL AiM viene installata conservando il pacchetto ufficiale e creando uno staging
x64 con le dipendenze native. Il percorso runtime viene salvato in
`native/vendor/dll-path.txt`.

## P2.9.5.1 — Windows Production UX Foundation

Questa versione trasforma il watcher validato in un processo Windows installabile per utente, senza richiedere che la Device Key venga reinserita a ogni sessione.

### Installazione

Da un pacchetto del bridge estratto su Windows avvia:

```text
INSTALL_WINDOWS.bat
```

Il setup:

- installa il bridge in `%LOCALAPPDATA%\MotorsportManagement\AiMBridge`;
- installa un runtime Node.js x64 portabile locale se non è già incluso nel pacchetto;
- installa le dipendenze npm del bridge;
- scarica il provider DLL direttamente dal pacchetto ufficiale AiM;
- chiede di selezionare la cartella Race Studio contenente XRK/XRZ;
- acquisisce la Device Key in modalità nascosta e la salva cifrata con Windows DPAPI;
- registra l'avvio automatico nel profilo dell'utente Windows;
- crea collegamenti Start per stato, avvio, arresto e disinstallazione.

La Device Key non viene scritta in chiaro nel `config.json`, nei log o nella riga di comando del processo Node.

### Baseline di sicurezza

Al primo avvio in modalità WATCH, `ignoreExistingOnFirstRun=true` registra tutti gli XRK/XRZ già presenti come `baseline_ignored` e **non li importa**. Da quel momento vengono elaborate solo nuove sessioni o file realmente modificati.

Questo evita che l'installazione del bridge su un PC Race Studio già in uso importi automaticamente lo storico precedente.

### Stato e log

Il bridge scrive uno status machine-readable in `data\status.json` e un log locale in `data\bridge.log`.
Lo status include PID, versione, ultima scansione, ultimo import riuscito, ultimo errore e conteggi di file baseline/importati/in attesa/errore.

Dal menu Start usa **AiM Bridge - Stato** per visualizzare lo stato e le ultime righe di log.

### Retry controllato

Gli errori non vengono ritentati ogni 5 secondi. Il watcher applica backoff esponenziale configurabile tramite:

- `retryBaseSeconds` (default 60 s)
- `retryMaxSeconds` (default 3600 s)

L'idempotenza server-side SHA-256 resta l'ultima protezione contro import duplicati.
