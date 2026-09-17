"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Plus, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RoutingCar = { id: string; name: string; chassis_number?: string | null };
type RoutingDevice = {
  id: string;
  name: string;
  provider: string;
  model?: string | null;
  serial_number?: string | null;
  external_device_id?: string | null;
  routing_mode: "fixed_car" | "assignment_history";
  car_id: string;
  car_name: string;
  status: string;
};
type RoutingBridge = {
  id: string;
  name: string;
  provider: string;
  installation_id: string;
  machine_name?: string | null;
  status: "active" | "disabled" | "revoked";
  last_seen_at?: string | null;
  created_at: string;
  active_key_prefix?: string | null;
  enabled_device_ids: string[];
  pending_count: number;
};
type RoutingObservation = {
  id: string;
  bridge_id: string;
  bridge_name: string;
  provider: string;
  file_sha256: string;
  session_started_at: string;
  identity: Record<string, unknown>;
  status: "resolved" | "needs_mapping" | "conflict" | "blocked";
  resolved_device_id?: string | null;
  resolved_device_name?: string | null;
  resolved_car_id?: string | null;
  resolved_car_name?: string | null;
  reason_code: string;
  message?: string | null;
  resolution_basis: string[];
  first_seen_at: string;
  last_seen_at: string;
  occurrences: number;
  resolved_at?: string | null;
};
type VehicleAlias = {
  id: string;
  provider: string;
  alias_type: string;
  alias_value: string;
  car_id: string;
  car_name: string;
  valid_from: string;
  valid_to?: string | null;
  source: string;
};
type DeviceAssignment = {
  id: string;
  device_id: string;
  device_name: string;
  car_id: string;
  car_name: string;
  valid_from: string;
  valid_to?: string | null;
  source: string;
};
type RoutingBundle = {
  bridges: RoutingBridge[];
  devices: RoutingDevice[];
  cars: RoutingCar[];
  observations: RoutingObservation[];
  aliases: VehicleAlias[];
  assignments: DeviceAssignment[];
  stats: { bridges: number; needs_mapping: number; conflicts: number; resolved: number };
};
type MappingDraft = { carId: string; deviceId: string; replaceConflicts: boolean };
type SecretState = { title: string; value: string } | null;

const emptyBundle: RoutingBundle = {
  bridges: [], devices: [], cars: [], observations: [], aliases: [], assignments: [],
  stats: { bridges: 0, needs_mapping: 0, conflicts: 0, resolved: 0 },
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function identityText(identity: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = identity?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function statusClass(status: RoutingObservation["status"]) {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "conflict") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (status === "blocked") return "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
}
function statusLabel(row: RoutingObservation) {
  if (row.reason_code === "mapping_configured_retry_required") return "Configurato · attesa bridge";
  if (row.status === "resolved") return "Risolto";
  if (row.status === "conflict") return "Conflitto";
  if (row.status === "blocked") return "Bloccato";
  return "Da associare";
}

export default function RoutingAdminPanel({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const [bundle, setBundle] = useState<RoutingBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreateBridge, setShowCreateBridge] = useState(false);
  const [bridgeForm, setBridgeForm] = useState({ name: "AiM Bridge", machineName: "", deviceIds: [] as string[] });
  const [bridgeSelections, setBridgeSelections] = useState<Record<string, string[]>>({});
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [secret, setSecret] = useState<SecretState>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true); setError(null);
    const [bridgesR, bridgeDevicesR, devicesR, carsR, observationsR, aliasesR, assignmentsR] = await Promise.all([
      supabase.from("connected_bridges").select("id,name,provider,installation_id,machine_name,status,last_seen_at,created_at,metadata").eq("team_id", teamId).order("created_at", { ascending: false }),
      supabase.from("connected_bridge_devices").select("bridge_id,device_id,enabled").eq("team_id", teamId),
      supabase.from("connected_devices").select("id,name,provider,model,serial_number,external_device_id,routing_mode,car_id,status").eq("team_id", teamId).order("name"),
      supabase.from("cars").select("id,name,chassis_number").eq("team_id", teamId).order("name"),
      supabase.from("connected_routing_observations").select("id,bridge_id,provider,file_sha256,session_started_at,identity,status,resolved_device_id,resolved_car_id,reason_code,message,resolution_basis,first_seen_at,last_seen_at,occurrences,resolved_at").eq("team_id", teamId).order("last_seen_at", { ascending: false }).limit(100),
      supabase.from("connected_vehicle_aliases").select("id,provider,alias_type,alias_value,car_id,valid_from,valid_to,source").eq("team_id", teamId).order("valid_from", { ascending: false }).limit(100),
      supabase.from("connected_device_car_assignments").select("id,device_id,car_id,valid_from,valid_to,source").eq("team_id", teamId).order("valid_from", { ascending: false }).limit(100),
    ]);
    const firstError = [bridgesR.error, bridgeDevicesR.error, devicesR.error, carsR.error, observationsR.error, aliasesR.error, assignmentsR.error].find(Boolean);
    if (firstError) { setError(firstError.message); setLoading(false); return; }

    const cars = (carsR.data || []) as RoutingCar[];
    const carNames = new Map(cars.map((c) => [c.id, c.name]));
    const devices = ((devicesR.data || []) as Array<Omit<RoutingDevice, "car_name">>).map((d) => ({ ...d, car_name: carNames.get(d.car_id) || "—" }));
    const deviceNames = new Map(devices.map((d) => [d.id, d.name]));
    const enabledByBridge = new Map<string, string[]>();
    for (const row of bridgeDevicesR.data || []) {
      if (!row.enabled) continue;
      enabledByBridge.set(row.bridge_id, [...(enabledByBridge.get(row.bridge_id) || []), row.device_id]);
    }
    const rawObservations = (observationsR.data || []) as Array<Omit<RoutingObservation, "bridge_name" | "resolved_device_name" | "resolved_car_name">>;
    const pendingByBridge = new Map<string, number>();
    for (const o of rawObservations) if (o.status !== "resolved") pendingByBridge.set(o.bridge_id, (pendingByBridge.get(o.bridge_id) || 0) + 1);
    const bridgeNames = new Map((bridgesR.data || []).map((b) => [b.id, b.name]));
    const observations: RoutingObservation[] = rawObservations.map((o) => ({
      ...o,
      bridge_name: bridgeNames.get(o.bridge_id) || "AiM Bridge",
      resolved_device_name: o.resolved_device_id ? deviceNames.get(o.resolved_device_id) || null : null,
      resolved_car_name: o.resolved_car_id ? carNames.get(o.resolved_car_id) || null : null,
    }));
    observations.sort((a,b) => {
      const p = (x: RoutingObservation) => x.status === "conflict" ? 0 : x.status === "needs_mapping" ? 1 : x.status === "blocked" ? 2 : 3;
      return p(a) - p(b) || new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });
    const bridges: RoutingBridge[] = (bridgesR.data || []).map((b) => ({
      id: b.id, name: b.name, provider: b.provider, installation_id: b.installation_id, machine_name: b.machine_name, status: b.status,
      last_seen_at: b.last_seen_at, created_at: b.created_at,
      active_key_prefix: typeof b.metadata === "object" && b.metadata && "active_key_prefix" in b.metadata ? String((b.metadata as Record<string, unknown>).active_key_prefix || "") : null,
      enabled_device_ids: enabledByBridge.get(b.id) || [], pending_count: pendingByBridge.get(b.id) || 0,
    }));
    const aliases: VehicleAlias[] = (aliasesR.data || []).map((a) => ({ ...a, car_name: carNames.get(a.car_id) || "—" }));
    const assignments: DeviceAssignment[] = (assignmentsR.data || []).map((a) => ({ ...a, device_name: deviceNames.get(a.device_id) || "—", car_name: carNames.get(a.car_id) || "—" }));
    const next: RoutingBundle = {
      bridges, devices, cars, observations, aliases, assignments,
      stats: {
        bridges: bridges.filter((b) => b.status === "active").length,
        needs_mapping: observations.filter((o) => o.status === "needs_mapping").length,
        conflicts: observations.filter((o) => o.status === "conflict").length,
        resolved: observations.filter((o) => o.status === "resolved").length,
      },
    };
    setBundle(next);
    setBridgeSelections(Object.fromEntries(bridges.map((b) => [b.id, b.enabled_device_ids || []])));
    setMappingDrafts((current) => {
      const copy = { ...current };
      for (const o of observations) {
        if (!copy[o.id]) {
          const bridge = bridges.find((b) => b.id === o.bridge_id);
          const onlyDevice = bridge?.enabled_device_ids?.length === 1 ? bridge.enabled_device_ids[0] : "";
          copy[o.id] = { carId: o.resolved_car_id || "", deviceId: o.resolved_device_id || onlyDevice || "", replaceConflicts: false };
        }
      }
      return copy;
    });
    setLoading(false);
  }, [teamId]);

  useEffect(() => { void load(); }, [load]);

  const queue = useMemo(
    () => bundle.observations.filter((o) => o.status !== "resolved"),
    [bundle.observations]
  );
  const recentResolved = useMemo(
    () => bundle.observations.filter((o) => o.status === "resolved").slice(0, 10),
    [bundle.observations]
  );
  const currentAliases = useMemo(() => bundle.aliases.filter((a) => !a.valid_to), [bundle.aliases]);
  const currentAssignments = useMemo(() => bundle.assignments.filter((a) => !a.valid_to), [bundle.assignments]);

  async function createBridge() {
    if (!canEdit || !bridgeForm.name.trim()) return;
    setSavingId("create-bridge"); setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_connected_bridge", {
      p_team_id: teamId,
      p_name: bridgeForm.name.trim(),
      p_machine_name: bridgeForm.machineName.trim() || null,
      p_device_ids: bridgeForm.deviceIds,
    });
    setSavingId(null);
    if (rpcError) { setError(rpcError.message); return; }
    const result = data as { bridge_key?: string };
    setSecret({ title: "Bridge Key creata", value: result.bridge_key || "" });
    setShowCreateBridge(false);
    setBridgeForm({ name: "AiM Bridge", machineName: "", deviceIds: [] });
    await load();
  }

  async function rotateBridgeKey(bridge: RoutingBridge) {
    if (!canEdit || !confirm(`Ruotare la Bridge Key di ${bridge.name}? La chiave precedente smetterà di funzionare.`)) return;
    setSavingId(`key-${bridge.id}`); setError(null);
    const { data, error: rpcError } = await supabase.rpc("rotate_connected_bridge_key", {
      p_team_id: teamId, p_bridge_id: bridge.id,
    });
    setSavingId(null);
    if (rpcError) { setError(rpcError.message); return; }
    const result = data as { bridge_key?: string };
    setSecret({ title: "Nuova Bridge Key", value: result.bridge_key || "" });
    await load();
  }

  async function saveBridgeDevices(bridge: RoutingBridge) {
    if (!canEdit) return;
    setSavingId(`bridge-${bridge.id}`); setError(null);
    const { error: rpcError } = await supabase.rpc("set_connected_bridge_devices", {
      p_team_id: teamId,
      p_bridge_id: bridge.id,
      p_device_ids: bridgeSelections[bridge.id] || [],
    });
    setSavingId(null);
    if (rpcError) setError(rpcError.message); else await load();
  }

  async function saveMapping(observation: RoutingObservation) {
    if (!canEdit) return;
    const draft = mappingDrafts[observation.id] || { carId: "", deviceId: "", replaceConflicts: false };
    if (!draft.carId || !draft.deviceId) {
      setError("Seleziona sia la vettura sia il logger da associare.");
      return;
    }
    setSavingId(`mapping-${observation.id}`); setError(null);
    const { error: rpcError } = await supabase.rpc("apply_connected_routing_mapping", {
      p_team_id: teamId,
      p_observation_id: observation.id,
      p_car_id: draft.carId,
      p_device_id: draft.deviceId,
      p_replace_conflicts: draft.replaceConflicts,
    });
    setSavingId(null);
    if (rpcError) setError(rpcError.message); else await load();
  }

  if (loading) {
    return <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">Caricamento routing multi-auto...</section>;
  }

  return <>
    <section className="rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 font-black"><ShieldCheck size={18}/>Routing AiM multi-auto</div>
          <div className="mt-1 text-xs text-neutral-500">Un solo bridge Windows può gestire più logger e più vetture. Nessun XRK viene importato finché logger, Vehicle e vettura non sono coerenti.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"><RefreshCw size={14}/>Aggiorna</button>
          {canEdit && <button onClick={() => setShowCreateBridge(true)} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-bold text-white dark:bg-white dark:text-neutral-950"><Plus size={14}/>Nuovo bridge</button>}
        </div>
      </div>

      {error && <div className="m-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

      <div className="grid gap-3 p-4 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold uppercase text-neutral-500">Bridge attivi</div><div className="mt-1 text-2xl font-black">{bundle.stats.bridges}</div></div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold uppercase text-neutral-500">Da associare</div><div className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">{bundle.stats.needs_mapping}</div></div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold uppercase text-neutral-500">Conflitti</div><div className="mt-1 text-2xl font-black text-red-700 dark:text-red-300">{bundle.stats.conflicts}</div></div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"><div className="text-xs font-bold uppercase text-neutral-500">Risolti</div><div className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{bundle.stats.resolved}</div></div>
      </div>

      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-3 font-black">Bridge Windows</div>
        {bundle.bridges.length === 0 ? <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">Nessun bridge registrato. Nel prossimo step la Bridge Key sostituirà la singola Device Key del programma Windows.</div> : <div className="grid gap-3 xl:grid-cols-2">
          {bundle.bridges.map((bridge) => <div key={bridge.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-black">{bridge.name}</div><div className="mt-1 text-xs text-neutral-500">{bridge.machine_name || "PC non ancora identificato"} · key {bridge.active_key_prefix || "—"}</div><div className="mt-1 text-xs text-neutral-500">Ultimo contatto: {fmtDate(bridge.last_seen_at)} · Coda: {bridge.pending_count}</div></div>
              {canEdit && <button disabled={savingId===`key-${bridge.id}`} onClick={() => void rotateBridgeKey(bridge)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-bold dark:border-neutral-700"><KeyRound size={13}/>Ruota key</button>}
            </div>
            <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <div className="mb-2 text-xs font-bold uppercase text-neutral-500">Logger autorizzati</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {bundle.devices.filter((d) => d.status === "active").map((d) => {
                  const selected = (bridgeSelections[bridge.id] || []).includes(d.id);
                  return <label key={d.id} className="flex items-start gap-2 rounded-lg border border-neutral-200 p-2 text-xs dark:border-neutral-800">
                    <input type="checkbox" disabled={!canEdit} checked={selected} onChange={(e) => setBridgeSelections((all) => ({ ...all, [bridge.id]: e.target.checked ? [...new Set([...(all[bridge.id] || []), d.id])] : (all[bridge.id] || []).filter((id) => id !== d.id) }))}/>
                    <span><b>{d.name}</b><span className="block text-neutral-500">{d.car_name}{d.serial_number ? ` · ${d.serial_number}` : ""}</span></span>
                  </label>;
                })}
              </div>
              {canEdit && <div className="mt-3 flex justify-end"><button disabled={savingId===`bridge-${bridge.id}`} onClick={() => void saveBridgeDevices(bridge)} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950"><Save size={13}/>{savingId===`bridge-${bridge.id}`?"Salvataggio...":"Salva logger"}</button></div>}
            </div>
          </div>)}
        </div>}
      </div>

      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-1 font-black">XRK da associare</div>
        <div className="mb-3 text-xs text-neutral-500">Il mapping salva l'associazione ma non importa il file: il bridge dovrà rieseguire il resolver e ottenere <code>resolved</code>.</div>
        {queue.length === 0 ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Nessun XRK in attesa di associazione.</div> : <div className="space-y-3">
          {queue.map((o) => {
            const vehicle = identityText(o.identity,"vehicle_profile","vehicle") || "—";
            const serial = identityText(o.identity,"serial_number","external_device_id") || "—";
            const fileName = identityText(o.identity,"file_name") || `${o.file_sha256.slice(0,12)}…`;
            const draft = mappingDrafts[o.id] || { carId: "", deviceId: "", replaceConflicts: false };
            const bridge = bundle.bridges.find((b) => b.id === o.bridge_id);
            const allowed = new Set(bridge?.enabled_device_ids || []);
            const deviceOptions = bundle.devices.filter((d) => d.status === "active");
            return <div key={o.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(o.status)}`}>{statusLabel(o)}</span><span className="text-xs font-semibold">{o.bridge_name}</span></div><div className="mt-2 truncate text-sm font-bold" title={fileName}>{fileName}</div><div className="mt-1 text-xs text-neutral-500">Sessione: {fmtDate(o.session_started_at)} · rilevato {o.occurrences}×</div></div>
                <div className="text-xs text-neutral-500 md:text-right"><div>Vehicle: <b className="text-neutral-800 dark:text-neutral-200">{vehicle}</b></div><div>Seriale/ID: <b className="text-neutral-800 dark:text-neutral-200">{serial}</b></div></div>
              </div>
              <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"><b>{o.reason_code}</b> · {o.message || "Verifica richiesta"}</div>
              {canEdit && <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Vettura<select value={draft.carId} onChange={(e) => setMappingDrafts((all) => ({...all,[o.id]:{...draft,carId:e.target.value}}))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"><option value="">Seleziona vettura</option>{bundle.cars.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Logger<select value={draft.deviceId} onChange={(e) => setMappingDrafts((all) => ({...all,[o.id]:{...draft,deviceId:e.target.value}}))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"><option value="">Seleziona logger</option>{deviceOptions.map((d)=><option key={d.id} value={d.id}>{d.name} · {d.car_name}{allowed.has(d.id)?"":" · verrà autorizzato"}</option>)}</select></label>
                <button disabled={savingId===`mapping-${o.id}` || !draft.carId || !draft.deviceId} onClick={() => void saveMapping(o)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"><Save size={13}/>{savingId===`mapping-${o.id}`?"Salvataggio...":"Salva mapping"}</button>
                <label className="md:col-span-3 flex items-start gap-2 text-xs text-neutral-500"><input type="checkbox" checked={draft.replaceConflicts} onChange={(e) => setMappingDrafts((all) => ({...all,[o.id]:{...draft,replaceConflicts:e.target.checked}}))}/><span><b>Conferma correzione/spostamento</b>: abilita solo se stai correggendo un seriale già associato o spostando il logger da un'altra vettura a partire dalla data della sessione.</span></label>
              </div>}
            </div>;
          })}
        </div>}
      </div>

      <div className="grid border-t border-neutral-200 dark:border-neutral-800 lg:grid-cols-2">
        <div className="p-4 lg:border-r lg:border-neutral-200 lg:dark:border-neutral-800"><div className="mb-3 font-black">Vehicle Race Studio attivi</div>{currentAliases.length===0?<div className="text-sm text-neutral-500">Nessun alias Vehicle configurato.</div>:<div className="space-y-2">{currentAliases.map((a)=><div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-800"><span><b>{a.alias_value}</b><span className="block text-xs text-neutral-500">{a.provider} · dal {fmtDate(a.valid_from)}</span></span><span className="font-bold">{a.car_name}</span></div>)}</div>}</div>
        <div className="p-4"><div className="mb-3 font-black">Assegnazioni logger correnti</div>{currentAssignments.length===0?<div className="text-sm text-neutral-500">Nessun logger in modalità storico assegnazioni.</div>:<div className="space-y-2">{currentAssignments.map((a)=><div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-800"><span><b>{a.device_name}</b><span className="block text-xs text-neutral-500">dal {fmtDate(a.valid_from)}</span></span><span className="font-bold">{a.car_name}</span></div>)}</div>}</div>
      </div>

      {recentResolved.length > 0 && <div className="border-t border-neutral-200 p-4 dark:border-neutral-800"><div className="mb-2 text-xs font-bold uppercase text-neutral-500">Ultimi routing risolti</div><div className="flex flex-wrap gap-2">{recentResolved.map((o)=><span key={o.id} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{identityText(o.identity,"vehicle_profile","vehicle") || o.resolved_device_name || "XRK"} → {o.resolved_car_name || "vettura"}</span>)}</div></div>}
    </section>

    {showCreateBridge && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"><h2 className="text-xl font-black">Registra AiM Bridge</h2><p className="mt-1 text-sm text-neutral-500">La Bridge Key identifica questa installazione Windows; i logger autorizzati possono essere modificati anche in seguito.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nome bridge<input value={bridgeForm.name} onChange={(e)=>setBridgeForm({...bridgeForm,name:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900" placeholder="PC Race Studio box"/></label><label className="text-sm font-semibold">Nome PC (opzionale)<input value={bridgeForm.machineName} onChange={(e)=>setBridgeForm({...bridgeForm,machineName:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900" placeholder="RACE-PC-01"/></label></div><div className="mt-4"><div className="mb-2 text-sm font-bold">Logger autorizzati</div><div className="grid max-h-60 gap-2 overflow-auto sm:grid-cols-2">{bundle.devices.filter((d)=>d.status==='active').map((d)=>{const checked=bridgeForm.deviceIds.includes(d.id);return <label key={d.id} className="flex items-start gap-2 rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800"><input type="checkbox" checked={checked} onChange={(e)=>setBridgeForm({...bridgeForm,deviceIds:e.target.checked?[...new Set([...bridgeForm.deviceIds,d.id])]:bridgeForm.deviceIds.filter((id)=>id!==d.id)})}/><span><b>{d.name}</b><span className="block text-xs text-neutral-500">{d.car_name}{d.serial_number?` · ${d.serial_number}`:""}</span></span></label>})}</div></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowCreateBridge(false)} className="rounded-xl border border-neutral-300 px-4 py-2 font-semibold dark:border-neutral-700">Annulla</button><button disabled={savingId==='create-bridge'||!bridgeForm.name.trim()} onClick={()=>void createBridge()} className="rounded-xl bg-neutral-900 px-4 py-2 font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">{savingId==='create-bridge'?"Creazione...":"Crea e genera Bridge Key"}</button></div></div></div>}

    {secret && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"><h2 className="text-xl font-black">{secret.title}</h2><div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Salva questa Bridge Key adesso. Viene mostrata una sola volta e nel database resta soltanto l'hash.</div><div className="mt-4 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-neutral-950 p-3 text-sm text-white">{secret.value}</code><button onClick={()=>void navigator.clipboard.writeText(secret.value)} className="rounded-xl border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900"><Copy size={18}/></button></div><div className="mt-5 flex justify-end"><button onClick={()=>setSecret(null)} className="rounded-xl bg-neutral-900 px-4 py-2 font-bold text-white dark:bg-white dark:text-neutral-950">Ho salvato la chiave</button></div></div></div>}
  </>;
}
