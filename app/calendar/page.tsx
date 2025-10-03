"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Car = { id: string; name: string };
type Circuit = { id: string; name: string };

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [eventCars, setEventCars] = useState<any[]>([]);
  const [eventTurns, setEventTurns] = useState<Record<string, any[]>>({}); // turni per auto
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // sottosezione autodromi
  const [circuitModalOpen, setCircuitModalOpen] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState("");

  // form state evento
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formCircuitId, setFormCircuitId] = useState<string>("");

  // form per aggiungere auto
  const [selectedCarId, setSelectedCarId] = useState("");

  // form per aggiungere turni (gestito per ogni auto)
  const [turnForm, setTurnForm] = useState<Record<string, { start: string; end: string; notes: string }>>({});

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, date, name, notes, circuit_id (id, name)")
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

  const fetchEventCars = async (eventId: string) => {
    const { data, error } = await supabase
      .from("event_cars")
      .select("id, car_id (id, name), driver, status")
      .eq("event_id", eventId);

    if (!error) {
      setEventCars(data || []);
      // carico anche i turni
      for (const ec of data || []) {
        await fetchTurnsForCar(ec.id);
      }
    }
  };

  const fetchTurnsForCar = async (eventCarId: string) => {
    const { data, error } = await supabase
      .from("event_car_turns")
      .select("id, start_time, end_time, minutes, notes")
      .eq("event_car_id", eventCarId)
      .order("start_time", { ascending: true });

    if (!error) {
      setEventTurns((prev) => ({ ...prev, [eventCarId]: data || [] }));
    }
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
    setFormCircuitId(ev?.circuit_id?.id?.toString?.() || "");
    setModalOpen(true);
    if (ev?.id) fetchEventCars(ev.id);
    else {
      setEventCars([]);
      setEventTurns({});
    }
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
      circuit_id: formCircuitId || null,
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

  const handleAddCarToEvent = async () => {
    if (!editing?.id || !selectedCarId) return;

    const { error } = await supabase.from("event_cars").insert([
      {
        event_id: editing.id,
        car_id: selectedCarId,
        driver: null,
        status: "in_corso",
      },
    ]);

    if (error) {
      console.error("Errore aggiunta auto all'evento:", error);
      alert("Errore");
      return;
    }

    setSelectedCarId("");
    await fetchEventCars(editing.id);
  };

  const handleAddTurn = async (eventCarId: string) => {
    const form = turnForm[eventCarId];
    if (!form?.start || !form?.end) {
      alert("Compila inizio e fine turno");
      return;
    }

    const start = new Date(form.start);
    const end = new Date(form.end);
    const minutes = Math.floor((end.getTime() - start.getTime()) / 60000);

    if (minutes <= 0) {
      alert("Orari non validi");
      return;
    }

    const { error } = await supabase.from("event_car_turns").insert([
      {
        event_car_id: eventCarId,
        start_time: form.start,
        end_time: form.end,
        minutes,
        notes: form.notes || null,
      },
    ]);

    if (error) {
      console.error("Errore aggiunta turno:", error);
      alert("Errore salvataggio turno");
      return;
    }

    setTurnForm((prev) => ({
      ...prev,
      [eventCarId]: { start: "", end: "", notes: "" },
    }));

    await fetchTurnsForCar(eventCarId);
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 overflow-y-auto max-h-[90vh]">
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
                    <option key={c.id} value={c.id}>
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
                  Salva evento
                </button>
              </div>
            </form>

            {/* Se evento esiste già mostriamo sottosezione auto */}
            {editing?.id && (
              <div className="mt-6">
                <h3 className="text-lg font-bold mb-3">Auto coinvolte</h3>
                <div className="flex items-center gap-2 mb-3">
                  <select
                    value={selectedCarId}
                    onChange={(e) => setSelectedCarId(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="">— Seleziona auto —</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddCarToEvent}
                    type="button"
                    className="px-3 py-2 bg-yellow-400 hover:bg-yellow-500 rounded-lg text-sm font-semibold"
                  >
                    Aggiungi
                  </button>
                </div>

                {eventCars.length === 0 ? (
                  <p className="text-gray-600">Nessuna auto collegata</p>
                ) : (
                  eventCars.map((ec) => (
                    <div key={ec.id} className="border rounded-lg p-3 mb-4">
                      <h4 className="font-semibold mb-2">{ec.car_id?.name}</h4>
                      {/* Turni per questa auto */}
                      <div className="mb-2">
                        {eventTurns[ec.id]?.length ? (
                          <table className="w-full text-sm border">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="p-2 text-left">Inizio</th>
                                <th className="p-2 text-left">Fine</th>
                                <th className="p-2 text-left">Durata</th>
                                <th className="p-2 text-left">Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {eventTurns[ec.id].map((t) => (
                                <tr key={t.id} className="border-t">
                                  <td className="p-2">{new Date(t.start_time).toLocaleTimeString("it-IT")}</td>
                                  <td className="p-2">{new Date(t.end_time).toLocaleTimeString("it-IT")}</td>
                                  <td className="p-2">{t.minutes} min</td>
                                  <td className="p-2">{t.notes || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-gray-500 text-sm">Nessun turno registrato</p>
                        )}
                      </div>

                      {/* Form aggiunta turno */}
                      <div className="flex flex-col md:flex-row gap-2 mt-2">
                        <input
                          type="datetime-local"
                          value={turnForm[ec.id]?.start || ""}
                          onChange={(e) =>
                            setTurnForm((prev) => ({
                              ...prev,
                              [ec.id]: { ...prev[ec.id], start: e.target.value },
                            }))
                          }
                          className="border rounded-lg px-2 py-1 text-sm flex-1"
                        />
                        <input
                          type="datetime-local"
                          value={turnForm[ec.id]?.end || ""}
                          onChange={(e) =>
                            setTurnForm((prev) => ({
                              ...prev,
                              [ec.id]: { ...prev[ec.id], end: e.target.value },
                            }))
                          }
                          className="border rounded-lg px-2 py-1 text-sm flex-1"
                        />
                        <input
                          type="text"
                          value={turnForm[ec.id]?.notes || ""}
                          onChange={(e) =>
                            setTurnForm((prev) => ({
                              ...prev,
                              [ec.id]: { ...prev[ec.id], notes: e.target.value },
                            }))
                          }
                          placeholder="Note"
                          className="border rounded-lg px-2 py-1 text-sm flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTurn(ec.id)}
                          className="px-3 py-2 bg-yellow-400 hover:bg-yellow-500 rounded-lg text-sm font-semibold"
                        >
                          ➕ Turno
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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
