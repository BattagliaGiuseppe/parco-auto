"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  PlusCircle,
  CalendarDays,
  Edit,
  Clock,
  MapPin,
  Plus,
  CheckCircle,
  XCircle,
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
  const [eventCarsNames, setEventCarsNames] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [turnModal, setTurnModal] = useState(false);
  const [autodromeModal, setAutodromeModal] = useState(false);

  const [editing, setEditing] = useState<EventRow | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  const [formData, setFormData] = useState({
    date: "",
    name: "",
    autodrome_id: "",
    notes: "",
  });

  const [selectedCarIds, setSelectedCarIds] = useState<string[]>([]);
  const [turnForm, setTurnForm] = useState({ car_id: "", minutes: "" });
  const [newAutodrome, setNewAutodrome] = useState("");
  const [filterAutodrome, setFilterAutodrome] = useState<string>("");

  const [toast, setToast] = useState<{ show: boolean; msg: string; type: "success" | "error" }>({
    show: false,
    msg: "",
    type: "success",
  });

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type }), 3000);
  };

  // ======= FETCH =======
  const fetchEvents = async () => {
    setLoading(true);

    const { data: ev } = await supabase
      .from("events")
      .select(
        "id, date, name, autodrome_id, autodrome (id, name), notes, hours_total_event"
      )
      .order("date", { ascending: false });

    const { data: carData } = await supabase.from("cars").select("id, name");
    const { data: autodromeData } = await supabase
      .from("autodromes")
      .select("id, name")
      .order("name", { ascending: true });

    setCars((carData as CarRow[]) || []);
    setAutodromes((autodromeData as AutodromeRow[]) || []);
    setEvents((ev as unknown as EventRow[]) || []);
    setLoading(false);

    const turnsMap: Record<string, any[]> = {};
    for (const e of (ev as any[]) || []) {
      const { data: t } = await supabase
        .from("event_car_turns")
        .select("id, car_id (name), minutes, created_at")
        .eq("event_id", e.id)
        .order("created_at", { ascending: true });
      turnsMap[e.id] = t || [];
    }
    setTurns(turnsMap);

    const namesMap: Record<string, string[]> = {};
    for (const e of (ev as any[]) || []) {
      const { data: ecs } = await supabase
        .from("event_cars")
        .select("car_id (name)")
        .eq("event_id", e.id);
      namesMap[e.id] = (ecs || []).map((r: any) => r.car_id?.name).filter(Boolean);
    }
    setEventCarsNames(namesMap);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // ======= SALVA EVENTO =======
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.name || !formData.autodrome_id) {
      alert("Compila data, nome e autodromo");
      return;
    }

    let eventId: string | null = editing?.id || null;
    let dbError = null;

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
      dbError = error;
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
      dbError = error;
      eventId = data?.id || null;
    }

    if (dbError || !eventId) {
      console.error("Errore salvataggio evento:", dbError);
      showToast("❌ Errore durante il salvataggio", "error");
      return;
    }

    await supabase.from("event_cars").delete().eq("event_id", eventId);
    if (selectedCarIds.length > 0) {
      const rows = selectedCarIds.map((cid) => ({
        event_id: eventId!,
        car_id: cid,
      }));
      await supabase.from("event_cars").insert(rows);
    }

    setModalOpen(false);
    await fetchEvents();
    showToast("✅ Evento salvato con successo", "success");
  };

  // ======= SALVA TURNO =======
  const handleAddTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return alert("Nessun evento selezionato");

    const minutes = parseInt(turnForm.minutes) || 0;
    if (!minutes || !turnForm.car_id) return alert("Inserisci auto e minuti validi");

    const { error } = await supabase.from("event_car_turns").insert([
      {
        event_id: selectedEvent.id,
        car_id: turnForm.car_id,
        minutes,
      },
    ]);

    if (error) {
      console.error(error);
      showToast("❌ Errore durante il salvataggio del turno", "error");
    } else {
      setTurnModal(false);
      setTurnForm({ car_id: "", minutes: "" });
      fetchEvents();
      showToast("✅ Turno aggiunto con successo", "success");
    }
  };

  // ======= AUTODROMO =======
  const handleAddAutodrome = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAutodrome.trim();
    if (!name) return;
    const { error } = await supabase.from("autodromes").insert([{ name }]);
    if (error) {
      showToast("❌ Autodromo già esistente", "error");
      return;
    }
    setNewAutodrome("");
    setAutodromeModal(false);
    fetchEvents();
    showToast("✅ Autodromo aggiunto", "success");
  };

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

      {/* FILTRO AUTODROMO */}
      <div className="flex gap-3 items-center">
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

      {/* LISTA EVENTI */}
      {!loading && (
        <table className="w-full border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-black text-yellow-500">
            <tr>
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Evento</th>
              <th className="p-3 text-left">Autodromo</th>
              <th className="p-3 text-left">Auto</th>
              <th className="p-3 text-left">Ore Totali</th>
              <th className="p-3 text-left">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {events
              .filter((ev) => !filterAutodrome || ev.autodrome_id === filterAutodrome)
              .map((ev) => (
                <tr key={ev.id} className="border-t align-top">
                  <td className="p-3">{new Date(ev.date).toLocaleDateString("it-IT")}</td>
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
      )}

      {/* MODALI */}
      {/* Evento, Autodromo, Turno come già nella versione precedente */}
      {/* … (omesso per brevità, restano invariati rispetto all’ultima versione funzionante) */}

      {/* TOAST */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 z-[999] ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
