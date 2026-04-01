"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Boxes, CarFront, Wrench, Clock3, History } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type ComponentRow = {
  id: string;
  type: string;
  identifier: string;
  homologation: string | null;
  expiry_date: string | null;
  status: string | null;
  hours: number | null;
  life_hours: number | null;
  notes: string | null;
};

type MaintenanceRow = {
  id: string;
  performed_at: string | null;
  description: string | null;
};

type MountRow = {
  id: string;
  installed_at: string | null;
  removed_at: string | null;
  cars: { name: string | null; chassis_number: string | null } | null;
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
  const [maintenances, setMaintenances] = useState<MaintenanceRow[]>([]);
  const [mounts, setMounts] = useState<MountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true);
        const [{ data: compData }, { data: maintData }, { data: mountsData }] = await Promise.all([
          supabase.from("components").select("*").eq("id", componentId).single(),
          supabase.from("maintenances").select("id, performed_at, description").eq("component_id", componentId).order("performed_at", { ascending: false }),
          supabase.from("car_components").select("id, installed_at, removed_at, cars(name, chassis_number)").eq("component_id", componentId).order("installed_at", { ascending: false }),
        ]);

        setComponent((compData || null) as ComponentRow | null);
        setMaintenances((maintData || []) as MaintenanceRow[]);
        setMounts((mountsData || []) as unknown as MountRow[]);
      } finally {
        setLoading(false);
      }
    }

    if (componentId) fetchDetails();
  }, [componentId]);

  const activeMount = useMemo(() => mounts.find((mount) => !mount.removed_at) || null, [mounts]);

  const stats: StatItem[] = [
    { label: "Ore utilizzo", value: formatHours(component?.hours), icon: <Clock3 size={18} /> },
    { label: "Stato", value: component?.status || "—", icon: <Boxes size={18} /> },
    { label: "Manutenzioni", value: String(maintenances.length), icon: <Wrench size={18} /> },
    { label: "Montaggi", value: String(mounts.length), icon: <History size={18} /> },
  ];

  if (loading) return <div className="card-base p-10 text-center text-neutral-500">Caricamento componente...</div>;
  if (!component) return <div className="card-base p-10 text-center text-red-600">Componente non trovato.</div>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${component.type} • ${component.identifier}`}
        subtitle="Scheda componente"
        icon={<Boxes size={22} />}
        actions={
          <Link href="/components" className="btn-secondary">
            <ArrowLeft size={16} />
            Torna ai componenti
          </Link>
        }
      />

      <SectionCard title="Riepilogo">
        <StatsGrid items={stats} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Dati tecnici" subtitle="Informazioni principali" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoLine label="Tipo" value={component.type} />
            <InfoLine label="Identificativo" value={component.identifier} />
            <InfoLine label="Omologazione" value={component.homologation || "—"} />
            <InfoLine label="Scadenza" value={formatDate(component.expiry_date)} />
            <InfoLine label="Vita utile" value={component.life_hours ? formatHours(component.life_hours) : "—"} />
            <InfoLine label="Stato" value={component.status || "—"} />
          </div>

          {component.notes ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-xs text-neutral-500">Note</div>
              <div className="mt-2 whitespace-pre-line text-sm text-neutral-800">{component.notes}</div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Montaggio attivo" subtitle="Posizione attuale del componente">
          {activeMount?.cars ? (
            <div className="space-y-3">
              <StatusBadge label="Montato" tone="green" />
              <InfoLine label="Auto" value={activeMount.cars.name || "—"} />
              <InfoLine label="Telaio" value={activeMount.cars.chassis_number || "—"} />
              <InfoLine label="Montato il" value={formatDate(activeMount.installed_at)} />
            </div>
          ) : (
            <EmptyState title="Componente non montato" description="Questo componente non risulta attualmente installato su nessuna auto." />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Storico manutenzioni" subtitle="Interventi eseguiti sul componente">
          {maintenances.length === 0 ? (
            <EmptyState title="Nessuna manutenzione registrata" />
          ) : (
            <div className="space-y-3">
              {maintenances.map((maintenance) => (
                <div key={maintenance.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="font-semibold text-neutral-900">{formatDate(maintenance.performed_at)}</div>
                  <div className="mt-2 text-sm text-neutral-700">{maintenance.description || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Storico montaggi" subtitle="Sequenza dei montaggi su vettura">
          {mounts.length === 0 ? (
            <EmptyState title="Nessun montaggio registrato" />
          ) : (
            <div className="space-y-3">
              {mounts.map((mount) => (
                <div key={mount.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-neutral-900">{mount.cars?.name || "Auto"}</div>
                    <StatusBadge label={mount.removed_at ? "Storico" : "Attivo"} tone={mount.removed_at ? "neutral" : "green"} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <InfoLine label="Telaio" value={mount.cars?.chassis_number || "—"} />
                    <InfoLine label="Montato il" value={formatDate(mount.installed_at)} />
                    <InfoLine label="Smontato il" value={formatDate(mount.removed_at)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
