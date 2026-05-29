"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CarFront,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  Flag,
  Fuel,
  Info,
  PlusCircle,
  Printer,
  TimerReset,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import InlineConfirmButton from "@/components/InlineConfirmButton";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import { UiField, uiInputClassName } from "@/components/UiField";
import { usePermissionAccess } from "@/lib/permissions";

type Feedback = { type: "success" | "error" | "info"; message: string };

type Circuit = { id: string; name: string | null };
type EventRecord = {
  id: string;
  name: string | null;
  date: string | null;
  notes: string | null;
  circuit_id: Circuit | null;
};
type CarRow = { id: string; name: string | null };
type EventCarRow = {
  id: string;
  status: string | null;
  notes: string | null;
  car_id: CarRow | null;
};
type SessionRow = {
  id: string;
  name: string;
  session_type?: string | null;
  starts_at?: string | null;
  created_at?: string | null;
};
type DriverRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname?: string | null;
};
type AssignedDriverRow = {
  id: string;
  event_car_id: string;
  driver_id: string | null;
};
type TurnBaseRow = {
  id: string;
  event_car_id: string;
  event_session_id: string | null;
  driver_id: string | null;
  recorded_at: string | null;
  minutes: number | null;
  laps: number | null;
  fuel_start_liters: number | null;
  fuel_end_liters: number | null;
  created_at: string | null;
};
type TurnMetricRow = {
  id: string;
  turn_id: string;
  event_car_id: string;
  best_lap_ms: number | null;
  avg_lap_ms: number | null;
  max_water_temp_c: number | null;
  max_oil_temp_c: number | null;
  track_condition: string | null;
};
type TurnRow = TurnBaseRow & { metrics: TurnMetricRow | null };

type CarReportRow = {
  eventCar: EventCarRow;
  assignedDrivers: DriverRow[];
  turns: TurnRow[];
  turnsCount: number;
  minutes: number;
  laps: number;
  fuel: number;
  bestLapMs: number | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Data non impostata";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT");
}

function formatHours(minutes: number) {
  return `${Math.round((minutes / 60) * 100) / 100} h`;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}${suffix}`;
}

function getFuelUsed(turn: TurnRow) {
  const start = Number(turn.fuel_start_liters ?? 0);
  const end = Number(turn.fuel_end_liters ?? 0);
  if (turn.fuel_start_liters == null || turn.fuel_end_liters == null) return 0;
  return Math.max(0, round1(start - end));
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

function driverName(driver: DriverRow | null | undefined) {
  if (!driver) return "—";
  const fullName =
    `${driver.first_name || ""} ${driver.last_name || ""}`.trim();
  return fullName || driver.nickname || "Pilota";
}

function sessionTypeLabel(value: string | null | undefined) {
  if (value === "test") return "Test";
  if (value === "practice") return "Practice";
  if (value === "qualifying") return "Qualifica";
  if (value === "race") return "Gara";
  return value || "—";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function csvCell(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeFilename(value: string | null | undefined) {
  return (
    (value || "evento")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "evento"
  );
}

function InfoBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-relaxed text-blue-800">
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-100 text-amber-700"
        : tone === "danger"
          ? "bg-red-100 text-red-700"
          : "bg-neutral-100 text-[var(--text-secondary)]";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes}`}
    >
      {children}
    </span>
  );
}

export default function EventDetailPage() {
  const access = usePermissionAccess();
  const canViewEvents = access.hasPermission("events.view");
  const canEditEvents = access.hasPermission("events.edit", ["owner", "admin"]);
  const { eventId } = useParams() as { eventId: string };

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [eventCars, setEventCars] = useState<EventCarRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [assignedDrivers, setAssignedDrivers] = useState<AssignedDriverRow[]>(
    [],
  );
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [selectedCar, setSelectedCar] = useState("");
  const [sessionForm, setSessionForm] = useState({
    name: "",
    session_type: "test",
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();

      const [eventRes, eventCarsRes, sessionsRes, carsRes, driversRes] =
        await Promise.all([
          supabase
            .from("events")
            .select("id,name,date,notes,circuit_id(id,name)")
            .eq("team_id", ctx.teamId)
            .eq("id", eventId)
            .single(),
          supabase
            .from("event_cars")
            .select("id,status,notes,car_id(id,name)")
            .eq("team_id", ctx.teamId)
            .eq("event_id", eventId)
            .order("created_at", { ascending: true }),
          supabase
            .from("event_sessions")
            .select("*")
            .eq("team_id", ctx.teamId)
            .eq("event_id", eventId)
            .order("created_at", { ascending: true }),
          supabase
            .from("cars")
            .select("id,name")
            .eq("team_id", ctx.teamId)
            .order("name", { ascending: true }),
          supabase
            .from("drivers")
            .select("id,first_name,last_name,nickname")
            .eq("team_id", ctx.teamId)
            .order("last_name", { ascending: true }),
        ]);

      const firstError =
        eventRes.error ||
        eventCarsRes.error ||
        sessionsRes.error ||
        carsRes.error ||
        driversRes.error;
      if (firstError) throw firstError;

      const normalizedEvent = eventRes.data
        ? {
            ...(eventRes.data as any),
            circuit_id: normalizeRelation((eventRes.data as any).circuit_id),
          }
        : null;

      const normalizedEventCars = ((eventCarsRes.data || []) as any[]).map(
        (row) => ({
          ...row,
          car_id: normalizeRelation(row.car_id),
        }),
      ) as EventCarRow[];

      const eventCarIds = normalizedEventCars.map((row) => row.id);
      let turnRows: TurnRow[] = [];
      let assignedRows: AssignedDriverRow[] = [];

      if (eventCarIds.length > 0) {
        const [turnsRes, metricsRes, assignedRes] = await Promise.all([
          supabase
            .from("event_car_turns")
            .select(
              "id,event_car_id,event_session_id,driver_id,recorded_at,minutes,laps,fuel_start_liters,fuel_end_liters,created_at",
            )
            .eq("team_id", ctx.teamId)
            .in("event_car_id", eventCarIds)
            .order("recorded_at", { ascending: false }),
          supabase
            .from("event_car_turn_metrics")
            .select(
              "id,turn_id,event_car_id,best_lap_ms,avg_lap_ms,max_water_temp_c,max_oil_temp_c,track_condition",
            )
            .eq("team_id", ctx.teamId)
            .in("event_car_id", eventCarIds),
          supabase
            .from("event_car_drivers")
            .select("id,event_car_id,driver_id")
            .eq("team_id", ctx.teamId)
            .in("event_car_id", eventCarIds),
        ]);

        const reportError =
          turnsRes.error || metricsRes.error || assignedRes.error;
        if (reportError) throw reportError;

        const metricsMap = new Map(
          ((metricsRes.data || []) as TurnMetricRow[]).map((row) => [
            row.turn_id,
            row,
          ]),
        );

        turnRows = ((turnsRes.data || []) as TurnBaseRow[]).map((row) => ({
          ...row,
          metrics: metricsMap.get(row.id) ?? null,
        }));
        assignedRows = (assignedRes.data || []) as AssignedDriverRow[];
      }

      setEvent(normalizedEvent as EventRecord | null);
      setEventCars(normalizedEventCars);
      setSessions((sessionsRes.data || []) as SessionRow[]);
      setCars((carsRes.data || []) as CarRow[]);
      setDrivers((driversRes.data || []) as DriverRow[]);
      setAssignedDrivers(assignedRows);
      setTurns(turnRows);
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore caricamento evento.",
      });
      setEvent(null);
      setEventCars([]);
      setSessions([]);
      setCars([]);
      setDrivers([]);
      setAssignedDrivers([]);
      setTurns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventId && !access.loading && canViewEvents) {
      void loadAll();
    }
  }, [eventId, access.loading, canViewEvents]);

  async function addCar() {
    if (!canEditEvents || !selectedCar) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase.from("event_cars").insert([
        {
          team_id: ctx.teamId,
          event_id: eventId,
          car_id: selectedCar,
          status: "ready",
        },
      ]);

      if (error) throw error;
      setSelectedCar("");
      await loadAll();
      setFeedback({
        type: "success",
        message: "Mezzo associato correttamente all'evento.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore associazione mezzo.",
      });
    }
  }

  async function addSession() {
    if (!canEditEvents || !sessionForm.name.trim()) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase.from("event_sessions").insert([
        {
          team_id: ctx.teamId,
          event_id: eventId,
          name: sessionForm.name.trim(),
          session_type: sessionForm.session_type,
        },
      ]);

      if (error) throw error;
      setSessionForm({ name: "", session_type: "test" });
      await loadAll();
      setFeedback({
        type: "success",
        message: "Sessione aggiunta correttamente.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore creazione sessione.",
      });
    }
  }

  async function removeSession(sessionId: string) {
    if (!canEditEvents) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { count, error: turnsError } = await supabase
        .from("event_car_turns")
        .select("id", { count: "exact", head: true })
        .eq("team_id", ctx.teamId)
        .eq("event_session_id", sessionId);

      if (turnsError) throw turnsError;
      if ((count || 0) > 0) {
        setFeedback({
          type: "error",
          message:
            "Questa sessione è già collegata a uno o più turni tecnici. Rimuovi o riassegna prima i turni collegati.",
        });
        return;
      }

      const { error } = await supabase
        .from("event_sessions")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", sessionId);

      if (error) throw error;
      await loadAll();
      setFeedback({
        type: "success",
        message: "Sessione eliminata correttamente.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore eliminazione sessione.",
      });
    }
  }

  async function removeEventCar(id: string) {
    if (!canEditEvents) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase
        .from("event_cars")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", id);

      if (error) throw error;
      await loadAll();
      setFeedback({ type: "success", message: "Mezzo rimosso dall'evento." });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore rimozione mezzo.",
      });
    }
  }

  const driverMap = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );
  const sessionMap = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );
  const eventCarMap = useMemo(
    () => new Map(eventCars.map((row) => [row.id, row])),
    [eventCars],
  );

  const carReportRows = useMemo<CarReportRow[]>(() => {
    return eventCars.map((eventCar) => {
      const rowTurns = turns.filter(
        (turn) => turn.event_car_id === eventCar.id,
      );
      const rowAssignedDrivers = assignedDrivers
        .filter((assignment) => assignment.event_car_id === eventCar.id)
        .map((assignment) => driverMap.get(assignment.driver_id || "") || null)
        .filter((driver): driver is DriverRow => Boolean(driver));
      const bestLapValues = rowTurns
        .map((turn) => turn.metrics?.best_lap_ms ?? null)
        .filter(
          (value): value is number => value != null && Number.isFinite(value),
        );
      return {
        eventCar,
        assignedDrivers: rowAssignedDrivers,
        turns: rowTurns,
        turnsCount: rowTurns.length,
        minutes: rowTurns.reduce(
          (sum, turn) => sum + Number(turn.minutes || 0),
          0,
        ),
        laps: rowTurns.reduce((sum, turn) => sum + Number(turn.laps || 0), 0),
        fuel: round1(
          rowTurns.reduce((sum, turn) => sum + getFuelUsed(turn), 0),
        ),
        bestLapMs: bestLapValues.length ? Math.min(...bestLapValues) : null,
      };
    });
  }, [assignedDrivers, driverMap, eventCars, turns]);

  const report = useMemo(() => {
    const totalMinutes = turns.reduce(
      (sum, turn) => sum + Number(turn.minutes || 0),
      0,
    );
    const totalLaps = turns.reduce(
      (sum, turn) => sum + Number(turn.laps || 0),
      0,
    );
    const totalFuel = round1(
      turns.reduce((sum, turn) => sum + getFuelUsed(turn), 0),
    );
    const bestLapValues = turns
      .map((turn) => turn.metrics?.best_lap_ms ?? null)
      .filter(
        (value): value is number => value != null && Number.isFinite(value),
      );
    const driverIds = new Set(
      turns.map((turn) => turn.driver_id).filter(Boolean),
    );
    const carsWithoutTurns = carReportRows.filter(
      (row) => row.turnsCount === 0,
    ).length;
    const carsWithoutAssignedDriver = carReportRows.filter(
      (row) => row.assignedDrivers.length === 0,
    ).length;
    const sessionIdsWithTurns = new Set(
      turns.map((turn) => turn.event_session_id).filter(Boolean),
    );
    const sessionsWithoutTurns = sessions.filter(
      (session) => !sessionIdsWithTurns.has(session.id),
    ).length;
    const turnsWithoutDriver = turns.filter((turn) => !turn.driver_id).length;
    const turnsWithoutSession = turns.filter(
      (turn) => !turn.event_session_id,
    ).length;

    return {
      totalTurns: turns.length,
      totalMinutes,
      totalHours: totalMinutes / 60,
      totalLaps,
      totalFuel,
      bestLapMs: bestLapValues.length ? Math.min(...bestLapValues) : null,
      driversInTurns: driverIds.size,
      carsWithoutTurns,
      carsWithoutAssignedDriver,
      sessionsWithoutTurns,
      turnsWithoutDriver,
      turnsWithoutSession,
    };
  }, [carReportRows, sessions, turns]);

  const stats: StatItem[] = useMemo(() => {
    const readyCars = eventCars.filter(
      (row) => (row.status || "").toLowerCase() === "ready",
    ).length;
    return [
      {
        label: "Mezzi collegati",
        value: String(eventCars.length),
        icon: <CarFront className="h-5 w-5" />,
        helper: `${readyCars} in stato ready`,
      },
      {
        label: "Sessioni",
        value: String(sessions.length),
        icon: <TimerReset className="h-5 w-5" />,
        helper: `${report.sessionsWithoutTurns} senza turni`,
      },
      {
        label: "Turni registrati",
        value: String(report.totalTurns),
        icon: <Flag className="h-5 w-5" />,
        helper: `${formatHours(report.totalMinutes)} • ${report.totalLaps} giri`,
      },
      {
        label: "Best lap evento",
        value: formatLapTime(report.bestLapMs),
        icon: <Clock3 className="h-5 w-5" />,
        helper:
          report.totalFuel > 0
            ? `${formatNumber(report.totalFuel, " L")} fuel consumato`
            : "Fuel non rilevato",
      },
    ];
  }, [eventCars, report, sessions.length]);

  const reportChecks = useMemo(() => {
    return [
      {
        label: "Mezzi senza turni",
        value: report.carsWithoutTurns,
        tone: report.carsWithoutTurns > 0 ? "warning" : "success",
      },
      {
        label: "Mezzi senza pilota assegnato",
        value: report.carsWithoutAssignedDriver,
        tone: report.carsWithoutAssignedDriver > 0 ? "warning" : "success",
      },
      {
        label: "Sessioni senza turni",
        value: report.sessionsWithoutTurns,
        tone: report.sessionsWithoutTurns > 0 ? "warning" : "success",
      },
      {
        label: "Turni senza pilota",
        value: report.turnsWithoutDriver,
        tone: report.turnsWithoutDriver > 0 ? "warning" : "success",
      },
      {
        label: "Turni senza sessione",
        value: report.turnsWithoutSession,
        tone: report.turnsWithoutSession > 0 ? "warning" : "success",
      },
    ] as const;
  }, [report]);

  function exportEventReportCsv() {
    if (!event) return;

    const lines: string[] = [];

    lines.push("REPORT EVENTO");
    lines.push(["Campo", "Valore"].map(csvCell).join(";"));
    [
      ["Evento", event.name || ""],
      ["Circuito", event.circuit_id?.name || ""],
      ["Data", formatDate(event.date)],
      ["Mezzi collegati", eventCars.length],
      ["Sessioni", sessions.length],
      ["Turni registrati", report.totalTurns],
      ["Minuti totali", report.totalMinutes],
      ["Ore guida", round1(report.totalHours)],
      ["Giri totali", report.totalLaps],
      ["Fuel consumato L", report.totalFuel],
      ["Best lap evento", formatLapTime(report.bestLapMs)],
      ["Piloti nei turni", report.driversInTurns],
      ["Mezzi senza turni", report.carsWithoutTurns],
      ["Mezzi senza pilota assegnato", report.carsWithoutAssignedDriver],
      ["Sessioni senza turni", report.sessionsWithoutTurns],
      ["Turni senza pilota", report.turnsWithoutDriver],
      ["Turni senza sessione", report.turnsWithoutSession],
    ].forEach((row) => lines.push(row.map(csvCell).join(";")));

    lines.push("");
    lines.push("RIEPILOGO PER MEZZO");
    lines.push(
      [
        "Mezzo",
        "Piloti assegnati",
        "Turni",
        "Minuti",
        "Ore",
        "Giri",
        "Fuel L",
        "Best lap",
        "Stato",
      ]
        .map(csvCell)
        .join(";"),
    );
    carReportRows.forEach((row) => {
      lines.push(
        [
          row.eventCar.car_id?.name || "",
          row.assignedDrivers.map(driverName).join(", "),
          row.turnsCount,
          row.minutes,
          round1(row.minutes / 60),
          row.laps,
          row.fuel || "",
          formatLapTime(row.bestLapMs),
          row.eventCar.status || "",
        ]
          .map(csvCell)
          .join(";"),
      );
    });

    lines.push("");
    lines.push("TURNI");
    lines.push(
      [
        "Data",
        "Mezzo",
        "Sessione",
        "Tipo sessione",
        "Pilota",
        "Minuti",
        "Ore",
        "Giri",
        "Fuel start L",
        "Fuel end L",
        "Fuel usato L",
        "Best lap",
        "Avg lap",
        "Temp acqua max",
        "Temp olio max",
        "Condizione pista",
      ]
        .map(csvCell)
        .join(";"),
    );
    turns.forEach((turn) => {
      const eventCar = eventCarMap.get(turn.event_car_id);
      const session = turn.event_session_id
        ? sessionMap.get(turn.event_session_id)
        : null;
      const driver = turn.driver_id ? driverMap.get(turn.driver_id) : null;
      lines.push(
        [
          formatDateTime(turn.recorded_at || turn.created_at),
          eventCar?.car_id?.name || "",
          session?.name || "",
          sessionTypeLabel(session?.session_type),
          driverName(driver),
          turn.minutes || 0,
          round1(Number(turn.minutes || 0) / 60),
          turn.laps || 0,
          turn.fuel_start_liters ?? "",
          turn.fuel_end_liters ?? "",
          getFuelUsed(turn) || "",
          formatLapTime(turn.metrics?.best_lap_ms),
          formatLapTime(turn.metrics?.avg_lap_ms),
          turn.metrics?.max_water_temp_c ?? "",
          turn.metrics?.max_oil_temp_c ?? "",
          turn.metrics?.track_condition || "",
        ]
          .map(csvCell)
          .join(";"),
      );
    });

    lines.push("");
    lines.push("SESSIONI");
    lines.push(
      ["Nome", "Tipo", "Turni collegati", "Creata il"].map(csvCell).join(";"),
    );
    sessions.forEach((session) => {
      const turnsCount = turns.filter(
        (turn) => turn.event_session_id === session.id,
      ).length;
      lines.push(
        [
          session.name,
          sessionTypeLabel(session.session_type),
          turnsCount,
          formatDateTime(session.created_at),
        ]
          .map(csvCell)
          .join(";"),
      );
    });

    const csv = `\ufeff${lines.join("\n")}`;
    const filename = `report-evento-${safeFilename(event.name)}-${event.date || new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(filename, csv, "text/csv;charset=utf-8");
    setFeedback({
      type: "success",
      message: "Report evento esportato in CSV.",
    });
  }

  function printEventReport() {
    const rowsHtml = carReportRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.eventCar.car_id?.name || "Mezzo")}</td>
            <td>${escapeHtml(row.assignedDrivers.map(driverName).join(", ") || "—")}</td>
            <td>${row.turnsCount}</td>
            <td>${row.minutes}</td>
            <td>${row.laps}</td>
            <td>${row.fuel ? `${row.fuel} L` : "—"}</td>
            <td>${escapeHtml(formatLapTime(row.bestLapMs))}</td>
          </tr>`,
      )
      .join("");

    const checksHtml = reportChecks
      .map(
        (check) =>
          `<li>${escapeHtml(check.label)}: <strong>${check.value}</strong></li>`,
      )
      .join("");

    const html = `
      <!doctype html>
      <html lang="it">
        <head>
          <meta charset="utf-8" />
          <title>Report evento - ${escapeHtml(event?.name || "Evento")}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #171717; margin: 32px; }
            h1 { margin: 0 0 8px; font-size: 26px; }
            h2 { margin-top: 28px; font-size: 18px; }
            .muted { color: #666; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 12px; }
            .label { color: #777; font-size: 12px; text-transform: uppercase; }
            .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; }
            ul { margin-top: 8px; }
            @media print { body { margin: 18mm; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(event?.name || "Report evento")}</h1>
          <div class="muted">${escapeHtml(event?.circuit_id?.name || "Autodromo non definito")} • ${escapeHtml(formatDate(event?.date))}</div>
          <div class="grid">
            <div class="card"><div class="label">Mezzi</div><div class="value">${eventCars.length}</div></div>
            <div class="card"><div class="label">Turni</div><div class="value">${report.totalTurns}</div></div>
            <div class="card"><div class="label">Ore guida</div><div class="value">${round1(report.totalHours)}</div></div>
            <div class="card"><div class="label">Best lap</div><div class="value">${escapeHtml(formatLapTime(report.bestLapMs))}</div></div>
          </div>
          <h2>Riepilogo evento</h2>
          <table>
            <thead><tr><th>Mezzo</th><th>Piloti</th><th>Turni</th><th>Minuti</th><th>Giri</th><th>Fuel</th><th>Best lap</th></tr></thead>
            <tbody>${rowsHtml || "<tr><td colspan='7'>Nessun mezzo collegato.</td></tr>"}</tbody>
          </table>
          <h2>Controlli completezza</h2>
          <ul>${checksHtml}</ul>
          ${event?.notes ? `<h2>Note evento</h2><p>${escapeHtml(event.notes)}</p>` : ""}
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>`;

    const printWindow = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=1100,height=800",
    );
    if (!printWindow) {
      setFeedback({
        type: "error",
        message:
          "Popup bloccato. Consenti l'apertura popup per stampare il report.",
      });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Eventi"
        subtitle="Calendario, mezzi collegati, sessioni e report operativo"
        icon={<CalendarDays className="h-6 w-6" />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Eventi"
        subtitle="Calendario, mezzi collegati, sessioni e report operativo"
        icon={<CalendarDays className="h-6 w-6" />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewEvents) {
    return (
      <PagePermissionState
        title="Eventi"
        subtitle="Calendario, mezzi collegati, sessioni e report operativo"
        icon={<CalendarDays className="h-6 w-6" />}
        state="denied"
        message="Il tuo ruolo non può aprire il dettaglio evento."
      />
    );
  }

  if (loading && !event) {
    return (
      <div className={`flex flex-col gap-6 p-6`}>
        <PageHeader
          title="Dettaglio evento"
          subtitle="Caricamento dati evento in corso"
          icon={<CalendarDays className="h-6 w-6" />}
        />
        <SectionCard>
          <p className="text-sm text-[var(--text-secondary)]">
            Caricamento evento...
          </p>
        </SectionCard>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={`flex flex-col gap-6 p-6`}>
        <PageHeader
          title="Evento non trovato"
          subtitle="Controlla che l'evento appartenga al team corrente"
          icon={<CalendarDays className="h-6 w-6" />}
          actions={
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Eventi
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title={event.name || "Dettaglio evento"}
        subtitle={`${event.circuit_id?.name || "Autodromo non definito"} • ${formatDate(event.date)}`}
        icon={<CalendarDays className="h-6 w-6" />}
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportEventReportCsv}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] shadow-sm transition hover:bg-white/[0.08]"
            >
              <Download className="h-4 w-4" />
              Esporta CSV
            </button>
            <button
              type="button"
              onClick={printEventReport}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] shadow-sm transition hover:bg-white/[0.08]"
            >
              <Printer className="h-4 w-4" />
              Stampa report
            </button>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Eventi
            </Link>
          </div>
        }
      />

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <StatsGrid items={stats} />

      <InfoBlock>
        Da qui assegni i mezzi all'evento e definisci le sessioni principali del
        weekend. La nuova sezione report legge i turni già registrati e mostra
        un riepilogo operativo senza modificare console mezzo, salvataggio turni
        o trigger ore.
      </InfoBlock>

      <SectionCard
        title="Report evento"
        subtitle="Riepilogo in sola lettura dei dati già registrati nei turni tecnici."
      >
        <div className="grid gap-4 md:grid-cols-5">
          {reportChecks.map((check) => (
            <div
              key={check.label}
              className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                {check.label}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {check.value}
                </p>
                <Badge tone={check.tone}>
                  {check.value === 0 ? "OK" : "Verifica"}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-white/[0.045] text-left text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-3">Mezzo</th>
                <th className="px-4 py-3">Piloti</th>
                <th className="px-4 py-3">Turni</th>
                <th className="px-4 py-3">Minuti</th>
                <th className="px-4 py-3">Giri</th>
                <th className="px-4 py-3">Fuel</th>
                <th className="px-4 py-3">Best lap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-white/[0.035]">
              {carReportRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]"
                  >
                    Nessun mezzo collegato all'evento.
                  </td>
                </tr>
              ) : (
                carReportRows.map((row) => (
                  <tr key={row.eventCar.id}>
                    <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                      {row.eventCar.car_id?.name || "Mezzo"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.assignedDrivers.length > 0
                        ? row.assignedDrivers.map(driverName).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.turnsCount}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.minutes}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{row.laps}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.fuel > 0 ? `${row.fuel} L` : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {formatLapTime(row.bestLapMs)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Mezzi evento"
        subtitle="Associa i mezzi al weekend e apri la console operativa dedicata."
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <UiField label="Mezzo">
            <select
              value={selectedCar}
              onChange={(event) => setSelectedCar(event.target.value)}
              className={uiInputClassName}
            >
              <option value="">Seleziona mezzo</option>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.name}
                </option>
              ))}
            </select>
          </UiField>
          {canEditEvents ? (
            <button
              type="button"
              onClick={addCar}
              disabled={!selectedCar}
              className="inline-flex items-center justify-center gap-2 self-end rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              Aggiungi mezzo
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3">
          {eventCars.length === 0 ? (
            <EmptyState
              title="Nessun mezzo collegato"
              description="Aggiungi almeno un mezzo per aprire la console evento e registrare turni tecnici."
            />
          ) : (
            eventCars.map((row) => {
              const reportRow = carReportRows.find(
                (item) => item.eventCar.id === row.id,
              );
              return (
                <div
                  key={row.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          {row.car_id?.name || "Mezzo"}
                        </h3>
                        <Badge
                          tone={
                            (row.status || "").toLowerCase() === "ready"
                              ? "success"
                              : "neutral"
                          }
                        >
                          Stato: {row.status || "—"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        {reportRow
                          ? `${reportRow.turnsCount} turni • ${reportRow.minutes} min • ${reportRow.laps} giri`
                          : "Nessun dato tecnico registrato"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/calendar/${eventId}/car/${row.id}`}
                        className="inline-flex items-center justify-center rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                      >
                        Apri console mezzo
                      </Link>
                      {canEditEvents ? (
                        <InlineConfirmButton
                          label="Rimuovi"
                          message="Rimuovere questo mezzo dall'evento?"
                          onConfirm={() => removeEventCar(row.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                          icon={<Trash2 className="h-4 w-4" />}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Sessioni evento"
        subtitle="Definisci le fasi principali: test, practice, qualifica o gara."
      >
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <UiField label="Nome sessione">
            <input
              value={sessionForm.name}
              onChange={(event) =>
                setSessionForm({ ...sessionForm, name: event.target.value })
              }
              className={uiInputClassName}
              placeholder="Es. Libere 1"
            />
          </UiField>
          <UiField label="Tipo">
            <select
              value={sessionForm.session_type}
              onChange={(event) =>
                setSessionForm({
                  ...sessionForm,
                  session_type: event.target.value,
                })
              }
              className={uiInputClassName}
            >
              <option value="test">Test</option>
              <option value="practice">Practice</option>
              <option value="qualifying">Qualifica</option>
              <option value="race">Gara</option>
            </select>
          </UiField>
          {canEditEvents ? (
            <button
              type="button"
              onClick={addSession}
              disabled={!sessionForm.name.trim()}
              className="inline-flex items-center justify-center gap-2 self-end rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              Aggiungi sessione
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {sessions.length === 0 ? (
            <EmptyState
              title="Nessuna sessione"
              description="Crea le sessioni evento per classificare correttamente i turni tecnici."
            />
          ) : (
            sessions.map((row) => {
              const turnsCount = turns.filter(
                (turn) => turn.event_session_id === row.id,
              ).length;
              return (
                <div
                  key={row.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[var(--text-primary)]">
                        {row.name}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {sessionTypeLabel(row.session_type)} • {turnsCount}{" "}
                        turni collegati
                      </p>
                    </div>
                    {canEditEvents ? (
                      <InlineConfirmButton
                        label="Elimina"
                        message="Eliminare questa sessione?"
                        onConfirm={() => removeSession(row.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        icon={<Trash2 className="h-4 w-4" />}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Ultimi turni registrati"
        subtitle="Vista rapida in sola lettura, senza modificare la console turni."
      >
        {turns.length === 0 ? (
          <EmptyState
            title="Nessun turno tecnico"
            description="I turni verranno mostrati qui dopo la registrazione dalle console mezzo."
          />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-white/10">
            <table className="min-w-full divide-y divide-neutral-100 text-sm">
              <thead className="bg-white/[0.045] text-left text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Mezzo</th>
                  <th className="px-4 py-3">Sessione</th>
                  <th className="px-4 py-3">Pilota</th>
                  <th className="px-4 py-3">Minuti</th>
                  <th className="px-4 py-3">Giri</th>
                  <th className="px-4 py-3">Best lap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-white/[0.035]">
                {turns.slice(0, 12).map((turn) => {
                  const eventCar = eventCarMap.get(turn.event_car_id);
                  const session = turn.event_session_id
                    ? sessionMap.get(turn.event_session_id)
                    : null;
                  return (
                    <tr key={turn.id}>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDateTime(turn.recorded_at || turn.created_at)}
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                        {eventCar?.car_id?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {session?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {driverName(
                          turn.driver_id ? driverMap.get(turn.driver_id) : null,
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {turn.minutes || 0}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {turn.laps || 0}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatLapTime(turn.metrics?.best_lap_ms)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {event.notes ? (
        <SectionCard title="Note evento">
          <p className="text-sm leading-relaxed text-neutral-600">
            {event.notes}
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
