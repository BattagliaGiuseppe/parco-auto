"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Gauge, Disc3, ChevronUp, ChevronDown, Save, CheckCircle2 } from "lucide-react";

type SetupData = {
  front_pressure?: number | null;
  rear_pressure?: number | null;
  ride_height?: number | null;
  camber_front?: number | null;
  camber_rear?: number | null;
  wing_angle?: number | null;
  notes?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatNum(v?: number | null, fallback = "") {
  return (v ?? "") as any;
}

export default function SetupPanel({
  eventCarId,
  onSaved,
}: {
  eventCarId: string;
  onSaved?: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(0); // per animazione ✅
  const [setup, setSetup] = useState<SetupData>({});

  // ------- caricamento iniziale -------
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_car_setup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      setSetup({
        front_pressure: data?.front_pressure ?? null,
        rear_pressure: data?.rear_pressure ?? null,
        ride_height: data?.ride_height ?? null,
        camber_front: data?.camber_front ?? null,
        camber_rear: data?.camber_rear ?? null,
        wing_angle: data?.wing_angle ?? null,
        notes: data?.notes ?? "",
      });
      setLoading(false);
    })();
  }, [eventCarId]);

  // ------- autosave (debounce) -------
  const debounceTimer = useRef<any>(null);
  const dirtyKey = useMemo(
    () =>
      JSON.stringify([
        setup.front_pressure,
        setup.rear_pressure,
        setup.ride_height,
        setup.camber_front,
        setup.camber_rear,
        setup.wing_angle,
        setup.notes,
      ]),
    [setup]
  );

  useEffect(() => {
    // non autosalvare durante il primo caricamento
    if (loading) return;
    // salva dopo 800ms che l’utente ha smesso di toccare
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      await saveSetup(false);
    }, 800);
    return () => clearTimeout(debounceTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyKey]);

  async function saveSetup(manual = true) {
    setSaving(true);
    const payload = {
      event_car_id: eventCarId,
      front_pressure: setup.front_pressure ?? null,
      rear_pressure: setup.rear_pressure ?? null,
      ride_height: setup.ride_height ?? null,
      camber_front: setup.camber_front ?? null,
      camber_rear: setup.camber_rear ?? null,
      wing_angle: setup.wing_angle ?? null,
      notes: setup.notes ?? null,
    };
    const { error } = await supabase.from("event_car_setup").upsert(payload);
    setSaving(false);
    if (!error) {
      setSavedTick((t) => t + 1);
      if (manual && onSaved) onSaved("Assetto salvato ✅");
    } else {
      if (manual) alert("Errore salvataggio assetto: " + error.message);
    }
  }

  // ------- helpers UI -------
  const step = {
    pressure: 0.05, // bar
    camber: 0.1, // °
    height: 1, // mm
    wing: 0.5, // °
  };

  const bump = (
    key: keyof SetupData,
    delta: number,
    limits?: { min?: number; max?: number }
  ) => {
    setSetup((s) => {
      const before = Number(s[key] ?? 0);
      const next = clamp(before + delta, limits?.min ?? -9999, limits?.max ?? 9999);
      return { ...s, [key]: parseFloat(next.toFixed(2)) };
    });
  };

  const setNum = (
    key: keyof SetupData,
    value: string,
    limits?: { min?: number; max?: number }
  ) => {
    const n = value === "" ? null : Number(value);
    setSetup((s) => ({
      ...s,
      [key]:
        n === null || Number.isNaN(n)
          ? null
          : clamp(n, limits?.min ?? -9999, limits?.max ?? 9999),
    }));
  };

  if (loading) {
    return <div className="p-5 text-gray-600">Caricamento assetto...</div>;
  }

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      {/* Header sezione */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Gauge className="text-yellow-500" /> Assetto (touch UI)
        </h2>

        <button
          onClick={() => saveSetup(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
          title="Salva assetto"
        >
          <Save size={16} />
          Salva
          <CheckCircle2
            size={18}
            className={`transition-opacity ${savedTick ? "opacity-100" : "opacity-0"}`}
          />
        </button>
      </div>

      {/* Vista auto + punti interattivi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SVG silhouette + punti */}
        <div className="relative rounded-xl border bg-gray-50 p-4">
          {/* Silhouette semplice dall’alto */}
          <div className="w-full aspect-[4/3] relative">
            {/* corpo */}
            <div className="absolute inset-[10%] rounded-2xl bg-gradient-to-b from-gray-200 to-gray-300 shadow-inner" />
            {/* abitacolo */}
            <div className="absolute left-[35%] right-[35%] top-[25%] bottom-[25%] rounded-xl bg-gray-100 shadow-inner" />
            {/* alettone posteriore */}
            <div className="absolute left-[25%] right-[25%] bottom-[6%] h-[6%] rounded bg-gray-400" />

            {/* ruote: 4 dischi */}
            {[
              { id: "FL", x: "16%", y: "18%" },
              { id: "FR", x: "84%", y: "18%" },
              { id: "RL", x: "16%", y: "82%" },
              { id: "RR", x: "84%", y: "82%" },
            ].map((w) => (
              <div
                key={w.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
                style={{ left: w.x, top: w.y }}
              >
                <Disc3 className="text-gray-700" />
                <span className="text-[10px] font-semibold text-gray-600">{w.id}</span>
              </div>
            ))}

            {/* Tag attivi con valori correnti */}
            {/* Pressioni */}
            <div className="absolute left-[8%] top-1/2 -translate-y-1/2 flex flex-col items-start gap-1">
              <div className="px-2 py-1 rounded bg-white shadow text-[11px]">
                Ant. {formatNum(setup.front_pressure)} bar
              </div>
              <div className="px-2 py-1 rounded bg-white shadow text-[11px]">
                Post. {formatNum(setup.rear_pressure)} bar
              </div>
            </div>
            {/* Camber */}
            <div className="absolute right-[8%] top-1/2 -translate-y-1/2 flex flex-col items-end gap-1">
              <div className="px-2 py-1 rounded bg-white shadow text-[11px]">
                Camber Ant. {formatNum(setup.camber_front)}°
              </div>
              <div className="px-2 py-1 rounded bg-white shadow text-[11px]">
                Camber Post. {formatNum(setup.camber_rear)}°
              </div>
            </div>
            {/* Ride height */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[12%] px-2 py-1 rounded bg-white shadow text-[11px]">
              Altezza {formatNum(setup.ride_height)} mm
            </div>
            {/* Wing angle */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[2%] px-2 py-1 rounded bg-white shadow text-[11px]">
              Ala {formatNum(setup.wing_angle)}°
            </div>
          </div>
        </div>

        {/* Controlli touch: slider + stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pressione anteriore */}
          <ControlCard
            label="Pressione anteriore"
            unit="bar"
            value={setup.front_pressure}
            onMinus={() => bump("front_pressure", -step.pressure, { min: 0.8, max: 2.5 })}
            onPlus={() => bump("front_pressure", step.pressure, { min: 0.8, max: 2.5 })}
          >
            <input
              type="range"
              min={0.8}
              max={2.5}
              step={0.05}
              value={setup.front_pressure ?? 1.5}
              onChange={(e) => setNum("front_pressure", e.target.value, { min: 0.8, max: 2.5 })}
              className="w-full"
            />
            <NumericField
              value={setup.front_pressure}
              onChange={(v) => setNum("front_pressure", v, { min: 0.8, max: 2.5 })}
              placeholder="bar"
            />
          </ControlCard>

          {/* Pressione posteriore */}
          <ControlCard
            label="Pressione posteriore"
            unit="bar"
            value={setup.rear_pressure}
            onMinus={() => bump("rear_pressure", -step.pressure, { min: 0.8, max: 2.5 })}
            onPlus={() => bump("rear_pressure", step.pressure, { min: 0.8, max: 2.5 })}
          >
            <input
              type="range"
              min={0.8}
              max={2.5}
              step={0.05}
              value={setup.rear_pressure ?? 1.5}
              onChange={(e) => setNum("rear_pressure", e.target.value, { min: 0.8, max: 2.5 })}
              className="w-full"
            />
            <NumericField
              value={setup.rear_pressure}
              onChange={(v) => setNum("rear_pressure", v, { min: 0.8, max: 2.5 })}
              placeholder="bar"
            />
          </ControlCard>

          {/* Camber anteriore */}
          <ControlCard
            label="Camber anteriore"
            unit="°"
            value={setup.camber_front}
            onMinus={() => bump("camber_front", -step.camber, { min: -6, max: 2 })}
            onPlus={() => bump("camber_front", step.camber, { min: -6, max: 2 })}
          >
            <input
              type="range"
              min={-6}
              max={2}
              step={0.1}
              value={setup.camber_front ?? -2}
              onChange={(e) => setNum("camber_front", e.target.value, { min: -6, max: 2 })}
              className="w-full"
            />
            <NumericField
              value={setup.camber_front}
              onChange={(v) => setNum("camber_front", v, { min: -6, max: 2 })}
              placeholder="°"
            />
          </ControlCard>

          {/* Camber posteriore */}
          <ControlCard
            label="Camber posteriore"
            unit="°"
            value={setup.camber_rear}
            onMinus={() => bump("camber_rear", -step.camber, { min: -6, max: 2 })}
            onPlus={() => bump("camber_rear", step.camber, { min: -6, max: 2 })}
          >
            <input
              type="range"
              min={-6}
              max={2}
              step={0.1}
              value={setup.camber_rear ?? -1.5}
              onChange={(e) => setNum("camber_rear", e.target.value, { min: -6, max: 2 })}
              className="w-full"
            />
            <NumericField
              value={setup.camber_rear}
              onChange={(v) => setNum("camber_rear", v, { min: -6, max: 2 })}
              placeholder="°"
            />
          </ControlCard>

          {/* Altezza */}
          <ControlCard
            label="Altezza vettura"
            unit="mm"
            value={setup.ride_height}
            onMinus={() => bump("ride_height", -step.height, { min: 40, max: 120 })}
            onPlus={() => bump("ride_height", step.height, { min: 40, max: 120 })}
            emphasis
          >
            <input
              type="range"
              min={40}
              max={120}
              step={1}
              value={setup.ride_height ?? 70}
              onChange={(e) => setNum("ride_height", e.target.value, { min: 40, max: 120 })}
              className="w-full"
            />
            <NumericField
              value={setup.ride_height}
              onChange={(v) => setNum("ride_height", v, { min: 40, max: 120 })}
              placeholder="mm"
              big
            />
          </ControlCard>

          {/* Angolo Ala */}
          <ControlCard
            label="Angolo ala"
            unit="°"
            value={setup.wing_angle}
            onMinus={() => bump("wing_angle", -step.wing, { min: 0, max: 30 })}
            onPlus={() => bump("wing_angle", step.wing, { min: 0, max: 30 })}
          >
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={setup.wing_angle ?? 10}
              onChange={(e) => setNum("wing_angle", e.target.value, { min: 0, max: 30 })}
              className="w-full"
            />
            <NumericField
              value={setup.wing_angle}
              onChange={(v) => setNum("wing_angle", v, { min: 0, max: 30 })}
              placeholder="°"
            />
          </ControlCard>
        </div>
      </div>

      {/* Note assetto */}
      <div className="mt-5">
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Note assetto
        </label>
        <textarea
          value={setup.notes ?? ""}
          onChange={(e) => setSetup((s) => ({ ...s, notes: e.target.value }))}
          className="w-full border rounded-lg p-3"
          rows={3}
          placeholder="Annotazioni rapide: condizioni meteo, feeling pilota, modifiche eseguite…"
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
/*  COMPONENTI UI: schede di controllo, input numerici grandi  */
/* ---------------------------------------------------------- */

function ControlCard({
  label,
  unit,
  value,
  onMinus,
  onPlus,
  children,
  emphasis,
}: {
  label: string;
  unit: string;
  value?: number | null;
  onMinus: () => void;
  onPlus: () => void;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 bg-white shadow-sm flex flex-col gap-3 ${
        emphasis ? "ring-1 ring-yellow-400" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-800">{label}</div>
        <div className="text-sm text-gray-500">
          {value ?? "—"} {unit}
        </div>
      </div>
      {children}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onMinus}
          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100"
        >
          <ChevronDown size={16} />
          meno
        </button>
        <button
          type="button"
          onClick={onPlus}
          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gray-900 text-yellow-400 hover:bg-gray-800"
        >
          più
          <ChevronUp size={16} />
        </button>
      </div>
    </div>
  );
}

function NumericField({
  value,
  onChange,
  placeholder,
  big,
}: {
  value?: number | null;
  onChange: (v: string) => void;
  placeholder?: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`border rounded-lg px-3 py-2 w-full ${
          big ? "text-xl font-bold" : ""
        }`}
      />
    </div>
  );
}
