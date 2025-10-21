"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Audiowide } from "next/font/google";
import {
  ArrowLeft,
  ClipboardCheck,
  Fuel,
  Gauge,
  Loader2,
  StickyNote,
  CheckCircle2,
  Save,
  RotateCcw,
} from "lucide-react";

// Setup pages già presenti
import SetupPanel from "./setup";          // touch UI
import SetupRacing from "./setup-racing";  // interattivo SVG
import SetupScheda from "./setup-scheda";  // scheda tecnica (stampa gestita lì)

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type DataRow = {
  id: string;
  event_car_id: string;
  section: "checkup" | "fuel" | "notes";
  data: any;
  created_at: string;
};

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as { eventId: string; eventCarId: string };

  const [event, setEvent] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"touch" | "racing" | "scheda">("touch");

  // ------------------------
  // Check-up (grafica + salvataggi)
  // ------------------------
  const defaultCheckupItems = useMemo(
    () => ["Serraggi", "Freni", "Liquidi", "Sospensioni", "Elettronica", "Ruote", "Cambio"],
    []
  );
  const [checkup, setCheckup] = useState<Record<string, "OK" | "Da controllare" | "Problema">>({});
  const [checkupSaving, setCheckupSaving] = useState(false);
  const [checkupTick, setCheckupTick] = useState(0);
  const [checkupHistory, setCheckupHistory] = useState<DataRow[]>([]);

  // ------------------------
  // Turni svolti (tabella propria)
  // ------------------------
  type TurnInput = { durata: string; giri: string; note: string };
  const [turns, setTurns] = useState<{ minutes: number; laps: number; notes: string }[]>([]);
  const [newTurn, setNewTurn] = useState<TurnInput>({ durata: "", giri: "", note: "" });
  const [turnsSaving, setTurnsSaving] = useState(false);
  const totalHours = useMemo(() => turns.reduce((acc, t) => acc + t.minutes, 0) / 60, [turns]);

  // ------------------------
  // Carburante (grafica + salvataggi)
  // ------------------------
  const [fuelStart, setFuelStart] = useState<number>(0); // iniziale
  const [fuelEnd, setFuelEnd] = useState<number>(0);     // residuo
  const [lapsDone, setLapsDone] = useState<number>(0);
  const [lapsPlanned, setLapsPlanned] = useState<number>(0);

  const fuelPerLap = useMemo(() => {
    if (lapsDone > 0 && fuelStart >= 0 && fuelEnd >= 0) {
      const used = fuelStart - fuelEnd;
      return used > 0 ? used / lapsDone : 0;
    }
    return 0;
  }, [fuelStart, fuelEnd, lapsDone]);

  const fuelToAddRaw = lapsPlanned > 0 && fuelPerLap > 0 ? lapsPlanned * fuelPerLap - fuelEnd : 0;
  const fuelToAdd = Math.max(0, fuelToAddRaw); // clamp >= 0

  const [fuelSaving, setFuelSaving] = useState(false);
  const [fuelTick, setFuelTick] = useState(0);
  const [fuelHistory, setFuelHistory] = useState<DataRow[]>([]);

  // ------------------------
  // Note (grafica + salvataggi)
  // ------------------------
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesTick, setNotesTick] = useState(0);
  const [notesHistory, setNotesHistory] = useState<DataRow[]>([]);

  // ---------------------------------------
  // Load base: evento, auto + ultimi dati per sezioni da event_car_data
  // ---------------------------------------
  useEffect(() => {
    (async () => {
      setLoading(true);

      // Evento + auto
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

      // Carica ultimo checkup
      const { data: lastCheck } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "checkup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastCheck?.data) setCheckup(lastCheck.data);

      // Carica storico checkup (ultimi 3)
      const { data: chkHist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "checkup")
        .order("created_at", { ascending: false })
        .limit(3);

      setCheckupHistory(chkHist || []);

      // Carica ultimo fuel
      const { data: lastFuel } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "fuel")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastFuel?.data) {
        setFuelStart(Number(lastFuel.data.fuelStart ?? 0));
        setFuelEnd(Number(lastFuel.data.fuelEnd ?? 0));
        setLapsDone(Number(lastFuel.data.lapsDone ?? 0));
        setLapsPlanned(Number(lastFuel.data.lapsPlanned ?? 0));
      }

      // Carica storico fuel (ultimi 3)
      const { data: fuelHist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "fuel")
        .order("created_at", { ascending: false })
        .limit(3);

      setFuelHistory(fuelHist || []);

      // Carica ultime note
      const { data: lastNotes } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "notes")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastNotes?.data?.text) setNotes(String(lastNotes.data.text));

      // Carica storico note (ultimi 3)
      const { data: notesHist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "notes")
        .order("created_at", { ascending: false })
        .limit(3);

      setNotesHistory(notesHist || []);

      setLoading(false);
    })();
  }, [eventId, eventCarId]);

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-600">
        <Loader2 className="animate-spin" /> Caricamento dati...
      </div>
    );
  }
  if (!event || !car) {
    return (
      <div className="p-6 text-center text-red-500 font-semibold">
        ❌ Errore: dati non trovati.
      </div>
    );
  }

  // ------------------------
  // Helpers salvataggi (event_car_data)
  // ------------------------
  async function saveSection(section: DataRow["section"], data: any) {
    // Inseriamo SEMPRE una nuova riga per avere storico consultabile
    const payload = { event_car_id: eventCarId, section, data };
    const { error } = await supabase.from("event_car_data").insert([payload]);
    if (error) throw new Error(error.message);
  }

  // ------------------------
  // Save Check-up
  // ------------------------
  async function onSaveCheckup() {
    try {
      setCheckupSaving(true);
      await saveSection("checkup", checkup);
      // ricarica ultimi 3
      const { data } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "checkup")
        .order("created_at", { ascending: false })
        .limit(3);
      setCheckupHistory(data || []);
      setCheckupTick((t) => t + 1);
    } catch (e: any) {
      alert("Errore salvataggio check-up: " + e.message);
    } finally {
      setCheckupSaving(false);
    }
  }
  function loadCheckup(row: DataRow) {
    if (!row?.data) return;
    setCheckup(row.data || {});
  }

  // ------------------------
  // Add Turn + Save Turn
  // ------------------------
  async function addTurn() {
    if (!newTurn.durata) return alert("Inserisci la durata (minuti).");
    const minutes = Number(newTurn.durata);
    const laps = Number(newTurn.giri) || 0;
    const notes = newTurn.note || "";

    try {
      setTurnsSaving(true);

      // scrive in tabella normalizzata
      const { error } = await supabase.from("event_car_turns").insert([
        {
          event_car_id: eventCarId,
          minutes,
          laps,
          notes,
        },
      ]);
      if (error) throw new Error(error.message);

      // aggiorna stato locale
      setTurns((prev) => [...prev, { minutes, laps, notes }]);
      setNewTurn({ durata: "", giri: "", note: "" });

      // aggiorna ore componenti (rpc)
      try {
        await supabase.rpc("increment_component_hours", {
          p_car_id: eventCarId, // NB: manteniamo l'argomento che hai già in funzione
          p_hours: minutes / 60,
        });
      } catch {
        // silenzioso: se l'RPC non esiste/non è abilitato non blocchiamo il flusso
      }
    } catch (e: any) {
      alert("Errore salvataggio turni: " + e.message);
    } finally {
      setTurnsSaving(false);
    }
  }

  // ------------------------
  // Save Fuel
  // ------------------------
  async function onSaveFuel() {
    try {
      setFuelSaving(true);
      const data = { fuelStart, fuelEnd, lapsDone, lapsPlanned };
      await saveSection("fuel", data);

      const { data: hist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "fuel")
        .order("created_at", { ascending: false })
        .limit(3);

      setFuelHistory(hist || []);
      setFuelTick((t) => t + 1);
    } catch (e: any) {
      alert("Errore salvataggio carburante: " + e.message);
    } finally {
      setFuelSaving(false);
    }
  }
  function loadFuel(row: DataRow) {
    if (!row?.data) return;
    setFuelStart(Number(row.data.fuelStart ?? 0));
    setFuelEnd(Number(row.data.fuelEnd ?? 0));
    setLapsDone(Number(row.data.lapsDone ?? 0));
    setLapsPlanned(Number(row.data.lapsPlanned ?? 0));
  }

  // ------------------------
  // Save Notes
  // ------------------------
  async function onSaveNotes() {
    try {
      setNotesSaving(true);
      const data = { text: notes };
      await saveSection("notes", data);

      const { data: hist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "notes")
        .order("created_at", { ascending: false })
        .limit(3);

      setNotesHistory(hist || []);
      setNotesTick((t) => t + 1);
    } catch (e: any) {
      alert("Errore salvataggio note: " + e.message);
    } finally {
      setNotesSaving(false);
    }
  }
  function loadNotes(row: DataRow) {
    if (!row?.data) return;
    setNotes(String(row.data.text ?? ""));
  }

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
          <button
            onClick={() => setTab("touch")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "touch" ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Touch
          </button>
          <button
            onClick={() => setTab("racing")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "racing" ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Interattivo
          </button>
          <button
            onClick={() => setTab("scheda")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "scheda" ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Scheda Tecnica
          </button>
        </div>

        {/* Contenuto dinamico */}
        <div className="transition-all duration-300">
          {tab === "touch" && <SetupPanel eventCarId={eventCarId} />}
          {tab === "racing" && <SetupRacing eventCarId={eventCarId} />}
          {tab === "scheda" && <SetupScheda eventCarId={eventCarId} />}
        </div>
      </section>

      {/* 🧰 Check-up tecnico (grafica + salvataggi) */}
      <section className="bg-white border rounded-xl shadow-sm p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onSaveCheckup}
              disabled={checkupSaving}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
            >
              {checkupSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salva
              <CheckCircle2
                size={18}
                className={`transition-opacity ${checkupTick ? "opacity-100" : "opacity-0"}`}
              />
            </button>
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
            {defaultCheckupItems.map((item) => (
              <tr key={item}>
                <td className="border p-2">{item}</td>
                <td className="border p-2 text-center">
                  <select
                    value={checkup[item] || "OK"}
                    onChange={(e) =>
                      setCheckup((s) => ({ ...s, [item]: e.target.value as any }))
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

        {/* Storico ultimi 3 */}
        <HistoryBar
          title="Ultimi 3 salvataggi Check-up"
          rows={checkupHistory}
          onOpen={loadCheckup}
        />
      </section>

      {/* 🕓 Turni Svolti */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-3">🕓 Turni Svolti</h2>

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
                  <td className="border p-2 text-center">{t.minutes}</td>
                  <td className="border p-2 text-center">{t.laps}</td>
                  <td className="border p-2">{t.notes}</td>
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
          disabled={turnsSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold rounded-lg"
        >
          {turnsSaving ? <Loader2 className="animate-spin" size={16} /> : "➕"}
          Aggiungi Turno
        </button>
      </section>

      {/* ⛽ Gestione carburante */}
      <section className="bg-white border rounded-xl shadow-sm p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Fuel className="text-yellow-500" /> Gestione carburante
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onSaveFuel}
              disabled={fuelSaving}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
            >
              {fuelSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salva
              <CheckCircle2
                size={18}
                className={`transition-opacity ${fuelTick ? "opacity-100" : "opacity-0"}`}
              />
            </button>
          </div>
        </div>

        {/* Riga 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <NumberCard label="Carburante iniziale (L)" value={fuelStart} setValue={setFuelStart} />
          <NumberCard label="Carburante residuo (L)" value={fuelEnd} setValue={setFuelEnd} />
          <NumberCard label="Giri effettuati" value={lapsDone} setValue={setLapsDone} integer />
        </div>

        <hr className="my-3 border-gray-300" />

        {/* Riga 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <ReadOnlyCard label="Consumo medio a giro (L/giro)" value={fuelPerLap > 0 ? fuelPerLap.toFixed(2) : "—"} />
          <NumberCard label="Giri previsti prossimo turno" value={lapsPlanned} setValue={setLapsPlanned} integer />
          <HighlightCard
            label="Carburante da aggiungere (L)"
            value={fuelToAdd > 0 ? fuelToAdd.toFixed(1) : "—"}
          />
        </div>

        {/* Storico ultimi 3 */}
        <HistoryBar
          title="Ultimi 3 salvataggi Carburante"
          rows={fuelHistory}
          onOpen={loadFuel}
        />
      </section>

      {/* 🗒️ Note e osservazioni */}
      <section className="bg-white border rounded-xl shadow-sm p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <StickyNote className="text-yellow-500" /> Note e osservazioni
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onSaveNotes}
              disabled={notesSaving}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
            >
              {notesSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salva
              <CheckCircle2
                size={18}
                className={`transition-opacity ${notesTick ? "opacity-100" : "opacity-0"}`}
              />
            </button>
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border rounded-lg p-2 w-full"
          rows={3}
        />

        {/* Storico ultimi 3 */}
        <HistoryBar
          title="Ultimi 3 salvataggi Note"
          rows={notesHistory}
          onOpen={loadNotes}
        />
      </section>
    </div>
  );
}

/* ---------------- UI SUBCOMPONENTS ---------------- */

function HistoryBar({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: DataRow[];
  onOpen: (row: DataRow) => void;
}) {
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <RotateCcw size={14} /> Storico
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun salvataggio disponibile.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between border rounded px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              onClick={() => onOpen(r)}
              title="Apri questo salvataggio"
            >
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span className="text-yellow-600 font-semibold">🔄 Apri</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NumberCard({
  label,
  value,
  setValue,
  integer = false,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  integer?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => setValue(integer ? parseInt(e.target.value || "0") : parseFloat(e.target.value || "0"))}
        className="border rounded-lg p-2 w-full text-center"
      />
    </div>
  );
}

function ReadOnlyCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="border rounded-lg p-2 bg-gray-50 text-center font-semibold">{value}</div>
    </div>
  );
}

function HighlightCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="rounded-lg p-3 text-center font-bold text-black text-xl bg-yellow-400 border-2 border-yellow-600 shadow-inner">
        {value}
      </div>
    </div>
  );
}

