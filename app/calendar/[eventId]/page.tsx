"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CarFront, CalendarDays, PlusCircle, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";

export default function EventDetailPage() {
  const { eventId } = useParams() as { eventId: string };
  const [event, setEvent] = useState<any>(null);
  const [eventCars, setEventCars] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [selectedCar, setSelectedCar] = useState('');
  const [sessionForm, setSessionForm] = useState({ name: '', session_type: 'test' });

  async function loadAll() {
    const ctx = await getCurrentTeamContext();
    const [eventRes, eventCarsRes, sessionsRes, carsRes] = await Promise.all([
      supabase.from('events').select('id,name,date,notes,circuit_id(id,name)').eq('team_id', ctx.teamId).eq('id', eventId).single(),
      supabase.from('event_cars').select('id,status,notes,car_id(id,name)').eq('team_id', ctx.teamId).eq('event_id', eventId).order('created_at', { ascending: true }),
      supabase.from('event_sessions').select('*').eq('team_id', ctx.teamId).eq('event_id', eventId).order('created_at', { ascending: true }),
      supabase.from('cars').select('id,name').eq('team_id', ctx.teamId).order('name', { ascending: true }),
    ]);
    setEvent(eventRes.data);
    setEventCars(eventCarsRes.data || []);
    setSessions(sessionsRes.data || []);
    setCars(carsRes.data || []);
  }

  useEffect(() => { if (eventId) void loadAll(); }, [eventId]);

  async function addCar() {
    if (!selectedCar) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from('event_cars').insert([{ team_id: ctx.teamId, event_id: eventId, car_id: selectedCar, status: 'ready' }]);
    if (error) { alert(error.message); return; }
    setSelectedCar('');
    await loadAll();
  }

  async function addSession() {
    if (!sessionForm.name.trim()) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from('event_sessions').insert([{ team_id: ctx.teamId, event_id: eventId, name: sessionForm.name.trim(), session_type: sessionForm.session_type }]);
    if (error) { alert(error.message); return; }
    setSessionForm({ name: '', session_type: 'test' });
    await loadAll();
  }

  async function removeEventCar(id: string) {
    if (!confirm("Rimuovere questo mezzo dall'evento?")) return;
    const ctx = await getCurrentTeamContext();
    await supabase.from('event_cars').delete().eq('team_id', ctx.teamId).eq('id', id);
    await loadAll();
  }

  if (!event) return <div className="p-6 text-neutral-500">Caricamento evento...</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={event.name} subtitle={`${event.date ? new Date(event.date).toLocaleDateString('it-IT') : 'Data non impostata'} · ${event.circuit_id?.name || 'Autodromo non impostato'}`} icon={<CalendarDays size={22} />} actions={<Link href="/calendar" className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="mr-2 inline" />Eventi</Link>} />
      <SectionCard title="Mezzi evento" subtitle="Assegna i mezzi che parteciperanno all'evento">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px]">
          <select className="rounded-xl border p-3" value={selectedCar} onChange={(e) => setSelectedCar(e.target.value)}><option value="">Seleziona mezzo</option>{cars.map((car) => <option key={car.id} value={car.id}>{car.name}</option>)}</select>
          <button onClick={addCar} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500"><PlusCircle size={16} className="mr-2 inline" />Aggiungi mezzo</button>
        </div>
        <div className="mt-4 space-y-3">
          {eventCars.length === 0 ? <EmptyState title="Nessun mezzo assegnato" /> : eventCars.map((row) => <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row md:items-center md:justify-between"><div><div className="font-bold text-neutral-900">{row.car_id?.name || 'Mezzo'}</div><div className="mt-1 text-sm text-neutral-500">Stato: {row.status || '—'}</div></div><div className="flex flex-wrap gap-2"><Link href={`/calendar/${eventId}/car/${row.id}`} className="rounded-xl border px-4 py-2 text-sm font-semibold"><CarFront size={16} className="mr-2 inline" />Apri console mezzo</Link><button onClick={() => removeEventCar(row.id)} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"><Trash2 size={16} className="mr-2 inline" />Rimuovi</button></div></div>)}
        </div>
      </SectionCard>

      <SectionCard title="Sessioni evento" subtitle="Definisci le sessioni operative del weekend">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px_220px]">
          <input className="rounded-xl border p-3" placeholder="Nome sessione" value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} />
          <select className="rounded-xl border p-3" value={sessionForm.session_type} onChange={(e) => setSessionForm({ ...sessionForm, session_type: e.target.value })}><option value="test">Test</option><option value="practice">Practice</option><option value="qualifying">Qualifica</option><option value="race">Gara</option></select>
          <button onClick={addSession} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500"><PlusCircle size={16} className="mr-2 inline" />Aggiungi sessione</button>
        </div>
        <div className="mt-4 space-y-2">
          {sessions.length === 0 ? <EmptyState title="Nessuna sessione configurata" /> : sessions.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{row.name}</div><div className="mt-1 text-sm text-neutral-500">{row.session_type}</div></div>)}
        </div>
      </SectionCard>
    </div>
  );
}
