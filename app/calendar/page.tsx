"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, CalendarDays, Edit, Clock } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type EventRow = {
  id: string;
  date: string;
  name: string;
  autodrome: string | null;
  notes: string | null;
  hours_total_event: number | null;
};

type CarRow = { id: string; name: string };

export default function CalendarPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [turns, setTurns] = useState<Record<string, any[]>>({});
  const [eventCarsNames, setEventCarsNames] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [turnModal, setTurnModal] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  // form evento
  const [formData, setFormData] = useState({
    date: "",
    name: "",
    autodrome: "",
    notes: "",
  });
  // multiselect auto partecipanti
  const [selectedCarIds, setSelectedCarIds] = useState<string[]>([]);

  // form turno
  const [turnForm, setTurnForm] = useState({
    car_id: "",
    minutes: "",
  });

  // ======= FETCH =======
  const fetchEvents = async () => {
    setLoading(true);

    const { data: ev } = await supabase
      .from("events")
      .select("id, date, name, autodrome, notes, hours_total_event")
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
    fetchEvents();
  }, []);

  // ======= SALVA EVENTO =======
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const autodromeName = formData.autodrome.trim();
    if (!formData.date || !formData.name || !autodromeName) {
      alert("Compila data, nome ed autodromo");
      return;
    }

    // Canonizzazione autodromo (case-insensitive)
    const existing = await supabase
      .from("events")
      .select("autodrome")
      .ilike("autodrome", autodromeName)
      .maybeSingle();
    const autodromeFinal = existing?.data?.autodrome || autodromeName;

    let dbError: any = null;
    let eventId: string | null = editing?.id || null;

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
      const { data, error } = await supabase
        .from("events")
        .insert([
          {
            date: formData.date,
            name: formData.name,
            autodrome: autodromeFinal,
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
    // Strategia semplice: wipe & insert
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

  // Autodromi esistenti per datalist
  const autodromes = Array.from(
    new Set(events.map((e) => e.autodrome).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  // Lista auto da proporre nella modale "Aggiungi turno":
  // se l'evento ha auto partecipanti, mostra solo quelle; altrimenti tutte.
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
            setFormData({ date: "", name: "", autodrome: "", notes: "" });
            setSelectedCarIds([]);
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
                <th className="p-3 text-left">Auto partecipanti</th>
                <th className="p-3 text-left">Ore Totali</th>
                <th className="p-3 text-left">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t align-top">
                  <td className="p-3">
                    {new Date(ev.date).toLocaleDateString("it-IT")}
                  </td>
                  <td className="p-3 font-semibold">{ev.name}</td>
                  <td className="p-3">{ev.autodrome}</td>
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
                          autodrome: ev.autodrome || "",
                          notes: ev.notes || "",
                        });
                        // carica auto partecipanti per l'evento
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
                {/* Autodromo con datalist */}
                <div className="md:col-span-2">
                  <input
                    list="autodromes"
                    value={formData.autodrome}
                    onChange={(e) =>
                      setFormData({ ...formData, autodrome: e.target.value })
                    }
                    placeholder="Autodromo"
                    className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-yellow-400"
                  />
                  <datalist id="autodromes">
                    {autodromes.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
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

              {/* Auto partecipanti (multiselect con checkbox) */}
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
                <p className="text-xs text-gray-500 mt-2">
                  Suggerimento: se selezioni le auto qui, nel form “+ Turno”
                  vedrai per prime solo le auto partecipanti.
                </p>
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
                {carsForSelectedEvent.map((c) => (
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
