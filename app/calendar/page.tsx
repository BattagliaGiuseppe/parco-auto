""use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  PlusCircle,
  CalendarDays,
  Edit,
  Wrench,
  Trash2,
  X,
  MapPin,
  CarFront,
  Flag,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Car = { id: string; name: string };
type Circuit = { id: string; name: string };

type EventRow = {
  id: string;
  date: string | null;
  name: string;
  notes: string | null;
  circuit_id: { id: string; name: string } | { id: string; name: string }[] | null;
};

type EventCarRow = {
  id: string;
  car_id: { id: string; name: string } | { id: string; name: string }[] | null;
  status: string | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

export default function CalendarPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [eventCars, setEventCars] = useState<EventCarRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState("");

  const [editing, setEditing] = useState<EventRow | null>(null);

  const [circuitModalOpen, setCircuitModalOpen] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState("");

  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formCircuitId, setFormCircuitId] = useState<string>("");

  const [selectedCarId, setSelectedCarId] = useState("");
  const [toast, setToast] = useState("");

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
        circuit_id: row.circuit_id,
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
        car_id: row.car_id,
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

  const totalEvents = events.length;
  const eventsWithCircuit = useMemo(
    () => events.filter((ev) => Boolean(normalizeRelation(ev.circuit_id)?.id)).length,
    [events]
  );
  const eventsWithNotes = useMemo(
    () => events.filter((ev) => Boolean(ev.notes && ev.notes.trim())).length,
    [events]
  );
  const nextEventDate = useMemo(() => {
    const now = new Date();
    const upcoming = events
      .filter((ev) => ev.date && new Date(ev.date) >= now)
      .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime());

    return upcoming[0]?.date || null;
  }, [events]);

  const openModal = (ev: EventRow | null = null) => {
    const normalizedCircuit = normalizeRelation(ev?.circuit_id ?? null);

    setEditing(ev);
    setFormDate(ev?.date?.split("T")[0] || "");
    setFormName(ev?.name || "");
    setFormNotes(ev?.notes || "");
    setFormCircuitId(normalizedCircuit?.id?.toString?.() || "");
    setModalOpen(true);

    if (ev?.id) fetchEventCars(ev.id);
    else setEventCars([]);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormDate("");
    setFormName("");
    setFormNotes("");
    setFormCircuitId("");
    setSelectedCarId("");
    setEventCars([]);
  };

  const handleSubmit = async () => {
    const payload: any = {
      date: formDate,
      name: formName,
      notes: formNotes || null,
      circuit_id: formCircuitId || null,
    };

    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) {
        alert("Errore aggiornamento evento: " + error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert([payload])
        .select("id")
        .single();

      if (error) {
        alert("Errore creazione evento: " + error.message);
        return;
      }

      setEditing({ id: data.id, ...payload, circuit_id: null });
    }

    await fetchEvents();
    setToast("Evento salvato con successo ✅");
    setTimeout(() => setToast(""), 2500);
    setModalOpen(false);
  };

  const handleAddCircuit = async () => {
    if (!newCircuitName.trim()) return;

    const { data, error } = await supabase
      .from("circuits")
      .insert([{ name: newCircuitName.trim() }])
      .select()
      .single();

    if (error) {
      alert("Errore creazione autodromo: " + error.message);
      return;
    }

    await fetchCircuits();
    setFormCircuitId(data.id);
    setNewCircuitName("");
    setCircuitModalOpen(false);
  };

  const handleAddCarToEvent = async () => {
    if (!editing?.id) {
      alert("Salva prima l'evento prima di aggiungere un'auto.");
      return;
    }

    if (!selectedCarId) {
      alert("Seleziona un’auto prima di aggiungerla.");
      return;
    }

    const { data: existing } = await supabase
      .from("event_cars")
      .select("id")
      .eq("event_id", editing.id)
      .eq("car_id", selectedCarId)
      .maybeSingle();

    if (existing) {
      alert("⚠️ Quest’auto è già associata a questo evento.");
      return;
    }

    const { error } = await supabase
      .from("event_cars")
      .insert([{ event_id: editing.id, car_id: selectedCarId, status: "in_corso" }]);

    if (error) {
      alert("Errore durante l’aggiunta: " + error.message);
    } else {
      await fetchEventCars(editing.id);
      setSelectedCarId("");
    }
  };

  const handleRemoveCarFromEvent = async (id: string) => {
    setConfirmMessage("Vuoi davvero rimuovere questa auto dall’evento?");
    setConfirmAction(() => async () => {
      const { error } = await supabase.from("event_cars").delete().eq("id", id);
      if (!error && editing?.id) await fetchEventCars(editing.id);
    });
    setConfirmOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    setConfirmMessage("Vuoi davvero eliminare questo evento e tutti i dati collegati?");
    setConfirmAction(() => async () => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (!error) await fetchEvents();
    });
    setConfirmOpen(true);
  };

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      {toast && (
        <div className="fixed top-4 right-4 bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-xl shadow-md z-50">
          {toast}
        </div>
      )}

      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <CalendarDays size={14} />
                Gestione Eventi
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Calendario eventi
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Organizza eventi, autodromi e auto partecipanti in un’unica schermata operativa.
              </p>
            </div>

            <div>
              <button onClick={() => openModal(null)} className="btn-primary">
                <PlusCircle size={18} /> Aggiungi evento
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<CalendarDays size={18} className="text-yellow-600" />}
              label="Eventi totali"
              value={String(totalEvents)}
            />
            <SummaryCard
              icon={<MapPin size={18} className="text-yellow-600" />}
              label="Con autodromo"
              value={String(eventsWithCircuit)}
            />
            <SummaryCard
              icon={<FileText size={18} className="text-yellow-600" />}
              label="Con note"
              value={String(eventsWithNotes)}
            />
            <SummaryCard
              icon={<Flag size={18} className="text-yellow-600" />}
              label="Prossimo evento"
              value={nextEventDate ? formatDate(nextEventDate) : "—"}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="card-base p-10 text-center text-neutral-500">Caricamento...</div>
      ) : events.length === 0 ? (
        <div className="card-base p-10 text-center text-neutral-500">
          Nessun evento registrato.
        </div>
      ) : (
        <section className="card-base p-4 md:p-5 overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th>Autodromo</th>
                  <th className="text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const circuit = normalizeRelation(ev.circuit_id);

                  return (
                    <tr key={ev.id}>
                      <td>{formatDate(ev.date)}</td>
                      <td>{ev.name}</td>
                      <td>{circuit?.name || "—"}</td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openModal(ev)}
                            className="btn-primary !px-3 !py-2 !rounded-lg"
                          >
                            <Edit size={14} /> Modifica
                          </button>

                          <Link
                            href={`/calendar/${ev.id}`}
                            className="btn-dark !px-3 !py-2 !rounded-lg"
                          >
                            <Wrench size={14} /> Gestisci
                          </Link>

                          <button
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="btn-danger !px-3 !py-2 !rounded-lg"
                          >
                            <Trash2 size={14} /> Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {events.map((ev) => {
              const circuit = normalizeRelation(ev.circuit_id);

              return (
                <article key={ev.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-neutral-900">{ev.name}</h3>
                      <div className="mt-1 text-sm text-neutral-600">{formatDate(ev.date)}</div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {circuit?.name || "Autodromo non specificato"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => openModal(ev)}
                      className="btn-primary !px-3 !py-2 !rounded-lg flex-1"
                    >
                      <Edit size={14} /> Modifica
                    </button>

                    <Link
                      href={`/calendar/${ev.id}`}
                      className="btn-dark !px-3 !py-2 !rounded-lg flex-1 text-center"
                    >
                      <Wrench size={14} /> Gestisci
                    </Link>

                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="btn-danger !px-3 !py-2 !rounded-lg flex-1"
                    >
                      <Trash2 size={14} /> Elimina
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] overflow-y-auto relative">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-black text-yellow-400">
              <h2 className="text-xl font-bold">
                {editing ? "Modifica evento" : "Aggiungi evento"}
              </h2>
              <button
                className="rounded-lg px-3 py-1 text-yellow-300 hover:bg-white/10"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Data</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="border rounded-xl px-3 py-3 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">
                  Nome evento
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome evento"
                  className="border rounded-xl px-3 py-3 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">
                  Autodromo
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={formCircuitId}
                    onChange={(e) => setFormCircuitId(e.target.value)}
                    className="flex-1 border rounded-xl px-3 py-3"
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
                    className="btn-secondary !px-4 !py-3"
                  >
                    ➕
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Note</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Note (opzionale)"
                  className="border rounded-xl px-3 py-3 w-full min-h-[120px]"
                />
              </div>

              {editing && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <h3 className="text-base font-bold text-neutral-800 mb-3">Auto associate</h3>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                    <select
                      value={selectedCarId}
                      onChange={(e) => setSelectedCarId(e.target.value)}
                      className="flex-1 border rounded-xl px-3 py-3"
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
                      className="btn-primary"
                    >
                      Aggiungi
                    </button>
                  </div>

                  {eventCars.length === 0 ? (
                    <p className="text-neutral-500 text-sm">Nessuna auto collegata</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {eventCars.map((ec) => {
                        const car = normalizeRelation(ec.car_id);

                        return (
                          <div
                            key={ec.id}
                            className="rounded-xl border border-neutral-200 bg-white p-3 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="font-semibold text-neutral-900">
                                {car?.name || "Auto non trovata"}
                              </div>
                              <div className="text-sm text-neutral-500 capitalize">
                                {ec.status || "in corso"}
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveCarFromEvent(ec.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-semibold inline-flex items-center gap-1"
                            >
                              <Trash2 size={14} /> Rimuovi
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button onClick={closeModal} className="btn-secondary">
                  Annulla
                </button>
                <button onClick={handleSubmit} className="btn-primary">
                  Salva evento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {circuitModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">Nuovo autodromo</h3>

            <input
              type="text"
              value={newCircuitName}
              onChange={(e) => setNewCircuitName(e.target.value)}
              placeholder="Nome autodromo"
              className="border rounded-xl px-3 py-3 w-full mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setCircuitModalOpen(false);
                  setNewCircuitName("");
                }}
                className="btn-secondary"
              >
                Annulla
              </button>
              <button onClick={handleAddCircuit} className="btn-primary">
                Salva autodromo
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="text-neutral-800 mb-6 text-center leading-relaxed">{confirmMessage}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  confirmAction();
                }}
                className="btn-primary"
              >
                Conferma
              </button>
              <button onClick={() => setConfirmOpen(false)} className="btn-secondary">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}
