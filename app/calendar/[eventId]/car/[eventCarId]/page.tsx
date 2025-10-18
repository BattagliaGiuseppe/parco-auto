"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Gauge,
  Fuel,
  ClipboardCheck,
  StickyNote,
  Clock,
  Save,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

// Setup Views
import SetupPanel from "./setup";
import SetupRacing from "./setup-racing";
import SetupScheda from "./setup-scheda";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"touch" | "racing" | "scheda">("touch");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: eventData } = await supabase
        .from("events")
        .select("id, name, date")
        .eq("id", eventId)
        .single();

      const { data: carData } = await supabase
        .from("event_cars")
        .select("id, car_id (id, name), notes")
        .eq("id", eventCarId)
        .single();

      setEvent(eventData || null);
      setCar(carData?.car_id || null);
      setNotes(carData?.notes || "");
      setLoading(false);
    };
    fetchData();
  }, [eventId, eventCarId]);

  if (loading) return <p className="p-6 text-gray-600">Caricamento dati...</p>;
  if (!event || !car)
    return (
      <div className="p-6 text-center text-red-500 font-semibold">
        ❌ Errore: dati non trovati.
      </div>
    );

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {car.name} – {event.name}
          </h1>
          <p className="text-gray-600 text-sm">Gestione tecnica evento</p>
        </div>
        <Link
          href={`/calendar/${eventId}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
        >
          <ArrowLeft size={16} /> Torna all’evento
        </Link>
      </div>

      {/* ------------------- SETUP ------------------- */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Gauge className="text-yellow-500" /> Assetto
        </h2>

        <div className="flex flex-wrap gap-3 mb-4">
          {["touch", "racing", "scheda"].map((key) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`px-4 py-2 rounded-lg font-semibold ${
                tab === key
                  ? "bg-yellow-400 text-black"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {key === "touch"
                ? "Setup Touch"
                : key === "racing"
                ? "Setup Interattivo"
                : "Setup Scheda Tecnica"}
            </button>
          ))}
        </div>

        <div className="transition-all duration-300">
          {tab === "touch" && <SetupPanel eventCarId={eventCarId} />}
          {tab === "racing" && <SetupRacing eventCarId={eventCarId} />}
          {tab === "scheda" && <SetupScheda />}
        </div>
      </section>

      {/* ------------------- CHECK-UP TECNICO ------------------- */}
      <CheckupSection eventCarId={eventCarId} />

      {/* ------------------- TURNI SVOLTI ------------------- */}
      <TurnsSection eventCarId={eventCarId} />

      {/* ------------------- CARBURANTE ------------------- */}
      <FuelSection eventCarId={eventCarId} />

      {/* ------------------- NOTE ------------------- */}
      <NotesSection eventCarId={eventCarId} notes={notes} setNotes={setNotes} />
    </div>
  );
}

/* ------------------- SEZIONI ------------------- */

function CheckupSection({ eventCarId }: { eventCarId: string }) {
  const [data, setData] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);

  async function saveToDB() {
    const payload = { event_car_id: eventCarId, extras: data };
    await supabase.from("event_car_checkup").insert([payload]);
    const { data: h } = await supabase
      .from("event_car_checkup")
      .select("id, created_at, extras")
      .eq("event_car_id", eventCarId)
      .order("created_at", { ascending: false })
      .limit(3);
    setHistory(h || []);
    alert("✅ Check-up salvato");
  }

  function loadHistory(entry: any) {
    if (confirm("Vuoi caricare questo check-up salvato?"))
      setData(entry.extras);
  }

  return (
    <section className="bg-white border rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
        <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
      </h2>
      <div className="flex flex-col gap-2 mb-3">
        <input
          type="text"
          placeholder="Pressione olio"
          className="border rounded-lg p-2"
          value={data.pressioneOlio || ""}
          onChange={(e) => setData({ ...data, pressioneOlio: e.target.value })}
        />
        <input
          type="text"
          placeholder="Temperatura acqua"
          className="border rounded-lg p-2"
          value={data.temperaturaAcqua || ""}
          onChange={(e) =>
            setData({ ...data, temperaturaAcqua: e.target.value })
          }
        />
      </div>
      <button
        onClick={saveToDB}
        className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
      >
        💾 Salva
      </button>

      <div className="mt-3 border-t pt-2">
        <h4 className="font-semibold mb-1">🕓 Ultimi salvataggi</h4>
        {history.map((h) => (
          <div
            key={h.id}
            className="text-sm flex justify-between border rounded px-2 py-1 cursor-pointer hover:bg-gray-100"
            onClick={() => loadHistory(h)}
          >
            <span>{new Date(h.created_at).toLocaleString()}</span>
            <span className="text-yellow-600 font-semibold">🔄 Apri</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TurnsSection({ eventCarId }: { eventCarId: string }) {
  const [data, setData] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);

  async function saveToDB() {
    const payload = { event_car_id: eventCarId, extras: data };
    await supabase.from("event_car_turns").insert([payload]);
    const { data: h } = await supabase
      .from("event_car_turns")
      .select("id, created_at, extras")
      .eq("event_car_id", eventCarId)
      .order("created_at", { ascending: false })
      .limit(3);
    setHistory(h || []);
    alert("✅ Turni salvati");
  }

  return (
    <section className="bg-white border rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
        <Clock className="text-yellow-500" /> Turni svolti
      </h2>
      <div className="flex flex-col gap-2 mb-3">
        <input
          type="number"
          placeholder="Ore lavoro"
          className="border rounded-lg p-2"
          value={data.ore || ""}
          onChange={(e) => setData({ ...data, ore: Number(e.target.value) })}
        />
        <input
          type="text"
          placeholder="Note turno"
          className="border rounded-lg p-2"
          value={data.note || ""}
          onChange={(e) => setData({ ...data, note: e.target.value })}
        />
      </div>
      <button
        onClick={saveToDB}
        className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
      >
        💾 Salva
      </button>
    </section>
  );
}

function FuelSection({ eventCarId }: { eventCarId: string }) {
  const [fuel, setFuel] = useState({
    start: 0,
    end: 0,
    laps: 0,
    fuelPerLap: 0,
    lapsPlanned: 0,
  });
  const [history, setHistory] = useState<any[]>([]);

  const fuelToAdd =
    fuel.fuelPerLap > 0 && fuel.lapsPlanned > 0
      ? fuel.fuelPerLap * fuel.lapsPlanned - fuel.end
      : 0;

  async function saveToDB() {
    const payload = { event_car_id: eventCarId, extras: fuel };
    await supabase.from("event_car_fuel").insert([payload]);
    const { data: h } = await supabase
      .from("event_car_fuel")
      .select("id, created_at, extras")
      .eq("event_car_id", eventCarId)
      .order("created_at", { ascending: false })
      .limit(3);
    setHistory(h || []);
    alert("✅ Carburante salvato");
  }

  return (
    <section className="bg-white border rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
        <Fuel className="text-yellow-500" /> Gestione carburante
      </h2>

      <div className="grid md:grid-cols-3 gap-3 mb-3">
        <input
          type="number"
          placeholder="Carburante iniziale (L)"
          className="border rounded-lg p-2"
          value={fuel.start}
          onChange={(e) => setFuel({ ...fuel, start: Number(e.target.value) })}
        />
        <input
          type="number"
          placeholder="Carburante residuo (L)"
          className="border rounded-lg p-2"
          value={fuel.end}
          onChange={(e) => setFuel({ ...fuel, end: Number(e.target.value) })}
        />
        <input
          type="number"
          placeholder="Giri effettuati"
          className="border rounded-lg p-2"
          value={fuel.laps}
          onChange={(e) => setFuel({ ...fuel, laps: Number(e.target.value) })}
        />
        <input
          type="number"
          placeholder="Consumo a giro (L)"
          className="border rounded-lg p-2"
          value={fuel.fuelPerLap}
          onChange={(e) =>
            setFuel({ ...fuel, fuelPerLap: Number(e.target.value) })
          }
        />
        <input
          type="number"
          placeholder="Giri previsti prossimo turno"
          className="border rounded-lg p-2"
          value={fuel.lapsPlanned}
          onChange={(e) =>
            setFuel({ ...fuel, lapsPlanned: Number(e.target.value) })
          }
        />
        <div className="border rounded-lg p-2 bg-yellow-100 font-semibold text-center">
          Carburante da aggiungere: {fuelToAdd.toFixed(2)} L
        </div>
      </div>

      <button
        onClick={saveToDB}
        className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
      >
        💾 Salva
      </button>
    </section>
  );
}

function NotesSection({
  eventCarId,
  notes,
  setNotes,
}: {
  eventCarId: string;
  notes: string;
  setNotes: (v: string) => void;
}) {
  const [history, setHistory] = useState<any[]>([]);

  async function saveToDB() {
    const payload = { event_car_id: eventCarId, extras: { notes } };
    await supabase.from("event_car_notes").insert([payload]);
    const { data: h } = await supabase
      .from("event_car_notes")
      .select("id, created_at, extras")
      .eq("event_car_id", eventCarId)
      .order("created_at", { ascending: false })
      .limit(3);
    setHistory(h || []);
    alert("✅ Note salvate");
  }

  function loadHistory(entry: any) {
    if (confirm("Vuoi caricare queste note salvate?"))
      setNotes(entry.extras.notes);
  }

  return (
    <section className="bg-white border rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
        <StickyNote className="text-yellow-500" /> Note e osservazioni
      </h2>
      <textarea
        className="border rounded-lg p-2 w-full mb-3"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
      />
      <button
        onClick={saveToDB}
        className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
      >
        💾 Salva
      </button>

      <div className="mt-3 border-t pt-2">
        <h4 className="font-semibold mb-1">🕓 Ultimi salvataggi</h4>
        {history.map((h) => (
          <div
            key={h.id}
            className="text-sm flex justify-between border rounded px-2 py-1 cursor-pointer hover:bg-gray-100"
            onClick={() => loadHistory(h)}
          >
            <span>{new Date(h.created_at).toLocaleString()}</span>
            <span className="text-yellow-600 font-semibold">🔄 Apri</span>
          </div>
        ))}
      </div>
    </section>
  );
}
