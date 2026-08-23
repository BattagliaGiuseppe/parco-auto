"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, CalendarClock, Gauge, TimerReset, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import { useLanguage } from "@/components/providers/LanguageProvider";

type PerformanceRow = {
  id: string;
  event_id: string | null;
  event_name: string;
  car_name: string;
  recorded_at: string | null;
  minutes: number;
  laps: number;
  best_lap_ms: number | null;
  avg_lap_ms: number | null;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function formatLapTime(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return "—";
  const ms = Math.round(Number(value));
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

export default function DriverPerformancePage() {
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
  const access = usePermissionAccess();
  const canViewDrivers = access.hasPermission("drivers.view");
  const params = useParams();
  const driverId = params?.id as string;
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const ctx = await getCurrentTeamContext();
        const [driverRes, turnsRes, metricsRes, eventCarsRes, eventsRes, carsRes] = await Promise.all([
          supabase.from("drivers").select("id,first_name,last_name").eq("team_id", ctx.teamId).eq("id", driverId).single(),
          supabase
            .from("event_car_turns")
            .select("id,driver_id,event_car_id,recorded_at,minutes,laps,created_at")
            .eq("team_id", ctx.teamId)
            .eq("driver_id", driverId),
          supabase.from("event_car_turn_metrics").select("turn_id,best_lap_ms,avg_lap_ms").eq("team_id", ctx.teamId),
          supabase.from("event_cars").select("id,event_id,car_id").eq("team_id", ctx.teamId),
          supabase.from("events").select("id,name,date").eq("team_id", ctx.teamId),
          supabase.from("cars").select("id,name").eq("team_id", ctx.teamId),
        ]);

        if (driverRes.error) throw driverRes.error;
        if (turnsRes.error) throw turnsRes.error;
        if (metricsRes.error) throw metricsRes.error;
        if (eventCarsRes.error) throw eventCarsRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (carsRes.error) throw carsRes.error;

        const metricsMap = new Map<string, any>((metricsRes.data || []).map((row: any) => [String(row.turn_id), row]));
        const eventCarMap = new Map<string, any>((eventCarsRes.data || []).map((row: any) => [String(row.id), row]));
        const eventMap = new Map<string, any>((eventsRes.data || []).map((row: any) => [String(row.id), row]));
        const carMap = new Map<string, any>((carsRes.data || []).map((row: any) => [String(row.id), row]));

        const nextRows: PerformanceRow[] = (turnsRes.data || []).map((turn: any) => {
          const eventCar = eventCarMap.get(String(turn.event_car_id));
          const eventInfo = eventCar?.event_id ? eventMap.get(String(eventCar.event_id)) : null;
          const carInfo = eventCar?.car_id ? carMap.get(String(eventCar.car_id)) : null;
          const metrics = metricsMap.get(String(turn.id));
          return {
            id: String(turn.id),
            event_id: eventCar?.event_id ? String(eventCar.event_id) : null,
            event_name: eventInfo?.name || tr("Evento senza nome"),
            car_name: carInfo?.name || tr("Auto non indicata"),
            recorded_at: turn.recorded_at || turn.created_at || null,
            minutes: Number(turn.minutes || 0),
            laps: Number(turn.laps || 0),
            best_lap_ms: metrics?.best_lap_ms != null ? Number(metrics.best_lap_ms) : null,
            avg_lap_ms: metrics?.avg_lap_ms != null ? Number(metrics.avg_lap_ms) : null,
          };
        });

        nextRows.sort((a, b) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime());
        setDriver(driverRes.data);
        setRows(nextRows);
      } catch (error) {
        console.error(error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    if (!access.loading && canViewDrivers && driverId) void load();
  }, [access.loading, canViewDrivers, driverId]);

  const summary = useMemo(() => {
    const eventIds = new Set(rows.map((row) => row.event_id).filter(Boolean));
    const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
    const totalLaps = rows.reduce((sum, row) => sum + row.laps, 0);
    const bestValues = rows.map((row) => row.best_lap_ms).filter((value): value is number => value != null && Number.isFinite(value));
    const avgValues = rows.map((row) => row.avg_lap_ms).filter((value): value is number => value != null && Number.isFinite(value));
    return {
      events: eventIds.size,
      turns: rows.length,
      hours: round1(totalMinutes / 60),
      laps: totalLaps,
      bestLap: bestValues.length ? Math.min(...bestValues) : null,
      avgLap: avgValues.length ? Math.round(avgValues.reduce((sum, value) => sum + value, 0) / avgValues.length) : null,
    };
  }, [rows]);

  if (!access.loading && !canViewDrivers) {
    return (
      <PagePermissionState
        title={tr("Performance pilota")}
        subtitle={tr("Dati calcolati dai turni registrati")}
        icon={<Activity size={22} />}
        state="denied"
        message={tr("Il tuo ruolo non può visualizzare le performance pilota.")}
      />
    );
  }

  const driverName = driver ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim() : tr("Pilota");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`${tr("Performance")} · ${driverName}`}
        subtitle={tr("Dati calcolati dagli stessi turni mostrati nella scheda sintetica del pilota.")}
        icon={<Activity size={22} />}
        actions={
          <Link
            href={`/drivers/${driverId}`}
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.07] px-4 py-2 font-bold text-white hover:bg-white/[0.12]"
          >
            <ArrowLeft size={16} className="mr-2" />
            {tr("Scheda profilo")}
          </Link>
        }
      />

      <SectionCard>
        <StatsGrid
          items={[
            { label: "Eventi", value: String(summary.events), icon: <Trophy size={18} /> },
            { label: "Turni", value: String(summary.turns), icon: <TimerReset size={18} /> },
            { label: "Ore guida", value: `${summary.hours} h`, icon: <CalendarClock size={18} /> },
            { label: "Giri", value: String(summary.laps), icon: <Gauge size={18} /> },
            { label: "Best lap", value: formatLapTime(summary.bestLap), icon: <Activity size={18} /> },
          ]}
        />
      </SectionCard>

      <SectionCard
        title={tr("Performance eventi")}
        subtitle={tr("Storico dei turni registrati per il pilota, con auto, durata, giri e tempi.")}
      >
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-sm font-semibold text-[var(--text-muted)]">
            {tr("Caricamento performance...")}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={tr("Nessun turno/evento collegato al pilota.")} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-7 gap-2 bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">
              <span>{tr("Data")}</span>
              <span className="col-span-2">{tr("Evento")}</span>
              <span>{tr("Auto")}</span>
              <span>{tr("Durata")}</span>
              <span>{tr("Giri")}</span>
              <span>{tr("Best lap")}</span>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-7 gap-2 border-t border-white/10 px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                <span>{formatDateTime(row.recorded_at)}</span>
                <span className="col-span-2 truncate text-[var(--text-primary)]">{row.event_name}</span>
                <span className="truncate">{row.car_name}</span>
                <span>{row.minutes} min</span>
                <span>{row.laps}</span>
                <span>{formatLapTime(row.best_lap_ms)}</span>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{tr("Media tempi")}</div>
              <div className="mt-1 text-lg font-black text-[var(--text-primary)]">{formatLapTime(summary.avgLap)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{tr("Fonte dati")}</div>
              <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">event_car_turns + event_car_turn_metrics</div>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
