"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Wrench,
  Loader2,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CalendarDays,
  PlusCircle,
  ArrowRight,
  ShieldAlert,
  CarFront,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CarRow = {
  id: string;
  name: string;
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

type FilterMode = "all" | "ok" | "warning" | "critical" | "expired";

type ComponentStatus = {
  label: string;
  severity: 1 | 2 | 3;
  className: string;
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

function getPredictiveState(component: ComponentRow) {
  const hours = Number(component.hours ?? 0);
  const life = Number(component.life_hours ?? 0);

  if (!life || life <= 0) {
    return {
      label: "Vita non definita",
      severity: 1 as const,
      percentage: 0,
      remainingHours: null as number | null,
    };
  }

  const usage = hours / life;
  const remaining = life - hours;
  const percentage = Math.max(0, Math.min(100, usage * 100));

  if (usage >= 1) {
    return {
      label: "Critico",
      severity: 3 as const,
      percentage: 100,
      remainingHours: remaining,
    };
  }

  if (usage >= 0.85) {
    return {
      label: "Pianificare",
      severity: 3 as const,
      percentage,
      remainingHours: remaining,
    };
  }

  if (usage >= 0.7) {
    return {
      label: "Attenzione",
      severity: 2 as const,
      percentage,
      remainingHours: remaining,
    };
  }

  return {
    label: "OK",
    severity: 1 as const,
    percentage,
    remainingHours: remaining,
  };
}

function getProgressColor(severity: 1 | 2 | 3) {
  if (severity === 3) return "bg-red-500";
  if (severity === 2) return "bg-yellow-500";
  return "bg-green-500";
}

function getSeverityCardClasses(severity: 1 | 2 | 3) {
  if (severity === 3) return "border-red-200 bg-red-50";
  if (severity === 2) return "border-yellow-200 bg-yellow-50";
  return "border-green-200 bg-green-50";
}

export default function ComponentsPage() {
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [{ data: componentsData, error: componentsError }, { data: carsData, error: carsError }] =
        await Promise.all([
          supabase
            .from("components")
            .select(
              "id, type, identifier, expiry_date, hours, life_hours, warning_threshold_hours, revision_threshold_hours, car_id"
            )
            .order("identifier", { ascending: true }),
          supabase.from("cars").select("id, name").order("name", { ascending: true }),
        ]);

      if (!componentsError) setComponents((componentsData || []) as ComponentRow[]);
      if (!carsError) setCars((carsData || []) as CarRow[]);

      setLoading(false);
    };

    load();
  }, []);

  const carsMap = useMemo(() => {
    return new Map(cars.map((car) => [car.id, car.name]));
  }, [cars]);

  const enrichedComponents = useMemo(() => {
    return components.map((component) => {
      const status = getComponentStatus(component);
      const predictive = getPredictiveState(component);
      const expiryStatus = getExpiryStatus(component.expiry_date);
      const remainingToRevision =
        component.revision_threshold_hours !== null &&
        component.revision_threshold_hours !== undefined
          ? Number(component.revision_threshold_hours) - Number(component.hours ?? 0)
          : null;

      return {
        ...component,
        status,
        predictive,
        expiryStatus,
        carName: component.car_id ? carsMap.get(component.car_id) || "Auto non trovata" : "Non assegnato",
        remainingToRevision,
      };
    });
  }, [components, carsMap]);

  const filteredComponents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return enrichedComponents.filter((component) => {
      const matchesSearch =
        q.length === 0 ||
        component.type.toLowerCase().includes(q) ||
        component.identifier.toLowerCase().includes(q) ||
        component.carName.toLowerCase().includes(q);

      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "ok" && component.status.severity === 1 && component.expiryStatus !== "expired") ||
        (filterMode === "warning" && component.status.severity === 2) ||
        (filterMode === "critical" && component.status.severity === 3) ||
        (filterMode === "expired" && component.expiryStatus === "expired");

      return matchesSearch && matchesFilter;
    });
  }, [enrichedComponents, search, filterMode]);

  const stats = useMemo(() => {
    const ok = enrichedComponents.filter((c) => c.status.severity === 1).length;
    const warning = enrichedComponents.filter((c) => c.status.severity === 2).length;
    const critical = enrichedComponents.filter((c) => c.status.severity === 3).length;
    const expired = enrichedComponents.filter((c) => c.expiryStatus === "expired").length;

    return { ok, warning, critical, expired };
  }, [enrichedComponents]);

  const plannedSoon = useMemo(() => {
    return enrichedComponents
      .filter(
        (c) =>
          (c.remainingToRevision !== null && c.remainingToRevision <= 5) ||
          (c.predictive.remainingHours !== null && c.predictive.remainingHours <= 5) ||
          c.expiryStatus === "expiring" ||
          c.expiryStatus === "expired"
      )
      .sort((a, b) => b.status.severity - a.status.severity)
      .slice(0, 6);
  }, [enrichedComponents]);

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        <div className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" />
          Caricamento componenti...
        </div>
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
                <Wrench size={14} />
                Controllo vita componenti
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Componenti
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Stato, vita residua, revisioni da pianificare e monitoraggio rapido dei componenti
                assegnati alle vetture.
              </p>
            </div>

            <button
  type="button"
  className="btn-primary opacity-70 cursor-not-allowed"
  title="Creazione guidata componente da attivare"
>
  <PlusCircle size={18} /> Nuovo componente
</button>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<CheckCircle2 size={18} className="text-yellow-600" />}
              label="Componenti OK"
              value={String(stats.ok)}
              valueClassName="text-green-700"
            />
            <SummaryCard
              icon={<AlertTriangle size={18} className="text-yellow-600" />}
              label="In attenzione"
              value={String(stats.warning)}
              valueClassName={stats.warning > 0 ? "text-yellow-700" : "text-green-700"}
            />
            <SummaryCard
              icon={<ShieldAlert size={18} className="text-yellow-600" />}
              label="Critici"
              value={String(stats.critical)}
              valueClassName={stats.critical > 0 ? "text-red-700" : "text-green-700"}
            />
            <SummaryCard
              icon={<CalendarDays size={18} className="text-yellow-600" />}
              label="Scaduti"
              value={String(stats.expired)}
              valueClassName={stats.expired > 0 ? "text-red-700" : "text-green-700"}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card-base p-5 xl:col-span-2">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Search className="text-yellow-500" size={18} />
              <h2 className="text-lg font-bold text-neutral-800">Ricerca e filtri</h2>
            </div>

            <div className="text-sm text-neutral-500">
              {filteredComponents.length} componenti mostrati
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per tipo, codice o auto..."
                className="input-base pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={16} className="text-yellow-600" />
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                className="input-base min-w-[180px]"
              >
                <option value="all">Tutti</option>
                <option value="ok">Solo OK</option>
                <option value="warning">In attenzione</option>
                <option value="critical">Critici</option>
                <option value="expired">Scaduti</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card-base p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock3 className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Da pianificare</h2>
          </div>

          {plannedSoon.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Nessun componente richiede pianificazione immediata.
            </div>
          ) : (
            <div className="space-y-3">
              {plannedSoon.map((component) => {
                const cardClass = getSeverityCardClasses(component.status.severity);
                return (
                  <div key={component.id} className={`rounded-xl border p-3 ${cardClass}`}>
                    <div className="font-semibold text-neutral-900">
                      {component.type} – {component.identifier}
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">{component.carName}</div>
                    <div className="text-xs mt-2 text-neutral-700">
                      {component.remainingToRevision !== null
                        ? component.remainingToRevision <= 0
                          ? "Revisione necessaria subito"
                          : `Revisione tra ${component.remainingToRevision.toFixed(2)} h`
                        : component.predictive.remainingHours !== null
                        ? `${component.predictive.remainingHours.toFixed(2)} h rimanenti`
                        : component.expiry_date
                        ? `Scadenza il ${formatDate(component.expiry_date)}`
                        : "Monitorare stato componente"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4">
        {filteredComponents.length === 0 ? (
          <div className="card-base p-10 text-center text-neutral-500">
            Nessun componente trovato con i filtri selezionati.
          </div>
        ) : (
          filteredComponents.map((component) => (
            <ComponentCard key={component.id} component={component} />
          ))
        )}
      </section>
    </div>
  );
}

function ComponentCard({
  component,
}: {
  component: ComponentRow & {
    status: ComponentStatus;
    predictive: {
      label: string;
      severity: 1 | 2 | 3;
      percentage: number;
      remainingHours: number | null;
    };
    expiryStatus: string;
    carName: string;
    remainingToRevision: number | null;
  };
}) {
  const progressClass = getProgressColor(component.predictive.severity);
  const cardClass = getSeverityCardClasses(
    Math.max(component.status.severity, component.predictive.severity) as 1 | 2 | 3
  );
  const expiryDays = daysUntil(component.expiry_date);

  return (
    <article className={`card-base p-5 md:p-6 ${cardClass}`}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">
                {component.type} – {component.identifier}
              </h3>

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-neutral-200 text-neutral-700 px-2.5 py-1 font-semibold inline-flex items-center gap-1">
                  <CarFront size={12} />
                  {component.carName}
                </span>
                <span className={`rounded-full px-2.5 py-1 font-semibold ${component.status.className}`}>
                  {component.status.label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    component.predictive.severity === 3
                      ? "bg-red-100 text-red-700"
                      : component.predictive.severity === 2
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  Vita: {component.predictive.label}
                </span>
              </div>
            </div>

            <div className="text-left md:text-right">
              <div className="text-xs text-neutral-500">Ore attuali</div>
              <div className="text-lg font-bold text-neutral-900">
                {formatHoursDecimal(component.hours)}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-neutral-600">Barra vita componente</span>
              <span className="font-semibold text-neutral-900">
                {component.life_hours ? `${component.predictive.percentage.toFixed(0)}%` : "—"}
              </span>
            </div>

            <div className="h-3 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className={`h-full ${progressClass}`}
                style={{ width: `${component.life_hours ? component.predictive.percentage : 0}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600">
              <span>Usato: {formatHours(component.hours)}</span>
              <span>Vita totale: {formatHours(component.life_hours)}</span>
              <span>
                Rimanenti:{" "}
                {component.predictive.remainingHours !== null
                  ? formatHours(component.predictive.remainingHours)
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="xl:w-[340px] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
          <InfoBox
            icon={<Clock3 size={16} className="text-yellow-600" />}
            label="Revisione"
            value={
              component.remainingToRevision !== null
                ? component.remainingToRevision <= 0
                  ? "Da fare subito"
                  : `${component.remainingToRevision.toFixed(2)} h`
                : "Non definita"
            }
            tone={
              component.remainingToRevision !== null
                ? component.remainingToRevision <= 0
                  ? "red"
                  : component.remainingToRevision <= 5
                  ? "yellow"
                  : "green"
                : "neutral"
            }
          />

          <InfoBox
            icon={<CalendarDays size={16} className="text-yellow-600" />}
            label="Scadenza"
            value={component.expiry_date ? formatDate(component.expiry_date) : "—"}
            subvalue={
              component.expiry_date && expiryDays !== null
                ? expiryDays < 0
                  ? `${Math.abs(expiryDays)} giorni fa`
                  : `${expiryDays} giorni`
                : undefined
            }
            tone={
              component.expiryStatus === "expired"
                ? "red"
                : component.expiryStatus === "expiring"
                ? "yellow"
                : "green"
            }
          />
        </div>
      </div>

    <div className="mt-5 flex flex-col sm:flex-row gap-3">
  <Link
    href={`/maintenances`}
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-4 py-2"
  >
    <Wrench size={16} />
    Crea manutenzione
  </Link>

  <button
    type="button"
    className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-neutral-500 font-semibold px-4 py-2 opacity-70 cursor-not-allowed"
    title="Dettaglio componente da attivare"
  >
    Apri dettaglio <ArrowRight size={16} />
  </button>
</div>
    </article>
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

function InfoBox({
  icon,
  label,
  value,
  subvalue,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subvalue?: string;
  tone?: "green" | "yellow" | "red" | "neutral";
}) {
  const toneClasses =
    tone === "red"
      ? "border-red-200 bg-red-50"
      : tone === "yellow"
      ? "border-yellow-200 bg-yellow-50"
      : tone === "green"
      ? "border-green-200 bg-green-50"
      : "border-neutral-200 bg-neutral-50";

  return (
    <div className={`rounded-xl border p-3 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-sm text-neutral-700">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-bold text-neutral-900">{value}</div>
      {subvalue && <div className="text-xs text-neutral-500 mt-1">{subvalue}</div>}
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