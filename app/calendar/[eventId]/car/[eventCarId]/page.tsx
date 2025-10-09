"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Wrench,
  Gauge,
  Fuel,
  ClipboardCheck,
  ArrowLeft,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // sezioni
  const [setup, setSetup] = useState<any>({});
  const [checkup, setCheckup] = useState<any>({});
  const [fuel, setFuel] = useState<any>({});
  const [notes, setNotes] = useState("");

  const [toast, setToast] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // evento e auto
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

      // setup
      const { data: setupData } = await supabase
        .from("event_car_setup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      // checkup
      const { data: checkupData } = await supabase
        .from("event_car_checkup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      // fuel
      const { data: fuelData } = await supabase
        .from("event_car_fuel")
        .select("*")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      setEvent(eventData || null);
      setCar(carData?.car_id || null);
      setNotes(carData?.notes || "");
      setSetup(setupData || {});
      setCheckup(checkupData || {});
      setFuel(fuelData || {});
      setLoading(false);
    };

    fetchData();
  }, [eventId, eventCarId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // Salvataggio Assetto
  const handleSaveSetup = async () => {
    const { error } = await supabase.from("event_car_setup").upsert({
      event_car_id: eventCarId,
      pressure_front: setup.pressure_front || null,
      pressure_rear: setup.pressure_rear || null,
      ride_height: setup.ride_height || null,
      camber_front: setup.camber_front || null,
      camber_rear: setup.camber_rear || null,
      wing_angle: setup.wing_angle || null,
      notes: setup.notes || null,
    });
    if (error) alert("Errore salvataggio assetto: " + error.message);
    else showToast("Assetto salvato ✅");
  };

  // Salvataggio Check-up
  const handleSaveCheckup = async () => {
    const { error } = await supabase.from("event_car_checkup").upsert({
      event_car_id: eventCarId,
      items: checkup.items || {},
      notes: checkup.notes || "",
    });
    if (error) alert("Errore salvataggio check-up: " + error.message);
    else showToast("Check-up salvato ✅");
  };

  // Salvataggio Carburante
  const handleSaveFuel = async () => {
    const { error } = await supabase.from("event_car_fuel").upsert({
      event_car_id: eventCarId,
      fuel_start: fuel.fuel_start || null,
      fuel_consumption: fuel.fuel_consumption || null,
      fuel_remaining: fuel.fuel_remaining || null,
      fuel_to_add: fuel.fuel_to_add || null,
    });
    if (error) alert("Errore salvataggio carburante: " + error.message);
    else showToast("Carburante aggiornato ✅");
  };

  // Salvataggio Note
  const handleSaveNotes = async () => {
    const { error } = await supabase
      .from("event_cars")
      .update({ notes })
      .eq("id", eventCarId);
    if (error) alert("Errore salvataggio note: " + error.message);
    else showToast("Note salvate ✅");
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
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-md z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {car.name} – {event.name}
          </h1>
          <p className="text-gray-600 text-sm">Gestione tecnica evento</p>
        </div>
        <Link
          href={`/calendar/${eventId}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
        >
          <ArrowLeft size={16} /> Torna all’evento
        </Link>
      </div>

      {/* Sezione Assetto */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Gauge className="text-yellow-500" /> Assetto
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input
            type="number"
            placeholder="Pressione ant. (bar)"
            value={setup.pressure_front || ""}
            onChange={(e) => setSetup({ ...setup, pressure_front: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Pressione post. (bar)"
            value={setup.pressure_rear || ""}
            onChange={(e) => setSetup({ ...setup, pressure_rear: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Altezza (mm)"
            value={setup.ride_height || ""}
            onChange={(e) => setSetup({ ...setup, ride_height: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Campanatura ant. (°)"
            value={setup.camber_front || ""}
            onChange={(e) => setSetup({ ...setup, camber_front: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Campanatura post. (°)"
            value={setup.camber_rear || ""}
            onChange={(e) => setSetup({ ...setup, camber_rear: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Angolo ala (°)"
            value={setup.wing_angle || ""}
            onChange={(e) => setSetup({ ...setup, wing_angle: e.target.value })}
            className="border rounded-lg p-2"
          />
        </div>
        <textarea
          placeholder="Note assetto..."
          value={setup.notes || ""}
          onChange={(e) => setSetup({ ...setup, notes: e.target.value })}
          className="mt-3 border rounded-lg p-2 w-full"
          rows={2}
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveSetup}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg"
          >
            Salva assetto
          </button>
        </div>
      </section>

      {/* Sezione Check-up */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {["freni", "motore", "olio", "benzina", "cambio", "elettronica"].map((item) => (
            <label key={item} className="flex items-center gap-2">
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
          className="mt-3 border rounded-lg p-2 w-full"
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

      {/* Sezione Carburante */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Fuel className="text-yellow-500" /> Gestione carburante
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="number"
            placeholder="Benzina iniziale (L)"
            value={fuel.fuel_start || ""}
            onChange={(e) => setFuel({ ...fuel, fuel_start: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Consumo (L/h)"
            value={fuel.fuel_consumption || ""}
            onChange={(e) => setFuel({ ...fuel, fuel_consumption: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Benzina restante (L)"
            value={fuel.fuel_remaining || ""}
            onChange={(e) => setFuel({ ...fuel, fuel_remaining: e.target.value })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Benzina da fare (L)"
            value={fuel.fuel_to_add || ""}
            onChange={(e) => setFuel({ ...fuel, fuel_to_add: e.target.value })}
            className="border rounded-lg p-2"
          />
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveFuel}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg"
          >
            Aggiorna carburante
          </button>
        </div>
      </section>

      {/* Sezione Note */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <StickyNote className="text-yellow-500" /> Note e osservazioni
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border rounded-lg p-2 w-full"
          rows={3}
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveNotes}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg"
          >
            Salva note
          </button>
        </div>
      </section>
    </div>
  );
}
