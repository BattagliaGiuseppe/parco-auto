"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";

export default function CarDocumentsPage() {
  const params = useParams();
  const carId = params?.id as string;
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  async function load() {
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase.from("documents").select("*").eq("team_id", ctx.teamId).eq("car_id", carId).order("uploaded_at", { ascending: false });
    setRows(data || []);
  }

  useEffect(() => { if (carId) load(); }, [carId]);

  async function addDoc() {
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("documents").insert([{ team_id: ctx.teamId, car_id: carId, type, file_url: fileUrl }]);
    if (!error) { setType(""); setFileUrl(""); await load(); }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Documenti auto" subtitle="Archivio file collegati alla vettura" icon={<FileText size={22} />} actions={<Link href={`/cars/${carId}`} className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="inline mr-2" />Scheda auto</Link>} />
      <SectionCard title="Nuovo documento"><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><input className="rounded-xl border p-3" placeholder="Tipo documento" value={type} onChange={(e) => setType(e.target.value)} /><input className="rounded-xl border p-3" placeholder="URL file" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} /></div><div className="mt-4"><button onClick={addDoc} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><Upload size={16} className="inline mr-2" />Aggiungi documento</button></div></SectionCard>
      <SectionCard title="Archivio">{rows.length === 0 ? <EmptyState title="Nessun documento caricato" /> : <div className="space-y-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-4"><div className="font-bold text-neutral-900">{row.type || 'Documento'}</div><div className="mt-1 text-sm text-neutral-500">{new Date(row.uploaded_at).toLocaleString('it-IT')}</div>{row.file_url ? <a href={row.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold">Apri file</a> : null}</div>)}</div>}</SectionCard>
    </div>
  );
}
