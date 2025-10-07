"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Wrench, Gauge, Fuel, ClipboardCheck, ArrowLeft, History } from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

// Funzione generica per caricare una sezione
async function loadSection(table: string, eventCarId: string) {
  const { data } = await supabase.from(table).select("*").eq("event_car_id", eventCarId).single();
  return data || null;
}

// Funzione generica per salvare una sezione
async function saveSection(table: string, eventCarId: string, payload: any) {
  const existing = await loadSection(table, eventCarId);
  if (existing) {
    await supabase.from(table).update(payload).eq("event_car_id", eventCarId);
  } else {
    await supabase.from(table).insert([{ event_car_id: eventCarId, ...payload }]);
  }
}

// Aggiungi un log di intervento
async function addLog(eventCarId: string, action: string, details?: string) {
  await supabase.from("event_car_logs").insert([{ event_car_id: eventCarId, action, details }]);
}

// Carica log per un evento-auto
async function loadLogs(eventCarId: string) {
  const { data } = await supabase
    .from("event_car_logs")
    .select("*")
    .eq("event_car_id", eventCarId)
    .order("created_at", { ascending: false });
  return data || [];
}

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as { eventId: string; eventCarId: string };

  const [car, setCar] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // dati sezioni
  const [setup, setSetup] = useState<any>({});
  const [checkup, setCheckup] = useState<any>({});
  const [fuel, setFuel] = useState<any>({});
  const [notes, setNotes] = useState("");
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: eventData } = await supabase
        .from("events")
        .select("id, name, date_start, date_end, location")
        .eq("id", eventId)
        .single();

      const { data: carData } = await supabase
        .from("event_cars")
        .select("id, car_id (name)")
        .eq("id", eventCarId)
        .single();

      // carica sezioni e log
      const [setupData, checkupData, fuelData, logData] = await Promise.all([
        loadSection("event_car_setup", eventCarId),
        loadSection("event_car_checkup", eventCarId),
        loadSection("event_car_fuel", eventCarId),
        loadLogs(eventCarId),
      ]);

      setEvent(eventData);
      setCar(carData);
      setSetup(setupData || {});
      setCheckup(checkupData || {});
      setFuel(fuelData || {});
      setLogs(logData);
      setLoading(false);
    };

    fetchData();
  }, [eventId, eventCarId]);

  // Gestori di salvataggio
  const handleSaveSetup = async () => {
    await saveSection("event_car_setup", eventCarId, setup);
    await addLog(eventCarId, "Salvato assetto", `Pressioni: ${setup.front_pressure}/${setup.rear_pressure}`);
    alert("✅ Assetto salvato!");
    setLogs(await loadLogs(eventCarId));
  };

  const handleSaveCheckup = async () => {
    await saveSection("event_car_checkup", eventCarId, checkup);
    await addLog(eventCarId, "Salvato check-up");
    alert("✅ Check-up salvato!");
    setLogs(await loadLogs(eventCarId));
  };

  const handleSaveFuel = async () => {
    await saveSection("event_car_fuel", eventCarId, fuel);
    await addLog(
      eventCarId,
      "Aggiornato carburante",
      `Restante: ${fuel.fuel_remaining} L – Da fare: ${fuel.fuel_to_add} L`
    );
    alert("✅ Dati carburante aggiornati!");
    setLogs(await loadLogs(eventCarId));
  };

  if (loading) return <p className="p-6">Caricamento dati...</p>;
  if (!event || !car) return <p className="p-6 text-red-500">Errore: dati non trovati.</p>;

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {car.car_id?.name || "Auto"} – {event.name}
          </h1>
          <p className="text-gray-600 text-sm">Gestione tecnica evento</p>
        </div>
        <Link
          href={`/calendar/${eventId}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
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
            value={setup.front_pressure || ""}
            onChange={(e) => setSetup({ ...setup, front_pressure: parseFloat(e.target.value) })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Pressione post. (bar)"
            value={setup.rear_pressure || ""}
            onChange={(e) => setSetup({ ...setup, rear_pressure: parseFloat(e.target.value) })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Altezza (mm)"
            value={setup.ride_height || ""}
            onChange={(e) => setSetup({ ...setup, ride_height: parseFloat(e.target.value) })}
            className="border rounded-lg p-2"
          />
        </div>
        <textarea
          placeholder="Note assetto..."
          value={setup.notes || ""}
          onChange={(e) => setSetup({ ...setup, notes: e.target.value })}
          className="mt-3 border rounded-lg p-2 w-full"
          rows={2}
        ></textarea>
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveSetup}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg"
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
          {["brakes", "engine", "oil", "fuel_system", "gearbox", "electronics"].map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={checkup[key] || false}
                onChange={(e) => setCheckup({ ...checkup, [key]: e.target.checked })}
                className="scale-125"
              />
              <span className="capitalize">{key.replace("_", " ")}</span>
            </label>
          ))}
        </div>
        <textarea
          placeholder="Note check-up..."
          value={checkup.notes || ""}
          onChange={(e) => setCheckup({ ...checkup, notes: e.target.value })}
          className="mt-3 border rounded-lg p-2 w-full"
          rows={2}
        ></textarea>
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveCheckup}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg"
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
            onChange={(e) => setFuel({ ...fuel, fuel_start: parseFloat(e.target.value) })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Consumo (L/h)"
            value={fuel.fuel_consumption || ""}
            onChange={(e) => setFuel({ ...fuel, fuel_consumption: parseFloat(e.target.value) })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Benzina restante (L)"
            value={fuel.fuel_remaining || ""}
            onChange={(e) => setFuel({ ...fuel, fuel_remaining: parseFloat(e.target.value) })}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            placeholder="Benzina da fare (L)"
            value={fuel.fuel_to_add || ""}
            onChange={(e) => setFuel({ ...fuel, fuel_to_add: parseFloat(e.target.value) })}
            className="border rounded-lg p-2"
          />
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveFuel}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg"
          >
            Aggiorna carburante
          </button>
        </div>
      </section>

      {/* Sezione Note */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-3">🗒️ Note e osservazioni</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border rounded-lg p-2 w-full"
          rows={3}
        />
      </section>

      {/* Log interventi */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <History className="text-yellow-500" /> Storico interventi
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun intervento registrato.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="border-b pb-2">
                <p className="text-gray-800 text-sm font-semibold">{log.action}</p>
                {log.details && <p className="text-gray-600 text-xs">{log.details}</p>}
                <p className="text-gray-400 text-xs">
                  {new Date(log.created_at).toLocaleString("it-IT")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
