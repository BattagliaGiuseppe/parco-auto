"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CarFront, Copy, KeyRound, Plus, RadioTower, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissionAccess } from "@/lib/permissions";
import { useLanguage } from "@/components/providers/LanguageProvider";

type CarOption = { id: string; name: string; chassis_number?: string | null };
type DeviceRow = {
  id: string; car_id: string; car_name: string; name: string; provider: string; model?: string | null;
  serial_number?: string | null; external_device_id?: string | null; source_type: string; status: string;
  capabilities?: Record<string, unknown>; firmware_version?: string | null; last_seen_at?: string | null;
  created_at: string; active_key_prefix?: string | null; sessions_count?: number; last_session_at?: string | null;
};
type SessionRow = {
  id: string; device_id: string; device_name: string; car_id: string; car_name: string; track_name?: string | null;
  started_at: string; ended_at?: string | null; engine_seconds: number; track_seconds: number; laps_count: number;
  best_lap_seconds?: number | null; max_speed?: number | null; max_rpm?: number | null; status: string;
};
type PageBundle = {
  devices: DeviceRow[]; cars: CarOption[]; recent_sessions: SessionRow[];
  stats: { total: number; active: number; online_15m: number; sessions_30d: number };
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
  const [bundle, setBundle] = useState<PageBundle>({ devices: [], cars: [], recent_sessions: [], stats: { total: 0, active: 0, online_15m: 0, sessions_30d: 0 } });
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false); const [saving, setSaving] = useState(false); const [secret, setSecret] = useState<SecretState>(null);
  const [form, setForm] = useState({ carId: "", name: "", provider: "generic", model: "", serial: "", externalId: "", sourceType: "logger" });

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

  async function createDevice() {
    if (!access.ctx?.teamId || !form.carId || !form.name.trim()) return;
    setSaving(true); setError(null);
    const { data, error } = await supabase.rpc("create_connected_device", {
      p_team_id: access.ctx.teamId, p_car_id: form.carId, p_name: form.name.trim(), p_provider: form.provider.trim() || "generic",
      p_model: form.model.trim() || null, p_serial_number: form.serial.trim() || null, p_external_device_id: form.externalId.trim() || null, p_source_type: form.sourceType,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    const result = data as { api_key?: string; key_prefix?: string };
    setSecret({ title: t("connectedDevices.keyCreated", "Chiave dispositivo creata"), apiKey: result.api_key || "", prefix: result.key_prefix || "" });
    setShowCreate(false); setForm((f) => ({ ...f, name: "", model: "", serial: "", externalId: "" })); await load();
  }

  async function rotateKey(device: DeviceRow) {
    if (!access.ctx?.teamId || !confirm(`${t("connectedDevices.rotateConfirm", "Ruotare la chiave di")} ${device.name}?`)) return;
    const { data, error } = await supabase.rpc("rotate_connected_device_key", { p_team_id: access.ctx.teamId, p_device_id: device.id });
    if (error) { setError(error.message); return; }
    const result = data as { api_key?: string; key_prefix?: string };
    setSecret({ title: t("connectedDevices.keyRotated", "Nuova chiave dispositivo"), apiKey: result.api_key || "", prefix: result.key_prefix || "" }); await load();
  }

  async function revoke(device: DeviceRow) {
    if (!access.ctx?.teamId || !confirm(`${t("connectedDevices.revokeConfirm", "Revocare il dispositivo")} ${device.name}?`)) return;
    const { error } = await supabase.rpc("revoke_connected_device", { p_team_id: access.ctx.teamId, p_device_id: device.id });
    if (error) setError(error.message); else await load();
  }

  if (access.loading) return <div className="p-6 text-sm text-neutral-500">{t("common.loading", "Caricamento...")}</div>;
  if (!canView) return <div className="p-6"><div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t("common.noPermission", "Non hai i permessi per visualizzare questa sezione.")}</div></div>;

  return <div className="space-y-6 p-4 md:p-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2"><RadioTower className="h-6 w-6"/><h1 className="text-2xl font-black">{t("connectedDevices.title", "Mezzi connessi")}</h1></div><p className="mt-1 text-sm text-neutral-500">{t("connectedDevices.subtitle", "Logger, gateway e sessioni registrate automaticamente dalla pista.")}</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><RefreshCw size={16}/>{t("common.refresh", "Aggiorna")}</button>{canEdit && <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white"><Plus size={16}/>{t("connectedDevices.add", "Aggiungi dispositivo")}</button>}</div>
    </div>

    {error && <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {([
        { label: t("connectedDevices.total", "Dispositivi"), value: bundle.stats.total, Icon: RadioTower },
        { label: t("connectedDevices.active", "Attivi"), value: bundle.stats.active, Icon: ShieldCheck },
        { label: t("connectedDevices.online", "Online 15 min"), value: bundle.stats.online_15m, Icon: Activity },
        { label: t("connectedDevices.sessions30", "Sessioni 30 gg"), value: bundle.stats.sessions_30d, Icon: CarFront },
      ] satisfies Array<{ label: string; value: number; Icon: typeof RadioTower }>).map(({ label, value, Icon }) => (
        <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</span>
            <Icon size={18} />
          </div>
          <div className="mt-2 text-3xl font-black">{value}</div>
        </div>
      ))}
    </div>

    <section className="rounded-2xl border bg-white shadow-sm dark:bg-neutral-950"><div className="border-b px-4 py-3 font-black">{t("connectedDevices.registry", "Registro dispositivi")}</div>{loading ? <div className="p-6 text-sm text-neutral-500">{t("common.loading", "Caricamento...")}</div> : bundle.devices.length===0 ? <div className="p-6 text-sm text-neutral-500">{t("connectedDevices.empty", "Nessun dispositivo associato. La piattaforma è pronta per il primo logger.")}</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900"><tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Mezzo</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3">Ultimo contatto</th><th className="px-4 py-3">Sessioni</th>{canEdit&&<th className="px-4 py-3"/>}</tr></thead><tbody>{bundle.devices.map((d)=><tr key={d.id} className="border-t"><td className="px-4 py-3"><div className="font-bold">{d.name}</div><div className="text-xs text-neutral-500">{d.model||d.serial_number||d.active_key_prefix||"—"}</div></td><td className="px-4 py-3">{d.car_name}</td><td className="px-4 py-3 capitalize">{d.provider}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${d.status==='revoked'?'bg-red-100 text-red-700':onlineIds.has(d.id)?'bg-emerald-100 text-emerald-700':'bg-neutral-100 text-neutral-700'}`}>{d.status==='revoked'?'Revocato':onlineIds.has(d.id)?'Online':'Offline'}</span></td><td className="px-4 py-3">{fmtDate(d.last_seen_at)}</td><td className="px-4 py-3">{d.sessions_count||0}</td>{canEdit&&<td className="px-4 py-3"><div className="flex justify-end gap-2">{d.status!=='revoked'&&<><button title="Ruota chiave" onClick={()=>void rotateKey(d)} className="rounded-lg border p-2"><KeyRound size={15}/></button><button title="Revoca" onClick={()=>void revoke(d)} className="rounded-lg border p-2 text-red-600"><Unplug size={15}/></button></>}</div></td>}</tr>)}</tbody></table></div>}</section>

    <section className="rounded-2xl border bg-white shadow-sm dark:bg-neutral-950"><div className="border-b px-4 py-3 font-black">{t("connectedDevices.recentSessions", "Sessioni automatiche recenti")}</div>{bundle.recent_sessions.length===0?<div className="p-6 text-sm text-neutral-500">{t("connectedDevices.noSessions", "Nessuna sessione ricevuta dai dispositivi.")}</div>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Mezzo</th><th className="px-4 py-3">Circuito</th><th className="px-4 py-3">Motore</th><th className="px-4 py-3">Pista</th><th className="px-4 py-3">Giri</th><th className="px-4 py-3">Best</th><th className="px-4 py-3">V max</th></tr></thead><tbody>{bundle.recent_sessions.map((s)=><tr key={s.id} className="border-t"><td className="px-4 py-3">{fmtDate(s.started_at)}</td><td className="px-4 py-3"><div className="font-semibold">{s.car_name}</div><div className="text-xs text-neutral-500">{s.device_name}</div></td><td className="px-4 py-3">{s.track_name||"—"}</td><td className="px-4 py-3">{fmtDuration(s.engine_seconds)}</td><td className="px-4 py-3">{fmtDuration(s.track_seconds)}</td><td className="px-4 py-3">{s.laps_count}</td><td className="px-4 py-3 font-mono">{fmtLap(s.best_lap_seconds)}</td><td className="px-4 py-3">{s.max_speed?`${Number(s.max_speed).toFixed(1)} km/h`:"—"}</td></tr>)}</tbody></table></div>}</section>

    {showCreate&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl dark:bg-neutral-950"><h2 className="text-xl font-black">{t("connectedDevices.add", "Aggiungi dispositivo")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Mezzo<select value={form.carId} onChange={e=>setForm({...form,carId:e.target.value})} className="mt-1 w-full rounded-xl border bg-transparent p-2"><option value="">Seleziona</option>{bundle.cars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-sm font-semibold">Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-xl border bg-transparent p-2" placeholder="AiM Solo 2 DL #1"/></label><label className="text-sm font-semibold">Provider<input value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} className="mt-1 w-full rounded-xl border bg-transparent p-2" placeholder="aim / racebox / generic"/></label><label className="text-sm font-semibold">Modello<input value={form.model} onChange={e=>setForm({...form,model:e.target.value})} className="mt-1 w-full rounded-xl border bg-transparent p-2"/></label><label className="text-sm font-semibold">Seriale<input value={form.serial} onChange={e=>setForm({...form,serial:e.target.value})} className="mt-1 w-full rounded-xl border bg-transparent p-2"/></label><label className="text-sm font-semibold">External ID<input value={form.externalId} onChange={e=>setForm({...form,externalId:e.target.value})} className="mt-1 w-full rounded-xl border bg-transparent p-2"/></label><label className="text-sm font-semibold sm:col-span-2">Tipo<select value={form.sourceType} onChange={e=>setForm({...form,sourceType:e.target.value})} className="mt-1 w-full rounded-xl border bg-transparent p-2"><option value="logger">Logger</option><option value="cloud">Cloud</option><option value="mobile">Mobile</option><option value="gateway">Gateway</option><option value="import">Import</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowCreate(false)} className="rounded-xl border px-4 py-2 font-semibold">Annulla</button><button disabled={saving||!form.carId||!form.name.trim()} onClick={()=>void createDevice()} className="rounded-xl bg-black px-4 py-2 font-bold text-white disabled:opacity-40">{saving?"Salvataggio...":"Crea e genera chiave"}</button></div></div></div>}

    {secret&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-neutral-950"><h2 className="text-xl font-black">{secret.title}</h2><div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("connectedDevices.secretWarning", "Salva questa chiave adesso: verrà mostrata una sola volta. Nel database viene conservato soltanto l'hash.")}</div><div className="mt-4 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-neutral-950 p-3 text-sm text-white">{secret.apiKey}</code><button onClick={()=>void navigator.clipboard.writeText(secret.apiKey)} className="rounded-xl border px-3"><Copy size={18}/></button></div><div className="mt-5 flex justify-end"><button onClick={()=>setSecret(null)} className="rounded-xl bg-black px-4 py-2 font-bold text-white">Ho salvato la chiave</button></div></div></div>}
  </div>;
}
