"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Car = { id: string | number; name: string };

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // form state
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formAutodromo, setFormAutodromo] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formCarId, setFormCarId] = useState<string>("");

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      // Nota: manteniamo la relazione singola con car_id per compatibilità attuale
      .select("id, date, name, autodromo, notes, car_id (id, name)")
      .order("date", { ascending: false });

    if (!error) setEvents(data || []);
    setLoading(false);
  };

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name")
      .order("name", { ascending: true });
    if (!error) setCars((data as Car[]) || []);
  };

  useEffect(() => {
    fetchEvents();
    fetchCars();
  }, []);

  const openModal = (ev: any | null = null) => {
    setEditing(ev);
    setFormDate(ev?.date?.split("T")[0] || "");
    setFormName(ev?.name || "");
    setFormAutodromo(ev?.autodromo || "");
    setFormNotes(ev?.notes || "");
    setFormCarId(ev?.car_id?.id?.toString?.() || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDate || !formName) {
      alert("Compila almeno Data e Nome evento");
      return;
    }

    const payload: any = {
      date: formDate,
      name: formName,
      autodromo: formAutodromo || null,
      notes: formNotes || null,
      car_id: formCarId ? (isNaN(Number(formCarId)) ? formCarId : Number(formCarId)) : null,
    };

    if (editing) {
      const { error } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        console.error("Errore update:", error);
        alert("Errore nel salvataggio evento");
        return;
      }
    } else {
      const { error } = await supabase.from("events").insert([payload]);
      if (error) {
        console.error("Errore insert:", error);
        alert("Errore nel salvataggio evento");
        return;
      }
    }

    await fetchEvents();
    setModalOpen(false);
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarDays size={32} className="text-yellow-500" /> Calendario Eventi
        </h1>
        <button
          onClick={() => openModal(null)}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
        >
          <PlusCircle size={18} /> Aggiungi evento
        </button>
      </div>

      {/* Lista eventi */}
      {loading ? (
        <p>Caricamento...</p>
      ) : events.length === 0 ? (
        <p className="text-gray-600">Nessun evento registrato</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-black text-yellow-500">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Evento</th>
                <th className="p-3 text-left">Autodromo</th>
                <th className="p-3 text-left">Auto</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t">
                  <td className="p-3">
                    {ev.date ? new Date(ev.date).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td className="p-3">{ev.name}</td>
                  <td className="p-3">{ev.autodromo || "—"}</td>
                  <td className="p-3">{ev.car_id?.name || "—"}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => openModal(ev)}
                      className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <Edit size={14} /> Modifica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale eventi */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Modifica evento" : "Aggiungi evento"}
            </h2>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Data</span>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Nome evento</span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Es. Weekend Gara Monza"
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Autodromo</span>
                <input
                  type="text"
                  value={formAutodromo}
                  onChange={(e) => setFormAutodromo(e.target.value)}
                  placeholder="Es. Monza, Mugello..."
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Auto (provvisorio: relazione singola)</span>
                <select
                  value={formCarId}
                  onChange={(e) => setFormCarId(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">— Nessuna —</option>
                  {cars.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">
                  (Quando abiliteremo <code>event_cars</code> questa diventerà una multi-selezione)
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Note</span>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Note (opzionale)"
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                >
                  Salva
                </button>
              </div>
            </form>

            <div className="mt-3 text-xs text-gray-500">
              * Le ore per auto e i turni saranno gestiti nella scheda evento → auto (fase successiva).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
