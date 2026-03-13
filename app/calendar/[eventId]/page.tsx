"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import {
  ArrowLeft,
  Wrench,
  CarFront,
  CalendarDays,
  MapPin,
  FileText,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type EventRow = {
  id: string;
  name: string;
  date: string | null;
  notes: string | null;
  circuit_id: { name: string } | { name: string }[] | null;
};

type EventCarRow = {
  id: string;
  car_id: { id: string; name: string } | { id: string; name: string }[] | null;
  status: string | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Data non disponibile";
  return new Date(value).toLocaleDateString("it-IT");
}

function getStatusBadge(status: string | null | undefined) {
  const normalized = (status || "in corso").toLowerCase();

  if (normalized.includes("chius") || normalized.includes("fin")) {
    return {
      label: status || "Concluso",
      className: "bg-green-100 text-green-700",
    };
  }

  if (normalized.includes("proble") || normalized.includes("stop")) {
    return {
      label: status || "Problema",
      className: "bg-red-100 text-red-700",
    };
  }

  return {
    label: status || "In corso",
    className: "bg-yellow-100 text-yellow-800",
  };
}

export default function EventDetailPage() {
  const { eventId } = useParams() as { eventId: string };

  const [event, setEvent] = useState<EventRow | null>(null);
  const [eventCars, setEventCars] = useState<EventCarRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const ctx = await getCurrentTeamContext();

        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("id, name, date, notes, circuit_id (name)")
          .eq("id", eventId)
          .eq("team_id", ctx.teamId)
          .single();

        const { data: carsData, error: carsError } = await supabase
          .from("event_cars")
          .select("id, car_id (id, name), status")
          .eq("event_id", eventId)
          .eq("team_id", ctx.teamId)
          .order("created_at", { ascending: true });

        if (!eventError) setEvent(eventData as EventRow);
        else setEvent(null);

        if (!carsError) setEventCars((carsData as EventCarRow[]) || []);
        else setEventCars([]);
      } catch (error) {
        console.error("Errore caricamento dettaglio evento:", error);
        setEvent(null);
        setEventCars([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  const normalizedCircuit = useMemo(
    () => normalizeRelation(event?.circuit_id ?? null),
    [event]
  );

  const totalCars = eventCars.length;
  const statusesSummary = useMemo(() => {
    return eventCars.reduce(
      (acc, row) => {
        const status = (row.status || "in corso").toLowerCase();

        if (status.includes("proble") || status.includes("stop")) acc.problem++;
        else if (status.includes("chius") || status.includes("fin")) acc.closed++;
        else acc.inProgress++;

        return acc;
      },
      { inProgress: 0, closed: 0, problem: 0 }
    );
  }, [eventCars]);

  if (loading) {
    return <div className="card-base p-10 text-center text-neutral-500">Caricamento dati...</div>;
  }

  if (!event) {
    return (
      <div className="card-base p-10 text-center text-red-600 font-semibold">
        ❌ Errore: evento non trovato.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <CalendarDays size={14} />
                Dettaglio Evento
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400 flex flex-wrap items-center gap-2">
                <CarFront size={24} />
                <span>{event.name}</span>
              </h1>

              <div className="mt-3 flex flex-wrap gap-2 text-sm text-yellow-100/80">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <CalendarDays size={14} />
                  {formatDate(event.date)}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <MapPin size={14} />
                  {normalizedCircuit?.name || "Autodromo non specificato"}
                </span>
              </div>
            </div>

            <Link href="/calendar" className="btn-secondary">
              <ArrowLeft size={16} /> Torna al calendario
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<CarFront size={18} className="text-yellow-600" />}
              label="Auto partecipanti"
              value={String(totalCars)}
            />
            <SummaryCard
              icon={<Wrench size={18} className="text-yellow-600" />}
              label="In corso"
              value={String(statusesSummary.inProgress)}
            />
            <SummaryCard
              icon={<CalendarDays size={18} className="text-yellow-600" />}
              label="Chiuse"
              value={String(statusesSummary.closed)}
              valueClassName={statusesSummary.closed > 0 ? "text-green-700" : "text-neutral-900"}
            />
            <SummaryCard
              icon={<TriangleAlert size={18} className="text-yellow-600" />}
              label="Problemi"
              value={String(statusesSummary.problem)}
              valueClassName={statusesSummary.problem > 0 ? "text-red-700" : "text-neutral-900"}
            />
          </div>
        </div>
      </section>

      {event.notes && (
        <section className="card-base p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Note evento</h2>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 whitespace-pre-line leading-relaxed">
            {event.notes}
          </div>
        </section>
      )}

      <section className="card-base p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="text-yellow-500" size={18} />
          <h2 className="text-lg font-bold text-neutral-800">Auto partecipanti</h2>
        </div>

        {eventCars.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-neutral-500">
            Nessuna auto associata a questo evento.
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Auto</th>
                    <th>Stato</th>
                    <th className="text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {eventCars.map((ec) => {
                    const car = normalizeRelation(ec.car_id);
                    const badge = getStatusBadge(ec.status);

                    return (
                      <tr key={ec.id}>
                        <td>{car?.name || "—"}</td>
                        <td>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <Link
                              href={`/calendar/${eventId}/car/${ec.id}`}
                              className="btn-dark !px-3 !py-2 !rounded-lg"
                            >
                              <Wrench size={14} /> Gestisci
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:hidden">
              {eventCars.map((ec) => {
                const car = normalizeRelation(ec.car_id);
                const badge = getStatusBadge(ec.status);

                return (
                  <article
                    key={ec.id}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-neutral-900">{car?.name || "—"}</h3>
                        <div className="mt-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/calendar/${eventId}/car/${ec.id}`}
                        className="btn-dark !px-3 !py-2 !rounded-lg w-full justify-center"
                      >
                        <Wrench size={14} /> Gestisci
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}