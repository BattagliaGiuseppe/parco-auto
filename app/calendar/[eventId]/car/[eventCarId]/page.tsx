"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  Fuel,
  StickyNote,
} from "lucide-react";
import { Audiowide } from "next/font/google";
import SetupRacing from "./setup-racing"; // ✅ nuova scheda completa

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as { eventId: string; eventCarId: string };

  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [checkup, setCheckup] = useState<any>({});
  const [fuel, setFuel] = useState<any>({});
  const [notes, setNotes] = useState("");

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
      setCheckup(checkupData || {});
      setFuel(fuelData || {});
      setLoading(false);
    };

    fetchData();
  }, [eventId, eventCarId]);

  // ✅ Salvataggi
  const handleSaveCheckup = async () => {
    const { error } = await supabase.from("event_car_checkup").upsert({
      event_car_id: eventCarId,
      items: checkup.items || {},
      notes: checkup.notes || "",
    });
    if (error) alert("Errore salvataggio check-up: " + error.message);
    else showToast("Check-up salvato ✅");
  };

  const handleSaveFuel = async () => {
    const laps = Number(fuel.laps || 0);
    const fuelStart = Number(fuel.fuel_start || 0);
    const fuelRemaining = Number(fuel.fuel_remaining || 0);
    const consumption =
      laps > 0 ? Math.max((fuelStart - fuelRemaining) / laps, 0) : 0;
    const targetLaps = Number(fuel.target_laps || 0);
    const toAdd = Math.max(targetLaps * consumption - fuelRemaining, 0);

    const { error } = await supabase.from("event_car_fuel").upsert({
      event_car_id: eventCarId,
      fuel_start: fuelStart || null,
      fuel_consumption: consumption || null,
      fuel_remaining: fuelRemaining || null,
      fuel_to_add: toAdd || null,
      laps: laps || null,
      target_laps: targetLaps || null,
      notes: fuel.notes || null,
    });
    if (error) alert("Errore salvataggio carburante: " + error.message);
    else showToast("Dati carburante aggiornati ✅");
  };

  if (loading) return <p className="p-6 text-gray-600">Caricamento dati...</p>;
  if (!event || !car)
    return (
      <div className="p-6 text-center text-red-500 font-semibold">
        ❌ Errore: dati non trovati.
      </div>
    );

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      {toast && (
        <div className="fixed top-4 right-4 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg shadow-md z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {car.name} – {event.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Gestione tecnica evento</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/calendar/${eventId}/car/${eventCarId}/turns`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-yellow-400 hover:bg-gray-800 font-semibold"
          >
            <CalendarClock size={16} /> Turni
          </Link>

          <button
            onClick={() => setDark((d) => !d)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-neutral-900"
            title="Tema scuro/chiaro"
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

      {/* ✅ Scheda Assetto Racing Sim */}
      <SetupRacing eventCarId={eventCarId} onSaved={(msg) => showToast(msg)} />

      {/* ✅ Check-up tecnico */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-3">
          <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {["freni", "motore", "olio", "benzina", "cambio", "elettronica"].map((item) => (
            <label key={item} className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                checked={checkup.items?.[item] || false}
                onChange={(e) =>
                  setCheckup({
                    ...checkup,
                    items: { ...checkup.items, [item]: e.target.checked },
                  })
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
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveCheckup}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg"
          >
            Salva check-up
          </button>
        </div>
      </section>

      {/* ✅ Carburante Smart */}
      <section className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-lg p-6 text-gray-100">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-yellow-400">
          <Fuel className="text-yellow-400" /> Gestione Carburante – Smart
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-sm mb-1 text-gray-400">Carburante iniziale (L)</label>
            <input
              type="number"
              min="0"
              value={fuel.fuel_start || ""}
              onChange={(e) => setFuel({ ...fuel, fuel_start: Number(e.target.value) })}
              className="w-full border border-neutral-700 rounded-lg bg-neutral-800 text-gray-100 px-3 py-2 text-lg font-semibold focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-400">Giri effettuati</label>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={fuel.laps || 0}
              onChange={(e) => setFuel({ ...fuel, laps: Number(e.target.value) })}
              className="w-full accent-yellow-400"
            />
            <div className="text-center text-sm mt-1 text-gray-300 font-semibold">
              {fuel.laps || 0} giri
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-400">Carburante restante (L)</label>
            <input
              type="number"
              min="0"
              value={fuel.fuel_remaining || ""}
              onChange={(e) => setFuel({ ...fuel, fuel_remaining: Number(e.target.value) })}
              className="w-full border border-neutral-700 rounded-lg bg-neutral-800 text-gray-100 px-3 py-2 text-lg font-semibold focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        </div>

        {fuel.laps > 0 && fuel.fuel_start && fuel.fuel_remaining >= 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 text-center">
              <p className="text-sm text-gray-400">Consumo medio</p>
              <p className="text-2xl font-bold text-yellow-400">
                {((fuel.fuel_start - fuel.fuel_remaining) / fuel.laps).toFixed(2)} L/giro
              </p>
            </div>

            <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 text-center">
              <label className="text-sm text-gray-400 block mb-1">Target prossima sessione</label>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={fuel.target_laps || 0}
                onChange={(e) => setFuel({ ...fuel, target_laps: Number(e.target.value) })}
                className="w-full accent-yellow-400"
              />
              <p className="text-gray-300 text-sm mt-1">{fuel.target_laps || 0} giri target</p>
            </div>

            <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 text-center">
              <p className="text-sm text-gray-400">Carburante da fare</p>
              <p className="text-2xl font-bold text-yellow-400">
                {Math.max(
                  (fuel.target_laps || 0) *
                    ((fuel.fuel_start - fuel.fuel_remaining) / fuel.laps) -
                    (fuel.fuel_remaining || 0),
                  0
                ).toFixed(1)}{" "}
                L
              </p>
            </div>
          </div>
        )}

        <textarea
          placeholder="Note carburante..."
          value={fuel.notes || ""}
          onChange={(e) => setFuel({ ...fuel, notes: e.target.value })}
          className="mt-4 w-full border border-neutral-700 bg-neutral-800 rounded-lg px-3 py-2 text-gray-100 focus:ring-2 focus:ring-yellow-400"
          rows={2}
        />
        <div className="flex justify-end mt-5">
          <button
            onClick={handleSaveFuel}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl text-lg"
          >
            💾 Aggiorna carburante
          </button>
        </div>
      </section>

      {/* ✅ Note */}
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
              const { error } = await supabase
                .from("event_cars")
                .update({ notes })
                .eq("id", eventCarId);
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
