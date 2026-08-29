import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAimSession } from "./lib/aim-parser.mjs";
import { AIM_PRODUCTION_POLICY_ID, attachAimProductionImportPolicy } from "./lib/production-import-policy.mjs";

const BRIDGE_VERSION = "p2.9.4.4";
const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const once = process.argv.includes("--once");
const dryRun = process.argv.includes("--dry-run");
const explicitFile = argValue("--file");
const configPath = resolve(argValue("--config") || join(__dirname, "config.json"));

if (!existsSync(configPath)) {
  console.error(`Config non trovato: ${configPath}`);
  console.error("Copia config.example.json in config.json e configura watchFolders/device key.");
  process.exit(2);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const apiBaseUrl = String(config.apiBaseUrl || "https://motorsportmanagement.vercel.app").replace(/\/$/, "");
const deviceKey = process.env[String(config.deviceKeyEnv || "MM_DEVICE_KEY")] || config.deviceKey;
if (!deviceKey || String(deviceKey).length < 20) {
  console.error(`Device Key mancante. Imposta ${config.deviceKeyEnv || "MM_DEVICE_KEY"} oppure deviceKey nel config.`);
  process.exit(2);
}

const stableMs = Math.max(5000, Number(config.stableSeconds || 15) * 1000);
const scanIntervalMs = Math.max(2000, Number(config.scanIntervalSeconds || 5) * 1000);
const recursive = config.recursive !== false;
const allowUnvalidatedTimingProvider = config.allowUnvalidatedTimingProvider === true;
const timingProvider = String(config.timingProvider || "auto");
const productionImportPolicy = String(config.productionImportPolicy || AIM_PRODUCTION_POLICY_ID);
if (productionImportPolicy !== AIM_PRODUCTION_POLICY_ID) {
  console.error(`Production Import Policy non supportata: ${productionImportPolicy}. Attesa: ${AIM_PRODUCTION_POLICY_ID}`);
  process.exit(2);
}
const aimDllPath = String(config.aimDllPath || process.env.MM_AIM_DLL_PATH || "");
const statePath = resolve(isAbsolute(config.stateFile || "") ? config.stateFile : join(__dirname, config.stateFile || ".mm-aim-bridge-state.json"));

function loadState() {
  try { return JSON.parse(readFileSync(statePath, "utf8")); }
  catch { return { version: 1, files: {} }; }
}
function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function listAimFiles(folder) {
  const out = [];
  if (!existsSync(folder)) return out;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = join(folder, entry.name);
    if (entry.isDirectory() && recursive) out.push(...listAimFiles(full));
    else if (entry.isFile() && [".xrk", ".xrz"].includes(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function upload(filePath, state) {
  const fileStat = statSync(filePath);
  const now = Date.now();
  const previous = state.files[filePath] || {};
  const signature = `${fileStat.size}:${fileStat.mtimeMs}`;

  if (!explicitFile) {
    if (previous.signature !== signature) {
      state.files[filePath] = { ...previous, signature, stableSince: now, status: "waiting_stable" };
      return { status: "waiting", reason: "file_changed" };
    }
    if (!previous.stableSince || now - previous.stableSince < stableMs) return { status: "waiting", reason: "stabilizing" };
    if (previous.status === "uploaded" && previous.signature === signature) return { status: "skip", reason: "already_uploaded" };
  }

  const buffer = readFileSync(filePath);
  const hash = sha256(buffer);
  const externalBatchId = `aim-xrk:${hash}`;
  if (previous.hash === hash && previous.status === "uploaded") return { status: "skip", reason: "same_hash" };

  console.log(`\n[${new Date().toISOString()}] AiM session: ${filePath}`);
  const parsed = parseAimSession(buffer, { fileName: filePath.split(/[\\/]/).pop(), fileStat, filePath, timingProvider, aimDllPath });
  const audited = attachAimProductionImportPolicy({
    ...parsed.payload,
    metadata: {
      ...(parsed.payload?.metadata || {}),
      source_file_sha256: hash,
      source_file_size_bytes: fileStat.size,
    },
  });
  parsed.payload = audited.payload;
  const productionPolicy = audited.decision;
  const lapNormalization = parsed.payload?.metadata?.lap_normalization || null;
  console.log(`  giri cronometrati=${parsed.payload.laps_count} track=${parsed.payload.track_seconds}s engine=${parsed.payload.engine_seconds ?? "n/d"}s`);
  if (lapNormalization) {
    console.log(`  lap normalization=${lapNormalization.method} confidence=${lapNormalization.confidence} raw=${lapNormalization.raw_segments} timed=${lapNormalization.timed_laps}`);
    if (lapNormalization.out_lap) console.log(`  OUT=${lapNormalization.out_lap.duration_seconds}s`);
    if (lapNormalization.in_lap) console.log(`  IN=${lapNormalization.in_lap.duration_seconds}s`);
  }
  console.log(`  maxSpeed=${parsed.payload.max_speed ?? "n/d"} km/h maxRPM=${parsed.payload.max_rpm ?? "n/d"}`);
  console.log(`  production policy=${productionPolicy.id} status=${productionPolicy.status}`);
  if (productionPolicy.warnings.length) console.log(`  warnings=${productionPolicy.warnings.join(",")}`);
  if (productionPolicy.blocking_reasons.length) console.log(`  BLOCK=${productionPolicy.blocking_reasons.join(",")}`);

  if (dryRun) {
    console.log(JSON.stringify({ external_batch_id: externalBatchId, production_import_policy: productionPolicy, payload: parsed.payload }, null, 2));
    return { status: "dry_run", productionPolicy };
  }

  // P2.9.4.4: production import policy is the final fail-closed gate.
  // Warnings are auditable but do not block (e.g. missing driver/vehicle in XRK);
  // any failed structural/timing check keeps the file out of Official Ingest.
  if (productionPolicy.automatic_official_ingest !== true) {
    throw new Error(
      `Production Import Policy bloccata (${productionPolicy.id}): ` +
      `${productionPolicy.blocking_reasons.join(", ") || "unknown_reason"}. Usa --dry-run per la diagnosi.`
    );
  }

  // P2.9.4.1: nessun Official Ingest automatico se la lap table non può
  // essere normalizzata con alta confidenza. In quel caso si usa --dry-run
  // per la diagnosi e il file resta fuori dal database ufficiale.
  if (lapNormalization && lapNormalization.confidence !== "high") {
    throw new Error(`Lap normalization non sicura (${lapNormalization.confidence}). Official Ingest bloccato.`);
  }

  // P2.9.4.2: il parser aim-xrk resta disponibile per dry-run e diagnostica,
  // ma non e' considerato provider timing certificato per l'Official Ingest.
  // Il confronto sul file reale Vallelunga ha mostrato 0/+-1 ms sui giri
  // stabilizzati, ma scarti maggiori su OUT/primi giri/IN rispetto a Race Studio.
  // Per default attendiamo quindi il provider basato sulla DLL ufficiale AiM.
  const timingValidation = parsed.payload?.metadata?.timing_validation || null;
  if (timingValidation && timingValidation.official_ingest_ready !== true && !allowUnvalidatedTimingProvider) {
    throw new Error(
      `Timing provider non ancora validato per Official Ingest (${timingValidation.provider || "unknown"}). ` +
      `Usa --dry-run oppure il futuro provider AiM DLL.`
    );
  }

  const response = await fetch(`${apiBaseUrl}/api/connected/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-key": String(deviceKey),
      "x-logger-adapter": "aim_race_studio_v1",
    },
    body: JSON.stringify({ external_batch_id: externalBatchId, payload: parsed.payload }),
  });
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : null; }
  catch { result = { raw: text }; }

  if (!response.ok) {
    state.files[filePath] = { ...previous, signature, stableSince: previous.stableSince || now, hash, status: "error", error: result, lastAttemptAt: new Date().toISOString() };
    throw new Error(`Official Ingest ${response.status}: ${JSON.stringify(result)}`);
  }

  state.files[filePath] = {
    signature,
    stableSince: previous.stableSince || now,
    hash,
    status: "uploaded",
    externalBatchId,
    uploadedAt: new Date().toISOString(),
    result,
  };
  console.log(`  OK session_id=${result?.session_id || "?"} duplicate=${Boolean(result?.duplicate)} hours=${result?.hours_applied ?? "?"}`);
  return { status: "uploaded", result };
}

async function scan() {
  const state = loadState();
  const files = explicitFile
    ? [resolve(explicitFile)]
    : (config.watchFolders || []).flatMap((folder) => listAimFiles(resolve(folder)));
  files.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);

  for (const file of files) {
    try { await upload(file, state); }
    catch (error) { console.error(`  ERRORE ${file}: ${error instanceof Error ? error.message : error}`); }
    finally { saveState(state); }
  }
  if (!files.length) console.log(`[${new Date().toISOString()}] Nessun file AiM trovato.`);
}

console.log(`Motorsport Management AiM Session Bridge ${BRIDGE_VERSION}`);
console.log(`API: ${apiBaseUrl}`);
console.log(`Modalità: ${dryRun ? "DRY RUN" : once || explicitFile ? "ONE SHOT" : "WATCH"}`);
console.log(`Timing provider: ${timingProvider}`);
console.log(`Production Import Policy: ${productionImportPolicy}`);

await scan();
if (!once && !explicitFile) {
  setInterval(() => { scan().catch((error) => console.error(error)); }, scanIntervalMs);
}
