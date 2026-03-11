"use client";

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

      if (!carsError) {
        setCars((carsData || []) as CarRow[]);
      }

      if (!compsError) {
        setComponents((compsData || []) as ComponentRow[]);
      }

      if (!eventsError) {
        setEvents((eventsData || []) as EventRow[]);
      }

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

  if (loading) {
    return (
      <div className={`p-6 ${audiowide.className}`}>
        <p>Caricamento dashboard...</p>
      </div>
    );
  }

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">🏁 Dashboard</h1>

      {/* Cards principali */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Auto pronte
          </div>
          <div className="flex items-center gap-3 p-6">
            <CheckCircle className="text-green-500" size={36} />
            <span className="text-2xl font-bold">{carsReady}</span>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Componenti in attenzione
          </div>
          <div className="flex items-center gap-3 p-6">
            <AlertTriangle className="text-yellow-500" size={36} />
            <span className="text-2xl font-bold">{componentsInWarning}</span>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Urgenze
          </div>
          <div className="flex items-center gap-3 p-6">
            <XCircle className="text-red-500" size={36} />
            <span className="text-2xl font-bold">{urgentComponents}</span>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Eventi programmati
          </div>
          <div className="flex items-center gap-3 p-6">
            <Calendar className="text-yellow-500" size={36} />
            <span className="text-2xl font-bold">{upcomingEvents.length}</span>
          </div>
        </div>
      </div>

      {/* Grafico ore auto */}
      <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
        <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
          Ore vettura
        </div>
        <div className="h-72 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)} h`} />
              <Bar dataKey="ore" fill="#facc15" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Liste */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Componenti critici */}
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg flex items-center gap-2">
            <Wrench size={20} /> Componenti critici
          </div>
          <ul className="space-y-3 p-4">
            {criticalComponents.length === 0 ? (
              <li className="text-gray-500">Nessuna criticità rilevata.</li>
            ) : (
              criticalComponents.map((component) => (
                <li
                  key={component.id}
                  className="flex items-center justify-between gap-3 border-b pb-2"
                >
                  <div>
                    <div className="text-gray-800 font-semibold">
                      {component.type} – {component.identifier}
                    </div>
                    <div className="text-xs text-gray-500">
                      Ore attuali: {formatHours(component.hours)} • Vita:{" "}
                      {formatHours(component.life_hours)}
                    </div>
                  </div>

                  <span
                    className={`text-sm px-3 py-1 rounded-full font-semibold ${component.status.className}`}
                  >
                    {component.status.label}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Prossime scadenze */}
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Prossime Scadenze
          </div>
          <ul className="space-y-3 p-4">
            {expiringComponents.length === 0 ? (
              <li className="text-gray-500">Nessuna scadenza registrata.</li>
            ) : (
              expiringComponents.map((component) => (
                <li key={component.id} className="flex items-center justify-between gap-3">
                  <span className="text-gray-700">
                    {component.type} – {component.identifier}
                  </span>
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${
                      getExpiryStatus(component.expiry_date) === "expired"
                        ? "bg-red-100 text-red-700"
                        : getExpiryStatus(component.expiry_date) === "expiring"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {component.expiry_date
                      ? new Date(component.expiry_date).toLocaleDateString("it-IT")
                      : "—"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Auto con più ore */}
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg flex items-center gap-2">
            <CarFront size={20} /> Auto con più ore
          </div>
          <ul className="space-y-3 p-4">
            {topCarsByHours.length === 0 ? (
              <li className="text-gray-500">Nessuna auto disponibile.</li>
            ) : (
              topCarsByHours.map((car) => (
                <li key={car.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-800">{car.name}</div>
                    <div className="text-xs text-gray-500">{car.chassis_number || "—"}</div>
                  </div>
                  <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-semibold">
                    {formatHours(car.hours)} h
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Prossimi eventi */}
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg flex items-center gap-2">
            <GaugeCircle size={20} /> Prossimi eventi
          </div>
          <ul className="space-y-3 p-4">
            {upcomingEvents.length === 0 ? (
              <li className="text-gray-500">Nessun evento futuro programmato.</li>
            ) : (
              upcomingEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3">
                  <span className="text-gray-700 font-semibold">{event.name}</span>
                  <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                    {event.date
                      ? new Date(event.date).toLocaleDateString("it-IT")
                      : "—"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
