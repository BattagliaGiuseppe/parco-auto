"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CarFront,
  FileText,
  GaugeCircle,
  Info,
  Printer,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import FormStatusBanner from "@/components/FormStatusBanner";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

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
  return Number(value ?? 0).toFixed(2);
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

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
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

      const { data, error: carError } = await supabase
        .from("cars")
        .select(
          `
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
          `
        )
        .eq("id", id)
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
    if (id) void loadCar();
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
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-500 shadow-sm">
          Caricamento mezzo...
        </div>
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <FormStatusBanner
          type="error"
          message={error || "Vettura non trovata"}
        />
      </div>
    );
  }

  const stats = [
    {
      label: "Ore auto",
      value: formatHours(car.hours),
      icon: <GaugeCircle size={18} />,
      helper: "Ore complessive registrate sul mezzo",
    },
    {
      label: "Componenti montati",
      value: String(componentSummary.mounted),
      icon: <Wrench size={18} />,
      helper: "Componenti attualmente installati",
    },
    {
      label: "Da controllare",
      value: String(componentSummary.critical),
      icon: <Info size={18} />,
      helper: "Componenti in attenzione o fuori soglia",
    },
    {
      label: "Telaio",
      value: car.chassis_number || "—",
      icon: <CarFront size={18} />,
      helper: "Codice telaio del mezzo",
    },
  ];

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title={car.name}
        subtitle="Scheda mezzo con componenti montati, soglie e storico revisioni"
        icon={<CarFront size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/cars/${id}/documents`}
              className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
            >
              <FileText size={16} className="mr-2 inline" />
              Documenti
            </Link>
            <Link
              href={`/cars/${id}/print`}
              className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
            >
              <Printer size={16} className="mr-2 inline" />
              Stampa
            </Link>
          </div>
        }
      />

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Questa pagina riassume lo stato tecnico del mezzo e dei componenti attualmente montati."
      >
        <InfoBlock>
          Usa la scheda mezzo per avere una vista sintetica delle ore auto, dei componenti installati e delle soglie di attenzione.
          Quando ti serve intervenire su un singolo componente, apri la relativa scheda tecnica direttamente da qui.
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title="Panoramica mezzo"
        subtitle="Identità del mezzo e ore complessive registrate"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard label="Mezzo" value={car.name} />
          <InfoCard label="Telaio" value={car.chassis_number || "—"} />
          <InfoCard label="Ore vettura" value={`${formatHours(car.hours)} h`} />
        </div>
      </SectionCard>

      <SectionCard
        title="Componenti montati"
        subtitle="Controlla ore, soglie, scadenze e ultima revisione dei componenti attivi sul mezzo."
      >
        {car.components.length === 0 ? (
          <EmptyState
            title="Nessun componente montato"
            description="Monta un componente sulla vettura per visualizzarlo qui."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {car.components.map((component) => {
              const badge = getThresholdBadge(component);
              const latestRevision = revisions[component.id]?.[0];

              return (
                <div
                  key={component.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold capitalize text-neutral-900">
                        {component.type}
                      </h3>
                      <p className="text-sm text-neutral-600">{component.identifier}</p>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                    <MetricCard label="Ore attuali" value={`${formatHours(component.hours)} h`} />
                    <MetricCard label="Ore vita totale" value={`${formatHours(component.life_hours)} h`} />
                    <MetricCard
                      label="Soglia attenzione"
                      value={
                        component.warning_threshold_hours !== null &&
                        component.warning_threshold_hours !== undefined
                          ? `${formatHours(component.warning_threshold_hours)} h`
                          : "—"
                      }
                    />
                    <MetricCard
                      label="Soglia revisione"
                      value={
                        component.revision_threshold_hours !== null &&
                        component.revision_threshold_hours !== undefined
                          ? `${formatHours(component.revision_threshold_hours)} h`
                          : "—"
                      }
                    />
                  </div>

                  {component.expiry_date && (
                    <p className={`mt-4 text-sm ${getExpiryColor(component.expiry_date)}`}>
                      <span className="font-semibold">Scadenza:</span>{" "}
                      {new Date(component.expiry_date).toLocaleDateString("it-IT")}
                    </p>
                  )}

                  <div className="mt-2 text-sm text-neutral-700">
                    <span className="font-semibold">Ultima revisione:</span>{" "}
                    {latestRevision?.date
                      ? new Date(latestRevision.date).toLocaleDateString("it-IT")
                      : "—"}
                  </div>

                  <div className="mt-1 text-sm text-neutral-700">
                    <span className="font-semibold">Ultima manutenzione:</span>{" "}
                    {component.last_maintenance_date
                      ? new Date(component.last_maintenance_date).toLocaleDateString("it-IT")
                      : "—"}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      href={`/components/${component.id}`}
                      className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                    >
                      Apri componente
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-base font-bold text-neutral-900">{value}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
      <span className="block text-neutral-500">{label}</span>
      <span className="font-bold text-neutral-900">{value}</span>
    </div>
  );
}
