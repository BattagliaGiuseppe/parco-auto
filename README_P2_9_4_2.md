# P2.9.4.2 — AiM Timing Provider Safety

Questa patch non cambia la pipeline cloud e non richiede SQL.

## Perché

Sul file XRK reale `20260419_094229_rossa_passarelli_vallelunga_a_0493.xrk` i messaggi LAP contengono durate intere in millisecondi. Il parser `aim-xrk` le espone fedelmente. Race Studio mostra tuttavia una propria temporizzazione: sui giri stabilizzati lo scarto è 0/±1 ms, mentre su OUT, primi giri e IN lo scarto può essere maggiore.

Non viene quindi introdotta alcuna correzione empirica.

## Regola

- `aim-xrk`: valido per dry-run/diagnostica.
- Official Ingest automatico: bloccato per default.
- Provider di produzione previsto: DLL ufficiale AiM MatLabXRK su Windows.

L'override `allowUnvalidatedTimingProvider: true` è intenzionalmente esplicito e non consigliato.
