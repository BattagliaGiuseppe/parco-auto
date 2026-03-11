"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  PlusCircle,
  CalendarDays,
  Edit,
  Wrench,
  Trash2,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Car = { id: string; name: string };
type Circuit = { id: string; name: string };
type CircuitRelation = { id: string; name: string } | { id: string; name: string }[] | null;
type CarRelation = { id: string; name: string } | { id: string; name: string }[] | null;

type EventRow = {
  id: string;
  date: string | null;
  name: string;
  notes: string | null;
  circuit_id: { id: string; name: string } | null;
};

type EventCarRow = {
  id: string;
  car_id: { id: string; name: string } | null;
  status: string | null;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

function normalizeCircuit(value: CircuitRelation): { id: string; name: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function normalizeCar(value: CarRelation): { id: string; name: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [eventCars, setEventCars] = useState<EventCarRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");

  const [editing, setEditing] = useState<EventRow | null>(null);

  const [circuitModalOpen, setCircuitModalOpen] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState("");
  const [savingCircuit, setSavingCircuit] = useState(false);

  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formCircuitId, setFormCircuitId] = useState<string>("");

  const [selectedCarId, setSelectedCarId] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const resetEventForm = () => {
    setFormDate("");
    setFormName("");
    setFormNotes("");
    setFormCircuitId("");
    setSelectedCarId("");
    setEditing(null);
    setEventCars([]);
  };

  const closeEventModal = () => {
    setModalOpen(false);
    resetEventForm();
  };

  const fetchEvents = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("events")
      .select("id, date, name, notes, circuit_id (id, name)")
      .order("date", { ascending: false });

    if (!error) {
      const normalized: EventRow[] = (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        name: row.name,
        notes: row.notes,
        circuit_id: normalizeCircuit(row.circuit_id),
      }));
      setEvents(normalized);
    }

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

  const fetchEventCars = async (eventId: string) => {
    const { data, error } = await supabase
      .from("event_cars")
      .select("id, car_id (id, name), status")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (!error) {
      const normalized: EventCarRow[] = (data || []).map((row: any) => ({
        id: row.id,
        car_id: normalizeCar(row.car_id),
        status: row.status,
      }));
      setEventCars(normalized);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchCars();
    fetchCircuits();
  }, []);

  const openModal = async (ev: EventRow | null = null) => {
    if (!ev) {
      resetEventForm();
      setModalOpen(true);
      return;
    }

    setEditing(ev);
    setFormDate(ev.date ? ev.date.split("T")[0] : "");
    setFormName(ev.name || "");
    setFormNotes(ev.notes || "");
    setFormCircuitId(ev.circuit_id?.id || "");
    setModalOpen(true);
    await fetchEventCars(ev.id);
  };

  const handleSubmit = async () => {
    if (!formDate || !formName.trim()) {
      showToast("Compila almeno data e nome evento", "error");
      return;
    }

    setSavingEvent(true);

    try {
      const payload = {
        date: formDate,
        name: formName.trim(),
        notes: formNotes.trim() || null,
        circuit_id: formCircuitId || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editing.id);

        if (error) throw error;

        const updatedEvent: EventRow = {
          id: editing.id,
          date: payload.date,
          name: payload.name,
          notes: payload.notes,
          circuit_id: circuits.find((c) => c.id === payload.circuit_id) || null,
        };

        setEditing(updatedEvent);
        await fetchEvents();
        showToast("Evento aggiornato con successo ✅");
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .insert([payload])
        .select("id")
        .single();

      if (error || !data?.id) throw error || new Error("Errore creazione evento");

      const createdEvent: EventRow = {
        id: data.id,
        date: payload.date,
        name: payload.name,
        notes: payload.notes,
        circuit_id: circuits.find((c) => c.id === payload.circuit_id) || null,
      };

      setEditing(createdEvent);
      setEventCars([]);
      await fetchEvents();
      showToast("Evento creato. Ora puoi aggiungere le auto ✅");
    } catch (error: any) {
      showToast(`Errore salvataggio evento: ${error.message}`, "error");
    } finally {
      setSavingEvent(false);
    }
  };

  const handleAddCircuit = async () => {
    if (!newCircuitName.trim()) {
      showToast("Inserisci il nome dell'autodromo", "error");
      return;
    }

    setSavingCircuit(true);

    try {
      const { data, error } = await supabase
        .from("circuits")
        .insert([{ name: newCircuitName.trim() }])
        .select("id, name")
        .single();

      if (error || !data) throw error || new Error("Errore creazione autodromo");

      await fetchCircuits();
      setFormCircuitId(data.id);
      setNewCircuitName("");
      setCircuitModalOpen(false);
      showToast("Autodromo aggiunto ✅");
    } catch (error: any) {
      showToast(`Errore salvataggio autodromo: ${error.message}`, "error");
    } finally {
      setSavingCircuit(false);
    }
  };

  const handleAddCarToEvent = async () => {
    if (!editing?.id) {
      showToast("Salva prima l'evento", "error");
      return;
    }

    if (!selectedCarId) {
      showToast("Seleziona un'auto prima di aggiungerla", "error");
      return;
    }

    const { data: existing } = await supabase
      .from("event_cars")
      .select("id")
      .eq("event_id", editing.id)
      .eq("car_id", selectedCarId)
      .maybeSingle();

    if (existing) {
      showToast("Quest’auto è già associata a questo evento", "error");
      return;
    }

    const { error } = await supabase
      .from("event_cars")
      .insert([{ event_id: editing.id, car_id: selectedCarId, status: "in_corso" }]);

    if (error) {
      showToast(`Errore aggiunta auto: ${error.message}`, "error");
      return;
    }

    await fetchEventCars(editing.id);
    setSelectedCarId("");
    showToast("Auto aggiunta all’evento ✅");
  };

  const handleRemoveCarFromEvent = async (eventCarId: string) => {
    setConfirmMessage("Vuoi davvero rimuovere questa auto dall’evento?");
    setConfirmAction(() => async () => {
      const { error: turnsError } = await supabase
        .from("event_car_turns")
        .delete()
        .eq("event_car_id", eventCarId);

      if (turnsError) throw turnsError;

      const { error: dataError } = await supabase
        .from("event_car_data")
        .delete()
        .eq("event_car_id", eventCarId);

      if (dataError) throw dataError;

      const { error: eventCarError } = await supabase
        .from("event_cars")
        .delete()
        .eq("id", eventCarId);

      if (eventCarError) throw eventCarError;

      if (editing?.id) {
        await fetchEventCars(editing.id);
      }

      showToast("Auto rimossa dall’evento ✅");
    });
    setConfirmOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    setConfirmMessage("Vuoi davvero eliminare questo evento e tutti i dati collegati?");
    setConfirmAction(() => async () => {
      const { data: eventCarsRows, error: eventCarsReadError } = await supabase
        .from("event_cars")
        .select("id")
        .eq("event_id", eventId);

      if (eventCarsReadError) throw eventCarsReadError;

      const eventCarIds = (eventCarsRows || []).map((row: any) => row.id);

      if (eventCarIds.length > 0) {
        const { error: turnsError } = await supabase
          .from("event_car_turns")
          .delete()
          .in("event_car_id", eventCarIds);

        if (turnsError) throw turnsError;

        const { error: dataError } = await supabase
          .from("event_car_data")
          .delete()
          .in("event_car_id", eventCarIds);

        if (dataError) throw dataError;

        const { error: eventCarsDeleteError } = await supabase
          .from("event_cars")
          .delete()
          .eq("event_id", eventId);

        if (eventCarsDeleteError) throw eventCarsDeleteError;
      }

      const { error: eventDeleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (eventDeleteError) throw eventDeleteError;

      await fetchEvents();

      if (editing?.id === eventId) {
        closeEventModal();
      }

      showToast("Evento eliminato ✅");
    });
    setConfirmOpen(true);
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {toast.show && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-md z-50 ${
            toast.type === "success"
              ? "bg-white border border-gray-300 text-gray-700"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

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
                <tr key={ev.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    {ev.date ? new Date(ev.date).toLocaleDateString("it-IT") : "—"}
                  </td>
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 overflow-y-auto max-h-[90vh] relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={closeEventModal}
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-4">
              {editing ? "Modifica evento" : "Aggiungi evento"}
            </h2>

            <div className="flex flex-col gap-4">
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
            </div>

            {editing && (
              <div className="mt-6">
                <h3 className="text-lg font-bold mb-3">Auto associate</h3>

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
                    <div
                      key={ec.id}
                      className="border rounded-lg p-3 mb-3 flex items-center justify-between"
                    >
                      <h4 className="font-semibold">{ec.car_id?.name || "Auto non trovata"}</h4>
                      <button
                        onClick={() => handleRemoveCarFromEvent(ec.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold flex items-center gap-1"
                      >
                        <Trash2 size={14} /> Rimuovi
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeEventModal}
                className="px-4 py-2 rounded-lg border text-gray-700"
              >
                Chiudi
              </button>
              <button
                onClick={handleSubmit}
                disabled={savingEvent}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                {savingEvent ? "Salvataggio..." : "Salva evento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {circuitModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Nuovo autodromo</h3>

            <input
              type="text"
              value={newCircuitName}
              onChange={(e) => setNewCircuitName(e.target.value)}
              placeholder="Nome autodromo"
              className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-yellow-400"
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setCircuitModalOpen(false);
                  setNewCircuitName("");
                }}
                className="px-4 py-2 rounded-lg border text-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={handleAddCircuit}
                disabled={savingCircuit}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                {savingCircuit ? "Salvataggio..." : "Salva autodromo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <p className="text-gray-800 mb-6 text-center">{confirmMessage}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={async () => {
                  try {
                    if (confirmAction) {
                      await confirmAction();
                    }
                  } catch (error: any) {
                    showToast(error.message || "Errore operazione", "error");
                  } finally {
                    setConfirmOpen(false);
                    setConfirmAction(null);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                Conferma
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 rounded-lg border text-gray-700"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
