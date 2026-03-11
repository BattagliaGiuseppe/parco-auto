"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Wrench } from "lucide-react";

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
    };
  }

  if (warning !== null && warning !== undefined && hours >= warning) {
    return {
      label: "In attenzione",
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "OK",
    className: "bg-green-100 text-green-700",
  };
}

function getExpiryBadge(expiryDate: string | null) {
  if (!expiryDate) {
    return {
      label: "Nessuna scadenza",
      className: "bg-gray-100 text-gray-600",
    };
  }

  const expiry = new Date(expiryDate);
  const now = new Date();

  if (expiry < now) {
    return {
      label: "Scaduto",
      className: "bg-red-100 text-red-700",
    };
  }

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (months <= 6) {
    return {
      label: "In scadenza",
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "Regolare",
    className: "bg-green-100 text-green-700",
  };
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
            .single(),
          supabase
            .from("car_components")
            .select("id, component_id, car_id, status, mounted_at, removed_at, hours_used, notes")
            .eq("component_id", componentId)
            .order("mounted_at", { ascending: false }),
          supabase
            .from("component_revisions")
            .select("*")
            .eq("component_id", componentId)
            .order("date", { ascending: false }),
          supabase.from("cars").select("id, name, chassis_number"),
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

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  if (!component) {
    return (
      <div className="p-6">
        <p className="text-red-600 font-semibold">Componente non trovato.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            ⚙️ {component.type} – {component.identifier}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Scheda dettaglio componente</p>
        </div>

        <Link
          href="/components"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold"
        >
          <ArrowLeft size={16} /> Torna ai componenti
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border rounded-2xl shadow-sm p-5 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Dati principali</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Tipo:</span> {component.type}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Identificativo:</span> {component.identifier}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Ore attuali:</span> {formatHours(component.hours)}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Ore vita totale:</span>{" "}
              {formatHours(component.life_hours)}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Soglia attenzione:</span>{" "}
              {component.warning_threshold_hours !== null &&
              component.warning_threshold_hours !== undefined
                ? formatHours(component.warning_threshold_hours)
                : "—"}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Soglia revisione:</span>{" "}
              {component.revision_threshold_hours !== null &&
              component.revision_threshold_hours !== undefined
                ? formatHours(component.revision_threshold_hours)
                : "—"}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Ultima manutenzione:</span>{" "}
              {formatDate(component.last_maintenance_date)}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <span className="font-semibold">Scadenza:</span> {formatDate(component.expiry_date)}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Stato attuale</h2>

          <div className="flex flex-col gap-3 text-sm">
            <div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${thresholdBadge?.className}`}
              >
                {thresholdBadge?.label}
              </span>
            </div>

            <div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${expiryBadge?.className}`}
              >
                {expiryBadge?.label}
              </span>
            </div>

            <div className="border rounded-xl p-3 bg-gray-50">
              <div className="font-semibold mb-1">Montaggio attuale</div>
              {currentCar ? (
                <div>
                  <div>{currentCar.name}</div>
                  <div className="text-gray-500 text-xs">
                    Telaio: {currentCar.chassis_number || "—"}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Smontato</div>
              )}
            </div>

            <div className="border rounded-xl p-3 bg-gray-50">
              <div className="font-semibold mb-1">Ultima revisione</div>
              {latestRevision ? (
                <div>
                  <div>{formatDate(latestRevision.date)}</div>
                  <div className="text-gray-500 text-xs">
                    {latestRevision.description || "Revisione registrata"}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Nessuna revisione</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <RotateCcw size={18} className="text-yellow-600" /> Storico revisioni
        </h2>

        {revisions.length === 0 ? (
          <p className="text-gray-500">Nessuna revisione registrata.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Descrizione</th>
                  <th className="p-2 text-left">Reset ore</th>
                  <th className="p-2 text-left">Ore prima</th>
                  <th className="p-2 text-left">Ore dopo</th>
                  <th className="p-2 text-left">Ore vita</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={revision.id} className="border-t">
                    <td className="p-2">{formatDate(revision.date)}</td>
                    <td className="p-2">{revision.description || "—"}</td>
                    <td className="p-2">{revision.reset_hours ? "Sì" : "No"}</td>
                    <td className="p-2">
                      {revision.hours_before_reset !== null
                        ? formatHours(revision.hours_before_reset)
                        : "—"}
                    </td>
                    <td className="p-2">
                      {revision.hours_after_reset !== null
                        ? formatHours(revision.hours_after_reset)
                        : "—"}
                    </td>
                    <td className="p-2">
                      {revision.life_hours_at_revision !== null
                        ? formatHours(revision.life_hours_at_revision)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Wrench size={18} className="text-yellow-600" /> Storico montaggi
        </h2>

        {mountHistory.length === 0 ? (
          <p className="text-gray-500">Nessun montaggio registrato.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 text-left">Auto</th>
                  <th className="p-2 text-left">Stato</th>
                  <th className="p-2 text-left">Da</th>
                  <th className="p-2 text-left">A</th>
                  <th className="p-2 text-left">Ore uso</th>
                  <th className="p-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {mountHistory.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.car?.name || "—"}</td>
                    <td className="p-2">
                      {row.status === "mounted" ? "🟢 Montato" : "⚪ Smontato"}
                    </td>
                    <td className="p-2">{formatDate(row.mounted_at)}</td>
                    <td className="p-2">{formatDate(row.removed_at)}</td>
                    <td className="p-2">
                      {row.hours_used !== null ? formatHours(row.hours_used) : "—"}
                    </td>
                    <td className="p-2">{row.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
