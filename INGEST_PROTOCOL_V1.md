# Connected Vehicle Ingest Protocol v1

Endpoint applicazione:

`POST /api/connected/ingest`

Header obbligatorio:

`x-device-key: mmp_...`

Body JSON:

```json
{
  "external_batch_id": "logger-session-2026-08-24-001",
  "payload": {
    "started_at": "2026-08-24T10:00:00+02:00",
    "ended_at": "2026-08-24T10:30:00+02:00",
    "engine_on_at": "2026-08-24T10:00:10+02:00",
    "engine_off_at": "2026-08-24T10:29:50+02:00",
    "engine_seconds": 1780,
    "track_seconds": 1500,
    "track_name": "Misano World Circuit",
    "laps_count": 3,
    "best_lap_seconds": 90.123,
    "max_speed": 212.4,
    "max_rpm": 12800,
    "points_count": 4500,
    "laps": [
      { "lap_number": 1, "lap_time_seconds": 92.100, "max_speed": 205.0 },
      { "lap_number": 2, "lap_time_seconds": 90.123, "max_speed": 212.4 },
      { "lap_number": 3, "lap_time_seconds": 91.400, "max_speed": 209.0 }
    ]
  }
}
```

## Regole
- `external_batch_id` è idempotente per device: lo stesso valore non applica due volte le ore.
- Il body è limitato a 256 KB: è un riepilogo/session manifest, non il raw ad alta frequenza.
- Il raw completo sarà caricato in Storage nel passo P2.2/2.3 e processato asincronamente.
- `engine_seconds` è la fonte per l'incremento automatico ore mezzo/componenti.
- La chiave device viene mostrata una sola volta; nel DB è memorizzato solo SHA-256.
