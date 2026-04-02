"use client";

import { useEffect, useState } from "react";
import { Activity, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";

export default function TelemetryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  async function load() {
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase.from("telemetry_files").select("*").eq("team_id", ctx.teamId).order("created_at", { ascending: false });
    setRows(data || []);
  }

  useEffect(() => { load(); }, []);

  async function addFile() {
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("telemetry_files").insert([{ team_id: ctx.teamId, file_name: fileName, file_url: fileUrl || null }]);
    if (!error) {
      setFileName(""); setFileUrl(""); await load();
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Telemetria" subtitle="Archivio file collegati a sessioni ed eventi" icon={<Activity size={22} />} />
      <SectionCard title="Nuovo file">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input className="rounded-xl border p-3" placeholder="Nome file" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="URL file" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
        </div>
        <div className="mt-4"><button onClick={addFile} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><Upload size={16} className="inline mr-2" />Registra file</button></div>
      </SectionCard>
      <SectionCard title="Archivio telemetria">
        {rows.length === 0 ? <EmptyState title="Nessun file registrato" /> : <div className="space-y-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-4"><div className="font-bold text-neutral-900">{row.file_name || 'File telemetria'}</div><div className="mt-1 text-sm text-neutral-500">{new Date(row.created_at).toLocaleString('it-IT')}</div>{row.file_url ? <a href={row.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold">Apri file</a> : null}</div>)}</div>}
      </SectionCard>
    </div>
  );
}
