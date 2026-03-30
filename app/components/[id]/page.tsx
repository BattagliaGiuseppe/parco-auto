"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { ArrowLeft, Boxes, CarFront, Wrench, Clock3, History } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type ComponentRow = {
  id: string;
  type: string;
  identifier: string;
  status: string | null;
  hours_used: number | null;
  car_id: string | null;
  notes: string | null;
};

type CarRow = {
  id: string;
  name: string;
};

type RevisionRow = {
  id: string;
  component_id: string;
  date: string | null;
  description: string | null;
  hours_at_revision: number | null;
  next_due_hours: number | null;
};

type MountRow = {
  id: string;
  component_id: string;
  car_id: string | null;
  status: string | null;
  mounted_at: string | null;
  removed_at: string | null;
  hours_used: number | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatHours(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} h`;
}

export default function ComponentDetailPage() {
  const params = useParams();
  const componentId = params?.id as string;

  const [component, setComponent] = useState<ComponentRow | null>(null);
  const [carsMap, setCarsMap] = useState<Record<string, string>>({});
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [mounts, setMounts] = useState<MountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const ctx = await getCurrentTeamContext();

        const [
          { data: componentData, error: componentError },
          { data: carsData, error: carsError },
          { data: revisionsData, error: revisionsError },
          { data: mountsData, error: mountsError },
        ] = await Promise.all([
          supabase
            .from("components")
            .select("id, type, identifier, status, hours_used, car_id, notes")
            .eq("team_id", ctx.teamId)
            .eq("id", componentId)
            .single(),
          supabase
            .from("cars")
            .select("id, name")
            .eq("team_id", ctx.teamId),
          supabase
            .from("component_revisions")
            .select("id, component_id, date, description, hours_at_revision, next_due_hours")
            .eq("team_id", ctx.teamId)
            .eq("component_id", componentId)
            .order("date", { ascending: false }),
          supabase
            .from("car_components")
            .select("id, component_id, car_id, status, mounted_at, removed_at, hours_used")
            .eq("team_id", ctx.teamId)
            .eq("component_id", componentId)
            .order("mounted_at", { ascending: false }),
        ]);

        if (componentError) throw componentError;
        if (carsError) throw carsError;
        if (revisionsError) throw revisionsError;
        if (mountsError) throw mountsError;

        setComponent(componentData as ComponentRow);
        setRevisions((revisionsData || []) as RevisionRow[]);
        setMounts((mountsData || []) as MountRow[]);

        const dict: Record<string, string> = {};
        ((carsData || []) as CarRow[]).forEach((car) => {
          dict[car.id] = car.name;
        });
        setCarsMap(dict);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    if (componentId) loadData();
  }, [componentId]);

  const activeMount = useMemo(() => mounts.find((m) => !m.removed_at) || null, [mounts]);
  const nextRevision = useMemo(() => revisions.find((r) => r.next_due_hours !== null) || null, [revisions]);

  const statItems: StatItem[] = [
    {
      label: "Ore utilizzo",
      value: formatHours(component?.hours_used),
      icon: <Clock3 size={18} />,
    },
    {
      label: "Auto attuale",
      value: component?.car_id ? carsMap[component.car_id] || "Auto" : "Non montato",
      icon: <CarFront size={18} />,
    },
    {
      label: "Revisioni",
      value: String(revisions.length),
      icon: <Wrench size={18} />,
    },
    {
      label: "Storico montaggi",
      value: String(mounts.length),
      icon: <History size={18} />,
    },
  ];

  if (loading) {
    return <div className="card-base p-10 text-center text-neutral-500">Caricamento...</div>;
  }

  if (!component) {
    return <div className="card-base p-10 text-center text-red-600">Componente non trovato.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${component.type} • ${component.identifier}`}
        subtitle="Scheda tecnica componente"
        icon={<Boxes size={22} />}
        actions={
          <Link href="/components" className="btn-secondary">
            <ArrowLeft size={16} />
            Torna ai componenti
          </Link>
        }
      />

      <SectionCard title="Riepilogo">
        <StatsGrid items={statItems} />
      </SectionCard>

      <SectionCard title="Stato attuale" subtitle="Situazione corrente del componente">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm text-neutral-500">Stato</div>
            <div className="mt-2">
              <StatusBadge
                label={component.status || "non definito"}
                tone={
                  component.status === "mounted"
                    ? "green"
                    : component.status === "needs_revision"
                    ? "yellow"
                    : component.status === "broken"
                    ? "red"
                    : "neutral"
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm text-neutral-500">Montaggio attivo</div>
            <div className="mt-2 text-sm font-semibold text-neutral-900">
              {activeMount?.car_id ? carsMap[activeMount.car_id] || "Auto" : "Nessun montaggio attivo"}
            </div>
          </div>
        </div>

        {component.notes ? (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm text-neutral-500">Note</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-900">{component.notes}</div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Revisioni" subtitle="Storico revisioni registrate">
        {revisions.length === 0 ? (
          <EmptyState title="Nessuna revisione registrata" />
        ) : (
          <div className="space-y-3">
            {revisions.map((row) => (
              <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-semibold text-neutral-900">{formatDate(row.date)}</div>
                  {row.next_due_hours !== null ? (
                    <StatusBadge label={`Prossima a ${row.next_due_hours} h`} tone="yellow" />
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <MiniValue label="Ore revisione" value={formatHours(row.hours_at_revision)} />
                  <MiniValue
                    label="Prossima soglia"
                    value={row.next_due_hours !== null ? formatHours(row.next_due_hours) : "—"}
                  />
                  <MiniValue label="Descrizione" value={row.description || "—"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Storico montaggi" subtitle="Dove e quando è stato montato">
        {mounts.length === 0 ? (
          <EmptyState title="Nessuno storico montaggi" />
        ) : (
          <div className="space-y-3">
            {mounts.map((row) => (
              <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-semibold text-neutral-900">
                    {row.car_id ? carsMap[row.car_id] || "Auto" : "—"}
                  </div>
                  <StatusBadge label={row.removed_at ? "Storico" : "Attivo"} tone={row.removed_at ? "neutral" : "green"} />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <MiniValue label="Montato il" value={formatDate(row.mounted_at)} />
                  <MiniValue label="Smontato il" value={formatDate(row.removed_at)} />
                  <MiniValue label="Ore registrate" value={formatHours(row.hours_used)} />
                  <MiniValue label="Stato" value={row.status || "—"} />
                </div>
              </div>
            ))}
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