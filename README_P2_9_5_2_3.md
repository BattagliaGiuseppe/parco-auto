# P2.9.5.2.3 — UI Multi-Car Mapping

Questa patch aggiunge la gestione amministrativa del routing AiM multi-auto nella pagina **Mezzi connessi**.

## Funzioni introdotte

- registrazione di un **AiM Bridge** per team;
- generazione e rotazione di una **Bridge Key** (mostrata una sola volta, hash nel DB);
- selezione dei logger autorizzati per ciascun bridge;
- coda XRK con stati `needs_mapping`, `conflict`, `blocked`, `resolved`;
- associazione manuale atomica **Vehicle Race Studio → vettura → logger**;
- binding di `serial_number` / `external_device_id` quando presenti nell'identità XRK;
- conversione controllata da `fixed_car` a `assignment_history` quando un logger viene spostato tra vetture;
- visualizzazione degli alias Vehicle e delle assegnazioni logger correnti.

## Sicurezza

La UI non abilita l'Official Ingest e non importa sessioni. Dopo un mapping manuale l'osservazione resta `needs_mapping` con `reason_code = mapping_configured_retry_required`: il bridge deve rieseguire il Server Resolver e ottenere `resolved` prima che un futuro ingest possa proseguire.

Le operazioni di scrittura richiedono `devices.edit`. Le letture usano le RLS già presenti sulle tabelle di routing.

## Migration live

Già applicate sul progetto Supabase live:

- `20260917105848_p2_9_5_2_3_bridge_admin.sql`
- `20260917105920_p2_9_5_2_3_routing_mapping.sql`

Non eseguire SQL manualmente.

## Verifica eseguita

Collaudo transazionale con `ROLLBACK`:

- creazione bridge + Bridge Key: OK;
- rotazione Bridge Key: OK;
- allow-list logger: OK;
- mapping Vehicle → vettura → logger: OK;
- osservazione portata a `mapping_configured_retry_required`: OK;
- nessun residuo test dopo rollback;
- sessioni / ledger invariati a 13 / 13.

I file TSX modificati sono stati verificati con parsing/transpile TypeScript isolato. Il runtime locale usato per preparare la patch non contiene tutte le dipendenze Next del repository, quindi il build Next completo viene validato dal normale deploy Vercel.
