"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatsGrid from "@/components/StatsGrid";
import PagePermissionState from "@/components/PagePermissionState";

export default function TelemetryPage() {
  const access = usePermissionAccess();
  const canViewTelemetry = access.hasPermission("telemetry.view");
  const canEditTelemetry = access.hasPermission("telemetry.edit", ["owner", "admin"]);

  const [rows, setRows] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [form, setForm] = useState({ file_name: '', notes: '', car_id: '', driver_id: '', event_id: '', session_id: '' });
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState('');

  async function load() {
    const ctx = await getCurrentTeamContext();
    const [filesRes, carsRes, driversRes, eventsRes, sessionsRes] = await Promise.all([
      supabase.from('telemetry_files').select('*').eq('team_id', ctx.teamId).order('created_at', { ascending: false }),
      supabase.from('cars').select('id,name').eq('team_id', ctx.teamId),
      supabase.from('drivers').select('id,first_name,last_name').eq('team_id', ctx.teamId),
      supabase.from('events').select('id,name').eq('team_id', ctx.teamId),
      supabase.from('event_sessions').select('id,name').eq('team_id', ctx.teamId),
    ]);
    setRows(filesRes.data || []); setCars(carsRes.data || []); setDrivers(driversRes.data || []); setEvents(eventsRes.data || []); setSessions(sessionsRes.data || []);
  }

  useEffect(() => {
    if (!access.loading && canViewTelemetry) {
      void load();
    }
  }, [access.loading, canViewTelemetry]);

  const stats = useMemo(() => [
    { label: 'File registrati', value: String(rows.length), icon: <Activity size={18} /> },
    { label: 'Eventi collegati', value: String(new Set(rows.map((row) => row.event_id).filter(Boolean)).size), icon: <Activity size={18} /> },
    { label: 'Mezzi collegati', value: String(new Set(rows.map((row) => row.car_id).filter(Boolean)).size), icon: <Activity size={18} /> },
    { label: 'Piloti collegati', value: String(new Set(rows.map((row) => row.driver_id).filter(Boolean)).size), icon: <Activity size={18} /> },
  ], [rows]);

  async function addFile() {
    if (!canEditTelemetry) return;
    const ctx = await getCurrentTeamContext();
    if (!file && !form.file_name.trim()) { alert('Carica un file o inserisci almeno un nome'); return; }
    let payload: any = { team_id: ctx.teamId, file_name: form.file_name || file?.name || 'File telemetria', notes: form.notes || null, car_id: form.car_id || null, driver_id: form.driver_id || null, event_id: form.event_id || null, session_id: form.session_id || null, uploaded_by_team_user_id: ctx.teamUserId };
    if (file) {
      const upload = await uploadTeamFile({ file, area: 'telemetry', recordId: form.event_id || form.car_id || 'generic' });
      payload = { ...payload, file_name: form.file_name || upload.fileName, file_url: upload.publicUrl, storage_path: upload.path, file_type: upload.mimeType, file_size_bytes: upload.sizeBytes };
    }
    const { error } = await supabase.from('telemetry_files').insert([payload]);
    if (!error) { setForm({ file_name: '', notes: '', car_id: '', driver_id: '', event_id: '', session_id: '' }); setFile(null); await load(); }
  }

  const filtered = rows.filter((row) => !filter || `${row.file_name || ''} ${row.notes || ''}`.toLowerCase().includes(filter.toLowerCase()));

  if (access.loading) {
    return <PagePermissionState title="Telemetria" subtitle="Archivio file con upload locale e collegamenti operativi" icon={<Activity size={22} />} state="loading" />;
  }
  if (access.error) {
    return <PagePermissionState title="Telemetria" subtitle="Archivio file con upload locale e collegamenti operativi" icon={<Activity size={22} />} state="error" message={access.error} />;
  }
  if (!canViewTelemetry) {
    return <PagePermissionState title="Telemetria" subtitle="Archivio file con upload locale e collegamenti operativi" icon={<Activity size={22} />} state="denied" message="Il tuo ruolo non ha accesso al modulo telemetria." />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Telemetria" subtitle="Archivio file con upload locale, collegamento a evento, sessione, mezzo e pilota" icon={<Activity size={22} />} />
      {!canEditTelemetry ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Hai accesso in sola lettura a questo modulo.</div> : null}
      <SectionCard><StatsGrid items={stats} /></SectionCard>
      {canEditTelemetry ? (
        <SectionCard title="Nuovo file telemetria">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className="rounded-xl border p-3" placeholder="Nome file" value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} />
            <input className="rounded-xl border p-3" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <select className="rounded-xl border p-3" value={form.car_id} onChange={(e) => setForm({ ...form, car_id: e.target.value })}><option value="">Mezzo</option>{cars.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <select className="rounded-xl border p-3" value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}><option value="">Pilota</option>{drivers.map((row) => <option key={row.id} value={row.id}>{row.first_name} {row.last_name}</option>)}</select>
            <select className="rounded-xl border p-3" value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })}><option value="">Evento</option>{events.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <select className="rounded-xl border p-3" value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value })}><option value="">Sessione</option>{sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <textarea className="rounded-xl border p-3 md:col-span-2 min-h-24" placeholder="Note file / canali / provenienza" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="mt-4"><button onClick={addFile} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><Upload size={16} className="mr-2 inline" />Registra file</button></div>
        </SectionCard>
      ) : null}
      <SectionCard title="Archivio telemetria">
        <div className="mb-4"><input className="w-full rounded-xl border p-3" placeholder="Filtro rapido per nome o note" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
        {filtered.length === 0 ? <EmptyState title="Nessun file registrato" /> : <div className="space-y-3">{filtered.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-4"><div className="font-bold text-neutral-900">{row.file_name || 'File telemetria'}</div><div className="mt-1 text-sm text-neutral-500">{new Date(row.created_at).toLocaleString('it-IT')}</div>{row.notes ? <div className="mt-2 text-sm text-neutral-700">{row.notes}</div> : null}{row.file_url ? <a href={row.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold">Apri file</a> : null}</div>)}</div>}
      </SectionCard>
    </div>
  );
}
