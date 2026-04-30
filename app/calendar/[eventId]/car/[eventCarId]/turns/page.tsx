"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  Droplets,
  Edit2,
  Printer,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import FormStatusBanner from "@/components/FormStatusBanner";
import InlineConfirmButton from "@/components/InlineConfirmButton";
import { UiField, uiInputClassName, uiTextareaClassName } from "@/components/UiField";

type EventInfo = {
  id: string;
  name: string | null;
  date: string | null;
};

type CarInfo = {
  id: string;
  name: string | null;
};

type Turn = {
  id: string;
  event_car_id: string;
  date: string | null;
  minutes: number | null;
  driver: string | null;
  notes: string | null;
};

type TurnForm = {
  date: string;
  minutes: string;
  driver: string;
  notes: string;
};

function toDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Data non impostata";
  return new Date(value).toLocaleString("it-IT");
}

function buildDefaultForm(): TurnForm {
  return {
    date: toDateTimeLocal(new Date()),
    minutes: "",
    driver: "",
    notes: "",
  };
}

export default function EventCarTurnsPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [carInfo, setCarInfo] = useState<CarInfo | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [form, setForm] = useState<TurnForm>(buildDefaultForm());
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  async function fetchAll() {
    setLoading(true);
    setFeedback(null);

    const [{ data: ev, error: evError }, { data: ec, error: ecError }, { data: t, error: turnsError }] =
      await Promise.all([
        supabase
          .from("events")
          .select("id,name,date")
          .eq("id", eventId)
          .single(),
        supabase
          .from("event_cars")
          .select("id, car_id ( id, name )")
          .eq("id", eventCarId)
          .single(),
        supabase
          .from("event_car_turns")
          .select("id,event_car_id,date,minutes,driver,notes")
          .eq("event_car_id", eventCarId)
          .order("date", { ascending: true }),
      ]);

    if (evError || ecError || turnsError) {
      setFeedback({
        type: "error",
        message:
          evError?.message ||
          ecError?.message ||
          turnsError?.message ||
          "Impossibile caricare i dati dei turni.",
      });
    }

    const rawCar = ec?.car_id as unknown;

const carRow: CarInfo | null = Array.isArray(rawCar)
  ? ((rawCar[0] ?? null) as CarInfo | null)
  : ((rawCar ?? null) as CarInfo | null);

    setEventInfo((ev as EventInfo | null) ?? null);
    setCarInfo(carRow);
    setTurns((t as Turn[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void fetchAll();
  }, [eventId, eventCarId]);

  function resetForm() {
    setEditingTurnId(null);
    setForm(buildDefaultForm());
    setFeedback(null);
  }

  function editTurn(turn: Turn) {
    setEditingTurnId(turn.id);
    setForm({
      date: turn.date ? toDateTimeLocal(new Date(turn.date)) : toDateTimeLocal(new Date()),
      minutes: turn.minutes != null ? String(turn.minutes) : "",
      driver: turn.driver ?? "",
      notes: turn.notes ?? "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTurn() {
    setFeedback(null);

    if (!form.date.trim()) {
      setFeedback({
        type: "error",
        message: "Inserisci data e ora del turno.",
      });
      return;
    }

    if (!form.minutes.trim()) {
      setFeedback({
        type: "error",
        message: "Inserisci la durata del turno in minuti.",
      });
      return;
    }

    const minutesNumber = Number(form.minutes);
    if (!Number.isFinite(minutesNumber) || minutesNumber <= 0) {
      setFeedback({
        type: "error",
        message: "La durata turno deve essere un numero maggiore di zero.",
      });
      return;
    }

    const payload = {
      event_car_id: eventCarId,
      date: new Date(form.date).toISOString(),
      minutes: minutesNumber,
      driver: form.driver.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);

    try {
      if (editingTurnId) {
        const { error } = await supabase
          .from("event_car_turns")
          .update(payload)
          .eq("id", editingTurnId);

        if (error) {
          setFeedback({
            type: "error",
            message: `Errore aggiornamento turno: ${error.message}`,
          });
          return;
        }

        setFeedback({
          type: "success",
          message: "Turno aggiornato correttamente.",
        });
      } else {
        const { error } = await supabase.from("event_car_turns").insert([payload]);

        if (error) {
          setFeedback({
            type: "error",
            message: `Errore creazione turno: ${error.message}`,
          });
          return;
        }

        setFeedback({
          type: "success",
          message: "Turno aggiunto correttamente.",
        });
      }

      await fetchAll();
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTurn(turnId: string) {
    setFeedback(null);

    const { error } = await supabase
      .from("event_car_turns")
      .delete()
      .eq("id", turnId);

    if (error) {
      setFeedback({
        type: "error",
        message: `Errore eliminazione turno: ${error.message}`,
      });
      return;
    }

    setFeedback({
      type: "success",
      message: "Turno eliminato correttamente.",
    });

    if (editingTurnId === turnId) {
      resetForm();
    }

    await fetchAll();
  }

  const totalMinutes = useMemo(
    () => turns.reduce((sum, turn) => sum + (turn.minutes || 0), 0),
    [turns]
  );

  const totalHours = useMemo(() => (totalMinutes / 60).toFixed(2), [totalMinutes]);

  const averageMinutes = useMemo(() => {
    if (turns.length === 0) return "0";
    return Math.round(totalMinutes / turns.length).toString();
  }, [totalMinutes, turns.length]);

  const lastTurnDate = useMemo(() => {
    if (turns.length === 0) return "Nessun turno";
    const last = [...turns]
      .filter((turn) => !!turn.date)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];

    return last?.date ? formatDateTime(last.date) : "Nessun turno";
  }, [turns]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 p-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          Caricamento turni in corso...
        </div>
      </div>
    );
  }

  if (!eventInfo || !carInfo) {
    return (
      <div className="min-h-screen bg-neutral-100 p-6">
        <FormStatusBanner
          type="error"
          message="Impossibile trovare i dati dell'evento o del mezzo selezionato."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Turni • ${carInfo.name ?? "Mezzo"}`}
        subtitle={`Evento: ${eventInfo.name ?? "Evento"}${eventInfo.date ? ` • ${new Date(eventInfo.date).toLocaleDateString("it-IT")}` : ""}`}
        icon={<Droplets size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <Printer size={16} className="mr-2" />
              Stampa scheda
            </button>

            <Link
              href={`/calendar/${eventId}/car/${eventCarId}`}
              className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <ArrowLeft size={16} className="mr-2" />
              Console mezzo
            </Link>
          </div>
        }
      />

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <StatsGrid
        items={[
          {
            label: "Turni registrati",
            value: String(turns.length),
            icon: <CalendarClock size={18} />,
            helper: "Sessioni salvate su questo mezzo",
          },
          {
            label: "Minuti totali",
            value: String(totalMinutes),
            icon: <Clock3 size={18} />,
            helper: `${totalHours} ore totali`,
          },
          {
            label: "Durata media",
            value: `${averageMinutes} min`,
            icon: <Droplets size={18} />,
            helper: "Media dei turni registrati",
          },
          {
            label: "Ultimo turno",
            value: lastTurnDate,
            icon: <UserRound size={18} />,
            helper: "Data e ora dell'ultima sessione",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <SectionCard
          title={editingTurnId ? "Modifica turno" : "Nuovo turno"}
          subtitle="Registra data, durata, pilota e note operative del turno."
        >
          <div className="grid grid-cols-1 gap-4">
            <UiField label="Data e ora turno">
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
                className={uiInputClassName}
              />
            </UiField>

            <UiField label="Durata turno (minuti)" hint="Inserisci la durata totale della sessione.">
              <input
                type="number"
                min="1"
                step="1"
                value={form.minutes}
                onChange={(e) => setForm((current) => ({ ...current, minutes: e.target.value }))}
                placeholder="Es. 20"
                className={uiInputClassName}
              />
            </UiField>

            <UiField label="Pilota" hint="Campo libero: puoi annotare nome e cognome del pilota impiegato nel turno.">
              <input
                value={form.driver}
                onChange={(e) => setForm((current) => ({ ...current, driver: e.target.value }))}
                placeholder="Es. Giuseppe Battaglia"
                className={uiInputClassName}
              />
            </UiField>

            <UiField label="Note operative" hint="Annotazioni tecniche, gomme, condizioni pista o osservazioni utili.">
              <textarea
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                placeholder="Es. Turno con gomme nuove, assetto posteriore irrigidito, pista in evoluzione..."
                className={uiTextareaClassName}
              />
            </UiField>

            <div className="flex flex-wrap justify-end gap-3">
              {editingTurnId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Annulla modifica
                </button>
              ) : null}

              <button
                type="button"
                onClick={saveTurn}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-yellow-200"
              >
                <Save size={16} className="mr-2" />
                {saving ? "Salvataggio..." : editingTurnId ? "Aggiorna turno" : "Aggiungi turno"}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Turni registrati"
          subtitle="Storico sessioni del mezzo durante l'evento."
        >
          {turns.length === 0 ? (
            <EmptyState
              title="Nessun turno registrato"
              description="Aggiungi il primo turno usando il modulo qui a sinistra."
            />
          ) : (
            <div className="space-y-4">
              {turns.map((turn) => (
                <div
                  key={turn.id}
                  className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Data e ora
                        </div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          {formatDateTime(turn.date)}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Durata
                        </div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          {turn.minutes ?? "—"} min
                        </div>
                      </div>

                      <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Pilota
                        </div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          {turn.driver || "Non indicato"}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-neutral-50 px-4 py-3 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Note
                        </div>
                        <div className="mt-1 text-sm leading-6 text-neutral-700">
                          {turn.notes || "Nessuna nota tecnica registrata."}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:w-[240px] lg:justify-end">
                      <button
                        type="button"
                        onClick={() => editTurn(turn)}
                        className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <Edit2 size={16} className="mr-2" />
                        Modifica
                      </button>

                      <InlineConfirmButton
                        label="Elimina"
                        message="Eliminare questo turno?"
                        onConfirm={() => deleteTurn(turn.id)}
                        className="inline-flex items-center justify-center rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                        icon={<Trash2 size={16} className="mr-2" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
