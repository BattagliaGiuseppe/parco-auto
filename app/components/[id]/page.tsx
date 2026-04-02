"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Boxes, CalendarClock, CarFront, Clock3, FileText, ShieldAlert, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type ComponentRow = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  notes: string | null;
  car_id: string | null;
  created_at: string;
};

type MountedCar = { id: string; name: string; chassis_number: string | null };
type MaintenanceRow = { id: string; date: string | null; type: string | null; status: string | null; priority: string | null; notes: string | null };
type RevisionRow = { id: string; date: string; description: string | null; reset_hours: boolean; created_at: string };
type DocumentRow = { id: string; title: string | null; type: string | null; file_url: string | null; file_name: string | null; uploaded_at: string };

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatHours(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)} h`;
}

function getStatus(component: ComponentRow) {
  const hours = Number(component.hours || 0);
  if (component.expiry_date && new Date(component.expiry_date) < new Date()) {
    return { label: "Scaduto", tone: "red" as const };
  }
  if (component.revision_threshold_hours !== null && component.revision_threshold_hours !== undefined && hours >= component.revision_threshold_hours) {
    return { label: "Fuori soglia", tone: "red" as const };
  }
  if (component.warning_threshold_hours !== null && component.warning_threshold_hours !== undefined && hours >= component.warning_threshold_hours) {
    return { label: "In attenzione", tone: "yellow" as const };
  }
  return { label: "OK", tone: "green" as const };
}

export default function ComponentDetailPage() {
  const params = useParams();
  const componentId = params?.id as string;

  const [component, setComponent] = useState<ComponentRow | null>(null);
  const [mountedCar, setMountedCar] = useState<MountedCar | null>(null);
  const [maintenances, setMaintenances] = useState<MaintenanceRow[]>([]);
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [componentRes, maintRes, revRes, docsRes] = await Promise.all([
        supabase.from("components").select("*").eq("team_id", ctx.teamId).eq("id", componentId).single(),
        supabase.from("maintenances").select("id,date,type,status,priority,notes").eq("team_id", ctx.teamId).eq("component_id", componentId).order("date", { ascending: false }),
        supabase.from("component_revisions").select("id,date,description,reset_hours,created_at").eq("team_id", ctx.teamId).eq("component_id", componentId).order("date", { ascending: false }),
        supabase.from("documents").select("id,title,type,file_url,file_name,uploaded_at").eq("team_id", ctx.teamId).eq("component_id", componentId).order("uploaded_at", { ascending: false }),
      ]);

      const componentData = componentRes.data as ComponentRow | null;
      setComponent(componentData);
      setMaintenances((maintRes.data || []) as MaintenanceRow[]);
      setRevisions((revRes.data || []) as RevisionRow[]);
      setDocuments((docsRes.data || []) as DocumentRow[]);

      if (componentData?.car_id) {
        const { data: carData } = await supabase
          .from("cars")
          .select("id,name,chassis_number")
          .eq("team_id", ctx.teamId)
          .eq("id", componentData.car_id)
          .single();
        setMountedCar((carData || null) as MountedCar | null);
      } else {
        setMountedCar(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (componentId) void loadAll();
  }, [componentId]);

  const status = useMemo(() => (component ? getStatus(component) : { label: "—", tone: "neutral" as const }), [component]);

  const stats: StatItem[] = [
    { label: "Ore attuali", value: formatHours(component?.hours), icon: <Clock3 size={18} /> },
    { label: "Vita componente", value: formatHours(component?.life_hours), icon: <ShieldAlert size={18} /> },
    { label: "Manutenzioni", value: String(maintenances.length), icon: <Wrench size={18} /> },
    { label: "Revisioni", value: String(revisions.length), icon: <CalendarClock size={18} /> },
  ];

  if (loading) return <div className="p-6 text-neutral-500">Caricamento componente...</div>;
  if (!component) return <div className="p-6 text-red-600 font-semibold">Componente non trovato.</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`${component.type} · ${component.identifier}`}
        subtitle="Scheda tecnica completa del componente"
        icon={<Boxes size={22} />}
        actions={<Link href="/components" className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="mr-2 inline" />Componenti</Link>}
      />

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Stato tecnico" subtitle="Condizione attuale, soglie e stato montaggio">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Info label="Tipo" value={component.type} />
            <Info label="Identificativo" value={component.identifier} />
            <Info label="Scadenza" value={formatDate(component.expiry_date)} />
            <Info label="Soglia warning" value={component.warning_threshold_hours !== null && component.warning_threshold_hours !== undefined ? formatHours(component.warning_threshold_hours) : "—"} />
            <Info label="Soglia revisione" value={component.revision_threshold_hours !== null && component.revision_threshold_hours !== undefined ? formatHours(component.revision_threshold_hours) : "—"} />
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm text-neutral-500">Stato</div>
              <div className="mt-2 flex items-center gap-3">
                <StatusBadge label={status.label} tone={status.tone} />
                <StatusBadge label={mountedCar ? "Montato" : "Smontato"} tone={mountedCar ? "green" : "neutral"} />
              </div>
            </div>
          </div>
          {component.notes ? <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 whitespace-pre-wrap">{component.notes}</div> : null}
        </SectionCard>

        <SectionCard title="Posizione attuale" subtitle="Dove si trova il componente adesso">
          {mountedCar ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center gap-2 text-sm text-neutral-500"><CarFront size={16} className="text-yellow-600" />Mezzo montato</div>
              <div className="mt-2 text-lg font-bold text-neutral-900">{mountedCar.name}</div>
              <div className="mt-1 text-sm text-neutral-500">Telaio {mountedCar.chassis_number || "—"}</div>
              <div className="mt-4"><Link href={`/cars/${mountedCar.id}`} className="rounded-xl border px-4 py-2 text-sm font-semibold">Apri scheda mezzo</Link></div>
            </div>
          ) : (
            <EmptyState title="Componente attualmente smontato" description="Puoi montarlo da Montaggi o direttamente dal modulo Mezzi." />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Storico manutenzioni" subtitle="Interventi tecnici eseguiti sul componente">
          {maintenances.length === 0 ? <EmptyState title="Nessuna manutenzione registrata" /> : (
            <div className="space-y-3">
              {maintenances.map((row) => (
                <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-neutral-900">{row.type || "Manutenzione"}</div>
                      <div className="mt-1 text-sm text-neutral-500">{formatDate(row.date)}</div>
                    </div>
                    <div className="flex gap-2">
                      {row.status ? <StatusBadge label={row.status} tone={row.status === "completed" ? "green" : row.status === "open" ? "yellow" : "neutral"} /> : null}
                      {row.priority ? <StatusBadge label={row.priority} tone={row.priority === "high" ? "red" : row.priority === "medium" ? "yellow" : "neutral"} /> : null}
                    </div>
                  </div>
                  {row.notes ? <div className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{row.notes}</div> : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Revisioni e documenti" subtitle="Storico revisioni e allegati collegati">
          <div className="space-y-4">
            <div>
              <div className="mb-2 font-semibold text-neutral-900">Revisioni</div>
              {revisions.length === 0 ? <EmptyState title="Nessuna revisione registrata" /> : (
                <div className="space-y-3">
                  {revisions.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="font-bold text-neutral-900">{formatDate(row.date)}</div>
                      <div className="mt-1 text-sm text-neutral-500">{row.reset_hours ? "Con reset ore" : "Senza reset ore"}</div>
                      {row.description ? <div className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{row.description}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 font-semibold text-neutral-900"><FileText size={16} />Documenti</div>
              {documents.length === 0 ? <EmptyState title="Nessun documento collegato" /> : (
                <div className="space-y-3">
                  {documents.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="font-bold text-neutral-900">{row.title || row.type || "Documento"}</div>
                      <div className="mt-1 text-sm text-neutral-500">{row.file_name || formatDate(row.uploaded_at)}</div>
                      {row.file_url ? <a href={row.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold">Apri file</a> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-sm text-neutral-500">{label}</div><div className="mt-1 text-base font-bold text-neutral-900">{value}</div></div>;
}
