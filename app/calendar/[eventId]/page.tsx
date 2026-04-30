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
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import InlineConfirmButton from "@/components/InlineConfirmButton";
import { usePermissionAccess } from "@/lib/permissions";

export default function EventDetailPage() {
  const access = usePermissionAccess();
  const canViewEvents = access.hasPermission("events.view");
  const canEditEvents = access.hasPermission("events.edit", ["owner", "admin"]);
  const { eventId } = useParams() as { eventId: string };
  const [event, setEvent] = useState<any>(null);
  const [eventCars, setEventCars] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [selectedCar, setSelectedCar] = useState("");
  const [sessionForm, setSessionForm] = useState({ name: "", session_type: "test" });
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  async function loadAll() {
    const ctx = await getCurrentTeamContext();
    const [eventRes, eventCarsRes, sessionsRes, carsRes] = await Promise.all([
      supabase.from("events").select("id,name,date,notes,circuit_id(id,name)").eq("team_id", ctx.teamId).eq("id", eventId).single(),
      supabase.from("event_cars").select("id,status,notes,car_id(id,name)").eq("team_id", ctx.teamId).eq("event_id", eventId).order("created_at", { ascending: true }),
      supabase.from("event_sessions").select("*").eq("team_id", ctx.teamId).eq("event_id", eventId).order("created_at", { ascending: true }),
      supabase.from("cars").select("id,name").eq("team_id", ctx.teamId).order("name", { ascending: true }),
    ]);
    setEvent(eventRes.data);
    setEventCars(eventCarsRes.data || []);
    setSessions(sessionsRes.data || []);
    setCars(carsRes.data || []);
  }

  useEffect(() => { if (eventId && !access.loading && canViewEvents) void loadAll(); }, [eventId, access.loading, canViewEvents]);

  async function addCar() {
    if (!canEditEvents || !selectedCar) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("event_cars").insert([{ team_id: ctx.teamId, event_id: eventId, car_id: selectedCar, status: "ready" }]);
    if (error) { setFeedback({ type: "error", message: error.message }); return; }
    setSelectedCar("");
    await loadAll();
    setFeedback({ type: "success", message: "Mezzo associato correttamente all'evento." });
  }

  async function addSession() {
    if (!canEditEvents || !sessionForm.name.trim()) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("event_sessions").insert([{ team_id: ctx.teamId, event_id: eventId, name: sessionForm.name.trim(), session_type: sessionForm.session_type }]);
    if (error) { setFeedback({ type: "error", message: error.message }); return; }
    setSessionForm({ name: "", session_type: "test" });
    await loadAll();
    setFeedback({ type: "success", message: "Sessione aggiunta correttamente." });
  }

  async function removeEventCar(id: string) {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("event_cars").delete().eq("team_id", ctx.teamId).eq("id", id);
    if (error) { setFeedback({ type: "error", message: error.message }); return; }
    await loadAll();
    setFeedback({ type: "success", message: "Mezzo rimosso dall'evento." });
  }

  if (access.loading) return <PagePermissionState title="Evento" subtitle="Mezzi, sessioni e gestione weekend" icon={<CalendarDays size={22} />} state="loading" />;
  if (access.error) return <PagePermissionState title="Evento" subtitle="Mezzi, sessioni e gestione weekend" icon={<CalendarDays size={22} />} state="error" message={access.error} />;
  if (!canViewEvents) return <PagePermissionState title="Evento" subtitle="Mezzi, sessioni e gestione weekend" icon={<CalendarDays size={22} />} state="denied" message="Il tuo ruolo non può aprire il dettaglio evento." />;
  if (!event) return <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-500 shadow-sm">Caricamento evento...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={event.name} subtitle={`${event.date ? new Date(event.date).toLocaleDateString("it-IT") : "Data non impostata"} · ${event.circuit_id?.name || "Autodromo non impostato"}`} icon={<CalendarDays size={22} />} actions={<Link href="/calendar" className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"><ArrowLeft size={16} className="mr-2" />Eventi</Link>} />
      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}
      <SectionCard title="Mezzi evento" subtitle="Assegna i mezzi che parteciperanno all'evento"><div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px]"><select className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" value={selectedCar} onChange={(e) => setSelectedCar(e.target.value)}><option value="">Seleziona mezzo</option>{cars.map((car) => <option key={car.id} value={car.id}>{car.name}</option>)}</select>{canEditEvents ? <button onClick={addCar} className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"><PlusCircle size={16} className="mr-2" />Aggiungi mezzo</button> : null}</div><div className="mt-4 space-y-3">{eventCars.length === 0 ? <EmptyState title="Nessun mezzo assegnato" /> : eventCars.map((row) => <div key={row.id} className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"><div><div className="text-base font-bold text-neutral-900">{row.car_id?.name || "Mezzo"}</div><div className="mt-1 text-sm text-neutral-500">Stato: {row.status || "—"}</div></div><div className="flex flex-wrap gap-2"><Link href={`/calendar/${eventId}/car/${row.id}`} className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"><CarFront size={16} className="mr-2" />Apri console mezzo</Link>{canEditEvents ? <InlineConfirmButton label="Rimuovi" message="Rimuovere questo mezzo dall'evento?" onConfirm={() => removeEventCar(row.id)} className="inline-flex items-center justify-center rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100" icon={<Trash2 size={16} className="mr-2" />} /> : null}</div></div>)}</div></SectionCard>
      <SectionCard title="Sessioni evento" subtitle="Definisci le sessioni operative del weekend"><div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px_220px]"><input className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" placeholder="Nome sessione" value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} /><select className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" value={sessionForm.session_type} onChange={(e) => setSessionForm({ ...sessionForm, session_type: e.target.value })}><option value="test">Test</option><option value="practice">Practice</option><option value="qualifying">Qualifica</option><option value="race">Gara</option></select>{canEditEvents ? <button onClick={addSession} className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"><PlusCircle size={16} className="mr-2" />Aggiungi sessione</button> : null}</div><div className="mt-4 space-y-2">{sessions.length === 0 ? <EmptyState title="Nessuna sessione configurata" /> : sessions.map((row) => <div key={row.id} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm"><div className="font-bold text-neutral-900">{row.name}</div><div className="mt-1 text-sm text-neutral-500">{row.session_type}</div></div>)}</div></SectionCard>
    </div>
  );
}
