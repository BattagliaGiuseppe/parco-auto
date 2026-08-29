# P2.9.4.4 — AiM Production Import Policy

Production gate per il bridge AiM XRK/XRZ.

- policy: `aim_track_session_strict_v1`
- timing ufficiale obbligatorio: `aim_official_dll`
- normalizzazione obbligatoria: OUT + timed laps + IN, confidence high
- coerenza temporale e lap-table verificata prima dell'Official Ingest
- SHA-256 e file size salvati nei metadata per audit/idempotenza
- driver/vehicle mancanti = warning, non blocco
- installer DLL aggiornato con staging delle dipendenze x64 validato durante P2.9.4.3.2

Nessuna migration DB. Nessuna modifica alle API web.
