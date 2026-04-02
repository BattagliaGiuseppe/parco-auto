"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Audiowide } from "next/font/google";
import { ArrowLeft, CalendarClock, Plus, Edit2, Trash2, Save, X } from "lucide-react";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Turn = {
  id: string;
  event_car_id: string;
  date: string | null;
  minutes: number | null;
  driver: string | null;
  notes: string | null;
};

export default function EventCarTurnsPage() {
  const { eventId, eventCarId } = useParams() as { eventId: string; eventCarId: string };
  const router = useRouter();

  // Dark mode di default
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<Partial<Turn>>({
    date: new Date().toISOString().slice(0, 16), // input datetime-local friendly
    minutes: 20,
    driver: "",
    notes: "",
  });
  const [editing, setEditing] = useState<Turn | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const fetchAll = async () => {
    setLoading(true);
    const { data: ev } = await supabase
      .from("events")
      .select("id,name,date")
      .eq("id", eventId)
      .single();

    const { data: ec } = await supabase
      .from("event_cars")
      .select("id, car_id (id,name)")
      .eq("id", eventCarId)
      .single();

    const { data: t } = await supabase
      .from("event_car_turns")
      .select("id, event_car_id, date, minutes, driver, notes")
      .eq("event_car_id", eventCarId)
      .order("date", { ascending: true });

    setEvent(ev || null);
    setCar(ec?.car_id || null);
    setTurns((t as Turn[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [eventId, eventCarId]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().slice(0, 16),
      minutes: 20,
      driver: "",
      notes: "",
    });
  };

  const saveTurn = async () => {
    if (!form.date || !form.minutes) {
      alert("Compila data e minuti.");
      return;
    }
    const payload = {
      event_car_id: eventCarId,
      date: new Date(form.date as string).toISOString(),
      minutes: Number(form.minutes),
      driver: form.driver || null,
      notes: form.notes || null,
    };

    if (editing) {
      const { error } = await supabase.from("event_car_turns").update(payload).eq("id", editing.id);
      if (error) return alert("Errore aggiornamento turno: " + error.message);
      showToast("Turno aggiornato ✅");
    } else {
      const { error } = await supabase.from("event_car_turns").insert([payload]);
      if (error) return alert("Errore creazione turno: " + error.message);
      showToast("Turno aggiunto ✅");
    }

    await fetchAll();
    resetForm();
  };

  const editTurn = (t: Turn) => {
    setEditing(t);
    setForm({
      date: t.date ? new Date(t.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      minutes: t.minutes ?? 0,
      driver: t.driver ?? "",
      notes: t.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const delTurn = async (t: Turn) => {
    if (!confirm("Eliminare questo turno? L'operazione aggiornerà anche le ore di auto e componenti.")) return;
    const { error } = await supabase.from("event_car_turns").delete().eq("id", t.id);
    if (error) return alert("Errore eliminazione turno: " + error.message);
    showToast("Turno eliminato ✅");
    await fetchAll();
  };

  // calcoli utili per UI
  const totalMinutes = useMemo(() => (turns?.reduce((s, t) => s + (t.minutes || 0), 0) || 0), [turns]);
  const totalHours = useMemo(() => (totalMinutes / 60).toFixed(2), [totalMinutes]);

  if (loading) return <p className="p-6 text-gray-500">Caricamento...</p>;
  if (!event || !car) return <div className="p-6 text-red-500">Errore: dati non trovati.</div>;

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg shadow-md">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CalendarClock className="text-yellow-500" /> Turni — {car.name} · {event.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Totale evento: {totalMinutes} min ({totalHours} h)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark((d) => !d)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-neutral-900"
            title="Toggle tema scuro"
          >
            🌓 Tema
          </button>

          <Link
            href={`/calendar/${eventId}/car/${eventCarId}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-100 font-semibold"
          >
            <ArrowLeft size={16} /> Indietro
          </Link>
        </div>
      </div>

      {/* Form nuovo / modifica turno */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          {editing ? "Modifica turno" : "Nuovo turno"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Data e ora</label>
            <input
              type="datetime-local"
              value={form.date as string}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-neutral-700"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Durata (minuti)</label>
            <input
              type="number"
              value={form.minutes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, minutes: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-neutral-700"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Pilota</label>
            <input
              type="text"
              value={form.driver ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, driver: e.target.value }))}
              placeholder="Es. Rossi"
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-neutral-700"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Note</label>
            <input
              type="text"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Sessione gomme soft, ecc."
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-neutral-700"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          {editing && (
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-100"
            >
              <X size={16} /> Annulla
            </button>
          )}
          <button
            onClick={saveTurn}
            className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold inline-flex items-center gap-2"
          >
            <Save size={16} />
            {editing ? "Aggiorna turno" : "Aggiungi turno"}
          </button>
        </div>
      </section>

      {/* Elenco turni */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full rounded-2xl overflow-hidden">
            <thead className="bg-black text-yellow-500">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Durata</th>
                <th className="p-3 text-left">Pilota</th>
                <th className="p-3 text-left">Note</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {turns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-600 dark:text-gray-400">
                    Nessun turno registrato
                  </td>
                </tr>
              ) : (
                turns.map((t) => (
                  <tr key={t.id} className="border-t border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="p-3 text-gray-800 dark:text-gray-100">
                      {t.date ? new Date(t.date).toLocaleString("it-IT") : "—"}
                    </td>
                    <td className="p-3 text-gray-800 dark:text-gray-100">{t.minutes} min</td>
                    <td className="p-3 text-gray-800 dark:text-gray-100">{t.driver || "—"}</td>
                    <td className="p-3 text-gray-800 dark:text-gray-100">{t.notes || "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => editTurn(t)}
                          className="px-3 py-1 rounded-lg bg-gray-900 text-yellow-400 hover:bg-gray-800 inline-flex items-center gap-1"
                          title="Modifica"
                        >
                          <Edit2 size={14} /> Modifica
                        </button>
                        <button
                          onClick={() => delTurn(t)}
                          className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white inline-flex items-center gap-1"
                          title="Elimina"
                        >
                          <Trash2 size={14} /> Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
