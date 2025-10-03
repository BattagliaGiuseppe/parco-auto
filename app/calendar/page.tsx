"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Car = { id: string | number; name: string };
type Circuit = { id: string | number; name: string };

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // sottosezione per aggiungere autodromo
  const [circuitModalOpen, setCircuitModalOpen] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState("");

  // form state evento
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formCarId, setFormCarId] = useState<string>("");
  const [formCircuitId, setFormCircuitId] = useState<string>("");

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, date, name, notes, car_id (id, name), circuit_id (id, name)")
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

  const fetchCircuits = async () => {
    const { data, error } = await supabase
      .from("circuits")
      .select("id, name")
      .order("name", { ascending: true });
    if (!error) setCircuits((data as Circuit[]) || []);
  };

  useEffect(() => {
    fetchEvents();
    fetchCars();
    fetchCircuits();
  }, []);

  const openModal = (ev: any | null = null) => {
    setEditing(ev);
    setFormDate(ev?.date?.split("T")[0] || "");
    setFormName(ev?.name || "");
    setFormNotes(ev?.notes || "");
    setFormCarId(ev?.car_id?.id?.toString?.() || "");
    setFormCircuitId(ev?.circuit_id?.id?.toString?.() || "");
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
      notes: formNotes || null,
      car_id: formCarId ? (isNaN(Number(formCarId)) ? formCarId : Number(formCarId)) : null,
      circuit_id: formCircuitId ? (isNaN(Number(formCircuitId)) ? formCircuitId : Number(formCircuitId)) : null,
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

  const handleAddCircuit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCircuitName.trim()) {
      alert("Inserisci il nome dell'autodromo");
      return;
    }

    const { error } = await supabase
      .from("circuits")
      .insert([{ name: newCircuitName.trim() }]);

    if (error) {
      console.error("Errore aggiunta autodromo:", error);
      alert("Errore salvataggio autodromo");
      return;
    }

    setNewCircuitName("");
    setCircuitModalOpen(false);
    await fetchCircuits();
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
                  <td className="p-3">{ev.circuit_id?.name || "—"}</td>
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

      {/* Modale evento */}
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

              <div className="flex items-center gap-2">
                <select
                  value={formCircuitId}
                  onChange={(e) => setFormCircuitId(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">— Seleziona autodromo —</option>
                  {circuits.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCircuitModalOpen(true)}
                  className="px-3 py-2 bg-yellow-300 hover:bg-yellow-400 rounded-lg text-sm"
                >
                  ➕
                </button>
              </div>

              <select
                value={formCarId}
                onChange={(e) => setFormCarId(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">— Nessuna auto —</option>
                {cars.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>

              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Note (opzionale)"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />

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

      {/* Mini-modale aggiunta autodromo */}
      {circuitModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Aggiungi Autodromo</h2>
            <form onSubmit={handleAddCircuit} className="flex flex-col gap-3">
              <input
                type="text"
                value={newCircuitName}
                onChange={(e) => setNewCircuitName(e.target.value)}
                placeholder="Nome autodromo"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCircuitModalOpen(false)}
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
