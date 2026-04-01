"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity, TimerReset, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type DriverRow = { id: string; first_name: string; last_name: string; nickname: string | null };
type PerformanceRow = {
  id: string;
  session_name?: string | null;
  event_name?: string | null;
  car_name?: string | null;
  best_lap_time?: string | null;
  average_lap_time?: string | null;
  consistency?: number | null;
  incidents?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

function parseLapToSeconds(value: string | null | undefined) {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

export default function DriverPerformancePage() {
  const params = useParams();
  const driverId = params?.id as string;

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");
        const [{ data: driverData, error: driverError }, { data, error }] = await Promise.all([
          supabase.from("drivers").select("id, first_name, last_name, nickname").eq("id", driverId).single(),
          supabase.from("driver_session_performance").select("*").eq("driver_id", driverId).order("created_at", { ascending: false }),
        ]);

        if (driverError) throw driverError;
        if (error) throw error;

        setDriver(driverData as DriverRow);
        setRows((data || []) as PerformanceRow[]);
      } catch (error: any) {
        console.error(error);
        setErrorMessage(
          "Il modulo performance richiede la tabella driver_session_performance. Esegui prima la migrazione SQL dedicata."
        );
      } finally {
        setLoading(false);
      }
    }

    if (driverId) loadData();
  }, [driverId]);

  const bestLap = useMemo(() => {
    let best: { label: string; seconds: number } | null = null;
    for (const row of rows) {
      const sec = parseLapToSeconds(row.best_lap_time);
      if (sec === null) continue;
      if (!best || sec < best.seconds) best = { label: row.best_lap_time || "—", seconds: sec };
    }
    return best?.label || "—";
  }, [rows]);

  const avgConsistency = useMemo(() => {
    const values = rows.map((row) => row.consistency).filter((value): value is number => typeof value === "number");
    if (!values.length) return "—";
    return (values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2);
  }, [rows]);

  const totalIncidents = useMemo(() => rows.reduce((acc, row) => acc + Number(row.incidents || 0), 0), [rows]);

  const stats: StatItem[] = [
    { label: "Best lap", value: bestLap, icon: <TimerReset size={18} /> },
    { label: "Costanza media", value: avgConsistency, icon: <TrendingUp size={18} /> },
    { label: "Sessioni registrate", value: String(rows.length), icon: <Activity size={18} /> },
    { label: "Incidenti", value: String(totalIncidents), icon: <AlertTriangle size={18} />, valueClassName: totalIncidents > 0 ? "text-red-700" : "text-green-700" },
  ];

  if (loading) return <div className="card-base p-10 text-center text-neutral-500">Caricamento performance...</div>;
  if (errorMessage) return <EmptyState title="Performance non disponibili" description={errorMessage} />;

  const driverLabel = driver ? `${driver.first_name} ${driver.last_name}` : "Pilota";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Performance • ${driverLabel}`}
        subtitle="Storico sintetico delle performance pilota"
        icon={<Activity size={22} />}
        actions={
          <Link href={`/drivers/${driverId}`} className="btn-secondary">
            <ArrowLeft size={16} />
            Torna al pilota
          </Link>
        }
      />

      <SectionCard title="Riepilogo">
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard title="Storico performance" subtitle="Archivio sessioni e note">
        {rows.length === 0 ? (
          <EmptyState title="Nessuna performance registrata" description="In questa versione il modulo è pronto ma non ha ancora dati collegati." />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-bold text-neutral-900">{row.session_name || "Sessione"}</div>
                    <div className="mt-1 text-sm text-neutral-500">{row.event_name || "Evento"} • {row.car_name || "Auto"}</div>
                  </div>
                  <StatusBadge label={row.created_at ? new Date(row.created_at).toLocaleDateString("it-IT") : "storico"} tone="blue" />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <MiniValue label="Best lap" value={row.best_lap_time || "—"} />
                  <MiniValue label="Lap medio" value={row.average_lap_time || "—"} />
                  <MiniValue label="Costanza" value={typeof row.consistency === "number" ? row.consistency.toFixed(2) : "—"} />
                  <MiniValue label="Incidenti" value={String(row.incidents || 0)} />
                </div>

                {row.notes ? (
                  <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-800 whitespace-pre-wrap">{row.notes}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
