"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // form state
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formHours, setFormHours] = useState<number>(0);
  const [formNotes, setFormNotes] = useState("");

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, date, name, hours, car_id (name), notes")
      .order("date", { ascending: false });

    if (!error) setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openModal = (ev: any | null = null) => {
    setEditing(ev);
    setFormDate(ev?.date?.split("T")[0] || "");
    setFormName(ev?.name || "");
    setFormHours(ev?.hours || 0);
    setFormNotes(ev?.notes || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDate || !formName) {
      alert("Compila almeno data ed evento");
      return;
    }

    const payload = {
      date: formDate,
      name: formName,
      hours: formHours,
      notes: formNotes,
    };

    let error = null;

    if (editing) {
      const { error: updateError } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("events").insert([
        {
          ...payload,
          car_id: null, // per ora null, poi aggiungeremo select auto
        },
      ]);
      error = insertError;
    }

    if (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore nel salvataggio evento");
    } else {
      await fetchEvents();
      setModalOpen(false);
    }
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
                <th className="p-3 text-left">Auto</th>
                <th className="p-3 text-left">Ore</th>
                <th className="p-3 text-left">Note</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t">
                  <td className="p-3">
                    {new Date(ev.date).toLocaleDateString("it-IT")}
                  </td>
                  <td className="p-3">{ev.name}</td>
                  <td className="p-3">{ev.car_id?.name || "—"}</td>
                  <td className="p-3 font-semibold">{ev.hours}</td>
                  <td className="p-3 text-gray-600">{ev.notes || "—"}</td>
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
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome evento"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="number"
                value={formHours}
                onChange={(e) => setFormHours(Number(e.target.value))}
                placeholder="Ore evento"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Note (opzionale)"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              ></textarea>

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
          </div>
        </div>
      )}
    </div>
  );
}
