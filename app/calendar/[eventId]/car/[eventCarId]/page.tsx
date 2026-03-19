"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
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
  Settings2,
  MapPin,
} from "lucide-react";

import SetupScheda from "./setup-scheda";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type SectionType = "checkup" | "fuel" | "notes";
type CheckStatus = "OK" | "Da controllare" | "Problema";

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
  event_session_id?: string | null;
  minutes: number;
  laps: number;
  notes: string;
  created_at?: string;
};

type EventRow = {
  id: string;
  name: string;
  date: string | null;
  circuit_id: string | null;
};

type CircuitRow = {
  id: string;
  name: string;
};

type CarRow = {
  id: string;
  name: string;
  hours?: number | null;
};

type EventCarRow = {
  id: string;
  event_id: string | null;
  car_id: string | null;
  driver?: string | null;
  notes?: string | null;
  status?: string | null;
};

type DriverRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  is_active: boolean;
};

type DriverEntryRow = {
  id: string;
  event_car_id: string | null;
  event_id: string;
  car_id: string | null;
  driver_id: string;
  role: string;
  notes: string | null;
  created_at: string;
};

type EventSessionRow = {
  id: string;
  event_id: string;
  name: string;
  session_type: string;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  created_at: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

type CheckupGroup = {
  title: string;
  icon: ReactNode;
  items: string[];
};

function formatHours(value: number | null | undefined) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatEventDate(value: string | null | undefined) {
  if (!value) return "Data non disponibile";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT");
}

function formatLiters(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)} L`;
}

function normalizeRole(role: string | null | undefined) {
  if (!role) return "primary";
  return role;
}

function driverLabel(driver: DriverRow) {
  const full = `${driver.first_name} ${driver.last_name}`.trim();
  if (driver.nickname?.trim()) return `${full} (${driver.nickname.trim()})`;
  return full;
}

function getCheckupStyles(value: CheckStatus) {
  if (value === "OK") {
    return {
      card: "border-green-200 bg-green-50",
      badge: "bg-green-100 text-green-800",
      select: "border-green-300 text-green-800",
      dot: "bg-green-500",
    };
  }

  if (value === "Problema") {
    return {
      card: "border-red-200 bg-red-50",
      badge: "bg-red-100 text-red-700",
      select: "border-red-300 text-red-700",
      dot: "bg-red-500",
    };
  }

  return {
    card: "border-yellow-200 bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-800",
    select: "border-yellow-300 text-yellow-800",
    dot: "bg-yellow-500",
  };
}

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const [event, setEvent] = useState<EventRow | null>(null);
  const [circuit, setCircuit] = useState<CircuitRow | null>(null);
  const [car, setCar] = useState<CarRow | null>(null);
  const [eventCar, setEventCar] = useState<EventCarRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [setupExpanded, setSetupExpanded] = useState(true);
  const [checkupExpanded, setCheckupExpanded] = useState(false);
  const [turnsExpanded, setTurnsExpanded] = useState(false);
  const [fuelExpanded, setFuelExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [driversExpanded, setDriversExpanded] = useState(true);
  const [sessionsExpanded, setSessionsExpanded] = useState(true);

  const checkupGroups = useMemo<CheckupGroup[]>(
    () => [
      {
        title: "Sicurezza",
        icon: <ShieldCheck size={18} className="text-yellow-600" />,
        items: ["Serraggi", "Freni", "Ruote"],
      },
      {
        title: "Meccanica",
        icon: <Wrench size={18} className="text-yellow-600" />,
        items: ["Liquidi", "Cambio"],
      },
      {
        title: "Dinamica",
        icon: <Activity size={18} className="text-yellow-600" />,
        items: ["Sospensioni"],
      },
      {
        title: "Elettronica",
        icon: <Cpu size={18} className="text-yellow-600" />,
        items: ["Elettronica"],
      },
    ],
    []
  );

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [assignedDrivers, setAssignedDrivers] = useState<DriverEntryRow[]>([]);
  const [sessions, setSessions] = useState<EventSessionRow[]>([]);

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedDriverRole, setSelectedDriverRole] = useState("primary");
  const [assigningDriver, setAssigningDriver] = useState(false);

  const [sessionName, setSessionName] = useState("");
  const [sessionType, setSessionType] = useState("test");
  const [sessionStartsAt, setSessionStartsAt] = useState("");
  const [sessionEndsAt, setSessionEndsAt] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [savingSession, setSavingSession] = useState(false);

  const [checkup, setCheckup] = useState<Record<string, CheckStatus>>({});
  const [checkupSaving, setCheckupSaving] = useState(false);
  const [checkupTick, setCheckupTick] = useState(0);
  const [checkupHistory, setCheckupHistory] = useState<DataRow[]>([]);
  const [activeCheckupId, setActiveCheckupId] = useState<string | null>(null);
  const [lastCheckupTime, setLastCheckupTime] = useState<string | null>(null);

  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [newTurn, setNewTurn] = useState<{
    durata: string;
    giri: string;
    note: string;
    sessionId: string;
  }>({
    durata: "",
    giri: "",
    note: "",
    sessionId: "",
  });
  const [editingTurn, setEditingTurn] = useState<TurnRow | null>(null);
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

  const availableDrivers = useMemo(() => {
    const assignedIds = new Set(assignedDrivers.map((row) => row.driver_id));
    return drivers.filter((d) => d.is_active && !assignedIds.has(d.id));
  }, [drivers, assignedDrivers]);

  const assignedDriversDetailed = useMemo(() => {
    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    return assignedDrivers.map((entry) => ({
      ...entry,
      driver: driverMap.get(entry.driver_id) || null,
    }));
  }, [assignedDrivers, drivers]);

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
    } as Record<CheckStatus, number>;

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
  const criticalChecks = useMemo(() => statusCounts.Problema, [statusCounts]);

  const fuelUsed = useMemo(() => {
    if (fuelStart < 0 || fuelEnd < 0) return null;
    const used = fuelStart - fuelEnd;
    if (used < 0) return null;
    return used;
  }, [fuelStart, fuelEnd]);

  const fuelPerLap = useMemo(() => {
    if (lapsDone > 0 && fuelUsed !== null) {
      return fuelUsed > 0 ? fuelUsed / lapsDone : 0;
    }
    return 0;
  }, [fuelUsed, lapsDone]);

  const estimatedLapsRemaining = useMemo(() => {
    if (fuelPerLap > 0 && fuelEnd >= 0) {
      return fuelEnd / fuelPerLap;
    }
    return 0;
  }, [fuelPerLap, fuelEnd]);

  const fuelToAddRaw =
    lapsPlanned > 0 && fuelPerLap > 0 ? lapsPlanned * fuelPerLap - fuelEnd : 0;

  const fuelToAdd = Math.max(0, fuelToAddRaw);
  const notesLength = useMemo(() => notes.trim().length, [notes]);

  function resetTurnForm() {
    setNewTurn({ durata: "", giri: "", note: "", sessionId: "" });
    setEditingTurn(null);
  }

  async function loadAllData() {
    try {
      setLoading(true);
      const ctx = await getCurrentTeamContext();

      const [
        { data: eventData, error: eventError },
        { data: eventCarData, error: eventCarError },
        { data: driversData, error: driversError },
        { data: assignedDriversData, error: assignedDriversError },
        { data: sessionsData, error: sessionsError },
        { data: turnsData, error: turnsError },
        { data: checkLast, error: checkLastError },
        { data: checkHist, error: checkHistError },
        { data: fuelLast, error: fuelLastError },
        { data: fuelHist, error: fuelHistError },
        { data: notesLast, error: notesLastError },
        { data: notesHist, error: notesHistError },
      ] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, circuit_id")
          .eq("team_id", ctx.teamId)
          .eq("id", eventId)
          .single(),
        supabase
          .from("event_cars")
          .select("id, event_id, car_id, driver, notes, status")
          .eq("team_id", ctx.teamId)
          .eq("id", eventCarId)
          .single(),
        supabase
          .from("drivers")
          .select("id, first_name, last_name, nickname, is_active")
          .eq("team_id", ctx.teamId)
          .order("last_name", { ascending: true }),
        supabase
          .from("driver_event_entries")
          .select("id, event_car_id, event_id, car_id, driver_id, role, notes, created_at")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_sessions")
          .select("id, event_id, name, session_type, starts_at, ends_at, notes, created_at")
          .eq("team_id", ctx.teamId)
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_car_turns")
          .select("id, event_car_id, event_session_id, minutes, laps, notes, created_at")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .eq("section", "checkup")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .eq("section", "checkup")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .eq("section", "fuel")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .eq("section", "fuel")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .eq("section", "notes")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("event_car_data")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .eq("section", "notes")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (eventError) throw eventError;
      if (eventCarError) throw eventCarError;
      if (driversError) throw driversError;
      if (assignedDriversError) throw assignedDriversError;
      if (sessionsError) throw sessionsError;
      if (turnsError) throw turnsError;
      if (checkLastError) throw checkLastError;
      if (checkHistError) throw checkHistError;
      if (fuelLastError) throw fuelLastError;
      if (fuelHistError) throw fuelHistError;
      if (notesLastError) throw notesLastError;
      if (notesHistError) throw notesHistError;

      setEvent(eventData as EventRow);
      setEventCar(eventCarData as EventCarRow);
      setDrivers((driversData || []) as DriverRow[]);
      setAssignedDrivers((assignedDriversData || []) as DriverEntryRow[]);
      setSessions((sessionsData || []) as EventSessionRow[]);
      setTurns((turnsData || []) as TurnRow[]);

      const eventCarRow = eventCarData as EventCarRow;

      if (eventCarRow?.car_id) {
        const { data: carData, error: carError } = await supabase
          .from("cars")
          .select("id, name, hours")
          .eq("team_id", ctx.teamId)
          .eq("id", eventCarRow.car_id)
          .single();

        if (!carError && carData) {
          setCar(carData as CarRow);
        } else {
          setCar(null);
        }
      } else {
        setCar(null);
      }

      const eventRow = eventData as EventRow;
      if (eventRow?.circuit_id) {
        const { data: circuitData, error: circuitError } = await supabase
          .from("circuits")
          .select("id, name")
          .eq("team_id", ctx.teamId)
          .eq("id", eventRow.circuit_id)
          .single();

        if (!circuitError && circuitData) {
          setCircuit(circuitData as CircuitRow);
        } else {
          setCircuit(null);
        }
      } else {
        setCircuit(null);
      }

      if ((checkLast as DataRow | null)?.data) {
        setCheckup((checkLast as DataRow).data || {});
        setActiveCheckupId((checkLast as DataRow).id);
        setLastCheckupTime(new Date((checkLast as DataRow).created_at).toLocaleString());
      } else {
        setCheckup({});
        setActiveCheckupId(null);
        setLastCheckupTime(null);
      }
      setCheckupHistory((checkHist as DataRow[]) || []);

      if ((fuelLast as DataRow | null)?.data) {
        const data = (fuelLast as DataRow).data || {};
        setFuelStart(Number(data.fuelStart ?? 0));
        setFuelEnd(Number(data.fuelEnd ?? 0));
        setLapsDone(Number(data.lapsDone ?? 0));
        setLapsPlanned(Number(data.lapsPlanned ?? 0));
        setActiveFuelId((fuelLast as DataRow).id);
        setLastFuelTime(new Date((fuelLast as DataRow).created_at).toLocaleString());
      } else {
        setFuelStart(0);
        setFuelEnd(0);
        setLapsDone(0);
        setLapsPlanned(0);
        setActiveFuelId(null);
        setLastFuelTime(null);
      }
      setFuelHistory((fuelHist as DataRow[]) || []);

      if ((notesLast as DataRow | null)?.data?.text) {
        setNotes(String((notesLast as DataRow).data.text));
        setActiveNotesId((notesLast as DataRow).id);
        setLastNotesTime(new Date((notesLast as DataRow).created_at).toLocaleString());
      } else {
        setNotes("");
        setActiveNotesId(null);
        setLastNotesTime(null);
      }
      setNotesHistory((notesHist as DataRow[]) || []);
    } catch (error: any) {
      console.error(error);
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
    const ctx = await getCurrentTeamContext();
    const payload = {
      team_id: ctx.teamId,
      event_car_id: eventCarId,
      section,
      data,
    };
    const { error } = await supabase.from("event_car_data").insert([payload]);
    if (error) throw new Error(error.message);
  }

  async function deleteSectionRow(rowId: string, section: SectionType) {
    const ctx = await getCurrentTeamContext();

    const { error } = await supabase
      .from("event_car_data")
      .delete()
      .eq("id", rowId)
      .eq("team_id", ctx.teamId)
      .eq("event_car_id", eventCarId)
      .eq("section", section);

    if (error) throw new Error(error.message);

    const { data: hist, error: histError } = await supabase
      .from("event_car_data")
      .select("*")
      .eq("team_id", ctx.teamId)
      .eq("event_car_id", eventCarId)
      .eq("section", section)
      .order("created_at", { ascending: false })
      .limit(3);

    if (histError) throw new Error(histError.message);

    if (section === "checkup") setCheckupHistory((hist as DataRow[]) || []);
    if (section === "fuel") setFuelHistory((hist as DataRow[]) || []);
    if (section === "notes") setNotesHistory((hist as DataRow[]) || []);

    showToast("Eliminato");
  }

  async function assignDriverToEventCar() {
    if (!selectedDriverId || !eventCar?.event_id) {
      showToast("Seleziona un pilota", "error");
      return;
    }

    try {
      setAssigningDriver(true);
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.from("driver_event_entries").insert([
        {
          team_id: ctx.teamId,
          event_id: eventCar.event_id,
          event_car_id: eventCar.id,
          car_id: eventCar.car_id,
          driver_id: selectedDriverId,
          role: selectedDriverRole,
          notes: null,
        },
      ]);

      if (error) throw error;

      setSelectedDriverId("");
      setSelectedDriverRole("primary");
      showToast("Pilota assegnato");
      await loadAllData();
    } catch (error: any) {
      showToast(`Errore assegnazione pilota: ${error.message}`, "error");
    } finally {
      setAssigningDriver(false);
    }
  }

  async function removeDriverAssignment(assignmentId: string) {
    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase
        .from("driver_event_entries")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", assignmentId);

      if (error) throw error;

      showToast("Pilota rimosso");
      await loadAllData();
    } catch (error: any) {
      showToast(`Errore rimozione pilota: ${error.message}`, "error");
    }
  }

  async function createEventSession() {
    if (!sessionName.trim()) {
      showToast("Inserisci il nome sessione", "error");
      return;
    }

    try {
      setSavingSession(true);
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.from("event_sessions").insert([
        {
          team_id: ctx.teamId,
          event_id: eventId,
          name: sessionName.trim(),
          session_type: sessionType,
          starts_at: sessionStartsAt || null,
          ends_at: sessionEndsAt || null,
          notes: sessionNotes.trim() || null,
        },
      ]);

      if (error) throw error;

      setSessionName("");
      setSessionType("test");
      setSessionStartsAt("");
      setSessionEndsAt("");
      setSessionNotes("");

      showToast("Sessione creata");
      await loadAllData();
    } catch (error: any) {
      showToast(`Errore creazione sessione: ${error.message}`, "error");
    } finally {
      setSavingSession(false);
    }
  }

  async function deleteEventSession(sessionId: string) {
    if (!confirm("Vuoi eliminare questa sessione?")) return;

    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase
        .from("event_sessions")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", sessionId);

      if (error) throw error;

      showToast("Sessione eliminata");
      await loadAllData();
    } catch (error: any) {
      showToast(`Errore eliminazione sessione: ${error.message}`, "error");
    }
  }

  async function onSaveCheckup() {
    try {
      setCheckupSaving(true);
      await saveSection("checkup", checkup);

      const ctx = await getCurrentTeamContext();
      const { data } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .eq("section", "checkup")
        .order("created_at", { ascending: false })
        .limit(3);

      setCheckupHistory((data as DataRow[]) || []);
      setCheckupTick((t) => t + 1);
      setLastCheckupTime(new Date().toLocaleString());
      showToast("Check-up salvato");
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

  async function saveTurn() {
    if (!newTurn.durata) {
      showToast("Inserisci la durata del turno", "error");
      return;
    }

    const minutes = Number(newTurn.durata);
    const laps = Number(newTurn.giri) || 0;
    const noteText = newTurn.note || "";
    const sessionId = newTurn.sessionId || null;
    const isEditing = Boolean(editingTurn);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      showToast("La durata deve essere maggiore di zero", "error");
      return;
    }

    try {
      setTurnsSaving(true);
      const ctx = await getCurrentTeamContext();

      if (isEditing && editingTurn) {
        const { data, error } = await supabase
          .from("event_car_turns")
          .update({
            event_session_id: sessionId,
            minutes,
            laps,
            notes: noteText,
          })
          .eq("id", editingTurn.id)
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .select("id")
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new Error("Nessun turno aggiornato");

        showToast("Turno aggiornato");
      } else {
        const { data, error } = await supabase
          .from("event_car_turns")
          .insert([
            {
              team_id: ctx.teamId,
              event_car_id: eventCarId,
              event_session_id: sessionId,
              minutes,
              laps,
              notes: noteText,
            },
          ])
          .select("id")
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Errore salvataggio turno");
        }

        showToast("Turno aggiunto");
      }

      resetTurnForm();
      await loadAllData();
    } catch (e: any) {
      showToast(`Errore salvataggio turno: ${e.message}`, "error");
    } finally {
      setTurnsSaving(false);
    }
  }

  async function deleteTurn(turnId: string) {
    if (!confirm("Vuoi eliminare questo turno?")) return;

    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase
        .from("event_car_turns")
        .delete()
        .eq("id", turnId)
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId);

      if (error) {
        showToast(`Errore eliminazione turno: ${error.message}`, "error");
        return;
      }

      if (editingTurn?.id === turnId) {
        resetTurnForm();
      }

      await loadAllData();
      showToast("Turno eliminato");
    } catch (e: any) {
      showToast(`Errore eliminazione turno: ${e.message}`, "error");
    }
  }

  async function onSaveFuel() {
    try {
      setFuelSaving(true);
      const data = { fuelStart, fuelEnd, lapsDone, lapsPlanned };
      await saveSection("fuel", data);

      const ctx = await getCurrentTeamContext();
      const { data: hist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .eq("section", "fuel")
        .order("created_at", { ascending: false })
        .limit(3);

      setFuelHistory((hist as DataRow[]) || []);
      setFuelTick((t) => t + 1);
      setLastFuelTime(new Date().toLocaleString());
      showToast("Carburante salvato");
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

      const ctx = await getCurrentTeamContext();
      const { data: hist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .eq("section", "notes")
        .order("created_at", { ascending: false })
        .limit(3);

      setNotesHistory((hist as DataRow[]) || []);
      setNotesTick((t) => t + 1);
      setLastNotesTime(new Date().toLocaleString());
      showToast("Note salvate");
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
      <div className="card-base p-10 text-center text-neutral-500">
        <div className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" />
          Caricamento dati...
        </div>
      </div>
    );
  }

  if (!event || !car || !eventCar) {
    return (
      <div className="card-base p-10 text-center text-red-600 font-semibold">
        Errore: dati non trovati.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-yellow-200/90 mb-2">
                <Flag size={15} />
                <span>{formatEventDate(event.date)}</span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold flex flex-wrap items-center gap-2">
                <CarFront size={24} />
                <span>{car.name}</span>
                <span className="text-yellow-300">–</span>
                <span>{event.name}</span>
              </h1>

              <p className="text-yellow-200/90 text-sm mt-2">
                Gestione tecnica evento
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {overallStatus === "OK" && (
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-semibold">
                    Auto OK
                  </span>
                )}
                {overallStatus === "Da controllare" && (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-3 py-1 text-xs font-semibold">
                    Check-up da completare
                  </span>
                )}
                {overallStatus === "Problema" && (
                  <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold">
                    Problema tecnico segnalato
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm text-yellow-100/80">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <MapPin size={14} />
                  {circuit?.name || "Autodromo non specificato"}
                </span>
              </div>
            </div>

            <Link href={`/calendar/${eventId}`} className="btn-secondary self-start">
              <ArrowLeft size={16} /> Torna all’evento
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Clock3 size={18} className="text-yellow-600" />}
              label="Ore auto attuali"
              value={formatHours(car.hours)}
            />
            <SummaryCard
              icon={<Flag size={18} className="text-yellow-600" />}
              label="Turni evento"
              value={String(totalTurns)}
            />
            <SummaryCard
              icon={<ClipboardCheck size={18} className="text-yellow-600" />}
              label="Stato check-up"
              value={overallStatus}
              valueClassName={
                overallStatus === "OK"
                  ? "text-green-700"
                  : overallStatus === "Problema"
                  ? "text-red-700"
                  : "text-yellow-700"
              }
            />
            <SummaryCard
              icon={<TriangleAlert size={18} className="text-yellow-600" />}
              label="Criticità"
              value={String(criticalChecks)}
              valueClassName={criticalChecks > 0 ? "text-red-700" : "text-green-700"}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card-base p-5 md:p-6">
          <SectionHeader
            title="Piloti assegnati"
            subtitle="Associa uno o più piloti a questa auto evento"
            icon={<UserRound className="text-yellow-500" />}
            expanded={driversExpanded}
            onToggle={() => setDriversExpanded((v) => !v)}
          />

          {driversExpanded ? (
            <>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="input-base"
                  >
                    <option value="">— Seleziona pilota —</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driverLabel(driver)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDriverRole}
                    onChange={(e) => setSelectedDriverRole(e.target.value)}
                    className="input-base"
                  >
                    <option value="primary">Primary</option>
                    <option value="co_driver">Co-driver</option>
                    <option value="reserve">Reserve</option>
                  </select>

                  <button
                    onClick={assignDriverToEventCar}
                    disabled={assigningDriver}
                    className="btn-primary"
                  >
                    {assigningDriver ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <PlusCircle size={16} />
                    )}
                    Aggiungi
                  </button>
                </div>
              </div>

              {assignedDriversDetailed.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
                  Nessun pilota assegnato a questa auto.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignedDriversDetailed.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-neutral-900">
                          {entry.driver ? driverLabel(entry.driver) : "Pilota non trovato"}
                        </div>
                        <div className="text-sm text-neutral-500 mt-1">
                          Ruolo: {normalizeRole(entry.role)}
                        </div>
                      </div>

                      <button
                        onClick={() => removeDriverAssignment(entry.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 text-white px-4 py-2 font-semibold"
                      >
                        <Trash2 size={16} />
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">
              {assignedDrivers.length} piloti assegnati
            </div>
          )}
        </section>

        <section className="card-base p-5 md:p-6">
          <SectionHeader
            title="Sessioni evento"
            subtitle="Crea e organizza test, libere, qualifica, gara e stint"
            icon={<CalendarDays className="text-yellow-500" />}
            expanded={sessionsExpanded}
            onToggle={() => setSessionsExpanded((v) => !v)}
          />

          {sessionsExpanded ? (
            <>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 mb-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="input-base"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Nome sessione"
                  />

                  <select
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value)}
                    className="input-base"
                  >
                    <option value="test">Test</option>
                    <option value="prove_libere">Prove libere</option>
                    <option value="qualifica">Qualifica</option>
                    <option value="gara">Gara</option>
                    <option value="stint">Stint</option>
                    <option value="warmup">Warmup</option>
                  </select>

                  <input
                    type="datetime-local"
                    className="input-base"
                    value={sessionStartsAt}
                    onChange={(e) => setSessionStartsAt(e.target.value)}
                  />

                  <input
                    type="datetime-local"
                    className="input-base"
                    value={sessionEndsAt}
                    onChange={(e) => setSessionEndsAt(e.target.value)}
                  />
                </div>

                <textarea
                  className="input-base min-h-[100px]"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Note sessione..."
                />

                <button
                  onClick={createEventSession}
                  disabled={savingSession}
                  className="btn-primary self-start"
                >
                  {savingSession ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <PlusCircle size={16} />
                  )}
                  Crea sessione
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
                  Nessuna sessione creata.
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="font-bold text-neutral-900">{session.name}</div>
                          <div className="text-sm text-neutral-500 mt-1">
                            Tipo: {session.session_type}
                          </div>
                        </div>

                        <button
                          onClick={() => deleteEventSession(session.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 text-white px-4 py-2 font-semibold"
                        >
                          <Trash2 size={16} />
                          Elimina
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <MiniInfoCard label="Inizio" value={formatDateTime(session.starts_at)} />
                        <MiniInfoCard label="Fine" value={formatDateTime(session.ends_at)} />
                      </div>

                      {session.notes ? (
                        <div className="text-sm text-neutral-700 whitespace-pre-line">
                          {session.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">{sessions.length} sessioni create</div>
          )}
        </section>
      </section>

      <section className="card-base p-5 md:p-6">
        <SectionHeader
          title="Assetto"
          subtitle="Scheda tecnica completa setup"
          icon={<Gauge className="text-yellow-500" />}
          expanded={setupExpanded}
          onToggle={() => setSetupExpanded((v) => !v)}
        />

        {setupExpanded ? (
          <SetupScheda eventCarId={eventCarId} />
        ) : (
          <div className="text-sm text-gray-500">Vista sintetica</div>
        )}
      </section>

      <section id="checkup-section" className="card-base p-5 md:p-6">
        <SectionHeader
          title="Check-up tecnico"
          subtitle="Controlli divisi per area per leggere tutto più velocemente in pista"
          icon={<ClipboardCheck className="text-yellow-500" />}
          expanded={checkupExpanded}
          onToggle={() => setCheckupExpanded((v) => !v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatusSummaryCard title="Controlli OK" value={statusCounts.OK} tone="green" />
          <StatusSummaryCard
            title="Da controllare"
            value={statusCounts["Da controllare"]}
            tone="yellow"
          />
          <StatusSummaryCard title="Problemi" value={statusCounts.Problema} tone="red" />
        </div>

        {checkupExpanded ? (
          <>
            <div className="mb-5 rounded-xl border bg-gray-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2 text-base font-semibold">
                {overallStatus === "OK" && (
                  <span className="text-green-700">Tutti i controlli OK</span>
                )}
                {overallStatus === "Da controllare" && (
                  <span className="text-yellow-700">Check-up da completare</span>
                )}
                {overallStatus === "Problema" && (
                  <span className="text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> Problema rilevato
                  </span>
                )}
              </div>

              {lastCheckupTime && (
                <div className="text-xs text-gray-500">
                  Ultimo salvataggio: {lastCheckupTime}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 mb-5">
              {checkupGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-gray-200 p-4 md:p-5 bg-gray-50"
                >
                  <div className="flex items-center gap-2 mb-4">
                    {group.icon}
                    <h3 className="text-base font-bold text-gray-800">{group.title}</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {group.items.map((item) => {
                      const value: CheckStatus = checkup[item] || "Da controllare";
                      const styles = getCheckupStyles(value);

                      return (
                        <div
                          key={item}
                          className={`rounded-2xl border p-4 ${styles.card}`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
                                <h4 className="font-bold text-gray-900">{item}</h4>
                              </div>
                              <div className="mt-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles.badge}`}
                                >
                                  {value}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <select
                              value={value}
                              onChange={(e) =>
                                setCheckup((s) => ({
                                  ...s,
                                  [item]: e.target.value as CheckStatus,
                                }))
                              }
                              className={`flex-1 border rounded-xl p-3 text-sm bg-white font-semibold ${styles.select}`}
                            >
                              <option>OK</option>
                              <option>Da controllare</option>
                              <option>Problema</option>
                            </select>

                            {value === "Problema" && (
                              <button
                                onClick={() =>
                                  showToast(`Segnalazione manutenzione per: ${item} (da collegare)`)
                                }
                                className="px-4 py-3 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold"
                              >
                                Crea manutenzione
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mb-2">
              <button
                onClick={onSaveCheckup}
                disabled={checkupSaving}
                className="btn-primary"
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
          <div className="text-sm text-gray-500">
            {statusCounts.OK} OK • {statusCounts["Da controllare"]} da controllare •{" "}
            {statusCounts.Problema} problemi
          </div>
        )}
      </section>

      <section className="card-base p-5 md:p-6">
        <SectionHeader
          title="Turni svolti"
          subtitle="Gestione turni, modifiche rapide e riepilogo ore evento"
          icon={<Clock3 className="text-yellow-500" />}
          expanded={turnsExpanded}
          onToggle={() => setTurnsExpanded((v) => !v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <SummaryCard
            icon={<Flag size={18} className="text-yellow-600" />}
            label="Turni totali"
            value={String(totalTurns)}
          />
          <SummaryCard
            icon={<Clock3 size={18} className="text-yellow-600" />}
            label="Minuti totali"
            value={String(totalMinutes)}
          />
          <SummaryCard
            icon={<Clock3 size={18} className="text-yellow-600" />}
            label="Ore evento"
            value={`${totalHours.toFixed(2)} h`}
            valueClassName="text-yellow-800"
            cardClassName="bg-yellow-50 border-yellow-300"
          />
        </div>

        {turnsExpanded ? (
          <>
            {editingTurn && (
              <div className="mb-4 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 font-semibold">
                Stai modificando un turno esistente. Salva le modifiche oppure annulla.
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 overflow-hidden mb-5">
              <div className="hidden md:grid grid-cols-12 bg-gray-100 text-gray-700 text-sm font-semibold">
                <div className="col-span-1 p-3 text-center">#</div>
                <div className="col-span-2 p-3 text-center">Sessione</div>
                <div className="col-span-2 p-3 text-center">Durata</div>
                <div className="col-span-2 p-3 text-center">Giri</div>
                <div className="col-span-3 p-3">Note</div>
                <div className="col-span-2 p-3 text-center">Azioni</div>
              </div>

              {turns.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nessun turno registrato</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {turns.map((t, i) => {
                    const session = sessions.find((s) => s.id === t.event_session_id);
                    return (
                      <div key={t.id}>
                        <div className="hidden md:grid grid-cols-12 items-center text-sm bg-white">
                          <div className="col-span-1 p-3 text-center font-semibold text-gray-700">
                            {i + 1}
                          </div>
                          <div className="col-span-2 p-3 text-center">
                            {session?.name || "—"}
                          </div>
                          <div className="col-span-2 p-3 text-center">{t.minutes} min</div>
                          <div className="col-span-2 p-3 text-center">{t.laps}</div>
                          <div className="col-span-3 p-3 text-gray-700">{t.notes || "—"}</div>
                          <div className="col-span-2 p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingTurn(t);
                                  setNewTurn({
                                    durata: String(t.minutes ?? ""),
                                    giri: String(t.laps ?? ""),
                                    note: t.notes || "",
                                    sessionId: t.event_session_id || "",
                                  });
                                }}
                                className="px-3 py-2 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs font-semibold"
                              >
                                Modifica
                              </button>

                              <button
                                onClick={() => deleteTurn(t.id)}
                                className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold"
                              >
                                Elimina
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="md:hidden p-4 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-gray-900">Turno #{i + 1}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {session?.name || "Nessuna sessione"} • {t.minutes} min • {t.laps} giri
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 text-sm text-gray-700">
                            <span className="font-semibold">Note:</span> {t.notes || "—"}
                          </div>

                          <div className="mt-4 flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => {
                                setEditingTurn(t);
                                setNewTurn({
                                  durata: String(t.minutes ?? ""),
                                  giri: String(t.laps ?? ""),
                                  note: t.notes || "",
                                  sessionId: t.event_session_id || "",
                                });
                              }}
                              className="flex-1 px-3 py-2 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm font-semibold"
                            >
                              Modifica
                            </button>

                            <button
                              onClick={() => deleteTurn(t.id)}
                              className="flex-1 px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold"
                            >
                              Elimina
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5">
              <h3 className="text-base font-bold text-gray-800 mb-4">
                {editingTurn ? "Modifica turno" : "Aggiungi nuovo turno"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Sessione
                  </label>
                  <select
                    value={newTurn.sessionId}
                    onChange={(e) => setNewTurn({ ...newTurn, sessionId: e.target.value })}
                    className="border rounded-xl p-3 text-sm w-full bg-white"
                  >
                    <option value="">— Nessuna —</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Durata (minuti)
                  </label>
                  <input
                    type="number"
                    placeholder="Es. 20"
                    value={newTurn.durata}
                    onChange={(e) => setNewTurn({ ...newTurn, durata: e.target.value })}
                    className="border rounded-xl p-3 text-sm w-full bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Giri
                  </label>
                  <input
                    type="number"
                    placeholder="Es. 12"
                    value={newTurn.giri}
                    onChange={(e) => setNewTurn({ ...newTurn, giri: e.target.value })}
                    className="border rounded-xl p-3 text-sm w-full bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Note
                  </label>
                  <input
                    type="text"
                    placeholder="Annotazioni turno"
                    value={newTurn.note}
                    onChange={(e) => setNewTurn({ ...newTurn, note: e.target.value })}
                    className="border rounded-xl p-3 text-sm w-full bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={saveTurn}
                  disabled={turnsSaving}
                  className="btn-primary"
                >
                  {turnsSaving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : editingTurn ? (
                    <Save size={16} />
                  ) : (
                    <PlusCircle size={16} />
                  )}
                  {editingTurn ? "Salva modifica" : "Aggiungi turno"}
                </button>

                {editingTurn && (
                  <button
                    onClick={resetTurnForm}
                    type="button"
                    className="btn-secondary"
                  >
                    Annulla modifica
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">
            {totalTurns} turni registrati • {totalHours.toFixed(2)} ore totali
          </div>
        )}
      </section>

      <section className="card-base p-5 md:p-6">
        <SectionHeader
          title="Gestione carburante"
          subtitle="Analisi consumo, autonomia residua e carburante da aggiungere"
          icon={<Fuel className="text-yellow-500" />}
          expanded={fuelExpanded}
          onToggle={() => setFuelExpanded((v) => !v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <SummaryCard
            icon={<Droplets size={18} className="text-yellow-600" />}
            label="Consumato"
            value={fuelUsed !== null ? formatLiters(fuelUsed, 1) : "—"}
          />
          <SummaryCard
            icon={<Fuel size={18} className="text-yellow-600" />}
            label="Consumo medio/giro"
            value={fuelPerLap > 0 ? `${fuelPerLap.toFixed(2)} L` : "—"}
          />
          <SummaryCard
            icon={<Flag size={18} className="text-yellow-600" />}
            label="Autonomia residua"
            value={estimatedLapsRemaining > 0 ? `${estimatedLapsRemaining.toFixed(1)} giri` : "—"}
          />
          <SummaryCard
            icon={<TriangleAlert size={18} className="text-yellow-600" />}
            label="Da aggiungere"
            value={fuelToAdd > 0 ? formatLiters(fuelToAdd, 1) : "—"}
            valueClassName={fuelToAdd > 0 ? "text-yellow-700" : "text-green-700"}
          />
        </div>

        {fuelExpanded ? (
          <>
            <div className="mb-5 rounded-xl border bg-gray-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-col sm:flex-row gap-4 text-sm font-semibold">
                <span className="text-gray-700">
                  Consumo medio:{" "}
                  <span className="text-gray-900">
                    {fuelPerLap > 0 ? `${fuelPerLap.toFixed(2)} L/giro` : "—"}
                  </span>
                </span>
                <span className="text-gray-700">
                  Carburante da aggiungere:{" "}
                  <span className="text-yellow-700">
                    {fuelToAdd > 0 ? `${fuelToAdd.toFixed(1)} L` : "—"}
                  </span>
                </span>
              </div>

              {lastFuelTime && (
                <div className="text-xs text-gray-500">
                  Ultimo salvataggio: {lastFuelTime}
                </div>
              )}
            </div>

            {fuelUsed === null && fuelStart >= 0 && fuelEnd >= 0 && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">
                Attenzione: il carburante residuo è maggiore di quello iniziale. Verifica i dati inseriti.
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5 mb-5">
              <h3 className="text-base font-bold text-gray-800 mb-4">
                Dati sessione e previsione
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <NumberCard label="Carburante iniziale (L)" value={fuelStart} setValue={setFuelStart} />
                <NumberCard label="Carburante residuo (L)" value={fuelEnd} setValue={setFuelEnd} />
                <NumberCard label="Giri effettuati" value={lapsDone} setValue={setLapsDone} integer />
                <NumberCard
                  label="Giri previsti prossimo turno"
                  value={lapsPlanned}
                  setValue={setLapsPlanned}
                  integer
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <ReadOnlyCard
                  label="Carburante consumato"
                  value={fuelUsed !== null ? formatLiters(fuelUsed, 1) : "—"}
                />
                <ReadOnlyCard
                  label="Consumo medio a giro"
                  value={fuelPerLap > 0 ? `${fuelPerLap.toFixed(2)} L/giro` : "—"}
                />
                <ReadOnlyCard
                  label="Autonomia residua"
                  value={estimatedLapsRemaining > 0 ? `${estimatedLapsRemaining.toFixed(1)} giri` : "—"}
                />
                <HighlightCard
                  label="Carburante da aggiungere"
                  value={fuelToAdd > 0 ? formatLiters(fuelToAdd, 1) : "—"}
                />
              </div>
            </div>

            <div className="flex justify-center mb-2">
              <button
                onClick={onSaveFuel}
                disabled={fuelSaving}
                className="btn-primary"
              >
                {fuelSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salva carburante
                <CheckCircle2
                  size={18}
                  className={`transition-opacity ${fuelTick ? "opacity-100" : "opacity-0"}`}
                />
              </button>
            </div>

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
          <div className="text-sm text-gray-500">
            {fuelPerLap > 0 ? `${fuelPerLap.toFixed(2)} L/giro` : "Consumo non calcolabile"} •{" "}
            {fuelToAdd > 0 ? `${fuelToAdd.toFixed(1)} L da aggiungere` : "nessun rabbocco stimato"}
          </div>
        )}
      </section>

      <section className="card-base p-5 md:p-6">
        <SectionHeader
          title="Note e osservazioni"
          subtitle="Annotazioni pilota, problemi emersi, modifiche da ricordare e feedback pista"
          icon={<StickyNote className="text-yellow-500" />}
          expanded={notesExpanded}
          onToggle={() => setNotesExpanded((v) => !v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <SummaryCard
            icon={<FileText size={18} className="text-yellow-600" />}
            label="Lunghezza note"
            value={`${notesLength} caratteri`}
          />
          <SummaryCard
            icon={<StickyNote size={18} className="text-yellow-600" />}
            label="Stato contenuto"
            value={notesLength > 0 ? "Compilate" : "Vuote"}
            valueClassName={notesLength > 0 ? "text-green-700" : "text-yellow-700"}
          />
          <SummaryCard
            icon={<Clock3 size={18} className="text-yellow-600" />}
            label="Ultimo salvataggio"
            value={lastNotesTime || "—"}
            valueClassName="text-gray-900 text-sm"
          />
        </div>

        {notesExpanded ? (
          <>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-800">Taccuino evento</h3>
                <span className="text-xs text-gray-500">{notesLength} caratteri</span>
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Annota eventuali problemi, sensazioni del pilota, modifiche da fare, condizioni pista, meteo, comportamento vettura..."
                className="border rounded-xl p-4 w-full bg-white min-h-[180px]"
                rows={7}
              />

              <div className="mt-3 text-xs text-gray-500">
                Suggerimento: usa le note per segnare comportamento vettura, consumo gomme, correzioni assetto e lavori da fare prima del prossimo turno.
              </div>
            </div>

            <div className="flex justify-center mb-2">
              <button
                onClick={onSaveNotes}
                disabled={notesSaving}
                className="btn-primary"
              >
                {notesSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salva Note
                <CheckCircle2
                  size={18}
                  className={`transition-opacity ${notesTick ? "opacity-100" : "opacity-0"}`}
                />
              </button>
            </div>

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
          <div className="text-sm text-gray-500">
            {notesLength > 0
              ? `${notesLength} caratteri salvati nelle note evento`
              : "Nessuna annotazione presente"}
          </div>
        )}
      </section>

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-lg font-semibold ${
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

function SectionHeader({
  title,
  subtitle,
  icon,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          {icon} {title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>

      <button
        onClick={onToggle}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
      >
        {expanded ? "Vista sintetica" : "Dettagli"}
      </button>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-gray-900",
  cardClassName = "bg-gray-50 border-neutral-200",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  cardClassName?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${cardClassName}`}>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold mt-2 ${valueClassName}`}>{value}</div>
    </div>
  );
}

function StatusSummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "green" | "yellow" | "red";
}) {
  const classes =
    tone === "green"
      ? {
          box: "bg-green-50 border-green-200",
          title: "text-green-700",
          value: "text-green-800",
        }
      : tone === "red"
      ? {
          box: "bg-red-50 border-red-200",
          title: "text-red-700",
          value: "text-red-800",
        }
      : {
          box: "bg-yellow-50 border-yellow-200",
          title: "text-yellow-700",
          value: "text-yellow-800",
        };

  return (
    <div className={`rounded-xl border p-4 ${classes.box}`}>
      <div className={`text-xs uppercase tracking-wide ${classes.title}`}>{title}</div>
      <div className={`text-2xl font-bold mt-1 ${classes.value}`}>{value}</div>
    </div>
  );
}

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
                    <span className="text-green-700 font-semibold">Aperto</span>
                  ) : (
                    <button onClick={() => onOpen(r)} className="text-yellow-600 font-semibold">
                      Apri
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
        className="border rounded-xl p-3 w-full text-center bg-white"
      />
    </div>
  );
}

function ReadOnlyCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="border rounded-xl p-3 bg-white text-center font-semibold">{value}</div>
    </div>
  );
}

function HighlightCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="rounded-xl p-3 text-center font-bold text-black text-xl bg-yellow-400 border-2 border-yellow-600 shadow-inner">
        {value}
      </div>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900 break-words">{value}</div>
    </div>
  );
}