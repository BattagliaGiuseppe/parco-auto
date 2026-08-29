# P2.9.4.1 – AiM Lap Normalization

Micro-evoluzione del bridge P2.9.4 dopo il confronto con un XRK reale e Race Studio 3.

## Problema risolto

La lap table XRK contiene anche i segmenti di confine della registrazione. Race Studio li presenta come:

`OUT + giri cronometrati + IN`

La versione P2.9.4 filtrava soprattutto per distanza e poteva quindi conteggiare l'IN lap come giro ufficiale quando la sua distanza era simile a un giro completo.

## Nuova normalizzazione

Quando la lap table XRK è completa e i numeri raw sono consecutivi:

- primo segmento = `OUT`;
- ultimo segmento = `IN`;
- solo i segmenti intermedi diventano `laps` ufficiali;
- i giri vengono rinumerati 1..N come in Race Studio;
- OUT e IN restano nei metadata diagnostici;
- `laps_count` conta solo i giri cronometrati;
- `track_seconds` conserva invece l'intera finestra pista `OUT + timed + IN`.

Se la lap table è anomala/non consecutiva, il parser passa a un fallback conservativo e abbassa la confidence. L'upload ufficiale è bloccato quando la confidence non è `high`; il file resta comunque analizzabile con `--dry-run`.

## Fixture di regressione

È stato aggiunto un test Node che replica la struttura validata in Race Studio:

- 15 segmenti raw;
- OUT;
- 13 giri cronometrati;
- IN;
- best lap: giro 8, 1:40.904.

Eseguire:

```powershell
npm run test:lap-normalization
```

## File modificati

- `tools/aim-session-bridge/lib/aim-parser.mjs`
- `tools/aim-session-bridge/lib/lap-normalization.mjs` (nuovo)
- `tools/aim-session-bridge/src.mjs`
- `tools/aim-session-bridge/package.json`
- `tools/aim-session-bridge/README.md`
- `tools/aim-session-bridge/test/lap-normalization.test.mjs` (nuovo)

Nessuna migration e nessuna modifica alle API/backend della webapp.
