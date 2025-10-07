"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Car, ArrowLeft, MapPin, CalendarDays, Wrench } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function EventPage() {
  const { eventId } = useParams() as { eventId: string };

  const [event, setEvent] = useState<any>(null);
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      const { data: carsData } = await supabase
        .from("event_cars")
        .select("id, car_id (name), status, notes")
        .eq("event_id", eventId);

      setEvent(eventData);
      setCars(carsData || []);
      setLoading(false);
    };

    fetchEvent();
  }, [eventId]);

  if (loading) return <p className="p-6">Caricamento evento...</p>;
  if (!event) return <p className="p-6 text-red-500">Evento non trovato.</p>;

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{event.name}</h1>
          <div className="text-gray-600 text-sm flex gap-4 mt-1 items-center">
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {event.location || "Località non specificata"}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={14} />{" "}
              {event.date_start
                ? new Date(event.date_start).toLocaleDateString("it-IT")
                : "Data non definita"}
              {event.date_end && ` → ${new Date(event.date_end).toLocaleDateString("it-IT")}`}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Stato: {event.status || "Programmato"}</p>
        </div>

        <Link
          href="/events"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          <ArrowLeft size={16} /> Torna agli eventi
        </Link>
      </div>

      {/* Sezione Auto Partecipanti */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Car className="text-yellow-500" /> Auto partecipanti
        </h2>

        {cars.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessuna auto associata a questo evento.</p>
        ) : (
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Auto</th>
                <th className="p-2 text-left">Stato</th>
                <th className="p-2 text-left">Note</th>
                <th className="p-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((ec) => (
                <tr key={ec.id} className="border-t">
                  <td className="p-2">{ec.car_id?.name || "Sconosciuta"}</td>
                  <td className="p-2">{ec.status || "—"}</td>
                  <td className="p-2 text-gray-600">{ec.notes || ""}</td>
                  <td className="p-2 text-right">
                    <Link
                      href={`/calendar/${eventId}/car/${ec.id}`}
                      className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-3 py-1 rounded-lg"
                    >
                      <Wrench size={14} /> Gestisci
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
