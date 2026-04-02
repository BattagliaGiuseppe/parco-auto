"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CarFront, CheckCircle2, ClipboardList, Fuel, Package, Users, Wrench } from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type AppSettings = {
  team_name: string;
  vehicle_type: string;
  labels: Record<string, string> | null;
  modules: Record<string, boolean> | null;
};

type Widget = {
  widget_code: string;
  label: string;
  is_enabled: boolean;
  size: string;
  order_index: number;
};

type Car = { id: string; name: string; hours: number | null; components?: any[] };
type Component = { id: string; type: string; identifier: string; expiry_date: string | null; hours: number | null; warning_threshold_hours: number | null; revision_threshold_hours: number | null; car_id: string | null };
type Event = { id: string; name: string; date: string | null; circuit_id: { name: string | null } | null };
type Maintenance = { id: string; type: string | null; status: string | null; priority: string | null; date: string | null; car_id: { name: string | null } | null; component_id: { identifier: string | null } | null };
type DriverDoc = { id: string; expires_at: string | null; driver_id: { first_name: string | null; last_name: string | null } | null };
type Inventory = { id: string; name: string; quantity: number | null; minimum_quantity: number | null; reserved_quantity: number | null };

function componentSeverity(component: Component) {
  const hours = Number(component.hours || 0);
  if (component.expiry_date && new Date(component.expiry_date) < new Date()) return 3;
  if (component.revision_threshold_hours !== null && component.revision_threshold_hours !== undefined && hours >= component.revision_threshold_hours) return 3;
  if (component.warning_threshold_hours !== null && component.warning_threshold_hours !== undefined && hours >= component.warning_threshold_hours) return 2;
  if (component.expiry_date) {
    const expiry = new Date(component.expiry_date);
    const now = new Date();
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return 2;
  }
  return 1;
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
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [driverDocs, setDriverDocs] = useState<DriverDoc[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const ctx = await getCurrentTeamContext();
        const [settingsRes, widgetsRes, carsRes, compsRes, eventsRes, maintRes, driverDocsRes, inventoryRes] = await Promise.all([
          supabase.from("app_settings").select("team_name,vehicle_type,labels,modules").eq("team_id", ctx.teamId).single(),
          supabase.from("team_dashboard_widgets").select("widget_code,label,is_enabled,size,order_index").eq("team_id", ctx.teamId).order("order_index", { ascending: true }),
          supabase.from("cars").select("id,name,hours").eq("team_id", ctx.teamId).order("name", { ascending: true }),
          supabase.from("components").select("id,type,identifier,expiry_date,hours,warning_threshold_hours,revision_threshold_hours,car_id").eq("team_id", ctx.teamId).order("identifier", { ascending: true }),
          supabase.from("events").select("id,name,date,circuit_id(name)").eq("team_id", ctx.teamId).order("date", { ascending: true }),
          supabase.from("maintenances").select("id,type,status,priority,date,car_id(name),component_id(identifier)").eq("team_id", ctx.teamId).order("created_at", { ascending: false }).limit(12),
          supabase.from("driver_documents").select("id,expires_at,driver_id(first_name,last_name)").eq("team_id", ctx.teamId).not("expires_at", "is", null).order("expires_at", { ascending: true }).limit(8),
          supabase.from("inventory_items").select("id,name,quantity,minimum_quantity,reserved_quantity").eq("team_id", ctx.teamId).order("name", { ascending: true }),
        ]);
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
setDriverDocs((driverDocsRes.data || []) as DriverDoc[]);
setInventory((inventoryRes.data || []) as Inventory[]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const labels = settings?.labels || { vehicle: "Auto", driver: "Pilota", event: "Evento", turn: "Turno" };

  const urgentComponents = useMemo(() => components.filter((c) => componentSeverity(c) >= 3), [components]);
  const warningComponents = useMemo(() => components.filter((c) => componentSeverity(c) === 2), [components]);
  const upcomingEvents = useMemo(() => events.filter((e) => isFutureOrToday(e.date)).slice(0, 5), [events]);
  const openMaintenances = useMemo(() => maintenances.filter((m) => m.status !== "completed").slice(0, 6), [maintenances]);
  const expiringDriverDocs = useMemo(() => driverDocs.filter((row) => row.expires_at && isFutureOrToday(row.expires_at)).slice(0, 6), [driverDocs]);
  const lowStock = useMemo(() => inventory.filter((row) => Number(row.quantity || 0) <= Number(row.minimum_quantity || 0)), [inventory]);
  const carsReady = useMemo(() => {
    const problemCarIds = new Set(components.filter((c) => componentSeverity(c) >= 2 && c.car_id).map((c) => c.car_id as string));
    return cars.filter((car) => !problemCarIds.has(car.id)).length;
  }, [cars, components]);

  const stats: StatItem[] = [
    { label: `${labels.vehicle} pronti`, value: `${carsReady}/${cars.length}`, icon: <CheckCircle2 size={18} /> },
    { label: "Criticità urgenti", value: String(urgentComponents.length), icon: <AlertTriangle size={18} /> },
    { label: "Manutenzioni aperte", value: String(openMaintenances.length), icon: <Wrench size={18} /> },
    { label: `${labels.event} prossimi`, value: String(upcomingEvents.length), icon: <CalendarDays size={18} /> },
  ];

  function renderWidget(code: string, label: string) {
    switch (code) {
      case "cars_ready":
        return (
          <SectionCard key={code} title={label} subtitle={`Prontezza attuale dei ${labels.vehicle.toLowerCase()}`}>
            {cars.length === 0 ? <EmptyState title={`Nessun ${labels.vehicle.toLowerCase()} registrato`} /> : (
              <div className="space-y-3">
                {cars.map((car) => {
                  const hasProblems = components.some((c) => c.car_id === car.id && componentSeverity(c) >= 2);
                  return (
                    <div key={car.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div>
                        <div className="font-bold text-neutral-900">{car.name}</div>
                        <div className="mt-1 text-sm text-neutral-500">{Number(car.hours || 0).toFixed(1)} h</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge label={hasProblems ? "Da verificare" : "Pronto"} tone={hasProblems ? "yellow" : "green"} />
                        <Link href="/cars" className="text-sm font-semibold text-neutral-600">Apri</Link>
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
            {urgentComponents.length + warningComponents.length === 0 ? <EmptyState title="Nessuna criticità componente" /> : (
              <div className="space-y-3">
                {[...urgentComponents, ...warningComponents].slice(0, 8).map((row) => (
                  <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-neutral-900">{row.type} · {row.identifier}</div>
                        <div className="mt-1 text-sm text-neutral-500">{row.car_id ? `Montato su mezzo collegato` : "Attualmente smontato"}</div>
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
            {upcomingEvents.length === 0 ? <EmptyState title="Nessun evento imminente" /> : (
              <div className="space-y-3">
                {upcomingEvents.map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div>
                      <div className="font-bold text-neutral-900">{row.name}</div>
                      <div className="mt-1 text-sm text-neutral-500">{formatDate(row.date)} · {row.circuit_id?.name || "Circuito da definire"}</div>
                    </div>
                    <Link href={`/calendar/${row.id}`} className="text-sm font-semibold text-neutral-600">Apri</Link>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "maintenances_open":
        return (
          <SectionCard key={code} title={label} subtitle="Interventi che richiedono attenzione">
            {openMaintenances.length === 0 ? <EmptyState title="Nessuna manutenzione aperta" /> : (
              <div className="space-y-3">
                {openMaintenances.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-neutral-900">{row.type || "Manutenzione"}</div>
                        <div className="mt-1 text-sm text-neutral-500">{row.car_id?.name || row.component_id?.identifier || "Elemento non specificato"} · {formatDate(row.date)}</div>
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
                  <div key={row.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div>
                      <div className="font-bold text-neutral-900">{row.driver_id?.first_name} {row.driver_id?.last_name}</div>
                      <div className="mt-1 text-sm text-neutral-500">Scadenza {formatDate(row.expires_at)}</div>
                    </div>
                    <StatusBadge label="Da verificare" tone="yellow" />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      case "inventory_low_stock":
        return (
          <SectionCard key={code} title={label} subtitle="Articoli sotto la scorta minima">
            {lowStock.length === 0 ? <EmptyState title="Nessun articolo sotto soglia" /> : (
              <div className="space-y-3">
                {lowStock.map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div>
                      <div className="font-bold text-neutral-900">{row.name}</div>
                      <div className="mt-1 text-sm text-neutral-500">Disponibile {row.quantity} · Minima {row.minimum_quantity} · Impegnata {row.reserved_quantity}</div>
                    </div>
                    <StatusBadge label="Sotto soglia" tone="red" />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      default:
        return null;
    }
  }

  const effectiveWidgets = widgets.length > 0 ? widgets : [
    { widget_code: "cars_ready", label: "Mezzi pronti", is_enabled: true, size: "md", order_index: 1 },
    { widget_code: "components_alerts", label: "Componenti critici", is_enabled: true, size: "md", order_index: 2 },
    { widget_code: "upcoming_events", label: "Prossimi eventi", is_enabled: true, size: "md", order_index: 3 },
    { widget_code: "maintenances_open", label: "Manutenzioni aperte", is_enabled: true, size: "md", order_index: 4 },
  ];

  if (loading) {
    return <div className={`p-6 text-neutral-500 ${audiowide.className}`}>Caricamento dashboard...</div>;
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title={settings?.team_name || "Dashboard"}
        subtitle="Centro di comando operativo: prontezza mezzi, criticità e prossime azioni"
        icon={<ClipboardList size={22} />}
        actions={<Link href="/settings" className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Configura dashboard</Link>}
      />

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {effectiveWidgets.map((widget) => renderWidget(widget.widget_code, widget.label)).filter(Boolean)}
      </div>

      <SectionCard title="Stato sintetico piattaforma" subtitle="Lettura rapida ad alto valore per team e management">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <QuickPill icon={<CarFront size={16} />} label={`${labels.vehicle} registrati`} value={String(cars.length)} />
          <QuickPill icon={<Wrench size={16} />} label="Componenti con warning" value={String(warningComponents.length)} />
          <QuickPill icon={<Users size={16} />} label={`${labels.driver} con documenti in scadenza`} value={String(expiringDriverDocs.length)} />
          <QuickPill icon={<Package size={16} />} label="Magazzino sotto soglia" value={String(lowStock.length)} />
        </div>
      </SectionCard>
    </div>
  );
}

function QuickPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-500">{icon}{label}</div>
      <div className="mt-2 text-2xl font-bold text-neutral-900">{value}</div>
    </div>
  );
}
