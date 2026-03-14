"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { getTeamSettings, type TeamSettings } from "@/lib/teamSettings";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  CarFront,
  Wrench,
  Flag,
  Clock3,
  TriangleAlert,
  ArrowRight,
  ShieldAlert,
  Activity,
  CalendarDays,
} from "lucide-react";
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

type ComponentStatus = {
  label: string;
  severity: 1 | 2 | 3;
  className: string;
};

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
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
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

export default function DashboardPage() {
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const ctx = await getCurrentTeamContext();

        const [settingsData, carsRes, componentsRes, eventsRes] = await Promise.all([
          getTeamSettings(),
          supabase
            .from("cars")
            .select("id, name, chassis_number, hours")
            .eq("team_id", ctx.teamId)
            .order("name", { ascending: true }),
          supabase
            .from("components")
            .select(
              "id, type, identifier, expiry_date, hours, life_hours, warning_threshold_hours, revision_threshold_hours, car_id"
            )
            .eq("team_id", ctx.teamId)
            .order("identifier", { ascending: true }),
          supabase
            .from("events")
            .select("id, name, date")
            .eq("team_id", ctx.teamId)
            .order("date", { ascending: true }),
        ]);

        setSettings(settingsData || null);
        if (!carsRes.error) setCars((carsRes.data || []) as CarRow[]);
        if (!componentsRes.error) setComponents((componentsRes.data || []) as ComponentRow[]);
        if (!eventsRes.error) setEvents((eventsRes.data || []) as EventRow[]);
      } catch (error) {
        console.error("Errore caricamento dashboard:", error);
      } finally {
        setLoading(false);
      }
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

  const nextEvent = upcomingEvents[0] || null;

  const componentsInWarning = useMemo(() => {
    return components.filter((component) => getComponentStatus(component).severity === 2).length;
  }, [components]);

  const urgentComponents = useMemo(() => {
    return components.filter((component) => getComponentStatus(component).severity === 3).length;
  }, [components]);

  const expiringSoon = useMemo(() => {
    return components
      .filter((component) => {
        const status = getExpiryStatus(component.expiry_date);
        return status === "expired" || status === "expiring";
      })
      .slice(0, 6);
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

  const topCarsByHours = useMemo(() => {
    return [...cars]
      .sort((a, b) => Number(b.hours ?? 0) - Number(a.hours ?? 0))
      .slice(0, 5);
  }, [cars]);

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

  const teamName = settings?.team_name || "Battaglia Racing";
  const cover = settings?.dashboard_cover_url || null;
  const logo = settings?.team_logo_url || null;

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        Caricamento dashboard...
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="relative overflow-hidden rounded-2xl border border-neutral-200 min-h-[260px]">
        {cover ? (
          <img src={cover} alt="Dashboard cover" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-black via-neutral-900 to-neutral-800" />
        )}

        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-200">
              <Flag size={14} />
              Team control center
            </div>

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              {logo ? (
                <div className="h-20 w-20 rounded-2xl bg-white/90 p-2 shadow-lg">
                  <img src={logo} alt={teamName} className="h-full w-full object-contain" />
                </div>
              ) : null}

              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-400">{teamName}</h1>
                <p className="mt-2 text-sm text-yellow-100/80 max-w-2xl">
                  Stato vetture, criticità tecniche, manutenzioni da pianificare e prossimi eventi
                  del team in un’unica dashboard operativa.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-4 text-sm text-yellow-100 min-w-[260px]">
            <div className="font-bold text-yellow-300">Prossimo evento</div>
            <div className="mt-2 text-base font-semibold">{nextEvent?.name || "Nessun evento"}</div>
            <div className="mt-1 text-yellow-100/80">{nextEvent ? formatDate(nextEvent.date) : "—"}</div>
            <div className="mt-2 text-xs text-yellow-100/70">
              {nextEvent?.date ? `${daysUntil(nextEvent.date)} giorni` : "Calendario libero"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                      Ore attuali: {formatHoursDecimal(component.hours)}
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
          <div className="bg-black text-yellow-500 px-4 py-3 font-bold text-lg flex items-center gap-2">
            <CalendarDays size={20} /> Prossime scadenze
          </div>
          <ul className="space-y-3 p-4">
            {expiringSoon.length === 0 ? (
              <li className="text-neutral-500">Nessuna scadenza imminente.</li>
            ) : (
              expiringSoon.map((component) => (
                <li
                  key={component.id}
                  className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3"
                >
                  <div>
                    <div className="font-semibold text-neutral-800">
                      {component.type} – {component.identifier}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {component.expiry_date ? formatDate(component.expiry_date) : "—"}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      getExpiryStatus(component.expiry_date) === "expired"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {getExpiryStatus(component.expiry_date) === "expired" ? "Scaduto" : "In scadenza"}
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
                      {car.chassis_number || "Telaio non specificato"}
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