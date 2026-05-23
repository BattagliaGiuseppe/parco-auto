"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Edit2,
  Flame,
  Gauge,
  Info,
  Printer,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import FormStatusBanner from "@/components/FormStatusBanner";
import InlineConfirmButton from "@/components/InlineConfirmButton";
import PagePermissionState from "@/components/PagePermissionState";
import { UiField, uiInputClassName, uiTextareaClassName } from "@/components/UiField";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type EventInfo = {
  id: string;
  name: string | null;
  date: string | null;
};

type CarInfo = {
  id: string;
  name: string | null;
};

type DriverOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type AssignedDriverRow = {
  id: string;
  role: string | null;
  driver_id: DriverOption | DriverOption[] | null;
};

type SessionRow = {
  id: string;
  name: string;
  starts_at: string | null;
  created_at?: string | null;
};

type TurnBaseRow = {
  id: string;
  team_id?: string;
  event_car_id: string;
  event_session_id: string | null;
  driver_id: string | null;
  recorded_at: string | null;
  minutes: number | null;
  laps: number | null;
  fuel_start_liters: number | null;
  fuel_end_liters: number | null;
  notes: string | null;
  created_at: string | null;
};

type TurnMetricsRow = {
  id: string;
  team_id: string;
  turn_id: string;
  event_id: string | null;
  event_car_id: string;
  track_condition: string | null;
  pre_air_temp_c: number | null;
  pre_track_temp_c: number | null;
  post_air_temp_c: number | null;
  post_track_temp_c: number | null;
  pre_pressure_fl: number | null;
  pre_pressure_fr: number | null;
  pre_pressure_rl: number | null;
  pre_pressure_rr: number | null;
  post_pressure_fl: number | null;
  post_pressure_fr: number | null;
  post_pressure_rl: number | null;
  post_pressure_rr: number | null;
  post_tyre_temp_fl: number | null;
  post_tyre_temp_fr: number | null;
  post_tyre_temp_rl: number | null;
  post_tyre_temp_rr: number | null;
  air_opening_cm: number | null;
  oil_opening_cm: number | null;
  max_water_temp_c: number | null;
  max_oil_temp_c: number | null;
  best_lap_ms: number | null;
  avg_lap_ms: number | null;
  target_post_pressure_fl: number | null;
  target_post_pressure_fr: number | null;
  target_post_pressure_rl: number | null;
  target_post_pressure_rr: number | null;
  target_water_temp_c: number | null;
  target_oil_temp_c: number | null;
  technical_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TurnRow = TurnBaseRow & {
  metrics: TurnMetricsRow | null;
};

type TurnForm = {
  event_session_id: string;
  driver_id: string;
  recorded_at: string;
  minutes: string;
  laps: string;
  best_lap: string;
  avg_lap: string;
  fuel_start_liters: string;
  fuel_end_liters: string;
  notes: string;
  track_condition: string;
  pre_air_temp_c: string;
  pre_track_temp_c: string;
  post_air_temp_c: string;
  post_track_temp_c: string;
  pre_pressure_fl: string;
  pre_pressure_fr: string;
  pre_pressure_rl: string;
  pre_pressure_rr: string;
  post_pressure_fl: string;
  post_pressure_fr: string;
  post_pressure_rl: string;
  post_pressure_rr: string;
  post_tyre_temp_fl: string;
  post_tyre_temp_fr: string;
  post_tyre_temp_rl: string;
  post_tyre_temp_rr: string;
  air_opening_cm: string;
  oil_opening_cm: string;
  max_water_temp_c: string;
  max_oil_temp_c: string;
  target_post_pressure_fl: string;
  target_post_pressure_fr: string;
  target_post_pressure_rl: string;
  target_post_pressure_rr: string;
  target_water_temp_c: string;
  target_oil_temp_c: string;
  technical_notes: string;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Data non impostata";
  return new Date(value).toLocaleString("it-IT");
}

function toInputValue(value: number | string | null | undefined) {
  if (value == null) return "";
  return String(value);
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseLapTimeToMs(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  const safe = raw.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(safe)) {
    return Math.round(Number(safe) * 1000);
  }

  const minutesMatch = safe.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!minutesMatch) return null;

  const minutes = Number(minutesMatch[1]);
  const seconds = Number(minutesMatch[2]);
  const millis = Number((minutesMatch[3] || "0").padEnd(3, "0"));

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
    return null;
  }

  return minutes * 60000 + seconds * 1000 + millis;
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

function buildDefaultForm(): TurnForm {
  return {
    event_session_id: "",
    driver_id: "",
    recorded_at: toDateTimeLocal(new Date()),
    minutes: "",
    laps: "",
    best_lap: "",
    avg_lap: "",
    fuel_start_liters: "",
    fuel_end_liters: "",
    notes: "",
    track_condition: "dry",
    pre_air_temp_c: "",
    pre_track_temp_c: "",
    post_air_temp_c: "",
    post_track_temp_c: "",
    pre_pressure_fl: "",
    pre_pressure_fr: "",
    pre_pressure_rl: "",
    pre_pressure_rr: "",
    post_pressure_fl: "",
    post_pressure_fr: "",
    post_pressure_rl: "",
    post_pressure_rr: "",
    post_tyre_temp_fl: "",
    post_tyre_temp_fr: "",
    post_tyre_temp_rl: "",
    post_tyre_temp_rr: "",
    air_opening_cm: "",
    oil_opening_cm: "",
    max_water_temp_c: "",
    max_oil_temp_c: "",
    target_post_pressure_fl: "",
    target_post_pressure_fr: "",
    target_post_pressure_rl: "",
    target_post_pressure_rr: "",
    target_water_temp_c: "",
    target_oil_temp_c: "",
    technical_notes: "",
  };
}

function buildFormFromTurn(turn: TurnRow): TurnForm {
  const metrics = turn.metrics;
  return {
    event_session_id: turn.event_session_id ?? "",
    driver_id: turn.driver_id ?? "",
    recorded_at: turn.recorded_at
      ? toDateTimeLocal(new Date(turn.recorded_at))
      : toDateTimeLocal(new Date()),
    minutes: toInputValue(turn.minutes),
    laps: toInputValue(turn.laps),
    best_lap: metrics?.best_lap_ms ? formatLapTime(metrics.best_lap_ms) : "",
    avg_lap: metrics?.avg_lap_ms ? formatLapTime(metrics.avg_lap_ms) : "",
    fuel_start_liters: toInputValue(turn.fuel_start_liters),
    fuel_end_liters: toInputValue(turn.fuel_end_liters),
    notes: turn.notes ?? "",
    track_condition: metrics?.track_condition ?? "dry",
    pre_air_temp_c: toInputValue(metrics?.pre_air_temp_c),
    pre_track_temp_c: toInputValue(metrics?.pre_track_temp_c),
    post_air_temp_c: toInputValue(metrics?.post_air_temp_c),
    post_track_temp_c: toInputValue(metrics?.post_track_temp_c),
    pre_pressure_fl: toInputValue(metrics?.pre_pressure_fl),
    pre_pressure_fr: toInputValue(metrics?.pre_pressure_fr),
    pre_pressure_rl: toInputValue(metrics?.pre_pressure_rl),
    pre_pressure_rr: toInputValue(metrics?.pre_pressure_rr),
    post_pressure_fl: toInputValue(metrics?.post_pressure_fl),
    post_pressure_fr: toInputValue(metrics?.post_pressure_fr),
    post_pressure_rl: toInputValue(metrics?.post_pressure_rl),
    post_pressure_rr: toInputValue(metrics?.post_pressure_rr),
    post_tyre_temp_fl: toInputValue(metrics?.post_tyre_temp_fl),
    post_tyre_temp_fr: toInputValue(metrics?.post_tyre_temp_fr),
    post_tyre_temp_rl: toInputValue(metrics?.post_tyre_temp_rl),
    post_tyre_temp_rr: toInputValue(metrics?.post_tyre_temp_rr),
    air_opening_cm: toInputValue(metrics?.air_opening_cm),
    oil_opening_cm: toInputValue(metrics?.oil_opening_cm),
    max_water_temp_c: toInputValue(metrics?.max_water_temp_c),
    max_oil_temp_c: toInputValue(metrics?.max_oil_temp_c),
    target_post_pressure_fl: toInputValue(metrics?.target_post_pressure_fl),
    target_post_pressure_fr: toInputValue(metrics?.target_post_pressure_fr),
    target_post_pressure_rl: toInputValue(metrics?.target_post_pressure_rl),
    target_post_pressure_rr: toInputValue(metrics?.target_post_pressure_rr),
    target_water_temp_c: toInputValue(metrics?.target_water_temp_c),
    target_oil_temp_c: toInputValue(metrics?.target_oil_temp_c),
    technical_notes: metrics?.technical_notes ?? "",
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

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
      <div className="mb-4">
        <div className="text-base font-bold text-[var(--text-primary)]">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function WheelGrid({
  title,
  hint,
  values,
  onChange,
  placeholders,
}: {
  title: string;
  hint?: string;
  values: { fl: string; fr: string; rl: string; rr: string };
  onChange: (key: "fl" | "fr" | "rl" | "rr", value: string) => void;
  placeholders?: { fl?: string; fr?: string; rl?: string; rr?: string };
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      {hint ? <div className="mb-3 text-xs text-[var(--text-secondary)]">{hint}</div> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(["fl", "fr", "rl", "rr"] as const).map((key) => (
          <UiField key={key} label={key.toUpperCase()}>
            <input
              type="number"
              step="0.01"
              value={values[key]}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={placeholders?.[key] || (key === "fl" || key === "fr" ? "Es. 1.20" : "Es. 1.18")}
              className={uiInputClassName}
            />
          </UiField>
        ))}
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
      ? "bg-red-100 text-red-700"
      : tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : tone === "success"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-neutral-100 text-neutral-700";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

export default function EventCarTurnsPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const access = usePermissionAccess();
  const canViewEvents = access.hasPermission("events.view");
  const canEditEvents = access.hasPermission("events.edit", ["owner", "admin"]);

  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [carInfo, setCarInfo] = useState<CarInfo | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [assignedDrivers, setAssignedDrivers] = useState<DriverOption[]>([]);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [form, setForm] = useState<TurnForm>(buildDefaultForm());
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  async function fetchAll() {
    setLoading(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();

      const [eventRes, eventCarRes, sessionsRes, driversRes, assignedRes, turnsRes, metricsRes] =
        await Promise.all([
          supabase.from("events").select("id,name,date").eq("id", eventId).single(),
          supabase
            .from("event_cars")
            .select("id,event_id,car_id(id,name)")
            .eq("team_id", ctx.teamId)
            .eq("id", eventCarId)
            .single(),
          supabase
            .from("event_sessions")
            .select("id,name,starts_at,created_at")
            .eq("team_id", ctx.teamId)
            .eq("event_id", eventId)
            .order("created_at", { ascending: true }),
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
            .from("event_car_turns")
            .select(
              "id,team_id,event_car_id,event_session_id,driver_id,recorded_at,minutes,laps,fuel_start_liters,fuel_end_liters,notes,created_at"
            )
            .eq("team_id", ctx.teamId)
            .eq("event_car_id", eventCarId)
            .order("recorded_at", { ascending: true }),
          supabase
            .from("event_car_turn_metrics")
            .select("*")
            .eq("team_id", ctx.teamId)
            .eq("event_car_id", eventCarId),
        ]);

      const firstError =
        eventRes.error ||
        eventCarRes.error ||
        sessionsRes.error ||
        driversRes.error ||
        assignedRes.error ||
        turnsRes.error ||
        metricsRes.error;

      if (firstError) {
        setFeedback({
          type: "error",
          message: firstError.message || "Impossibile caricare i dati tecnici dei turni.",
        });
      }

      setEventInfo((eventRes.data as EventInfo | null) ?? null);
      const carRow = normalizeRelation(eventCarRes.data?.car_id as unknown as CarInfo | CarInfo[] | null);
      setCarInfo(carRow);
      setSessions((sessionsRes.data || []) as SessionRow[]);
      setDrivers((driversRes.data || []) as DriverOption[]);

      const assignedRows = (assignedRes.data || []) as AssignedDriverRow[];
      const assignedDriverList = assignedRows
        .map((row) => normalizeRelation(row.driver_id))
        .filter(Boolean) as DriverOption[];
      setAssignedDrivers(assignedDriverList);

      const metricsMap = new Map(
        ((metricsRes.data || []) as TurnMetricsRow[]).map((row) => [row.turn_id, row])
      );

      const turnRows = ((turnsRes.data || []) as TurnBaseRow[]).map((row) => ({
        ...row,
        metrics: metricsMap.get(row.id) ?? null,
      }));

      setTurns(turnRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewEvents) {
      void fetchAll();
    }
  }, [eventId, eventCarId, access.loading, canViewEvents]);

  const sessionMap = useMemo(() => new Map(sessions.map((row) => [row.id, row])), [sessions]);
  const availableDrivers = useMemo(() => (assignedDrivers.length > 0 ? assignedDrivers : drivers), [assignedDrivers, drivers]);
  const driverMap = useMemo(
    () =>
      new Map(
        availableDrivers.map((row) => [row.id, `${row.first_name || ""} ${row.last_name || ""}`.trim()])
      ),
    [availableDrivers]
  );

  const totalTurns = turns.length;
  const totalMinutes = useMemo(() => turns.reduce((sum, turn) => sum + Number(turn.minutes || 0), 0), [turns]);
  const totalLaps = useMemo(() => turns.reduce((sum, turn) => sum + Number(turn.laps || 0), 0), [turns]);
  const totalFuelUsed = useMemo(
    () =>
      round1(
        turns.reduce((sum, turn) => {
          const diff = Number(turn.fuel_start_liters || 0) - Number(turn.fuel_end_liters || 0);
          return sum + Math.max(0, diff);
        }, 0)
      ) ?? 0,
    [turns]
  );

  const stats: StatItem[] = [
    {
      label: "Turni registrati",
      value: String(totalTurns),
      icon: <CalendarClock size={18} />,
      helper: "Sessioni tecniche salvate",
    },
    {
      label: "Laps totali",
      value: String(totalLaps),
      icon: <Gauge size={18} />,
      helper: `${totalMinutes} minuti complessivi`,
    },
    {
      label: "Fuel consumato",
      value: `${displayNumber(totalFuelUsed, " L")}`,
      icon: <Flame size={18} />,
      helper:
        totalLaps > 0 ? `${displayNumber(round1(totalFuelUsed / totalLaps), " L/giro")}` : "Consumo medio non disponibile",
    },
    {
      label: "Ultimo turno",
      value:
        turns.length > 0
          ? formatDateTime(
              [...turns].sort(
                (a, b) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
              )[0]?.recorded_at || null
            )
          : "Nessun turno",
      icon: <UserRound size={18} />,
      helper: "Data e ora ultima sessione",
    },
  ];

  function resetForm() {
    setEditingTurnId(null);
    setForm(buildDefaultForm());
    setFeedback(null);
  }

  function patchForm<K extends keyof TurnForm>(key: K, value: TurnForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editTurn(turn: TurnRow) {
    setEditingTurnId(turn.id);
    setForm(buildFormFromTurn(turn));
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTurn() {
    setFeedback(null);

    if (!form.recorded_at.trim()) {
      setFeedback({ type: "error", message: "Inserisci data e ora del turno." });
      return;
    }

    const minutes = parseOptionalInteger(form.minutes);
    if (minutes == null || minutes <= 0) {
      setFeedback({ type: "error", message: "Inserisci una durata turno valida in minuti." });
      return;
    }

    const laps = parseOptionalInteger(form.laps);
    if (laps == null || laps < 0) {
      setFeedback({ type: "error", message: "Inserisci il numero giri del turno." });
      return;
    }

    const bestLapMs = parseLapTimeToMs(form.best_lap);
    if (form.best_lap.trim() && bestLapMs == null) {
      setFeedback({ type: "error", message: "Il formato del miglior giro non è valido. Usa ad esempio 1:42.350." });
      return;
    }

    const avgLapMs = parseLapTimeToMs(form.avg_lap);
    if (form.avg_lap.trim() && avgLapMs == null) {
      setFeedback({ type: "error", message: "Il formato del giro medio non è valido. Usa ad esempio 1:43.120." });
      return;
    }

    const fuelStart = parseOptionalNumber(form.fuel_start_liters);
    const fuelEnd = parseOptionalNumber(form.fuel_end_liters);
    if (fuelStart != null && fuelEnd != null && fuelEnd > fuelStart) {
      setFeedback({ type: "error", message: "Il carburante finale non può essere superiore al carburante iniziale in questo blocco base." });
      return;
    }

    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();

      const turnPayload = {
        team_id: ctx.teamId,
        event_car_id: eventCarId,
        event_session_id: form.event_session_id || null,
        driver_id: form.driver_id || null,
        recorded_at: new Date(form.recorded_at).toISOString(),
        minutes,
        laps,
        fuel_start_liters: fuelStart ?? 0,
        fuel_end_liters: fuelEnd ?? 0,
        notes: form.notes.trim() || null,
      };

      let turnId = editingTurnId;

      if (editingTurnId) {
        const { error } = await supabase.from("event_car_turns").update(turnPayload).eq("id", editingTurnId);
        if (error) throw error;
      } else {
        const insertPayload = {
          ...turnPayload,
          created_by_team_user_id: ctx.teamUserId,
        };
        const { data, error } = await supabase
          .from("event_car_turns")
          .insert([insertPayload])
          .select("id")
          .single();
        if (error) throw error;
        turnId = data.id;
      }

      const metricsPayload = {
        team_id: ctx.teamId,
        turn_id: turnId,
        event_id: eventId,
        event_car_id: eventCarId,
        track_condition: form.track_condition || null,
        pre_air_temp_c: parseOptionalNumber(form.pre_air_temp_c),
        pre_track_temp_c: parseOptionalNumber(form.pre_track_temp_c),
        post_air_temp_c: parseOptionalNumber(form.post_air_temp_c),
        post_track_temp_c: parseOptionalNumber(form.post_track_temp_c),
        pre_pressure_fl: parseOptionalNumber(form.pre_pressure_fl),
        pre_pressure_fr: parseOptionalNumber(form.pre_pressure_fr),
        pre_pressure_rl: parseOptionalNumber(form.pre_pressure_rl),
        pre_pressure_rr: parseOptionalNumber(form.pre_pressure_rr),
        post_pressure_fl: parseOptionalNumber(form.post_pressure_fl),
        post_pressure_fr: parseOptionalNumber(form.post_pressure_fr),
        post_pressure_rl: parseOptionalNumber(form.post_pressure_rl),
        post_pressure_rr: parseOptionalNumber(form.post_pressure_rr),
        post_tyre_temp_fl: parseOptionalNumber(form.post_tyre_temp_fl),
        post_tyre_temp_fr: parseOptionalNumber(form.post_tyre_temp_fr),
        post_tyre_temp_rl: parseOptionalNumber(form.post_tyre_temp_rl),
        post_tyre_temp_rr: parseOptionalNumber(form.post_tyre_temp_rr),
        air_opening_cm: parseOptionalNumber(form.air_opening_cm),
        oil_opening_cm: parseOptionalNumber(form.oil_opening_cm),
        max_water_temp_c: parseOptionalNumber(form.max_water_temp_c),
        max_oil_temp_c: parseOptionalNumber(form.max_oil_temp_c),
        best_lap_ms: bestLapMs,
        avg_lap_ms: avgLapMs,
        target_post_pressure_fl: parseOptionalNumber(form.target_post_pressure_fl),
        target_post_pressure_fr: parseOptionalNumber(form.target_post_pressure_fr),
        target_post_pressure_rl: parseOptionalNumber(form.target_post_pressure_rl),
        target_post_pressure_rr: parseOptionalNumber(form.target_post_pressure_rr),
        target_water_temp_c: parseOptionalNumber(form.target_water_temp_c),
        target_oil_temp_c: parseOptionalNumber(form.target_oil_temp_c),
        technical_notes: form.technical_notes.trim() || null,
      };

      const { error: metricsError } = await supabase
        .from("event_car_turn_metrics")
        .upsert(metricsPayload, { onConflict: "turn_id" });
      if (metricsError) throw metricsError;

      setFeedback({
        type: "success",
        message: editingTurnId ? "Turno tecnico aggiornato correttamente." : "Turno tecnico aggiunto correttamente.",
      });
      await fetchAll();
      resetForm();
    } catch (error: any) {
      setFeedback({ type: "error", message: error?.message || "Errore salvataggio turno tecnico." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTurn(turnId: string) {
    setFeedback(null);
    const { error } = await supabase.from("event_car_turns").delete().eq("id", turnId);
    if (error) {
      setFeedback({ type: "error", message: `Errore eliminazione turno: ${error.message}` });
      return;
    }
    setFeedback({ type: "success", message: "Turno eliminato correttamente." });
    if (editingTurnId === turnId) resetForm();
    await fetchAll();
  }

  if (access.loading) {
    return <PagePermissionState title="Turni tecnici" subtitle="Sessioni, fuel e rilevazioni tecniche del mezzo" icon={<Gauge size={20} />} state="loading" />;
  }
  if (access.error) {
    return <PagePermissionState title="Turni tecnici" subtitle="Sessioni, fuel e rilevazioni tecniche del mezzo" icon={<Gauge size={20} />} state="error" message={access.error} />;
  }
  if (!canViewEvents) {
    return <PagePermissionState title="Turni tecnici" subtitle="Sessioni, fuel e rilevazioni tecniche del mezzo" icon={<Gauge size={20} />} state="denied" message="Il tuo ruolo non ha accesso al modulo eventi / turni." />;
  }
  if (loading) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 text-sm text-[var(--text-secondary)] shadow-sm">
          Caricamento turni tecnici in corso...
        </div>
      </div>
    );
  }
  if (!eventInfo || !carInfo) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <FormStatusBanner type="error" message="Impossibile trovare i dati dell'evento o del mezzo selezionato." />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title={`Turni tecnici • ${carInfo.name ?? "Mezzo"}`}
        subtitle={`Evento: ${eventInfo.name ?? "Evento"}${eventInfo.date ? ` • ${new Date(eventInfo.date).toLocaleDateString("it-IT")}` : ""}`}
        icon={<Gauge size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]">
              <Printer size={16} className="mr-2 inline" />
              Stampa scheda
            </button>
            <Link href={`/calendar/${eventId}/car/${eventCarId}`} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]">
              <ArrowLeft size={16} className="mr-2 inline" />
              Console mezzo
            </Link>
          </div>
        }
      />

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard title="Lettura operativa" subtitle="Questa vista registra il turno come scheda tecnica completa, utile in pista e per confronti futuri.">
        <InfoBlock>
          In questo blocco puoi salvare condizioni pre-turno, rilevazioni post-turno, consumo fuel, tempi, target e note tecniche.
          La struttura è già pronta per statistiche, confronti tra turni simili e suggerimenti futuri basati sullo storico.
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title={editingTurnId ? "Modifica turno tecnico" : "Nuovo turno tecnico"}
        subtitle="Compila i dati base del turno e le rilevazioni tecniche di pre e post-sessione."
        actions={
          editingTurnId ? (
            <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]">
              Annulla modifica
            </button>
          ) : null
        }
      >
        <div className="space-y-6">
          <FormSection title="Dati base turno" subtitle="Sessione, pilota, durata, giri e dati carburante della sessione.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <UiField label="Data e ora turno">
                <input type="datetime-local" value={form.recorded_at} onChange={(e) => patchForm("recorded_at", e.target.value)} className={uiInputClassName} />
              </UiField>
              <UiField label="Sessione">
                <select value={form.event_session_id} onChange={(e) => patchForm("event_session_id", e.target.value)} className={uiInputClassName}>
                  <option value="">Nessuna sessione collegata</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                      {session.starts_at ? ` • ${new Date(session.starts_at).toLocaleString("it-IT")}` : ""}
                    </option>
                  ))}
                </select>
              </UiField>
              <UiField label="Pilota">
                <select value={form.driver_id} onChange={(e) => patchForm("driver_id", e.target.value)} className={uiInputClassName}>
                  <option value="">Seleziona pilota</option>
                  {availableDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </option>
                  ))}
                </select>
              </UiField>
              <UiField label="Condizione pista">
                <select value={form.track_condition} onChange={(e) => patchForm("track_condition", e.target.value)} className={uiInputClassName}>
                  <option value="dry">Asciutta</option>
                  <option value="damp">Umida</option>
                  <option value="wet">Bagnata</option>
                  <option value="mixed">Mista</option>
                </select>
              </UiField>
              <UiField label="Durata turno (min)">
                <input type="number" min="1" step="1" value={form.minutes} onChange={(e) => patchForm("minutes", e.target.value)} placeholder="Es. 20" className={uiInputClassName} />
              </UiField>
              <UiField label="Giri effettuati">
                <input type="number" min="0" step="1" value={form.laps} onChange={(e) => patchForm("laps", e.target.value)} placeholder="Es. 12" className={uiInputClassName} />
              </UiField>
              <UiField label="Miglior giro" hint="Formato consigliato 1:42.350">
                <input value={form.best_lap} onChange={(e) => patchForm("best_lap", e.target.value)} placeholder="Es. 1:42.350" className={uiInputClassName} />
              </UiField>
              <UiField label="Giro medio" hint="Formato consigliato 1:43.120">
                <input value={form.avg_lap} onChange={(e) => patchForm("avg_lap", e.target.value)} placeholder="Es. 1:43.120" className={uiInputClassName} />
              </UiField>
              <UiField label="Fuel pre-turno (L)">
                <input type="number" step="0.1" value={form.fuel_start_liters} onChange={(e) => patchForm("fuel_start_liters", e.target.value)} placeholder="Es. 18.5" className={uiInputClassName} />
              </UiField>
              <UiField label="Fuel post-turno (L)">
                <input type="number" step="0.1" value={form.fuel_end_liters} onChange={(e) => patchForm("fuel_end_liters", e.target.value)} placeholder="Es. 10.8" className={uiInputClassName} />
              </UiField>
            </div>
            <div className="mt-4">
              <UiField label="Note generali turno" hint="Annotazioni di sessione, feedback pilota o condizioni particolari.">
                <textarea value={form.notes} onChange={(e) => patchForm("notes", e.target.value)} placeholder="Es. Turno con pista in gommatura, traffico nel secondo stint..." className={uiTextareaClassName} />
              </UiField>
            </div>
          </FormSection>

          <FormSection title="Pre-turno" subtitle="Condizioni e configurazione di partenza prima di entrare in pista.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <UiField label="Temperatura aria pre (°C)">
                <input type="number" step="0.1" value={form.pre_air_temp_c} onChange={(e) => patchForm("pre_air_temp_c", e.target.value)} placeholder="Es. 24.5" className={uiInputClassName} />
              </UiField>
              <UiField label="Temperatura asfalto pre (°C)">
                <input type="number" step="0.1" value={form.pre_track_temp_c} onChange={(e) => patchForm("pre_track_temp_c", e.target.value)} placeholder="Es. 33.0" className={uiInputClassName} />
              </UiField>
              <UiField label="Apertura aria (cm)">
                <input type="number" step="0.1" value={form.air_opening_cm} onChange={(e) => patchForm("air_opening_cm", e.target.value)} placeholder="Es. 2.5" className={uiInputClassName} />
              </UiField>
              <UiField label="Apertura olio (cm)">
                <input type="number" step="0.1" value={form.oil_opening_cm} onChange={(e) => patchForm("oil_opening_cm", e.target.value)} placeholder="Es. 1.8" className={uiInputClassName} />
              </UiField>
            </div>
            <div className="mt-4">
              <WheelGrid title="Pressioni a freddo" hint="Inserisci le pressioni pre-turno per singola ruota." values={{ fl: form.pre_pressure_fl, fr: form.pre_pressure_fr, rl: form.pre_pressure_rl, rr: form.pre_pressure_rr }} onChange={(key, value) => patchForm(({ fl: "pre_pressure_fl", fr: "pre_pressure_fr", rl: "pre_pressure_rl", rr: "pre_pressure_rr" } as const)[key], value)} />
            </div>
          </FormSection>

          <FormSection title="Post-turno" subtitle="Rilevazioni a caldo, temperature gomme e temperature massime registrate.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <UiField label="Temperatura aria post (°C)">
                <input type="number" step="0.1" value={form.post_air_temp_c} onChange={(e) => patchForm("post_air_temp_c", e.target.value)} placeholder="Es. 26.0" className={uiInputClassName} />
              </UiField>
              <UiField label="Temperatura asfalto post (°C)">
                <input type="number" step="0.1" value={form.post_track_temp_c} onChange={(e) => patchForm("post_track_temp_c", e.target.value)} placeholder="Es. 35.2" className={uiInputClassName} />
              </UiField>
              <UiField label="Temperatura max acqua (°C)">
                <input type="number" step="0.1" value={form.max_water_temp_c} onChange={(e) => patchForm("max_water_temp_c", e.target.value)} placeholder="Es. 92.0" className={uiInputClassName} />
              </UiField>
              <UiField label="Temperatura max olio (°C)">
                <input type="number" step="0.1" value={form.max_oil_temp_c} onChange={(e) => patchForm("max_oil_temp_c", e.target.value)} placeholder="Es. 108.0" className={uiInputClassName} />
              </UiField>
            </div>
            <div className="mt-4 space-y-4">
              <WheelGrid title="Pressioni a caldo" hint="Rilevazioni post-turno per singola ruota." values={{ fl: form.post_pressure_fl, fr: form.post_pressure_fr, rl: form.post_pressure_rl, rr: form.post_pressure_rr }} onChange={(key, value) => patchForm(({ fl: "post_pressure_fl", fr: "post_pressure_fr", rl: "post_pressure_rl", rr: "post_pressure_rr" } as const)[key], value)} />
              <WheelGrid title="Temperature gomme post-turno (°C)" hint="Versione base: una temperatura per ruota." values={{ fl: form.post_tyre_temp_fl, fr: form.post_tyre_temp_fr, rl: form.post_tyre_temp_rl, rr: form.post_tyre_temp_rr }} onChange={(key, value) => patchForm(({ fl: "post_tyre_temp_fl", fr: "post_tyre_temp_fr", rl: "post_tyre_temp_rl", rr: "post_tyre_temp_rr" } as const)[key], value)} placeholders={{ fl: "Es. 72", fr: "Es. 73", rl: "Es. 68", rr: "Es. 69" }} />
            </div>
            <div className="mt-4">
              <UiField label="Note tecniche turno" hint="Annotazioni tecniche post-turno, comportamento vettura, assetto, usura o bilanciamento.">
                <textarea value={form.technical_notes} onChange={(e) => patchForm("technical_notes", e.target.value)} placeholder="Es. Pressione anteriore destra leggermente alta a fine turno, inserimento migliorato con aria più aperta..." className={uiTextareaClassName} />
              </UiField>
            </div>
          </FormSection>

          <FormSection title="Target tecnici" subtitle="Obiettivi post-turno per confrontare immediatamente le rilevazioni reali.">
            <div className="space-y-4">
              <WheelGrid title="Target pressioni post-turno" values={{ fl: form.target_post_pressure_fl, fr: form.target_post_pressure_fr, rl: form.target_post_pressure_rl, rr: form.target_post_pressure_rr }} onChange={(key, value) => patchForm(({ fl: "target_post_pressure_fl", fr: "target_post_pressure_fr", rl: "target_post_pressure_rl", rr: "target_post_pressure_rr" } as const)[key], value)} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <UiField label="Target acqua (°C)">
                  <input type="number" step="0.1" value={form.target_water_temp_c} onChange={(e) => patchForm("target_water_temp_c", e.target.value)} placeholder="Es. 90" className={uiInputClassName} />
                </UiField>
                <UiField label="Target olio (°C)">
                  <input type="number" step="0.1" value={form.target_oil_temp_c} onChange={(e) => patchForm("target_oil_temp_c", e.target.value)} placeholder="Es. 105" className={uiInputClassName} />
                </UiField>
              </div>
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={saveTurn} disabled={!canEditEvents || saving} className="rounded-xl px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-60" style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }}>
              <Save size={16} className="mr-2 inline" />
              {saving ? "Salvataggio..." : editingTurnId ? "Aggiorna turno tecnico" : "Salva turno tecnico"}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Turni registrati" subtitle="Storico completo con riepilogo tecnico rapido per ogni sessione.">
        {turns.length === 0 ? (
          <EmptyState title="Nessun turno registrato" description="Salva il primo turno tecnico con il modulo qui sopra." />
        ) : (
          <div className="space-y-4">
            {turns
              .slice()
              .sort((a, b) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime())
              .map((turn) => {
                const metrics = turn.metrics;
                const driverName = turn.driver_id ? driverMap.get(turn.driver_id) : null;
                const sessionName = turn.event_session_id ? sessionMap.get(turn.event_session_id)?.name : null;
                const fuelUsed = turn.fuel_start_liters != null && turn.fuel_end_liters != null ? round1(Math.max(0, Number(turn.fuel_start_liters) - Number(turn.fuel_end_liters))) : null;
                const warnings: Array<{ label: string; tone: "warning" | "danger" | "success" }> = [];
                const waterDelta = metrics?.max_water_temp_c != null && metrics?.target_water_temp_c != null ? round1(metrics.max_water_temp_c - metrics.target_water_temp_c) : null;
                if (waterDelta != null) {
                  if (waterDelta > 3) warnings.push({ label: `Acqua +${waterDelta}°C`, tone: "danger" });
                  else if (waterDelta > 0) warnings.push({ label: `Acqua +${waterDelta}°C`, tone: "warning" });
                  else warnings.push({ label: "Acqua in target", tone: "success" });
                }
                const oilDelta = metrics?.max_oil_temp_c != null && metrics?.target_oil_temp_c != null ? round1(metrics.max_oil_temp_c - metrics.target_oil_temp_c) : null;
                if (oilDelta != null) {
                  if (oilDelta > 3) warnings.push({ label: `Olio +${oilDelta}°C`, tone: "danger" });
                  else if (oilDelta > 0) warnings.push({ label: `Olio +${oilDelta}°C`, tone: "warning" });
                  else warnings.push({ label: "Olio in target", tone: "success" });
                }
                return (
                  <div key={turn.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-bold text-[var(--text-primary)]">{driverName || "Pilota non assegnato"}</div>
                          {sessionName ? <StatusChip label={sessionName} /> : null}
                          {metrics?.track_condition ? <StatusChip label={metrics.track_condition === "dry" ? "Asciutta" : metrics.track_condition === "damp" ? "Umida" : metrics.track_condition === "wet" ? "Bagnata" : "Mista"} /> : null}
                        </div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">
                          {formatDateTime(turn.recorded_at)} · {displayNumber(turn.minutes, " min")} · {displayNumber(turn.laps, " giri")}
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <SummaryBox label="Best lap" value={formatLapTime(metrics?.best_lap_ms)} />
                          <SummaryBox label="Fuel usato" value={fuelUsed != null ? `${fuelUsed} L` : "—"} />
                          <SummaryBox label="Acqua max" value={displayNumber(metrics?.max_water_temp_c, "°C")} />
                          <SummaryBox label="Olio max" value={displayNumber(metrics?.max_oil_temp_c, "°C")} />
                        </div>
                        {warnings.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {warnings.map((warning) => (
                              <StatusChip key={warning.label} label={warning.label} tone={warning.tone} />
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                          {metrics?.technical_notes || turn.notes || "Nessuna nota registrata."}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:w-[240px] xl:justify-end">
                        <button type="button" onClick={() => editTurn(turn)} disabled={!canEditEvents} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60">
                          <Edit2 size={16} className="mr-2 inline" />
                          Modifica
                        </button>
                        {canEditEvents ? (
                          <InlineConfirmButton label="Elimina" message="Eliminare questo turno tecnico?" onConfirm={() => deleteTurn(turn.id)} className="rounded-xl bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100" icon={<Trash2 size={16} className="mr-2 inline" />} />
                        ) : null}
                      </div>
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

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{label}</div>
      <div className="mt-2 text-lg font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
