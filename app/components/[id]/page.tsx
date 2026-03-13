"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  Wrench,
  CarFront,
  CalendarDays,
  Clock3,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CarRelation = {
  id: string;
  name: string;
  chassis_number?: string | null;
};

type ComponentItem = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  last_maintenance_date: string | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  car_id: CarRelation | CarRelation[] | null;
};

type MountHistoryRow = {
  id: string;
  component_id: string;
  car_id: string | null;
  status: string | null;
  mounted_at: string | null;
  removed_at: string | null;
  hours_used: number | null;
  notes?: string | null;
  car: CarRelation | null;
};

type RevisionItem = {
  id: string;
  component_id: string;
  date: string;
  description: string | null;
  notes: string | null;
  reset_hours: boolean;
  hours_before_reset: number | null;
  hours_after_reset: number | null;
  life_hours_at_revision: number | null;
  created_at: string;
};

function normalizeCarRelation(value: ComponentItem["car_id"]): CarRelation | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatHours(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(2);
}

function formatHoursLabel(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} h`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function getThresholdBadge(component: ComponentItem) {
  const hours = Number(component.hours ?? 0);
  const warning = component.warning_threshold_hours;
  const revision = component.revision_threshold_hours;

  if (revision !== null && revision !== undefined && hours >= revision) {
    return {
      label: "Fuori soglia revisione",
      className: "bg-red-100 text-red-700",
      severity: 3 as const,
    };
  }

  if (warning !== null && warning !== undefined && hours >= warning) {
    return {
      label: "In attenzione",
      className: "bg-yellow-100 text-yellow-700",
      severity: 2 as const,
    };
  }

  return {
    label: "OK",
    className: "bg-green-100 text-green-700",
    severity: 1 as const,
  };
}

function getExpiryBadge(expiryDate: string | null) {
  if (!expiryDate) {
    return {
      label: "Nessuna scadenza",
      className: "bg-gray-100 text-gray-600",
      severity: 1 as const,
    };
  }

  const expiry = new Date(expiryDate);
  const now = new Date();

  if (expiry < now) {
    return {
      label: "Scaduto",
      className: "bg-red-100 text-red-700",
      severity: 3 as const,
    };
  }

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (months <= 6) {
    return {
      label: "In scadenza",
      className: "bg-yellow-100 text-yellow-700",
      severity: 2 as const,
    };
  }

  return {
    label: "Regolare",
    className: "bg-green-100 text-green-700",
    severity: 1 as const,
  };
}

function getPredictiveState(component: ComponentItem) {
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

export default function ComponentDetailPage() {
  const params = useParams();
  const componentId = params?.id as string;

  const [component, setComponent] = useState<ComponentItem | null>(null);
  const [mountHistory, setMountHistory] = useState<MountHistoryRow[]>([]);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!componentId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);

        const ctx = await getCurrentTeamContext();

        const [
          { data: compData, error: componentError },
          { data: historyRows, error: historyError },
          { data: revisionRows, error: revisionError },
          { data: carsRows, error: carsError },
        ] = await Promise.all([
          supabase
            .from("components")
            .select(`
              id,
              type,
              identifier,
              expiry_date,
              last_maintenance_date,
              hours,
              life_hours,
              warning_threshold_hours,
              revision_threshold_hours,
              car_id (id, name, chassis_number)
            `)
            .eq("id", componentId)
            .eq("team_id", ctx.teamId)
            .single(),
          supabase
            .from("car_components")
            .select("id, component_id, car_id, status, mounted_at, removed_at, hours_used, notes")
            .eq("component_id", componentId)
            .eq("team_id", ctx.teamId)
            .order("mounted_at", { ascending: false }),
          supabase
            .from("component_revisions")
            .select("*")
            .eq("component_id", componentId)
            .eq("team_id", ctx.teamId)
            .order("date", { ascending: false }),
          supabase
            .from("cars")
            .select("id, name, chassis_number")
            .eq("team_id", ctx.teamId),
        ]);

        if (componentError) throw componentError;
        if (historyError) throw historyError;
        if (revisionError) throw revisionError;
        if (carsError) throw carsError;

        const normalizedComponent: ComponentItem = {
          id: (compData as any).id,
          type: (compData as any).type,
          identifier: (compData as any).identifier,
          expiry_date: (compData as any).expiry_date,
          last_maintenance_date: (compData as any).last_maintenance_date,
          hours: (compData as any).hours,
          life_hours: (compData as any).life_hours,
          warning_threshold_hours: (compData as any).warning_threshold_hours,
          revision_threshold_hours: (compData as any).revision_threshold_hours,
          car_id: (compData as any).car_id,
        };

        const cars = ((carsRows || []) as any[]).map((row) => ({
          id: row.id,
          name: row.name,
          chassis_number: row.chassis_number,
        }));

        const normalizedHistory: MountHistoryRow[] = ((historyRows || []) as any[]).map((row) => {
          const matchedCar = cars.find((car) => car.id === row.car_id) || null;

          return {
            id: row.id,
            component_id: row.component_id,
            car_id: row.car_id,
            status: row.status,
            mounted_at: row.mounted_at,
            removed_at: row.removed_at,
            hours_used: row.hours_used,
            notes: row.notes,
            car: matchedCar,
          };
        });

        setComponent(normalizedComponent);
        setMountHistory(normalizedHistory);
        setRevisions((revisionRows || []) as RevisionItem[]);
      } catch (error) {
        console.error("Errore caricamento dettaglio componente:", error);
        setComponent(null);
        setMountHistory([]);
        setRevisions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [componentId]);

  const currentCar = useMemo(() => {
    if (!component) return null;
    return normalizeCarRelation(component.car_id);
  }, [component]);

  const latestRevision = revisions[0] || null;
  const thresholdBadge = component ? getThresholdBadge(component) : null;
  const expiryBadge = component ? getExpiryBadge(component.expiry_date) : null;
  const predictive = component ? getPredictiveState(component) : null;

  const remainingHours = useMemo(() => {
    if (!component) return null;
    if (component.life_hours === null || component.life_hours === undefined) return null;
    return Number(component.life_hours) - Number(component.hours ?? 0);
  }, [component]);

  const remainingToRevision = useMemo(() => {
    if (!component) return null;
    if (
      component.revision_threshold_hours === null ||
      component.revision_threshold_hours === undefined
    ) {
      return null;
    }
    return Number(component.revision_threshold_hours) - Number(component.hours ?? 0);
  }, [component]);

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        Caricamento componente...
      </div>
    );
  }

  if (!component || !thresholdBadge || !expiryBadge || !predictive) {
    return (
      <div className={`card-base p-10 text-center ${audiowide.className}`}>
        <p className="text-red-600 font-semibold">Componente non trovato.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <Wrench size={14} />
                Scheda tecnica componente
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                {component.type} – {component.identifier}
              </h1>

              <p className="text-yellow-100/75 text-sm mt-2">
                Stato attuale, revisioni, storico montaggi e vita residua del componente
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 font-semibold ${thresholdBadge.className}`}>
                  {thresholdBadge.label}
                </span>
                <span className={`rounded-full px-3 py-1 font-semibold ${expiryBadge.className}`}>
                  {expiryBadge.label}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    predictive.severity === 3
                      ? "bg-red-100 text-red-700"
                      : predictive.severity === 2
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  Vita: {predictive.label}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/components/${component.id}/edit`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
              >
                Modifica componente
              </Link>

              <Link
                href="/components"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-yellow-400 font-semibold"
              >
                <ArrowLeft size={16} /> Torna ai componenti
              </Link>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Clock3 size={18} className="text-yellow-600" />}
              label="Ore attuali"
              value={formatHoursLabel(component.hours)}
            />
            <SummaryCard
              icon={<Activity size={18} className="text-yellow-600" />}
              label="Vita residua"
              value={remainingHours !== null ? formatHoursLabel(remainingHours) : "—"}
              valueClassName={
                remainingHours !== null && remainingHours <= 0
                  ? "text-red-700"
                  : remainingHours !== null && remainingHours <= 5
                  ? "text-yellow-700"
                  : "text-neutral-900"
              }
            />
            <SummaryCard
              icon={<RotateCcw size={18} className="text-yellow-600" />}
              label="Revisione"
              value={
                remainingToRevision !== null
                  ? remainingToRevision <= 0
                    ? "Da fare"
                    : `${remainingToRevision.toFixed(2)} h`
                  : "—"
              }
              valueClassName={
                remainingToRevision !== null && remainingToRevision <= 0
                  ? "text-red-700"
                  : remainingToRevision !== null && remainingToRevision <= 5
                  ? "text-yellow-700"
                  : "text-neutral-900"
              }
            />
            <SummaryCard
              icon={<CalendarDays size={18} className="text-yellow-600" />}
              label="Scadenza"
              value={formatDate(component.expiry_date)}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card-base p-5 md:p-6 xl:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Vita componente</h2>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-neutral-600">Utilizzo complessivo</span>
              <span className="font-semibold text-neutral-900">
                {component.life_hours ? `${predictive.percentage.toFixed(0)}%` : "—"}
              </span>
            </div>

            <div className="h-4 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(predictive.severity)}`}
                style={{ width: `${component.life_hours ? predictive.percentage : 0}%` }}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-600">
              <span>Ore attuali: {formatHoursLabel(component.hours)}</span>
              <span>Vita totale: {formatHoursLabel(component.life_hours)}</span>
              <span>
                Rimanenti:{" "}
                {predictive.remainingHours !== null
                  ? formatHoursLabel(predictive.remainingHours)
                  : "—"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-5">
            <InfoCard
              icon={<Wrench size={16} className="text-yellow-600" />}
              title="Tipo"
              value={component.type}
            />
            <InfoCard
              icon={<ShieldAlert size={16} className="text-yellow-600" />}
              title="Identificativo"
              value={component.identifier}
            />
            <InfoCard
              icon={<Clock3 size={16} className="text-yellow-600" />}
              title="Soglia attenzione"
              value={
                component.warning_threshold_hours !== null &&
                component.warning_threshold_hours !== undefined
                  ? formatHoursLabel(component.warning_threshold_hours)
                  : "—"
              }
            />
            <InfoCard
              icon={<RotateCcw size={16} className="text-yellow-600" />}
              title="Soglia revisione"
              value={
                component.revision_threshold_hours !== null &&
                component.revision_threshold_hours !== undefined
                  ? formatHoursLabel(component.revision_threshold_hours)
                  : "—"
              }
            />
            <InfoCard
              icon={<CalendarDays size={16} className="text-yellow-600" />}
              title="Ultima manutenzione"
              value={formatDate(component.last_maintenance_date)}
            />
            <InfoCard
              icon={<CalendarDays size={16} className="text-yellow-600" />}
              title="Scadenza"
              value={formatDate(component.expiry_date)}
            />
          </div>
        </div>

        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CarFront className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Stato attuale</h2>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <StatusBox
              label="Soglia ore"
              badge={thresholdBadge.label}
              className={thresholdBadge.className}
            />
            <StatusBox
              label="Scadenza"
              badge={expiryBadge.label}
              className={expiryBadge.className}
            />
            <StatusBox
              label="Vita predittiva"
              badge={predictive.label}
              className={
                predictive.severity === 3
                  ? "bg-red-100 text-red-700"
                  : predictive.severity === 2
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }
            />

            <div className="border rounded-xl p-4 bg-neutral-50">
              <div className="font-semibold mb-2 text-neutral-800">Montaggio attuale</div>
              {currentCar ? (
                <div>
                  <div className="font-semibold text-neutral-900">{currentCar.name}</div>
                  <div className="text-neutral-500 text-xs mt-1">
                    Telaio: {currentCar.chassis_number || "—"}
                  </div>
                </div>
              ) : (
                <div className="text-neutral-500">Smontato</div>
              )}
            </div>

            <div className="border rounded-xl p-4 bg-neutral-50">
              <div className="font-semibold mb-2 text-neutral-800">Ultima revisione</div>
              {latestRevision ? (
                <div>
                  <div className="font-semibold text-neutral-900">
                    {formatDate(latestRevision.date)}
                  </div>
                  <div className="text-neutral-500 text-xs mt-1">
                    {latestRevision.description || "Revisione registrata"}
                  </div>
                </div>
              ) : (
                <div className="text-neutral-500">Nessuna revisione</div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Link
                href={`/maintenances?componentId=${component.id}&componentName=${encodeURIComponent(
                  `${component.type} – ${component.identifier}`
                )}&carId=${currentCar?.id || ""}&carName=${encodeURIComponent(
                  currentCar?.name || ""
                )}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
              >
                <Wrench size={16} />
                Nuova manutenzione
              </Link>

              <Link
                href={`/maintenances?componentId=${component.id}&componentName=${encodeURIComponent(
                  `${component.type} – ${component.identifier}`
                )}&carId=${currentCar?.id || ""}&carName=${encodeURIComponent(
                  currentCar?.name || ""
                )}&type=revisione`}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold"
              >
                <RotateCcw size={16} />
                Nuova revisione
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="card-base p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw size={18} className="text-yellow-600" />
          <h2 className="text-lg font-bold text-neutral-800">Storico revisioni</h2>
        </div>

        {revisions.length === 0 ? (
          <p className="text-neutral-500">Nessuna revisione registrata.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Descrizione</th>
                  <th className="p-3 text-left">Reset ore</th>
                  <th className="p-3 text-left">Ore prima</th>
                  <th className="p-3 text-left">Ore dopo</th>
                  <th className="p-3 text-left">Ore vita</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={revision.id} className="border-t border-neutral-200">
                    <td className="p-3">{formatDate(revision.date)}</td>
                    <td className="p-3">{revision.description || "—"}</td>
                    <td className="p-3">{revision.reset_hours ? "Sì" : "No"}</td>
                    <td className="p-3">
                      {revision.hours_before_reset !== null
                        ? formatHoursLabel(revision.hours_before_reset)
                        : "—"}
                    </td>
                    <td className="p-3">
                      {revision.hours_after_reset !== null
                        ? formatHoursLabel(revision.hours_after_reset)
                        : "—"}
                    </td>
                    <td className="p-3">
                      {revision.life_hours_at_revision !== null
                        ? formatHoursLabel(revision.life_hours_at_revision)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-base p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wrench size={18} className="text-yellow-600" />
          <h2 className="text-lg font-bold text-neutral-800">Storico montaggi</h2>
        </div>

        {mountHistory.length === 0 ? (
          <p className="text-neutral-500">Nessun montaggio registrato.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="p-3 text-left">Auto</th>
                  <th className="p-3 text-left">Stato</th>
                  <th className="p-3 text-left">Da</th>
                  <th className="p-3 text-left">A</th>
                  <th className="p-3 text-left">Ore uso</th>
                  <th className="p-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {mountHistory.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-200">
                    <td className="p-3">{row.car?.name || "—"}</td>
                    <td className="p-3">
                      {row.status === "mounted" ? "🟢 Montato" : "⚪ Smontato"}
                    </td>
                    <td className="p-3">{formatDate(row.mounted_at)}</td>
                    <td className="p-3">{formatDate(row.removed_at)}</td>
                    <td className="p-3">
                      {row.hours_used !== null ? formatHoursLabel(row.hours_used) : "—"}
                    </td>
                    <td className="p-3">{row.notes || "—"}</td>
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

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="border rounded-xl p-4 bg-neutral-50">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-base font-bold text-neutral-900 mt-2">{value}</div>
    </div>
  );
}

function StatusBox({
  label,
  badge,
  className,
}: {
  label: string;
  badge: string;
  className: string;
}) {
  return (
    <div className="border rounded-xl p-4 bg-neutral-50">
      <div className="text-sm text-neutral-600 mb-2">{label}</div>
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 font-semibold text-sm ${className}`}
      >
        {badge}
      </span>
    </div>
  );
}