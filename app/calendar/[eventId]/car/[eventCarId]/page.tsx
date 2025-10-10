"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  Fuel,
  Gauge,
  StickyNote,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CheckupItems = Record<string, boolean>;

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as { eventId: string; eventCarId: string };

  // Dark mode predefinita
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // sezioni
  const [setup, setSetup] = useState<any>({});
  const [checkup, setCheckup] = useState<{ items?: CheckupItems; notes?: string }>({
    items: {},
    notes: "",
  });
  const [fuel, setFuel] = useState<any>({});
  const [notes, setNotes] = useState("");

  // storici (ultime 5 righe mostrate)
  const [setupHistory, setSetupHistory] = useState<any[]>([]);
  const [checkHistory, setCheckHistory] = useState<any[]>([]);
  const [fuelHistory, setFuelHistory] = useState<any[]>([]);

  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: eventData } = await supabase
        .from("events")
        .select("id, name, date")
        .eq("id", eventId)
        .single();

      const { data: carData } = await supabase
        .from("event_cars")
        .select("id, car_id (id, name), notes")
        .eq("id", eventCarId)
        .single();

      const { data: setupData } = await supabase
        .from("event_car_setup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      const { data: checkupData } = await supabase
        .from("event_car_checkup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      const { data: fuelData } = await supabase
        .from("event_car_fuel")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      setEvent(eventData || null);
      setCar(carData?.car_id || null);
      setNotes(carData?.notes || "");
      setSetup(setupData || {});
      setCheckup(
        checkupData
          ? { items: checkupData.items || {}, notes: checkupData.notes || "" }
          : { items: {}, notes: "" }
      );
      setFuel(fuelData || {});

      // prova a caricare storici se esistono tabelle *_history (se non esistono, ignora)
      try {
        const { data: sh } = await supabase
          .from("event_car_setup_history")
          .select("*")
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: false });
        if (sh) setSetupHistory(sh);
      } catch {}

      try {
        const { data: ch } = await supabase
          .from("event_car_checkup_history")
          .select("*")
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: false });
        if (ch) setCheckHistory(ch);
      } catch {}

      try {
        const { data: fh } = await supabase
          .from("event_car_fuel_history")
          .select("*")
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: false });
        if (fh) setFuelHistory(fh);
      } catch {}

      setLoading(false);
    };

    fetchData();
  }, [eventId, eventCarId]);

  // ---------- SALVATAGGI + STORICI ----------
  const handleSaveSetup = async () => {
    const payload = {
      event_car_id: eventCarId,
      front_pressure: toNumOrNull(setup.front_pressure),
      rear_pressure: toNumOrNull(setup.rear_pressure),
      ride_height: toNumOrNull(setup.ride_height),
      camber_front: toNumOrNull(setup.camber_front),
      camber_rear: toNumOrNull(setup.camber_rear),
      wing_angle: toNumOrNull(setup.wing_angle),
      notes: setup.notes || null,
    };

    const { error } = await supabase.from("event_car_setup").upsert(payload);
    if (error) return alert("Errore salvataggio assetto: " + error.message);

    // aggiungi a storico (locale) e tenta persistenza
    const row = { ...payload, created_at: new Date().toISOString(), id: cryptoId() };
    setSetupHistory((prev) => [row, ...prev].slice(0, 50));
    try {
      await supabase.from("event_car_setup_history").insert([row]);
    } catch {}
    showToast("Assetto salvato ✅");
  };

  const handleSaveCheckup = async () => {
    const payload = {
      event_car_id: eventCarId,
      items: checkup.items || {},
      notes: checkup.notes || "",
    };
    const { error } = await supabase.from("event_car_checkup").upsert(payload);
    if (error) return alert("Errore salvataggio check-up: " + error.message);

    const row = { ...payload, created_at: new Date().toISOString(), id: cryptoId() };
    setCheckHistory((prev) => [row, ...prev].slice(0, 50));
    try {
      await supabase.from("event_car_checkup_history").insert([row]);
    } catch {}
    showToast("Check-up salvato ✅");
  };

  const handleSaveFuel = async () => {
    const laps = Number(fuel.laps || 0);
    const fuelStart = toNumOrNull(fuel.fuel_start) ?? 0;
    const fuelRemaining = toNumOrNull(fuel.fuel_remaining) ?? 0;
    const consumption =
      laps > 0 ? Math.max((fuelStart - fuelRemaining) / laps, 0) : toNumOrNull(fuel.fuel_consumption) ?? 0;
    const targetLaps = Number(fuel.target_laps || 0);
    const toAdd = Math.max(targetLaps * consumption - fuelRemaining, 0);

    const payload = {
      event_car_id: eventCarId,
      fuel_start: toNumOrNull(fuelStart),
      fuel_consumption: toNumOrNull(consumption),
      fuel_remaining: toNumOrNull(fuelRemaining),
      fuel_to_add: toNumOrNull(toAdd),
    };

    const { error } = await supabase.from("event_car_fuel").upsert(payload);
    if (error) return alert("Errore salvataggio carburante: " + error.message);

    const row = {
      ...payload,
      laps: laps || null,
      target_laps: targetLaps || null,
      created_at: new Date().toISOString(),
      id: cryptoId(),
    };
    setFuelHistory((prev) => [row, ...prev].slice(0, 50));
    try {
      await supabase.from("event_car_fuel_history").insert([row]);
    } catch {}
    showToast("Carburante aggiornato ✅");
  };

  // ---------- UI HELPERS ----------
  const formatDateTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("it-IT") : "—";

  function toNumOrNull(v: any) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function cryptoId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return Math.random().toString(36).slice(2);
  }

  if (loading) return <p className="p-6 text-gray-600 dark:text-gray-300">Caricamento dati...</p>;
  if (!event || !car)
    return (
      <div className="p-6 text-center text-red-500 font-semibold">
        ❌ Errore: dati non trovati.
      </div>
    );

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg shadow-md z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {car.name} – {event.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Gestione tecnica evento</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/calendar/${eventId}/car/${eventCarId}/turns`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-yellow-400 hover:bg-gray-800 font-semibold"
            title="Gestisci turni"
          >
            <CalendarClock size={16} /> Turni
          </Link>

          <button
            onClick={() => setDark((d) => !d)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-neutral-900"
            title="Toggle tema scuro"
          >
            🌓
          </button>

          <Link
            href={`/calendar/${eventId}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-100 font-semibold"
          >
            <ArrowLeft size={16} /> Torna all’evento
          </Link>
        </div>
      </div>

      {/* ============ ASSETTO: touch + immagine vettura ============ */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-4">
          <Gauge className="text-yellow-500" /> Assetto (touch + grafica)
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Immagine vettura con tag valori */}
          <div className="relative rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-4">
            <div className="w-full aspect-[4/3] relative overflow-hidden rounded-lg">
              {/* Usa il tuo SVG: mettilo in /public/car.svg */}
              <img
                src="/car.svg"
                alt="Vettura"
                className="absolute inset-0 w-full h-full object-contain opacity-90"
              />

              {/* Tag valori (posizionamento indicativo, regola percentuali se vuoi) */}
              {/* Pressioni */}
              <Badge style={{ left: "12%", top: "22%" }}>
                Ant. {setup.front_pressure ?? "—"} bar
              </Badge>
              <Badge style={{ left: "12%", top: "78%" }}>
                Post. {setup.rear_pressure ?? "—"} bar
              </Badge>

              {/* Camber */}
              <Badge style={{ right: "12%", top: "22%" }}>
                Camber Ant. {setup.camber_front ?? "—"}°
              </Badge>
              <Badge style={{ right: "12%", top: "78%" }}>
                Camber Post. {setup.camber_rear ?? "—"}°
              </Badge>

              {/* Ride height e ala */}
              <Badge style={{ left: "50%", transform: "translateX(-50%)", bottom: "14%" }}>
                Altezza {setup.ride_height ?? "—"} mm
              </Badge>
              <Badge style={{ left: "50%", transform: "translateX(-50%)", bottom: "4%" }}>
                Ala {setup.wing_angle ?? "—"}°
              </Badge>
            </div>
          </div>

          {/* Controlli touch: slider + numerici */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ControlCard
              label="Pressione anteriore"
              unit="bar"
              value={setup.front_pressure}
              setValue={(v) => setSetup({ ...setup, front_pressure: v })}
              min={0.8}
              max={2.5}
              step={0.05}
              defaultSlider={1.5}
            />
            <ControlCard
              label="Pressione posteriore"
              unit="bar"
              value={setup.rear_pressure}
              setValue={(v) => setSetup({ ...setup, rear_pressure: v })}
              min={0.8}
              max={2.5}
              step={0.05}
              defaultSlider={1.5}
            />
            <ControlCard
              label="Camber anteriore"
              unit="°"
              value={setup.camber_front}
              setValue={(v) => setSetup({ ...setup, camber_front: v })}
              min={-6}
              max={2}
              step={0.1}
              defaultSlider={-2}
            />
            <ControlCard
              label="Camber posteriore"
              unit="°"
              value={setup.camber_rear}
              setValue={(v) => setSetup({ ...setup, camber_rear: v })}
              min={-6}
              max={2}
              step={0.1}
              defaultSlider={-1.5}
            />
            <ControlCard
              label="Altezza vettura"
              unit="mm"
              value={setup.ride_height}
              setValue={(v) => setSetup({ ...setup, ride_height: v })}
              min={40}
              max={120}
              step={1}
              defaultSlider={70}
              emphasis
            />
            <ControlCard
              label="Angolo ala"
              unit="°"
              value={setup.wing_angle}
              setValue={(v) => setSetup({ ...setup, wing_angle: v })}
              min={0}
              max={30}
              step={0.5}
              defaultSlider={10}
            />
          </div>
        </div>

        {/* Note assetto */}
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Note assetto
          </label>
          <textarea
            value={setup.notes ?? ""}
            onChange={(e) => setSetup((s: any) => ({ ...s, notes: e.target.value }))}
            className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg p-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
            rows={3}
            placeholder="Annotazioni rapide: meteo, feeling pilota, modifiche…"
          />
        </div>

        {/* Azioni + storico */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={handleSaveSetup}
            className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
          >
            💾 Salva assetto
          </button>
        </div>

        {setupHistory.length > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-neutral-700 pt-3">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
              Storico assetto (ultimi 5)
            </h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
              {setupHistory.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between hover:text-yellow-500 cursor-pointer"
                  onClick={() => setSetup({ ...r })}
                  title="Clicca per ricaricare questo setup"
                >
                  <span>{formatDateTime(r.created_at)}</span>
                  <span>
                    Ant {r.front_pressure ?? "—"} / Post {r.rear_pressure ?? "—"} · H {r.ride_height ?? "—"} · Ala {r.wing_angle ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ============ CHECK-UP TECNICO ============ */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-3">
          <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {["freni", "motore", "olio", "benzina", "cambio", "elettronica"].map((item) => (
            <label key={item} className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                checked={!!checkup.items?.[item]}
                onChange={(e) =>
                  setCheckup((prev) => ({
                    ...prev,
                    items: { ...(prev.items || {}), [item]: e.target.checked },
                  }))
                }
                className="scale-125 accent-yellow-500"
              />
              <span className="capitalize">{item}</span>
            </label>
          ))}
        </div>

        <textarea
          placeholder="Note check-up..."
          value={checkup.notes || ""}
          onChange={(e) => setCheckup({ ...checkup, notes: e.target.value })}
          className="mt-3 border border-gray-200 dark:border-neutral-700 rounded-lg p-2 w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
          rows={2}
        />

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={handleSaveCheckup}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg"
          >
            Salva check-up
          </button>
        </div>

        {checkHistory.length > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-neutral-700 pt-3">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
              Storico check-up (ultimi 5)
            </h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
              {checkHistory.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between hover:text-yellow-500 cursor-pointer"
                  onClick={() => setCheckup({ items: r.items || {}, notes: r.notes || "" })}
                  title="Clicca per ricaricare questo check-up"
                >
                  <span>{formatDateTime(r.created_at)}</span>
                  <span>
                    {Object.entries(r.items || {})
                      .filter(([_, v]) => v)
                      .map(([k]) => k)
                      .join(", ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ============ CARBURANTE SMART ============ */}
      <section className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-lg p-6 text-gray-100">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-yellow-400">
          <Fuel className="text-yellow-400" /> Gestione Carburante – Smart
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Carburante iniziale */}
          <div>
            <label className="block text-sm mb-1 text-gray-400">Carburante iniziale (L)</label>
            <input
              type="number"
              min="0"
              value={fuel.fuel_start ?? ""}
              onChange={(e) => setFuel({ ...fuel, fuel_start: toNumOrNull(e.target.value) })}
              className="w-full border border-neutral-700 rounded-lg bg-neutral-800 text-gray-100 px-3 py-2 text-lg font-semibold focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Giri effettuati */}
          <div>
            <label className="block text-sm mb-1 text-gray-400">Giri effettuati</label>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={fuel.laps || 0}
              onChange={(e) => setFuel({ ...fuel, laps: Number(e.target.value) })}
              className="w-full accent-yellow-400"
            />
            <div className="text-center text-sm mt-1 text-gray-300 font-semibold">
              {fuel.laps || 0} giri
            </div>
          </div>

          {/* Carburante restante */}
          <div>
            <label className="block text-sm mb-1 text-gray-400">Carburante restante (L)</label>
            <input
              type="number"
              min="0"
              value={fuel.fuel_remaining ?? ""}
              onChange={(e) => setFuel({ ...fuel, fuel_remaining: toNumOrNull(e.target.value) })}
              className="w-full border border-neutral-700 rounded-lg bg-neutral-800 text-gray-100 px-3 py-2 text-lg font-semibold focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        </div>

        {/* Calcoli automatici */}
        {Number(fuel.laps) > 0 && fuel.fuel_start >= 0 && fuel.fuel_remaining >= 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 text-center">
              <p className="text-sm text-gray-400">Consumo medio</p>
              <p className="text-2xl font-bold text-yellow-400">
                {Math.max(
                  ((fuel.fuel_start - fuel.fuel_remaining) / Math.max(fuel.laps || 1, 1)) || 0,
                  0
                ).toFixed(2)}{" "}
                L/giro
              </p>
            </div>

            <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 text-center">
              <label className="text-sm text-gray-400 block mb-1">Target prossima sessione</label>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={fuel.target_laps || 0}
                onChange={(e) => setFuel({ ...fuel, target_laps: Number(e.target.value) })}
                className="w-full accent-yellow-400"
              />
              <p className="text-gray-300 text-sm mt-1">{fuel.target_laps || 0} giri target</p>
            </div>

            <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 text-center">
              <p className="text-sm text-gray-400">Carburante da fare</p>
              <p className="text-2xl font-bold text-yellow-400">
                {(() => {
                  const laps = Number(fuel.laps || 0);
                  const start = Number(fuel.fuel_start || 0);
                  const rem = Number(fuel.fuel_remaining || 0);
                  const cons = laps > 0 ? Math.max((start - rem) / laps, 0) : 0;
                  const toAdd = Math.max((Number(fuel.target_laps || 0) * cons) - rem, 0);
                  return toAdd.toFixed(1);
                })()}{" "}
                L
              </p>
            </div>
          </div>
        )}

        {/* Note carburante (solo UI) */}
        <textarea
          placeholder="Note carburante (es. strategia, meteo…)"
          value={fuel.notes || ""}
          onChange={(e) => setFuel({ ...fuel, notes: e.target.value })}
          className="mt-4 w-full border border-neutral-700 bg-neutral-800 rounded-lg px-3 py-2 text-gray-100 focus:ring-2 focus:ring-yellow-400"
          rows={2}
        />

        {/* Bottone Salva */}
        <div className="flex justify-end mt-5">
          <button
            onClick={handleSaveFuel}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl text-lg"
          >
            💾 Aggiorna carburante
          </button>
        </div>

        {/* Storico ultime 5 registrazioni */}
        {fuelHistory?.length > 0 && (
          <div className="mt-6 border-t border-neutral-700 pt-4">
            <h3 className="text-md font-bold text-gray-200 mb-2">Storico carburante (ultimi 5)</h3>
            <ul className="space-y-1 text-sm text-gray-400">
              {fuelHistory.slice(0, 5).map((f: any) => (
                <li
                  key={f.id}
                  className="flex justify-between hover:text-yellow-400 cursor-pointer"
                  onClick={() =>
                    setFuel({
                      ...fuel,
                      fuel_start: f.fuel_start,
                      fuel_consumption: f.fuel_consumption,
                      fuel_remaining: f.fuel_remaining,
                      fuel_to_add: f.fuel_to_add,
                    })
                  }
                >
                  <span>{formatDateTime(f.created_at || f.updated_at)}</span>
                  <span>
                    {f.fuel_start}L → {f.fuel_remaining}L · Consumo{" "}
                    {Number(f.fuel_consumption ?? 0).toFixed(2)}L/giro
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ============ NOTE ============ */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-3">
          <StickyNote className="text-yellow-500" /> Note e osservazioni
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border border-gray-200 dark:border-neutral-700 rounded-lg p-2 w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
          rows={3}
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={async () => {
              const { error } = await supabase.from("event_cars").update({ notes }).eq("id", eventCarId);
              if (error) alert("Errore salvataggio note: " + error.message);
              else showToast("Note salvate ✅");
            }}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg"
          >
            Salva note
          </button>
        </div>
      </section>
    </div>
  );
}

/* ----------------- COMPONENTI UI ------------------ */

function Badge({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="absolute px-2 py-1 rounded bg-white/90 dark:bg-black/70 shadow text-[11px] text-gray-800 dark:text-gray-100"
      style={style}
    >
      {children}
    </div>
  );
}

function ControlCard({
  label,
  unit,
  value,
  setValue,
  min,
  max,
  step,
  defaultSlider,
  emphasis,
}: {
  label: string;
  unit: string;
  value?: number | null;
  setValue: (n: number | null) => void;
  min: number;
  max: number;
  step: number;
  defaultSlider: number;
  emphasis?: boolean;
}) {
  const [local, setLocal] = useState<number>(Number(value ?? defaultSlider));
  useEffect(() => {
    setLocal(Number(value ?? defaultSlider));
  }, [value, defaultSlider]);

  return (
    <div
      className={`rounded-xl border p-4 bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 shadow-sm flex flex-col gap-3 ${
        emphasis ? "ring-1 ring-yellow-400" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-800 dark:text-gray-100">{label}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {value ?? "—"} {unit}
        </div>
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
          setValue(v);
        }}
        className="w-full accent-yellow-500"
      />

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value as number) ? (value as number) : ""}
          onChange={(e) => setValue(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={unit}
          className={`border rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-neutral-700 ${
            emphasis ? "text-xl font-bold" : ""
          }`}
        />
      </div>
    </div>
  );
}
