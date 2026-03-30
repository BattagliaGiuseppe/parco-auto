"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { ArrowLeft, Activity, TimerReset, TrendingUp, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type DriverRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
};

type EventRow = {
  id: string;
  name: string;
};

type SessionRow = {
  id: string;
  event_id: string;
  name: string;
  session_type: string;
  starts_at: string | null;
};

type CarRow = {
  id: string;
  name: string;
};

type PerformanceRow = {
  id: string;
  event_session_id: string;
  event_car_id: string;
  driver_id: string;
  best_lap_time: string | null;
  average_lap_time: string | null;
  consistency_score: number | null;
  laps_completed: number | null;
  incidents: number | null;
  driver_feedback: string | null;
  engineer_notes: string | null;
  track_conditions: string | null;
  created_at: string;
};

type EventCarRow = {
  id: string;
  event_id: string | null;
  car_id: string | null;
};

function driverLabel(driver: DriverRow | null) {
  if (!driver) return "Pilota";
  const full = `${driver.first_name} ${driver.last_name}`.trim();
  return driver.nickname?.trim() ? `${full} (${driver.nickname.trim()})` : full;
}

function parseLapToSeconds(value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim();
  const parts = v.split(":");
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
  }
  const direct = Number(v);
  return Number.isFinite(direct) ? direct : null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT");
}

export default function DriverPerformancePage() {
  const params = useParams();
  const driverId = params?.id as string;

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [performances, setPerformances] = useState<PerformanceRow[]>([]);
  const [eventsMap, setEventsMap] = useState<Record<string, string>>({});
  const [sessionsMap, setSessionsMap] = useState<Record<string, SessionRow>>({});
  const [carsMap, setCarsMap] = useState<Record<string, string>>({});
  const [eventCarsMap, setEventCarsMap] = useState<Record<string, EventCarRow>>({});
  const [loading, setLoading] = useState(true);

  const [eventFilter, setEventFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const ctx = await getCurrentTeamContext();

        const [
          { data: driverData, error: driverError },
          { data: perfData, error: perfError },
          { data: eventsData, error: eventsError },
          { data: sessionsData, error: sessionsError },
          { data: carsData, error: carsError },
          { data: eventCarsData, error: eventCarsError },
        ] = await Promise.all([
          supabase
            .from("drivers")
            .select("id, first_name, last_name, nickname")
            .eq("team_id", ctx.teamId)
            .eq("id", driverId)
            .single(),
          supabase
            .from("driver_session_performance")
            .select("*")
            .eq("team_id", ctx.teamId)
            .eq("driver_id", driverId)
            .order("created_at", { ascending: false }),
          supabase
            .from("events")
            .select("id, name")
            .eq("team_id", ctx.teamId),
          supabase
            .from("event_sessions")
            .select("id, event_id, name, session_type, starts_at")
            .eq("team_id", ctx.teamId),
          supabase
            .from("cars")
            .select("id, name")
            .eq("team_id", ctx.teamId),
          supabase
            .from("event_cars")
            .select("id, event_id, car_id")
            .eq("team_id", ctx.teamId),
        ]);

        if (driverError) throw driverError;
        if (perfError) throw perfError;
        if (eventsError) throw eventsError;
        if (sessionsError) throw sessionsError;
        if (carsError) throw carsError;
        if (eventCarsError) throw eventCarsError;

        setDriver(driverData as DriverRow);
        setPerformances((perfData || []) as PerformanceRow[]);

        const eventsDict: Record<string, string> = {};
        ((eventsData || []) as EventRow[]).forEach((row) => {
          eventsDict[row.id] = row.name;
        });
        setEventsMap(eventsDict);

        const sessionsDict: Record<string, SessionRow> = {};
        ((sessionsData || []) as SessionRow[]).forEach((row) => {
          sessionsDict[row.id] = row;
        });
        setSessionsMap(sessionsDict);

        const carsDict: Record<string, string> = {};
        ((carsData || []) as CarRow[]).forEach((row) => {
          carsDict[row.id] = row.name;
        });
        setCarsMap(carsDict);

        const eventCarsDict: Record<string, EventCarRow> = {};
        ((eventCarsData || []) as EventCarRow[]).forEach((row) => {
          eventCarsDict[row.id] = row;
        });
        setEventCarsMap(eventCarsDict);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    if (driverId) loadData();
  }, [driverId]);

  const filteredPerformances = useMemo(() => {
    return performances.filter((row) => {
      const session = sessionsMap[row.event_session_id];
      const eventId = session?.event_id || eventCarsMap[row.event_car_id]?.event_id || "";
      const sessionOk = !sessionFilter || row.event_session_id === sessionFilter;
      const eventOk = !eventFilter || eventId === eventFilter;
      return sessionOk && eventOk;
    });
  }, [performances, sessionsMap, eventCarsMap, eventFilter, sessionFilter]);

  const bestLap = useMemo(() => {
    let best: { value: string; seconds: number } | null = null;
    for (const row of filteredPerformances) {
      const sec = parseLapToSeconds(row.best_lap_time);
      if (sec === null) continue;
      if (!best || sec < best.seconds) {
        best = { value: row.best_lap_time as string, seconds: sec };
      }
    }
    return best?.value || "—";
  }, [filteredPerformances]);

  const avgConsistency = useMemo(() => {
    const values = filteredPerformances
      .map((row) => row.consistency_score)
      .filter((v): v is number => typeof v === "number");
    if (!values.length) return "—";
    const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
    return avg.toFixed(2);
  }, [filteredPerformances]);

  const totalLaps = useMemo(() => {
    return filteredPerformances.reduce((acc, row) => acc + Number(row.laps_completed || 0), 0);
  }, [filteredPerformances]);

  const totalIncidents = useMemo(() => {
    return filteredPerformances.reduce((acc, row) => acc + Number(row.incidents || 0), 0);
  }, [filteredPerformances]);

  const statItems: StatItem[] = [
    {
      label: "Best lap",
      value: bestLap,
      icon: <TimerReset size={18} />,
    },
    {
      label: "Costanza media",
      value: avgConsistency,
      icon: <TrendingUp size={18} />,
    },
    {
      label: "Giri completati",
      value: String(totalLaps),
      icon: <Activity size={18} />,
    },
    {
      label: "Incidenti",
      value: String(totalIncidents),
      icon: <AlertTriangle size={18} />,
      valueClassName: totalIncidents > 0 ? "text-red-700" : "text-green-700",
    },
  ];

  const availableEvents = useMemo(() => {
    const ids = new Set<string>();
    filteredPerformances.forEach((row) => {
      const session = sessionsMap[row.event_session_id];
      const eventId = session?.event_id || eventCarsMap[row.event_car_id]?.event_id || "";
      if (eventId) ids.add(eventId);
    });
    return Array.from(ids);
  }, [filteredPerformances, sessionsMap, eventCarsMap]);

  if (loading) {
    return <div className="card-base p-10 text-center text-neutral-500">Caricamento...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Performance • ${driverLabel(driver)}`}
        subtitle="Storico performance per sessione, evento e auto"
        icon={<Activity size={22} />}
        actions={
          <Link href={`/drivers/${driverId}`} className="btn-secondary">
            <ArrowLeft size={16} />
            Torna al pilota
          </Link>
        }
      />

      <SectionCard title="Riepilogo" subtitle="Indicatori sintetici delle performance filtrate">
        <StatsGrid items={statItems} />
      </SectionCard>

      <SectionCard title="Filtri" subtitle="Filtra per evento e sessione">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setSessionFilter("");
            }}
            className="input-base"
          >
            <option value="">Tutti gli eventi</option>
            {Object.entries(eventsMap).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="input-base"
          >
            <option value="">Tutte le sessioni</option>
            {Object.values(sessionsMap)
              .filter((session) => !eventFilter || session.event_id === eventFilter)
              .map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Storico performance" subtitle="Elenco completo delle sessioni registrate">
        {filteredPerformances.length === 0 ? (
          <EmptyState title="Nessuna performance trovata" description="Non ci sono dati da mostrare con i filtri attuali." />
        ) : (
          <div className="space-y-4">
            {filteredPerformances.map((row) => {
              const session = sessionsMap[row.event_session_id];
              const eventName = session?.event_id ? eventsMap[session.event_id] : "Evento";
              const eventCar = eventCarsMap[row.event_car_id];
              const carName = eventCar?.car_id ? carsMap[eventCar.car_id] || "Auto" : "Auto";

              return (
                <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-lg font-bold text-neutral-900">
                        {session?.name || "Sessione"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {eventName} • {carName}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={session?.session_type || "sessione"} tone="blue" />
                      <StatusBadge label={formatDateTime(row.created_at)} tone="neutral" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                    <MiniValue label="Best lap" value={row.best_lap_time || "—"} />
                    <MiniValue label="Lap medio" value={row.average_lap_time || "—"} />
                    <MiniValue label="Costanza" value={row.consistency_score?.toString() || "—"} />
                    <MiniValue label="Giri" value={row.laps_completed?.toString() || "0"} />
                    <MiniValue label="Incidenti" value={row.incidents?.toString() || "0"} />
                  </div>

                  {(row.track_conditions || row.driver_feedback || row.engineer_notes) && (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <MiniValue label="Condizioni pista" value={row.track_conditions || "—"} />
                      <MiniValue label="Feedback pilota" value={row.driver_feedback || "—"} />
                      <MiniValue label="Note ingegnere" value={row.engineer_notes || "—"} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
