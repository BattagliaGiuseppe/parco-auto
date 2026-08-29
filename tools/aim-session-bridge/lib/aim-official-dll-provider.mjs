import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeRoot = resolve(__dirname, "..");
const helperPath = join(bridgeRoot, "native", "read-aim-official.ps1");
const defaultDllPath = join(bridgeRoot, "native", "vendor", "MatLabXRK.dll");

function parseJsonOutput(stdout, stderr) {
  const text = String(stdout || "").trim();
  if (!text) throw new Error(`Provider AiM DLL non ha restituito JSON. ${String(stderr || "").trim()}`.trim());
  try { return JSON.parse(text); }
  catch {
    throw new Error(`Output non valido dal provider AiM DLL: ${text.slice(0, 500)}`);
  }
}

export function resolveAimDllPath(configuredPath = "") {
  const envPath = process.env.MM_AIM_DLL_PATH || "";
  const candidate = configuredPath || envPath || defaultDllPath;
  return resolve(candidate);
}

export function officialAimDllAvailable(configuredPath = "") {
  return process.platform === "win32" && existsSync(helperPath) && existsSync(resolveAimDllPath(configuredPath));
}

export function readAimOfficialDllSession(filePath, { dllPath = "" } = {}) {
  if (process.platform !== "win32") {
    throw new Error("Il provider AiM DLL ufficiale richiede Windows x64.");
  }
  if (!existsSync(helperPath)) throw new Error(`Helper AiM DLL non trovato: ${helperPath}`);
  const resolvedDll = resolveAimDllPath(dllPath);
  if (!existsSync(resolvedDll)) {
    throw new Error(
      `DLL AiM ufficiale non trovata: ${resolvedDll}. ` +
      `Esegui native\\install-aim-official-dll.ps1 oppure imposta MM_AIM_DLL_PATH.`
    );
  }

  const shell = process.env.ComSpec ? "powershell.exe" : "powershell";
  const run = spawnSync(shell, [
    "-NoProfile",
    "-NonInteractive",
    "-File", helperPath,
    "-FilePath", resolve(filePath),
    "-DllPath", resolvedDll,
  ], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (run.error) throw run.error;
  if (run.status !== 0) {
    throw new Error(`Provider AiM DLL fallito (${run.status}): ${String(run.stderr || run.stdout || "").trim()}`);
  }
  const result = parseJsonOutput(run.stdout, run.stderr);
  if (!result?.ok) throw new Error(result?.error || "Provider AiM DLL ha restituito esito negativo.");
  return result;
}
