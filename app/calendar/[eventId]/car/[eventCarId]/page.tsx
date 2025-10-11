"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Wrench,
  Gauge,
  Fuel,
  ClipboardCheck,
  StickyNote,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

// ✅ Importa i due setup esistenti
import SetupPanel from "./setup";         // touch UI
import SetupRacing from "./setup-racing"; // interattivo SVG
import SetupScheda from "./setup-scheda";
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
  const [tab, setTab] = useState<"touch" | "racing">("touch"); // 👈 per commutare tra setup

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

        {/* Tabs per i due tipi di setup */}
        <div className="flex gap-3 mb-4">
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
        </div>

        {/* Contenuto dinamico */}
        <div className="transition-all duration-300">
          {tab === "touch" ? (
            <SetupPanel eventCarId={eventCarId} />
          ) : (
            <SetupRacing eventCarId={eventCarId} />
          )}
        </div>
      </section>

      {/* Sezione Check-up */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
        </h2>
        <p className="text-gray-500 text-sm">
          (In sviluppo) – Qui verranno collegati i controlli e checklist
          dell’auto durante l’evento.
        </p>
      </section>

      {/* Sezione Carburante */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Fuel className="text-yellow-500" /> Gestione carburante
        </h2>
        <p className="text-gray-500 text-sm">
          (In sviluppo) – Gestione carburante con calcolo automatico e
          consumi/lap.
        </p>
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
      </section>
    </div>
  );
}
