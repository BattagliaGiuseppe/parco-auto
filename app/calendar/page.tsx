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
import ModalShell from "@/components/ModalShell";
import { Button } from "@/components/Button";
import {
  UiField,
  uiInputClassName,
  uiSelectClassName,
  uiTextareaClassName,
} from "@/components/UiField";
import { usePermissionAccess } from "@/lib/permissions";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LocalizedText from "@/components/LocalizedText";

type Feedback = {
  type: "success" | "error" | "info";
  message: string;
};

function normalizeCircuit(value: any) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const translatedChildren = typeof children === "string" ? t(`ui.${children.trim()}`, children) : children;
  return (
    <div className="race-info-box text-sm leading-6">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{translatedChildren}</div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
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
      date: normalizedEvent?.date
        ? String(normalizedEvent.date).slice(0, 10)
        : "",
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
        message: editing
          ? "Evento aggiornato correttamente."
          : "Evento creato correttamente.",
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

      setCircuits((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setForm((prev) => ({ ...prev, circuit_id: data.id }));
      setNewCircuitName("");
      setCircuitOpen(false);
      setFeedback({
        type: "success",
        message: "Autodromo creato correttamente.",
      });
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
      setFeedback({
        type: "success",
        message: "Evento eliminato correttamente.",
      });
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
      0,
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
        value: events.find((event) => !!event.date)?.date
          ? new Date(
              events.find((event) => !!event.date)?.date,
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
        title={tr("Eventi")}
        subtitle="Calendario weekend, test e gare"
        icon={<CalendarDays size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title={tr("Eventi")}
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
        title={tr("Eventi")}
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
        title={tr("Eventi")}
        subtitle="Calendario weekend, test e gare con circuiti e mezzi collegati."
        icon={<CalendarDays size={22} />}
        actions={
          canEditEvents ? (
            <Button onClick={() => openCreate()}>
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi evento
            </Button>
          ) : undefined
        }
      />

      {!canEditEvents ? (
        <div className="rounded-2xl border border-blue-400/25 bg-blue-400/10 px-4 py-3 text-sm text-blue-200">
          {tr("Hai accesso in sola lettura a questo modulo.")}
        </div>
      ) : null}

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title={tr("Lettura operativa")}
        subtitle="Il calendario eventi è il punto di partenza per organizzare mezzi, sessioni e lavoro tecnico del weekend."
      >
        <FieldHint>
          Crea l&apos;evento, collega l&apos;autodromo e poi apri la scheda
          dedicata per assegnare i mezzi e configurare le sessioni.
          L&apos;obiettivo di questa pagina è darti una vista chiara del
          calendario già registrato, senza entrare subito nel dettaglio
          operativo del singolo mezzo.
        </FieldHint>
      </SectionCard>

      <SectionCard
        title={tr("Eventi registrati")}
        subtitle="Apri, modifica o rimuovi i weekend già configurati."
      >
        {loading ? (
          <div className="race-mini-panel text-sm text-[var(--text-secondary)]">
            Caricamento eventi...
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title={tr("Nessun evento registrato")}
            description="Aggiungi il primo weekend per iniziare a collegare mezzi, sessioni e piloti."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {events.map((event) => (
              <div key={event.id} className="data-row">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--text-primary)]">
                      {event.name}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">
                      {event.date
                        ? new Date(event.date).toLocaleDateString("it-IT")
                        : "Data non impostata"}{" "}
                      · {event.circuit_id?.name || "Autodromo non impostato"}
                    </div>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-[var(--text-secondary)]">
                    {event.event_cars?.length || 0} mezzi
                  </div>
                </div>

                {event.notes ? (
                  <div className="mt-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-3 text-sm leading-6 text-yellow-200">
                    {event.notes}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {canEditEvents ? (
                    <button
                      type="button"
                      onClick={() => openCreate(event)}
                      className="race-action-secondary px-4 py-2 text-sm"
                    >
                      <Edit size={16} className="mr-2 inline" />
                      <LocalizedText text="Modifica" />
                    </button>
                  ) : null}

                  <Link
                    href={`/calendar/${event.id}`}
                    className="race-action-secondary px-4 py-2 text-sm"
                  >
                    <Wrench size={16} className="mr-2 inline" />
                    <LocalizedText text="Gestisci" />
                  </Link>

                  {canEditEvents ? (
                    <InlineConfirmButton
                      label="Elimina"
                      message="Eliminare questo evento?"
                      onConfirm={() => deleteEvent(event.id)}
                      className="race-action-danger px-4 py-2 text-sm"
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
        <ModalShell
          title={editing ? "Modifica evento" : "Nuovo evento"}
          subtitle="Configura weekend, autodromo e note operative."
          onClose={() => setOpen(false)}
          maxWidth="max-w-3xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                <LocalizedText text="Annulla" />
              </Button>
              <Button onClick={saveEvent} disabled={saving}>
                {saving
                  ? "Salvataggio..."
                  : editing
                    ? "Aggiorna evento"
                    : "Salva evento"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                placeholder={tr("Es. Test Vallelunga")}
              />
            </UiField>

            <UiField label="Autodromo">
              <div className="flex gap-2">
                <select
                  className={uiSelectClassName}
                  value={form.circuit_id}
                  onChange={(e) =>
                    setForm({ ...form, circuit_id: e.target.value })
                  }
                >
                  <option value="">{tr("Seleziona autodromo")}</option>
                  {circuits.map((circuit) => (
                    <option key={circuit.id} value={circuit.id}>
                      {circuit.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setCircuitOpen(true)}
                  className="race-action-secondary h-[46px] px-4"
                  aria-label={tr("Aggiungi autodromo")}
                >
                  <MapPinned size={18} />
                </button>
              </div>
            </UiField>

            <UiField
              label="Note"
              hint="Indicazioni logistiche o tecniche utili sul weekend."
            >
              <textarea
                className={uiTextareaClassName}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={tr("Es. test gomme, programma weekend, logistica paddock...")}
              />
            </UiField>
          </div>
        </ModalShell>
      ) : null}

      {circuitOpen && canEditEvents ? (
        <ModalShell
          title={tr("Nuovo autodromo")}
          subtitle="Aggiungi un circuito alla configurazione del team."
          onClose={() => setCircuitOpen(false)}
          maxWidth="max-w-lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setCircuitOpen(false)}>
                <LocalizedText text="Annulla" />
              </Button>
              <Button onClick={saveCircuit} disabled={saving}>
                {saving ? "Salvataggio..." : "Salva autodromo"}
              </Button>
            </>
          }
        >
          <UiField label="Nome autodromo">
            <input
              className={uiInputClassName}
              value={newCircuitName}
              onChange={(e) => setNewCircuitName(e.target.value)}
              placeholder={tr("Es. Monza")}
            />
          </UiField>
        </ModalShell>
      ) : null}
    </div>
  );
}
