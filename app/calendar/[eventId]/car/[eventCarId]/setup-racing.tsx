"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Gauge, Save, CheckCircle2 } from "lucide-react";

/**
 * Requisiti DB:
 * ALTER TABLE public.event_car_setup ADD COLUMN IF NOT EXISTS extras jsonb DEFAULT '{}'::jsonb;
 * (opzionale) ALTER TABLE public.event_car_setup_history ADD COLUMN IF NOT EXISTS extras jsonb DEFAULT '{}'::jsonb;
 */

type Extras = Record<string, any>; // useremo path "front.fl.pressure", ecc.

const RANGES: Record<string, { min: number; max: number; step?: number; unit?: string }> = {
  "front.fl.pressure": { min: 1.2, max: 2.2, step: 0.01, unit: "bar" },
  "front.fr.pressure": { min: 1.2, max: 2.2, step: 0.01, unit: "bar" },
  "rear.rl.pressure":  { min: 1.2, max: 2.2, step: 0.01, unit: "bar" },
  "rear.rr.pressure":  { min: 1.2, max: 2.2, step: 0.01, unit: "bar" },

  "front.fl.camber": { min: -6, max: 0, step: 0.1, unit: "°" },
  "front.fr.camber": { min: -6, max: 0, step: 0.1, unit: "°" },
  "rear.rl.camber":  { min: -6, max: 0, step: 0.1, unit: "°" },
  "rear.rr.camber":  { min: -6, max: 0, step: 0.1, unit: "°" },

  "front.fl.toe": { min: -5, max: 5, step: 0.1, unit: "mm" },
  "front.fr.toe": { min: -5, max: 5, step: 0.1, unit: "mm" },
  "rear.rl.toe":  { min: -5, max: 5, step: 0.1, unit: "mm" },
  "rear.rr.toe":  { min: -5, max: 5, step: 0.1, unit: "mm" },

  "front.fl.ride_height": { min: 40, max: 120, step: 1, unit: "mm" },
  "front.fr.ride_height": { min: 40, max: 120, step: 1, unit: "mm" },
  "rear.rl.ride_height":  { min: 40, max: 120, step: 1, unit: "mm" },
  "rear.rr.ride_height":  { min: 40, max: 120, step: 1, unit: "mm" },

  "front.fl.spring_rate": { min: 50, max: 250, step: 1, unit: "N/mm" },
  "front.fr.spring_rate": { min: 50, max: 250, step: 1, unit: "N/mm" },
  "rear.rl.spring_rate":  { min: 50, max: 250, step: 1, unit: "N/mm" },
  "rear.rr.spring_rate":  { min: 50, max: 250, step: 1, unit: "N/mm" },

  "aero.front_flap": { min: 0, max: 20, step: 0.5, unit: "°" },
  "aero.rear_wing":  { min: 0, max: 30, step: 0.5, unit: "°" },
  "aero.rake":       { min: -20, max: 30, step: 1, unit: "mm" },

  "brakes.bias": { min: 40, max: 70, step: 0.5, unit: "%" },
  "brakes.duct": { min: 0, max: 100, step: 1, unit: "%" },

  "rear.diff_power":   { min: 0, max: 100, step: 1, unit: "%" },
  "rear.diff_coast":   { min: 0, max: 100, step: 1, unit: "%" },
  "rear.diff_preload": { min: 0, max: 300, step: 5, unit: "Nm" },
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
  const [extras, setExtras] = useState<Extras>({});

  // editor popup state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<number>(0);

  const [svgMarkup, setSvgMarkup] = useState<string>("");

  // load base + extras + svg
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_car_setup")
        .select("extras")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      if (data?.extras) setExtras(data.extras);
      else setExtras({});

      // carica SVG e iniettal0 inline per poter intercettare click su data-key
      const resp = await fetch("/setup-griiip.svg");
      const txt = await resp.text();
      setSvgMarkup(txt);

      setLoading(false);
    })();
  }, [eventCarId]);

  // bind click handlers on inline SVG nodes having data-key
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!svgMarkup) return;
    const el = containerRef.current;
    if (!el) return;

    // attach click handler (event delegation)
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const node = target.closest("[data-key]") as HTMLElement | null;
      if (!node) return;

      const key = node.getAttribute("data-key");
      if (!key) return;

      const current = get(extras, key);
      const range = RANGES[key] || { min: 0, max: 100, step: 1, unit: "" };

      setEditorKey(key);
      setEditorValue(
        typeof current === "number" ? current : (range.min + range.max) / 2
      );
      setEditorOpen(true);
    };

    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [svgMarkup, extras]);

  async function save(manual = true) {
    setSaving(true);
    const payload = {
      event_car_id: eventCarId,
      extras,
    };
    const { error } = await supabase.from("event_car_setup").upsert(payload);
    setSaving(false);
    if (!error) {
      setSavedTick((t) => t + 1);
      onSaved?.("Assetto (SVG interattivo) salvato ✅");
      try {
        await supabase.from("event_car_setup_history").insert([
          { event_car_id: eventCarId, extras },
        ]);
      } catch {}
    } else if (manual) {
      alert("Errore salvataggio assetto: " + error.message);
    }
  }

  function applyEditor() {
    if (!editorKey) return;
    const v = Number(editorValue);
    const next = { ...extras };
    set(next, editorKey, v);
    setExtras(next);
    setEditorOpen(false);
    // autosave “soft”
    save(false);
  }

  if (loading) return <div className="p-4 text-gray-300">Caricamento scheda…</div>;

  return (
    <section className="rounded-2xl border border-neutral-700 bg-neutral-950 shadow-[0_0_30px_rgba(255,214,0,0.08)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
          <Gauge className="text-yellow-400" /> Assetto — Scheda Interattiva
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

      {/* SVG inline container */}
      <div
        ref={containerRef}
        className="w-full overflow-auto rounded-xl border border-neutral-800 bg-black"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />

      {/* Editor modal */}
      {editorOpen && editorKey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-neutral-900 p-5">
            <div className="text-gray-100 font-semibold mb-2">
              {editorKey} <span className="text-gray-400">({RANGES[editorKey]?.unit || ""})</span>
            </div>
            <input
              type="range"
              min={RANGES[editorKey]?.min ?? 0}
              max={RANGES[editorKey]?.max ?? 100}
              step={RANGES[editorKey]?.step ?? 1}
              value={editorValue}
              onChange={(e) => setEditorValue(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex items-center gap-3 mt-3">
              <input
                type="number"
                value={editorValue}
                onChange={(e) => setEditorValue(Number(e.target.value))}
                className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 text-gray-100 px-3 py-2"
              />
              <button
                onClick={applyEditor}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                Applica
              </button>
              <button
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 rounded-lg border border-neutral-700 text-gray-200"
              >
                Chiudi
              </button>
            </div>

            {/* Range hint */}
            <div className="text-xs text-gray-400 mt-2">
              Range: {RANGES[editorKey]?.min ?? 0} – {RANGES[editorKey]?.max ?? 100} {RANGES[editorKey]?.unit || ""}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ----------------- tiny utils ----------------- */

function get(obj: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}
function set(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let ref = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!ref[k]) ref[k] = {};
    ref = ref[k];
  }
  ref[parts[parts.length - 1]] = value;
}
