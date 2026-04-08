"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, CalendarDays, Edit, Wrench, Trash2, X, MapPinned } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import { usePermissionAccess } from "@/lib/permissions";

export default function CalendarPage() {
  const access = usePermissionAccess();
  const canViewEvents = access.hasPermission("events.view");
  const canEditEvents = access.hasPermission("events.edit", ["owner", "admin"]);
  const [events, setEvents] = useState<any[]>([]);
  const [circuits, setCircuits] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: '', name: '', notes: '', circuit_id: '' });
  const [newCircuitName, setNewCircuitName] = useState('');

  async function loadAll() {
    setLoading(true);
    const ctx = await getCurrentTeamContext();
    const [eventsRes, circuitsRes] = await Promise.all([
      supabase.from('events').select('id, date, name, notes, circuit_id(id,name), event_cars(id)').eq('team_id', ctx.teamId).order('date', { ascending: false }),
      supabase.from('circuits').select('id, name').eq('team_id', ctx.teamId).order('name', { ascending: true }),
    ]);
    setEvents(eventsRes.data || []);
    setCircuits(circuitsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!access.loading && canViewEvents) {
      void loadAll();
    }
  }, [access.loading, canViewEvents]);

  function openCreate(event?: any) {
    setEditing(event || null);
    setForm({
      date: event?.date ? String(event.date).slice(0,10) : '',
      name: event?.name || '',
      notes: event?.notes || '',
      circuit_id: event?.circuit_id?.id || '',
    });
    setOpen(true);
  }

  async function saveEvent() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    const payload = { date: form.date || null, name: form.name.trim(), notes: form.notes.trim() || null, circuit_id: form.circuit_id || null };
    if (!payload.name) return;
    if (editing) {
      const { error } = await supabase.from('events').update(payload).eq('team_id', ctx.teamId).eq('id', editing.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('events').insert([{ team_id: ctx.teamId, ...payload }]);
      if (error) { alert(error.message); return; }
    }
    setOpen(false);
    await loadAll();
  }

  async function saveCircuit() {
    if (!canEditEvents) return;
    if (!newCircuitName.trim()) return;
    const ctx = await getCurrentTeamContext();
    const { data, error } = await supabase.from('circuits').insert([{ team_id: ctx.teamId, name: newCircuitName.trim() }]).select('*').single();
    if (error) { alert(error.message); return; }
    setCircuits((prev) => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setForm((prev) => ({ ...prev, circuit_id: data.id }));
    setNewCircuitName('');
    setCircuitOpen(false);
  }

  async function deleteEvent(id: string) {
    if (!canEditEvents) return;
    if (!confirm('Eliminare questo evento?')) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from('events').delete().eq('team_id', ctx.teamId).eq('id', id);
    if (!error) await loadAll();
  }

  if (access.loading) {
    return <PagePermissionState title="Eventi" subtitle="Calendario weekend, test e gare" icon={<CalendarDays size={22} />} state="loading" />;
  }

  if (access.error) {
    return <PagePermissionState title="Eventi" subtitle="Calendario weekend, test e gare" icon={<CalendarDays size={22} />} state="error" message={access.error} />;
  }

  if (!canViewEvents) {
    return <PagePermissionState title="Eventi" subtitle="Calendario weekend, test e gare" icon={<CalendarDays size={22} />} state="denied" message="Il tuo ruolo non ha accesso al modulo eventi." />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Eventi" subtitle="Calendario weekend, test e gare con circuiti e mezzi collegati" icon={<CalendarDays size={22} />} actions={canEditEvents ? <button onClick={() => openCreate()} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"><PlusCircle size={16} className="mr-2 inline" />Aggiungi evento</button> : undefined} />
      {!canEditEvents ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Hai accesso in sola lettura a questo modulo.</div> : null}
      <SectionCard title="Eventi registrati">
        {loading ? <div className="text-neutral-500">Caricamento...</div> : events.length === 0 ? <EmptyState title="Nessun evento registrato" /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{events.map((ev) => <div key={ev.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-neutral-900">{ev.name}</div><div className="mt-1 text-sm text-neutral-500">{ev.date ? new Date(ev.date).toLocaleDateString('it-IT') : 'Data non impostata'} · {ev.circuit_id?.name || 'Autodromo non impostato'}</div></div><div className="text-xs text-neutral-500">{ev.event_cars?.length || 0} mezzi</div></div>{ev.notes ? <div className="mt-3 text-sm text-neutral-700">{ev.notes}</div> : null}<div className="mt-4 flex flex-wrap gap-2">{canEditEvents ? <button onClick={() => openCreate(ev)} className="rounded-xl bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-800 hover:bg-yellow-200"><Edit size={16} className="mr-2 inline" />Modifica</button> : null}<Link href={`/calendar/${ev.id}`} className="rounded-xl border px-4 py-2 text-sm font-semibold"><Wrench size={16} className="mr-2 inline" />Gestisci</Link>{canEditEvents ? <button onClick={() => deleteEvent(ev.id)} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"><Trash2 size={16} className="mr-2 inline" />Elimina</button> : null}</div></div>)}</div>}
      </SectionCard>

      {open && canEditEvents ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-neutral-900">{editing ? 'Modifica evento' : 'Nuovo evento'}</h3><button onClick={() => setOpen(false)} className="rounded-xl bg-neutral-100 p-2"><X size={18} /></button></div><div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Data"><input type="date" className="w-full rounded-xl border p-3" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field><Field label="Nome evento" required><input className="w-full rounded-xl border p-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Autodromo"><div className="flex gap-2"><select className="w-full rounded-xl border p-3" value={form.circuit_id} onChange={(e) => setForm({ ...form, circuit_id: e.target.value })}><option value="">Seleziona autodromo</option>{circuits.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={() => setCircuitOpen(true)} className="rounded-xl bg-neutral-900 px-3 py-2 text-white hover:bg-neutral-800"><MapPinned size={18} /></button></div></Field><div className="md:col-span-2"><Field label="Note"><textarea className="w-full rounded-xl border p-3 min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setOpen(false)} className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold">Annulla</button><button onClick={saveEvent} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">Salva evento</button></div></div></div> : null}

      {circuitOpen && canEditEvents ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-bold text-neutral-900">Nuovo autodromo</h3><div className="mt-4"><input className="w-full rounded-xl border p-3" placeholder="Nome autodromo" value={newCircuitName} onChange={(e) => setNewCircuitName(e.target.value)} /></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setCircuitOpen(false)} className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold">Annulla</button><button onClick={saveCircuit} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">Salva autodromo</button></div></div></div> : null}
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-semibold text-neutral-700">{label}{required ? <span className="text-red-500"> *</span> : null}</label>{children}</div>;
}
