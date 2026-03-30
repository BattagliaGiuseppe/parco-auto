"use client";

import { useEffect, useState } from "react";
import { Activity, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type TelemetryRow = {
  id: string;
  file_name: string | null;
  file_url: string | null;
  driver_id: string | null;
  car_id: string | null;
  event_id: string | null;
  session_id: string | null;
  created_at: string;
};

export default function TelemetryPage() {
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const ctx = await getCurrentTeamContext();

      const { data, error } = await supabase
        .from("telemetry_files")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data || []) as TelemetryRow[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function addRow() {
    if (!fileName.trim()) return;

    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.from("telemetry_files").insert([
        {
          team_id: ctx.teamId,
          file_name: fileName.trim(),
          file_url: fileUrl.trim() || null,
        },
      ]);

      if (error) throw error;

      setFileName("");
      setFileUrl("");
      await loadData();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Telemetria"
        subtitle="Archivio file telemetria collegabili a evento, sessione, auto e pilota"
        icon={<Activity size={22} />}
      />

      <SectionCard title="Nuovo file" subtitle="Prima versione archivio telemetria">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            className="input-base"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Nome file"
          />
          <input
            className="input-base"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="URL file"
          />
        </div>

        <div className="mt-4">
          <button onClick={addRow} className="btn-primary">
            <Upload size={16} />
            Registra file
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Archivio telemetria" subtitle="Elenco file registrati">
        {loading ? (
          <div className="text-sm text-neutral-500">Caricamento...</div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nessun file telemetria registrato" />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-bold text-neutral-900">{row.file_name || "File telemetria"}</div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {new Date(row.created_at).toLocaleString("it-IT")}
                    </div>
                  </div>

                  <StatusBadge label="Archivio" tone="blue" />
                </div>

                {row.file_url ? (
                  <div className="mt-3">
                    <a
                      href={row.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      Apri file
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}