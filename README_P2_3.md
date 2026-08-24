# P2.3 - Circuit Detection & Smart Sessioning

- Distingue `track`, `engine_only`, `unknown`.
- Le sessioni `engine_only` aggiornano le ore ma non creano Eventi/Turni.
- Supporta `latitude`, `longitude`, `track_entry_at`, `track_exit_at` nel payload ingest.
- I circuiti possono avere geofence (`latitude`, `longitude`, `detection_radius_m`).
- Il GPS riconosce il circuito solo se la geofence e configurata.
- Piu turni dello stesso giorno/circuito riusano lo stesso Evento.

Le migration sono gia applicate sul Supabase live. Non eseguire SQL manualmente.
