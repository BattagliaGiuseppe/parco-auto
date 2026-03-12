"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function formatHours(value: number | null | undefined) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
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

function getComponentStatus(component: ComponentRow) {
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

export default function Dashboard() {
  const [cars, setCars] = useState<CarRow[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [
        { data: carsData, error: carsError },
        { data: compsData, error: compsError },
        { data: eventsData, error: eventsError },
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
      ]);

      if (!carsError) setCars((carsData || []) as CarRow[]);
      if (!compsError) setComponents((compsData || []) as ComponentRow[]);
      if (!eventsError) setEvents((eventsData || []) as EventRow[]);

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
  }, [events]);

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
      return status.label === "In attenzione" || status.label === "In scadenza";
    }).length;
  }, [components]);

  const urgentComponents = useMemo(() => {
    return components.filter((component) => {
      const status = getComponentStatus(component);
      return status.label === "Fuori soglia" || status.label === "Scaduto";
    }).length;
  }, [components]);

  const carsReady = useMemo(() => {
    if (cars.length === 0) return 0;

    const carIdsWithProblems = new Set(
      components
        .filter((component) => {
          const status = getComponentStatus(component);
          return status.severity >= 2 && component.car_id;
        })
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
                Panoramica operativa
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Dashboard parco auto
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Controlla in un colpo d’occhio stato auto, componenti critici, scadenze ed eventi
                imminenti.
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
            subtitle="Controlla componenti e scadenze"
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
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
              Nessun evento futuro programmato.
            </div>
          )}
        </div>
      </section>

      <section className="card-base overflow-hidden">
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
                    {formatHours(car.hours)}
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
                  <span className="text-neutral-700 font-semibold">{event.name}</span>
                  <span className="text-sm bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full whitespace-nowrap">
                    {formatDate(event.date)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
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
  icon: React.ReactNode;
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