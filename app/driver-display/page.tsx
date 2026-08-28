"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Gauge, Maximize2, Play, Radio, RefreshCw, Settings2, Square, TimerReset, WifiOff } from "lucide-react";
import { LiveDeltaEngine, type ReferencePoint } from "@/lib/connected/live-delta";

type ReferenceResponse = {
  found: boolean;
  reference_id?: string;
  circuit_id?: string;
  lap_time_seconds?: number;
  points_count?: number;
  points?: ReferencePoint[];
  driver_id?: string | null;
  car_id?: string | null;
};

type DisplayConfig = {
  deviceKey: string;
  circuitId: string;
  gateRadiusM: number;
};

type DeviceCircuit = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  lap_gate_configured?: boolean;
  has_reference?: boolean;
};

type AcquisitionMode = "smartphone" | "external_logger" | "hybrid";
type RuntimeConfig = { device_id: string; car_id: string; name: string; source_type: string; acquisition_mode: AcquisitionMode; default_driver_id?: string | null };

type CircuitsResponse = {
  device_id?: string;
  car_id?: string;
  circuits?: DeviceCircuit[];
};

type GpsState = {
  lat: number;
  lon: number;
  speedKph: number;
  accuracyM: number;
  ts: number;
};

const CONFIG_KEY = "motorsport-driver-display-v1";
const EARTH_RADIUS_M = 6371000;

function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatLap(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "--:--.---";
  const value = Math.max(0, seconds);
  const min = Math.floor(value / 60);
  const sec = value - min * 60;
  return `${min}:${sec.toFixed(3).padStart(6, "0")}`;
}

function formatDelta(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "---";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : "±";
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}

export default function DriverDisplayPage() {
  const [config, setConfig] = useState<DisplayConfig>({ deviceKey: "", circuitId: "", gateRadiusM: 35 });
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [reference, setReference] = useState<ReferenceResponse | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [engine, setEngine] = useState<LiveDeltaEngine | null>(null);
  const [gps, setGps] = useState<GpsState | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);
  const [circuits, setCircuits] = useState<DeviceCircuit[]>([]);
  const [loadingCircuits, setLoadingCircuits] = useState(false);
  const [running, setRunning] = useState(false);
  const [lapStartedAt, setLapStartedAt] = useState<number | null>(null);
  const [lapElapsed, setLapElapsed] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [distanceToReference, setDistanceToReference] = useState<number | null>(null);
  const [lapNumber, setLapNumber] = useState(0);
  const [lastLap, setLastLap] = useState<number | null>(null);
  const [insideGate, setInsideGate] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState("Reference non caricato");
  const [focusMode, setFocusMode] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const previousGpsRef = useRef<GpsState | null>(null);
  const lapStartedAtRef = useRef<number | null>(null);
  const insideGateRef = useRef(false);
  const lapNumberRef = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<DisplayConfig>;
        setConfig({
          deviceKey: saved.deviceKey || "",
          circuitId: saved.circuitId || "",
          gateRadiusM: Number(saved.gateRadiusM) || 35,
        });
      }
    } catch {
      // configurazione locale non valida: uso i default
    }
  }, []);

  const referenceStart = useMemo(() => reference?.points?.[0] || null, [reference]);

  const saveConfig = useCallback((next: DisplayConfig) => {
    setConfig(next);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  }, []);

  const loadRuntimeConfig = useCallback(async () => {
    const deviceKey = config.deviceKey.trim();
    if (!deviceKey) { setRuntimeConfig(null); return; }
    try {
      const res = await fetch("/api/connected/runtime-config", { headers: { "x-device-key": deviceKey }, cache: "no-store" });
      const body = (await res.json()) as RuntimeConfig & { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setRuntimeConfig(body);
    } catch {
      setRuntimeConfig(null);
    }
  }, [config.deviceKey]);

  const loadCircuits = useCallback(async () => {
    const deviceKey = config.deviceKey.trim();
    if (!deviceKey) {
      setReferenceStatus("Inserisci prima la device key");
      return;
    }
    setLoadingCircuits(true);
    try {
      const res = await fetch("/api/connected/circuits", {
        headers: { "x-device-key": deviceKey },
        cache: "no-store",
      });
      const body = (await res.json()) as CircuitsResponse & { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const list = Array.isArray(body.circuits) ? body.circuits : [];
      setCircuits(list);
      if (!list.length) {
        setReferenceStatus("Nessun circuito configurato per questo team");
        return;
      }
      const currentIsValid = list.some((c) => c.id === config.circuitId);
      if (!currentIsValid) {
        const preferred = list.find((c) => c.has_reference) || list[0];
        saveConfig({ ...config, circuitId: preferred.id });
      }
      setReferenceStatus("Circuiti caricati");
    } catch (error) {
      setCircuits([]);
      setReferenceStatus(error instanceof Error ? error.message : "Errore caricamento circuiti");
    } finally {
      setLoadingCircuits(false);
    }
  }, [config, saveConfig]);

  const loadReference = useCallback(async () => {
    if (!config.deviceKey.trim() || !config.circuitId.trim()) {
      setReferenceStatus("Inserisci device key e circuito");
      return;
    }
    setLoadingReference(true);
    setReferenceStatus("Download reference...");
    try {
      const res = await fetch(`/api/connected/reference-lap?circuit_id=${encodeURIComponent(config.circuitId.trim())}`, {
        headers: { "x-device-key": config.deviceKey.trim() },
        cache: "no-store",
      });
      const body = (await res.json()) as ReferenceResponse & { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (!body.found || !body.points || body.points.length < 2) throw new Error("Reference lap non disponibile per questo circuito.");
      const nextEngine = new LiveDeltaEngine(body.points, { maxMatchDistanceM: 60 });
      setReference(body);
      setEngine(nextEngine);
      setReferenceStatus(`Reference ${formatLap(Number(body.lap_time_seconds || 0))} · ${body.points.length} punti`);
      setSettingsOpen(false);
    } catch (error) {
      setReference(null);
      setEngine(null);
      setReferenceStatus(error instanceof Error ? error.message : "Errore download reference");
    } finally {
      setLoadingReference(false);
    }
  }, [config.circuitId, config.deviceKey]);

  useEffect(() => {
    if (config.deviceKey.trim().length >= 20) {
      void loadRuntimeConfig();
      if (circuits.length === 0 && !loadingCircuits) void loadCircuits();
    } else {
      setRuntimeConfig(null);
    }
  }, [config.deviceKey, circuits.length, loadCircuits, loadRuntimeConfig, loadingCircuits]);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      // Wake Lock non supportato o negato: il display continua a funzionare.
    }
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setRunning(false);
    setGps(null);
    setDelta(null);
    setProgress(null);
    setDistanceToReference(null);
    previousGpsRef.current = null;
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (!engine || !reference || !referenceStart) {
      setReferenceStatus("Carica prima un reference lap valido");
      return;
    }
    const activeEngine = engine;
    const activeReference = reference;
    const activeReferenceStart = referenceStart;
    if (!navigator.geolocation) {
      setGpsError("GPS/geolocalizzazione non disponibile su questo dispositivo.");
      return;
    }
    if (watchIdRef.current != null) return;

    setGpsError(null);
    setRunning(true);
    void requestWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = position.timestamp || Date.now();
        const previous = previousGpsRef.current;
        let speedKph = position.coords.speed != null && Number.isFinite(position.coords.speed)
          ? Math.max(0, position.coords.speed * 3.6)
          : 0;

        if ((!speedKph || speedKph < 0.5) && previous && now > previous.ts) {
          const fallback = distanceM(previous, { lat: position.coords.latitude, lon: position.coords.longitude }) / ((now - previous.ts) / 1000) * 3.6;
          if (Number.isFinite(fallback)) speedKph = Math.max(0, fallback);
        }

        const nextGps: GpsState = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          speedKph,
          accuracyM: position.coords.accuracy,
          ts: now,
        };
        previousGpsRef.current = nextGps;
        setGps(nextGps);

        const gateDistance = distanceM(nextGps, activeReferenceStart);
        const nowInsideGate = gateDistance <= config.gateRadiusM;
        const wasInsideGate = insideGateRef.current;
        insideGateRef.current = nowInsideGate;
        setInsideGate(nowInsideGate);

        if (nowInsideGate && !wasInsideGate && speedKph >= 8) {
          if (lapStartedAtRef.current == null) {
            lapStartedAtRef.current = now;
            setLapStartedAt(now);
            lapNumberRef.current = Math.max(1, lapNumberRef.current || 1);
            setLapNumber(lapNumberRef.current);
            activeEngine.startLap(now);
          } else {
            const completed = (now - lapStartedAtRef.current) / 1000;
            const minCompleted = Math.max(5, Number(activeReference.lap_time_seconds || 20) * 0.35);
            if (completed >= minCompleted) {
              setLastLap(completed);
              lapNumberRef.current += 1;
              setLapNumber(lapNumberRef.current);
              lapStartedAtRef.current = now;
              setLapStartedAt(now);
              activeEngine.startLap(now);
            }
          }
        }

        if (lapStartedAtRef.current != null) {
          const result = activeEngine.update({ ts: now, lat: nextGps.lat, lon: nextGps.lon, speedKph });
          setLapElapsed(result.lapElapsedSeconds);
          setDelta(result.deltaSeconds);
          setProgress(result.progress);
          setDistanceToReference(result.distanceToReferenceM);
        }
      },
      (error) => {
        const message = error.code === 1
          ? "Permesso GPS negato. Abilita la posizione per questa pagina."
          : error.code === 2
            ? "Posizione GPS non disponibile."
            : "Timeout GPS.";
        setGpsError(message);
      },
      { enableHighAccuracy: true, maximumAge: 250, timeout: 10000 },
    );
  }, [config.gateRadiusM, engine, reference, referenceStart, requestWakeLock]);

  useEffect(() => () => stop(), [stop]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Alcuni browser iOS non espongono Fullscreen API.
    }
  }, []);

  const deltaTone = delta == null ? "text-white" : delta <= -0.01 ? "text-emerald-400" : delta >= 0.01 ? "text-red-400" : "text-white";
  const gpsQuality = gps == null
    ? { label: "GPS OFF", tone: "border-white/15 text-white/55" }
    : gps.accuracyM <= 10
      ? { label: "GPS OTTIMO", tone: "border-emerald-500/40 text-emerald-300" }
      : gps.accuracyM <= 20
        ? { label: "GPS BUONO", tone: "border-sky-400/40 text-sky-300" }
        : gps.accuracyM <= 35
          ? { label: "GPS DEBOLE", tone: "border-amber-400/40 text-amber-300" }
          : { label: "GPS SCARSO", tone: "border-red-500/40 text-red-300" };
  const guidanceCompact = running && focusMode;
  const acquisitionLabel = runtimeConfig?.acquisition_mode === "smartphone" ? "SMARTPHONE LOGGER" : runtimeConfig?.acquisition_mode === "hybrid" ? "IBRIDO" : runtimeConfig?.acquisition_mode === "external_logger" ? "LOGGER ESTERNO" : "MODALITÀ —";
  const startLabel = runtimeConfig?.acquisition_mode === "external_logger" || runtimeConfig?.acquisition_mode === "hybrid" ? "AVVIA DISPLAY" : "AVVIA GPS";

  return (
    <main className="min-h-[100dvh] bg-black text-white selection:bg-white/20">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1600px] flex-col p-3 sm:p-4">
        <header className={`flex items-center justify-between gap-3 border-b border-white/10 pb-3 ${guidanceCompact ? "landscape:py-1" : ""}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white/50">
              <Gauge className="h-4 w-4" /> Driver Display
            </div>
            <div className={`mt-1 truncate text-sm font-semibold text-white/80 ${guidanceCompact ? "landscape:hidden" : ""}`}>{referenceStatus}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden rounded-full border border-white/15 px-3 py-1.5 text-xs font-black tracking-wide text-white/65 md:block">{acquisitionLabel}</div>
            <div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold sm:flex ${gpsQuality.tone}`}>
              {gps ? <Radio className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {gps ? `${gpsQuality.label} · ±${Math.round(gps.accuracyM)} m` : gpsQuality.label}
            </div>
            <button onClick={() => setFocusMode((v) => !v)} className={`rounded-xl border p-2.5 ${focusMode ? "border-white/30 bg-white/10 text-white" : "border-white/15 text-white/60"}`} aria-label="Modalità guida compatta">
              {focusMode ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
            <button onClick={() => void toggleFullscreen()} className="rounded-xl border border-white/15 p-2.5 text-white/80 hover:bg-white/10" aria-label="Schermo intero"><Maximize2 className="h-5 w-5" /></button>
            <button onClick={() => setSettingsOpen((v) => !v)} className="rounded-xl border border-white/15 p-2.5 text-white/80 hover:bg-white/10" aria-label="Impostazioni"><Settings2 className="h-5 w-5" /></button>
          </div>
        </header>

        {settingsOpen && (
          <section className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[1.3fr_1fr_160px_auto] md:items-end">
            <label className="text-xs font-bold uppercase tracking-wider text-white/55">Device key
              <input type="password" value={config.deviceKey} onChange={(e) => saveConfig({ ...config, deviceKey: e.target.value })} placeholder="Chiave dispositivo" className="mt-1.5 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-white/40" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-white/55">Circuito
              <div className="mt-1.5 flex gap-2">
                <select value={config.circuitId} onChange={(e) => saveConfig({ ...config, circuitId: e.target.value })} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-white/40">
                  <option value="">Seleziona circuito</option>
                  {circuits.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.has_reference ? " · reference" : ""}</option>
                  ))}
                </select>
                <button type="button" onClick={() => void loadCircuits()} disabled={loadingCircuits || !config.deviceKey.trim()} className="rounded-xl border border-white/15 px-3 text-white/70 disabled:opacity-35" aria-label="Aggiorna circuiti">
                  <RefreshCw className={`h-4 w-4 ${loadingCircuits ? "animate-spin" : ""}`} />
                </button>
              </div>
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-white/55">Gate (m)
              <input type="number" min={5} max={250} value={config.gateRadiusM} onChange={(e) => saveConfig({ ...config, gateRadiusM: Math.max(5, Math.min(250, Number(e.target.value) || 35)) })} className="mt-1.5 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-white/40" />
            </label>
            <button disabled={loadingReference} onClick={() => void loadReference()} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-black disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loadingReference ? "animate-spin" : ""}`} /> Carica reference
            </button>
            {runtimeConfig && <div className="md:col-span-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/55"><span className="font-black text-white/80">{acquisitionLabel}</span> · {runtimeConfig.acquisition_mode === "smartphone" ? "Questo telefono sarà la sorgente di acquisizione nella modalità Logger Smartphone." : runtimeConfig.acquisition_mode === "hybrid" ? "Il logger esterno registra i dati; lo smartphone sarà display/video e potrà usare sensori locali come supporto." : "Il logger esterno è responsabile della registrazione. Il telefono è solo display e non deve essere avviato per salvare turni e ore."}</div>}
          </section>
        )}

        {gpsError && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{gpsError}</div>}

        <section className={`grid flex-1 gap-3 py-3 md:grid-cols-[1fr_1.55fr_1fr] ${guidanceCompact ? "landscape:grid-cols-[0.72fr_2.28fr] landscape:gap-2 landscape:py-2" : "landscape:grid-cols-[1fr_1.55fr_1fr]"}`}>
          <div className={`grid grid-cols-2 gap-3 landscape:grid-cols-1 md:grid-cols-1 ${guidanceCompact ? "landscape:gap-2" : ""}`}>
            <Metric label="LAP" value={lapNumber ? String(lapNumber) : "--"} sub={insideGate ? "START / FINISH" : "GIRO CORRENTE"} />
            <Metric label="SPEED" value={gps ? String(Math.round(gps.speedKph)) : "--"} unit="km/h" sub={gps ? `${gpsQuality.label} · ±${Math.round(gps.accuracyM)} m` : "ATTESA GPS"} />
          </div>

          <div className={`flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-6 text-center ${guidanceCompact ? "landscape:min-h-0 landscape:py-2" : ""}`}>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-white/45">Delta</div>
            <div className={`mt-2 font-mono text-[clamp(4.8rem,15vw,11rem)] font-black leading-none tracking-[-0.07em] ${deltaTone}`}>{formatDelta(delta)}</div>
            <div className="mt-5 font-mono text-[clamp(2rem,5vw,4rem)] font-bold tabular-nums">{formatLap(lapElapsed)}</div>
            <div className="mt-2 h-1.5 w-full max-w-xl overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-white transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(100, (progress || 0) * 100))}%` }} />
            </div>
            <div className="mt-2 text-xs font-semibold text-white/40">{progress == null ? "REFERENCE NON AGGANCIATO" : `${Math.round(progress * 100)}% · ${distanceToReference == null ? "—" : `${distanceToReference.toFixed(1)} m dal reference`}`}</div>
          </div>

          <div className={`grid grid-cols-2 gap-3 landscape:grid-cols-1 md:grid-cols-1 ${guidanceCompact ? "landscape:hidden" : ""}`}>
            <Metric label="REFERENCE" value={formatLap(reference?.lap_time_seconds == null ? null : Number(reference.lap_time_seconds))} compact sub={reference?.driver_id ? "PILOTA" : reference?.car_id ? "AUTO" : "NON CARICATO"} />
            <Metric label="LAST LAP" value={formatLap(lastLap)} compact sub={lastLap == null ? "NESSUN GIRO COMPLETO" : lastLap <= Number(reference?.lap_time_seconds || Infinity) ? "NUOVO BEST POTENZIALE" : "GIRO COMPLETATO"} />
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-4 text-xs font-semibold text-white/45">
            <span className="inline-flex items-center gap-1.5"><TimerReset className="h-3.5 w-3.5" /> {lapStartedAt ? `GIRO ATTIVO · ${new Date(lapStartedAt).toLocaleTimeString("it-IT")}` : reference ? "PRONTO · PASSA SUL GATE START/FINISH" : "In attesa del reference"}</span>
            <span className="hidden sm:inline">{runtimeConfig?.acquisition_mode === "external_logger" ? "Registrazione affidata al logger esterno · display indipendente" : runtimeConfig?.acquisition_mode === "hybrid" ? "Dati logger + display locale" : "Delta calcolato localmente · modalità smartphone"}</span>
          </div>
          {!running ? (
            <button onClick={start} disabled={!engine} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-35"><Play className="h-4 w-4 fill-current" /> {startLabel}</button>
          ) : (
            <button onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white"><Square className="h-4 w-4 fill-current" /> STOP</button>
          )}
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value, unit, sub, compact = false }: { label: string; value: string; unit?: string; sub?: string; compact?: boolean }) {
  return (
    <div className="flex min-h-[130px] flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">{label}</div>
      <div className={`mt-2 font-mono font-black tabular-nums ${compact ? "text-[clamp(1.55rem,4vw,3rem)]" : "text-[clamp(2.6rem,7vw,5.5rem)]"}`}>{value}</div>
      {unit && <div className="text-sm font-bold uppercase text-white/45">{unit}</div>}
      {sub && <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-white/35">{sub}</div>}
    </div>
  );
}
