"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Gauge,
  Fuel,
  ClipboardCheck,
  StickyNote,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

import SetupPanel from "./setup";          // Touch UI
import SetupRacing from "./setup-racing";  // Interattivo SVG
import SetupScheda from "./setup-scheda";  // Scheda Tecnica grafica

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"touch" | "racing" | "scheda">("touch");

  // Stato per il carburante
  const [lapsDone, setLapsDone] = useState<number>(0);
  const [lapsPlanned, setLapsPlanned] = useState<number>(0);
  const [fuelStart, setFuelStart] = useState<number>(0);
  const [fuelEnd, setFuelEnd] = useState<number>(0);

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

      setEvent(eventData || null);
      setCar(carData?.car_id || null);
      setNotes(carData?.notes || "");
      setLoading(false);
    };

    fetchData();
  }, [eventId, eventCarId]);

  // Calcoli automatici carburante
  const fuelPerLap =
    lapsDone > 0 && fuelStart > fuelEnd
      ? (fuelStart - fuelEnd) / lapsDone
      : 0;
  const fuelToAdd =
    fuelPerLap > 0 && lapsPlanned > 0 ? fuelPerLap * lapsPlanned : 0;

  if (loading) return <p className="p-6 text-gray-600">Caricamento dati...</p>;
  if (!event || !car)
    return (
      <div className="p-6 text-center text-red-500 font-semibold">
        ❌ Errore: dati non trovati.
      </div>
    );

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
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

      {/* Sezione Setup */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Gauge className="text-yellow-500" /> Assetto
        </h2>

        {/* Tabs per i tre tipi di setup */}
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setTab("touch")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "touch"
                ? "bg-yellow-400 text-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Touch
          </button>

          <button
            onClick={() => setTab("racing")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "racing"
                ? "bg-yellow-400 text-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Interattivo
          </button>

          <button
            onClick={() => setTab("scheda")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "scheda"
                ? "bg-yellow-400 text-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Scheda Tecnica
          </button>
        </div>

        {/* Contenuto dinamico */}
        <div className="transition-all duration-300">
          {tab === "touch" && <SetupPanel eventCarId={eventCarId} />}
          {tab === "racing" && <SetupRacing eventCarId={eventCarId} />}
          {tab === "scheda" && <SetupScheda />}
        </div>
      </section>

      {/* 🔧 Sezione Check-up tecnico */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
          <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
        </h2>
        <table className="w-full text-sm border-collapse mb-3">
          <thead>
            <tr className="bg-gray-50">
              <th className="border p-2 text-left">Controllo</th>
              <th className="border p-2 text-left">Stato</th>
            </tr>
          </thead>
          <tbody>
            {["Serraggi", "Freni", "Liquidi", "Sospensioni", "Elettronica", "Ruote", "Cambio"].map(
              (item) => (
                <tr key={item}>
                  <td className="border p-2">{item}</td>
                  <td className="border p-2">
                    <select className="border rounded px-2 py-1 text-sm w-full">
                      <option>OK</option>
                      <option>Da controllare</option>
                      <option>Problema</option>
                    </select>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        <textarea
          placeholder="Note check-up..."
          className="border rounded-lg p-2 w-full text-sm"
          rows={3}
        />
      </section>

      {/* 🏁 Sezione Giri effettuati */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          🏎️ Giri effettuati
        </h2>
        <input
          type="number"
          value={lapsDone}
          onChange={(e) => setLapsDone(Number(e.target.value))}
          className="border rounded-lg p-2 w-40 text-center"
          placeholder="0"
        />
      </section>

      {/* ⛽ Gestione carburante */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Fuel className="text-yellow-500" /> Gestione carburante
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Benzina iniziale (L)
            </label>
            <input
              type="number"
              value={fuelStart}
              onChange={(e) => setFuelStart(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Benzina residua (L)
            </label>
            <input
              type="number"
              value={fuelEnd}
              onChange={(e) => setFuelEnd(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Giri previsti
            </label>
            <input
              type="number"
              value={lapsPlanned}
              onChange={(e) => setLapsPlanned(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </div>
        </div>

        <div className="mt-4 border-t pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Consumo a giro (L/giro)
            </label>
            <div className="border rounded-lg p-2 bg-gray-50 text-center font-semibold">
              {fuelPerLap > 0 ? fuelPerLap.toFixed(2) : "—"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Benzina da fare (L)
            </label>
            <div className="border rounded-lg p-2 bg-yellow-100 text-center font-semibold text-gray-800">
              {fuelToAdd > 0 ? fuelToAdd.toFixed(1) : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* 🗒️ Note e osservazioni */}
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
      </section>
    </div>
  );
}
