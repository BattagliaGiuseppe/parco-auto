"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Wrench, Car } from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function EventDetailPage() {
  const { eventId } = useParams() as { eventId: string };
  const [event, setEvent] = useState<any>(null);
  const [eventCars, setEventCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, name, date, notes, circuit_id (name)")
        .eq("id", eventId)
        .single();

      const { data: carsData, error: carsError } = await supabase
        .from("event_cars")
        .select("id, car_id (id, name), status")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (!eventError) setEvent(eventData);
      if (!carsError) setEventCars(carsData || []);
      setLoading(false);
    };

    fetchData();
  }, [eventId]);

  if (loading) return <p className="p-6 text-gray-600">Caricamento dati...</p>;
  if (!event)
    return (
      <div className="p-6 text-center text-red-500 font-semibold">
        ❌ Errore: evento non trovato.
      </div>
    );

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Car className="text-yellow-500" size={28} />
            {event.name}
          </h1>
          <p className="text-gray-600 text-sm">
            {event.date
              ? new Date(event.date).toLocaleDateString("it-IT")
              : "Data non disponibile"}{" "}
            – {event.circuit_id?.name || "Autodromo non specificato"}
          </p>
        </div>

        <Link
          href="/calendar"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
        >
          <ArrowLeft size={16} /> Torna indietro
        </Link>
      </div>

      {/* Note evento */}
      {event.notes && (
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-800 mb-1">Note evento</h2>
          <p className="text-gray-600 text-sm whitespace-pre-line">{event.notes}</p>
        </div>
      )}

      {/* Lista auto partecipanti */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Wrench className="text-yellow-500" /> Auto partecipanti
        </h2>

        {eventCars.length === 0 ? (
          <p className="text-gray-600">Nessuna auto associata a questo evento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-black text-yellow-500">
                <tr>
                  <th className="p-3 text-left">Auto</th>
                  <th className="p-3 text-center">Stato</th>
                  <th className="p-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {eventCars.map((ec) => (
                  <tr key={ec.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{ec.car_id?.name || "—"}</td>
                    <td className="p-3 text-center capitalize">
                      {ec.status || "in corso"}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/calendar/${eventId}/car/${ec.id}`}
                        className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1 rounded-lg flex items-center gap-1 justify-end shadow-sm"
                      >
                        <Wrench size={14} /> Gestisci
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
