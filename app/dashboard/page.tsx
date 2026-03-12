"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  GaugeCircle,
  CarFront,
  Wrench,
  Flag,
  Clock3,
  TriangleAlert,
  PlusCircle,
  CalendarDays,
  Cog,
  ShieldAlert,
  Activity,
  Fuel,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CarRow = {
  id: string;
  name: string;
  chassis_number: string | null;
  hours: number | null;
};

type ComponentRow = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  car_id: string | null;
};

type EventRow = {
  id: string;
  name: string;
  date: string | null;
};

type EventCarDataRow = {
  id: string;
  event_car_id: string;
  section: "checkup" | "fuel" | "notes" | "setup";
  data: any;
  created_at: string;
};

type EventCarTurnRow = {
  id: string;
  event_car_id: string;
  minutes: number;
  laps: number;
  notes: string | null;
  created_at: string;
};

type EventCarRelationRow = {
  id: string;
  event_id: string;
  car_id: string | null;
};

type ComponentStatus = {
  label: string;
  severity: 1 | 2 | 3;
  className: string;
};

type CarHealthRow = {
  car: CarRow;
  score: number;
  criticalCount: number;
  warningCount: number;
  label: string;
};

type PlannedMaintenanceRow = {
  id: string;
  title: string;
  detail: string;
  severity: 1 | 2 | 3;
};

type InsightRow = {
  id: string;
  title: string;
  detail: string;
  severity: 1 | 2 | 3;
};

function formatHours(value: number | null | undefined) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatHoursDecimal(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} h`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date();
  const target = new Date(value);
  const ms = target.setHours(0, 0, 0, 0) - new Date(today.setHours(0, 0, 0, 0)).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getExpiryStatus(expiryDate: string | null) {
  if (!expiryDate) return "none";

  const expiry = new Date(expiryDate);
  const today = new Date();

  if (expiry < today) return "expired";

  const months =
    (expiry.getFullYear() - today.getFullYear()) * 12 +
    (expiry.getMonth() - today.getMonth());

  if (months <= 6) return "expiring";
  return "ok";
}

function getComponentStatus(component: ComponentRow): ComponentStatus {
  const hours = Number(component.hours ?? 0);
  const warning = component.warning_threshold_hours;
  const revision = component.revision_threshold_hours;
  const expiryStatus = getExpiryStatus(component.expiry_date);

  if (expiryStatus === "expired") {
    return {
      label: "Scaduto",
      severity: 3,
      className: "bg-red-100 text-red-700",
    };
  }

  if (revision !== null && revision !== undefined && hours >= revision) {
    return {
      label: "Fuori soglia",
      severity: 3,
      className: "bg-red-100 text-red-700",
    };
  }

  if (expiryStatus === "expiring") {
    return {
      label: "In scadenza",
      severity: 2,
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  if (warning !== null && warning !== undefined && hours >= warning) {
    return {
      label: "In attenzione",
      severity: 2,
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "OK",
    severity: 1,
    className: "bg-green-100 text-green-700",
  };
}

function getSeverityClasses(severity: 1 | 2 | 3) {
  if (severity === 3) {
    return {
      card: "border-red-200 bg-red-50",
      badge: "bg-red-100 text-red-700",
      title: "text-red-800",
    };
  }

  if (severity === 2) {
    return {
      card: "border-yellow-200 bg-yellow-50",
      badge: "bg-yellow-100 text-yellow-700",
      title: "text-yellow-800",
    };
  }

  return {
    card: "border-green-200 bg-green-50",
    badge: "bg-green-100 text-green-700",
    title: "text-green-800",
  };
}

function progressColor(score: number) {
  if (score >= 85) return "bg-green-500";
  if (score >= 65) return "bg-yellow-500";
  return "bg-red-500";
}

function healthLabel(score: number) {
  if (score >= 85) return "Ottima";
  if (score >= 65) return "Da monitorare";
  return "Critica";
}

export default function Dashboard() {
  const [cars, setCars] = useState<CarRow[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventCarData, setEventCarData] = useState<EventCarDataRow[]>([]);
  const [eventCarTurns, setEventCarTurns] = useState<EventCarTurnRow[]>([]);
  const [eventCars, setEventCars] = useState<EventCarRelationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [
        { data: carsData, error: carsError },
        { data: compsData, error: compsError },
        { data: eventsData, error: eventsError },
        { data: eventCarDataRows, error: eventCarDataError },
        { data: eventCarTurnsRows, error: eventCarTurnsError },
        { data: eventCarsRows, error: eventCarsError },
      ] = await Promise.all([
        supabase
          .from("cars")
          .select("id, name, chassis_number, hours")
          .order("name", { ascending: true }),
        supabase
          .from("components")
          .select(
            "id, type, identifier, expiry_date, hours, life_hours, warning_threshold_hours, revision_threshold_hours, car_id"
          )
          .order("identifier", { ascending: true }),
        supabase
          .from("events")
          .select("id, name, date")
          .order("date", { ascending: true }),
        supabase
          .from("event_car_data")
          .select("id, event_car_id, section, data, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("event_car_turns")
          .select("id, event_car_id, minutes, laps, notes, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("event_cars")
          .select("id, event_id, car_id"),
      ]);

      if (!carsError) setCars((carsData || []) as CarRow[]);
      if (!compsError) setComponents((compsData || []) as ComponentRow[]);
      if (!eventsError) setEvents((eventsData || []) as EventRow[]);
      if (!eventCarDataError) setEventCarData((eventCarDataRows || []) as EventCarDataRow[]);
      if (!eventCarTurnsError) setEventCarTurns((eventCarTurnsRows || []) as EventCarTurnRow[]);
      if (!eventCarsError) setEventCars((eventCarsRows || []) as EventCarRelationRow[]);

      setLoading(false);
    };

    fetchData();
  }, []);

  const now = new Date();

  const upcomingEvents = useMemo(() => {
    return events
      .filter((event) => event.date && new Date(event.date) >= now)
      .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime())
      .slice(0, 5);
  }, [events, now]);

  const criticalComponents = useMemo(() => {
    return components
      .map((component) => ({
        ...component,
        status: getComponentStatus(component),
      }))
      .filter((component) => component.status.severity >= 2)
      .sort((a, b) => b.status.severity - a.status.severity)
      .slice(0, 8);
  }, [components]);

  const expiringComponents = useMemo(() => {
    return components
      .filter((component) => component.expiry_date)
      .sort(
        (a, b) =>
          new Date(a.expiry_date || "").getTime() - new Date(b.expiry_date || "").getTime()
      )
      .slice(0, 8);
  }, [components]);

  const topCarsByHours = useMemo(() => {
    return [...cars]
      .sort((a, b) => Number(b.hours ?? 0) - Number(a.hours ?? 0))
      .slice(0, 5);
  }, [cars]);

  const componentsInWarning = useMemo(() => {
    return components.filter((component) => {
      const status = getComponentStatus(component);
      return status.severity === 2;
    }).length;
  }, [components]);

  const urgentComponents = useMemo(() => {
    return components.filter((component) => {
      const status = getComponentStatus(component);
      return status.severity === 3;
    }).length;
  }, [components]);

  const carsReady = useMemo(() => {
    if (cars.length === 0) return 0;

    const carIdsWithProblems = new Set(
      components
        .filter((component) => getComponentStatus(component).severity >= 2 && component.car_id)
        .map((component) => component.car_id as string)
    );

    return cars.filter((car) => !carIdsWithProblems.has(car.id)).length;
  }, [cars, components]);

  const chartData = useMemo(() => {
    return cars.map((car) => ({
      name: car.name,
      ore: Number(car.hours ?? 0),
    }));
  }, [cars]);

  const latestCheckups = useMemo(() => {
    const latestMap = new Map<string, EventCarDataRow>();

    for (const row of eventCarData) {
      if (row.section !== "checkup") continue;
      if (!latestMap.has(row.event_car_id)) {
        latestMap.set(row.event_car_id, row);
      }
    }

    return latestMap;
  }, [eventCarData]);

  const carHealth = useMemo<CarHealthRow[]>(() => {
    return cars
      .map((car) => {
        const carComponents = components.filter((c) => c.car_id === car.id);
        const criticalCount = carComponents.filter(
          (c) => getComponentStatus(c).severity === 3
        ).length;
        const warningCount = carComponents.filter(
          (c) => getComponentStatus(c).severity === 2
        ).length;

        const relatedEventCars = eventCars.filter((ec) => ec.car_id === car.id).map((ec) => ec.id);

        let checkupProblems = 0;
        let checkupWarnings = 0;

        for (const eventCarId of relatedEventCars) {
          const row = latestCheckups.get(eventCarId);
          if (!row?.data) continue;

          for (const value of Object.values(row.data || {})) {
            if (value === "Problema") checkupProblems += 1;
            if (value === "Da controllare") checkupWarnings += 1;
          }
        }

        const score = Math.max(
          0,
          100 - criticalCount * 25 - warningCount * 10 - checkupProblems * 10 - checkupWarnings * 4
        );

        return {
          car,
          score,
          criticalCount: criticalCount + checkupProblems,
          warningCount: warningCount + checkupWarnings,
          label: healthLabel(score),
        };
      })
      .sort((a, b) => a.score - b.score);
  }, [cars, components, eventCars, latestCheckups]);

  const plannedMaintenances = useMemo<PlannedMaintenanceRow[]>(() => {
    const rows: PlannedMaintenanceRow[] = [];

    for (const component of components) {
      const hours = Number(component.hours ?? 0);
      const lifeHours = Number(component.life_hours ?? 0);
      const revision = Number(component.revision_threshold_hours ?? 0);
      const expiry = getExpiryStatus(component.expiry_date);

      if (expiry === "expired") {
        rows.push({
          id: `${component.id}-expired`,
          title: `${component.type} – ${component.identifier}`,
          detail: "Scadenza superata",
          severity: 3,
        });
        continue;
      }

      if (expiry === "expiring") {
        rows.push({
          id: `${component.id}-expiring`,
          title: `${component.type} – ${component.identifier}`,
          detail: `Scadenza il ${formatDate(component.expiry_date)}`,
          severity: 2,
        });
      }

      if (revision > 0) {
        const remaining = revision - hours;

        if (remaining <= 0) {
          rows.push({
            id: `${component.id}-revision-now`,
            title: `${component.type} – ${component.identifier}`,
            detail: "Revisione necessaria subito",
            severity: 3,
          });
        } else if (remaining <= 2) {
          rows.push({
            id: `${component.id}-revision-soon`,
            title: `${component.type} – ${component.identifier}`,
            detail: `Revisione tra ${remaining.toFixed(2)} h`,
            severity: 3,
          });
        } else if (remaining <= 5) {
          rows.push({
            id: `${component.id}-revision-plan`,
            title: `${component.type} – ${component.identifier}`,
            detail: `Pianificare revisione tra ${remaining.toFixed(2)} h`,
            severity: 2,
          });
        }
      } else if (lifeHours > 0) {
        const remaining = lifeHours - hours;

        if (remaining <= 0) {
          rows.push({
            id: `${component.id}-life-ended`,
            title: `${component.type} – ${component.identifier}`,
            detail: "Vita componente terminata",
            severity: 3,
          });
        } else if (remaining <= 2) {
          rows.push({
            id: `${component.id}-life-critical`,
            title: `${component.type} – ${component.identifier}`,
            detail: `Solo ${remaining.toFixed(2)} h rimanenti`,
            severity: 3,
          });
        } else if (remaining <= 5) {
          rows.push({
            id: `${component.id}-life-plan`,
            title: `${component.type} – ${component.identifier}`,
            detail: `${remaining.toFixed(2)} h rimanenti`,
            severity: 2,
          });
        }
      }
    }

    return rows.sort((a, b) => b.severity - a.severity).slice(0, 8);
  }, [components]);

  const fuelInsights = useMemo<InsightRow[]>(() => {
    const fuelRows = eventCarData.filter((row) => row.section === "fuel").slice(0, 6);

    if (fuelRows.length < 2) return [];

    const consumptions = fuelRows
      .map((row) => {
        const fuelStart = Number(row.data?.fuelStart ?? 0);
        const fuelEnd = Number(row.data?.fuelEnd ?? 0);
        const lapsDone = Number(row.data?.lapsDone ?? 0);
        const used = fuelStart - fuelEnd;
        if (lapsDone <= 0 || used <= 0) return null;
        return used / lapsDone;
      })
      .filter((value): value is number => value !== null);

    if (consumptions.length < 2) return [];

    const last = consumptions[0];
    const avg =
      consumptions.slice(1).reduce((acc, value) => acc + value, 0) /
      Math.max(1, consumptions.length - 1);

    if (avg <= 0) return [];

    const variation = ((last - avg) / avg) * 100;

    if (variation > 10) {
      return [
        {
          id: "fuel-high-consumption",
          title: "Consumo carburante alto",
          detail: `Ultimo rilievo +${variation.toFixed(0)}% rispetto alla media recente`,
          severity: 2,
        },
      ];
    }

    return [];
  }, [eventCarData]);

  const raceEngineerInsights = useMemo<InsightRow[]>(() => {
    const insights: InsightRow[] = [];

    if (urgentComponents > 0) {
      insights.push({
        id: "urgent-components",
        title: "Componenti fuori soglia",
        detail: `${urgentComponents} componenti richiedono attenzione immediata`,
        severity: 3,
      });
    }

    if (plannedMaintenances.some((item) => item.severity === 3)) {
      const item = plannedMaintenances.find((row) => row.severity === 3);
      if (item) {
        insights.push({
          id: `planner-${item.id}`,
          title: item.title,
          detail: item.detail,
          severity: 3,
        });
      }
    }

    const weakestCar = [...carHealth].sort((a, b) => a.score - b.score)[0];
    if (weakestCar && weakestCar.score < 80) {
      insights.push({
        id: `health-${weakestCar.car.id}`,
        title: `${weakestCar.car.name} da monitorare`,
        detail: `Salute ${weakestCar.score}% • ${weakestCar.criticalCount} criticità • ${weakestCar.warningCount} warning`,
        severity: weakestCar.score < 65 ? 3 : 2,
      });
    }

    if (upcomingEvents[0]) {
      const days = daysUntil(upcomingEvents[0].date);
      if (days !== null && days <= 7 && plannedMaintenances.length > 0) {
        insights.push({
          id: "next-event-prep",
          title: `Preparazione ${upcomingEvents[0].name}`,
          detail: `Evento tra ${days} giorni: verificare manutenzioni e componenti critici`,
          severity: 2,
        });
      }
    }

    return [...insights, ...fuelInsights].slice(0, 5);
  }, [urgentComponents, plannedMaintenances, carHealth, upcomingEvents, fuelInsights]);

  const totalCars = cars.length;
  const totalComponents = components.length;
  const nextEvent = upcomingEvents[0] || null;

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        Caricamento dashboard...
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
                <Flag size={14} />
                Team control center
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Dashboard parco auto
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Stato vetture, criticità tecniche, manutenzioni da pianificare e suggerimenti
                operativi per il prossimo evento.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<CheckCircle size={18} className="text-yellow-600" />}
              label="Auto pronte"
              value={String(carsReady)}
              valueClassName="text-green-700"
            />
            <SummaryCard
              icon={<AlertTriangle size={18} className="text-yellow-600" />}
              label="Componenti in attenzione"
              value={String(componentsInWarning)}
              valueClassName={componentsInWarning > 0 ? "text-yellow-700" : "text-green-700"}
            />
            <SummaryCard
              icon={<XCircle size={18} className="text-yellow-600" />}
              label="Urgenze"
              value={String(urgentComponents)}
              valueClassName={urgentComponents > 0 ? "text-red-700" : "text-green-700"}
            />
            <SummaryCard
              icon={<Calendar size={18} className="text-yellow-600" />}
              label="Eventi programmati"
              value={String(upcomingEvents.length)}
            />
          </div>
        </div>
      </section>

      <section className="card-base p-5">
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle className="text-yellow-500" size={18} />
          <h2 className="text-lg font-bold text-neutral-800">Azioni rapide</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <QuickActionCard
            href="/cars"
            icon={<CarFront size={18} />}
            title="Gestione auto"
            subtitle="Aggiungi o modifica auto"
          />
          <QuickActionCard
            href="/components"
            icon={<Cog size={18} />}
            title="Componenti"
            subtitle="Controlla componenti e revisioni"
          />
          <QuickActionCard
            href="/maintenances"
            icon={<Wrench size={18} />}
            title="Manutenzioni"
            subtitle="Registra nuovi interventi"
          />
          <QuickActionCard
            href="/calendar"
            icon={<CalendarDays size={18} />}
            title="Eventi"
            subtitle="Gestisci calendario e gare"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-base p-5">
          <div className="flex items-center gap-2 mb-3">
            <CarFront className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Parco auto</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniInfoCard label="Auto totali" value={String(totalCars)} />
            <MiniInfoCard label="Componenti totali" value={String(totalComponents)} />
          </div>
        </div>

        <div className="card-base p-5">
          <div className="flex items-center gap-2 mb-3">
            <TriangleAlert className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Attenzione immediata</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="text-red-700 font-semibold">Urgenze</div>
              <div className="text-red-800 text-lg font-bold mt-1">{urgentComponents}</div>
            </div>

            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
              <div className="text-yellow-700 font-semibold">Da controllare</div>
              <div className="text-yellow-800 text-lg font-bold mt-1">{componentsInWarning}</div>
            </div>
          </div>
        </div>

        <div className="card-base p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock3 className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Prossimo evento</h2>
          </div>

          {nextEvent ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="font-bold text-neutral-900">{nextEvent.name}</div>
              <div className="text-sm text-neutral-500 mt-1">{formatDate(nextEvent.date)}</div>
              <div className="text-xs text-neutral-500 mt-2">
                {daysUntil(nextEvent.date)} giorni al prossimo evento
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
              Nessun evento futuro programmato.
            </div>
          )}
        </div>
      </section>

      <section className="card-base p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="text-yellow-500" size={18} />
          <h2 className="text-lg font-bold text-neutral-800">Consulente tecnico</h2>
        </div>

        {raceEngineerInsights.length === 0 ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Nessun alert rilevante al momento. Situazione generale sotto controllo.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {raceEngineerInsights.map((insight) => {
              const styles = getSeverityClasses(insight.severity);
              return (
                <div key={insight.id} className={`rounded-xl border p-4 ${styles.card}`}>
                  <div className={`font-bold ${styles.title}`}>{insight.title}</div>
                  <div className="text-sm text-neutral-700 mt-1">{insight.detail}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Salute vetture</h2>
          </div>

          {carHealth.length === 0 ? (
            <p className="text-neutral-500">Nessuna auto disponibile.</p>
          ) : (
            <div className="space-y-4">
              {carHealth.map((row) => (
                <div key={row.car.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-neutral-900">{row.car.name}</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {row.car.chassis_number || "Telaio non specificato"}
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        row.score >= 85
                          ? "bg-green-100 text-green-700"
                          : row.score >= 65
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {row.label}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-neutral-600">Indice salute</span>
                      <span className="font-bold text-neutral-900">{row.score}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-neutral-200 overflow-hidden">
                      <div
                        className={`h-full ${progressColor(row.score)}`}
                        style={{ width: `${row.score}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-1 font-semibold">
                      Criticità: {row.criticalCount}
                    </span>
                    <span className="rounded-full bg-yellow-100 text-yellow-700 px-2.5 py-1 font-semibold">
                      Warning: {row.warningCount}
                    </span>
                    <span className="rounded-full bg-neutral-200 text-neutral-700 px-2.5 py-1 font-semibold">
                      Ore auto: {formatHours(row.car.hours)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-base overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-3 font-bold text-lg">
            Ore vettura
          </div>
          <div className="h-80 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)} h`} />
                <Bar dataKey="ore" fill="#facc15" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-base overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-3 font-bold text-lg flex items-center gap-2">
            <Wrench size={20} /> Manutenzioni da pianificare
          </div>
          <ul className="space-y-3 p-4">
            {plannedMaintenances.length === 0 ? (
              <li className="text-neutral-500">Nessuna manutenzione urgente da pianificare.</li>
            ) : (
              plannedMaintenances.map((item) => {
                const styles = getSeverityClasses(item.severity);
                return (
                  <li
                    key={item.id}
                    className={`rounded-xl border p-4 ${styles.card}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`font-bold ${styles.title}`}>{item.title}</div>
                        <div className="text-sm text-neutral-700 mt-1">{item.detail}</div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles.badge}`}>
                        {item.severity === 3
                          ? "Critico"
                          : item.severity === 2
                          ? "Pianificare"
                          : "OK"}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="card-base overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-3 font-bold text-lg flex items-center gap-2">
            <Wrench size={20} /> Componenti critici
          </div>
          <ul className="space-y-3 p-4">
            {criticalComponents.length === 0 ? (
              <li className="text-neutral-500">Nessuna criticità rilevata.</li>
            ) : (
              criticalComponents.map((component) => (
                <li
                  key={component.id}
                  className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3"
                >
                  <div className="min-w-0">
                    <div className="text-neutral-800 font-semibold truncate">
                      {component.type} – {component.identifier}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Ore attuali: {formatHours(component.hours)} • Vita:{" "}
                      {formatHours(component.life_hours)}
                    </div>
                  </div>

                  <span
                    className={`text-sm px-3 py-1 rounded-full font-semibold whitespace-nowrap ${component.status.className}`}
                  >
                    {component.status.label}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card-base overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-3 font-bold text-lg">
            Prossime scadenze
          </div>
          <ul className="space-y-3 p-4">
            {expiringComponents.length === 0 ? (
              <li className="text-neutral-500">Nessuna scadenza registrata.</li>
            ) : (
              expiringComponents.map((component) => (
                <li
                  key={component.id}
                  className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3"
                >
                  <span className="text-neutral-700 font-medium">
                    {component.type} – {component.identifier}
                  </span>
                  <span
                    className={`text-sm px-3 py-1 rounded-full font-semibold whitespace-nowrap ${
                      getExpiryStatus(component.expiry_date) === "expired"
                        ? "bg-red-100 text-red-700"
                        : getExpiryStatus(component.expiry_date) === "expiring"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {component.expiry_date ? formatDate(component.expiry_date) : "—"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card-base overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-3 font-bold text-lg flex items-center gap-2">
            <GaugeCircle size={20} /> Prossimi eventi
          </div>
          <ul className="space-y-3 p-4">
            {upcomingEvents.length === 0 ? (
              <li className="text-neutral-500">Nessun evento futuro programmato.</li>
            ) : (
              upcomingEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3"
                >
                  <div>
                    <div className="text-neutral-700 font-semibold">{event.name}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {daysUntil(event.date)} giorni
                    </div>
                  </div>
                  <span className="text-sm bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full whitespace-nowrap">
                    {formatDate(event.date)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card-base overflow-hidden xl:col-span-2">
          <div className="bg-black text-yellow-500 px-4 py-3 font-bold text-lg flex items-center gap-2">
            <CarFront size={20} /> Auto con più ore
          </div>
          <ul className="space-y-3 p-4">
            {topCarsByHours.length === 0 ? (
              <li className="text-neutral-500">Nessuna auto disponibile.</li>
            ) : (
              topCarsByHours.map((car) => (
                <li
                  key={car.id}
                  className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-800">{car.name}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {car.chassis_number || "—"}
                    </div>
                  </div>
                  <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-semibold whitespace-nowrap">
                    {formatHoursDecimal(car.hours)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <div className="flex justify-end">
        <Link
          href="/components"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          Vai ai componenti <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: ReactNode;
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

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function QuickActionCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
    >
      <div className="flex items-center gap-2 text-neutral-800 font-semibold">
        <span className="text-yellow-600">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="mt-2 text-sm text-neutral-500">{subtitle}</div>
    </Link>
  );
}