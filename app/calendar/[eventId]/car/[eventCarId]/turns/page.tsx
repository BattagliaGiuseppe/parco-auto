"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Audiowide } from "next/font/google";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit2,
  Flame,
  Gauge,
  Info,
  ListFilter,
  PlusCircle,
  Printer,
  Save,
  Thermometer,
  Trash2,
  UserRound,
  X,
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

type ViewMode = "synthetic" | "detailed";

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

function getFuelUsed(turn: TurnRow) {
  if (turn.fuel_start_liters == null || turn.fuel_end_liters == null) return null;
  return round1(Math.max(0, Number(turn.fuel_start_liters) - Number(turn.fuel_end_liters)));
}

function getFuelPerLap(turn: TurnRow) {
  const fuelUsed = getFuelUsed(turn);
  const laps = Number(turn.laps || 0);
  if (fuelUsed == null || laps <= 0) return null;
  return round1(fuelUsed / laps);
}

function getFuelPerMinute(turn: TurnRow) {
  const fuelUsed = getFuelUsed(turn);
  const minutes = Number(turn.minutes || 0);
  if (fuelUsed == null || minutes <= 0) return null;
  return round1(fuelUsed / minutes);
}

function getPressureDelta(pre: number | null | undefined, post: number | null | undefined) {
  if (pre == null || post == null || !Number.isFinite(pre) || !Number.isFinite(post)) return null;
  return round1(post - pre);
}

function getTargetDelta(actual: number | null | undefined, target: number | null | undefined) {
  if (actual == null || target == null || !Number.isFinite(actual) || !Number.isFinite(target)) return null;
  return round1(actual - target);
}

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return round1(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}


function formatSigned(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}


function getTurnTargetScore(turn: TurnRow) {
  const metrics = turn.metrics;
  if (!metrics) return null;

  const deltas = [
    getTargetDelta(metrics.post_pressure_fl, metrics.target_post_pressure_fl),
    getTargetDelta(metrics.post_pressure_fr, metrics.target_post_pressure_fr),
    getTargetDelta(metrics.post_pressure_rl, metrics.target_post_pressure_rl),
    getTargetDelta(metrics.post_pressure_rr, metrics.target_post_pressure_rr),
    getTargetDelta(metrics.max_water_temp_c, metrics.target_water_temp_c),
    getTargetDelta(metrics.max_oil_temp_c, metrics.target_oil_temp_c),
  ].filter((value): value is number => value != null && Number.isFinite(value));

  if (deltas.length === 0) return null;
  return round1(deltas.reduce((sum, value) => sum + Math.abs(value), 0));
}

function getConsistencyGapMs(turn: TurnRow) {
  const best = turn.metrics?.best_lap_ms;
  const avg = turn.metrics?.avg_lap_ms;
  if (best == null || avg == null || !Number.isFinite(best) || !Number.isFinite(avg)) return null;
  return Math.max(0, avg - best);
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

function InfoBlock({ children }: { children: ReactNode }) {
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
  children: ReactNode;
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
        {(["fl","fr","rl","rr"] as const).map((key) => (
          <UiField key={key} label={key.toUpperCase()}>
            <input
              type="number"
              step="0.01"
              value={values[key]}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={placeholders?.[key] || (key.startsWith("f") ? "Es. 1.20" : "Es. 1.18")}
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

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="mt-2 text-lg font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}


function CompareSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
      <div className="mb-3 text-sm font-bold text-[var(--text-primary)]">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CompareRow({
  label,
  left,
  right,
  delta,
}: {
  label: string;
  left: string;
  right: string;
  delta?: string;
}) {
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr] items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-3 text-sm">
      <div className="font-semibold text-[var(--text-primary)]">{label}</div>
      <div className="text-[var(--text-secondary)]">{left}</div>
      <div className="text-[var(--text-secondary)]">{right}</div>
      <div className="text-right font-semibold text-[var(--text-primary)]">{delta || "—"}</div>
    </div>
  );
}

function TurnComparePanel({
  leftTurn,
  rightTurn,
  leftLabel,
  rightLabel,
}: {
  leftTurn: TurnRow;
  rightTurn: TurnRow;
  leftLabel: string;
  rightLabel: string;
}) {
  const leftMetrics = leftTurn.metrics;
  const rightMetrics = rightTurn.metrics;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr] gap-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        <div>Voce</div>
        <div>{leftLabel}</div>
        <div>{rightLabel}</div>
        <div className="text-right">Delta</div>
      </div>

      <CompareSection title="Base e performance">
        <CompareRow label="Data / ora" left={formatDateTime(leftTurn.recorded_at)} right={formatDateTime(rightTurn.recorded_at)} />
        <CompareRow label="Minuti" left={displayNumber(leftTurn.minutes, " min")} right={displayNumber(rightTurn.minutes, " min")} delta={formatSigned(round1((rightTurn.minutes ?? 0) - (leftTurn.minutes ?? 0)), " min")} />
        <CompareRow label="Giri" left={displayNumber(leftTurn.laps, "")} right={displayNumber(rightTurn.laps, "")} delta={formatSigned(round1((rightTurn.laps ?? 0) - (leftTurn.laps ?? 0)))} />
        <CompareRow label="Best lap" left={formatLapTime(leftMetrics?.best_lap_ms)} right={formatLapTime(rightMetrics?.best_lap_ms)} delta={leftMetrics?.best_lap_ms != null && rightMetrics?.best_lap_ms != null ? formatSigned(round1((rightMetrics.best_lap_ms - leftMetrics.best_lap_ms) / 1000), " s") : "—"} />
        <CompareRow label="Giro medio" left={formatLapTime(leftMetrics?.avg_lap_ms)} right={formatLapTime(rightMetrics?.avg_lap_ms)} delta={leftMetrics?.avg_lap_ms != null && rightMetrics?.avg_lap_ms != null ? formatSigned(round1((rightMetrics.avg_lap_ms - leftMetrics.avg_lap_ms) / 1000), " s") : "—"} />
      </CompareSection>

      <CompareSection title="Fuel">
        <CompareRow label="Fuel usato" left={displayNumber(getFuelUsed(leftTurn), " L")} right={displayNumber(getFuelUsed(rightTurn), " L")} delta={formatSigned(round1((getFuelUsed(rightTurn) ?? 0) - (getFuelUsed(leftTurn) ?? 0)), " L")} />
        <CompareRow label="Fuel / giro" left={displayNumber(getFuelPerLap(leftTurn), " L")} right={displayNumber(getFuelPerLap(rightTurn), " L")} delta={formatSigned(round1((getFuelPerLap(rightTurn) ?? 0) - (getFuelPerLap(leftTurn) ?? 0)), " L")} />
        <CompareRow label="Fuel / min" left={displayNumber(getFuelPerMinute(leftTurn), " L")} right={displayNumber(getFuelPerMinute(rightTurn), " L")} delta={formatSigned(round1((getFuelPerMinute(rightTurn) ?? 0) - (getFuelPerMinute(leftTurn) ?? 0)), " L")} />
      </CompareSection>

      <CompareSection title="Pressioni post-turno">
        <CompareRow label="FL post" left={displayNumber(leftMetrics?.post_pressure_fl, " bar")} right={displayNumber(rightMetrics?.post_pressure_fl, " bar")} delta={formatSigned(getTargetDelta(rightMetrics?.post_pressure_fl, leftMetrics?.post_pressure_fl), " bar")} />
        <CompareRow label="FR post" left={displayNumber(leftMetrics?.post_pressure_fr, " bar")} right={displayNumber(rightMetrics?.post_pressure_fr, " bar")} delta={formatSigned(getTargetDelta(rightMetrics?.post_pressure_fr, leftMetrics?.post_pressure_fr), " bar")} />
        <CompareRow label="RL post" left={displayNumber(leftMetrics?.post_pressure_rl, " bar")} right={displayNumber(rightMetrics?.post_pressure_rl, " bar")} delta={formatSigned(getTargetDelta(rightMetrics?.post_pressure_rl, leftMetrics?.post_pressure_rl), " bar")} />
        <CompareRow label="RR post" left={displayNumber(leftMetrics?.post_pressure_rr, " bar")} right={displayNumber(rightMetrics?.post_pressure_rr, " bar")} delta={formatSigned(getTargetDelta(rightMetrics?.post_pressure_rr, leftMetrics?.post_pressure_rr), " bar")} />
      </CompareSection>

      <CompareSection title="Temperature e target">
        <CompareRow label="Acqua max" left={displayNumber(leftMetrics?.max_water_temp_c, "°C")} right={displayNumber(rightMetrics?.max_water_temp_c, "°C")} delta={formatSigned(getTargetDelta(rightMetrics?.max_water_temp_c, leftMetrics?.max_water_temp_c), "°C")} />
        <CompareRow label="Olio max" left={displayNumber(leftMetrics?.max_oil_temp_c, "°C")} right={displayNumber(rightMetrics?.max_oil_temp_c, "°C")} delta={formatSigned(getTargetDelta(rightMetrics?.max_oil_temp_c, leftMetrics?.max_oil_temp_c), "°C")} />
        <CompareRow label="Temp. FL" left={displayNumber(leftMetrics?.post_tyre_temp_fl, "°C")} right={displayNumber(rightMetrics?.post_tyre_temp_fl, "°C")} delta={formatSigned(getTargetDelta(rightMetrics?.post_tyre_temp_fl, leftMetrics?.post_tyre_temp_fl), "°C")} />
        <CompareRow label="Temp. FR" left={displayNumber(leftMetrics?.post_tyre_temp_fr, "°C")} right={displayNumber(rightMetrics?.post_tyre_temp_fr, "°C")} delta={formatSigned(getTargetDelta(rightMetrics?.post_tyre_temp_fr, leftMetrics?.post_tyre_temp_fr), "°C")} />
      </CompareSection>
    </div>
  );
}

function DetailGrid({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
      <div className="mb-3 text-sm font-bold text-[var(--text-primary)]">{title}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

function buildTurnWarnings(turn: TurnRow) {
  const metrics = turn.metrics;
  const warnings: Array<{ label: string; tone: "warning" | "danger" | "success" }> = [];

  const waterDelta = getTargetDelta(metrics?.max_water_temp_c, metrics?.target_water_temp_c);
  if (waterDelta != null) {
    if (waterDelta > 3) warnings.push({ label: `Acqua +${waterDelta}°C`, tone: "danger" });
    else if (waterDelta > 0) warnings.push({ label: `Acqua +${waterDelta}°C`, tone: "warning" });
    else warnings.push({ label: "Acqua in target", tone: "success" });
  }

  const oilDelta = getTargetDelta(metrics?.max_oil_temp_c, metrics?.target_oil_temp_c);
  if (oilDelta != null) {
    if (oilDelta > 3) warnings.push({ label: `Olio +${oilDelta}°C`, tone: "danger" });
    else if (oilDelta > 0) warnings.push({ label: `Olio +${oilDelta}°C`, tone: "warning" });
    else warnings.push({ label: "Olio in target", tone: "success" });
  }

  const targetChecks = [
    ["FL", metrics?.post_pressure_fl, metrics?.target_post_pressure_fl],
    ["FR", metrics?.post_pressure_fr, metrics?.target_post_pressure_fr],
    ["RL", metrics?.post_pressure_rl, metrics?.target_post_pressure_rl],
    ["RR", metrics?.post_pressure_rr, metrics?.target_post_pressure_rr],
  ] as const;

  targetChecks.forEach(([label, actual, target]) => {
    const delta = getTargetDelta(actual, target);
    if (delta == null) return;
    if (Math.abs(delta) <= 0.03) {
      warnings.push({ label: `${label} in target`, tone: "success" });
    } else if (Math.abs(delta) <= 0.08) {
      warnings.push({ label: `${label} ${delta > 0 ? "+" : ""}${delta} bar`, tone: "warning" });
    } else {
      warnings.push({ label: `${label} ${delta > 0 ? "+" : ""}${delta} bar`, tone: "danger" });
    }
  });

  const fuelPerLap = getFuelPerLap(turn);
  if (fuelPerLap != null) {
    warnings.push({
      label: `Fuel/giro ${fuelPerLap} L`,
      tone: fuelPerLap <= 0.9 ? "success" : fuelPerLap <= 1.2 ? "warning" : "danger",
    });
  }

  return warnings.slice(0, 6);
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("synthetic");
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);
  const [compareTurnIds, setCompareTurnIds] = useState<string[]>([]);
  const [predictorLaps, setPredictorLaps] = useState("10");
  const [predictorMinutes, setPredictorMinutes] = useState("20");
  const [predictorReservePct, setPredictorReservePct] = useState("10");
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

      const [
        eventRes,
        eventCarRes,
        sessionsRes,
        driversRes,
        assignedRes,
        turnsRes,
        metricsRes,
      ] = await Promise.all([
        supabase.from("events").select("id,name,date").eq("id", eventId).single(),
        supabase
          .from("event_cars")
          .select("id, event_id, car_id ( id, name )")
          .eq("team_id", ctx.teamId)
          .eq("id", eventCarId)
          .single(),
        supabase
          .from("event_sessions")
          .select("id,name,starts_at")
          .eq("team_id", ctx.teamId)
          .eq("event_id", eventId)
          .order("starts_at", { ascending: true }),
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
          .select("id,event_car_id,event_session_id,driver_id,recorded_at,minutes,laps,fuel_start_liters,fuel_end_liters,notes,created_at")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .order("recorded_at", { ascending: false }),
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

      const assignedRows = (assignedRes.data || []) as AssignedDriverRow[];
      const assignedDriverList = assignedRows
        .map((row) => normalizeRelation(row.driver_id))
        .filter(Boolean) as DriverOption[];

      setDrivers((driversRes.data || []) as DriverOption[]);
      setAssignedDrivers(assignedDriverList);
      setSessions((sessionsRes.data || []) as SessionRow[]);

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

  const sessionMap = useMemo(
    () => new Map(sessions.map((row) => [row.id, row])),
    [sessions]
  );

  const availableDrivers = useMemo(() => {
    if (assignedDrivers.length > 0) return assignedDrivers;
    return drivers;
  }, [assignedDrivers, drivers]);

  const driverMap = useMemo(
    () => new Map(availableDrivers.map((row) => [row.id, `${row.first_name || ""} ${row.last_name || ""}`.trim()])),
    [availableDrivers]
  );

  const compareTurns = useMemo(
    () =>
      compareTurnIds
        .map((id) => turns.find((turn) => turn.id === id) || null)
        .filter((turn): turn is TurnRow => Boolean(turn)),
    [compareTurnIds, turns]
  );


  const totalTurns = turns.length;
  const totalMinutes = useMemo(
    () => turns.reduce((sum, turn) => sum + Number(turn.minutes || 0), 0),
    [turns]
  );
  const totalLaps = useMemo(
    () => turns.reduce((sum, turn) => sum + Number(turn.laps || 0), 0),
    [turns]
  );
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

  const bestLapDay = useMemo(() => {
    const values = turns
      .map((turn) => turn.metrics?.best_lap_ms)
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length === 0) return null;
    return Math.min(...values);
  }, [turns]);

  const maxWaterDay = useMemo(() => {
    const values = turns
      .map((turn) => turn.metrics?.max_water_temp_c)
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length === 0) return null;
    return Math.max(...values);
  }, [turns]);

  const maxOilDay = useMemo(() => {
    const values = turns
      .map((turn) => turn.metrics?.max_oil_temp_c)
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length === 0) return null;
    return Math.max(...values);
  }, [turns]);

  const mostEfficientTurn = useMemo(() => {
    const candidates = turns
      .map((turn) => ({ turn, fuelPerLap: getFuelPerLap(turn) }))
      .filter((row): row is { turn: TurnRow; fuelPerLap: number } => row.fuelPerLap != null);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, current) =>
      current.fuelPerLap < best.fuelPerLap ? current : best
    );
  }, [turns]);

  const averageFrontPostPressure = useMemo(
    () =>
      average(
        turns.flatMap((turn) => [
          turn.metrics?.post_pressure_fl ?? null,
          turn.metrics?.post_pressure_fr ?? null,
        ])
      ),
    [turns]
  );

  const averageRearPostPressure = useMemo(
    () =>
      average(
        turns.flatMap((turn) => [
          turn.metrics?.post_pressure_rl ?? null,
          turn.metrics?.post_pressure_rr ?? null,
        ])
      ),
    [turns]
  );

  const bestLapTurn = useMemo(() => {
    const candidates = turns
      .map((turn) => ({ turn, bestLap: turn.metrics?.best_lap_ms ?? null }))
      .filter((row): row is { turn: TurnRow; bestLap: number } => row.bestLap != null);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, current) => (current.bestLap < best.bestLap ? current : best));
  }, [turns]);

  const closestToTargetTurn = useMemo(() => {
    const candidates = turns
      .map((turn) => ({ turn, score: getTurnTargetScore(turn) }))
      .filter((row): row is { turn: TurnRow; score: number } => row.score != null);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, current) => (current.score < best.score ? current : best));
  }, [turns]);

  const mostConsistentTurn = useMemo(() => {
    const candidates = turns
      .map((turn) => ({ turn, gap: getConsistencyGapMs(turn) }))
      .filter((row): row is { turn: TurnRow; gap: number } => row.gap != null);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, current) => (current.gap < best.gap ? current : best));
  }, [turns]);

  const averageFuelPerLap = useMemo(
    () => average(turns.map((turn) => getFuelPerLap(turn))),
    [turns]
  );

  const averageFuelPerMinute = useMemo(
    () => average(turns.map((turn) => getFuelPerMinute(turn))),
    [turns]
  );

  const predictorLapsValue = parseOptionalInteger(predictorLaps) ?? 0;
  const predictorMinutesValue = parseOptionalNumber(predictorMinutes) ?? 0;
  const predictorReservePctValue = parseOptionalNumber(predictorReservePct) ?? 0;

  const predictedFuelForLaps = useMemo(() => {
    if (averageFuelPerLap == null || predictorLapsValue <= 0) return null;
    const base = averageFuelPerLap * predictorLapsValue;
    return round1(base * (1 + Math.max(0, predictorReservePctValue) / 100));
  }, [averageFuelPerLap, predictorLapsValue, predictorReservePctValue]);

  const predictedFuelForMinutes = useMemo(() => {
    if (averageFuelPerMinute == null || predictorMinutesValue <= 0) return null;
    const base = averageFuelPerMinute * predictorMinutesValue;
    return round1(base * (1 + Math.max(0, predictorReservePctValue) / 100));
  }, [averageFuelPerMinute, predictorMinutesValue, predictorReservePctValue]);

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
      helper: totalLaps > 0 ? `${displayNumber(round1(totalFuelUsed / totalLaps), " L/giro")}` : "Consumo medio non disponibile",
    },
    {
      label: "Best lap giornata",
      value: formatLapTime(bestLapDay),
      icon: <Clock3 size={18} />,
      helper: `Acqua max ${displayNumber(maxWaterDay, "°C")} • Olio max ${displayNumber(maxOilDay, "°C")}`,
    },
  ];

  function resetForm() {
    setEditingTurnId(null);
    setForm(buildDefaultForm());
  }

  function openCreate() {
    resetForm();
    setDrawerOpen(true);
    setFeedback(null);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    resetForm();
    setFeedback(null);
  }

  function patchForm<K extends keyof TurnForm>(key: K, value: TurnForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editTurn(turn: TurnRow) {
    setEditingTurnId(turn.id);
    setForm(buildFormFromTurn(turn));
    setDrawerOpen(true);
    setFeedback(null);
  }

  function toggleCompareTurn(turnId: string) {
    setCompareTurnIds((current) => {
      if (current.includes(turnId)) {
        return current.filter((id) => id !== turnId);
      }
      if (current.length < 2) {
        return [...current, turnId];
      }
      return [current[1], turnId];
    });
  }


  async function saveTurn() {
    setFeedback(null);

    if (!form.recorded_at.trim()) {
      setFeedback({ type: "error", message: "Inserisci data e ora del turno." });
      setDrawerOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const minutes = parseOptionalInteger(form.minutes);
    if (minutes == null || minutes <= 0) {
      setFeedback({ type: "error", message: "Inserisci una durata turno valida in minuti." });
      setDrawerOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const laps = parseOptionalInteger(form.laps);
    if (laps == null || laps < 0) {
      setFeedback({ type: "error", message: "Inserisci il numero giri del turno." });
      setDrawerOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const bestLapMs = parseLapTimeToMs(form.best_lap);
    if (form.best_lap.trim() && bestLapMs == null) {
      setFeedback({
        type: "error",
        message: "Il formato del miglior giro non è valido. Usa ad esempio 1:42.350.",
      });
      setDrawerOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const avgLapMs = parseLapTimeToMs(form.avg_lap);
    if (form.avg_lap.trim() && avgLapMs == null) {
      setFeedback({
        type: "error",
        message: "Il formato del giro medio non è valido. Usa ad esempio 1:43.120.",
      });
      setDrawerOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const fuelStart = parseOptionalNumber(form.fuel_start_liters);
    const fuelEnd = parseOptionalNumber(form.fuel_end_liters);

    if (fuelStart != null && fuelEnd != null && fuelEnd > fuelStart) {
      setFeedback({
        type: "error",
        message: "Il carburante finale non può essere superiore al carburante iniziale in questo blocco base.",
      });
      setDrawerOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        fuel_start_liters: fuelStart,
        fuel_end_liters: fuelEnd,
        notes: form.notes.trim() || null,
      };

      let turnId = editingTurnId;

      if (editingTurnId) {
        const { error } = await supabase
          .from("event_car_turns")
          .update(turnPayload)
          .eq("id", editingTurnId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("event_car_turns")
          .insert([turnPayload])
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
        message: editingTurnId
          ? "Turno tecnico aggiornato correttamente."
          : "Turno tecnico aggiunto correttamente.",
      });

      await fetchAll();
      closeDrawer();
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore salvataggio turno tecnico.",
      });
      setDrawerOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTurn(turnId: string) {
    setFeedback(null);

    const { error } = await supabase.from("event_car_turns").delete().eq("id", turnId);

    if (error) {
      setFeedback({
        type: "error",
        message: `Errore eliminazione turno: ${error.message}`,
      });
      return;
    }

    setFeedback({ type: "success", message: "Turno eliminato correttamente." });
    setCompareTurnIds((current) => current.filter((id) => id !== turnId));
    if (editingTurnId === turnId) closeDrawer();
    await fetchAll();
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Turni tecnici"
        subtitle="Sessioni, fuel e rilevazioni tecniche del mezzo"
        icon={<Gauge size={20} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Turni tecnici"
        subtitle="Sessioni, fuel e rilevazioni tecniche del mezzo"
        icon={<Gauge size={20} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewEvents) {
    return (
      <PagePermissionState
        title="Turni tecnici"
        subtitle="Sessioni, fuel e rilevazioni tecniche del mezzo"
        icon={<Gauge size={20} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo eventi / turni."
      />
    );
  }

  if (loading) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 text-sm text-[var(--text-secondary)] shadow-sm">
          Caricamento console turni in corso...
        </div>
      </div>
    );
  }

  if (!eventInfo || !carInfo) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <FormStatusBanner
          type="error"
          message="Impossibile trovare i dati dell'evento o del mezzo selezionato."
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title={`Console turni • ${carInfo.name ?? "Mezzo"}`}
        subtitle={`Evento: ${eventInfo.name ?? "Evento"}${eventInfo.date ? ` • ${new Date(eventInfo.date).toLocaleDateString("it-IT")}` : ""}`}
        icon={<Gauge size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCreate}
              disabled={!canEditEvents}
              className="rounded-xl px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }}
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Nuovo turno
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]"
            >
              <Printer size={16} className="mr-2 inline" />
              Stampa scheda
            </button>

            <Link
              href={`/calendar/${eventId}/car/${eventCarId}`}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]"
            >
              <ArrowLeft size={16} className="mr-2 inline" />
              Console mezzo
            </Link>
          </div>
        }
      />

      {feedback && !drawerOpen ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="KPI evoluti giornata"
        subtitle="Indicatori automatici derivati dai turni già registrati, utili per leggere efficienza e comportamento del mezzo."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryBox
            label="Turno più efficiente"
            value={
              mostEfficientTurn
                ? `${driverMap.get(mostEfficientTurn.turn.driver_id || "") || "Pilota"} • ${mostEfficientTurn.fuelPerLap} L/giro`
                : "—"
            }
          />
          <SummaryBox
            label="Fuel/min migliore"
            value={
              mostEfficientTurn
                ? `${displayNumber(getFuelPerMinute(mostEfficientTurn.turn), " L/min")}`
                : "—"
            }
          />
          <SummaryBox
            label="Media pressioni asse ant."
            value={displayNumber(averageFrontPostPressure, " bar")}
          />
          <SummaryBox
            label="Media pressioni asse post."
            value={displayNumber(averageRearPostPressure, " bar")}
          />
        </div>
      </SectionCard>


      <SectionCard
        title="Turn intelligence"
        subtitle="Insight automatici e stima fuel rapida basati sullo storico tecnico già registrato."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SummaryBox
                label="Turno più vicino ai target"
                value={
                  closestToTargetTurn
                    ? `${driverMap.get(closestToTargetTurn.turn.driver_id || "") || "Pilota"} • score ${closestToTargetTurn.score}`
                    : "—"
                }
              />
              <SummaryBox
                label="Turno più costante"
                value={
                  mostConsistentTurn
                    ? `${driverMap.get(mostConsistentTurn.turn.driver_id || "") || "Pilota"} • gap ${formatSigned(round1(mostConsistentTurn.gap / 1000), " s")}`
                    : "—"
                }
              />
              <SummaryBox
                label="Media fuel / giro"
                value={displayNumber(averageFuelPerLap, " L")}
              />
              <SummaryBox
                label="Media fuel / min"
                value={displayNumber(averageFuelPerMinute, " L")}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
              <div className="text-sm font-bold text-[var(--text-primary)]">Lettura rapida storico</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                <div>
                  {bestLapTurn
                    ? `Il miglior riferimento prestazionale della giornata è ${formatLapTime(bestLapTurn.bestLap)} con ${driverMap.get(bestLapTurn.turn.driver_id || "") || "pilota non assegnato"}.`
                    : "Non ci sono ancora best lap sufficienti per costruire un riferimento prestazionale."}
                </div>
                <div>
                  {closestToTargetTurn
                    ? `Il turno più vicino ai target attuali è quello di ${driverMap.get(closestToTargetTurn.turn.driver_id || "") || "pilota non assegnato"}: utile come base per setup e fuel planning.`
                    : "Non ci sono ancora abbastanza target compilati per individuare un turno di riferimento."}
                </div>
                <div>
                  {mostEfficientTurn
                    ? `Il miglior riferimento consumo/giro è ${mostEfficientTurn.fuelPerLap} L/giro.`
                    : "Compila fuel pre e post su più turni per ottenere un riferimento consumo attendibile."}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm">
            <div className="text-base font-bold text-[var(--text-primary)]">Fuel prediction rapido</div>
            <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Inserisci giri o minuti previsti e il sistema calcola un suggerimento rapido usando la media storica del mezzo, con margine di sicurezza.
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <UiField label="Giri previsti">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={predictorLaps}
                  onChange={(e) => setPredictorLaps(e.target.value)}
                  className={uiInputClassName}
                  placeholder="Es. 12"
                />
              </UiField>
              <UiField label="Minuti previsti">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={predictorMinutes}
                  onChange={(e) => setPredictorMinutes(e.target.value)}
                  className={uiInputClassName}
                  placeholder="Es. 20"
                />
              </UiField>
              <UiField label="Margine sicurezza (%)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={predictorReservePct}
                  onChange={(e) => setPredictorReservePct(e.target.value)}
                  className={uiInputClassName}
                  placeholder="Es. 10"
                />
              </UiField>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <SummaryBox
                label="Fuel suggerito per giri"
                value={displayNumber(predictedFuelForLaps, " L")}
              />
              <SummaryBox
                label="Fuel suggerito per minuti"
                value={displayNumber(predictedFuelForMinutes, " L")}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              {averageFuelPerLap != null || averageFuelPerMinute != null ? (
                <>
                  <div>Media storica fuel/giro: <span className="font-bold text-[var(--text-primary)]">{displayNumber(averageFuelPerLap, " L")}</span></div>
                  <div>Media storica fuel/min: <span className="font-bold text-[var(--text-primary)]">{displayNumber(averageFuelPerMinute, " L")}</span></div>
                  <div className="mt-2">
                    Usa il valore più prudente tra giri e minuti quando le sessioni hanno molto traffico o tempi non costanti.
                  </div>
                </>
              ) : (
                <div>
                  Non ci sono ancora abbastanza dati fuel completi per generare una previsione attendibile. Compila fuel pre e post su almeno un turno completo.
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="La console è organizzata per consultazione rapida, dettaglio tecnico e inserimento turno separato."
      >
        <InfoBlock>
          Usa la vista sintetica per avere una timeline leggibile della giornata.
          Passa alla vista dettagliata quando vuoi controllare pressioni, delta pre/post, consumi fuel, temperature e target di ogni turno. Il form di inserimento o modifica si apre in drawer,
          così la pagina resta ordinata e facile da leggere in pista.
        </InfoBlock>
      </SectionCard>


      {compareTurns.length > 0 ? (
        <SectionCard
          title="Confronto turni"
          subtitle={
            compareTurns.length === 2
              ? "Lettura affiancata di due turni selezionati."
              : "Seleziona un secondo turno dalla timeline per attivare il confronto completo."
          }
          actions={
            <button
              type="button"
              onClick={() => setCompareTurnIds([])}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]"
            >
              Pulisci confronto
            </button>
          }
        >
          {compareTurns.length === 2 ? (
            <TurnComparePanel
              leftTurn={compareTurns[0]}
              rightTurn={compareTurns[1]}
              leftLabel={driverMap.get(compareTurns[0].driver_id || "") || "Turno A"}
              rightLabel={driverMap.get(compareTurns[1].driver_id || "") || "Turno B"}
            />
          ) : (
            <InfoBlock>
              Hai selezionato un turno per il confronto. Selezionane un secondo dalla timeline per confrontare tempi, fuel, pressioni e temperature.
            </InfoBlock>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Timeline turni"
        subtitle="Consulta lo storico in modalità sintetica o dettagliata senza appesantire la console."
        actions={
          <div className="inline-flex rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-1">
            <button
              type="button"
              onClick={() => setViewMode("synthetic")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                viewMode === "synthetic" ? "" : "text-[var(--text-secondary)]"
              }`}
              style={
                viewMode === "synthetic"
                  ? { backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }
                  : undefined
              }
            >
              Vista sintetica
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detailed")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                viewMode === "detailed" ? "" : "text-[var(--text-secondary)]"
              }`}
              style={
                viewMode === "detailed"
                  ? { backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }
                  : undefined
              }
            >
              Vista dettagliata
            </button>
          </div>
        }
      >
        {turns.length === 0 ? (
          <EmptyState
            title="Nessun turno registrato"
            description="Apri il drawer Nuovo turno e salva la prima sessione tecnica del mezzo."
          />
        ) : (
          <div className="space-y-4">
            {turns.map((turn) => {
              const metrics = turn.metrics;
              const driverName = turn.driver_id ? driverMap.get(turn.driver_id) : null;
              const sessionName = turn.event_session_id ? sessionMap.get(turn.event_session_id)?.name : null;
              const fuelUsed = getFuelUsed(turn);
              const fuelPerLap = getFuelPerLap(turn);
              const fuelPerMinute = getFuelPerMinute(turn);
              const warnings = buildTurnWarnings(turn);
              const isExpanded = viewMode === "detailed" || expandedTurnId === turn.id;

              const pressureDeltaFL = getPressureDelta(metrics?.pre_pressure_fl, metrics?.post_pressure_fl);
              const pressureDeltaFR = getPressureDelta(metrics?.pre_pressure_fr, metrics?.post_pressure_fr);
              const pressureDeltaRL = getPressureDelta(metrics?.pre_pressure_rl, metrics?.post_pressure_rl);
              const pressureDeltaRR = getPressureDelta(metrics?.pre_pressure_rr, metrics?.post_pressure_rr);

              const targetDeltaFL = getTargetDelta(metrics?.post_pressure_fl, metrics?.target_post_pressure_fl);
              const targetDeltaFR = getTargetDelta(metrics?.post_pressure_fr, metrics?.target_post_pressure_fr);
              const targetDeltaRL = getTargetDelta(metrics?.post_pressure_rl, metrics?.target_post_pressure_rl);
              const targetDeltaRR = getTargetDelta(metrics?.post_pressure_rr, metrics?.target_post_pressure_rr);
              const targetDeltaWater = getTargetDelta(metrics?.max_water_temp_c, metrics?.target_water_temp_c);
              const targetDeltaOil = getTargetDelta(metrics?.max_oil_temp_c, metrics?.target_oil_temp_c);

              return (
                <div
                  key={turn.id}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-bold text-[var(--text-primary)]">
                          {driverName || "Pilota non assegnato"}
                        </div>
                        {sessionName ? <StatusChip label={sessionName} /> : null}
                        {metrics?.track_condition ? (
                          <StatusChip label={trackConditionLabel(metrics.track_condition)} />
                        ) : null}
                        {compareTurnIds.includes(turn.id) ? (
                          <StatusChip label="Nel confronto" tone="success" />
                        ) : null}
                      </div>

                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        {formatDateTime(turn.recorded_at)} · {displayNumber(turn.minutes, " min")} · {displayNumber(turn.laps, " giri")}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
                        <SmallMetric label="Best lap" value={formatLapTime(metrics?.best_lap_ms)} />
                        <SmallMetric label="Fuel usato" value={fuelUsed != null ? `${fuelUsed} L` : "—"} />
                        <SmallMetric label="Fuel/giro" value={fuelPerLap != null ? `${fuelPerLap} L` : "—"} />
                        <SmallMetric label="Fuel/min" value={fuelPerMinute != null ? `${fuelPerMinute} L` : "—"} />
                        <SmallMetric label="Acqua max" value={displayNumber(metrics?.max_water_temp_c, "°C")} />
                        <SmallMetric label="Olio max" value={displayNumber(metrics?.max_oil_temp_c, "°C")} />
                        <SmallMetric label="Aria post" value={displayNumber(metrics?.post_air_temp_c, "°C")} />
                        <SmallMetric label="Asfalto post" value={displayNumber(metrics?.post_track_temp_c, "°C")} />
                      </div>

                      {warnings.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {warnings.map((warning) => (
                            <StatusChip key={warning.label} label={warning.label} tone={warning.tone} />
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                        {viewMode === "synthetic"
                          ? metrics?.technical_notes || turn.notes || "Nessuna nota registrata."
                          : metrics?.technical_notes || turn.notes || "Nessuna nota registrata."}
                      </div>

                      {isExpanded ? (
                        <div className="mt-4 space-y-4">
                          <DetailGrid title="Pre-turno">
                            <SmallMetric label="Aria pre" value={displayNumber(metrics?.pre_air_temp_c, "°C")} />
                            <SmallMetric label="Asfalto pre" value={displayNumber(metrics?.pre_track_temp_c, "°C")} />
                            <SmallMetric label="Fuel pre" value={displayNumber(turn.fuel_start_liters, " L")} />
                            <SmallMetric label="Apertura aria" value={displayNumber(metrics?.air_opening_cm, " cm")} />
                            <SmallMetric label="Apertura olio" value={displayNumber(metrics?.oil_opening_cm, " cm")} />
                            <SmallMetric label="Press. FL pre" value={displayNumber(metrics?.pre_pressure_fl, " bar")} />
                            <SmallMetric label="Press. FR pre" value={displayNumber(metrics?.pre_pressure_fr, " bar")} />
                            <SmallMetric label="Press. RL pre" value={displayNumber(metrics?.pre_pressure_rl, " bar")} />
                            <SmallMetric label="Press. RR pre" value={displayNumber(metrics?.pre_pressure_rr, " bar")} />
                          </DetailGrid>

                          <DetailGrid title="Post-turno e consumi">
                            <SmallMetric label="Aria post" value={displayNumber(metrics?.post_air_temp_c, "°C")} />
                            <SmallMetric label="Asfalto post" value={displayNumber(metrics?.post_track_temp_c, "°C")} />
                            <SmallMetric label="Fuel post" value={displayNumber(turn.fuel_end_liters, " L")} />
                            <SmallMetric label="Fuel usato" value={fuelUsed != null ? `${fuelUsed} L` : "—"} />
                            <SmallMetric label="Fuel/giro" value={fuelPerLap != null ? `${fuelPerLap} L` : "—"} />
                            <SmallMetric label="Fuel/min" value={fuelPerMinute != null ? `${fuelPerMinute} L` : "—"} />
                            <SmallMetric label="Temp. acqua max" value={displayNumber(metrics?.max_water_temp_c, "°C")} />
                            <SmallMetric label="Temp. olio max" value={displayNumber(metrics?.max_oil_temp_c, "°C")} />
                          </DetailGrid>

                          <DetailGrid title="Pressioni, delta e gomme">
                            <SmallMetric label="FL post / Δ" value={`${displayNumber(metrics?.post_pressure_fl, " bar")} / ${displayNumber(pressureDeltaFL, " bar")}`} />
                            <SmallMetric label="FR post / Δ" value={`${displayNumber(metrics?.post_pressure_fr, " bar")} / ${displayNumber(pressureDeltaFR, " bar")}`} />
                            <SmallMetric label="RL post / Δ" value={`${displayNumber(metrics?.post_pressure_rl, " bar")} / ${displayNumber(pressureDeltaRL, " bar")}`} />
                            <SmallMetric label="RR post / Δ" value={`${displayNumber(metrics?.post_pressure_rr, " bar")} / ${displayNumber(pressureDeltaRR, " bar")}`} />
                            <SmallMetric label="Temp. FL" value={displayNumber(metrics?.post_tyre_temp_fl, "°C")} />
                            <SmallMetric label="Temp. FR" value={displayNumber(metrics?.post_tyre_temp_fr, "°C")} />
                            <SmallMetric label="Temp. RL" value={displayNumber(metrics?.post_tyre_temp_rl, "°C")} />
                            <SmallMetric label="Temp. RR" value={displayNumber(metrics?.post_tyre_temp_rr, "°C")} />
                          </DetailGrid>

                          <DetailGrid title="Target e scostamenti">
                            <SmallMetric label="FL target / Δ" value={`${displayNumber(metrics?.target_post_pressure_fl, " bar")} / ${displayNumber(targetDeltaFL, " bar")}`} />
                            <SmallMetric label="FR target / Δ" value={`${displayNumber(metrics?.target_post_pressure_fr, " bar")} / ${displayNumber(targetDeltaFR, " bar")}`} />
                            <SmallMetric label="RL target / Δ" value={`${displayNumber(metrics?.target_post_pressure_rl, " bar")} / ${displayNumber(targetDeltaRL, " bar")}`} />
                            <SmallMetric label="RR target / Δ" value={`${displayNumber(metrics?.target_post_pressure_rr, " bar")} / ${displayNumber(targetDeltaRR, " bar")}`} />
                            <SmallMetric label="Acqua target / Δ" value={`${displayNumber(metrics?.target_water_temp_c, "°C")} / ${displayNumber(targetDeltaWater, "°C")}`} />
                            <SmallMetric label="Olio target / Δ" value={`${displayNumber(metrics?.target_oil_temp_c, "°C")} / ${displayNumber(targetDeltaOil, "°C")}`} />
                            <SmallMetric label="Giro medio" value={formatLapTime(metrics?.avg_lap_ms)} />
                            <SmallMetric label="Track condition" value={trackConditionLabel(metrics?.track_condition)} />
                          </DetailGrid>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 xl:w-[380px] xl:justify-end">
                      {viewMode === "synthetic" ? (
                        <button
                          type="button"
                          onClick={() => setExpandedTurnId(expandedTurnId === turn.id ? null : turn.id)}
                          className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]"
                        >
                          <ListFilter size={16} className="mr-2 inline" />
                          {expandedTurnId === turn.id ? "Chiudi dettagli" : "Apri dettagli"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => toggleCompareTurn(turn.id)}
                        className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]"
                        style={compareTurnIds.includes(turn.id) ? { backgroundColor: "var(--brand-accent-soft)", color: "var(--brand-accent)" } : undefined}
                      >
                        <ListFilter size={16} className="mr-2 inline" />
                        {compareTurnIds.includes(turn.id) ? "Rimuovi confronto" : compareTurnIds.length === 0 ? "Confronta" : "Seleziona confronto"}
                      </button>

                      <button
                        type="button"
                        onClick={() => editTurn(turn)}
                        disabled={!canEditEvents}
                        className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Edit2 size={16} className="mr-2 inline" />
                        Modifica
                      </button>

                      <InlineConfirmButton
                        label="Elimina"
                        message="Eliminare questo turno tecnico?"
                        onConfirm={() => deleteTurn(turn.id)}
                        className="rounded-xl bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100"
                        icon={<Trash2 size={16} className="mr-2 inline" />}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className={`h-full w-full max-w-[860px] overflow-y-auto bg-[var(--surface-page)] p-4 md:p-6 ${audiowide.className}`}>
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
              <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-black text-[var(--text-primary)]">
                      {editingTurnId ? "Modifica turno tecnico" : "Nuovo turno tecnico"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      Compila il turno senza perdere il contesto della console. Il salvataggio aggiorna subito la timeline.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-2 hover:bg-[var(--surface-muted)]"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {feedback ? (
                <FormStatusBanner type={feedback.type} message={feedback.message} />
              ) : null}

              <div className="space-y-6">
                <FormSection
                  title="Dati base turno"
                  subtitle="Sessione, pilota, durata, giri e dati carburante della sessione."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <UiField label="Data e ora turno">
                      <input
                        type="datetime-local"
                        value={form.recorded_at}
                        onChange={(e) => patchForm("recorded_at", e.target.value)}
                        className={uiInputClassName}
                      />
                    </UiField>

                    <UiField label="Sessione">
                      <select
                        value={form.event_session_id}
                        onChange={(e) => patchForm("event_session_id", e.target.value)}
                        className={uiInputClassName}
                      >
                        <option value="">Nessuna sessione collegata</option>
                        {sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.name}
                            {session.starts_at
                              ? ` • ${new Date(session.starts_at).toLocaleString("it-IT")}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </UiField>

                    <UiField label="Pilota">
                      <select
                        value={form.driver_id}
                        onChange={(e) => patchForm("driver_id", e.target.value)}
                        className={uiInputClassName}
                      >
                        <option value="">Seleziona pilota</option>
                        {availableDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.first_name} {driver.last_name}
                          </option>
                        ))}
                      </select>
                    </UiField>

                    <UiField label="Condizione pista">
                      <select
                        value={form.track_condition}
                        onChange={(e) => patchForm("track_condition", e.target.value)}
                        className={uiInputClassName}
                      >
                        <option value="dry">Asciutta</option>
                        <option value="damp">Umida</option>
                        <option value="wet">Bagnata</option>
                        <option value="mixed">Mista</option>
                      </select>
                    </UiField>

                    <UiField label="Durata turno (min)">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={form.minutes}
                        onChange={(e) => patchForm("minutes", e.target.value)}
                        placeholder="Es. 20"
                        className={uiInputClassName}
                      />
                    </UiField>

                    <UiField label="Giri effettuati">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.laps}
                        onChange={(e) => patchForm("laps", e.target.value)}
                        placeholder="Es. 12"
                        className={uiInputClassName}
                      />
                    </UiField>

                    <UiField label="Miglior giro" hint="Formato consigliato 1:42.350">
                      <input
                        value={form.best_lap}
                        onChange={(e) => patchForm("best_lap", e.target.value)}
                        placeholder="Es. 1:42.350"
                        className={uiInputClassName}
                      />
                    </UiField>

                    <UiField label="Giro medio" hint="Formato consigliato 1:43.120">
                      <input
                        value={form.avg_lap}
                        onChange={(e) => patchForm("avg_lap", e.target.value)}
                        placeholder="Es. 1:43.120"
                        className={uiInputClassName}
                      />
                    </UiField>

                    <UiField label="Fuel pre-turno (L)">
                      <input
                        type="number"
                        step="0.1"
                        value={form.fuel_start_liters}
                        onChange={(e) => patchForm("fuel_start_liters", e.target.value)}
                        placeholder="Es. 18.5"
                        className={uiInputClassName}
                      />
                    </UiField>

                    <UiField label="Fuel post-turno (L)">
                      <input
                        type="number"
                        step="0.1"
                        value={form.fuel_end_liters}
                        onChange={(e) => patchForm("fuel_end_liters", e.target.value)}
                        placeholder="Es. 10.8"
                        className={uiInputClassName}
                      />
                    </UiField>
                  </div>

                  <div className="mt-4">
                    <UiField label="Note generali turno">
                      <textarea
                        value={form.notes}
                        onChange={(e) => patchForm("notes", e.target.value)}
                        placeholder="Es. Traffico nella seconda parte, pista più gommata, pilota soddisfatto del bilanciamento..."
                        className={uiTextareaClassName}
                      />
                    </UiField>
                  </div>
                </FormSection>

                <FormSection
                  title="Pre-turno"
                  subtitle="Condizioni e configurazione di partenza prima di entrare in pista."
                >
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
                    <WheelGrid
                      title="Pressioni a freddo"
                      hint="Inserisci le pressioni pre-turno per singola ruota."
                      values={{ fl: form.pre_pressure_fl, fr: form.pre_pressure_fr, rl: form.pre_pressure_rl, rr: form.pre_pressure_rr }}
                      onChange={(key, value) =>
                        patchForm(({ fl: "pre_pressure_fl", fr: "pre_pressure_fr", rl: "pre_pressure_rl", rr: "pre_pressure_rr" } as const)[key], value)
                      }
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Post-turno"
                  subtitle="Rilevazioni a caldo, temperature gomme e temperature massime registrate."
                >
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
                    <WheelGrid
                      title="Pressioni a caldo"
                      hint="Rilevazioni post-turno per singola ruota."
                      values={{ fl: form.post_pressure_fl, fr: form.post_pressure_fr, rl: form.post_pressure_rl, rr: form.post_pressure_rr }}
                      onChange={(key, value) =>
                        patchForm(({ fl: "post_pressure_fl", fr: "post_pressure_fr", rl: "post_pressure_rl", rr: "post_pressure_rr" } as const)[key], value)
                      }
                    />

                    <WheelGrid
                      title="Temperature gomme post-turno (°C)"
                      hint="Versione base: una temperatura per ruota."
                      values={{ fl: form.post_tyre_temp_fl, fr: form.post_tyre_temp_fr, rl: form.post_tyre_temp_rl, rr: form.post_tyre_temp_rr }}
                      onChange={(key, value) =>
                        patchForm(({ fl: "post_tyre_temp_fl", fr: "post_tyre_temp_fr", rl: "post_tyre_temp_rl", rr: "post_tyre_temp_rr" } as const)[key], value)
                      }
                      placeholders={{ fl: "Es. 72", fr: "Es. 73", rl: "Es. 68", rr: "Es. 69" }}
                    />
                  </div>

                  <div className="mt-4">
                    <UiField label="Note tecniche turno">
                      <textarea
                        value={form.technical_notes}
                        onChange={(e) => patchForm("technical_notes", e.target.value)}
                        placeholder="Es. Pressione anteriore destra leggermente alta, vettura migliorata in inserimento, posteriore più stabile..."
                        className={uiTextareaClassName}
                      />
                    </UiField>
                  </div>
                </FormSection>

                <FormSection
                  title="Target tecnici"
                  subtitle="Obiettivi post-turno per confrontare immediatamente le rilevazioni reali."
                >
                  <div className="space-y-4">
                    <WheelGrid
                      title="Target pressioni post-turno"
                      values={{ fl: form.target_post_pressure_fl, fr: form.target_post_pressure_fr, rl: form.target_post_pressure_rl, rr: form.target_post_pressure_rr }}
                      onChange={(key, value) =>
                        patchForm(({ fl: "target_post_pressure_fl", fr: "target_post_pressure_fr", rl: "target_post_pressure_rl", rr: "target_post_pressure_rr" } as const)[key], value)
                      }
                    />

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
              </div>

              <div className="sticky bottom-0 z-10 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-lg">
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-bold hover:bg-[var(--surface-muted)]"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={saveTurn}
                    disabled={!canEditEvents || saving}
                    className="rounded-xl px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }}
                  >
                    <Save size={16} className="mr-2 inline" />
                    {saving ? "Salvataggio..." : editingTurnId ? "Aggiorna turno" : "Salva turno"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
