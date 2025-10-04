"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  PlusCircle,
  CalendarDays,
  Edit,
  Clock,
  MapPin,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type EventRow = {
  id: string;
  date: string;
  name: string;
  autodrome_id: string | null;
  autodrome: { id: string; name: string } | null;
  notes: string | null;
  hours_total_event: number | null;
};

type CarRow = { id: string; name: string };
type AutodromeRow = { id: string; name: string };

export default function CalendarPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [autodromes, setAutodromes] = useState<AutodromeRow[]>([]);
  const [turns, setTurns] = useState<Record<string, any[]>>({});
  const [eventCarsNames, setEventCarsNames] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(false);

  // Modali
  const [modalOpen, setModalOpen] = useState(false);
  const [turnModal, setTurnModal] = useState(false);
  const [autodromeModal, setAutodromeModal] = useState(false);

  const [editing, setEditing] = useState<EventRow | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  // form evento
  const [formData, setFormData] = useState({
    date: "",
    name: "",
    autodrome_id: "",
    notes: "",
  });
  const [selectedCarIds, setSelectedCarIds] = useState<string[]>([]);

  // form turno
  const [turnForm, setTurnForm] = useState({
    car_id: "",
    minutes: "",
  });

  // form nuovo autodromo
  const [newAutodrome, setNewAutodrome] = useState("");

  // filtro autodromo
  const [filterAutodrome, setFilterAutodrome] = useState<string>("");

  // ======= FETCH =======
  const fetchAutodromes = async () => {
    const { data, error } = await supabase
      .from("autodromes")
      .select("id, name")
      .order("name", { ascending: true });
    if (!error) setAutodromes(data || []);
  };

  const fetchEvents = async () => {
    setLoading(true);

    const { data: ev } = await supabase
      .from("events")
      .select(
        "id, date, name, autodrome_id, autodrome:autodrome_id (id, name), notes, hours_total_event"
      )
      .order("date", { ascending: false });

    const { data: carData } = await supabase.from("cars").select("id, name");

    setCars((carData as CarRow[]) || []);
    setEvents((ev as EventRow[]) || []);
    setLoading(false);

    // Turni per evento
    const turnsMap: Record<string, any[]> = {};
    for (const e of (ev as EventRow[]) || []) {
      const { data: t } = await supabase
        .from("event_car_turns")
        .select("id, car_id (name), minutes, created_at")
        .eq("event_id", e.id)
        .order("created_at", { ascending: true });
      turnsMap[e.id] = t || [];
    }
    setTurns(turnsMap);

    // Auto partecipanti per evento (nomi)
    const namesMap: Record<string, string[]> = {};
    for (const e of (ev as EventRow[]) || []) {
      const { data: ecs } = await supabase
        .from("event_cars")
        .select("car_id (name)")
        .eq("event_id", e.id);
      namesMap[e.id] = (ecs || [])
        .map((r: any) => r.car_id?.name)
        .filter(Boolean);
    }
    setEventCarsNames(namesMap);
  };

  useEffect(() => {
    fetchAutodromes();
    fetchEvents();
  }, []);

  // ======= SALVA EVENTO =======
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.name || !formData.autodrome_id) {
      alert("Compila data, nome ed autodromo");
      return;
    }

    let dbError: any = null;
    let eventId: string | null = editing?.id || null;

    if (editing) {
      const { error } = await supabase
        .from("events")
        .update({
          date: formData.date,
          name: formData.name,
          autodrome_id: formData.autodrome_id,
          notes: formData.notes,
        })
        .eq("id", editing.id);
      dbError = error || null;
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert([
          {
            date: formData.date,
            name: formData.name,
            autodrome_id: formData.autodrome_id,
            notes: formData.notes,
          },
        ])
        .select("id")
        .single();
      dbError = error || null;
      eventId = data?.id || null;
    }

    if (dbError || !eventId) {
      console.error("Errore salvataggio evento:", dbError);
      alert("Errore durante il salvataggio dell'evento");
      return;
    }

    // Sincronizza event_cars (auto partecipanti)
    await supabase.from("event_cars").delete().eq("event_id", eventId);
    if (selectedCarIds.length > 0) {
      const rows = selectedCarIds.map((cid) => ({
        event_id: eventId!,
        car_id: cid,
      }));
      const { error: ecErr } = await supabase.from("event_cars").insert(rows);
      if (ecErr) {
        console.error("Errore salvataggio auto partecipanti:", ecErr);
      }
    }

    setModalOpen(false);
    await fetchEvents();
  };

  // ======= SALVA TURNO =======
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

  // ======= AGGIUNGI AUTODROMO =======
  const handleAddAutodrome = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = newAutodrome.trim();
    if (!name) return alert("Inserisci un nome valido");

    const existing = autodromes.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      alert("Autodromo già presente!");
      return;
    }

    const { error } = await supabase.from("autodromes").insert([{ name }]);
    if (error) {
      console.error(error);
      alert("Errore durante la creazione dell'autodromo");
      return;
    }

    setNewAutodrome("");
    setAutodromeModal(false);
    fetchAutodromes();
  };

  // ======= FILTRO EVENTI =======
  const filteredEvents = filterAutodrome
    ? events.filter((ev) => ev.autodrome_id === filterAutodrome)
    : events;

  // Lista auto per modale turni
  const carsForSelectedEvent: CarRow[] = (() => {
    if (!selectedEvent) return cars;
    const names = eventCarsNames[selectedEvent.id] || [];
    if (names.length === 0) return cars;
    const setNames = new Set(names);
    return cars.filter((c) => setNames.has(c.name));
  })();

  // ======= UI =======
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
            setFormData({ date: "", name: "", autodrome_id: "", notes: "" });
            setSelectedCarIds([]);
            setModalOpen(true);
          }}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
        >
          <PlusCircle size={18} /> Aggiungi evento
        </button>
      </div>

      {/* Filtro autodromo */}
      <div className="flex items-center gap-3">
        <label className="font-semibold text-gray-700">Filtra per autodromo:</label>
        <select
          value={filterAutodrome}
          onChange={(e) => setFilterAutodrome(e.target.value)}
          className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
        >
          <option value="">Tutti</option>
          {autodromes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Lista eventi */}
      {loading ? (
        <p>Caricamento...</p>
      ) : filteredEvents.length === 0 ? (
        <p className="text-gray-600">Nessun evento registrato</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-black text-yellow-500">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Evento</th>
                <th className="p-3 text-left">Autodromo</th>
                <th className="p-3 text-left">Auto partecipanti</th>
                <th className="p-3 text-left">Ore Totali</th>
                <th className="p-3 text-left">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev) => (
                <tr key={ev.id} className="border-t align-top">
                  <td className="p-3">
                    {new Date(ev.date).toLocaleDateString("it-IT")}
                  </td>
                  <td className="p-3 font-semibold">{ev.name}</td>
                  <td className="p-3">{ev.autodrome?.name || "—"}</td>
                  <td className="p-3">
                    {eventCarsNames[ev.id]?.length
                      ? eventCarsNames[ev.id].join(", ")
                      : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <Clock className="inline mr-1" size={14} />
                    {ev.hours_total_event?.toFixed(1) || 0}
                  </td>
                  <td className="p-3 flex gap-2">
                    <button
                      onClick={async () => {
                        setEditing(ev);
                        setFormData({
                          date: ev.date?.split("T")[0] || "",
                          name: ev.name,
                          autodrome_id: ev.autodrome_id || "",
                          notes: ev.notes || "",
                        });
                        const { data: ecs } = await supabase
                          .from("event_cars")
                          .select("car_id")
                          .eq("event_id", ev.id);
                        setSelectedCarIds((ecs || []).map((r: any) => r.car_id));
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

      {/* Modale evento */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Modifica evento" : "Aggiungi evento"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                {/* Autodromo */}
                <div className="md:col-span-2 flex items-center gap-2">
                  <select
                    value={formData.autodrome_id}
                    onChange={(e) =>
                      setFormData({ ...formData, autodrome_id: e.target.value })
                    }
                    className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="">Seleziona autodromo</option>
                    {autodromes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAutodromeModal(true)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg p-2 shadow-sm"
                    title="Aggiungi nuovo autodromo"
                  >
                    <MapPin size={20} />
                  </button>
                </div>

                <div className="md:col-span-2">
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Note (opzionale)"
                    className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>

              {/* Auto partecipanti */}
              <div className="border rounded-xl p-4">
                <p className="font-semibold mb-2">Auto partecipanti</p>
                {cars.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nessuna auto presente in archivio.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cars.map((car) => {
                      const checked = selectedCarIds.includes(car.id);
                      return (
                        <label
                          key={car.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCarIds((prev) => [...prev, car.id]);
                              } else {
                                setSelectedCarIds((prev) =>
                                  prev.filter((id) => id !== car.id)
                                );
                              }
                            }}
                          />
                          <span>{car.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

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

      {/* Modale aggiungi autodromo */}
      {autodromeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin className="text-yellow-500" /> Nuovo autodromo
            </h2>
            <form className="flex flex-col gap-4" onSubmit={handleAddAutodrome}>
              <input
                type="text"
                placeholder="Nome autodromo"
                value={newAutodrome}
                onChange={(e) => setNewAutodrome(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAutodromeModal(false)}
                  className="px-4 py-2 rounded-lg border"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
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
