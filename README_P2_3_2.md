# P2.3.2 – Smart Day Grouping

- Raggruppa le sessioni `track` dello stesso team, giorno e circuito in un unico Evento/Test.
- Ogni uscita pista resta un turno separato.
- `connected_day_key` sull'evento protegge da duplicazioni concorrenti.
- `day_group_key` rende tracciabile il gruppo sulla sessione connessa.
- Il nuovo turno eredita direttamente il `default_driver_id` del device.
- La pagina Mezzi connessi espone il riepilogo delle giornate pista automatiche.

Le migration sono già applicate al database live. Non eseguire SQL manualmente: i file sono inclusi per allineare il repository.
