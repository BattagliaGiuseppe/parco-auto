"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CarFront, Copy, KeyRound, Plus, RadioTower, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissionAccess } from "@/lib/permissions";
import { useLanguage } from "@/components/providers/LanguageProvider";

type CarOption = { id: string; name: string; chassis_number?: string | null };
type DriverOption = { id: string; first_name: string; last_name: string; nickname?: string | null; racing_number?: string | null; is_active?: boolean };
type CircuitOption = { id: string; name: string; city?: string | null; country?: string | null; latitude?: number | null; longitude?: number | null; detection_radius_m?: number | null };
type DeviceRow = {
  id: string; car_id: string; car_name: string; name: string; provider: string; model?: string | null;
  serial_number?: string | null; external_device_id?: string | null; source_type: string; status: string;
  capabilities?: Record<string, unknown>; firmware_version?: string | null; last_seen_at?: string | null;
  created_at: string; active_key_prefix?: string | null; sessions_count?: number; last_session_at?: string | null;
  default_driver_id?: string | null; default_driver_name?: string | null;
};
type SessionRow = {
  id: string; device_id: string; device_name: string; car_id: string; car_name: string; track_name?: string | null;
  started_at: string; ended_at?: string | null; engine_seconds: number; track_seconds: number; laps_count: number;
  best_lap_seconds?: number | null; max_speed?: number | null; max_rpm?: number | null; status: string;
  reconciliation_status?: "pending" | "reconciled" | "not_applicable" | "needs_review" | "failed"; reconciliation_message?: string | null;
  reconciled_at?: string | null; event_id?: string | null; event_name?: string | null; event_session_id?: string | null; event_car_turn_id?: string | null;
  driver_id?: string | null; driver_name?: string | null;
  activity_type?: "track" | "engine_only" | "unknown"; detected_circuit_id?: string | null; detected_circuit_name?: string | null; detection_confidence?: number | null;
  gps_latitude?: number | null; gps_longitude?: number | null; track_entry_at?: string | null; track_exit_at?: string | null;
};
type DaySummary = {
  day_date: string; event_id: string; event_name: string; detected_circuit_id?: string | null; circuit_name?: string | null;
  turns_count: number; laps_count: number; track_seconds: number; engine_seconds: number; best_lap_seconds?: number | null; max_speed?: number | null; day_group_key?: string | null;
};
type PageBundle = {
  devices: DeviceRow[]; cars: CarOption[]; drivers: DriverOption[]; circuits: CircuitOption[]; recent_sessions: SessionRow[]; day_summaries: DaySummary[];
  stats: { total: number; active: number; online_15m: number; sessions_30d: number; track_30d?: number; engine_only_30d?: number; needs_review?: number };
};

type SecretState = { title: string; apiKey: string; prefix: string } | null;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function fmtDuration(seconds?: number | null) {
  const total = Math.max(0, Number(seconds || 0));
  const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = Math.round(total % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
function fmtLap(value?: number | null) {
  if (!value) return "—";
  const minutes = Math.floor(value / 60); const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

export default function ConnectedDevicesPage() {
  const { t } = useLanguage();
  const access = usePermissionAccess();
  const canView = access.hasPermission("devices.view");
  const canEdit = access.hasPermission("devices.edit");
  const canEditCircuits = access.hasPermission("events.edit");
  const [bundle, setBundle] = useState<PageBundle>({ devices: [], cars: [], drivers: [], circuits: [], recent_sessions: [], day_summaries: [], stats: { total: 0, active: 0, online_15m: 0, sessions_30d: 0, needs_review: 0 } });
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false); const [saving, setSaving] = useState(false); const [secret, setSecret] = useState<SecretState>(null);
  const [form, setForm] = useState({ carId: "", name: "", provider: "generic", model: "", serial: "", externalId: "", sourceType: "logger", defaultDriverId: "" });
  const [geofenceDrafts, setGeofenceDrafts] = useState<Record<string, { latitude: string; longitude: string; radius: string }>>({});
  const [savingCircuitId, setSavingCircuitId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!access.ctx?.teamId || !canView) { setLoading(false); return; }
    setLoading(true); setError(null);
    const { data, error } = await supabase.rpc("connected_devices_page", { p_team_id: access.ctx.teamId });
    if (error) setError(error.message); else setBundle((data || {}) as PageBundle);
    setLoading(false);
  }, [access.ctx?.teamId, canView]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!form.carId && bundle.cars[0]?.id) setForm((f) => ({ ...f, carId: bundle.cars[0].id })); }, [bundle.cars, form.carId]);

  const onlineIds = useMemo(() => new Set(bundle.devices.filter((d) => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() <= 15 * 60 * 1000).map((d) => d.id)), [bundle.devices]);

  useEffect(() => {
    setGeofenceDrafts(Object.fromEntries((bundle.circuits || []).map((c) => [c.id, {
      latitude: c.latitude == null ? "" : String(c.latitude),
      longitude: c.longitude == null ? "" : String(c.longitude),
      radius: c.detection_radius_m == null ? "" : String(c.detection_radius_m),
    }])));
  }, [bundle.circuits]);

  async function saveCircuitGeofence(circuit: CircuitOption) {
    if (!access.ctx?.teamId || !canEditCircuits) return;
    const draft = geofenceDrafts[circuit.id] || { latitude: "", longitude: "", radius: "" };
    const empty = !draft.latitude.trim() && !draft.longitude.trim() && !draft.radius.trim();
    const latitude = empty ? null : Number(draft.latitude.replace(",", "."));
    const longitude = empty ? null : Number(draft.longitude.replace(",", "."));
    const radius = empty ? null : Number(draft.radius);
    if (!empty && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isInteger(radius))) {
      setError("Coordinate o raggio non validi."); return;
    }
    setSavingCircuitId(circuit.id); setError(null);
    const { error } = await supabase.rpc("set_connected_circuit_geofence", {
      p_team_id: access.ctx.teamId, p_circuit_id: circuit.id, p_latitude: latitude, p_longitude: longitude, p_detection_radius_m: radius,
    });
    setSavingCircuitId(null);
    if (error) setError(error.message); else await load();
  }

  async function createDevice() {
    if (!access.ctx?.teamId || !form.carId || !form.name.trim()) return;
    setSaving(true); setError(null);
    const { data, error } = await supabase.rpc("create_connected_device", {
      p_team_id: access.ctx.teamId, p_car_id: form.carId, p_name: form.name.trim(), p_provider: form.provider.trim() || "generic",
      p_model: form.model.trim() || null, p_serial_number: form.serial.trim() || null, p_external_device_id: form.externalId.trim() || null, p_source_type: form.sourceType,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    const result = data as { device?: { id?: string }; api_key?: string; key_prefix?: string };
    if (form.defaultDriverId && result.device?.id) {
      const { error: driverError } = await supabase.rpc("set_connected_device_default_driver", { p_team_id: access.ctx.teamId, p_device_id: result.device.id, p_driver_id: form.defaultDriverId });
      if (driverError) setError(driverError.message);
    }
    setSecret({ title: t("connectedDevices.keyCreated", "Chiave dispositivo creata"), apiKey: result.api_key || "", prefix: result.key_prefix || "" });
    setShowCreate(false); setForm((f) => ({ ...f, name: "", model: "", serial: "", externalId: "", defaultDriverId: "" })); await load();
  }

  async function rotateKey(device: DeviceRow) {
    if (!access.ctx?.teamId || !confirm(`${t("connectedDevices.rotateConfirm", "Ruotare la chiave di")} ${device.name}?`)) return;
    const { data, error } = await supabase.rpc("rotate_connected_device_key", { p_team_id: access.ctx.teamId, p_device_id: device.id });
    if (error) { setError(error.message); return; }
    const result = data as { api_key?: string; key_prefix?: string };
    setSecret({ title: t("connectedDevices.keyRotated", "Nuova chiave dispositivo"), apiKey: result.api_key || "", prefix: result.key_prefix || "" }); await load();
  }

  async function setDeviceDefaultDriver(device: DeviceRow, driverId: string) {
    if (!access.ctx?.teamId) return;
    setError(null);
    const { error } = await supabase.rpc("set_connected_device_default_driver", {
      p_team_id: access.ctx.teamId,
      p_device_id: device.id,
      p_driver_id: driverId || null,
    });
    if (error) setError(error.message); else await load();
  }

  async function revoke(device: DeviceRow) {
    if (!access.ctx?.teamId || !confirm(`${t("connectedDevices.revokeConfirm", "Revocare il dispositivo")} ${device.name}?`)) return;
    const { error } = await supabase.rpc("revoke_connected_device", { p_team_id: access.ctx.teamId, p_device_id: device.id });
    if (error) setError(error.message); else await load();
  }

  async function reconcileSession(session: SessionRow) {
    if (!access.ctx?.teamId) return;
    setError(null);
    const { error } = await supabase.rpc("reconcile_connected_session_for_team", { p_team_id: access.ctx.teamId, p_session_id: session.id });
    if (error) setError(error.message); else await load();
  }

  async function setSessionDriver(session: SessionRow, driverId: string) {
    if (!access.ctx?.teamId || !session.event_car_turn_id) return;
    setError(null);
    const { error } = await supabase.rpc("set_connected_session_driver", {
      p_team_id: access.ctx.teamId,
      p_session_id: session.id,
      p_driver_id: driverId || null,
    });
    if (error) setError(error.message); else await load();
  }

  if (access.loading) return <div className="p-6 text-sm text-neutral-500">{t("common.loading", "Caricamento...")}</div>;
  if (!canView) return <div className="p-6"><div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t("common.noPermission", "Non hai i permessi per visualizzare questa sezione.")}</div></div>;

  return <div className="space-y-6 p-4 text-neutral-900 dark:text-neutral-100 md:p-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2"><RadioTower className="h-6 w-6"/><h1 className="text-2xl font-black">{t("connectedDevices.title", "Mezzi connessi")}</h1></div><p className="mt-1 text-sm text-neutral-500">{t("connectedDevices.subtitle", "Logger, gateway e sessioni registrate automaticamente dalla pista.")}</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"><RefreshCw size={16}/>{t("common.refresh", "Aggiorna")}</button>{canEdit && <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"><Plus size={16}/>{t("connectedDevices.add", "Aggiungi dispositivo")}</button>}</div>
    </div>

    {error && <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {([
        { label: t("connectedDevices.total", "Dispositivi"), value: bundle.stats.total, Icon: RadioTower },
        { label: t("connectedDevices.active", "Attivi"), value: bundle.stats.active, Icon: ShieldCheck },
        { label: t("connectedDevices.online", "Online 15 min"), value: bundle.stats.online_15m, Icon: Activity },
        { label: t("connectedDevices.sessions30", "Sessioni 30 gg"), value: bundle.stats.sessions_30d, Icon: CarFront },
      ] satisfies Array<{ label: string; value: number; Icon: typeof RadioTower }>).map(({ label, value, Icon }) => (
        <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</span>
            <Icon size={18} />
          </div>
          <div className="mt-2 text-3xl font-black">{value}</div>
        </div>
      ))}
    </div>

    <section className="rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"><div className="border-b border-neutral-200 px-4 py-3 font-black dark:border-neutral-800">{t("connectedDevices.registry", "Registro dispositivi")}</div>{loading ? <div className="p-6 text-sm text-neutral-500">{t("common.loading", "Caricamento...")}</div> : bundle.devices.length===0 ? <div className="p-6 text-sm text-neutral-500">{t("connectedDevices.empty", "Nessun dispositivo associato. La piattaforma è pronta per il primo logger.")}</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900"><tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Mezzo</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Pilota predefinito</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3">Ultimo contatto</th><th className="px-4 py-3">Sessioni</th>{canEdit&&<th className="px-4 py-3"/>}</tr></thead><tbody>{bundle.devices.map((d)=><tr key={d.id} className="border-t border-neutral-200 dark:border-neutral-800"><td className="px-4 py-3"><div className="font-bold">{d.name}</div><div className="text-xs text-neutral-500">{d.model||d.serial_number||d.active_key_prefix||"—"}</div></td><td className="px-4 py-3">{d.car_name}</td><td className="px-4 py-3 capitalize">{d.provider}</td><td className="px-4 py-3"><div className="min-w-[180px]">{canEdit&&d.status!=='revoked'?<select value={d.default_driver_id||""} onChange={(e)=>void setDeviceDefaultDriver(d,e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"><option value="">Nessun predefinito</option>{bundle.drivers.map((drv)=><option key={drv.id} value={drv.id}>{drv.first_name} {drv.last_name}{drv.racing_number?` #${drv.racing_number}`:""}</option>)}</select>:<span>{d.default_driver_name||"—"}</span>}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${d.status==='revoked'?'bg-red-100 text-red-700':onlineIds.has(d.id)?'bg-emerald-100 text-emerald-700':'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`}>{d.status==='revoked'?'Revocato':onlineIds.has(d.id)?'Online':'Offline'}</span></td><td className="px-4 py-3">{fmtDate(d.last_seen_at)}</td><td className="px-4 py-3">{d.sessions_count||0}</td>{canEdit&&<td className="px-4 py-3"><div className="flex justify-end gap-2">{d.status!=='revoked'&&<><button title="Ruota chiave" onClick={()=>void rotateKey(d)} className="rounded-lg border border-neutral-300 bg-white p-2 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"><KeyRound size={15}/></button><button title="Revoca" onClick={()=>void revoke(d)} className="rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950/30"><Unplug size={15}/></button></>}</div></td>}</tr>)}</tbody></table></div>}</section>


    <section className="rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="font-black">Geofence circuiti</div>
        <div className="mt-1 text-xs text-neutral-500">Coordinate centrali e raggio usati per riconoscere automaticamente il circuito dai dati GPS del logger.</div>
      </div>
      {bundle.circuits.length===0 ? <div className="p-6 text-sm text-neutral-500">Nessun circuito disponibile nel team.</div> : <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900"><tr><th className="px-4 py-3">Circuito</th><th className="px-4 py-3">Latitudine</th><th className="px-4 py-3">Longitudine</th><th className="px-4 py-3">Raggio</th><th className="px-4 py-3">Stato</th>{canEditCircuits&&<th className="px-4 py-3"/>}</tr></thead>
          <tbody>{bundle.circuits.map((c)=>{const d=geofenceDrafts[c.id]||{latitude:"",longitude:"",radius:""};const configured=c.latitude!=null&&c.longitude!=null&&c.detection_radius_m!=null;return <tr key={c.id} className="border-t border-neutral-200 dark:border-neutral-800"><td className="px-4 py-3"><div className="font-semibold">{c.name}</div>{(c.city||c.country)&&<div className="text-xs text-neutral-500">{[c.city,c.country].filter(Boolean).join(" · ")}</div>}</td><td className="px-4 py-3">{canEditCircuits?<input inputMode="decimal" value={d.latitude} onChange={(e)=>setGeofenceDrafts((x)=>({...x,[c.id]:{...d,latitude:e.target.value}}))} placeholder="es. 42.1609" className="w-36 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"/>:<span>{c.latitude??"—"}</span>}</td><td className="px-4 py-3">{canEditCircuits?<input inputMode="decimal" value={d.longitude} onChange={(e)=>setGeofenceDrafts((x)=>({...x,[c.id]:{...d,longitude:e.target.value}}))} placeholder="es. 12.3690" className="w-36 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"/>:<span>{c.longitude??"—"}</span>}</td><td className="px-4 py-3">{canEditCircuits?<div className="flex items-center gap-1"><input inputMode="numeric" value={d.radius} onChange={(e)=>setGeofenceDrafts((x)=>({...x,[c.id]:{...d,radius:e.target.value}}))} placeholder="1000" className="w-24 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"/><span className="text-xs text-neutral-500">m</span></div>:<span>{c.detection_radius_m?`${c.detection_radius_m} m`:"—"}</span>}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${configured?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-800'}`}>{configured?'Configurata':'Da configurare'}</span></td>{canEditCircuits&&<td className="px-4 py-3"><button disabled={savingCircuitId===c.id} onClick={()=>void saveCircuitGeofence(c)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800">{savingCircuitId===c.id?'Salvataggio...':'Salva'}</button></td>}</tr>})}</tbody>
        </table>
      </div>}
      {canEditCircuits&&<div className="border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800">Per rimuovere una geofence, svuota tutti e tre i campi e salva. Il raggio consentito è 50–10.000 m.</div>}
    </section>

    <section className="rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="font-black">Giornate pista automatiche</div>
        <div className="mt-1 text-xs text-neutral-500">Più turni nello stesso circuito e nella stessa giornata vengono raggruppati in un unico Evento/Test.</div>
      </div>
      {bundle.day_summaries.length===0?<div className="p-6 text-sm text-neutral-500">Nessuna giornata pista automatica disponibile.</div>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Circuito / Evento</th><th className="px-4 py-3">Turni</th><th className="px-4 py-3">Giri</th><th className="px-4 py-3">Tempo pista</th><th className="px-4 py-3">Tempo motore</th><th className="px-4 py-3">Best</th><th className="px-4 py-3">V max</th></tr></thead><tbody>{bundle.day_summaries.map((d)=><tr key={d.event_id} className="border-t border-neutral-200 dark:border-neutral-800"><td className="px-4 py-3 font-semibold">{new Intl.DateTimeFormat("it-IT").format(new Date(`${d.day_date}T12:00:00`))}</td><td className="px-4 py-3"><div className="font-semibold">{d.circuit_name||d.event_name}</div><div className="text-xs text-neutral-500">{d.event_name}</div></td><td className="px-4 py-3"><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{d.turns_count}</span></td><td className="px-4 py-3">{d.laps_count}</td><td className="px-4 py-3">{fmtDuration(d.track_seconds)}</td><td className="px-4 py-3">{fmtDuration(d.engine_seconds)}</td><td className="px-4 py-3 font-mono">{fmtLap(d.best_lap_seconds)}</td><td className="px-4 py-3">{d.max_speed?`${Number(d.max_speed).toFixed(1)} km/h`:"—"}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"><div className="border-b border-neutral-200 px-4 py-3 font-black dark:border-neutral-800">{t("connectedDevices.recentSessions", "Sessioni automatiche recenti")}</div>{bundle.recent_sessions.length===0?<div className="p-6 text-sm text-neutral-500">{t("connectedDevices.noSessions", "Nessuna sessione ricevuta dai dispositivi.")}</div>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Mezzo</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Circuito</th><th className="px-4 py-3">Motore</th><th className="px-4 py-3">Pista</th><th className="px-4 py-3">Giri</th><th className="px-4 py-3">Best</th><th className="px-4 py-3">V max</th><th className="px-4 py-3">Pilota</th><th className="px-4 py-3">Attività</th></tr></thead><tbody>{bundle.recent_sessions.map((s)=><tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-800"><td className="px-4 py-3">{fmtDate(s.started_at)}</td><td className="px-4 py-3"><div className="font-semibold">{s.car_name}</div><div className="text-xs text-neutral-500">{s.device_name}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${s.activity_type==='track'?'bg-emerald-100 text-emerald-700':s.activity_type==='engine_only'?'bg-sky-100 text-sky-700':'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`}>{s.activity_type==='track'?'Pista':s.activity_type==='engine_only'?'Solo motore':'Non classificata'}</span></td><td className="px-4 py-3"><div className="font-semibold">{s.detected_circuit_name||s.track_name||"—"}</div>{s.detection_confidence!=null&&<div className="text-xs text-neutral-500">Conf. {Math.round(Number(s.detection_confidence)*100)}%</div>}</td><td className="px-4 py-3">{fmtDuration(s.engine_seconds)}</td><td className="px-4 py-3">{fmtDuration(s.track_seconds)}</td><td className="px-4 py-3">{s.laps_count}</td><td className="px-4 py-3 font-mono">{fmtLap(s.best_lap_seconds)}</td><td className="px-4 py-3">{s.max_speed?`${Number(s.max_speed).toFixed(1)} km/h`:"—"}</td><td className="px-4 py-3"><div className="min-w-[180px]">{canEdit&&s.reconciliation_status==='reconciled'&&s.event_car_turn_id?<select value={s.driver_id||""} onChange={(e)=>void setSessionDriver(s,e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"><option value="">Nessun pilota</option>{bundle.drivers.map((d)=><option key={d.id} value={d.id}>{d.first_name} {d.last_name}{d.racing_number?` #${d.racing_number}`:""}</option>)}</select>:<span className="text-sm">{s.driver_name||"—"}</span>}</div></td><td className="px-4 py-3"><div className="flex min-w-[190px] flex-col gap-1"><span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${s.reconciliation_status==='reconciled'?'bg-emerald-100 text-emerald-700':s.reconciliation_status==='failed'?'bg-red-100 text-red-700':s.reconciliation_status==='needs_review'?'bg-amber-100 text-amber-800':s.reconciliation_status==='not_applicable'?'bg-sky-100 text-sky-700':'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`}>{s.reconciliation_status==='reconciled'?'Riconciliata':s.reconciliation_status==='failed'?'Errore':s.reconciliation_status==='needs_review'?'Da verificare':s.reconciliation_status==='not_applicable'?'Nessun turno pista':'In attesa'}</span>{s.event_name&&<span className="text-xs font-semibold">{s.event_name}</span>}{s.reconciliation_message&&<span className="text-xs text-neutral-500">{s.reconciliation_message}</span>}{canEdit&&s.reconciliation_status&&['needs_review','failed','pending'].includes(s.reconciliation_status)&&<button onClick={()=>void reconcileSession(s)} className="mt-1 w-fit rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-bold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800">Riconcilia</button>}</div></td></tr>)}</tbody></table></div>}</section>

    {showCreate&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"><h2 className="text-xl font-black">{t("connectedDevices.add", "Aggiungi dispositivo")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Mezzo<select value={form.carId} onChange={e=>setForm({...form,carId:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"><option value="">Seleziona</option>{bundle.cars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-800" placeholder="AiM Solo 2 DL #1"/></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Provider<input value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-800" placeholder="aim / racebox / generic"/></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Modello<input value={form.model} onChange={e=>setForm({...form,model:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"/></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Seriale<input value={form.serial} onChange={e=>setForm({...form,serial:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"/></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">External ID<input value={form.externalId} onChange={e=>setForm({...form,externalId:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"/></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 sm:col-span-2">Pilota predefinito<select value={form.defaultDriverId} onChange={e=>setForm({...form,defaultDriverId:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"><option value="">Nessun predefinito</option>{bundle.drivers.map(d=><option key={d.id} value={d.id}>{d.first_name} {d.last_name}{d.racing_number?` #${d.racing_number}`:""}</option>)}</select><span className="mt-1 block text-xs font-normal text-neutral-500">Se impostato, i nuovi turni automatici useranno questo pilota. Potrai sempre cambiarlo sul singolo turno.</span></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 sm:col-span-2">Tipo<select value={form.sourceType} onChange={e=>setForm({...form,sourceType:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"><option value="logger">Logger</option><option value="cloud">Cloud</option><option value="mobile">Mobile</option><option value="gateway">Gateway</option><option value="import">Import</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowCreate(false)} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800">Annulla</button><button disabled={saving||!form.carId||!form.name.trim()} onClick={()=>void createDevice()} className="rounded-xl bg-neutral-900 px-4 py-2 font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">{saving?"Salvataggio...":"Crea e genera chiave"}</button></div></div></div>}

    {secret&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"><h2 className="text-xl font-black">{secret.title}</h2><div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("connectedDevices.secretWarning", "Salva questa chiave adesso: verrà mostrata una sola volta. Nel database viene conservato soltanto l'hash.")}</div><div className="mt-4 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-neutral-950 p-3 text-sm text-white">{secret.apiKey}</code><button onClick={()=>void navigator.clipboard.writeText(secret.apiKey)} className="rounded-xl border border-neutral-300 bg-white px-3 text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"><Copy size={18}/></button></div><div className="mt-5 flex justify-end"><button onClick={()=>setSecret(null)} className="rounded-xl bg-neutral-900 px-4 py-2 font-bold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">Ho salvato la chiave</button></div></div></div>}
  </div>;
}
