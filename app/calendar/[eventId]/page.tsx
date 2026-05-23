"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CarFront,
  Info,
  PlusCircle,
  TimerReset,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import InlineConfirmButton from "@/components/InlineConfirmButton";
import StatsGrid from "@/components/StatsGrid";
import { UiField, uiInputClassName } from "@/components/UiField";
import { usePermissionAccess } from "@/lib/permissions";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Feedback = {
  type: "success" | "error" | "info";
  message: string;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

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
  const [sessionForm, setSessionForm] = useState({
    name: "",
    session_type: "test",
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();
      const [eventRes, eventCarsRes, sessionsRes, carsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id,name,date,notes,circuit_id(id,name)")
          .eq("team_id", ctx.teamId)
          .eq("id", eventId)
          .single(),
        supabase
          .from("event_cars")
          .select("id,status,notes,car_id(id,name)")
          .eq("team_id", ctx.teamId)
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_sessions")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("cars")
          .select("id,name")
          .eq("team_id", ctx.teamId)
          .order("name", { ascending: true }),
      ]);

      if (eventRes.error) throw eventRes.error;
      if (eventCarsRes.error) throw eventCarsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (carsRes.error) throw carsRes.error;

      const normalizedEvent = eventRes.data
        ? {
            ...eventRes.data,
            circuit_id: normalizeRelation(eventRes.data.circuit_id),
          }
        : null;

      const normalizedEventCars = (eventCarsRes.data || []).map((row: any) => ({
        ...row,
        car_id: normalizeRelation(row.car_id),
      }));

      setEvent(normalizedEvent);
      setEventCars(normalizedEventCars);
      setSessions(sessionsRes.data || []);
      setCars(carsRes.data || []);
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore caricamento evento.",
      });
      setEvent(null);
      setEventCars([]);
      setSessions([]);
      setCars([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventId && !access.loading && canViewEvents) {
      void loadAll();
    }
  }, [eventId, access.loading, canViewEvents]);

  async function addCar() {
    if (!canEditEvents || !selectedCar) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase.from("event_cars").insert([
        {
          team_id: ctx.teamId,
          event_id: eventId,
          car_id: selectedCar,
          status: "ready",
        },
      ]);

      if (error) throw error;

      setSelectedCar("");
      await loadAll();
      setFeedback({
        type: "success",
        message: "Mezzo associato correttamente all'evento.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore associazione mezzo.",
      });
    }
  }

  async function addSession() {
    if (!canEditEvents || !sessionForm.name.trim()) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase.from("event_sessions").insert([
        {
          team_id: ctx.teamId,
          event_id: eventId,
          name: sessionForm.name.trim(),
          session_type: sessionForm.session_type,
        },
      ]);

      if (error) throw error;

      setSessionForm({ name: "", session_type: "test" });
      await loadAll();
      setFeedback({
        type: "success",
        message: "Sessione aggiunta correttamente.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore creazione sessione.",
      });
    }
  }


  async function removeSession(sessionId: string) {
    if (!canEditEvents) return;

    try {
      const ctx = await getCurrentTeamContext();

      const { count, error: turnsError } = await supabase
        .from("event_car_turns")
        .select("id", { count: "exact", head: true })
        .eq("team_id", ctx.teamId)
        .eq("event_session_id", sessionId);

      if (turnsError) throw turnsError;

      if ((count || 0) > 0) {
        setFeedback({
          type: "error",
          message:
            "Questa sessione è già collegata a uno o più turni tecnici. Rimuovi o riassegna prima i turni collegati.",
        });
        return;
      }

      const { error } = await supabase
        .from("event_sessions")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", sessionId);

      if (error) throw error;

      await loadAll();
      setFeedback({
        type: "success",
        message: "Sessione eliminata correttamente.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore eliminazione sessione.",
      });
    }
  }

  async function removeEventCar(id: string) {
    if (!canEditEvents) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase
        .from("event_cars")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", id);

      if (error) throw error;

      await loadAll();
      setFeedback({
        type: "success",
        message: "Mezzo rimosso dall'evento.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore rimozione mezzo.",
      });
    }
  }

  const stats = useMemo(() => {
    const readyCars = eventCars.filter((row) => (row.status || "").toLowerCase() === "ready").length;

    return [
      {
        label: "Mezzi collegati",
        value: String(eventCars.length),
        icon: <CarFront size={18} />,
        helper: "Auto assegnate al weekend",
      },
      {
        label: "Sessioni",
        value: String(sessions.length),
        icon: <TimerReset size={18} />,
        helper: "Turni e fasi operative registrate",
      },
      {
        label: "Mezzi pronti",
        value: String(readyCars),
        icon: <PlusCircle size={18} />,
        helper: "Event car in stato ready",
      },
      {
        label: "Autodromo",
        value: event?.circuit_id?.name || "Non definito",
        icon: <CalendarDays size={18} />,
        helper: event?.date
          ? `Data evento: ${new Date(event.date).toLocaleDateString("it-IT")}`
          : "Data non impostata",
      },
    ];
  }, [event, eventCars, sessions.length]);

  if (access.loading) {
    return (
      <PagePermissionState
        title="Evento"
        subtitle="Mezzi, sessioni e gestione weekend"
        icon={<CalendarDays size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Evento"
        subtitle="Mezzi, sessioni e gestione weekend"
        icon={<CalendarDays size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewEvents) {
    return (
      <PagePermissionState
        title="Evento"
        subtitle="Mezzi, sessioni e gestione weekend"
        icon={<CalendarDays size={22} />}
        state="denied"
        message="Il tuo ruolo non può aprire il dettaglio evento."
      />
    );
  }

  if (loading && !event) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-500 shadow-sm">
          Caricamento evento...
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <FormStatusBanner
          type="error"
          message="Impossibile trovare l'evento richiesto."
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title={event.name}
        subtitle={`${event.date ? new Date(event.date).toLocaleDateString("it-IT") : "Data non impostata"} · ${event.circuit_id?.name || "Autodromo non impostato"}`}
        icon={<CalendarDays size={22} />}
        actions={
          <Link
            href="/calendar"
            className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
          >
            <ArrowLeft size={16} className="mr-2 inline" />
            Eventi
          </Link>
        }
      />

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Questo è il livello di coordinamento del weekend prima di entrare nella console del singolo mezzo."
      >
        <InfoBlock>
          Da qui assegni i mezzi all&apos;evento e definisci le sessioni principali del weekend.
          Ogni mezzo collegato apre poi la propria console dedicata, dove gestire pilota, turni,
          fuel, check-up e setup. Questa pagina deve restare leggibile e orientata alla preparazione
          generale dell&apos;evento.
        </InfoBlock>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Mezzi evento"
          subtitle="Assegna i mezzi che parteciperanno all'evento e apri la console tecnica dedicata."
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px]">
            <UiField label="Seleziona mezzo">
              <select
                className={uiInputClassName}
                value={selectedCar}
                onChange={(e) => setSelectedCar(e.target.value)}
              >
                <option value="">Seleziona mezzo</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name}
                  </option>
                ))}
              </select>
            </UiField>

            {canEditEvents ? (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addCar}
                  className="w-full rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Aggiungi mezzo
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {eventCars.length === 0 ? (
              <EmptyState
                title="Nessun mezzo assegnato"
                description="Collega il primo mezzo per aprire la console tecnica dell'evento."
              />
            ) : (
              eventCars.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-bold text-neutral-900">
                        {row.car_id?.name || "Mezzo"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        Stato: {row.status || "—"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/calendar/${eventId}/car/${row.id}`}
                        className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
                      >
                        <CarFront size={16} className="mr-2 inline" />
                        Apri console mezzo
                      </Link>

                      {canEditEvents ? (
                        <InlineConfirmButton
                          label="Rimuovi"
                          message="Rimuovere questo mezzo dall'evento?"
                          onConfirm={() => removeEventCar(row.id)}
                          className="rounded-xl bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100"
                          icon={<Trash2 size={16} className="mr-2 inline" />}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Sessioni evento"
          subtitle="Definisci le sessioni principali del weekend da usare poi nella console mezzo."
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px_220px]">
            <UiField label="Nome sessione">
              <input
                className={uiInputClassName}
                placeholder="Es. Prove libere 1"
                value={sessionForm.name}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, name: e.target.value })
                }
              />
            </UiField>

            <UiField label="Tipo sessione">
              <select
                className={uiInputClassName}
                value={sessionForm.session_type}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    session_type: e.target.value,
                  })
                }
              >
                <option value="test">Test</option>
                <option value="practice">Practice</option>
                <option value="qualifying">Qualifica</option>
                <option value="race">Gara</option>
              </select>
            </UiField>

            {canEditEvents ? (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addSession}
                  className="w-full rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Aggiungi sessione
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {sessions.length === 0 ? (
              <EmptyState
                title="Nessuna sessione configurata"
                description="Definisci le sessioni per organizzare il weekend in modo più chiaro."
              />
            ) : (
              sessions.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-bold text-neutral-900">{row.name}</div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {row.session_type}
                      </div>
                    </div>

                    {canEditEvents ? (
                      <InlineConfirmButton
                        label="Elimina"
                        message="Eliminare questa sessione?"
                        onConfirm={() => removeSession(row.id)}
                        className="inline-flex items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        icon={<Trash2 size={16} className="mr-2" />}
                      />
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
