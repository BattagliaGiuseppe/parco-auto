"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit, Clock } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [turns, setTurns] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [turnModal, setTurnModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    date: "",
    name: "",
    autodrome: "",
    notes: "",
  });

  const [turnForm, setTurnForm] = useState({
    car_id: "",
    minutes: "",
  });

  // Fetch eventi e auto
  const fetchEvents = async () => {
    setLoading(true);

    const { data: ev } = await supabase
      .from("events")
      .select("id, date, name, autodrome, notes, hours_total_event")
      .order("date", { ascending: false });

    const { data: carData } = await supabase.from("cars").select("id, name");

    setCars(carData || []);
    setEvents(ev || []);
    setLoading(false);

    // Carica turni per ogni evento
    const turnsMap: Record<string, any[]> = {};
    for (const e of ev || []) {
      const { data: t } = await supabase
        .from("event_car_turns")
        .select("id, car_id (name), minutes, created_at")
        .eq("event_id", e.id)
        .order("created_at", { ascending: true });
      turnsMap[e.id] = t || [];
    }
    setTurns(turnsMap);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // SALVATAGGIO EVENTO
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const autodromeName = formData.autodrome.trim();

    if (!formData.date || !formData.name || !autodromeName) {
      alert("Compila tutti i campi obbligatori");
      return;
    }

    // Controlla se l'autodromo esiste già (case-insensitive)
    const existing = await supabase
      .from("events")
      .select("autodrome")
      .ilike("autodrome", autodromeName)
      .maybeSingle();

    const autodromeFinal = existing?.data?.autodrome || autodromeName;

    let dbError: any = null;

    if (editing) {
      const { error } = await supabase
        .from("events")
        .update({
          date: formData.date,
          name: formData.name,
          autodrome: autodromeFinal,
          notes: formData.notes,
        })
        .eq("id", editing.id);

      dbError = error || null;
    } else {
      const { error } = await supabase.from("events").insert([
        {
          date: formData.date,
          name: formData.name,
          autodrome: autodromeFinal,
          notes: formData.notes,
        },
      ]);

      dbError = error || null;
    }

    if (dbError) {
      console.error("Errore salvataggio evento:", dbError);
      alert("Errore durante il salvataggio dell'evento");
    } else {
      setModalOpen(false);
      fetchEvents();
    }
  };

  // SALVATAGGIO TURNO
  const handleAddTurn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEvent) return alert("Nessun evento selezionato");

    const minutes = parseInt(turnForm.minutes) || 0;
    if (!minutes || !turnForm.car_id) {
      return alert("Inserisci auto e minuti validi");
    }

    const { error } = await supabase.from("event_car_turns").insert([
      {
        event_id: selectedEvent.id,
        car_id: turnForm.car_id,
        minutes,
      },
    ]);

    if (error) {
      console.error("Errore aggiunta turno:", error);
      alert("Errore durante il salvataggio del turno");
    } else {
      setTurnModal(false);
      setTurnForm({ car_id: "", minutes: "" });
      fetchEvents();
    }
  };

  // AUTODROMI ESISTENTI (per datalist)
  const autodromes = Array.from(
    new Set(events.map((e) => e.autodrome).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // RENDER UI
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarDays size={32} className="text-yellow-500" /> Calendario Eventi
        </h1>
        <button
          onClick={() => {
            setEditing(null);
            setFormData({ date: "", name: "", autodrome: "", notes: "" });
            setModalOpen(true);
          }}
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
                <th className="p-3 text-left">Ore Totali</th>
                <th className="p-3 text-left">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t">
                  <td className="p-3">
                    {new Date(ev.date).toLocaleDateString("it-IT")}
                  </td>
                  <td className="p-3 font-semibold">{ev.name}</td>
                  <td className="p-3">{ev.autodrome}</td>
                  <td className="p-3 text-center">
                    <Clock className="inline mr-1" size={14} />
                    {ev.hours_total_event?.toFixed(1) || 0}
                  </td>
                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() => {
                        setEditing(ev);
                        setFormData({
                          date: ev.date?.split("T")[0] || "",
                          name: ev.name,
                          autodrome: ev.autodrome || "",
                          notes: ev.notes || "",
                        });
                        setModalOpen(true);
                      }}
                      className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <Edit size={14} /> Modifica
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEvent(ev);
                        setTurnModal(true);
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      + Turno
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Turni per evento */}
      {events.map(
        (ev) =>
          turns[ev.id]?.length > 0 && (
            <div
              key={`turns-${ev.id}`}
              className="bg-gray-100 border rounded-xl shadow-sm p-4"
            >
              <h3 className="font-bold text-lg mb-2 text-gray-800 flex items-center gap-2">
                🏎️ Turni – {ev.name}
              </h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-200 text-gray-700">
                  <tr>
                    <th className="p-2 text-left">Auto</th>
                    <th className="p-2 text-left">Minuti</th>
                    <th className="p-2 text-left">Data inserimento</th>
                  </tr>
                </thead>
                <tbody>
                  {turns[ev.id].map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">{t.car_id?.name || "—"}</td>
                      <td className="p-2">{t.minutes}</td>
                      <td className="p-2">
                        {new Date(t.created_at).toLocaleString("it-IT")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {/* Modale evento */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Modifica evento" : "Aggiungi evento"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nome evento"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              {/* Autodromo con datalist */}
              <input
                list="autodromes"
                value={formData.autodrome}
                onChange={(e) =>
                  setFormData({ ...formData, autodrome: e.target.value })
                }
                placeholder="Autodromo"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <datalist id="autodromes">
                {autodromes.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Note (opzionale)"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              ></textarea>

              <div className="flex justify-end gap-3 mt-2">
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

      {/* Modale turno */}
      {turnModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Aggiungi turno – {selectedEvent?.name}
            </h2>
            <form className="flex flex-col gap-4" onSubmit={handleAddTurn}>
              <select
                value={turnForm.car_id}
                onChange={(e) =>
                  setTurnForm({ ...turnForm, car_id: e.target.value })
                }
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">Seleziona auto</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Durata turno (minuti)"
                value={turnForm.minutes}
                onChange={(e) =>
                  setTurnForm({ ...turnForm, minutes: e.target.value })
                }
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTurnModal(false)}
                  className="px-4 py-2 rounded-lg border"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                >
                  Aggiungi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
