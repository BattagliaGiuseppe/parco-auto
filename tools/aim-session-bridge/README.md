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
