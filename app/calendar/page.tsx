"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit, Wrench, Trash2 } from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Car = { id: string; name: string };
type Circuit = { id: string; name: string };

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [eventCars, setEventCars] = useState<any[]>([]);
  const [eventTurns, setEventTurns] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // gestione autodromi
  const [circuitModalOpen, setCircuitModalOpen] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState("");

  // form evento
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formCircuitId, setFormCircuitId] = useState<string>("");

  // aggiunta auto
  const [selectedCarId, setSelectedCarId] = useState("");
  const [selectedCarsForNewEvent, setSelectedCarsForNewEvent] = useState<string[]>([]);

  // ==================== FETCH PRINCIPALI ====================
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
    const { data, error } = await supabase.from("cars").select("id, name").order("name");
    if (!error) setCars((data as Car[]) || []);
  };

  const fetchCircuits = async () => {
    const { data, error } = await supabase.from("circuits").select("id, name").order("name");
    if (!error) setCircuits((data as Circuit[]) || []);
  };

  // ==================== FETCH EVENT_CARS ====================
  const fetchEventCars = async (eventId: string) => {
    const { data, error } = await supabase
      .from("event_cars")
      .select("id, car_id (id, name), status")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Errore fetch event_cars:", error);
      return;
    }

    console.log("Event cars aggiornate:", data);
    setEventCars(data || []);
  };

  // ==================== EFFETTO INIZIALE ====================
  useEffect(() => {
    fetchEvents();
    fetchCars();
    fetchCircuits();
  }, []);

  // ==================== FUNZIONI PRINCIPALI ====================
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

  // ==================== CREAZIONE / MODIFICA EVENTO ====================
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const payload: any = {
      date: formDate,
      name: formName,
      notes: formNotes || null,
      circuit_id: formCircuitId || null,
    };

    let eventId = editing?.id;

    // 🔸 1. Creazione o aggiornamento evento
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) {
        alert("Errore aggiornamento evento: " + error.message);
        return;
      }
      alert("Evento aggiornato!");
    } else {
      const { data, error } = await supabase.from("events").insert([payload]).select("id").single();
      if (error) {
        alert("Errore creazione evento: " + error.message);
        return;
      }
      eventId = data.id;
      alert("Evento creato!");
    }

    // 🔸 2. Associazione auto selezionate
    if (selectedCarsForNewEvent.length > 0 && eventId) {
      const records = selectedCarsForNewEvent.map((carId) => ({
        event_id: eventId,
        car_id: carId,
        status: "in_corso",
      }));

      const { error } = await supabase.from("event_cars").insert(records);
      if (error) {
        alert("Errore aggiunta auto: " + error.message);
        return;
      }
    }

    // 🔸 3. Refresh lista eventi
    await fetchEvents();
    setModalOpen(false);
    setSelectedCarsForNewEvent([]);
  };

  // ==================== AGGIUNTA AUTO A EVENTO ESISTENTE ====================
  const handleAddCarToEvent = async () => {
    if (!editing?.id) {
      alert("Errore: evento non valido");
      return;
    }
    if (!selectedCarId) {
      alert("Seleziona un’auto prima di aggiungerla.");
      return;
    }

    const { error } = await supabase
      .from("event_cars")
      .insert([{ event_id: editing.id, car_id: selectedCarId, status: "in_corso" }]);

    if (error) {
      alert("Errore durante l’aggiunta: " + error.message);
    } else {
      alert("Auto aggiunta correttamente!");
      setSelectedCarId("");
      await fetchEventCars(editing.id);
    }
  };

  // ==================== ELIMINA EVENTO ====================
  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Vuoi davvero eliminare questo evento? Tutti i dati collegati verranno persi.")) return;

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) alert("Errore eliminazione evento: " + error.message);
    else {
      alert("Evento eliminato correttamente!");
      await fetchEvents();
    }
  };

  // ==================== RENDER PRINCIPALE ====================
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
                  <td className="p-3">{ev.date ? new Date(ev.date).toLocaleDateString("it-IT") : "—"}</td>
                  <td className="p-3">{ev.name}</td>
                  <td className="p-3">{ev.circuit_id?.name || "—"}</td>
                  <td className="p-3 text-right flex gap-2 justify-end">
                    <button
                      onClick={() => openModal(ev)}
                      className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <Edit size={14} /> Modifica
                    </button>

                    <Link
                      href={`/calendar/${ev.id}`}
                      className="bg-gray-800 hover:bg-gray-700 text-yellow-400 font-semibold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <Wrench size={14} /> Gestisci
                    </Link>

                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <Trash2 size={14} /> Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== MODALE EVENTO ==================== */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Modifica evento" : "Aggiungi evento"}
            </h2>

            {/* Form evento */}
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

              {/* Multi-select auto coinvolte */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Auto coinvolte
                </label>
                <select
                  multiple
                  value={selectedCarsForNewEvent}
                  onChange={(e) =>
                    setSelectedCarsForNewEvent(
                      Array.from(e.target.selectedOptions, (option) => option.value)
                    )
                  }
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400 h-32"
                >
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Tieni premuto Ctrl (Windows) o Cmd (Mac) per selezionare più auto
                </p>
              </div>

              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Note (opzionale)"
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
            </form>

            {/* Sezione gestione auto (solo se evento già creato) */}
            {editing?.id && (
              <div className="mt-6">
                <h3 className="text-lg font-bold mb-3">Auto aggiuntive</h3>
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
                      <h4 className="font-semibold mb-2">{ec.car_id?.name || "Auto non trovata"}</h4>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Bottoni finali */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                Salva evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
