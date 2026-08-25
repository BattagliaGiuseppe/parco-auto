# P2.5 – Automatic Lap Detection & Timing

## Cosa aggiunge
- Lap Gate GPS configurabile per circuito (latitudine, longitudine, raggio, tempo minimo giro).
- Rilevamento passaggi start/finish durante l'ingest stream P2.4.
- Primo passaggio = armamento cronometro; passaggi successivi = giri completi.
- Scrittura automatica in connected_session_laps.
- Aggiornamento automatico di laps_count, best_lap_seconds, event_car_turns.laps e metriche turno.
- Protezione anti-jitter tramite ingresso nel gate da esterno + tempo minimo giro.

## Deploy
Le migration sono già applicate sul database live. Copiare i file nel repository e fare commit/push. Non eseguire SQL manualmente.

## Compatibilità
L'endpoint /api/connected/stream non cambia formato. Se un circuito non ha Lap Gate configurato, P2.4 continua a segmentare normalmente ma non calcola automaticamente i tempi giro.
