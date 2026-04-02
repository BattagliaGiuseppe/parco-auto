"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";

export default function CarDocumentsPage() {
  const params = useParams();
  const carId = params?.id as string;
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('team_id', ctx.teamId)
      .eq('car_id', carId)
      .order('uploaded_at', { ascending: false });
    setRows(data || []);
  }

  useEffect(() => { if (carId) void load(); }, [carId]);

  async function addDoc() {
    if (!title.trim() && !type.trim() && !fileUrl.trim() && !file) {
      alert('Inserisci almeno un titolo, un tipo documento o carica un file');
      return;
    }
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      let payload: any = {
        team_id: ctx.teamId,
        car_id: carId,
        title: title.trim() || type.trim() || 'Documento',
        type: type.trim() || null,
        file_url: fileUrl.trim() || null,
        notes: notes.trim() || null,
        uploaded_by_team_user_id: ctx.teamUserId,
      };
      if (file) {
        const upload = await uploadTeamFile({ file, area: 'car-documents', recordId: carId });
        payload = {
          ...payload,
          file_url: upload.publicUrl,
          storage_path: upload.path,
          file_name: upload.fileName,
          mime_type: upload.mimeType,
          size_bytes: upload.sizeBytes,
        };
      }
      const { error } = await supabase.from('documents').insert([payload]);
      if (error) throw error;
      setTitle(''); setType(''); setFileUrl(''); setNotes(''); setFile(null);
      await load();
    } catch (error) {
      console.error(error);
      alert('Errore salvataggio documento');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Documenti mezzo" subtitle="Archivio allegati, caricamento file locale e link esterni" icon={<FileText size={22} />} actions={<Link href={`/cars/${carId}`} className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="mr-2 inline" />Scheda mezzo</Link>} />
      <SectionCard title="Nuovo documento" subtitle="Compila almeno un campo utile o carica un file">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input className="rounded-xl border p-3" placeholder="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Tipo documento" value={type} onChange={(e) => setType(e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="URL file esterno (opzionale)" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
          <input className="rounded-xl border p-3" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <textarea className="rounded-xl border p-3 md:col-span-2 min-h-24" placeholder="Note" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="mt-4"><button onClick={addDoc} disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><Upload size={16} className="mr-2 inline" />{saving ? 'Caricamento...' : 'Aggiungi documento'}</button></div>
      </SectionCard>
      <SectionCard title="Archivio documenti">
        {rows.length === 0 ? <EmptyState title="Nessun documento caricato" /> : <div className="space-y-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-4"><div className="font-bold text-neutral-900">{row.title || row.type || 'Documento'}</div><div className="mt-1 text-sm text-neutral-500">{new Date(row.uploaded_at).toLocaleString('it-IT')}</div>{row.notes ? <div className="mt-2 text-sm text-neutral-600">{row.notes}</div> : null}{row.file_url ? <a href={row.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold">Apri file</a> : null}</div>)}</div>}
      </SectionCard>
    </div>
  );
}
