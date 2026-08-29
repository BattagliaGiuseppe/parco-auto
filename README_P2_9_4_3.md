# P2.9.4.3 – Official AiM DLL Provider

- provider Windows x64 basato sulla DLL ufficiale AiM MatLabXRK;
- DLL non redistribuita nel repository: installer locale scarica il pacchetto dal dominio AiM;
- lap timing autoritativo da `get_lap_info`;
- max RPM, max speed ed engine seconds ricavati dai campioni letti tramite DLL;
- `timingProvider: auto` usa la DLL quando disponibile, altrimenti mantiene `aim-xrk` solo per dry-run;
- l'Official Ingest è `ready` soltanto quando il provider DLL è attivo;
- nessuna modifica a database/API web.
