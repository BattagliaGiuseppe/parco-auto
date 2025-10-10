"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Gauge,
  Wrench,
  Fan,
  Wind,
  Settings2,
  Save,
  CheckCircle2,
  GripVertical,
  MoveHorizontal,
  ActivitySquare,
  Flame,
} from "lucide-react";

/**
 * Questo componente:
 * - carica da event_car_setup (campi base) + extras (jsonb) tutti i parametri estesi
 * - consente di modificarli in UI 'racing simulator'
 * - salva su event_car_setup (upsert) mantenendo i campi base + extras
 *
 * Richiede colonna: ALTER TABLE event_car_setup ADD COLUMN extras jsonb DEFAULT '{}'::jsonb;
 */

type BaseSetup = {
  // campi base già presenti in DB
  front_pressure?: number | null;
  rear_pressure?: number | null;
  ride_height?: number | null;
  camber_front?: number | null;
  camber_rear?: number | null;
  wing_angle?: number | null;
  notes?: string | null;
};

type Extras = {
  // FRONT
  front: {
    fl: {
      pressure?: number | null;
      camber?: number | null;
      toe?: number | null;
      spring_rate?: number | null; // N/mm o kgf/mm
      damper_bump?: number | null;
      damper_rebound?: number | null;
      ride_height?: number | null;
      tire_temp_i?: number | null;
      tire_temp_m?: number | null;
      tire_temp_o?: number | null;
    };
    fr: {
      pressure?: number | null;
      camber?: number | null;
      toe?: number | null;
      spring_rate?: number | null;
      damper_bump?: number | null;
      damper_rebound?: number | null;
      ride_height?: number | null;
      tire_temp_i?: number | null;
      tire_temp_m?: number | null;
      tire_temp_o?: number | null;
    };
    arb_stiffness?: number | null; // barra antirollio anteriore
    caster?: number | null; // opzionale
  };

  // REAR
  rear: {
    rl: {
      pressure?: number | null;
      camber?: number | null;
      toe?: number | null;
      spring_rate?: number | null;
      damper_bump?: number | null;
      damper_rebound?: number | null;
      ride_height?: number | null;
      tire_temp_i?: number | null;
      tire_temp_m?: number | null;
      tire_temp_o?: number | null;
    };
    rr: {
      pressure?: number | null;
      camber?: number | null;
      toe?: number | null;
      spring_rate?: number | null;
      damper_bump?: number | null;
      damper_rebound?: number | null;
      ride_height?: number | null;
      tire_temp_i?: number | null;
      tire_temp_m?: number | null;
      tire_temp_o?: number | null;
    };
    arb_stiffness?: number | null; // barra antirollio posteriore
    diff_power?: number | null; // %
    diff_coast?: number | null; // %
    diff_preload?: number | null; // Nm
  };

  // AERO
  aero: {
    front_flap?: number | null; // °
    rear_wing?: number | null; // °
    rake?: number | null; // mm diff RH (post - ant)
  };

  // BRAKES
  brakes: {
    bias?: number | null; // %
    duct?: number | null; // apertura condotti 0-100
    pad_compound?: string | null;
    disc_type?: string | null;
  };

  // TRANSMISSION
  transmission: {
    final_drive?: number | null;
    gearset?: string | null;
    throttle_map?: number | null; // 1-10
    engine_brake?: number | null; // 1-10
    tc_level?: number | null; // traction control 0-10
    abs_level?: number | null; // 0-10
  };

  // VARI
  general: {
    fuel_load?: number | null; // L inizio stint
    ambient_temp?: number | null; // °C
    track_temp?: number | null; // °C
    tire_compound?: string | null;
    notes_internal?: string | null;
  };
};

const defaultExtras: Extras = {
  front: {
    fl: {},
    fr: {},
    arb_stiffness: null,
    caster: null,
  },
  rear: {
    rl: {},
    rr: {},
    arb_stiffness: null,
    diff_power: null,
    diff_coast: null,
    diff_preload: null,
  },
  aero: { front_flap: null, rear_wing: null, rake: null },
  brakes: { bias: null, duct: null, pad_compound: null, disc_type: null },
  transmission: {
    final_drive: null,
    gearset: null,
    throttle_map: null,
    engine_brake: null,
    tc_level: null,
    abs_level: null,
  },
  general: {
    fuel_load: null,
    ambient_temp: null,
    track_temp: null,
    tire_compound: null,
    notes_internal: null,
  },
};

export default function SetupRacing({
  eventCarId,
  onSaved,
}: {
  eventCarId: string;
  onSaved?: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(0);

  // Base + extras
  const [base, setBase] = useState<BaseSetup>({});
  const [extras, setExtras] = useState<Extras>(defaultExtras);

  // Debounce autosave
  const debounceRef = useRef<any>(null);
  const dirtyKey = useMemo(
    () => JSON.stringify([base, extras]),
    [base, extras]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Carico base
      const { data } = await supabase
        .from("event_car_setup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      if (data) {
        setBase({
          front_pressure: toNumOrNull(data.front_pressure),
          rear_pressure: toNumOrNull(data.rear_pressure),
          ride_height: toNumOrNull(data.ride_height),
          camber_front: toNumOrNull(data.camber_front),
          camber_rear: toNumOrNull(data.camber_rear),
          wing_angle: toNumOrNull(data.wing_angle),
          notes: data.notes ?? "",
        });

        // Carico extras
        let ext = data.extras || {};
        setExtras(mergeDeep<Extras>(structuredClone(defaultExtras), ext));
      } else {
        setBase({});
        setExtras(structuredClone(defaultExtras));
      }
      setLoading(false);
    })();
  }, [eventCarId]);

  useEffect(() => {
    if (loading) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(false), 900);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyKey]);

  async function save(manual = true) {
    setSaving(true);
    const payload = {
      event_car_id: eventCarId,
      // base
      front_pressure: base.front_pressure ?? null,
      rear_pressure: base.rear_pressure ?? null,
      ride_height: base.ride_height ?? null,
      camber_front: base.camber_front ?? null,
      camber_rear: base.camber_rear ?? null,
      wing_angle: base.wing_angle ?? null,
      notes: base.notes ?? null,
      // extras
      extras,
    };
    const { error } = await supabase.from("event_car_setup").upsert(payload);
    setSaving(false);
    if (!error) {
      setSavedTick((t) => t + 1);
      if (manual && onSaved) onSaved("Assetto (Racing Sim) salvato ✅");
      // Log opzionale nella history se c'è
      try {
        await supabase.from("event_car_setup_history").insert([
          {
            event_car_id: eventCarId,
            front_pressure: payload.front_pressure,
            rear_pressure: payload.rear_pressure,
            ride_height: payload.ride_height,
            camber_front: payload.camber_front,
            camber_rear: payload.camber_rear,
            wing_angle: payload.wing_angle,
            notes: payload.notes,
            extras: payload.extras,
          },
        ]);
      } catch {}
    } else if (manual) {
      alert("Errore salvataggio assetto: " + error.message);
    }
  }

  if (loading) return <div className="p-4 text-gray-300">Caricamento setup...</div>;

  return (
    <section className="rounded-2xl border border-neutral-700 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black shadow-[0_0_30px_rgba(255,214,0,0.08)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
          <Gauge className="text-yellow-400" /> Assetto — Racing Simulator
        </h2>
        <button
          onClick={() => save(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
        >
          <Save size={16} />
          Salva
          <CheckCircle2
            size={18}
            className={`transition-opacity ${savedTick ? "opacity-100" : "opacity-0"}`}
          />
        </button>
      </div>

      {/* Base KPIs (digit) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi
          icon={<GripVertical className="text-yellow-400" />}
          label="Ride Height"
          value={fmt(base.ride_height, "mm")}
        />
        <Kpi
          icon={<Fan className="text-yellow-400" />}
          label="Pressione ANT"
          value={fmt(base.front_pressure, "bar")}
        />
        <Kpi
          icon={<Fan className="text-yellow-400" />}
          label="Pressione POST"
          value={fmt(base.rear_pressure, "bar")}
        />
        <Kpi
          icon={<Wind className="text-yellow-400" />}
          label="Ala"
          value={fmt(base.wing_angle, "°")}
        />
      </div>

      {/* Immagine / silhouette (se usi /public/car.svg) */}
      <div className="relative rounded-xl border border-neutral-700 bg-neutral-900 p-4 mb-5">
        <div className="w-full aspect-[4/3] relative overflow-hidden rounded-lg">
          <img src="/car.svg" alt="Car Top View" className="absolute inset-0 w-full h-full object-contain opacity-80" />
          {/* Tag rapidi */}
          <Tag style={{ left: "10%", top: "18%" }}>FL Camber {fmt(extras.front.fl.camber, "°")}</Tag>
          <Tag style={{ right: "10%", top: "18%" }}>FR Camber {fmt(extras.front.fr.camber, "°")}</Tag>
          <Tag style={{ left: "10%", bottom: "18%" }}>RL Camber {fmt(extras.rear.rl.camber, "°")}</Tag>
          <Tag style={{ right: "10%", bottom: "18%" }}>RR Camber {fmt(extras.rear.rr.camber, "°")}</Tag>
          <Tag style={{ left: "50%", transform: "translateX(-50%)", bottom: "6%" }}>
            Rake {fmt(extras.aero.rake, "mm")}
          </Tag>
        </div>
      </div>

      {/* Sezioni accordion */}
      <div className="space-y-4">
        <Accordion title="Anteriore" icon={<Wrench className="text-yellow-400" />}>
          <CornerGrid
            title="Ruota Anteriore Sinistra (FL)"
            data={extras.front.fl}
            onChange={(patch) => setExtras((e) => ({ ...e, front: { ...e.front, fl: { ...e.front.fl, ...patch } } }))}
          />
          <CornerGrid
            title="Ruota Anteriore Destra (FR)"
            data={extras.front.fr}
            onChange={(patch) => setExtras((e) => ({ ...e, front: { ...e.front, fr: { ...e.front.fr, ...patch } } }))}
          />
          <LineControls
            rows={[
              { label: "Barra antirollio anteriore", key: "arb_stiffness", min: 0, max: 10, step: 1, unit: "" },
              { label: "Caster", key: "caster", min: 0, max: 10, step: 0.5, unit: "°" },
            ]}
            values={extras.front as any}
            onChange={(key, v) => setExtras((e) => ({ ...e, front: { ...e.front, [key]: v } }))}
          />
        </Accordion>

        <Accordion title="Posteriore" icon={<Wrench className="text-yellow-400" />}>
          <CornerGrid
            title="Ruota Posteriore Sinistra (RL)"
            data={extras.rear.rl}
            onChange={(patch) => setExtras((e) => ({ ...e, rear: { ...e.rear, rl: { ...e.rear.rl, ...patch } } }))}
          />
          <CornerGrid
            title="Ruota Posteriore Destra (RR)"
            data={extras.rear.rr}
            onChange={(patch) => setExtras((e) => ({ ...e, rear: { ...e.rear, rr: { ...e.rear.rr, ...patch } } }))}
          />
          <LineControls
            rows={[
              { label: "Barra antirollio posteriore", key: "arb_stiffness", min: 0, max: 10, step: 1, unit: "" },
              { label: "Diff Power", key: "diff_power", min: 0, max: 100, step: 1, unit: "%" },
              { label: "Diff Coast", key: "diff_coast", min: 0, max: 100, step: 1, unit: "%" },
              { label: "Diff Preload", key: "diff_preload", min: 0, max: 300, step: 5, unit: "Nm" },
            ]}
            values={extras.rear as any}
            onChange={(key, v) => setExtras((e) => ({ ...e, rear: { ...e.rear, [key]: v } }))}
          />
        </Accordion>

        <Accordion title="Aerodinamica" icon={<Wind className="text-yellow-400" />}>
          <LineControls
            rows={[
              { label: "Flap anteriore", key: "front_flap", min: 0, max: 20, step: 0.5, unit: "°" },
              { label: "Ala posteriore", key: "rear_wing", min: 0, max: 30, step: 0.5, unit: "°" },
              { label: "Rake", key: "rake", min: -20, max: 30, step: 1, unit: "mm" },
            ]}
            values={extras.aero as any}
            onChange={(key, v) => setExtras((e) => ({ ...e, aero: { ...e.aero, [key]: v } }))}
          />
        </Accordion>

        <Accordion title="Freni" icon={<Flame className="text-yellow-400" />}>
          <LineControls
            rows={[
              { label: "Brake bias", key: "bias", min: 40, max: 70, step: 0.5, unit: "%" },
              { label: "Apertura condotti", key: "duct", min: 0, max: 100, step: 5, unit: "%" },
            ]}
            values={extras.brakes as any}
            onChange={(key, v) => setExtras((e) => ({ ...e, brakes: { ...e.brakes, [key]: v } }))}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="Mescola pastiglie"
              value={extras.brakes.pad_compound || ""}
              onChange={(val) => setExtras((e) => ({ ...e, brakes: { ...e.brakes, pad_compound: val || null } }))}
              placeholder="Es. PFC11 / CL RC6"
            />
            <TextField
              label="Tipo disco"
              value={extras.brakes.disc_type || ""}
              onChange={(val) => setExtras((e) => ({ ...e, brakes: { ...e.brakes, disc_type: val || null } }))}
              placeholder="Es. baffato, forato"
            />
          </div>
        </Accordion>

        <Accordion title="Trasmissione / Elettronica" icon={<Settings2 className="text-yellow-400" />}>
          <LineControls
            rows={[
              { label: "Final drive", key: "final_drive", min: 2.5, max: 5.0, step: 0.01, unit: "" },
              { label: "Throttle map", key: "throttle_map", min: 1, max: 10, step: 1, unit: "" },
              { label: "Engine brake", key: "engine_brake", min: 0, max: 10, step: 1, unit: "" },
              { label: "TC level", key: "tc_level", min: 0, max: 10, step: 1, unit: "" },
              { label: "ABS level", key: "abs_level", min: 0, max: 10, step: 1, unit: "" },
            ]}
            values={extras.transmission as any}
            onChange={(key, v) => setExtras((e) => ({ ...e, transmission: { ...e.transmission, [key]: v } }))}
          />
          <TextField
            label="Gearset"
            value={extras.transmission.gearset || ""}
            onChange={(val) => setExtras((e) => ({ ...e, transmission: { ...e.transmission, gearset: val || null } }))}
            placeholder="Es. Medium, Monza, Valencia…"
          />
        </Accordion>

        <Accordion title="Generali / Ambientali" icon={<ActivitySquare className="text-yellow-400" />}>
          <LineControls
            rows={[
              { label: "Fuel load (inizio)", key: "fuel_load", min: 0, max: 120, step: 1, unit: "L" },
              { label: "Temp aria", key: "ambient_temp", min: -5, max: 50, step: 1, unit: "°C" },
              { label: "Temp asfalto", key: "track_temp", min: -5, max: 80, step: 1, unit: "°C" },
            ]}
            values={extras.general as any}
            onChange={(key, v) => setExtras((e) => ({ ...e, general: { ...e.general, [key]: v } }))}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="Mescola gomme"
              value={extras.general.tire_compound || ""}
              onChange={(val) => setExtras((e) => ({ ...e, general: { ...e.general, tire_compound: val || null } }))}
              placeholder="Es. Slick S9 / Rain"
            />
            <TextField
              label="Note interne"
              value={extras.general.notes_internal || ""}
              onChange={(val) => setExtras((e) => ({ ...e, general: { ...e.general, notes_internal: val || null } }))}
              placeholder="Osservazioni ingegnere, pre-briefing, ecc."
            />
          </div>
        </Accordion>
      </div>
    </section>
  );
}

/* ------------------------- UI helpers ------------------------- */

function toNumOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v?: number | null, unit?: string) {
  if (v === null || v === undefined) return "—";
  return `${v}${unit ? " " + unit : ""}`;
}

function mergeDeep<T>(target: T, source: any): T {
  for (const k in source || {}) {
    if (
      source[k] &&
      typeof source[k] === "object" &&
      !Array.isArray(source[k])
    ) {
      // @ts-ignore
      target[k] = mergeDeep(target[k] ?? {}, source[k]);
    } else {
      // @ts-ignore
      target[k] = source[k];
    }
  }
  return target;
}

/* -------------------------- Components ------------------------ */

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-3 shadow-inner">
      <div className="flex items-center gap-2 text-gray-400 text-sm">{icon}{label}</div>
      <div className="text-2xl md:text-3xl font-bold text-yellow-400 tracking-wide">{value}</div>
    </div>
  );
}

function Tag({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="absolute px-2 py-1 rounded bg-black/70 border border-yellow-500/40 text-[11px] text-yellow-100 shadow-[0_0_12px_rgba(255,214,0,0.2)]"
      style={style}
    >
      {children}
    </div>
  );
}

function Accordion({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-neutral-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-950 text-gray-100"
      >
        <div className="flex items-center gap-2">{icon}<span className="font-semibold">{title}</span></div>
        <span className="text-yellow-400 text-sm">{open ? "Nascondi" : "Apri"}</span>
      </button>
      {open && <div className="bg-neutral-900 p-4">{children}</div>}
    </div>
  );
}

function CornerGrid({
  title,
  data,
  onChange,
}: {
  title: string;
  data: any;
  onChange: (patch: Record<string, number | null>) => void;
}) {
  const rows = [
    { key: "pressure", label: "Pressione", min: 0.8, max: 2.5, step: 0.05, unit: "bar" },
    { key: "camber", label: "Camber", min: -6, max: 2, step: 0.1, unit: "°" },
    { key: "toe", label: "Toe", min: -5, max: 5, step: 0.1, unit: "mm" },
    { key: "ride_height", label: "Ride Height", min: 40, max: 120, step: 1, unit: "mm" },
    { key: "spring_rate", label: "Molla", min: 50, max: 250, step: 5, unit: "N/mm" },
    { key: "damper_bump", label: "Smorz. Bump", min: 0, max: 30, step: 1, unit: "click" },
    { key: "damper_rebound", label: "Smorz. Rebound", min: 0, max: 30, step: 1, unit: "click" },
    { key: "tire_temp_i", label: "Temp. I", min: 20, max: 130, step: 1, unit: "°C" },
    { key: "tire_temp_m", label: "Temp. M", min: 20, max: 130, step: 1, unit: "°C" },
    { key: "tire_temp_o", label: "Temp. O", min: 20, max: 130, step: 1, unit: "°C" },
  ];
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-200 mb-2">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {rows.map((r) => (
          <LineControl
            key={r.key}
            label={r.label}
            value={valOrEmpty(data?.[r.key])}
            min={r.min}
            max={r.max}
            step={r.step}
            unit={r.unit}
            onChange={(v) => onChange({ [r.key]: v })}
          />
        ))}
      </div>
    </div>
  );
}

function LineControls({
  rows,
  values,
  onChange,
}: {
  rows: { label: string; key: string; min: number; max: number; step: number; unit: string }[];
  values: Record<string, any>;
  onChange: (key: string, v: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {rows.map((r) => (
        <LineControl
          key={r.key}
          label={r.label}
          value={valOrEmpty(values?.[r.key])}
          min={r.min}
          max={r.max}
          step={r.step}
          unit={r.unit}
          onChange={(v) => onChange(r.key, v)}
        />
      ))}
    </div>
  );
}

function LineControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number | null) => void;
}) {
  const [local, setLocal] = useState<number>(Number(value ?? min));
  useEffect(() => {
    setLocal(Number(value ?? min));
  }, [value, min]);

  return (
    <div className="rounded-lg border border-neutral-700 p-3 bg-neutral-950">
      <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
        <span>{label}</span>
        <span className="text-yellow-400 font-semibold">{value ?? "—"} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        onChange={(e) => {
          const v = Number(e.target.value);
          setLocal(v);
          onChange(v);
        }}
        className="w-full accent-yellow-500"
      />
      <div className="mt-2">
        <input
          type="number"
          value={Number.isFinite(value as number) ? (value as number) : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={unit}
          className="w-full border border-neutral-700 rounded-md px-3 py-2 bg-neutral-900 text-gray-100"
        />
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-700 p-3 bg-neutral-950">
      <label className="block text-sm text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-neutral-700 rounded-md px-3 py-2 bg-neutral-900 text-gray-100"
      />
    </div>
  );
}

function valOrEmpty(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
