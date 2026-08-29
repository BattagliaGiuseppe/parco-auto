# P2.9.2 - AiM / Race Studio Adapter v1

Adapter ID: `aim_race_studio_v1`

Selezione:

`x-logger-adapter: aim_race_studio_v1`

## Scopo

Traduce payload JSON generati da un bridge/gateway/exporter AiM/Race Studio nel contratto canonico della piattaforma.
Non legge direttamente file proprietari `.xrk` e non implementa un protocollo hardware proprietario AiM.

## Live State

Alias supportati includono, tra gli altri:

- `GPS Speed`, `gpsspeed`, `vehicle speed` -> `speed_kph`
- `RSV4 RPM`, `RPM`, `engine rpm` -> `rpm`
- `RSV4 Gear`, `Gear`, `gear position` -> `gear`
- `Lap`, `Lap Number` -> `lap_number`
- `Lap Time`, `Current Lap Time` -> `current_lap_seconds`
- `Last Lap Time` -> `last_lap_seconds`
- `Best Lap Time` -> `best_lap_seconds`
- `Delta`, `Lap Delta`, `Predictive Delta` -> `delta_seconds`

Il payload può contenere i canali al primo livello o in `data`, `values`, `channels`, `telemetry`, `sample`.

## Official Session

Supporta session start/end, engine/track time, riepilogo giri, array `laps`, best lap, max speed, max RPM, GPS e circuito.
I singoli giri possono usare nomi AiM come `Lap`, `Lap Time`, `GPS Speed`.

La pipeline P2.8 continua a gestire authority, idempotenza, riconciliazione e ore.
