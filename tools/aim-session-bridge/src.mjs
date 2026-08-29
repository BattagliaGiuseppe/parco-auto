import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAimSession } from "./lib/aim-parser.mjs";

const BRIDGE_VERSION = "p2.9.4";
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
  const parsed = parseAimSession(buffer, { fileName: filePath.split(/[\\/]/).pop(), fileStat });
  console.log(`  giri=${parsed.payload.laps_count} track=${parsed.payload.track_seconds}s engine=${parsed.payload.engine_seconds ?? "n/d"}s`);
  console.log(`  maxSpeed=${parsed.payload.max_speed ?? "n/d"} km/h maxRPM=${parsed.payload.max_rpm ?? "n/d"}`);

  if (dryRun) {
    console.log(JSON.stringify({ external_batch_id: externalBatchId, payload: parsed.payload }, null, 2));
    return { status: "dry_run" };
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

await scan();
if (!once && !explicitFile) {
  setInterval(() => { scan().catch((error) => console.error(error)); }, scanIntervalMs);
}
