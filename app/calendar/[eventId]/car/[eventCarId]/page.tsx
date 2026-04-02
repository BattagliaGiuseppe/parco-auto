"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardCheck, Clock3, Fuel, PlusCircle, Save, StickyNote, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import SetupScheda from "./setup-scheda";

export default function EventCarPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const eventCarId = params?.eventCarId as string;
  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [turns, setTurns] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [fuel, setFuel] = useState({ fuelStart: 0, fuelEnd: 0, lapsDone: 0, lapsPlanned: 0 });
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionType, setSessionType] = useState("test");
  const [turnForm, setTurnForm] = useState({ event_session_id: "", minutes: "", laps: "", notes: "" });

  async function load() {
    const ctx = await getCurrentTeamContext();
    const [{ data: eventData }, { data: eventCarData }, { data: driversData }, { data: assignedData }, { data: sessionsData }, { data: turnsData }, { data: notesRow }, { data: fuelRow }] = await Promise.all([
      supabase.from("events").select("*").eq("team_id", ctx.teamId).eq("id", eventId).single(),
      supabase.from("event_cars").select("id, car_id (id, name, hours), notes, status").eq("team_id", ctx.teamId).eq("id", eventCarId).single(),
      supabase.from("drivers").select("*").eq("team_id", ctx.teamId).order("last_name"),
      supabase.from("driver_event_entries").select("id, role, driver_id, drivers(first_name,last_name,nickname)").eq("team_id", ctx.teamId).eq("event_car_id", eventCarId),
      supabase.from("event_sessions").select("*").eq("team_id", ctx.teamId).eq("event_id", eventId).order("created_at"),
      supabase.from("event_car_turns").select("*").eq("team_id", ctx.teamId).eq("event_car_id", eventCarId).order("created_at"),
      supabase.from("event_car_data").select("data").eq("team_id", ctx.teamId).eq("event_car_id", eventCarId).eq("section", "notes").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("event_car_data").select("data").eq("team_id", ctx.teamId).eq("event_car_id", eventCarId).eq("section", "fuel").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setEvent(eventData);
    setCar((eventCarData as any)?.car_id || null);
    setDrivers(driversData || []);
    setAssigned(assignedData || []);
    setSessions(sessionsData || []);
    setTurns(turnsData || []);
    setNotes((notesRow as any)?.data?.text || "");
    setFuel((fuelRow as any)?.data || { fuelStart: 0, fuelEnd: 0, lapsDone: 0, lapsPlanned: 0 });
  }

  useEffect(() => { if (eventId && eventCarId) load(); }, [eventId, eventCarId]);

  const totalMinutes = useMemo(() => turns.reduce((a, t) => a + Number(t.minutes || 0), 0), [turns]);
  const fuelUsed = useMemo(() => Math.max(0, Number(fuel.fuelStart || 0) - Number(fuel.fuelEnd || 0)), [fuel]);

  async function assignDriver() {
    const ctx = await getCurrentTeamContext();
    if (!selectedDriverId) return;
    await supabase.from("driver_event_entries").insert([{ team_id: ctx.teamId, event_id: eventId, event_car_id: eventCarId, car_id: car?.id || null, driver_id: selectedDriverId, role: "primary" }]);
    setSelectedDriverId("");
    await load();
  }

  async function createSession() {
    const ctx = await getCurrentTeamContext();
    if (!sessionName.trim()) return;
    await supabase.from("event_sessions").insert([{ team_id: ctx.teamId, event_id: eventId, name: sessionName, session_type: sessionType }]);
    setSessionName("");
    setSessionType("test");
    await load();
  }

  async function addTurn() {
    const ctx = await getCurrentTeamContext();
    await supabase.from("event_car_turns").insert([{ team_id: ctx.teamId, event_car_id: eventCarId, event_session_id: turnForm.event_session_id || null, minutes: Number(turnForm.minutes || 0), laps: Number(turnForm.laps || 0), notes: turnForm.notes || null }]);
    setTurnForm({ event_session_id: "", minutes: "", laps: "", notes: "" });
    await load();
  }

  async function saveFuel() {
    const ctx = await getCurrentTeamContext();
    await supabase.from("event_car_data").insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "fuel", data: fuel }]);
    await load();
  }

  async function saveNotes() {
    const ctx = await getCurrentTeamContext();
    await supabase.from("event_car_data").insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "notes", data: { text: notes } }]);
    await load();
  }

  if (!event || !car) return <div className="p-6 text-neutral-500">Caricamento gestione auto evento...</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={`${car.name} · ${event.name}`} subtitle="Pannello operativo auto evento" icon={<CalendarDays size={22} />} actions={<Link href={`/calendar/${eventId}`} className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="inline mr-2" />Evento</Link>} />
      <SectionCard>
        <StatsGrid items={[{ label: 'Ore auto', value: String(car.hours ?? 0), icon: <Clock3 size={18} /> }, { label: 'Sessioni', value: String(sessions.length), icon: <CalendarDays size={18} /> }, { label: 'Turni', value: String(turns.length), icon: <Clock3 size={18} /> }, { label: 'Fuel consumato', value: `${fuelUsed} L`, icon: <Fuel size={18} /> }]} />
      </SectionCard>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Piloti assegnati" subtitle="Associa i piloti a questa auto evento">
          <div className="mb-4 flex gap-3"><select className="w-full rounded-xl border p-3" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}><option value="">Seleziona pilota</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}</select><button onClick={assignDriver} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><PlusCircle size={16} className="inline mr-2" />Aggiungi</button></div>
          {assigned.length === 0 ? <EmptyState title="Nessun pilota assegnato" /> : <div className="space-y-3">{assigned.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{row.drivers?.first_name} {row.drivers?.last_name}</div><div className="text-sm text-neutral-500">Ruolo: {row.role}</div></div>)}</div>}
        </SectionCard>
        <SectionCard title="Sessioni evento" subtitle="Libere, qualifica, gara, test o stint">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]"><input className="rounded-xl border p-3" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Nome sessione" /><select className="rounded-xl border p-3" value={sessionType} onChange={(e) => setSessionType(e.target.value)}><option value="test">Test</option><option value="prove_libere">Prove libere</option><option value="qualifica">Qualifica</option><option value="gara">Gara</option><option value="stint">Stint</option></select><button onClick={createSession} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Crea</button></div>
          {sessions.length === 0 ? <EmptyState title="Nessuna sessione creata" /> : <div className="space-y-3">{sessions.map((row) => <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{row.name}</div><div className="text-sm text-neutral-500">{row.session_type}</div></div>)}</div>}
        </SectionCard>
      </div>
      <SectionCard title="Setup" subtitle="Scheda tecnica e note assetto"><SetupScheda eventCarId={eventCarId} /></SectionCard>
      <SectionCard title="Turni" subtitle="Uso reale vettura durante evento">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4"><select className="rounded-xl border p-3" value={turnForm.event_session_id} onChange={(e) => setTurnForm({ ...turnForm, event_session_id: e.target.value })}><option value="">Sessione</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><input className="rounded-xl border p-3" type="number" placeholder="Minuti" value={turnForm.minutes} onChange={(e) => setTurnForm({ ...turnForm, minutes: e.target.value })} /><input className="rounded-xl border p-3" type="number" placeholder="Giri" value={turnForm.laps} onChange={(e) => setTurnForm({ ...turnForm, laps: e.target.value })} /><input className="rounded-xl border p-3" placeholder="Note" value={turnForm.notes} onChange={(e) => setTurnForm({ ...turnForm, notes: e.target.value })} /></div>
        <button onClick={addTurn} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><PlusCircle size={16} className="inline mr-2" />Aggiungi turno</button>
        <div className="mt-4 space-y-3">{turns.length === 0 ? <EmptyState title="Nessun turno registrato" /> : turns.map((t) => <div key={t.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{t.minutes} min · {t.laps} giri</div><div className="text-sm text-neutral-500">{t.notes || '—'}</div></div>)}</div>
      </SectionCard>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Fuel" subtitle="Consumo e previsione"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"><input type="number" className="rounded-xl border p-3" value={fuel.fuelStart} onChange={(e) => setFuel({ ...fuel, fuelStart: Number(e.target.value || 0) })} placeholder="Fuel start" /><input type="number" className="rounded-xl border p-3" value={fuel.fuelEnd} onChange={(e) => setFuel({ ...fuel, fuelEnd: Number(e.target.value || 0) })} placeholder="Fuel end" /><input type="number" className="rounded-xl border p-3" value={fuel.lapsDone} onChange={(e) => setFuel({ ...fuel, lapsDone: Number(e.target.value || 0) })} placeholder="Giri fatti" /><input type="number" className="rounded-xl border p-3" value={fuel.lapsPlanned} onChange={(e) => setFuel({ ...fuel, lapsPlanned: Number(e.target.value || 0) })} placeholder="Giri previsti" /></div><button onClick={saveFuel} className="mt-4 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><Save size={16} className="inline mr-2" />Salva fuel</button></SectionCard>
        <SectionCard title="Note operative" subtitle="Taccuino tecnico rapido"><textarea className="min-h-[180px] w-full rounded-xl border p-3" value={notes} onChange={(e) => setNotes(e.target.value)} /><button onClick={saveNotes} className="mt-4 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><StickyNote size={16} className="inline mr-2" />Salva note</button></SectionCard>
      </div>
      <SectionCard title="Check-up tecnico" subtitle="Versione iniziale operativa, pronta ad agganciarsi al motore checklist configurabile"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{['Serraggi','Freni','Ruote','Liquidi'].map((item) => <div key={item} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{item}</div><div className="mt-2"><select className="w-full rounded-xl border p-3"><option>Da controllare</option><option>OK</option><option>Problema</option></select></div></div>)}</div></SectionCard>
    </div>
  );
}
