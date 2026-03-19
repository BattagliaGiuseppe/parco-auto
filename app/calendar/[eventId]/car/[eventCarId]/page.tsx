"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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
  Trash2,
  Clock3,
  AlertTriangle,
  CarFront,
  Flag,
  TriangleAlert,
  Droplets,
  ShieldCheck,
  Cpu,
  Wrench,
  Activity,
  FileText,
  UserRound,
  CalendarDays,
  PlusCircle,
} from "lucide-react";

import SetupScheda from "./setup-scheda";

/* ---------------- TYPES ---------------- */

type CheckStatus = "OK" | "Da controllare" | "Problema";

type DataRow = {
  id: string;
  event_car_id: string;
  section: "setup" | "checkup" | "fuel" | "notes";
  data: any;
  created_at: string;
};

type TurnRow = {
  id: string;
  minutes: number;
  laps: number;
  notes: string;
  created_at?: string;
};

type DriverRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type SessionRow = {
  id: string;
  name: string;
};

/* ---------------- PAGE ---------------- */

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as any;

  const [loading, setLoading] = useState(true);

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [newTurn, setNewTurn] = useState({ durata: "", giri: "", note: "" });

  const [checkup, setCheckup] = useState<Record<string, CheckStatus>>({});
  const [fuelStart, setFuelStart] = useState(0);
  const [fuelEnd, setFuelEnd] = useState(0);
  const [lapsDone, setLapsDone] = useState(0);
  const [lapsPlanned, setLapsPlanned] = useState(0);
  const [notes, setNotes] = useState("");

  /* ---------------- LOAD ---------------- */

  async function loadData() {
    setLoading(true);

    const { data: turnsData } = await supabase
      .from("event_car_turns")
      .select("*")
      .eq("event_car_id", eventCarId);

    const { data: driversData } = await supabase.from("drivers").select("*");
    const { data: sessionsData } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("event_id", eventId);

    setTurns(turnsData || []);
    setDrivers(driversData || []);
    setSessions(sessionsData || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  /* ---------------- TURNI ---------------- */

  async function addTurn() {
    await supabase.from("event_car_turns").insert([
      {
        event_car_id: eventCarId,
        minutes: Number(newTurn.durata),
        laps: Number(newTurn.giri),
        notes: newTurn.note,
      },
    ]);

    setNewTurn({ durata: "", giri: "", note: "" });
    loadData();
  }

  async function deleteTurn(id: string) {
    await supabase.from("event_car_turns").delete().eq("id", id);
    loadData();
  }

  /* ---------------- CALCOLI FUEL ---------------- */

  const fuelUsed = fuelStart - fuelEnd;
  const fuelPerLap = lapsDone > 0 ? fuelUsed / lapsDone : 0;
  const fuelToAdd =
    lapsPlanned > 0 ? lapsPlanned * fuelPerLap - fuelEnd : 0;

  /* ---------------- UI ---------------- */

  if (loading) {
    return <div className="p-10">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6">

      {/* HEADER */}
      <div className="card-base p-6 bg-black text-yellow-500">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CarFront /> Gestione Evento
        </h1>
      </div>

      {/* PILOTI */}
      <div className="card-base p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <UserRound /> Piloti assegnati
        </h2>

        {drivers.map((d) => (
          <div key={d.id}>
            {d.first_name} {d.last_name}
          </div>
        ))}
      </div>

      {/* SESSIONI */}
      <div className="card-base p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <CalendarDays /> Sessioni
        </h2>

        {sessions.map((s) => (
          <div key={s.id}>{s.name}</div>
        ))}
      </div>

      {/* SETUP */}
      <div className="card-base p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <Gauge /> Assetto
        </h2>

        <SetupScheda eventCarId={eventCarId} />
      </div>

      {/* CHECK */}
      <div className="card-base p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <ClipboardCheck /> Check-up
        </h2>

        {["Freni", "Ruote", "Sospensioni"].map((item) => (
          <div key={item} className="flex gap-3 mb-2">
            <span>{item}</span>
            <select
              onChange={(e) =>
                setCheckup((s) => ({
                  ...s,
                  [item]: e.target.value as CheckStatus,
                }))
              }
            >
              <option>OK</option>
              <option>Da controllare</option>
              <option>Problema</option>
            </select>
          </div>
        ))}
      </div>

      {/* TURNI */}
      <div className="card-base p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <Clock3 /> Turni
        </h2>

        {turns.map((t) => (
          <div key={t.id} className="flex justify-between">
            {t.minutes} min - {t.laps} giri
            <button onClick={() => deleteTurn(t.id)}>X</button>
          </div>
        ))}

        <div className="mt-3 flex gap-2">
          <input
            placeholder="min"
            value={newTurn.durata}
            onChange={(e) =>
              setNewTurn({ ...newTurn, durata: e.target.value })
            }
          />
          <input
            placeholder="giri"
            value={newTurn.giri}
            onChange={(e) =>
              setNewTurn({ ...newTurn, giri: e.target.value })
            }
          />
          <button onClick={addTurn}>
            <PlusCircle />
          </button>
        </div>
      </div>

      {/* FUEL */}
      <div className="card-base p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <Fuel /> Carburante
        </h2>

        <div className="flex gap-2">
          <input
            placeholder="Start"
            value={fuelStart}
            onChange={(e) => setFuelStart(Number(e.target.value))}
          />
          <input
            placeholder="End"
            value={fuelEnd}
            onChange={(e) => setFuelEnd(Number(e.target.value))}
          />
        </div>

        <div>Consumo: {fuelUsed}</div>
        <div>Media giro: {fuelPerLap.toFixed(2)}</div>
        <div>Da aggiungere: {fuelToAdd.toFixed(2)}</div>
      </div>

      {/* NOTE */}
      <div className="card-base p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <StickyNote /> Note
        </h2>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border p-2"
        />
      </div>
    </div>
  );
}