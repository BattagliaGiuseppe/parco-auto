"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Wrench, Gauge, Fuel, ClipboardCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as { eventId: string; eventCarId: string };

  const [car, setCar] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // sezioni
  const [setup, setSetup] = useState<any>(null);
  const [checkup, setCheckup] = useState<any>(null);
  const [fuel, setFuel] = useState<any>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: eventData } = await supabase.from("events").select("id, name, date").eq("id", eventId).single();
      const { data: carData } = await supabase
        .from("event_cars")
        .select("id, car_id (name), status")
        .eq("id", eventCarId)
        .single();

      setEvent(eventData);
      setCar(carData);
      setLoading(false);
    };

    fetchData();
  }, [eventId, eventCarId]);

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
        <p className="text-gray-600 text-sm mb-3">
          Gestisci pressioni, altezze, campanature e parametri assetto per questa auto durante l’evento.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input type="number" placeholder="Pressione anteriore (bar)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Pressione posteriore (bar)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Altezza (mm)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Campanatura ant. (°)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Campanatura post. (°)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Angolo ala (°)" className="border rounded-lg p-2" />
        </div>
        <textarea
          placeholder="Note assetto..."
          className="mt-3 border rounded-lg p-2 w-full"
          rows={2}
        ></textarea>
        <div className="flex justify-end mt-3">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">
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
              <input type="checkbox" className="scale-125" />{" "}
              <span className="capitalize">{item}</span>
            </label>
          ))}
        </div>
        <textarea
          placeholder="Note check-up..."
          className="mt-3 border rounded-lg p-2 w-full"
          rows={2}
        ></textarea>
        <div className="flex justify-end mt-3">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">
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
          <input type="number" placeholder="Benzina iniziale (L)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Consumo (L/h)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Benzina restante (L)" className="border rounded-lg p-2" />
          <input type="number" placeholder="Benzina da fare (L)" className="border rounded-lg p-2" />
        </div>
        <div className="flex justify-end mt-3">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">
            Aggiorna carburante
          </button>
        </div>
      </section>

      {/* Sezione Manutenzioni */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Wrench className="text-yellow-500" /> Manutenzioni
        </h2>
        <p className="text-gray-600 text-sm mb-3">
          Elenco interventi tecnici eseguiti su questa auto durante l’evento.
        </p>
        <div className="flex justify-end mb-2">
          <button className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-3 py-1 rounded-lg text-sm">
            + Aggiungi manutenzione
          </button>
        </div>
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Descrizione</th>
              <th className="p-2 text-left">Componente</th>
              <th className="p-2 text-center">Stato</th>
              <th className="p-2 text-right">Ore</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2">Cambio pastiglie freno</td>
              <td className="p-2">Freni anteriori</td>
              <td className="p-2 text-center">Completato</td>
              <td className="p-2 text-right">1.5</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Sezione Note */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          🗒️ Note e osservazioni
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border rounded-lg p-2 w-full"
          rows={3}
        />
        <div className="flex justify-end mt-3">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">
            Salva note
          </button>
        </div>
      </section>
    </div>
  );
}
