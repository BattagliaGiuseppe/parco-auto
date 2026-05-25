"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Edit,
  Info,
  MapPinned,
  PlusCircle,
  Trash2,
  Wrench,
  X,
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
import { UiField, uiInputClassName, uiTextareaClassName } from "@/components/UiField";
import { usePermissionAccess } from "@/lib/permissions";

type Feedback = {
  type: "success" | "error" | "info";
  message: string;
};

function normalizeCircuit(value: any) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

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
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [form, setForm] = useState({
    date: "",
    name: "",
    notes: "",
    circuit_id: "",
  });
  const [newCircuitName, setNewCircuitName] = useState("");

  async function loadAll() {
    setLoading(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();
      const [eventsRes, circuitsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, date, name, notes, circuit_id(id,name), event_cars(id)")
          .eq("team_id", ctx.teamId)
          .order("date", { ascending: false }),
        supabase
          .from("circuits")
          .select("id, name")
          .eq("team_id", ctx.teamId)
          .order("name", { ascending: true }),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (circuitsRes.error) throw circuitsRes.error;

      const normalizedEvents = (eventsRes.data || []).map((event: any) => ({
        ...event,
        circuit_id: normalizeCircuit(event.circuit_id),
      }));

      setEvents(normalizedEvents);
      setCircuits(circuitsRes.data || []);
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore caricamento eventi.",
      });
      setEvents([]);
      setCircuits([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewEvents) {
      void loadAll();
    }
  }, [access.loading, canViewEvents]);

  function openCreate(event?: any) {
    const normalizedEvent = event
      ? { ...event, circuit_id: normalizeCircuit(event.circuit_id) }
      : null;

    setFeedback(null);
    setEditing(normalizedEvent);
    setForm({
      date: normalizedEvent?.date ? String(normalizedEvent.date).slice(0, 10) : "",
      name: normalizedEvent?.name || "",
      notes: normalizedEvent?.notes || "",
      circuit_id: normalizedEvent?.circuit_id?.id || "",
    });
    setOpen(true);
  }

  async function saveEvent() {
    if (!canEditEvents) return;

    if (!form.name.trim()) {
      setFeedback({ type: "error", message: "Inserisci il nome evento." });
      return;
    }

    setSaving(true);

    try {
      const ctx = await getCurrentTeamContext();
      const payload = {
        date: form.date || null,
        name: form.name.trim(),
        notes: form.notes.trim() || null,
        circuit_id: form.circuit_id || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("team_id", ctx.teamId)
          .eq("id", editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("events")
          .insert([{ team_id: ctx.teamId, ...payload }]);

        if (error) throw error;
      }

      setOpen(false);
      await loadAll();
      setFeedback({
        type: "success",
        message: editing ? "Evento aggiornato correttamente." : "Evento creato correttamente.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore salvataggio evento.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveCircuit() {
    if (!canEditEvents) return;

    if (!newCircuitName.trim()) {
      setFeedback({ type: "error", message: "Inserisci il nome autodromo." });
      return;
    }

    setSaving(true);

    try {
      const ctx = await getCurrentTeamContext();
      const { data, error } = await supabase
        .from("circuits")
        .insert([{ team_id: ctx.teamId, name: newCircuitName.trim() }])
        .select("*")
        .single();

      if (error) throw error;

      setCircuits((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, circuit_id: data.id }));
      setNewCircuitName("");
      setCircuitOpen(false);
      setFeedback({ type: "success", message: "Autodromo creato correttamente." });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore creazione autodromo.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!canEditEvents) return;

    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", id);

      if (error) throw error;

      await loadAll();
      setFeedback({ type: "success", message: "Evento eliminato correttamente." });
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "Errore eliminazione evento.",
      });
    }
  }

  const stats = useMemo(() => {
    const totalCars = events.reduce(
      (sum, event) => sum + Number(event.event_cars?.length || 0),
      0
    );

    return [
      {
        label: "Eventi registrati",
        value: String(events.length),
        icon: <CalendarDays size={18} />,
        helper: "Weekend, test e gare presenti in calendario",
      },
      {
        label: "Mezzi collegati",
        value: String(totalCars),
        icon: <Wrench size={18} />,
        helper: "Somma dei mezzi assegnati agli eventi",
      },
      {
        label: "Autodromi",
        value: String(circuits.length),
        icon: <MapPinned size={18} />,
        helper: "Circuiti disponibili per la configurazione",
      },
      {
        label: "Prossimo evento",
        value:
          events.find((event) => !!event.date)?.date
            ? new Date(
                events.find((event) => !!event.date)?.date
              ).toLocaleDateString("it-IT")
            : "Non definito",
        icon: <Info size={18} />,
        helper: "Prima data disponibile nel calendario attuale",
      },
    ];
  }, [events, circuits.length]);

  if (access.loading) {
    return (
      <PagePermissionState
        title="Eventi"
        subtitle="Calendario weekend, test e gare"
        icon={<CalendarDays size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Eventi"
        subtitle="Calendario weekend, test e gare"
        icon={<CalendarDays size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewEvents) {
    return (
      <PagePermissionState
        title="Eventi"
        subtitle="Calendario weekend, test e gare"
        icon={<CalendarDays size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo eventi."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Eventi"
        subtitle="Calendario weekend, test e gare con circuiti e mezzi collegati."
        icon={<CalendarDays size={22} />}
        actions={
          canEditEvents ? (
            <button
              type="button"
              onClick={() => openCreate()}
              className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi evento
            </button>
          ) : undefined
        }
      />

      {!canEditEvents ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Il calendario eventi è il punto di partenza per organizzare mezzi, sessioni e lavoro tecnico del weekend."
      >
        <FieldHint>
          Crea l&apos;evento, collega l&apos;autodromo e poi apri la scheda dedicata per assegnare i mezzi e configurare le sessioni.
          L&apos;obiettivo di questa pagina è darti una vista chiara del calendario già registrato, senza entrare subito nel dettaglio operativo del singolo mezzo.
        </FieldHint>
      </SectionCard>

      <SectionCard
        title="Eventi registrati"
        subtitle="Apri, modifica o rimuovi i weekend già configurati."
      >
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            Caricamento eventi...
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="Nessun evento registrato"
            description="Aggiungi il primo weekend per iniziare a collegare mezzi, sessioni e piloti."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-neutral-900">{event.name}</div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {event.date
                        ? new Date(event.date).toLocaleDateString("it-IT")
                        : "Data non impostata"}{" "}
                      · {event.circuit_id?.name || "Autodromo non impostato"}
                    </div>
                  </div>

                  <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                    {event.event_cars?.length || 0} mezzi
                  </div>
                </div>

                {event.notes ? (
                  <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm leading-6 text-yellow-900">
                    {event.notes}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {canEditEvents ? (
                    <button
                      type="button"
                      onClick={() => openCreate(event)}
                      className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
                    >
                      <Edit size={16} className="mr-2 inline" />
                      Modifica
                    </button>
                  ) : null}

                  <Link
                    href={`/calendar/${event.id}`}
                    className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
                  >
                    <Wrench size={16} className="mr-2 inline" />
                    Gestisci
                  </Link>

                  {canEditEvents ? (
                    <InlineConfirmButton
                      label="Elimina"
                      message="Eliminare questo evento?"
                      onConfirm={() => deleteEvent(event.id)}
                      className="rounded-xl bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100"
                      icon={<Trash2 size={16} className="mr-2 inline" />}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {open && canEditEvents ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">
                {editing ? "Modifica evento" : "Nuovo evento"}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <UiField label="Data">
                <input
                  type="date"
                  className={uiInputClassName}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </UiField>

              <UiField label="Nome evento">
                <input
                  className={uiInputClassName}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Es. Test Vallelunga"
                />
              </UiField>

              <UiField label="Autodromo">
                <div className="flex gap-2">
                  <select
                    className={uiInputClassName}
                    value={form.circuit_id}
                    onChange={(e) => setForm({ ...form, circuit_id: e.target.value })}
                  >
                    <option value="">Seleziona autodromo</option>
                    {circuits.map((circuit) => (
                      <option key={circuit.id} value={circuit.id}>
                        {circuit.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setCircuitOpen(true)}
                    className="rounded-2xl bg-neutral-900 px-3 py-3 text-white hover:bg-neutral-800"
                  >
                    <MapPinned size={18} />
                  </button>
                </div>
              </UiField>

              <UiField label="Note" hint="Indicazioni logistiche o tecniche utili sul weekend.">
                <textarea
                  className={uiTextareaClassName}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Es. test gomme, programma weekend, logistica paddock..."
                />
              </UiField>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveEvent}
                disabled={saving}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvataggio..." : editing ? "Aggiorna evento" : "Salva evento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {circuitOpen && canEditEvents ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">Nuovo autodromo</h3>
              <button
                type="button"
                onClick={() => setCircuitOpen(false)}
                className="rounded-2xl border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6">
              <UiField label="Nome autodromo">
                <input
                  className={uiInputClassName}
                  value={newCircuitName}
                  onChange={(e) => setNewCircuitName(e.target.value)}
                  placeholder="Es. Monza"
                />
              </UiField>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCircuitOpen(false)}
                className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveCircuit}
                disabled={saving}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvataggio..." : "Salva autodromo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
