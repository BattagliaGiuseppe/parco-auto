"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  Droplets,
  Edit2,
  Info,
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

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

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

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

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

    const carRow = normalizeRelation(ec?.car_id as unknown as CarInfo | CarInfo[] | null);

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
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          Caricamento turni in corso...
        </div>
      </div>
    );
  }

  if (!eventInfo || !carInfo) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <FormStatusBanner
          type="error"
          message="Impossibile trovare i dati dell'evento o del mezzo selezionato."
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title={`Turni • ${carInfo.name ?? "Mezzo"}`}
        subtitle={`Evento: ${eventInfo.name ?? "Evento"}${eventInfo.date ? ` • ${new Date(eventInfo.date).toLocaleDateString("it-IT")}` : ""}`}
        icon={<Droplets size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
            >
              <Printer size={16} className="mr-2 inline" />
              Stampa scheda
            </button>

            <Link
              href={`/calendar/${eventId}/car/${eventCarId}`}
              className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
            >
              <ArrowLeft size={16} className="mr-2 inline" />
              Console mezzo
            </Link>
          </div>
        }
      />

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <SectionCard>
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
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Questa pagina è dedicata alla registrazione e revisione rapida dei turni."
      >
        <InfoBlock>
          Usa questa vista per aggiornare o correggere lo storico dei turni del mezzo.
          Ogni record registra data, durata, pilota e note tecniche. La stampa scheda ti
          permette di portare il riepilogo in pista in formato rapido.
        </InfoBlock>
      </SectionCard>

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
                  className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
                >
                  Annulla modifica
                </button>
              ) : null}

              <button
                type="button"
                onClick={saveTurn}
                disabled={saving}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-yellow-200"
              >
                <Save size={16} className="mr-2 inline" />
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
                  className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-neutral-900">
                        {turn.driver || "Pilota non indicato"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {formatDateTime(turn.date)} · {turn.minutes ?? "—"} min
                      </div>

                      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
                        {turn.notes || "Nessuna nota tecnica registrata."}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:w-[240px] lg:justify-end">
                      <button
                        type="button"
                        onClick={() => editTurn(turn)}
                        className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
                      >
                        <Edit2 size={16} className="mr-2 inline" />
                        Modifica
                      </button>

                      <InlineConfirmButton
                        label="Elimina"
                        message="Eliminare questo turno?"
                        onConfirm={() => deleteTurn(turn.id)}
                        className="rounded-xl bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100"
                        icon={<Trash2 size={16} className="mr-2 inline" />}
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
