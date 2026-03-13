"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { CarFront, FileText, Printer, Wrench, GaugeCircle } from "lucide-react";

type CarComponent = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  is_active: boolean | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  last_maintenance_date: string | null;
};

type CarData = {
  id: string;
  name: string;
  chassis_number: string | null;
  hours: number | null;
  components: CarComponent[];
};

type RevisionItem = {
  id: string;
  component_id: string;
  date: string;
  description: string | null;
  reset_hours: boolean;
};

function formatHours(value: number | null | undefined) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function getExpiryColor(date: string) {
  const expiry = new Date(date);
  const now = new Date();

  if (expiry < now) return "text-red-600 font-bold";

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (months > 12) return "text-green-600 font-semibold";
  if (months > 6) return "text-yellow-500 font-semibold";
  return "text-orange-500 font-semibold";
}

function getThresholdBadge(component: CarComponent) {
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

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [car, setCar] = useState<CarData | null>(null);
  const [revisions, setRevisions] = useState<Record<string, RevisionItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCar = async () => {
    try {
      setLoading(true);
      setError("");

      const ctx = await getCurrentTeamContext();

      const { data, error: carError } = await supabase
        .from("cars")
        .select(`
          id,
          name,
          chassis_number,
          hours,
          components (
            id,
            type,
            identifier,
            expiry_date,
            is_active,
            hours,
            life_hours,
            warning_threshold_hours,
            revision_threshold_hours,
            last_maintenance_date
          )
        `)
        .eq("id", id)
        .eq("team_id", ctx.teamId)
        .single();

      if (carError) throw carError;

      const normalizedCar: CarData = {
        id: data.id,
        name: data.name,
        chassis_number: data.chassis_number,
        hours: data.hours,
        components: (data.components || []) as CarComponent[],
      };

      setCar(normalizedCar);

      const componentIds = normalizedCar.components.map((c) => c.id);
      if (componentIds.length > 0) {
        const { data: revisionRows, error: revisionsError } = await supabase
          .from("component_revisions")
          .select("id, component_id, date, description, reset_hours")
          .eq("team_id", ctx.teamId)
          .in("component_id", componentIds)
          .order("date", { ascending: false });

        if (revisionsError) throw revisionsError;

        const revisionMap: Record<string, RevisionItem[]> = {};
        for (const row of (revisionRows || []) as RevisionItem[]) {
          if (!revisionMap[row.component_id]) revisionMap[row.component_id] = [];
          revisionMap[row.component_id].push(row);
        }

        setRevisions(revisionMap);
      } else {
        setRevisions({});
      }
    } catch (err: any) {
      setError(err.message || "Errore nel caricamento della vettura");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadCar();
  }, [id]);

  const componentSummary = useMemo(() => {
    const mounted = car?.components?.length || 0;
    const critical =
      car?.components?.filter((component) => {
        const badge = getThresholdBadge(component);
        return badge.label !== "OK";
      }).length || 0;

    return { mounted, critical };
  }, [car]);

  if (loading) {
    return <div className="p-6">Caricamento…</div>;
  }

  if (error || !car) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error || "Vettura non trovata"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <CarFront className="text-yellow-500" size={30} />
              {car.name}
            </h1>
            <p className="text-gray-600">
              <span className="font-semibold">Telaio:</span> {car.chassis_number || "—"}
            </p>
            <p className="text-gray-600 flex items-center gap-2">
              <GaugeCircle size={18} className="text-yellow-500" />
              <span className="font-semibold">Ore vettura:</span> {formatHours(car.hours)}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/cars/${id}/documents`}
              className="px-4 py-2 rounded-lg bg-gray-900 text-yellow-500 flex items-center gap-2"
            >
              <FileText size={16} />
              Documenti
            </Link>
            <Link
              href={`/cars/${id}/print`}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 flex items-center gap-2"
            >
              <Printer size={16} />
              Stampa
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Ore auto</p>
          <p className="text-2xl font-bold text-gray-900">{formatHours(car.hours)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Componenti montati</p>
          <p className="text-2xl font-bold text-gray-900">{componentSummary.mounted}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Componenti da controllare</p>
          <p className="text-2xl font-bold text-gray-900">{componentSummary.critical}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="text-yellow-500" size={20} />
          <h2 className="text-xl font-bold text-gray-900">Componenti montati</h2>
        </div>

        {car.components.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-gray-500">
            Nessun componente montato su questa vettura.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {car.components.map((component) => {
              const badge = getThresholdBadge(component);
              const latestRevision = revisions[component.id]?.[0];

              return (
                <div
                  key={component.id}
                  className="rounded-2xl border border-gray-200 p-5 bg-gray-50 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 capitalize">
                        {component.type}
                      </h3>
                      <p className="text-sm text-gray-600">{component.identifier}</p>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white border border-gray-200 p-3">
                      <span className="block text-gray-500">Ore attuali</span>
                      <span className="font-bold text-gray-900">
                        {formatHours(component.hours)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-3">
                      <span className="block text-gray-500">Ore vita totale</span>
                      <span className="font-bold text-gray-900">
                        {formatHours(component.life_hours)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-3">
                      <span className="block text-gray-500">Soglia attenzione</span>
                      <span className="font-bold text-gray-900">
                        {component.warning_threshold_hours !== null &&
                        component.warning_threshold_hours !== undefined
                          ? formatHours(component.warning_threshold_hours)
                          : "—"}
                      </span>
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-3">
                      <span className="block text-gray-500">Soglia revisione</span>
                      <span className="font-bold text-gray-900">
                        {component.revision_threshold_hours !== null &&
                        component.revision_threshold_hours !== undefined
                          ? formatHours(component.revision_threshold_hours)
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {component.expiry_date && (
                    <p className={`text-sm ${getExpiryColor(component.expiry_date)}`}>
                      <span className="font-semibold">Scadenza:</span>{" "}
                      {new Date(component.expiry_date).toLocaleDateString("it-IT")}
                    </p>
                  )}

                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Ultima revisione:</span>{" "}
                    {latestRevision?.date
                      ? new Date(latestRevision.date).toLocaleDateString("it-IT")
                      : "—"}
                  </p>

                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Ultima manutenzione:</span>{" "}
                    {component.last_maintenance_date
                      ? new Date(component.last_maintenance_date).toLocaleDateString("it-IT")
                      : "—"}
                  </p>

                  <div className="flex justify-end">
                    <Link
                      href={`/components/${component.id}`}
                      className="px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-sm"
                    >
                      Apri componente
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}