# P2.9.5.2.3.1 — Routing UI Permissions + Modal Contrast

Hotfix emerso dal primo collaudo reale della UI Multi-Car Routing.

## Correzioni
- aggiunge i `GRANT SELECT` mancanti al ruolo `authenticated` sulle tabelle routing lette direttamente dalla UI;
- mantiene la protezione RLS già presente (`devices.view` / `devices.edit`);
- **non** espone `connected_bridge_keys`: la Bridge Key completa continua a non essere leggibile dal client;
- rende esplicito il colore testo/placeholder dei campi `Nome bridge` e `Nome PC`, evitando testo chiaro su input bianco nel tema Race Control.

## Stato live
La migration è già applicata su Supabase live come:
`20260917112642_p2_9_5_2_3_1_routing_ui_permissions`.

Il bridge creato durante il test esiste già e la sua key hash è presente; la chiave completa non è recuperabile per design. Se non è stata copiata, usare `Ruota key` dopo il deploy.
