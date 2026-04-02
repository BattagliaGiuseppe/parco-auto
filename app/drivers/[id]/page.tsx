"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserRound, ShieldCheck, FileText, Activity, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params?.id as string;
  const [driver, setDriver] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [licenseForm, setLicenseForm] = useState({ license_type: '', license_number: '', expiry_date: '' });
  const [documentForm, setDocumentForm] = useState({ title: '', document_type: '', expires_at: '' });
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  async function load() {
    const ctx = await getCurrentTeamContext();
    const [driverRes, licensesRes, documentsRes] = await Promise.all([
      supabase.from('drivers').select('*').eq('team_id', ctx.teamId).eq('id', driverId).single(),
      supabase.from('driver_licenses').select('*').eq('team_id', ctx.teamId).eq('driver_id', driverId).order('created_at', { ascending: false }),
      supabase.from('driver_documents').select('*').eq('team_id', ctx.teamId).eq('driver_id', driverId).order('created_at', { ascending: false }),
    ]);
    setDriver(driverRes.data);
    setLicenses(licensesRes.data || []);
    setDocuments(documentsRes.data || []);
  }

  useEffect(() => { if (driverId) void load(); }, [driverId]);

  async function addLicense() {
    const ctx = await getCurrentTeamContext();
    if (!licenseForm.license_type.trim()) return;
    const { error } = await supabase.from('driver_licenses').insert([{ team_id: ctx.teamId, driver_id: driverId, ...licenseForm }]);
    if (!error) { setLicenseForm({ license_type: '', license_number: '', expiry_date: '' }); await load(); }
  }

  async function addDocument() {
    const ctx = await getCurrentTeamContext();
    if (!documentForm.title.trim() && !documentForm.document_type.trim() && !documentFile) {
      alert('Inserisci almeno titolo/tipo o carica un file');
      return;
    }
    let payload: any = {
      team_id: ctx.teamId,
      driver_id: driverId,
      title: documentForm.title || documentForm.document_type || 'Documento pilota',
      document_type: documentForm.document_type || null,
      expires_at: documentForm.expires_at || null,
      uploaded_by_team_user_id: ctx.teamUserId,
    };
    if (documentFile) {
      const upload = await uploadTeamFile({ file: documentFile, area: 'driver-documents', recordId: driverId });
      payload = { ...payload, file_url: upload.publicUrl, file_name: upload.fileName, storage_path: upload.path, mime_type: upload.mimeType, size_bytes: upload.sizeBytes };
    }
    const { error } = await supabase.from('driver_documents').insert([payload]);
    if (!error) { setDocumentForm({ title: '', document_type: '', expires_at: '' }); setDocumentFile(null); await load(); }
  }

  if (!driver) return <div className="p-6 text-neutral-500">Caricamento pilota...</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={`${driver.first_name} ${driver.last_name}`} subtitle="Scheda pilota con documenti, licenze e storico tecnico" icon={<UserRound size={22} />} actions={<><Link href={`/drivers/${driver.id}/performance`} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Performance</Link><Link href="/drivers" className="rounded-xl bg-neutral-100 px-4 py-2"> <ArrowLeft size={16} className="mr-2 inline" />Indietro</Link></>} />
      <SectionCard><StatsGrid items={[{ label: 'Licenze', value: String(licenses.length), icon: <ShieldCheck size={18} /> },{ label: 'Documenti', value: String(documents.length), icon: <FileText size={18} /> },{ label: 'Email', value: driver.email || '—' },{ label: 'Telefono', value: driver.phone || '—' }]} /></SectionCard>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Licenze" subtitle="Storico e scadenze licenze pilota">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input className="rounded-xl border p-3" placeholder="Tipo licenza" value={licenseForm.license_type} onChange={(e) => setLicenseForm({ ...licenseForm, license_type: e.target.value })} />
            <input className="rounded-xl border p-3" placeholder="Numero" value={licenseForm.license_number} onChange={(e) => setLicenseForm({ ...licenseForm, license_number: e.target.value })} />
            <input type="date" className="rounded-xl border p-3" value={licenseForm.expiry_date} onChange={(e) => setLicenseForm({ ...licenseForm, expiry_date: e.target.value })} />
          </div>
          <div className="mt-3"><button onClick={addLicense} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><PlusCircle size={16} className="mr-2 inline" />Aggiungi licenza</button></div>
          <div className="mt-4 space-y-3">
            {licenses.length === 0 ? <EmptyState title="Nessuna licenza registrata" /> : licenses.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{row.license_type}</div><div className="mt-1 text-sm text-neutral-500">{row.license_number || 'Numero non inserito'}{row.expiry_date ? ` · scade il ${new Date(row.expiry_date).toLocaleDateString('it-IT')}` : ''}</div></div>)}
          </div>
        </SectionCard>

        <SectionCard title="Documenti" subtitle="Upload file locale o archivio documentale pilota">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input className="rounded-xl border p-3" placeholder="Titolo" value={documentForm.title} onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })} />
            <input className="rounded-xl border p-3" placeholder="Tipo documento" value={documentForm.document_type} onChange={(e) => setDocumentForm({ ...documentForm, document_type: e.target.value })} />
            <input type="date" className="rounded-xl border p-3" value={documentForm.expires_at} onChange={(e) => setDocumentForm({ ...documentForm, expires_at: e.target.value })} />
            <input className="md:col-span-3 rounded-xl border p-3" type="file" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} />
          </div>
          <div className="mt-3"><button onClick={addDocument} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><PlusCircle size={16} className="mr-2 inline" />Aggiungi documento</button></div>
          <div className="mt-4 space-y-3">
            {documents.length === 0 ? <EmptyState title="Nessun documento registrato" /> : documents.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{row.title || row.document_type || 'Documento pilota'}</div><div className="mt-1 text-sm text-neutral-500">{row.expires_at ? `Scadenza ${new Date(row.expires_at).toLocaleDateString('it-IT')}` : 'Nessuna scadenza'}{row.file_name ? ` · ${row.file_name}` : ''}</div>{row.file_url ? <a href={row.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold">Apri file</a> : null}</div>)}
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Note">{driver.notes ? <div className="whitespace-pre-wrap text-sm text-neutral-700">{driver.notes}</div> : <EmptyState title="Nessuna nota pilota" />}</SectionCard>
    </div>
  );
}
