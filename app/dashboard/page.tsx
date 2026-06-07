"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CarFront, CheckCircle2, ClipboardList, Fuel, Package, Users, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { formatComponentHours, getDashboardComponentSeverity } from "@/lib/componentStatus";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";
import { dashboardWidgetClassName, getDashboardWidgetDisplayLabel, getDashboardWidgetMeta, isModuleEnabled, isWidgetVisibleForRole, safeLowerLabel } from "@/lib/controlCenter";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LocalizedText from "@/components/LocalizedText";

type AppSettings = {
  team_name: string;
  vehicle_type: string;
  labels: Record<string, string> | null;
  modules: Record<string, boolean> | null;
  enable_events?: boolean | null;
  enable_maintenances?: boolean | null;
};

type Widget = {
  widget_code: string;
  label: string;
  is_enabled: boolean;
  size: string;
  role_scope?: string | null;
  order_index: number;
  config?: Record<string, unknown> | null;
};

type Car = { id: string; name: string; hours: number | null; components?: any[] };
type Component = { id: string; type: string; identifier: string; expiry_date: string | null; hours: number | null; warning_threshold_hours: number | null; revision_threshold_hours: number | null; car_id: string | null };
type Event = { id: string; name: string; date: string | null; circuit_id: { name: string | null } | null };
type Maintenance = { id: string; type: string | null; status: string | null; priority: string | null; date: string | null; car_id: { name: string | null } | null; component_id: { identifier: string | null } | null };
type DriverDoc = { id: string; expires_at: string | null; driver_id: { first_name: string | null; last_name: string | null } | null };
type Inventory = { id: string; name: string; quantity: number | null; minimum_quantity: number | null; reserved_quantity: number | null };
type Task = { id: string; title: string; status: string | null; priority: string | null; due_date: string | null; car_id: { name: string | null } | null; assigned_to_team_user_id: { name: string | null; email: string | null } | null };
type AttendanceRecord = { id: string; check_in_at: string | null; check_out_at: string | null; check_in_location_label: string | null };

function componentSeverity(component: Component) {
  return getDashboardComponentSeverity(component);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function isFutureOrToday(value: string | null | undefined) {
  if (!value) return false;
  const d = new Date(value);
  const today = new Date();
  today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d >= today;
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [driverDocs, setDriverDocs] = useState<DriverDoc[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const { theme } = useBrandTheme();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const ctx = await getCurrentTeamContext();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [settingsRes, widgetsRes, carsRes, compsRes, eventsRes, maintRes, driverDocsRes, inventoryRes, tasksRes, attendanceRes] = await Promise.all([
          supabase.from("app_settings").select("team_name,vehicle_type,labels,modules,enable_events,enable_maintenances").eq("team_id", ctx.teamId).single(),
          supabase.from("team_dashboard_widgets").select("widget_code,label,is_enabled,size,role_scope,order_index,config").eq("team_id", ctx.teamId).order("order_index", { ascending: true }),
          supabase.from("cars").select("id,name,hours").eq("team_id", ctx.teamId).order("name", { ascending: true }),
          supabase.from("components").select("id,type,identifier,expiry_date,hours,warning_threshold_hours,revision_threshold_hours,car_id").eq("team_id", ctx.teamId).order("identifier", { ascending: true }),
          supabase.from("events").select("id,name,date,circuit_id(name)").eq("team_id", ctx.teamId).order("date", { ascending: true }),
          supabase.from("maintenances").select("id,type,status,priority,date,car_id(name),component_id(identifier)").eq("team_id", ctx.teamId).order("created_at", { ascending: false }).limit(12),
          supabase.from("driver_documents").select("id,expires_at,driver_id(first_name,last_name)").eq("team_id", ctx.teamId).not("expires_at", "is", null).order("expires_at", { ascending: true }).limit(8),
          supabase.from("inventory_items").select("id,name,quantity,minimum_quantity,reserved_quantity").eq("team_id", ctx.teamId).order("name", { ascending: true }),
          supabase.from("tasks").select("id,title,status,priority,due_date,car_id(name),assigned_to_team_user_id(name,email)").eq("team_id", ctx.teamId).neq("status", "done").neq("status", "cancelled").order("created_at", { ascending: false }).limit(8),
          supabase.from("attendance_records").select("id,check_in_at,check_out_at,check_in_location_label").eq("team_id", ctx.teamId).gte("check_in_at", todayStart.toISOString()).order("check_in_at", { ascending: false }).limit(50),
        ]);
        setTeamRole(ctx.role || null);
        setSettings((settingsRes.data || null) as AppSettings | null);
        setWidgets(((widgetsRes.data || []) as Widget[]).filter((w) => w.is_enabled));
        setCars((carsRes.data || []) as Car[]);
setComponents((compsRes.data || []) as Component[]);

const normalizedEvents: Event[] = (eventsRes.data || []).map((row: any) => ({
  id: row.id,
  name: row.name,
  date: row.date,
  circuit_id: Array.isArray(row.circuit_id)
    ? row.circuit_id[0] ?? { name: null }
    : row.circuit_id ?? { name: null },
}));

setEvents(normalizedEvents);

const normalizedMaintenances: Maintenance[] = (maintRes.data || []).map((row: any) => ({
  id: row.id,
  type: row.type,
  status: row.status,
  priority: row.priority,
  date: row.date,
  car_id: Array.isArray(row.car_id)
    ? row.car_id[0] ?? { name: null }
    : row.car_id ?? { name: null },
  component_id: Array.isArray(row.component_id)
    ? row.component_id[0] ?? { identifier: null }
    : row.component_id ?? { identifier: null },
}));

setMaintenances(normalizedMaintenances);
const normalizedDriverDocs: DriverDoc[] = (driverDocsRes.data || []).map((row: any) => ({
  id: row.id,
  expires_at: row.expires_at,
  driver_id: Array.isArray(row.driver_id)
    ? row.driver_id[0] ?? { first_name: null, last_name: null }
    : row.driver_id ?? { first_name: null, last_name: null },
}));

setDriverDocs(normalizedDriverDocs);
setInventory((inventoryRes.data || []) as Inventory[]);
const normalizedTasks: Task[] = !tasksRes.error
  ? ((tasksRes.data || []) as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      due_date: row.due_date,
      car_id: Array.isArray(row.car_id) ? row.car_id[0] ?? { name: null } : row.car_id ?? { name: null },
      assigned_to_team_user_id: Array.isArray(row.assigned_to_team_user_id)
        ? row.assigned_to_team_user_id[0] ?? { name: null, email: null }
        : row.assigned_to_team_user_id ?? { name: null, email: null },
    }))
  : [];
setTasks(normalizedTasks);
setAttendanceRecords(!attendanceRes.error ? ((attendanceRes.data || []) as AttendanceRecord[]) : []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const labels = theme.labels;

  function dashboardDisplayLabel(widget: Widget) {
    return getDashboardWidgetDisplayLabel(widget, labels);
  }

  const urgentComponents = useMemo(() => components.filter((c) => componentSeverity(c) >= 3), [components]);
  const warningComponents = useMemo(() => components.filter((c) => componentSeverity(c) === 2), [components]);
  const upcomingEvents = useMemo(() => events.filter((e) => isFutureOrToday(e.date)).slice(0, 5), [events]);
  const openMaintenances = useMemo(() => maintenances.filter((m) => m.status !== "completed").slice(0, 6), [maintenances]);
  const expiringDriverDocs = useMemo(() => driverDocs.filter((row) => row.expires_at && isFutureOrToday(row.expires_at)).slice(0, 6), [driverDocs]);
  const lowStock = useMemo(() => inventory.filter((row) => Number(row.quantity || 0) <= Number(row.minimum_quantity || 0)), [inventory]);
  const openTasks = useMemo(() => tasks.filter((row) => row.status !== "done" && row.status !== "cancelled"), [tasks]);
  const attendanceOpen = useMemo(() => attendanceRecords.filter((row) => !row.check_out_at), [attendanceRecords]);
  const attendanceInTrack = useMemo(() => attendanceRecords.filter((row) => (row.check_in_location_label || "").toLowerCase().includes("pista")), [attendanceRecords]);
  const carsReady = useMemo(() => {
    const problemCarIds = new Set(components.filter((c) => componentSeverity(c) >= 2 && c.car_id).map((c) => c.car_id as string));
    return cars.filter((car) => !problemCarIds.has(car.id)).length;
  }, [cars, components]);

  const stats: StatItem[] = [
    {
      label: `Prontezza · ${labels.vehicle}`,
      value: `${carsReady}/${cars.length}`,
      icon: <CheckCircle2 size={18} />,
      helper: cars.length === 0 ? "Nessun mezzo registrato" : "Senza warning componenti",
      tone: carsReady === cars.length ? "green" : "yellow",
    },
    {
      label: "Criticità urgenti",
      value: String(urgentComponents.length),
      icon: <AlertTriangle size={18} />,
      helper: urgentComponents.length > 0 ? "Da gestire prima del prossimo turno" : "Nessuna urgenza",
      tone: urgentComponents.length > 0 ? "red" : "green",
    },
    {
      label: `Da completare · ${labels.maintenance}`,
      value: String(openMaintenances.length),
      icon: <Wrench size={18} />,
      helper: "Interventi non completati",
      tone: openMaintenances.length > 0 ? "yellow" : "green",
    },
    {
      label: `Calendario · ${labels.event}`,
      value: String(upcomingEvents.length),
      icon: <CalendarDays size={18} />,
      helper: "Calendario operativo",
      tone: "blue",
    },
  ];

  function renderWidget(code: string, label: string) {
    switch (code) {
      case "cars_ready":
        return (
          <SectionCard key={code} title={label} subtitle={`Prontezza operativa · ${safeLowerLabel(labels.vehicle)}`}>
            {cars.length === 0 ? <EmptyState title={tr("Nessun elemento registrato")} /> : (
              <div className="space-y-3">
                {cars.map((car) => {
                  const hasProblems = components.some((c) => c.car_id === car.id && componentSeverity(c) >= 2);
                  return (
                    <div key={car.id} className="data-row flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-[var(--text-primary)]">{car.name}</div>
                        <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{formatComponentHours(car.hours)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge label={hasProblems ? "Da verificare" : "Pronto"} tone={hasProblems ? "yellow" : "green"} />
                        <Link href="/cars" className="race-action-link text-sm"><LocalizedText text="Apri" /></Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        );
      case "components_alerts":
        return (
          <SectionCard key={code} title={label} subtitle="Componenti fuori soglia, in warning o scaduti">
            {urgentComponents.length + warningComponents.length === 0 ? <EmptyState title={tr("Nessuna criticità componente")} /> : (
              <div className="space-y-3">
                {[...urgentComponents, ...warningComponents].slice(0, 8).map((row) => (
                  <div key={row.id} className="data-row">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-[var(--text-primary)]">{row.type} · {row.identifier}</div>
                        <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{row.car_id ? `Montato su mezzo collegato` : "Attualmente smontato"}</div>
                      </div>
                      <StatusBadge label={componentSeverity(row) >= 3 ? "Urgente" : "Attenzione"} tone={componentSeverity(row) >= 3 ? "red" : "yellow"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "upcoming_events":
        return (
          <SectionCard key={code} title={label} subtitle="I prossimi appuntamenti del team">
            {upcomingEvents.length === 0 ? <EmptyState title={tr("Nessun evento imminente")} /> : (
              <div className="space-y-3">
                {upcomingEvents.map((row) => (
                  <div key={row.id} className="data-row flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)]">{row.name}</div>
                      <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{formatDate(row.date)} · {row.circuit_id?.name || "Circuito da definire"}</div>
                    </div>
                    <Link href={`/calendar/${row.id}`} className="race-action-link text-sm"><LocalizedText text="Apri" /></Link>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "maintenances_open":
        return (
          <SectionCard key={code} title={label} subtitle="Interventi che richiedono attenzione">
            {openMaintenances.length === 0 ? <EmptyState title={tr("Nessuna manutenzione aperta")} /> : (
              <div className="space-y-3">
                {openMaintenances.map((row) => (
                  <div key={row.id} className="data-row">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-[var(--text-primary)]">{row.type || "Manutenzione"}</div>
                        <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{row.car_id?.name || row.component_id?.identifier || "Elemento non specificato"} · {formatDate(row.date)}</div>
                      </div>
                      <div className="flex gap-2">
                        {row.priority ? <StatusBadge label={row.priority} tone={row.priority === "high" ? "red" : row.priority === "medium" ? "yellow" : "neutral"} /> : null}
                        {row.status ? <StatusBadge label={row.status} tone={row.status === "completed" ? "green" : row.status === "open" ? "yellow" : "neutral"} /> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "drivers_documents":
        return (
          <SectionCard key={code} title={label} subtitle="Scadenze documentali dei piloti">
            {expiringDriverDocs.length === 0 ? <EmptyState title={`Nessun documento ${labels.driver.toLowerCase()} in scadenza`} /> : (
              <div className="space-y-3">
                {expiringDriverDocs.map((row) => (
                  <div key={row.id} className="data-row flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)]">{row.driver_id?.first_name} {row.driver_id?.last_name}</div>
                      <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">Scadenza {formatDate(row.expires_at)}</div>
                    </div>
                    <StatusBadge label="Da verificare" tone="yellow" />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "tasks_open":
        return (
          <SectionCard key={code} title={label} subtitle="Promemoria e attività operative ancora aperte">
            {openTasks.length === 0 ? <EmptyState title={tr("Nessuna attività aperta")} /> : (
              <div className="space-y-3">
                {openTasks.slice(0, 8).map((row) => (
                  <div key={row.id} className="data-row flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)]">{row.title}</div>
                      <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                        {row.car_id?.name || "Senza auto collegata"} · Assegnata a {row.assigned_to_team_user_id?.name || row.assigned_to_team_user_id?.email || "nessuno"} · Scadenza {formatDate(row.due_date)}
                      </div>
                    </div>
                    <Link href="/tasks" className="race-action-link text-sm"><LocalizedText text="Apri" /></Link>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "inventory_low_stock":
        return (
          <SectionCard key={code} title={label} subtitle="Articoli sotto la scorta minima">
            {lowStock.length === 0 ? <EmptyState title={tr("Nessun articolo sotto soglia")} /> : (
              <div className="space-y-3">
                {lowStock.map((row) => (
                  <div key={row.id} className="data-row flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)]">{row.name}</div>
                      <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">Disponibile {row.quantity} · Minima {row.minimum_quantity} · Impegnata {row.reserved_quantity}</div>
                    </div>
                    <StatusBadge label="Sotto soglia" tone="red" />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "attendance_today":
        return (
          <SectionCard key={code} title={label} subtitle="Persone presenti oggi e timbrature aperte">
            {attendanceRecords.length === 0 ? <EmptyState title={tr("Nessuna timbratura oggi")} /> : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <QuickPill icon={<Users size={16} />} label="Presenti ora" value={String(attendanceOpen.length)} />
                  <QuickPill icon={<CalendarDays size={16} />} label="In pista" value={String(attendanceInTrack.length)} />
                </div>
                <Link href="/attendance" className="race-action-link text-sm"><LocalizedText text="Apri presenze →" /></Link>
              </div>
            )}
          </SectionCard>
        );
      default:
        return null;
    }
  }

  const effectiveWidgets = widgets.length > 0 ? widgets : [
    { widget_code: "cars_ready", label: "Mezzi pronti", is_enabled: true, size: "md", role_scope: "all", order_index: 1 },
    { widget_code: "components_alerts", label: "Componenti critici", is_enabled: true, size: "md", role_scope: "all", order_index: 2 },
    { widget_code: "upcoming_events", label: "Prossimi eventi", is_enabled: true, size: "md", role_scope: "all", order_index: 3 },
    { widget_code: "maintenances_open", label: `Da completare · ${labels.maintenance}`, is_enabled: true, size: "md", role_scope: "all", order_index: 4 },
    { widget_code: "tasks_open", label: "Attività aperte", is_enabled: true, size: "md", role_scope: "all", order_index: 5 },
  ];

  if (loading) {
    return <div className="p-6 text-[var(--text-secondary)]"><LocalizedText text="Caricamento dashboard..." /></div>;
  }

  return (
    <div className="page-shell">
      <PageHeader
        title={settings?.team_name || "Dashboard"}
        subtitle="Centro operativo del team: mezzi pronti, componenti critici, scadenze e prossime azioni in un unico pannello."
        icon={<ClipboardList size={22} />}
        actions={
          <Link
            href="/settings"
            className="inline-flex rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-sm font-black text-[var(--brand-on-accent)] shadow-[0_12px_24px_rgba(var(--brand-accent-rgb),0.28)] transition hover:-translate-y-px hover:brightness-95"
          >
            Configura dashboard
          </Link>
        }
      />

      <StatsGrid items={stats} />

      <SectionCard title={tr("Quadro operativo")} subtitle="Lettura rapida delle aree che richiedono attenzione prima del prossimo turno.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <QuickPill icon={<CarFront size={16} />} label={`Totale · ${labels.vehicle}`} value={String(cars.length)} />
          <QuickPill icon={<Wrench size={16} />} label={`Warning · ${labels.component}`} value={String(warningComponents.length)} />
          <QuickPill icon={<Users size={16} />} label={`Documenti · ${labels.driver}`} value={String(expiringDriverDocs.length)} />
          <QuickPill icon={<Package size={16} />} label={`Sotto soglia · ${labels.inventory}`} value={String(lowStock.length)} />
          <QuickPill icon={<ClipboardList size={16} />} label={`Aperte · ${labels.tasks}`} value={String(openTasks.length)} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {effectiveWidgets
          .filter((widget) => isWidgetVisibleForRole(widget.role_scope, teamRole))
          .filter((widget) => {
            const meta = getDashboardWidgetMeta(widget.widget_code);
            return !meta?.requiredModule || isModuleEnabled(settings, meta.requiredModule);
          })
          .map((widget) => {
            const rendered = renderWidget(widget.widget_code, dashboardDisplayLabel(widget));
            if (!rendered) return null;
            return (
              <div key={widget.widget_code} className={dashboardWidgetClassName(widget.size)}>
                {rendered}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function QuickPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="data-row">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted)]">{icon}{label}</div>
      <div className="technical-number mt-3 text-3xl font-black leading-none text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
