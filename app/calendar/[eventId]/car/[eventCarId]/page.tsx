"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Audiowide } from "next/font/google";
import {
  Gauge,
  Fuel,
  ClipboardCheck,
  StickyNote,
  ArrowLeft,
  Download,
  RotateCcw,
  Save,
  History,
  Plus,
} from "lucide-react";

// Viste Assetto già presenti
import SetupPanel from "./setup";          // touch UI (gestisce salvataggi interni)
import SetupRacing from "./setup-racing";  // svg interattivo (gestisce salvataggi interni)
import SetupScheda from "./setup-scheda";  // scheda grafica (solo UI, stampa dal suo interno)

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CheckItem = { name: string; state: "OK" | "Da controllare" | "Problema" };
type TurnRow = { durata: number; giri: number; note: string };
type FuelState = {
  fuelStart: number;   // L iniziali
  fuelEnd: number;     // L residui
  lapsDone: number;    // giri effettuati
  lapsPlanned: number; // giri previsti
};
type NotesState = { text: string };

type HistoryRow<T> = { id: string; created_at: string; data: T };

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as { eventId: string; eventCarId: string };

  // intestazioni
  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // tab assetto
  const [tab, setTab] = useState<"touch" | "racing" | "scheda">("touch");

  // --- Check-up ---
  const defaultChecks: CheckItem[] = useMemo(
    () => [
      { name: "Serraggi", state: "OK" },
      { name: "Freni", state: "OK" },
      { name: "Liquidi", state: "OK" },
      { name: "Sospensioni", state: "OK" },
      { name: "Elettronica", state: "OK" },
      { name: "Ruote", state: "OK" },
      { name: "Cambio", state: "OK" },
    ],
    []
  );
  const [checks, setChecks] = useState<CheckItem[]>(defaultChecks);
  const [checkHist, setCheckHist] = useState<HistoryRow<CheckItem[]>[]>([]);

  // --- Turni svolti ---
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [newTurn, setNewTurn] = useState({ durata: "", giri: "", note: "" });
  const [turnHist, setTurnHist] = useState<HistoryRow<TurnRow[]>[]>([]);

  // --- Carburante ---
  const [fuel, setFuel] = useState<FuelState>({ fuelStart: 0, fuelEnd: 0, lapsDone: 0, lapsPlanned: 0 });
  const [fuelHist, setFuelHist] = useState<HistoryRow<FuelState>[]>([]);
  const fuelPerLap = fuel.lapsDone > 0 && fuel.fuelStart >= 0 && fuel.fuelEnd >= 0
    ? (fuel.fuelStart - fuel.fuelEnd) / fuel.lapsDone
    : 0;
  const fuelToAddRaw = fuelPerLap > 0 && fuel.lapsPlanned > 0 ? (fuelPerLap * fuel.lapsPlanned) - fuel.fuelEnd : 0;
  const fuelToAdd = Math.max(0, fuelToAddRaw); // mai negativo

  // --- Note ---
  const [notes, setNotes] = useState<NotesState>({ text: "" });
  const [notesHist, setNotesHist] = useState<HistoryRow<NotesState>[]>([]);

  // toast
  const [toast, setToast] = useState<{ show: boolean; text: string }>({ show: false, text: "" });

  useEffect(() => {
    (async () => {
      setLoading(true);

      // intestazioni
      const { data: eventData } = await supabase
        .from("events")
        .select("id, name, date")
        .eq("id", eventId)
        .single();

      const { data: carData } = await supabase
        .from("event_cars")
        .select("id, car_id (id, name)")
        .eq("id", eventCarId)
        .single();

      setEvent(eventData || null);
      setCar(carData?.car_id || null);

      // carica ultimi salvataggi (1 corrente + lista 3)
      await Promise.all([
        loadLatestWithHistory<CheckItem[]>("event_car_checkup", setChecks, setCheckHist, defaultChecks),
        loadLatestWithHistory<TurnRow[]>("event_car_turns", setTurns, setTurnHist, []),
        loadLatestWithHistory<FuelState>("event_car_fuel", setFuel, setFuelHist, { fuelStart: 0, fuelEnd: 0, lapsDone: 0, lapsPlanned: 0 }),
        loadLatestWithHistory<NotesState>("event_car_notes", setNotes, setNotesHist, { text: "" }),
      ]);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventCarId]);

  async function loadLatestWithHistory<T>(
    table: string,
    setCurrent: (d: T) => void,
    setHistory: (h: HistoryRow<T>[]) => void,
    fallback: T
  ) {
    const { data: latest } = await supabase
      .from(table)
      .select("id, created_at, data")
      .eq("event_car_id", eventCarId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.data) setCurrent(latest.data as T);
    else setCurrent(fallback);

    const { data: last3 } = await supabase
      .from(table)
      .select("id, created_at, data")
      .eq("event_car_id", eventCarId)
      .order("created_at", { ascending: false })
      .limit(3);

    setHistory((last3 || []) as any);
  }

  function showToast(text: string) {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), 2200);
  }

  // ---- SALVATAGGI ----
  async function saveCheckup() {
    const payload = { event_car_id: eventCarId, data: checks };
    const { error } = await supabase.from("event_car_checkup").insert(payload);
    if (!error) {
      await loadLatestWithHistory<CheckItem[]>("event_car_checkup", setChecks, setCheckHist, defaultChecks);
      showToast("Check-up salvato ✅");
    } else alert("Errore salvataggio check-up: " + error.message);
  }

  async function saveTurns() {
    const payload = { event_car_id: eventCarId, data: turns };
    const { error } = await supabase.from("event_car_turns").insert(payload);
    if (!error) {
      await loadLatestWithHistory<TurnRow[]>("event_car_turns", setTurns, setTurnHist, []);
      showToast("Turni salvati ✅");
    } else alert("Errore salvataggio turni: " + error.message);
  }

  async function saveFuel() {
    const payload = { event_car_id: eventCarId, data: fuel };
    const { error } = await supabase.from("event_car_fuel").insert(payload);
    if (!error) {
      await loadLatestWithHistory<FuelState>("event_car_fuel", setFuel, setFuelHist, { fuelStart: 0, fuelEnd: 0, lapsDone: 0, lapsPlanned: 0 });
      showToast("Dati carburante salvati ✅");
    } else alert("Errore salvataggio carburante: " + error.message);
  }

  async function saveNotes() {
    const payload = { event_car_id: eventCarId, data: notes };
    const { error } = await supabase.from("event_car_notes").insert(payload);
    if (!error) {
      await loadLatestWithHistory<NotesState>("event_car_notes", setNotes, setNotesHist, { text: "" });
      showToast("Note salvate ✅");
    } else alert("Errore salvataggio note: " + error.message);
  }

  // ripristina da history
  function openHistory<T>(row: HistoryRow<T>, setCurrent: (d: T) => void) {
    if (confirm("Vuoi aprire questo salvataggio?")) setCurrent(row.data);
  }

  // aggiungi turno + RPC ore componenti
  async function addTurn() {
    if (!newTurn.durata) return alert("Inserisci la durata (minuti)");
    const toAdd: TurnRow = {
      durata: Number(newTurn.durata) || 0,
      giri: Number(newTurn.giri) || 0,
      note: newTurn.note || "",
    };
    const next = [...turns, toAdd];
    setTurns(next);

    // aggiorna ore componenti (min/60)
    const hours = (Number(newTurn.durata) || 0) / 60;
    try {
      await supabase.rpc("increment_component_hours", {
        p_car_id: eventCarId,
        p_hours: hours,
      });
    } catch {
      // Ignora errori RPC
    }
    setNewTurn({ durata: "", giri: "", note: "" });
  }

  const totalHours = useMemo(() => {
    const min = turns.reduce((s, t) => s + (t.durata || 0), 0);
    return min / 60;
  }, [turns]);

  if (loading)
    return <p className="p-6 text-gray-600">Caricamento dati...</p>;

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

      {/* Sezione Setup */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Gauge className="text-yellow-500" /> Assetto
        </h2>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-4">
          <TabButton active={tab === "touch"} onClick={() => setTab("touch")}>Setup Touch</TabButton>
          <TabButton active={tab === "racing"} onClick={() => setTab("racing")}>Setup Interattivo</TabButton>
          <TabButton active={tab === "scheda"} onClick={() => setTab("scheda")}>Setup Scheda Tecnica</TabButton>
          {tab === "scheda" && (
            <div className="ml-auto flex items-center gap-2">
              {/* Esporta è gestito dentro SetupScheda (window.print). Qui lo lasciamo informativo */}
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Download size={14}/> Stampa da dentro la scheda
              </span>
            </div>
          )}
        </div>

        {/* Contenuto dinamico */}
        <div className="transition-all duration-300">
          {tab === "touch" && <SetupPanel eventCarId={eventCarId} />}
          {tab === "racing" && <SetupRacing eventCarId={eventCarId} />}
          {/* NB: manteniamo senza prop per aderire al componente attuale */}
          {tab === "scheda" && <SetupScheda eventCarId={eventCarId} />}
        </div>
      </section>

      {/* 🧰 Check-up tecnico */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={saveCheckup} className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold inline-flex items-center gap-2">
              <Save size={16}/> Salva
            </button>
            <HistoryDropdown
              rows={checkHist}
              onOpen={(r) => openHistory(r, setChecks)}
            />
          </div>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="border p-2 text-left">Controllo</th>
              <th className="border p-2 text-center">Stato</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c, idx) => (
              <tr key={c.name + idx}>
                <td className="border p-2">{c.name}</td>
                <td className="border p-2 text-center">
                  <select
                    value={c.state}
                    onChange={(e) =>
                      setChecks((arr) =>
                        arr.map((it, i) =>
                          i === idx ? { ...it, state: e.target.value as CheckItem["state"] } : it
                        )
                      )
                    }
                    className="border rounded-lg p-1 text-sm"
                  >
                    <option>OK</option>
                    <option>Da controllare</option>
                    <option>Problema</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 🕓 Turni Svolti */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">🕓 Turni Svolti</h2>
          <div className="flex items-center gap-2">
            <button onClick={saveTurns} className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold inline-flex items-center gap-2">
              <Save size={16}/> Salva
            </button>
            <HistoryDropdown rows={turnHist} onOpen={(r) => openHistory(r, setTurns)} />
          </div>
        </div>

        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="bg-gray-50">
              <th className="border p-2">#</th>
              <th className="border p-2">Durata (min)</th>
              <th className="border p-2">Giri</th>
              <th className="border p-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {turns.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 p-3">
                  Nessun turno registrato
                </td>
              </tr>
            ) : (
              turns.map((t, i) => (
                <tr key={i}>
                  <td className="border p-2 text-center">{i + 1}</td>
                  <td className="border p-2 text-center">{t.durata}</td>
                  <td className="border p-2 text-center">{t.giri}</td>
                  <td className="border p-2">{t.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="text-right text-gray-700 font-semibold mb-4">
          Totale ore lavoro:{" "}
          <span className="text-yellow-600 font-bold">{totalHours.toFixed(2)} h</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            type="number"
            placeholder="Durata (min)"
            value={newTurn.durata}
            onChange={(e) => setNewTurn({ ...newTurn, durata: e.target.value })}
            className="border rounded-lg p-2 text-sm"
          />
          <input
            type="number"
            placeholder="Giri"
            value={newTurn.giri}
            onChange={(e) => setNewTurn({ ...newTurn, giri: e.target.value })}
            className="border rounded-lg p-2 text-sm"
          />
          <input
            type="text"
            placeholder="Note"
            value={newTurn.note}
            onChange={(e) => setNewTurn({ ...newTurn, note: e.target.value })}
            className="border rounded-lg p-2 text-sm"
          />
        </div>

        <button
          onClick={addTurn}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-yellow-400 font-semibold rounded-lg inline-flex items-center gap-2"
        >
          <Plus size={16}/> Aggiungi Turno
        </button>
      </section>

      {/* ⛽ Gestione carburante */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Fuel className="text-yellow-500" /> Gestione carburante
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={saveFuel} className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold inline-flex items-center gap-2">
              <Save size={16}/> Salva
            </button>
            <HistoryDropdown rows={fuelHist} onOpen={(r) => openHistory(r, setFuel)} />
          </div>
        </div>

        {/* riga 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <NumberField
            label="Carburante iniziale (L)"
            value={fuel.fuelStart}
            onChange={(v) => setFuel((s) => ({ ...s, fuelStart: v }))}
          />
          <NumberField
            label="Carburante residuo (L)"
            value={fuel.fuelEnd}
            onChange={(v) => setFuel((s) => ({ ...s, fuelEnd: v }))}
          />
          <NumberField
            label="Giri effettuati"
            value={fuel.lapsDone}
            onChange={(v) => setFuel((s) => ({ ...s, lapsDone: v }))}
          />
        </div>

        <hr className="my-3 border-gray-300" />

        {/* riga 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
          <DisplayField
            label="Consumo medio a giro (L/giro)"
            value={fuelPerLap > 0 ? fuelPerLap.toFixed(2) : "—"}
          />
          <NumberField
            label="Giri previsti prossimo turno"
            value={fuel.lapsPlanned}
            onChange={(v) => setFuel((s) => ({ ...s, lapsPlanned: v }))}
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Carburante da aggiungere (L)
            </label>
            <div className="rounded-lg p-3 text-center font-bold text-black text-xl bg-yellow-400 border-2 border-yellow-600 shadow-inner">
              {fuelToAdd > 0 ? fuelToAdd.toFixed(1) : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* 🗒️ Note */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <StickyNote className="text-yellow-500" /> Note e osservazioni
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={saveNotes} className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold inline-flex items-center gap-2">
              <Save size={16}/> Salva
            </button>
            <HistoryDropdown rows={notesHist} onOpen={(r) => openHistory(r, setNotes)} />
          </div>
        </div>

        <textarea
          value={notes.text}
          onChange={(e) => setNotes({ text: e.target.value })}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border rounded-lg p-2 w-full"
          rows={3}
        />
      </section>

      {/* Toast */}
      <div
        className={`fixed right-4 bottom-4 z-50 transition-all duration-300 ${
          toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div className="bg-gray-900 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-2">
          <RotateCcw size={16} className="text-yellow-400" />
          <span className="text-sm">{toast.text}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-semibold ${
        active ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border rounded-lg p-2 w-full text-center"
      />
    </div>
  );
}

function DisplayField({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
      </label>
      <div className="border rounded-lg p-2 bg-gray-50 text-center font-semibold">
        {value}
      </div>
    </div>
  );
}

function HistoryDropdown<T>({
  rows,
  onOpen,
}: {
  rows: HistoryRow<T>[];
  onOpen: (row: HistoryRow<T>) => void;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-xs text-gray-400 inline-flex items-center gap-1">
        <History size={14} /> Nessun salvataggio
      </div>
    );
  }

  return (
    <details className="relative">
      <summary className="list-none inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer text-sm">
        <History size={16} />
        Ultimi {rows.length}
      </summary>
      <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-lg overflow-hidden z-10">
        <ul className="max-h-64 overflow-auto text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
            >
              <span className="text-gray-700">
                {new Date(r.created_at).toLocaleString()}
              </span>
              <button
                className="text-yellow-700 font-semibold"
                onClick={() => onOpen(r)}
              >
                Apri
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
