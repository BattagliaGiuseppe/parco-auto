"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CarFront,
  FileText,
  GaugeCircle,
  Info,
  Printer,
  Wrench,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import FormStatusBanner from "@/components/FormStatusBanner";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";
import { safeLowerLabel } from "@/lib/controlCenter";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LocalizedText from "@/components/LocalizedText";

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
  image_url: string | null;
  components: CarComponent[];
};

type RevisionItem = {
  id: string;
  component_id: string;
  date: string;
  description: string | null;
  reset_hours: boolean;
};

type CarTask = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_to_team_user_id: { name: string | null; email: string | null } | null;
  component_id: { type: string | null; identifier: string | null } | null;
};

function formatHours(value: number | null | undefined) {
  const hours = Number(value ?? 0);
  const minutes = Math.round(hours * 60);

  if (Math.abs(hours) < 1) return `${minutes} min`;
  if (Math.abs(hours) < 10) return `${hours.toFixed(2)} h`;
  return `${hours.toFixed(1)} h`;
}

function getExpiryColor(date: string) {
  const expiry = new Date(date);
  const now = new Date();

  if (expiry < now) return "text-red-300 font-bold";

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (months > 12) return "text-emerald-300 font-semibold";
  if (months > 6) return "text-[var(--brand-accent)] font-semibold";
  return "text-amber-300 font-semibold";
}

function getThresholdBadge(component: CarComponent) {
  const hours = Number(component.hours ?? 0);
  const warning = component.warning_threshold_hours;
  const revision = component.revision_threshold_hours;

  if (revision !== null && revision !== undefined && hours >= revision) {
    return {
      label: "Fuori soglia revisione",
      className: "border-red-400/35 bg-red-400/10 text-red-200",
    };
  }

  if (warning !== null && warning !== undefined && hours >= warning) {
    return {
      label: "In attenzione",
      className: "border-yellow-300/35 bg-yellow-300/10 text-[var(--brand-accent)]",
    };
  }

  return {
    label: "OK",
    className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  };
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="race-info-box text-sm leading-6">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function CarDetailPage() {
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
  const { id } = useParams<{ id: string }>();
  const { theme } = useBrandTheme();
  const vehicleLabel = theme.labels.vehicle || "Auto";
  const vehicleLabelLower = safeLowerLabel(vehicleLabel);

  const [car, setCar] = useState<CarData | null>(null);
  const [revisions, setRevisions] = useState<Record<string, RevisionItem[]>>({});
  const [tasks, setTasks] = useState<CarTask[]>([]);
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
            image_url,
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
        image_url: data.image_url || null,
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

      const { data: taskRows, error: tasksError } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,due_date,assigned_to_team_user_id(name,email),component_id(type,identifier)")
        .eq("car_id", id)
        .not("status", "in", "(done,cancelled)")
        .order("created_at", { ascending: false })
        .limit(8);

      if (!tasksError) {
        const normalizedTasks: CarTask[] = ((taskRows || []) as any[]).map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          status: row.status,
          priority: row.priority,
          due_date: row.due_date,
          assigned_to_team_user_id: Array.isArray(row.assigned_to_team_user_id)
            ? row.assigned_to_team_user_id[0] ?? { name: null, email: null }
            : row.assigned_to_team_user_id ?? { name: null, email: null },
          component_id: Array.isArray(row.component_id)
            ? row.component_id[0] ?? null
            : row.component_id ?? null,
        }));
        setTasks(normalizedTasks);
      } else {
        setTasks([]);
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
      <div className={`flex flex-col gap-6 p-6`}>
        <div className="race-card-grid px-6 py-5 text-sm text-[var(--text-secondary)]">
          <LocalizedText text="Caricamento scheda..." />
        </div>
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className={`flex flex-col gap-6 p-6`}>
        <FormStatusBanner
          type="error"
          message={error || "Scheda non trovata"}
        />
      </div>
    );
  }

  const stats = [
    {
      label: "Ore",
      value: formatHours(car.hours),
      icon: <GaugeCircle size={18} />,
      helper: "Ore complessive registrate",
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
      helper: `Codice telaio · ${vehicleLabelLower}`,
    },
  ];

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title={car.name}
        subtitle={`Scheda ${vehicleLabelLower} con componenti montati, soglie e storico revisioni`}
        icon={<CarFront size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/cars/${id}/documents`}
              className="race-action-secondary px-4 py-2"
            >
              <FileText size={16} className="mr-2 inline" />
              <LocalizedText text="Documenti" />
            </Link>
            <Link
              href={`/cars/${id}/print`}
              className="race-action-secondary px-4 py-2"
            >
              <Printer size={16} className="mr-2 inline" />
              <LocalizedText text="Stampa" />
            </Link>
          </div>
        }
      />

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title={tr("Lettura operativa")}
        subtitle="Questa pagina riassume lo stato tecnico del mezzo e dei componenti attualmente montati."
      >
        <InfoBlock>
          <LocalizedText text="Usa la scheda mezzo per avere una vista sintetica delle ore auto, dei componenti installati e delle soglie di attenzione. Quando ti serve intervenire su un singolo componente, apri la relativa scheda tecnica direttamente da qui." />
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title={`Panoramica ${vehicleLabel}`}
        subtitle="Identità, immagine e ore complessive registrate"
      >
        <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
          <img
            src={car.image_url || "/mia-foto.png"}
            alt={car.name}
            className="h-56 w-full object-cover"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard label={vehicleLabel} value={car.name} />
          <InfoCard label="Telaio" value={car.chassis_number || "—"} />
          <InfoCard label="Ore vettura" value={formatHours(car.hours)} />
        </div>
      </SectionCard>

      <SectionCard
        title={tr("Attività aperte")}
        subtitle="Promemoria e lavori da fare collegati a questo mezzo."
        actions={<Link href="/tasks" className="race-action-secondary px-4 py-2 text-sm"><LocalizedText text="Apri attività" /></Link>}
      >
        {tasks.length === 0 ? (
          <EmptyState
            title={tr("Nessuna attività aperta per questo mezzo")}
            description="Quando crei un promemoria collegato a questa scheda lo ritroverai direttamente qui."
          />
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="data-row flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TaskChip label={task.priority === "urgent" ? "Urgente" : task.priority === "high" ? "Alta" : task.priority === "low" ? "Bassa" : "Media"} tone={task.priority === "urgent" ? "red" : task.priority === "high" ? "yellow" : "blue"} />
                    <TaskChip label={task.status === "in_progress" ? "In corso" : task.status === "waiting" ? "In attesa" : "Da fare"} tone={task.status === "waiting" ? "yellow" : task.status === "in_progress" ? "blue" : "purple"} />
                  </div>
                  <div className="mt-3 text-lg font-black text-[var(--text-primary)]">{task.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    {task.component_id?.identifier ? `${task.component_id.type || "Componente"} · ${task.component_id.identifier}` : "Attività generale"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-2"><CalendarDays size={15} /> {formatDate(task.due_date)}</span>
                  <span>Assegnata: {task.assigned_to_team_user_id?.name || task.assigned_to_team_user_id?.email || "—"}</span>
                  <Link href="/tasks" className="race-action-link"><LocalizedText text="Gestisci" /></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={tr("Componenti montati")}
        subtitle="Controlla ore, soglie, scadenze e ultima revisione dei componenti attivi sul mezzo."
      >
        {car.components.length === 0 ? (
          <EmptyState
            title={tr("Nessun componente montato")}
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
                  className="data-row p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold capitalize text-[var(--text-primary)]">
                        {component.type}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">{component.identifier}</p>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                    <MetricCard label="Ore attuali" value={formatHours(component.hours)} />
                    <MetricCard label="Ore vita totale" value={formatHours(component.life_hours)} />
                    <MetricCard
                      label="Soglia attenzione"
                      value={
                        component.warning_threshold_hours !== null &&
                        component.warning_threshold_hours !== undefined
                          ? formatHours(component.warning_threshold_hours)
                          : "—"
                      }
                    />
                    <MetricCard
                      label="Soglia revisione"
                      value={
                        component.revision_threshold_hours !== null &&
                        component.revision_threshold_hours !== undefined
                          ? formatHours(component.revision_threshold_hours)
                          : "—"
                      }
                    />
                  </div>

                  {component.expiry_date && (
                    <p className={`mt-4 text-sm ${getExpiryColor(component.expiry_date)}`}>
                      <span className="font-semibold"><LocalizedText text="Scadenza:" /></span>{" "}
                      {new Date(component.expiry_date).toLocaleDateString("it-IT")}
                    </p>
                  )}

                  <div className="mt-2 text-sm text-[var(--text-secondary)]">
                    <span className="font-semibold"><LocalizedText text="Ultima revisione:" /></span>{" "}
                    {latestRevision?.date
                      ? new Date(latestRevision.date).toLocaleDateString("it-IT")
                      : "—"}
                  </div>

                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    <span className="font-semibold"><LocalizedText text="Ultima manutenzione:" /></span>{" "}
                    {component.last_maintenance_date
                      ? new Date(component.last_maintenance_date).toLocaleDateString("it-IT")
                      : "—"}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link href={`/components/${component.id}`} className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm">
                      <LocalizedText text="Apri componente" />
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function TaskChip({ label, tone }: { label: string; tone: "red" | "yellow" | "blue" | "purple" }) {
  const { t } = useLanguage();
  const classes = {
    red: "border-red-400/35 bg-red-400/10 text-red-300",
    yellow: "border-amber-400/35 bg-amber-400/10 text-amber-300",
    blue: "border-blue-400/35 bg-blue-400/10 text-blue-300",
    purple: "border-purple-400/35 bg-purple-400/10 text-purple-300",
  }[tone];

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes}`}>{t(`ui.${label}`, label)}</span>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();
  return (
    <div className="race-mini-panel min-h-[92px] p-4">
      <div className="racing-kicker text-[var(--text-muted)]">{t(`ui.${label}`, label)}</div>
      <div className="technical-number mt-3 text-xl font-black text-[var(--text-primary)]">{t(`ui.${value}`, value)}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();
  return (
    <div className="race-mini-panel p-3">
      <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{t(`ui.${label}`, label)}</span>
      <span className="technical-number mt-1 block font-black text-[var(--text-primary)]">{t(`ui.${value}`, value)}</span>
    </div>
  );
}
