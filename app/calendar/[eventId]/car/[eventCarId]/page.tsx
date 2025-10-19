"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Gauge,
  Fuel,
  ClipboardCheck,
  StickyNote,
  ArrowLeft,
  Save,
  History,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

import SetupPanel from "./setup";          // touch UI
import SetupRacing from "./setup-racing";  // interattivo SVG
import SetupScheda from "./setup-scheda";  // scheda tecnica grafica

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type HistoryRow = {
  id: string;
  created_at: string;
  data: any;
};

type CheckItem = { label: string; status: "OK" | "Da controllare" | "Problema" };

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

  // --------- TOAST ----------
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });
  const toastTimer = useRef<any>(null);
  function showToast(message: string) {
    setToast({ show: true, message });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 3000);
  }

  // --------- CHECK-UP ----------
  const [checkups, setCheckups] = useState<CheckItem[]>([
    { label: "Serraggi", status: "OK" },
    { label: "Freni", status: "OK" },
    { label: "Liquidi", status: "OK" },
    { label: "Sospensioni", status: "OK" },
    { label: "Elettronica", status: "OK" },
    { label: "Ruote", status: "OK" },
    { label: "Cambio", status: "OK" },
  ]);
  const [checkupHistory, setCheckupHistory] = useState<HistoryRow[]>([]);

  // --------- TURNI ----------
  const [turns, setTurns] = useState<{ durata: number; giri: number; note: string }[]>([]);
  const [newTurn, setNewTurn] = useState({ durata: "", giri: "", note: "" });
  const [totalHours, setTotalHours] = useState(0);
  const [turnsHistory, setTurnsHistory] = useState<HistoryRow[]>([]);

  // --------- CARBURANTE ----------
  const [fuelStart, setFuelStart] = useState(0);
  const [fuelEnd, setFuelEnd] = useState(0);
  const [lapsDone, setLapsDone] = useState(0);
  const [lapsPlanned, setLapsPlanned] = useState(0);
  const [fuelHistory, setFuelHistory] = useState<HistoryRow[]>([]);

  const fuelPerLap =
    lapsDone > 0 && fuelStart > 0 && fuelEnd >= 0
      ? (fuelStart - fuelEnd) / lapsDone
      : 0;

  // ✅ formula corretta: sottraggo il residuo
  const fuelToAdd =
    fuelPerLap > 0 && lapsPlanned > 0
      ? fuelPerLap * lapsPlanned - fuelEnd
      : 0;

  // --------- NOTE ----------
  const [notesHistory, setNotesHistory] = useState<HistoryRow[]>([]);

  // --------- SETUP (history generica per la sezione) ----------
  const [setupHistory, setSetupHistory] = useState<HistoryRow[]>([]);

  // ---------- INIT ----------
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

      // carica ultimi 3 salvataggi per ogni sezione
      await Promise.all([
        loadSectionHistory("checkup", setCheckupHistory),
        loadSectionHistory("turns", setTurnsHistory),
        loadSectionHistory("fuel", setFuelHistory),
        loadSectionHistory("notes", setNotesHistory),
        loadSectionHistory("setup", setSetupHistory),
      ]);

      setLoading(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventCarId]);

  // --------- HELPERS: HISTORY ----------
  async function loadSectionHistory(
    section: "setup" | "checkup" | "turns" | "fuel" | "notes",
    setter: (rows: HistoryRow[]) => void
  ) {
    const { data } = await supabase
      .from("event_car_history")
      .select("id, created_at, data")
      .eq("event_car_id", eventCarId)
      .eq("section", section)
      .order("created_at", { ascending: false })
      .limit(3);
    setter(data || []);
  }

  async function saveSection(
    section: "setup" | "checkup" | "turns" | "fuel" | "notes",
    payload: any
  ) {
    const { error } = await supabase
      .from("event_car_history")
      .insert([{ event_car_id: eventCarId, section, data: payload }]);

    if (error) {
      showToast(`❌ Errore salvataggio ${section}: ${error.message}`);
      return;
    }
    // ricarica ultimi 3
    switch (section) {
      case "checkup":
        await loadSectionHistory("checkup", setCheckupHistory);
        break;
      case "turns":
        await loadSectionHistory("turns", setTurnsHistory);
        break;
      case "fuel":
        await loadSectionHistory("fuel", setFuelHistory);
        break;
      case "notes":
        await loadSectionHistory("notes", setNotesHistory);
        break;
      case "setup":
        await loadSectionHistory("setup", setSetupHistory);
        break;
    }
    showToast("✅ Salvataggio effettuato");
  }

  function openHistory(section: string, row: HistoryRow) {
    const data = row.data || {};
    if (section === "checkup") {
      const restored: CheckItem[] =
        Array.isArray(data?.items) && data.items.length
          ? data.items
          : checkups;
      setCheckups(
        restored.map((it) => ({
          label: it.label,
          status:
            it.status === "OK" || it.status === "Da controllare" || it.status === "Problema"
              ? it.status
              : "OK",
        }))
      );
      showToast("🔄 Check-up ripristinato");
    } else if (section === "turns") {
      setTurns(Array.isArray(data?.turns) ? data.turns : []);
      setTotalHours(Number(data?.totalHours) || 0);
      showToast("🔄 Turni ripristinati");
    } else if (section === "fuel") {
      setFuelStart(Number(data?.fuelStart) || 0);
      setFuelEnd(Number(data?.fuelEnd) || 0);
      setLapsDone(Number(data?.lapsDone) || 0);
      setLapsPlanned(Number(data?.lapsPlanned) || 0);
      showToast("🔄 Carburante ripristinato");
    } else if (section === "notes") {
      setNotes(data?.notes || "");
      showToast("🔄 Note ripristinate");
    } else if (section === "setup") {
      // Solo storico per consultazione: il salvataggio reale del setup vive nelle tabelle dedicate.
      showToast("ℹ️ Setup storico caricato (consulta in schede Setup)");
    }
  }

  // ➕ Aggiungi turno
  async function addTurn() {
    if (!newTurn.durata) return alert("Inserisci la durata del turno");
    const turno = {
      durata: Number(newTurn.durata),
      giri: Number(newTurn.giri) || 0,
      note: newTurn.note || "",
    };
    const updated = [...turns, turno];
    setTurns(updated);

    // Calcolo ore totali
    const totalMin = updated.reduce((sum, t) => sum + t.durata, 0);
    const oreTot = totalMin / 60;
    setTotalHours(oreTot);

    // Aggiorna ore componenti (procedure già creata su Supabase)
    const oreTurno = Number(newTurn.durata) / 60;
    try {
      await supabase.rpc("increment_component_hours", {
        p_car_id: eventCarId, // NB: se la function si aspetta car_id e non eventCarId, adattare
        p_hours: oreTurno,
      });
    } catch {
      // no-op (evitiamo di bloccare l'UI)
    }

    setNewTurn({ durata: "", giri: "", note: "" });
  }

  // 💾 Salva Setup (usa le tabelle dedicate)
  async function saveSetupSnapshot() {
    // 1) leggo l'ultima versione corrente del setup
    const { data: current } = await supabase
      .from("event_car_setup")
      .select("*")
      .eq("event_car_id", eventCarId)
      .maybeSingle();

    // 2) se esiste, duplico nello storico dedicato
    if (current) {
      try {
        await supabase.from("event_car_setup_history").insert([
          {
            event_car_id: eventCarId,
            ...current,
          },
        ]);
      } catch {}
    }

    // 3) salvo anche in event_car_history come snapshot consultabile
    await saveSection("setup", { setup: current || {} });
  }

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

      {/* Sezione Setup */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Gauge className="text-yellow-500" /> Assetto
          </h2>

          {/* 💾 Salva Setup */}
          <div className="flex items-center gap-2">
            <button
              onClick={saveSetupSnapshot}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
              title="Salva snapshot setup"
            >
              <Save size={16} /> Salva Setup
            </button>
          </div>
        </div>

        {/* Tabs per i tre tipi di setup */}
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setTab("touch")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "touch"
                ? "bg-yellow-400 text-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Touch
          </button>

          <button
            onClick={() => setTab("racing")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "racing"
                ? "bg-yellow-400 text-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Interattivo
          </button>

        <button
            onClick={() => setTab("scheda")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "scheda"
                ? "bg-yellow-400 text-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Setup Scheda Tecnica
          </button>
        </div>

        {/* Contenuto dinamico */}
        <div className="transition-all duration-300">
          {tab === "touch" && <SetupPanel eventCarId={eventCarId} />}
          {tab === "racing" && <SetupRacing eventCarId={eventCarId} />}
          {tab === "scheda" && <SetupScheda />}
        </div>

        {/* Ultimi 3 salvataggi Setup */}
        <div className="mt-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold mb-2">
            <History size={16} /> Ultimi 3 salvataggi (Setup)
          </div>
          {setupHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun salvataggio.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {setupHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between border rounded px-3 py-1 text-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => openHistory("setup", h)}
                  title="Clicca per aprire lo snapshot (consultazione)"
                >
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <span className="text-yellow-600 font-semibold">🔎 Apri</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 🧰 Check-up tecnico */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
          </h2>
          <button
            onClick={() => saveSection("checkup", { items: checkups })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
          >
            <Save size={16} /> Salva
          </button>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="border p-2 text-left">Controllo</th>
              <th className="border p-2 text-center">Stato</th>
            </tr>
          </thead>
          <tbody>
            {checkups.map((item, idx) => (
              <tr key={item.label}>
                <td className="border p-2">{item.label}</td>
                <td className="border p-2 text-center">
                  <select
                    className="border rounded-lg p-1 text-sm"
                    value={item.status}
                    onChange={(e) => {
                      const next = [...checkups];
                      next[idx] = {
                        ...next[idx],
                        status: e.target.value as CheckItem["status"],
                      };
                      setCheckups(next);
                    }}
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

        {/* Ultimi 3 salvataggi Check-up */}
        <div className="mt-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold mb-2">
            <History size={16} /> Ultimi 3 salvataggi (Check-up)
          </div>
          {checkupHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun salvataggio.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {checkupHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between border rounded px-3 py-1 text-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => openHistory("checkup", h)}
                >
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <span className="text-yellow-600 font-semibold">🔄 Apri</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 🕓 Turni Svolti */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            🕓 Turni Svolti
          </h2>
          <button
            onClick={() => saveSection("turns", { turns, totalHours })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
          >
            <Save size={16} /> Salva
          </button>
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
          <span className="text-yellow-600 font-bold">
            {totalHours.toFixed(2)} h
          </span>
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
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold rounded-lg"
        >
          ➕ Aggiungi Turno
        </button>

        {/* Ultimi 3 salvataggi Turni */}
        <div className="mt-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold mb-2">
            <History size={16} /> Ultimi 3 salvataggi (Turni)
          </div>
          {turnsHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun salvataggio.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {turnsHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between border rounded px-3 py-1 text-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => openHistory("turns", h)}
                >
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <span className="text-yellow-600 font-semibold">🔄 Apri</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ⛽ Gestione carburante */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Fuel className="text-yellow-500" /> Gestione carburante
          </h2>
          <button
            onClick={() =>
              saveSection("fuel", {
                fuelStart,
                fuelEnd,
                lapsDone,
                lapsPlanned,
                fuelPerLap,
                fuelToAdd,
              })
            }
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
          >
            <Save size={16} /> Salva
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Carburante iniziale (L)
            </label>
            <input
              type="number"
              value={fuelStart}
              onChange={(e) => setFuelStart(Number(e.target.value))}
              className="border rounded-lg p-2 w-full text-center"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Carburante residuo (L)
            </label>
            <input
              type="number"
              value={fuelEnd}
              onChange={(e) => setFuelEnd(Number(e.target.value))}
              className="border rounded-lg p-2 w-full text-center"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Giri effettuati
            </label>
            <input
              type="number"
              value={lapsDone}
              onChange={(e) => setLapsDone(Number(e.target.value))}
              className="border rounded-lg p-2 w-full text-center"
            />
          </div>
        </div>

        <hr className="my-3 border-gray-300" />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Consumo medio a giro (L/giro)
            </label>
            <div className="border rounded-lg p-2 bg-gray-50 text-center font-semibold">
              {fuelPerLap > 0 ? fuelPerLap.toFixed(2) : "—"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Giri previsti prossimo turno
            </label>
            <input
              type="number"
              value={lapsPlanned}
              onChange={(e) => setLapsPlanned(Number(e.target.value))}
              className="border rounded-lg p-2 w-full text-center"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Carburante da aggiungere (L)
            </label>
            <div className="rounded-lg p-3 text-center font-bold text-black text-xl bg-yellow-400 border-2 border-yellow-600 shadow-inner">
              {fuelToAdd > 0 ? fuelToAdd.toFixed(1) : "—"}
            </div>
          </div>
        </div>

        {/* Ultimi 3 salvataggi Fuel */}
        <div className="mt-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold mb-2">
            <History size={16} /> Ultimi 3 salvataggi (Carburante)
          </div>
          {fuelHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun salvataggio.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {fuelHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between border rounded px-3 py-1 text-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => openHistory("fuel", h)}
                >
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <span className="text-yellow-600 font-semibold">🔄 Apri</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 🗒️ Note */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <StickyNote className="text-yellow-500" /> Note e osservazioni
          </h2>
          <button
            onClick={() => saveSection("notes", { notes })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
          >
            <Save size={16} /> Salva
          </button>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border rounded-lg p-2 w-full"
          rows={3}
        />

        {/* Ultimi 3 salvataggi Note */}
        <div className="mt-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold mb-2">
            <History size={16} /> Ultimi 3 salvataggi (Note)
          </div>
          {notesHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun salvataggio.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notesHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between border rounded px-3 py-1 text-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => openHistory("notes", h)}
                >
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <span className="text-yellow-600 font-semibold">🔄 Apri</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* TOAST */}
      <div
        className={`fixed right-4 bottom-4 z-[9999] pointer-events-none transition-all duration-300 ${
          toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <div className="pointer-events-auto rounded-xl bg-neutral-900 text-white shadow-xl px-4 py-3 flex items-center gap-2">
          <span>{toast.message}</span>
        </div>
      </div>
    </div>
  );
}
