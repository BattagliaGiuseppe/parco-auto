# P2.7.4 – Smartphone Logger Mode

## Cosa cambia
- In modalità `smartphone`, il Driver Display usa **ARMA GIORNATA** invece di `AVVIA GPS`.
- Una volta armato, il telefono resta in attesa e rileva automaticamente attività/circuito/turno.
- Le finestre vengono chiuse solo dopo una fase pista completa, evitando upload arbitrari che spezzerebbero giri o turni.
- Se la rete manca, le finestre complete restano in coda locale e vengono ritentate quando torna online.
- Il reference lap non è obbligatorio per registrare: serve solo per delta/live timing.
- In modalità `external_logger` e `hybrid`, il telefono resta display e non genera doppie ore.

## Ore smartphone
Senza RPM/ignition lo smartphone non può misurare vere ore motore da fermo. Le ore generate in modalità Smartphone sono quindi marcate nel ledger come:
- `hours_basis = gps_activity_estimate`
- `engine_time_estimated = true`

Quando arriverà un segnale RPM/ignition via Bluetooth/CAN/OBD potremo sostituire la stima con ore motore misurate.

## Limite versione web
Su iPhone/Safari/PWA la pagina deve restare attiva per garantire la raccolta GPS. La futura app nativa/Capacitor servirà per background logging affidabile.

## Database
La migration è già applicata live:
- `20260828201356_p2_smartphone_logger_mode`

Non eseguire SQL manuale.
