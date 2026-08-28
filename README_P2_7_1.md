# P2.7.1 – Driver Display Circuit Selector

Fix UX: il pilota non deve inserire UUID tecnici.

- nuovo endpoint `GET /api/connected/circuits`, autenticato con `x-device-key`;
- `CIRCUIT ID` sostituito da selettore `CIRCUITO`;
- selezione automatica del circuito con reference disponibile quando possibile;
- nessun UUID visibile all'utente;
- migration già applicata live su Supabase.
