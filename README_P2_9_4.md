# P2.9.4 – AiM Session Auto-Import Bridge

Aggiunge un bridge locale standalone in `tools/aim-session-bridge`.

Non modifica il runtime Next.js, il database o le API esistenti.

## Architettura scelta

AiM documenta ufficialmente l'accesso esterno ai file XRK/XRZ tramite DLL 32/64 bit e Race Studio 3 permette di aprire/spostare la posizione del database sessioni. P2.9.4 sfrutta quindi il file di sessione come confine stabile tra AiM e la piattaforma.

Per la prima validazione il parser è isolato e sostituibile; il bridge usa `aim-xrk` 0.1.1 (MIT). Dopo il confronto su XRK reale si potrà mantenere questo parser oppure aggiungere un provider Windows basato sulla DLL ufficiale AiM senza cambiare watcher, idempotenza o Official Ingest.

## Nessuna migration

P2.9.4 riusa:
- `x-device-key`
- `x-logger-adapter: aim_race_studio_v1`
- `/api/connected/ingest`
- idempotenza P2.8.2
- session authority P2.8.1/P2.8.3
