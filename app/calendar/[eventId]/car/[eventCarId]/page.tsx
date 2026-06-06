"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Fuel,
  Gauge,
  Info,
  PlusCircle,
  Settings2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import { UiField, uiInputClassName, uiSelectClassName, uiTextareaClassName } from "@/components/UiField";
import { normalizeOptions } from "@/lib/controlCenter";

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatLapTime(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";

  const totalMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }

  return `${seconds}.${String(millis).padStart(3, "0")}`;
}

function displayNumber(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}${suffix}`;
}

function round1(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function trackConditionLabel(value: string | null | undefined) {
  return value === "dry"
    ? "Asciutta"
    : value === "damp"
    ? "Umida"
    : value === "wet"
    ? "Bagnata"
    : value === "mixed"
    ? "Mista"
    : "—";
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

function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const className =
    tone === "danger"
      ? "border-red-400/35 bg-red-400/10 text-red-200"
      : tone === "warning"
      ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
      : tone === "success"
      ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
      : "border-white/20 bg-white/[0.08] text-[var(--text-secondary)]";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.06em] ${className}`}>{label}</span>;
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="race-mini-panel p-4">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="technical-number mt-2 text-lg font-black text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function ActionTile({
  href,
  title,
  description,
  icon,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="race-card-grid p-5 transition hover:-translate-y-0.5 hover:border-[rgba(var(--brand-accent-rgb),0.28)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--brand-accent-soft)", color: "var(--brand-accent)" }}
        >
          {icon}
        </div>
        {badge ? <StatusChip label={badge} /> : null}
      </div>
      <div className="mt-4 text-lg font-black text-[var(--text-primary)]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
    </Link>
  );
}

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const access = usePermissionAccess();
  const canViewEvents = access.hasPermission("events.view");
  const canEditEvents = access.hasPermission("events.edit", ["owner", "admin"]);

  const [eventCar, setEventCar] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [assignedDrivers, setAssignedDrivers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [turns, setTurns] = useState<any[]>([]);
  const [turnMetrics, setTurnMetrics] = useState<any[]>([]);
  const [setupFields, setSetupFields] = useState<any[]>([]);
  const [setupData, setSetupData] = useState<Record<string, any>>({});
  const [checklists, setChecklists] = useState<any[]>([]);
  const [checkData, setCheckData] = useState<Record<string, { status?: string; note?: string; value?: any }>>({});

  const [selectedDriver, setSelectedDriver] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  async function loadAll() {
    const ctx = await getCurrentTeamContext();

    const [
      eventCarRes,
      driversRes,
      assignedRes,
      sessionsRes,
      turnsRes,
      metricsRes,
      setupFieldsRes,
      setupDataRes,
      checklistGroupsRes,
      checklistItemsRes,
      checkDataRes,
    ] = await Promise.all([
      supabase
        .from("event_cars")
        .select("id,status,notes,event_id(id,name,date),car_id(id,name)")
        .eq("team_id", ctx.teamId)
        .eq("id", eventCarId)
        .single(),
      supabase
        .from("drivers")
        .select("id,first_name,last_name")
        .eq("team_id", ctx.teamId)
        .order("last_name", { ascending: true }),
      supabase
        .from("event_car_drivers")
        .select("id,role,driver_id(id,first_name,last_name)")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId),
      supabase
        .from("event_sessions")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_car_turns")
        .select(
          "id,event_session_id,driver_id,recorded_at,minutes,laps,fuel_start_liters,fuel_end_liters,notes,created_at"
        )
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("event_car_turn_metrics")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId),
      supabase
        .from("team_setup_fields")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("order_index", { ascending: true }),
      supabase
        .from("event_car_data")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .eq("section", "setup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("team_checklists")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("order_index", { ascending: true }),
      supabase
        .from("team_checklist_items")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("order_index", { ascending: true }),
      supabase
        .from("event_car_data")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .eq("section", "checkup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setEventCar(
      eventCarRes.data
        ? {
            ...eventCarRes.data,
            event_id: normalizeRelation(eventCarRes.data.event_id),
            car_id: normalizeRelation(eventCarRes.data.car_id),
          }
        : null
    );
    setDrivers(driversRes.data || []);
    setAssignedDrivers(
      (assignedRes.data || []).map((row: any) => ({
        ...row,
        driver_id: normalizeRelation(row.driver_id),
      }))
    );
    setSessions(sessionsRes.data || []);
    setTurns(turnsRes.data || []);
    setTurnMetrics(metricsRes.data || []);
    setSetupFields(setupFieldsRes.data || []);
    setSetupData((setupDataRes.data as any)?.data || {});

    const groups = checklistGroupsRes.data || [];
    const items = checklistItemsRes.data || [];
    setChecklists(
      groups.map((group: any) => ({
        ...group,
        items: items.filter((item: any) => item.checklist_id === group.id),
      }))
    );
    setCheckData((checkDataRes.data as any)?.data || {});
  }

  useEffect(() => {
    if (eventCarId && eventId && !access.loading && canViewEvents) {
      void loadAll();
    }
  }, [eventCarId, eventId, access.loading, canViewEvents]);

  const metricsMap = useMemo(() => {
    return new Map((turnMetrics || []).map((row: any) => [row.turn_id, row]));
  }, [turnMetrics]);

  const turnsWithMetrics = useMemo(() => {
    return turns.map((turn) => ({
      ...turn,
      metrics: metricsMap.get(turn.id) || null,
    }));
  }, [turns, metricsMap]);

  const fuelSummary = useMemo(() => {
    const totalUsed = turnsWithMetrics.reduce(
      (acc, row) =>
        acc +
        Math.max(
          0,
          Number(row.fuel_start_liters || 0) - Number(row.fuel_end_liters || 0)
        ),
      0
    );
    const totalLaps = turnsWithMetrics.reduce((acc, row) => acc + Number(row.laps || 0), 0);
    const totalMinutes = turnsWithMetrics.reduce((acc, row) => acc + Number(row.minutes || 0), 0);
    return {
      totalUsed,
      totalLaps,
      totalMinutes,
      perLap: totalLaps > 0 ? totalUsed / totalLaps : 0,
      perMinute: totalMinutes > 0 ? totalUsed / totalMinutes : 0,
    };
  }, [turnsWithMetrics]);

  const bestLap = useMemo(() => {
    const values = turnsWithMetrics
      .map((row: any) => row.metrics?.best_lap_ms)
      .filter((value: any) => value != null && Number.isFinite(value));
    return values.length ? Math.min(...values) : null;
  }, [turnsWithMetrics]);

  const maxWater = useMemo(() => {
    const values = turnsWithMetrics
      .map((row: any) => row.metrics?.max_water_temp_c)
      .filter((value: any) => value != null && Number.isFinite(value));
    return values.length ? Math.max(...values) : null;
  }, [turnsWithMetrics]);

  const maxOil = useMemo(() => {
    const values = turnsWithMetrics
      .map((row: any) => row.metrics?.max_oil_temp_c)
      .filter((value: any) => value != null && Number.isFinite(value));
    return values.length ? Math.max(...values) : null;
  }, [turnsWithMetrics]);

  const setupFilled = useMemo(
    () => Object.values(setupData || {}).filter((value) => String(value || "").trim()).length,
    [setupData]
  );

  const checklistSummary = useMemo(() => {
    const rows = Object.values(checkData || {}) as Array<{ status?: string; note?: string; value?: any }>;
    return {
      total: rows.length,
      problems: rows.filter((row) => row.status === "problem").length,
      checks: rows.filter((row) => row.status === "check").length,
      ok: rows.filter((row) => row.status === "ok").length,
    };
  }, [checkData]);

  const recentTurns = useMemo(() => turnsWithMetrics.slice(0, 5), [turnsWithMetrics]);

  const stats: StatItem[] = [
    {
      label: "Piloti associati",
      value: String(assignedDrivers.length),
      icon: <Users size={18} />,
      helper: "Driver disponibili per il mezzo in evento",
    },
    {
      label: "Turni tecnici",
      value: String(turnsWithMetrics.length),
      icon: <Gauge size={18} />,
      helper: `${fuelSummary.totalLaps} giri • ${fuelSummary.totalMinutes} minuti`,
    },
    {
      label: "Fuel evento",
      value: fuelSummary.perLap > 0 ? `${fuelSummary.perLap.toFixed(2)} L/giro` : "—",
      icon: <Fuel size={18} />,
      helper: `${fuelSummary.totalUsed.toFixed(1)} L consumati`,
    },
    {
      label: "Best lap / temp max",
      value: formatLapTime(bestLap),
      icon: <ShieldAlert size={18} />,
      helper: `Acqua ${displayNumber(maxWater, "°C")} • Olio ${displayNumber(maxOil, "°C")}`,
    },
  ];

  async function addDriver() {
    if (!canEditEvents || !selectedDriver) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase.from("event_car_drivers").insert([
      {
        team_id: ctx.teamId,
        event_car_id: eventCarId,
        driver_id: selectedDriver,
        role: "primary",
      },
    ]);
    if (error) {
      setFeedback({ type: "error", message: error.message });
      return;
    }
    setSelectedDriver("");
    await loadAll();
    setFeedback({ type: "success", message: "Pilota associato correttamente all'evento." });
  }

  async function saveSetup() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase
      .from("event_car_data")
      .insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "setup", data: setupData }]);

    if (error) setFeedback({ type: "error", message: error.message });
    else setFeedback({ type: "success", message: "Setup salvato correttamente." });
  }

  async function saveCheckup() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase
      .from("event_car_data")
      .insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "checkup", data: checkData }]);

    if (error) setFeedback({ type: "error", message: error.message });
    else setFeedback({ type: "success", message: "Check-up tecnico salvato." });
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Console mezzo"
        subtitle="Dashboard operativa mezzo in evento"
        icon={<CalendarDays size={22} />}
        state="loading"
      />
    );
  }
  if (access.error) {
    return (
      <PagePermissionState
        title="Console mezzo"
        subtitle="Dashboard operativa mezzo in evento"
        icon={<CalendarDays size={22} />}
        state="error"
        message={access.error}
      />
    );
  }
  if (!canViewEvents) {
    return (
      <PagePermissionState
        title="Console mezzo"
        subtitle="Dashboard operativa mezzo in evento"
        icon={<CalendarDays size={22} />}
        state="denied"
        message="Il tuo ruolo non può aprire la console mezzo dell'evento."
      />
    );
  }
  if (!eventCar) {
    return (
      <div className={`flex flex-col gap-6 p-6`}>
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] px-6 py-5 text-sm text-[var(--text-secondary)] shadow-sm">
          Caricamento console mezzo...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title={`${eventCar.car_id?.name || "Mezzo"} · ${eventCar.event_id?.name || "Evento"}`}
        subtitle="Dashboard operativa del mezzo: riepilogo rapido, hub tecnico, piloti, setup e check-up. I turni dettagliati vivono nella console specializzata."
        icon={<CalendarDays size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/calendar/${eventId}/car/${eventCarId}/turns`}
              className="rounded-xl px-4 py-2 font-bold"
              style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }}
            >
              Console turni tecnici
            </Link>
            <Link
              href={`/calendar/${eventId}`}
              className="race-action-secondary px-4 py-2"
            >
              <ArrowLeft size={16} className="mr-2 inline" />
              Evento
            </Link>
          </div>
        }
      />

      {!canEditEvents ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questa console mezzo.
        </div>
      ) : null}

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Questa pagina non deve più essere un muro di dati: qui trovi regia, riepilogo e accessi rapidi."
      >
        <InfoBlock>
          La console mezzo ora è la pagina regia del weekend: qui controlli rapidamente lo stato del mezzo,
          i piloti, il setup e il check-up. Per la raccolta dati completa di turni, fuel e rilevazioni tecniche
          usa la <strong>Console turni tecnici</strong>, così la lettura resta ordinata e immediata.
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title="Hub operativo"
        subtitle="Accedi subito alle aree davvero importanti del mezzo senza appesantire la console principale."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionTile
            href={`/calendar/${eventId}/car/${eventCarId}/turns`}
            title="Turni tecnici"
            description="Timeline completa, fuel, pressioni, temperature gomme, target e note tecniche."
            icon={<Gauge size={20} />}
            badge={`${turnsWithMetrics.length} turni`}
          />
          <ActionTile
            href="#setup-section"
            title="Setup"
            description="Controlla e aggiorna i campi setup configurati dal Control Center del team."
            icon={<Settings2 size={20} />}
            badge={`${setupFilled} campi`}
          />
          <ActionTile
            href="#checkup-section"
            title="Check-up tecnico"
            description="Verifica esiti, note e anomalie della checklist tecnica del mezzo in evento."
            icon={<ClipboardCheck size={20} />}
            badge={checklistSummary.problems > 0 ? `${checklistSummary.problems} problemi` : `${checklistSummary.checks} da controllare`}
          />
          <ActionTile
            href={`/calendar/${eventId}/car/${eventCarId}/turns`}
            title="Fuel & performance"
            description="Consulta rapidamente consumo medio, best lap e temperature massime giornata."
            icon={<Fuel size={20} />}
            badge={fuelSummary.perLap > 0 ? `${fuelSummary.perLap.toFixed(2)} L/giro` : "—"}
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Piloti associati"
          subtitle="Associa qui un pilota già registrato nell'anagrafica Piloti e rendilo disponibile per il mezzo in evento."
        >
          {canEditEvents ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px]">
              <UiField label="Pilota registrato">
                <select
                  className={uiInputClassName}
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                >
                  <option value="">Seleziona pilota già registrato</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </option>
                  ))}
                </select>
              </UiField>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addDriver}
                  disabled={!selectedDriver}
                  className={`w-full rounded-xl px-4 py-2 font-bold transition ${
                    selectedDriver
                      ? "btn-primary"
                      : "cursor-not-allowed border border-white/10 bg-white/[0.06] text-[var(--text-muted)]"
                  }`}
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Associa pilota
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {assignedDrivers.length === 0 ? (
              <EmptyState
                title="Nessun pilota associato"
                description="Associa almeno un pilota per poterlo usare nelle sessioni del mezzo."
              />
            ) : (
              assignedDrivers.map((row: any) => (
                <div
                  key={row.id}
                  className="data-row p-4"
                >
                  <div className="font-bold text-[var(--text-primary)]">
                    {row.driver_id?.first_name} {row.driver_id?.last_name}
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">Ruolo {row.role}</div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Ultimi turni tecnici"
          subtitle="Vista rapida della giornata: pochi dati ma leggibili, con accesso diretto alla console specializzata."
          actions={
            <Link
              href={`/calendar/${eventId}/car/${eventCarId}/turns`}
              className="race-action-secondary px-4 py-2"
            >
              Apri dettaglio completo
            </Link>
          }
        >
          {recentTurns.length === 0 ? (
            <EmptyState
              title="Nessun turno registrato"
              description="Apri la Console turni tecnici per inserire il primo turno del mezzo."
            />
          ) : (
            <div className="space-y-3">
              {recentTurns.map((turn: any) => {
                const session = sessions.find((row) => row.id === turn.event_session_id);
                const assigned = assignedDrivers.find((row: any) => row.driver_id?.id === turn.driver_id);
                const metrics = turn.metrics;
                const fuelUsed =
                  turn.fuel_start_liters != null && turn.fuel_end_liters != null
                    ? round1(Math.max(0, Number(turn.fuel_start_liters) - Number(turn.fuel_end_liters)))
                    : null;
                const warnings = [
                  metrics?.max_water_temp_c && metrics?.target_water_temp_c && metrics.max_water_temp_c > metrics.target_water_temp_c
                    ? { label: `Acqua ${metrics.max_water_temp_c}°C`, tone: "warning" as const }
                    : null,
                  metrics?.max_oil_temp_c && metrics?.target_oil_temp_c && metrics.max_oil_temp_c > metrics.target_oil_temp_c
                    ? { label: `Olio ${metrics.max_oil_temp_c}°C`, tone: "warning" as const }
                    : null,
                ].filter(Boolean) as Array<{ label: string; tone: "warning" }>;

                return (
                  <div key={turn.id} className="data-row p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {assigned?.driver_id
                          ? `${assigned.driver_id.first_name} ${assigned.driver_id.last_name}`
                          : "Pilota non assegnato"}
                      </div>
                      {session ? <StatusChip label={session.name} /> : null}
                      <StatusChip label={trackConditionLabel(metrics?.track_condition)} />
                    </div>

                    <div className="mt-2 text-sm text-[var(--text-secondary)]">
                      {turn.recorded_at ? new Date(turn.recorded_at).toLocaleString("it-IT") : "Data non disponibile"}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <SummaryBox label="Best lap" value={formatLapTime(metrics?.best_lap_ms)} />
                      <SummaryBox label="Fuel usato" value={fuelUsed != null ? `${fuelUsed} L` : "—"} />
                      <SummaryBox label="Acqua max" value={displayNumber(metrics?.max_water_temp_c, "°C")} />
                      <SummaryBox label="Olio max" value={displayNumber(metrics?.max_oil_temp_c, "°C")} />
                    </div>

                    {warnings.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {warnings.map((warning) => (
                          <StatusChip key={warning.label} label={warning.label} tone={warning.tone} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Setup dinamico"
          subtitle="Campi configurabili dal Control Center, compilabili qui senza uscire dalla console mezzo."
          className="scroll-mt-24"
        >
          <div id="setup-section" className="space-y-0" />
          {setupFields.length === 0 ? (
            <EmptyState
              title="Nessun campo setup configurato"
              description="Configura i campi setup dal Control Center per vederli qui."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {setupFields.map((field: any) => {
                const fieldType = field.field_type || "text";
                const currentValue = setupData[field.field_key] ?? "";
                const options = normalizeOptions(field.options);

                return (
                  <UiField key={field.id} label={`${field.label}${field.unit ? ` (${field.unit})` : ""}`}>
                    {fieldType === "textarea" ? (
                      <textarea
                        disabled={!canEditEvents}
                        className={`${uiTextareaClassName} ${!canEditEvents ? "opacity-70" : ""}`}
                        value={currentValue || ""}
                        onChange={(e) =>
                          setSetupData({ ...setupData, [field.field_key]: e.target.value })
                        }
                      />
                    ) : fieldType === "select" ? (
                      <select
                        disabled={!canEditEvents}
                        className={`${uiSelectClassName} ${!canEditEvents ? "opacity-70" : ""}`}
                        value={currentValue || ""}
                        onChange={(e) =>
                          setSetupData({ ...setupData, [field.field_key]: e.target.value })
                        }
                      >
                        <option value="">Seleziona...</option>
                        {options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : fieldType === "checkbox" ? (
                      <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-[var(--text-primary)]">
                        <span>{field.label}</span>
                        <input
                          type="checkbox"
                          disabled={!canEditEvents}
                          checked={Boolean(currentValue)}
                          onChange={(e) => setSetupData({ ...setupData, [field.field_key]: e.target.checked })}
                        />
                      </label>
                    ) : (
                      <input
                        disabled={!canEditEvents}
                        type={fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text"}
                        className={`${uiInputClassName} ${!canEditEvents ? "opacity-70" : ""}`}
                        value={currentValue || ""}
                        onChange={(e) =>
                          setSetupData({ ...setupData, [field.field_key]: e.target.value })
                        }
                      />
                    )}
                  </UiField>
                );
              })}
            </div>
          )}
          {canEditEvents ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveSetup}
                className="rounded-xl px-4 py-2 font-bold"
                style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }}
              >
                <Settings2 size={16} className="mr-2 inline" />
                Salva setup
              </button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Check-up tecnico"
          subtitle="Checklist tecnica del mezzo: esiti, note e anomalie restano leggibili anche nella vista console."
          className="scroll-mt-24"
        >
          <div id="checkup-section" className="mb-4 flex flex-wrap gap-2">
            <StatusChip label={`${checklistSummary.ok} OK`} tone="success" />
            <StatusChip label={`${checklistSummary.checks} da controllare`} tone="warning" />
            <StatusChip label={`${checklistSummary.problems} problemi`} tone={checklistSummary.problems > 0 ? "danger" : "neutral"} />
          </div>

          {checklists.length === 0 ? (
            <EmptyState
              title="Nessuna checklist configurata"
              description="Configura i gruppi di check-up dal Control Center."
            />
          ) : (
            <div className="space-y-4">
              {checklists.map((group: any) => (
                <div
                  key={group.id}
                  className="data-row p-4"
                >
                  <div className="font-bold text-[var(--text-primary)]">{group.name}</div>
                  <div className="mt-3 space-y-3">
                    {group.items.map((item: any) => {
                      const inputType = item.input_type || "status";
                      const itemData = checkData[item.id] || { status: "ok", note: "", value: "" };
                      const options = normalizeOptions(item.options);

                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]"
                        >
                          <div>
                            <div className="text-sm font-semibold text-[var(--text-primary)]">
                              {item.label}{item.is_required ? " *" : ""}
                            </div>
                            <textarea
                              disabled={!canEditEvents}
                              className={`${uiTextareaClassName} mt-2 ${!canEditEvents ? "opacity-70" : ""}`}
                              placeholder="Nota tecnica"
                              value={itemData.note || ""}
                              onChange={(e) =>
                                setCheckData({
                                  ...checkData,
                                  [item.id]: {
                                    ...itemData,
                                    status: itemData.status || "ok",
                                    note: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>

                          {inputType === "status" ? (
                            <UiField label="Esito">
                              <select
                                disabled={!canEditEvents}
                                className={`${uiSelectClassName} ${!canEditEvents ? "opacity-70" : ""}`}
                                value={itemData.status || "ok"}
                                onChange={(e) =>
                                  setCheckData({
                                    ...checkData,
                                    [item.id]: {
                                      ...itemData,
                                      status: e.target.value,
                                      note: itemData.note || "",
                                    },
                                  })
                                }
                              >
                                <option value="ok">OK</option>
                                <option value="check">Da controllare</option>
                                <option value="problem">Problema</option>
                              </select>
                            </UiField>
                          ) : inputType === "checkbox" ? (
                            <UiField label="Conferma">
                              <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-[var(--text-primary)]">
                                <span>Completato</span>
                                <input
                                  type="checkbox"
                                  disabled={!canEditEvents}
                                  checked={Boolean(itemData.value)}
                                  onChange={(e) => setCheckData({ ...checkData, [item.id]: { ...itemData, value: e.target.checked } })}
                                />
                              </label>
                            </UiField>
                          ) : inputType === "select" ? (
                            <UiField label="Valore">
                              <select
                                disabled={!canEditEvents}
                                className={`${uiSelectClassName} ${!canEditEvents ? "opacity-70" : ""}`}
                                value={itemData.value || ""}
                                onChange={(e) => setCheckData({ ...checkData, [item.id]: { ...itemData, value: e.target.value } })}
                              >
                                <option value="">Seleziona...</option>
                                {options.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </UiField>
                          ) : (
                            <UiField label="Valore">
                              <input
                                disabled={!canEditEvents}
                                type={inputType === "number" ? "number" : inputType === "date" ? "date" : "text"}
                                className={`${uiInputClassName} ${!canEditEvents ? "opacity-70" : ""}`}
                                value={itemData.value || ""}
                                onChange={(e) => setCheckData({ ...checkData, [item.id]: { ...itemData, value: e.target.value } })}
                              />
                            </UiField>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {canEditEvents ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveCheckup}
                className="rounded-xl px-4 py-2 font-bold"
                style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }}
              >
                <ClipboardCheck size={16} className="mr-2 inline" />
                Salva check-up
              </button>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
