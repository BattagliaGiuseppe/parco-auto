# P2.9.5.1 — AiM Bridge Windows Production UX Foundation

## Obiettivo

Portare il bridge AiM validato end-to-end dal test manuale a un watcher Windows utilizzabile quotidianamente sul PC Race Studio.

## Novità

- setup Windows per-user (`INSTALL_WINDOWS.bat`);
- Device Key protetta con DPAPI, mai salvata in chiaro nel config;
- avvio automatico via `HKCU\...\Run`, senza privilegi amministratore;
- processo nascosto con mutex single-instance;
- selezione grafica cartella Race Studio;
- runtime Node x64 portabile installato localmente dal setup;
- installazione automatica provider DLL ufficiale AiM;
- baseline fail-safe dei file XRK/XRZ preesistenti;
- status JSON + log locale;
- collegamenti Start: Stato / Avvia / Arresta / Disinstalla;
- retry con exponential backoff per evitare loop aggressivi in caso di rete/API non disponibile.

## Protezione più importante

`ignoreExistingOnFirstRun=true` impedisce che una nuova installazione scansioni e importi lo storico Race Studio. Il primo scan crea soltanto la baseline; i file già presenti restano fuori dall'Official Ingest.

## Nessuna modifica backend

Nessun SQL, migration o modifica API. P2.9.5.1 usa l'Official Ingest, l'adapter AiM e la Production Import Policy già validati.

## File modificati/aggiunti

- `tools/aim-session-bridge/src.mjs`
- `tools/aim-session-bridge/config.example.json`
- `tools/aim-session-bridge/package.json`
- `tools/aim-session-bridge/README.md`
- `tools/aim-session-bridge/INSTALL_WINDOWS.bat`
- `tools/aim-session-bridge/STATUS_WINDOWS.bat`
- `tools/aim-session-bridge/windows/Install-AiM-Bridge.ps1`
- `tools/aim-session-bridge/windows/Run-AiM-Bridge.ps1`
- `tools/aim-session-bridge/windows/Start-AiM-Bridge.ps1`
- `tools/aim-session-bridge/windows/Stop-AiM-Bridge.ps1`
- `tools/aim-session-bridge/windows/Status-AiM-Bridge.ps1`
- `tools/aim-session-bridge/windows/Uninstall-AiM-Bridge.ps1`

## Test eseguiti

- `node --check` sui moduli bridge principali;
- test Production Import Policy: OK;
- validazione JSON di package/config: OK.

I flussi DPAPI, registry HKCU e start hidden richiedono il successivo collaudo su Windows reale.
