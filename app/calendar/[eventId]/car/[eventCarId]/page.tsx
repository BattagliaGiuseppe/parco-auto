"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Gauge,
  Fuel,
  ClipboardCheck,
  StickyNote,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Audiowide } from "next/font/google";

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

  // Turni svolti
  const [turns, setTurns] = useState<{ durata: number; giri: number; note: string }[]>([]);
  const [newTurn, setNewTurn] = useState({ durata: "", giri: "", note: "" });
  const [totalHours, setTotalHours] = useState(0);

  // Carburante
  const [fuelStart, setFuelStart] = useState(0);
  const [fuelEnd, setFuelEnd] = useState(0);
  const [lapsDone, setLapsDone] = useState(0);
  const [lapsPlanned, setLapsPlanned] = useState(0);

  const fuelPerLap =
    lapsDone > 0 && fuelStart > 0 && fuelEnd >= 0
      ? (fuelStart - fuelEnd) / lapsDone
      : 0;

  const fuelToAdd = fuelPerLap > 0 && lapsPlanned > 0 ? fuelPerLap * lapsPlanned : 0;

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

    // Aggiorna ore componenti in Supabase
    const oreTurno = Number(newTurn.durata) / 60;
    await supabase.rpc("increment_component_hours", {
      p_car_id: eventCarId,
      p_hours: oreTurno,
    });

    setNewTurn({ durata: "", giri: "", note: "" });
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
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Gauge className="text-yellow-500" /> Assetto
        </h2>

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

        <div className="transition-all duration-300">
          {tab === "touch" && <SetupPanel eventCarId={eventCarId} />}
          {tab === "racing" && <SetupRacing eventCarId={eventCarId} />}
          {tab === "scheda" && <SetupScheda />}
        </div>
      </section>

      {/* 🧰 Check-up tecnico */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="border p-2 text-left">Controllo</th>
              <th className="border p-2 text-center">Stato</th>
            </tr>
          </thead>
          <tbody>
            {["Serraggi", "Freni", "Liquidi", "Sospensioni", "Elettronica", "Ruote", "Cambio"].map((item) => (
              <tr key={item}>
                <td className="border p-2">{item}</td>
                <td className="border p-2 text-center">
                  <select className="border rounded-lg p-1 text-sm">
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
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          🕓 Turni Svolti
        </h2>

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
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold rounded-lg"
        >
          ➕ Aggiungi Turno
        </button>
      </section>

      {/* ⛽ Gestione carburante */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Fuel className="text-yellow-500" /> Gestione carburante
        </h2>

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
      </section>

      {/* 🗒️ Note */}
      <section className="bg-white border rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
          <StickyNote className="text-yellow-500" /> Note e osservazioni
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
          className="border rounded-lg p-2 w-full"
          rows={3}
        />
      </section>
    </div>
  );
}
