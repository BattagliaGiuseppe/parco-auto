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
  Trash2,
  Clock3,
  AlertTriangle,
} from "lucide-react";

import SetupScheda from "./setup-scheda";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type SectionType = "checkup" | "fuel" | "notes" | "setup";

type DataRow = {
  id: string;
  event_car_id: string;
  section: SectionType;
  data: any;
  created_at: string;
};

type TurnRow = {
  id: string;
  event_car_id?: string;
  minutes: number;
  laps: number;
  notes: string;
  created_at?: string;
};

type EventRow = {
  id: string;
  name: string;
  date: string | null;
};

type CarRow = {
  id: string;
  name: string;
  hours?: number | null;
};

type EventCarRow = {
  id: string;
  car_id: CarRow | CarRow[] | null;
  notes?: string | null;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

function normalizeCarRelation(value: CarRow | CarRow[] | null): CarRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatHours(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(2);
}

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const [event, setEvent] = useState<EventRow | null>(null);
  const [car, setCar] = useState<CarRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"scheda" | "touch">("scheda");

  const [setupExpanded, setSetupExpanded] = useState(true);
  const [checkupExpanded, setCheckupExpanded] = useState(false);
  const [turnsExpanded, setTurnsExpanded] = useState(false);
  const [fuelExpanded, setFuelExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const [setupData, setSetupData] = useState<Record<string, any>>({});
  const [setupHistory, setSetupHistory] = useState<DataRow[]>([]);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupTick, setSetupTick] = useState(0);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(null);
  const [lastSetupTime, setLastSetupTime] = useState<string | null>(null);

  const defaultCheckupItems = useMemo(
    () => ["Serraggi", "Freni", "Liquidi", "Sospensioni", "Elettronica", "Ruote", "Cambio"],
    []
  );

  const [checkup, setCheckup] = useState<Record<string, "OK" | "Da controllare" | "Problema">>({});
  const [checkupSaving, setCheckupSaving] = useState(false);
  const [checkupTick, setCheckupTick] = useState(0);
  const [checkupHistory, setCheckupHistory] = useState<DataRow[]>([]);
  const [activeCheckupId, setActiveCheckupId] = useState<string | null>(null);
  const [lastCheckupTime, setLastCheckupTime] = useState<string | null>(null);

  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [newTurn, setNewTurn] = useState<{ durata: string; giri: string; note: string }>({
    durata: "",
    giri: "",
    note: "",
  });
  const [turnsSaving, setTurnsSaving] = useState(false);

  const [fuelStart, setFuelStart] = useState<number>(0);
  const [fuelEnd, setFuelEnd] = useState<number>(0);
  const [lapsDone, setLapsDone] = useState<number>(0);
  const [lapsPlanned, setLapsPlanned] = useState<number>(0);
  const [fuelSaving, setFuelSaving] = useState(false);
  const [fuelTick, setFuelTick] = useState(0);
  const [fuelHistory, setFuelHistory] = useState<DataRow[]>([]);
  const [activeFuelId, setActiveFuelId] = useState<string | null>(null);
  const [lastFuelTime, setLastFuelTime] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesTick, setNotesTick] = useState(0);
  const [notesHistory, setNotesHistory] = useState<DataRow[]>([]);
  const [activeNotesId, setActiveNotesId] = useState<string | null>(null);
  const [lastNotesTime, setLastNotesTime] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const overallStatus = useMemo(() => {
    const values = Object.values(checkup);
    if (values.length === 0) return "Da controllare";
    if (values.includes("Problema")) return "Problema";
    if (values.every((v) => v === "OK")) return "OK";
    return "Da controllare";
  }, [checkup]);

  const statusCounts = useMemo(() => {
    const counts = {
      OK: 0,
      "Da controllare": 0,
      Problema: 0,
    } as Record<"OK" | "Da controllare" | "Problema", number>;

    for (const value of Object.values(checkup)) {
      if (value === "OK") counts.OK++;
      else if (value === "Problema") counts.Problema++;
      else counts["Da controllare"]++;
    }
    return counts;
  }, [checkup]);

  const totalMinutes = useMemo(
    () => turns.reduce((acc, t) => acc + Number(t.minutes || 0), 0),
    [turns]
  );

  const totalHours = useMemo(() => totalMinutes / 60, [totalMinutes]);
  const totalTurns = useMemo(() => turns.length, [turns]);

  const fuelPerLap = useMemo(() => {
    if (lapsDone > 0 && fuelStart >= 0 && fuelEnd >= 0) {
      const used = fuelStart - fuelEnd;
      return used > 0 ? used / lapsDone : 0;
    }
    return 0;
  }, [fuelStart, fuelEnd, lapsDone]);

  const fuelToAddRaw =
    lapsPlanned > 0 && fuelPerLap > 0 ? lapsPlanned * fuelPerLap - fuelEnd : 0;

  const fuelToAdd = Math.max(0, fuelToAddRaw);

  async function loadAllData() {
    try {
      setLoading(true);

      const [{ data: eventData, error: eventError }, { data: carData, error: eventCarError }] =
        await Promise.all([
          supabase
            .from("events")
            .select("id, name, date")
            .eq("id", eventId)
            .single(),
          supabase
            .from("event_cars")
            .select("id, car_id (id, name, hours), notes")
            .eq("id", eventCarId)
            .single(),
        ]);

      if (eventError) throw eventError;
      if (eventCarError) throw eventCarError;

      setEvent(eventData as EventRow);
      setCar(normalizeCarRelation((carData as EventCarRow)?.car_id ?? null));

      const [
        { data: setupLast },
        { data: setupHist },
        { data: checkLast },
        { data: checkHist },
        { data: turnsData, error: turnsError },
        { data: fuelLast },
        { data: fuelHist },
        { data: notesLast },
        { data: notesHist },
      ] = await Promise.all([
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "setup")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "setup")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "checkup")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "checkup")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("event_car_turns")
          .select("id, minutes, laps, notes, created_at")
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "fuel")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "fuel")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "notes")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("event_car_id", eventCarId)
          .eq("section", "notes")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (setupLast?.data) {
        setSetupData(setupLast.data || {});
        setActiveSetupId(setupLast.id);
        setLastSetupTime(new Date(setupLast.created_at).toLocaleString());
      } else {
        setSetupData({});
        setActiveSetupId(null);
        setLastSetupTime(null);
      }
      setSetupHistory((setupHist as DataRow[]) || []);

      if (checkLast?.data) {
        setCheckup(checkLast.data || {});
        setActiveCheckupId(checkLast.id);
        setLastCheckupTime(new Date(checkLast.created_at).toLocaleString());
      } else {
        setCheckup({});
        setActiveCheckupId(null);
        setLastCheckupTime(null);
      }
      setCheckupHistory((checkHist as DataRow[]) || []);

      if (turnsError) throw turnsError;
      setTurns((turnsData as TurnRow[]) || []);

      if (fuelLast?.data) {
        setFuelStart(Number(fuelLast.data.fuelStart ?? 0));
        setFuelEnd(Number(fuelLast.data.fuelEnd ?? 0));
        setLapsDone(Number(fuelLast.data.lapsDone ?? 0));
        setLapsPlanned(Number(fuelLast.data.lapsPlanned ?? 0));
        setActiveFuelId(fuelLast.id);
        setLastFuelTime(new Date(fuelLast.created_at).toLocaleString());
      } else {
        setFuelStart(0);
        setFuelEnd(0);
        setLapsDone(0);
        setLapsPlanned(0);
        setActiveFuelId(null);
        setLastFuelTime(null);
      }
      setFuelHistory((fuelHist as DataRow[]) || []);

      if (notesLast?.data?.text) {
        setNotes(String(notesLast.data.text));
        setActiveNotesId(notesLast.id);
        setLastNotesTime(new Date(notesLast.created_at).toLocaleString());
      } else {
        setNotes("");
        setActiveNotesId(null);
        setLastNotesTime(null);
      }
      setNotesHistory((notesHist as DataRow[]) || []);
    } catch (error: any) {
      showToast(`Errore caricamento dati: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventId && eventCarId) {
      loadAllData();
    }
  }, [eventId, eventCarId]);

  async function saveSection(section: SectionType, data: any) {
    const payload = { event_car_id: eventCarId, section, data };
    const { error } = await supabase.from("event_car_data").insert([payload]);
    if (error) throw new Error(error.message);
  }

  async function deleteSectionRow(rowId: string, section: SectionType) {
    const { error } = await supabase
      .from("event_car_data")
      .delete()
      .eq("id", rowId)
      .eq("event_car_id", eventCarId)
      .eq("section", section);

    if (error) throw new Error(error.message);

    const { data: hist, error: histError } = await supabase
      .from("event_car_data")
      .select("*")
      .eq("event_car_id", eventCarId)
      .eq("section", section)
      .order("created_at", { ascending: false })
      .limit(3);

    if (histError) throw new Error(histError.message);

    if (section === "checkup") setCheckupHistory((hist as DataRow[]) || []);
    if (section === "fuel") setFuelHistory((hist as DataRow[]) || []);
    if (section === "notes") setNotesHistory((hist as DataRow[]) || []);
    if (section === "setup") setSetupHistory((hist as DataRow[]) || []);

    showToast("✅ Eliminato");
  }

  async function onSaveSetup() {
    try {
      setSetupSaving(true);
      await saveSection("setup", setupData);

      const { data } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "setup")
        .order("created_at", { ascending: false })
        .limit(3);

      setSetupHistory((data as DataRow[]) || []);
      setSetupTick((t) => t + 1);
      setLastSetupTime(new Date().toLocaleString());
      showToast("💾 Setup salvato");
    } catch (e: any) {
      showToast(`Errore salvataggio setup: ${e.message}`, "error");
    } finally {
      setSetupSaving(false);
    }
  }

  function loadSetup(row: DataRow) {
    if (!row?.data) return;
    setSetupData(row.data || {});
    setActiveSetupId(row.id);
    setLastSetupTime(new Date(row.created_at).toLocaleString());
  }

  async function onSaveCheckup() {
    try {
      setCheckupSaving(true);
      await saveSection("checkup", checkup);

      const { data } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "checkup")
        .order("created_at", { ascending: false })
        .limit(3);

      setCheckupHistory((data as DataRow[]) || []);
      setCheckupTick((t) => t + 1);
      setLastCheckupTime(new Date().toLocaleString());
      showToast("💾 Check-up salvato");
    } catch (e: any) {
      showToast(`Errore salvataggio check-up: ${e.message}`, "error");
    } finally {
      setCheckupSaving(false);
    }
  }

  function loadCheckup(row: DataRow) {
    if (!row?.data) return;
    setCheckup(row.data || {});
    setActiveCheckupId(row.id);
    setLastCheckupTime(new Date(row.created_at).toLocaleString());
  }

  async function addTurn() {
    if (!newTurn.durata) {
      showToast("Inserisci la durata del turno", "error");
      return;
    }

    const minutes = Number(newTurn.durata);
    const laps = Number(newTurn.giri) || 0;
    const noteText = newTurn.note || "";

    if (!Number.isFinite(minutes) || minutes <= 0) {
      showToast("La durata deve essere maggiore di zero", "error");
      return;
    }

    try {
      setTurnsSaving(true);

      const { data: inserted, error } = await supabase
        .from("event_car_turns")
        .insert([
          {
            event_car_id: eventCarId,
            minutes,
            laps,
            notes: noteText,
          },
        ])
        .select()
        .single();

      if (error) throw new Error(error.message);

      setTurns((prev) => [...prev, inserted as TurnRow]);
      setNewTurn({ durata: "", giri: "", note: "" });

      showToast("✅ Turno aggiunto");

      if (confirm("Vuoi eseguire subito il check-up post turno?")) {
        const el = document.getElementById("checkup-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (e: any) {
      showToast(`Errore salvataggio turno: ${e.message}`, "error");
    } finally {
      setTurnsSaving(false);
    }
  }

  async function deleteTurn(turnId: string) {
    if (!confirm("Vuoi eliminare questo turno?")) return;

    const { error } = await supabase
      .from("event_car_turns")
      .delete()
      .eq("id", turnId)
      .eq("event_car_id", eventCarId);

    if (error) {
      showToast(`Errore eliminazione turno: ${error.message}`, "error");
      return;
    }

    setTurns((prev) => prev.filter((t) => t.id !== turnId));
    showToast("🗑️ Turno eliminato");
  }

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

      setFuelHistory((hist as DataRow[]) || []);
      setFuelTick((t) => t + 1);
      setLastFuelTime(new Date().toLocaleString());
      showToast("💾 Carburante salvato");
    } catch (e: any) {
      showToast(`Errore salvataggio carburante: ${e.message}`, "error");
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
    setActiveFuelId(row.id);
    setLastFuelTime(new Date(row.created_at).toLocaleString());
  }

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

      setNotesHistory((hist as DataRow[]) || []);
      setNotesTick((t) => t + 1);
      setLastNotesTime(new Date().toLocaleString());
      showToast("💾 Note salvate");
    } catch (e: any) {
      showToast(`Errore salvataggio note: ${e.message}`, "error");
    } finally {
      setNotesSaving(false);
    }
  }

  function loadNotes(row: DataRow) {
    if (!row?.data) return;
    setNotes(String(row.data.text ?? ""));
    setActiveNotesId(row.id);
    setLastNotesTime(new Date(row.created_at).toLocaleString());
  }

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

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {car.name} – {event.name}
          </h1>
          <p className="text-gray-600 text-sm">Gestione tecnica evento</p>
          <div className="mt-1 flex flex-col gap-1">
            <div className="text-sm text-gray-700 font-semibold">
              Ore auto attuali: <span className="text-yellow-700">{formatHours(car.hours)} h</span>
            </div>

            {overallStatus === "OK" && (
              <span className="text-green-700 font-semibold">🟢 Auto OK</span>
            )}
            {overallStatus === "Da controllare" && (
              <span className="text-yellow-700 font-semibold">🟠 Check-up da completare</span>
            )}
            {overallStatus === "Problema" && (
              <span className="text-red-700 font-semibold">🔴 Problema tecnico segnalato</span>
            )}
          </div>
        </div>

        <Link
          href={`/calendar/${eventId}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
        >
          <ArrowLeft size={16} /> Torna all’evento
        </Link>
      </div>

      <div className="h-[2px] bg-yellow-400/80 my-6" />

      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Gauge className="text-yellow-500" /> Assetto
          </h2>
          <button
            onClick={() => setSetupExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
          >
            {setupExpanded ? "↩ Vista sintetica" : "🔍 Dettagli"}
          </button>
        </div>

        {setupExpanded ? (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
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
            </div>

            <div className="transition-all duration-300">
              {tab === "scheda" && (
                <div className="flex flex-col gap-3">
                  <SetupScheda eventCarId={eventCarId} />

                  <HistoryBar
                    title="Ultimi 3 salvataggi Setup"
                    rows={setupHistory}
                    onOpen={loadSetup}
                    onDelete={async (row) => {
                      if (!confirm("Vuoi davvero eliminare questo salvataggio di setup?")) return;
                      try {
                        await deleteSectionRow(row.id, "setup");
                        if (activeSetupId === row.id) setActiveSetupId(null);
                      } catch (e: any) {
                        showToast(`Errore eliminazione: ${e.message}`, "error");
                      }
                    }}
                    activeId={activeSetupId}
                  />
                </div>
              )}

              {tab === "touch" && (
                <div className="flex flex-col gap-4">
                  {"imageUrl" in setupData && setupData.imageUrl ? (
                    <div className="w-full flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={setupData.imageUrl}
                        alt="Auto centrale"
                        className="max-h-72 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-xs text-gray-500">
                      Immagine auto centrale non impostata
                    </div>
                  )}

                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-2 text-left">Parametro</th>
                        <th className="border p-2 text-left">Valore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(setupData || {}).length === 0 && (
                        <tr>
                          <td colSpan={2} className="p-3 text-center text-gray-400">
                            Nessun parametro disponibile. Salva prima dalla scheda tecnica, poi modifica qui.
                          </td>
                        </tr>
                      )}

                      {Object.entries(setupData || {}).map(([key, value]) => {
                        if (key === "imageUrl") return null;
                        return (
                          <tr key={key}>
                            <td className="border p-2">{key}</td>
                            <td className="border p-2">
                              <input
                                className="border rounded-lg p-1 w-full"
                                value={String(value ?? "")}
                                onChange={(e) =>
                                  setSetupData((s) => ({
                                    ...s,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="flex justify-center mt-2 mb-2">
                    <button
                      onClick={onSaveSetup}
                      disabled={setupSaving}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-sm"
                    >
                      {setupSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Salva Setup
                      <CheckCircle2
                        size={18}
                        className={`transition-opacity ${setupTick ? "opacity-100" : "opacity-0"}`}
                      />
                    </button>
                  </div>

                  {lastSetupTime && (
                    <p className="text-xs text-gray-500 text-center -mt-2">
                      Ultimo salvataggio: {lastSetupTime}
                    </p>
                  )}

                  <HistoryBar
                    title="Ultimi 3 salvataggi Setup"
                    rows={setupHistory}
                    onOpen={loadSetup}
                    onDelete={async (row) => {
                      if (!confirm("Vuoi davvero eliminare questo salvataggio di setup?")) return;
                      try {
                        await deleteSectionRow(row.id, "setup");
                        if (activeSetupId === row.id) setActiveSetupId(null);
                      } catch (e: any) {
                        showToast(`Errore eliminazione: ${e.message}`, "error");
                      }
                    }}
                    activeId={activeSetupId}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">Vista sintetica</div>
        )}
      </section>

      <div className="h-[2px] bg-yellow-400/80 my-6" />

      <section id="checkup-section" className="bg-white border rounded-xl shadow-sm p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="text-yellow-500" /> Check-up tecnico
          </h2>
          <button
            onClick={() => setCheckupExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
          >
            {checkupExpanded ? "↩ Vista sintetica" : "🔍 Dettagli"}
          </button>
        </div>

        {checkupExpanded ? (
          <>
            <div className="mb-4 px-4 py-3 rounded-lg border bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 text-base font-semibold">
                {overallStatus === "OK" && <span className="text-green-700">🟢 Tutti i controlli OK</span>}
                {overallStatus === "Da controllare" && (
                  <span className="text-yellow-700">🟠 Check-up da completare</span>
                )}
                {overallStatus === "Problema" && (
                  <span className="text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> Problema rilevato
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <span className="text-green-700">✅ {statusCounts.OK} OK</span>
                <span className="text-yellow-700">🟡 {statusCounts["Da controllare"]} Da controllare</span>
                <span className="text-red-700">❌ {statusCounts.Problema} Problema</span>
              </div>
            </div>

            <table className="w-full text-sm border-collapse mb-4">
              <thead>
                <tr className="bg-gray-50 text-gray-700">
                  <th className="border p-2 text-left">Controllo</th>
                  <th className="border p-2 text-center">Stato</th>
                  <th className="border p-2 text-center">Azione</th>
                </tr>
              </thead>
              <tbody>
                {defaultCheckupItems.map((item) => {
                  const value = checkup[item] || "Da controllare";
                  const bgColor =
                    value === "OK"
                      ? "bg-green-100"
                      : value === "Da controllare"
                      ? "bg-yellow-100"
                      : "bg-red-100";

                  const borderColor =
                    value === "OK"
                      ? "border-green-400"
                      : value === "Da controllare"
                      ? "border-yellow-400"
                      : "border-red-400";

                  return (
                    <tr key={item} className={bgColor}>
                      <td className="border p-2">{item}</td>
                      <td className="border p-2 text-center">
                        <select
                          value={value}
                          onChange={(e) =>
                            setCheckup((s) => ({
                              ...s,
                              [item]: e.target.value as "OK" | "Da controllare" | "Problema",
                            }))
                          }
                          className={`border rounded-lg p-1 text-sm ${borderColor}`}
                        >
                          <option>OK</option>
                          <option>Da controllare</option>
                          <option>Problema</option>
                        </select>
                      </td>
                      <td className="border p-2 text-center">
                        {value === "Problema" && (
                          <button
                            onClick={() =>
                              showToast(`Segnalazione manutenzione per: ${item} (funzione da collegare)`)
                            }
                            className="text-red-700 text-xs font-semibold hover:underline"
                          >
                            Crea manutenzione
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-center mt-4 mb-2">
              <button
                onClick={onSaveCheckup}
                disabled={checkupSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-sm"
              >
                {checkupSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salva Check-up
                <CheckCircle2
                  size={18}
                  className={`transition-opacity duration-500 ${
                    checkupTick ? "opacity-100 text-green-600" : "opacity-0"
                  }`}
                />
              </button>
            </div>

            {lastCheckupTime && (
              <p className="text-xs text-gray-500 text-center mb-4">
                Ultimo salvataggio: {lastCheckupTime}
              </p>
            )}

            <HistoryBar
              title="Ultimi 3 salvataggi Check-up"
              rows={checkupHistory}
              onOpen={loadCheckup}
              onDelete={async (row) => {
                if (!confirm("Vuoi davvero eliminare questo salvataggio?")) return;
                try {
                  await deleteSectionRow(row.id, "checkup");
                  if (activeCheckupId === row.id) setActiveCheckupId(null);
                } catch (e: any) {
                  showToast(`Errore eliminazione: ${e.message}`, "error");
                }
              }}
              activeId={activeCheckupId}
            />
          </>
        ) : (
          <div className="text-sm text-gray-500">Vista sintetica</div>
        )}
      </section>

      <div className="h-[2px] bg-yellow-400/80 my-6" />

      <section className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Clock3 className="text-yellow-500" /> Turni Svolti{" "}
            <span className="ml-1 inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-gray-800">
              {totalTurns}
            </span>
          </h2>
          <button
            onClick={() => setTurnsExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
          >
            {turnsExpanded ? "↩ Vista sintetica" : "🔍 Dettagli"}
          </button>
        </div>

        {turnsExpanded ? (
          <>
            <div className="mb-4 px-4 py-3 rounded-lg border bg-gray-50 flex items-center justify-between">
              <span className="font-semibold text-gray-700">
                Turni totali: <span className="text-gray-900">{totalTurns}</span>
              </span>
              <span className="font-semibold text-gray-700">
                Ore totali evento: <span className="text-yellow-700">{totalHours.toFixed(2)} h</span>
              </span>
            </div>

            <table className="w-full text-sm border-collapse mb-4">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-2">#</th>
                  <th className="border p-2">Durata (min)</th>
                  <th className="border p-2">Giri</th>
                  <th className="border p-2">Note</th>
                  <th className="border p-2 text-center">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {turns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 p-3">
                      Nessun turno registrato
                    </td>
                  </tr>
                ) : (
                  turns.map((t, i) => (
                    <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border p-2 text-center">{i + 1}</td>
                      <td className="border p-2 text-center">{t.minutes}</td>
                      <td className="border p-2 text-center">{t.laps}</td>
                      <td className="border p-2">{t.notes}</td>
                      <td className="border p-2 text-center">
                        <button
                          onClick={() => deleteTurn(t.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-semibold inline-flex items-center gap-1"
                          title="Elimina turno"
                        >
                          <Trash2 size={14} /> Elimina
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                type="number"
                placeholder="Durata (minuti)"
                value={newTurn.durata}
                onChange={(e) => setNewTurn({ ...newTurn, durata: e.target.value })}
                className="border rounded-lg p-2 text-sm focus:ring-2 focus:ring-yellow-300 outline-none"
              />
              <input
                type="number"
                placeholder="Giri"
                value={newTurn.giri}
                onChange={(e) => setNewTurn({ ...newTurn, giri: e.target.value })}
                className="border rounded-lg p-2 text-sm focus:ring-2 focus:ring-yellow-300 outline-none"
              />
              <input
                type="text"
                placeholder="Note"
                value={newTurn.note}
                onChange={(e) => setNewTurn({ ...newTurn, note: e.target.value })}
                className="border rounded-lg p-2 text-sm focus:ring-2 focus:ring-yellow-300 outline-none"
              />
            </div>

            <button
              onClick={addTurn}
              disabled={turnsSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold rounded-lg shadow-sm"
            >
              {turnsSaving ? <Loader2 className="animate-spin" size={16} /> : "➕"}
              Aggiungi Turno
            </button>
          </>
        ) : (
          <div className="text-sm text-gray-500">
            {totalTurns} turni registrati • {totalHours.toFixed(2)} ore totali
          </div>
        )}
      </section>

      <div className="h-[2px] bg-yellow-400/80 my-6" />

      <section className="bg-white border rounded-xl shadow-sm p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Fuel className="text-yellow-500" /> Gestione carburante
          </h2>
          <button
            onClick={() => setFuelExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
          >
            {fuelExpanded ? "↩ Vista sintetica" : "🔍 Dettagli"}
          </button>
        </div>

        {fuelExpanded ? (
          <>
            <div className="mb-4 px-4 py-3 rounded-lg border bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-semibold text-gray-700">
                Consumo medio:{" "}
                <span className="text-gray-900">
                  {fuelPerLap > 0 ? `${fuelPerLap.toFixed(2)} L/giro` : "—"}
                </span>
              </span>
              <span className="font-semibold text-gray-700">
                Carburante da aggiungere:{" "}
                <span className="text-yellow-700">
                  {fuelToAdd > 0 ? `${fuelToAdd.toFixed(1)} L` : "—"}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <NumberCard label="Carburante iniziale (L)" value={fuelStart} setValue={setFuelStart} />
              <NumberCard label="Carburante residuo (L)" value={fuelEnd} setValue={setFuelEnd} />
              <NumberCard label="Giri effettuati" value={lapsDone} setValue={setLapsDone} integer />
            </div>

            <hr className="my-3 border-gray-200" />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <ReadOnlyCard
                label="Consumo medio a giro (L/giro)"
                value={fuelPerLap > 0 ? fuelPerLap.toFixed(2) : "—"}
              />
              <NumberCard
                label="Giri previsti prossimo turno"
                value={lapsPlanned}
                setValue={setLapsPlanned}
                integer
              />
              <HighlightCard
                label="Carburante da aggiungere (L)"
                value={fuelToAdd > 0 ? fuelToAdd.toFixed(1) : "—"}
              />
            </div>

            <div className="flex justify-center mt-5 mb-2">
              <button
                onClick={onSaveFuel}
                disabled={fuelSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-sm"
              >
                {fuelSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salva carburante
                <CheckCircle2
                  size={18}
                  className={`transition-opacity ${fuelTick ? "opacity-100" : "opacity-0"}`}
                />
              </button>
            </div>

            {lastFuelTime && (
              <p className="text-xs text-gray-500 text-center mb-4">
                Ultimo salvataggio: {lastFuelTime}
              </p>
            )}

            <HistoryBar
              title="Ultimi 3 salvataggi Carburante"
              rows={fuelHistory}
              onOpen={loadFuel}
              onDelete={async (row) => {
                if (!confirm("Vuoi davvero eliminare questo salvataggio?")) return;
                try {
                  await deleteSectionRow(row.id, "fuel");
                  if (activeFuelId === row.id) setActiveFuelId(null);
                } catch (e: any) {
                  showToast(`Errore eliminazione: ${e.message}`, "error");
                }
              }}
              activeId={activeFuelId}
            />
          </>
        ) : (
          <div className="text-sm text-gray-500">Vista sintetica</div>
        )}
      </section>

      <div className="h-[2px] bg-yellow-400/80 my-6" />

      <section className="bg-white border rounded-xl shadow-sm p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <StickyNote className="text-yellow-500" /> Note e osservazioni
          </h2>
          <button
            onClick={() => setNotesExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
          >
            {notesExpanded ? "↩ Vista sintetica" : "🔍 Dettagli"}
          </button>
        </div>

        {notesExpanded ? (
          <>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Annota eventuali problemi, sensazioni del pilota o modifiche da fare..."
              className="border rounded-lg p-3 w-full focus:ring-2 focus:ring-yellow-300 outline-none"
              rows={4}
            />

            <div className="flex justify-center mt-4 mb-2">
              <button
                onClick={onSaveNotes}
                disabled={notesSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-sm"
              >
                {notesSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salva Note
                <CheckCircle2
                  size={18}
                  className={`transition-opacity ${notesTick ? "opacity-100" : "opacity-0"}`}
                />
              </button>
            </div>

            {lastNotesTime && (
              <p className="text-xs text-gray-500 text-center mb-4">
                Ultimo salvataggio: {lastNotesTime}
              </p>
            )}

            <HistoryBar
              title="Ultimi 3 salvataggi Note"
              rows={notesHistory}
              onOpen={loadNotes}
              onDelete={async (row) => {
                if (!confirm("Vuoi davvero eliminare questo salvataggio?")) return;
                try {
                  await deleteSectionRow(row.id, "notes");
                  if (activeNotesId === row.id) setActiveNotesId(null);
                } catch (e: any) {
                  showToast(`Errore eliminazione: ${e.message}`, "error");
                }
              }}
              activeId={activeNotesId}
            />
          </>
        ) : (
          <div className="text-sm text-gray-500">Vista sintetica</div>
        )}
      </section>

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-lg shadow-lg font-semibold ${
            toast.type === "success"
              ? "bg-yellow-400 text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ---------------- UI SUBCOMPONENTS ---------------- */

function HistoryBar({
  title,
  rows,
  onOpen,
  onDelete,
  activeId,
}: {
  title: string;
  rows: DataRow[];
  onOpen: (row: DataRow) => void;
  onDelete?: (row: DataRow) => void;
  activeId?: string | null;
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
          {rows.map((r) => {
            const isActive = activeId && r.id === activeId;
            return (
              <li
                key={r.id}
                className={`flex items-center justify-between border rounded px-3 py-2 text-sm transition-all ${
                  isActive ? "bg-yellow-100 border-yellow-400 shadow-inner" : "hover:bg-gray-50"
                }`}
              >
                <button
                  onClick={() => onOpen(r)}
                  className="flex-1 text-left"
                  title="Apri questo salvataggio"
                >
                  {new Date(r.created_at).toLocaleString()}
                </button>

                <div className="flex items-center gap-3">
                  {isActive ? (
                    <span className="text-green-700 font-semibold">✅ Aperto</span>
                  ) : (
                    <button onClick={() => onOpen(r)} className="text-yellow-600 font-semibold">
                      🔄 Apri
                    </button>
                  )}

                  {onDelete && (
                    <button
                      onClick={() => onDelete(r)}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold inline-flex items-center gap-1"
                      title="Elimina salvataggio"
                    >
                      <Trash2 size={14} /> Elimina
                    </button>
                  )}
                </div>
              </li>
            );
          })}
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
        onChange={(e) =>
          setValue(
            integer
              ? parseInt(e.target.value || "0", 10)
              : parseFloat(e.target.value || "0")
          )
        }
        className="border rounded-lg p-2 w-full text-center focus:ring-2 focus:ring-yellow-300 outline-none"
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
