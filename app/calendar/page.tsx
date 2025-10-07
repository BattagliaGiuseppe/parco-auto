"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit, Wrench, Trash2 } from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";
import { toast } from "sonner";

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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  // aggiunta turni
  const [turnForm, setTurnForm] = useState<Record<string, { date: string; minutes: string }>>({});

  // 🔁 Fetch functions
  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, date, name, notes, circuit_id (id, name)")
      .order("date", { ascending: false });

    if (error) toast.error("Errore caricamento eventi");
    else setEvents(data || []);
    setLoading(false);
  };

  const fetchCars = async () => {
    const { data } = await supabase.from("cars").select("id, name").order("name");
    setCars((data as Car[]) || []);
  };

  const fetchCircuits = async () => {
    const { data } = await supabase.from("circuits").select("id, name").order("name");
    setCircuits((data as Circuit[]) || []);
  };

  const fetchEventCars = async (eventId: string) => {
    const { data } = await supabase
      .from("event_cars")
      .select("id, car_id (id, name), status")
      .eq("event_id", eventId);
    setEventCars(data || []);
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const payload: any = {
      date: formDate,
      name: formName,
      notes: formNotes || null,
      circuit_id: formCircuitId || null,
    };

    const { error } = editing
      ? await supabase.from("events").update(payload).eq("id", editing.id)
      : await supabase.from("events").insert([payload]);

    if (error) toast.error("Errore salvataggio evento");
    else toast.success(editing ? "Evento aggiornato ✅" : "Evento aggiunto ✅");

    await fetchEvents();
    setModalOpen(false);
  };

  const handleAddCarToEvent = async () => {
    if (!editing?.id || !selectedCarId) return;
    const { error } = await supabase
      .from("event_cars")
      .insert([{ event_id: editing.id, car_id: selectedCarId, status: "in_corso" }]);
    if (error) toast.error("Errore aggiunta auto");
    else toast.success("Auto aggiunta all’evento");
    setSelectedCarId("");
    await fetchEventCars(editing.id);
  };

  const handleDeleteEvent = async (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteEvent = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("events").delete().eq("id", confirmDelete);
    if (error) toast.error("Errore eliminazione evento");
    else toast.success("Evento eliminato correttamente 🗑️");
    setConfirmDelete(null);
    await fetchEvents();
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

      {/* Modale conferma eliminazione */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold mb-2">Elimina evento</h3>
            <p className="text-gray-600 mb-4">
              Sei sicuro di voler eliminare definitivamente questo evento?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border text-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={confirmDeleteEvent}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
