# P2.9.5.1.1 - PowerShell 5.1 UTF-8 BOM compatibility

Fix mirato per Windows PowerShell 5.1.

- `src.mjs` rimuove un eventuale UTF-8 BOM prima di fare `JSON.parse()` su config/state.
- `Install-AiM-Bridge.ps1` scrive `config.json` usando `UTF8Encoding(false)`, quindi UTF-8 senza BOM.
- Bridge version: `p2.9.5.1.1`.
- Nessuna modifica DB/API.
