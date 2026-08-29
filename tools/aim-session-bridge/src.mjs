import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, mkdirSync, renameSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAimSession } from "./lib/aim-parser.mjs";
import { AIM_PRODUCTION_POLICY_ID, attachAimProductionImportPolicy } from "./lib/production-import-policy.mjs";

const BRIDGE_VERSION = "p2.9.5.1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const processStartedAt = new Date().toISOString();

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
const ignoreExistingOnFirstRun = config.ignoreExistingOnFirstRun !== false;
const retryBaseMs = Math.max(30, Number(config.retryBaseSeconds || 60)) * 1000;
const retryMaxMs = Math.max(retryBaseMs, Number(config.retryMaxSeconds || 3600) * 1000);
const allowUnvalidatedTimingProvider = config.allowUnvalidatedTimingProvider === true;
const timingProvider = String(config.timingProvider || "auto");
const productionImportPolicy = String(config.productionImportPolicy || AIM_PRODUCTION_POLICY_ID);
if (productionImportPolicy !== AIM_PRODUCTION_POLICY_ID) {
  console.error(`Production Import Policy non supportata: ${productionImportPolicy}. Attesa: ${AIM_PRODUCTION_POLICY_ID}`);
  process.exit(2);
}
const aimDllPath = String(config.aimDllPath || process.env.MM_AIM_DLL_PATH || "");
const statePath = resolve(isAbsolute(config.stateFile || "") ? config.stateFile : join(__dirname, config.stateFile || ".mm-aim-bridge-state.json"));
const statusPath = resolve(isAbsolute(config.statusFile || "") ? config.statusFile : join(__dirname, config.statusFile || ".mm-aim-bridge-status.json"));

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeJsonAtomic(filePath, value) {
  ensureParent(filePath);
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, filePath);
}

function loadState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8"));
    return { version: 2, initializedAt: null, files: {}, ...parsed, files: parsed?.files || {} };
  } catch {
    return { version: 2, initializedAt: null, files: {} };
  }
}
function saveState(state) {
  writeJsonAtomic(statePath, state);
}

let bridgeStatus = {
  bridgeVersion: BRIDGE_VERSION,
  pid: process.pid,
  processStartedAt,
  mode: dryRun ? "dry_run" : once || explicitFile ? "one_shot" : "watch",
  state: "starting",
  apiBaseUrl,
  timingProvider,
  productionImportPolicy,
  lastScanAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  lastFile: null,
  discoveredFiles: 0,
  waitingFiles: 0,
  baselineIgnoredFiles: 0,
  uploadedFiles: 0,
  errorFiles: 0,
};

function updateStatus(patch = {}) {
  bridgeStatus = { ...bridgeStatus, ...patch, updatedAt: new Date().toISOString() };
  try { writeJsonAtomic(statusPath, bridgeStatus); }
  catch (error) { console.error(`Status file non scrivibile: ${error instanceof Error ? error.message : error}`); }
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

function fileSignature(filePath) {
  const st = statSync(filePath);
  return { stat: st, signature: `${st.size}:${st.mtimeMs}` };
}

function retryDelayMs(attempt) {
  const exp = Math.max(0, Math.min(16, Number(attempt || 1) - 1));
  return Math.min(retryMaxMs, retryBaseMs * (2 ** exp));
}

function markError(filePath, state, error) {
  const previous = state.files[filePath] || {};
  let signature = previous.signature;
  try { signature = fileSignature(filePath).signature; } catch {}
  const attempts = Number(previous.errorAttempts || 0) + 1;
  const delay = retryDelayMs(attempts);
  const message = error instanceof Error ? error.message : String(error);
  state.files[filePath] = {
    ...previous,
    signature,
    status: "error",
    errorAttempts: attempts,
    errorMessage: message,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + delay).toISOString(),
  };
  updateStatus({
    state: "error",
    lastErrorAt: new Date().toISOString(),
    lastError: message,
    lastFile: filePath,
  });
}

function initializeBaselineIfNeeded(state, files) {
  if (explicitFile || dryRun || !ignoreExistingOnFirstRun || state.initializedAt) return false;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let baselineCount = 0;
  for (const file of files) {
    try {
      const { signature } = fileSignature(file);
      state.files[file] = {
        signature,
        stableSince: now,
        status: "baseline_ignored",
        baselineAt: nowIso,
      };
      baselineCount += 1;
    } catch {}
  }
  state.version = 2;
  state.initializedAt = nowIso;
  state.baselineCount = baselineCount;
  saveState(state);
  console.log(`[${nowIso}] Baseline iniziale creata: ${baselineCount} file AiM esistenti ignorati.`);
  console.log("Da questo momento verranno importati automaticamente solo file nuovi o modificati.");
  updateStatus({ state: "idle", baselineIgnoredFiles: baselineCount, discoveredFiles: files.length, lastScanAt: nowIso });
  return true;
}

async function upload(filePath, state) {
  const { stat: fileStat, signature } = fileSignature(filePath);
  const now = Date.now();
  const previous = state.files[filePath] || {};

  if (!explicitFile) {
    if (previous.status === "baseline_ignored" && previous.signature === signature) {
      return { status: "skip", reason: "baseline_ignored" };
    }

    if (previous.signature !== signature) {
      state.files[filePath] = {
        signature,
        stableSince: now,
        status: "waiting_stable",
        errorAttempts: 0,
        errorMessage: null,
        nextRetryAt: null,
      };
      return { status: "waiting", reason: "file_changed" };
    }
    if (!previous.stableSince || now - previous.stableSince < stableMs) return { status: "waiting", reason: "stabilizing" };
    if (previous.status === "uploaded" && previous.signature === signature) return { status: "skip", reason: "already_uploaded" };
    if (previous.status === "error" && previous.nextRetryAt) {
      const nextRetry = Date.parse(previous.nextRetryAt);
      if (Number.isFinite(nextRetry) && nextRetry > now) return { status: "retry_wait", reason: "backoff", nextRetryAt: previous.nextRetryAt };
    }
  }

  const buffer = readFileSync(filePath);
  const hash = sha256(buffer);
  const externalBatchId = `aim-xrk:${hash}`;
  if (previous.hash === hash && previous.status === "uploaded") return { status: "skip", reason: "same_hash" };

  console.log(`\n[${new Date().toISOString()}] AiM session: ${filePath}`);
  updateStatus({ state: "processing", lastFile: filePath, lastError: null });

  const parsed = parseAimSession(buffer, { fileName: filePath.split(/[\\/]/).pop(), fileStat, filePath, timingProvider, aimDllPath });
  const audited = attachAimProductionImportPolicy({
    ...parsed.payload,
    metadata: {
      ...(parsed.payload?.metadata || {}),
      source_file_sha256: hash,
      source_file_size_bytes: fileStat.size,
      bridge_version: BRIDGE_VERSION,
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
    updateStatus({ state: "idle", lastFile: filePath });
    return { status: "dry_run", productionPolicy };
  }

  if (productionPolicy.automatic_official_ingest !== true) {
    throw new Error(
      `Production Import Policy bloccata (${productionPolicy.id}): ` +
      `${productionPolicy.blocking_reasons.join(", ") || "unknown_reason"}. Usa --dry-run per la diagnosi.`
    );
  }

  if (lapNormalization && lapNormalization.confidence !== "high") {
    throw new Error(`Lap normalization non sicura (${lapNormalization.confidence}). Official Ingest bloccato.`);
  }

  const timingValidation = parsed.payload?.metadata?.timing_validation || null;
  if (timingValidation && timingValidation.official_ingest_ready !== true && !allowUnvalidatedTimingProvider) {
    throw new Error(
      `Timing provider non ancora validato per Official Ingest (${timingValidation.provider || "unknown"}). ` +
      `Usa --dry-run oppure il provider AiM DLL.`
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
    const authHint = [401, 403].includes(response.status) ? " Verifica la Device Key/configurazione del device." : "";
    throw new Error(`Official Ingest ${response.status}: ${JSON.stringify(result)}.${authHint}`);
  }

  state.files[filePath] = {
    signature,
    stableSince: previous.stableSince || now,
    hash,
    status: "uploaded",
    externalBatchId,
    uploadedAt: new Date().toISOString(),
    errorAttempts: 0,
    errorMessage: null,
    nextRetryAt: null,
    result,
  };
  console.log(`  OK session_id=${result?.session_id || "?"} duplicate=${Boolean(result?.duplicate)} hours=${result?.hours_applied ?? "?"}`);
  updateStatus({
    state: "idle",
    lastSuccessAt: new Date().toISOString(),
    lastFile: filePath,
    lastError: null,
  });
  return { status: "uploaded", result };
}

function summarizeState(state) {
  const values = Object.values(state.files || {});
  return {
    baselineIgnoredFiles: values.filter((x) => x?.status === "baseline_ignored").length,
    uploadedFiles: values.filter((x) => x?.status === "uploaded").length,
    waitingFiles: values.filter((x) => x?.status === "waiting_stable").length,
    errorFiles: values.filter((x) => x?.status === "error").length,
  };
}

async function scan() {
  const state = loadState();
  const files = explicitFile
    ? [resolve(explicitFile)]
    : (config.watchFolders || []).flatMap((folder) => listAimFiles(resolve(folder)));
  files.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);

  const scanAt = new Date().toISOString();
  updateStatus({ state: "scanning", lastScanAt: scanAt, discoveredFiles: files.length });

  if (initializeBaselineIfNeeded(state, files)) return;

  for (const file of files) {
    try {
      const result = await upload(file, state);
      if (result?.status === "retry_wait") {
        const p = state.files[file];
        if (p?.nextRetryAt) console.log(`  Attesa retry ${file} fino a ${p.nextRetryAt}`);
      }
    } catch (error) {
      markError(file, state, error);
      console.error(`  ERRORE ${file}: ${error instanceof Error ? error.message : error}`);
    } finally {
      saveState(state);
    }
  }
  if (!files.length) console.log(`[${scanAt}] Nessun file AiM trovato.`);
  updateStatus({ state: bridgeStatus.state === "error" ? "error" : "idle", ...summarizeState(state), lastScanAt: scanAt, discoveredFiles: files.length });
}

console.log(`Motorsport Management AiM Session Bridge ${BRIDGE_VERSION}`);
console.log(`API: ${apiBaseUrl}`);
console.log(`Modalità: ${dryRun ? "DRY RUN" : once || explicitFile ? "ONE SHOT" : "WATCH"}`);
console.log(`Timing provider: ${timingProvider}`);
console.log(`Production Import Policy: ${productionImportPolicy}`);
console.log(`State: ${statePath}`);
console.log(`Status: ${statusPath}`);
console.log(`Baseline iniziale: ${ignoreExistingOnFirstRun ? "IGNORA FILE ESISTENTI" : "DISABILITATA"}`);

updateStatus({ state: "running" });

process.on("SIGINT", () => {
  updateStatus({ state: "stopped", stoppedAt: new Date().toISOString() });
  process.exit(0);
});
process.on("SIGTERM", () => {
  updateStatus({ state: "stopped", stoppedAt: new Date().toISOString() });
  process.exit(0);
});

await scan();
if (!once && !explicitFile) {
  setInterval(() => { scan().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    updateStatus({ state: "error", lastErrorAt: new Date().toISOString(), lastError: message });
  }); }, scanIntervalMs);
  setInterval(() => updateStatus({}), 30000);
}
