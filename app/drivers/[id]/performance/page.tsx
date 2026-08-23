"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Gauge, TimerReset, Trophy } from "lucide-react";
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

type PerformanceSummary = {
  events: number;
  turns: number;
  minutes: number;
  laps: number;
  best_lap_ms: number | null;
  avg_lap_ms: number | null;
};

const PAGE_SIZE = 50;

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
  const [summary, setSummary] = useState<PerformanceSummary>({ events: 0, turns: 0, minutes: 0, laps: 0, best_lap_ms: null, avg_lap_ms: null });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const ctx = await getCurrentTeamContext();
        const { data, error: rpcError } = await supabase.rpc("driver_performance_page", {
          p_team_id: ctx.teamId,
          p_driver_id: driverId,
          p_page: page,
          p_page_size: PAGE_SIZE,
        });
        if (rpcError) throw rpcError;

        const payload = (data || {}) as any;
        setDriver(payload.driver || null);
        setRows((payload.rows || []) as PerformanceRow[]);
        setSummary({
          events: Number(payload.summary?.events || 0),
          turns: Number(payload.summary?.turns || 0),
          minutes: Number(payload.summary?.minutes || 0),
          laps: Number(payload.summary?.laps || 0),
          best_lap_ms: payload.summary?.best_lap_ms == null ? null : Number(payload.summary.best_lap_ms),
          avg_lap_ms: payload.summary?.avg_lap_ms == null ? null : Number(payload.summary.avg_lap_ms),
        });
        setTotal(Number(payload.total || 0));
      } catch (err: any) {
        console.error(err);
        setRows([]);
        setError(err?.message || tr("Errore durante il caricamento delle performance."));
      } finally {
        setLoading(false);
      }
    }

    if (!access.loading && canViewDrivers && driverId) void load();
  }, [access.loading, canViewDrivers, driverId, page]);

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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`${tr("Performance")} · ${driverName}`}
        subtitle={tr("Dati aggregati lato server sull'intero storico del pilota.")}
        icon={<Activity size={22} />}
        actions={
          <Link href={`/drivers/${driverId}`} className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.07] px-4 py-2 font-bold text-white hover:bg-white/[0.12]">
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
            { label: "Ore guida", value: `${round1(summary.minutes / 60)} h`, icon: <CalendarClock size={18} /> },
            { label: "Giri", value: String(summary.laps), icon: <Gauge size={18} /> },
            { label: "Best lap", value: formatLapTime(summary.best_lap_ms), icon: <Activity size={18} /> },
          ]}
        />
      </SectionCard>

      <SectionCard title={tr("Performance eventi")} subtitle={tr("Storico paginato dei turni, con statistiche globali calcolate sul database.")}>
        {error ? <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{error}</div> : null}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-sm font-semibold text-[var(--text-muted)]">{tr("Caricamento performance...")}</div>
        ) : rows.length === 0 ? (
          <EmptyState title={tr("Nessun turno/evento collegato al pilota.")} />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-7 gap-2 bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                <span>{tr("Data")}</span><span className="col-span-2">{tr("Evento")}</span><span>{tr("Auto")}</span><span>{tr("Durata")}</span><span>{tr("Giri")}</span><span>{tr("Best lap")}</span>
              </div>
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-7 gap-2 border-t border-white/10 px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                  <span>{formatDateTime(row.recorded_at)}</span>
                  <span className="col-span-2 truncate text-[var(--text-primary)]">{row.event_name || tr("Evento senza nome")}</span>
                  <span className="truncate">{row.car_name || tr("Auto non indicata")}</span>
                  <span>{row.minutes} min</span><span>{row.laps}</span><span>{formatLapTime(row.best_lap_ms)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="text-sm font-semibold text-[var(--text-muted)]">{tr("Pagina")} {page} / {totalPages} · {total} {tr("turni")}</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-sm font-bold text-white disabled:opacity-40"><ChevronLeft size={16} />{tr("Indietro")}</button>
                <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-sm font-bold text-white disabled:opacity-40">{tr("Avanti")}<ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}

        {summary.turns > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{tr("Media tempi")}</div><div className="mt-1 text-lg font-black text-[var(--text-primary)]">{formatLapTime(summary.avg_lap_ms)}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><div className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{tr("Fonte dati")}</div><div className="mt-1 text-sm font-bold text-[var(--text-primary)]">event_car_turns + event_car_turn_metrics</div></div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
