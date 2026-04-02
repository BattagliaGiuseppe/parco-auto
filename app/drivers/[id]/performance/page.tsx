"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";

export default function DriverPerformancePage() {
  const params = useParams();
  const driverId = params?.id as string;
  const [rows, setRows] = useState<any[]>([]);
  const [driver, setDriver] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const ctx = await getCurrentTeamContext();
      const [{ data: perf }, { data: d }] = await Promise.all([
        supabase.from("driver_session_performance").select("*").eq("team_id", ctx.teamId).eq("driver_id", driverId).order("created_at", { ascending: false }),
        supabase.from("drivers").select("*").eq("team_id", ctx.teamId).eq("id", driverId).single(),
      ]);
      setRows(perf || []);
      setDriver(d);
    }
    if (driverId) load();
  }, [driverId]);

  const stats = useMemo(() => {
    const incidents = rows.reduce((acc, row) => acc + Number(row.incidents || 0), 0);
    return [
      { label: "Sessioni", value: String(rows.length), icon: <Activity size={18} /> },
      { label: "Best lap", value: rows[0]?.best_lap_time || '—' },
      { label: "Media", value: rows[0]?.average_lap_time || '—' },
      { label: "Incidenti", value: String(incidents) },
    ];
  }, [rows]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={`Performance · ${driver ? `${driver.first_name} ${driver.last_name}` : 'Pilota'}`} subtitle="Storico sintetico prestazioni" icon={<Activity size={22} />} actions={<Link href={`/drivers/${driverId}`} className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="inline mr-2" />Scheda pilota</Link>} />
      <SectionCard><StatsGrid items={stats} /></SectionCard>
      <SectionCard title="Storico sessioni">
        {rows.length === 0 ? <EmptyState title="Nessuna performance registrata" /> : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="font-bold text-neutral-900">{row.event_name || 'Evento'} · {row.session_name || 'Sessione'}</div>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4 text-sm text-neutral-700">
                  <div>Best: {row.best_lap_time || '—'}</div>
                  <div>Media: {row.average_lap_time || '—'}</div>
                  <div>Consistenza: {row.consistency ?? '—'}</div>
                  <div>Incidenti: {row.incidents ?? 0}</div>
                </div>
                {row.notes ? <div className="mt-3 text-sm text-neutral-600">{row.notes}</div> : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
