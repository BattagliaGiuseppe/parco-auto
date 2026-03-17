"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { Audiowide } from "next/font/google";
import {
  ArrowLeft,
  CalendarDays,
  CarFront,
  FileText,
  Fuel,
  Loader2,
  MapPin,
  PlusCircle,
  Save,
  Settings2,
  StickyNote,
  TimerReset,
  Trash2,
  TriangleAlert,
  UserRound,
  Wrench,
} from "lucide-react";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type EventCarRow = {
  id: string;
  event_id: string | null;
  car_id: string | null;
  driver: string | null;
  status: string | null;
  notes: string | null;
};

type EventRow = {
  id: string;
  name: string;
  date: string | null;
  notes: string | null;
  circuit_id: string | null;
};

type CircuitRow = {
  id: string;
  name: string;
};

type CarRow = {
  id: string;
  name: string;
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

type EventCarTurnRow = {
  id: string;
  event_car_id: string;
  date: string;
  minutes: number;
  laps: number;
  notes: string | null;
  created_at: string;
};

type EventCarDataRow = {
  id: string;
  event_car_id: string;
  section: "checkup" | "fuel" | "notes" | "setup";
  data: any;
  created_at: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT");
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

export default function EventCarDetailPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const eventCarId = params?.eventCarId as string;

  const [loading, setLoading] = useState(true);

  const [eventCar, setEventCar] = useState<EventCarRow | null>(null);
  const [eventRow, setEventRow] = useState<EventRow | null>(null);
  const [circuit, setCircuit] = useState<CircuitRow | null>(null);
  const [car, setCar] = useState<CarRow | null>(null);

  const [teamDrivers, setTeamDrivers] = useState<DriverRow[]>([]);
  const [assignedDrivers, setAssignedDrivers] = useState<DriverEntryRow[]>([]);
  const [eventSessions, setEventSessions] = useState<EventSessionRow[]>([]);
  const [turns, setTurns] = useState<EventCarTurnRow[]>([]);
  const [eventDataRows, setEventDataRows] = useState<EventCarDataRow[]>([]);

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedDriverRole, setSelectedDriverRole] = useState("primary");
  const [assigningDriver, setAssigningDriver] = useState(false);

  const [sessionName, setSessionName] = useState("");
  const [sessionType, setSessionType] = useState("test");
  const [sessionStartsAt, setSessionStartsAt] = useState("");
  const [sessionEndsAt, setSessionEndsAt] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [savingSession, setSavingSession] = useState(false);

  const [turnDate, setTurnDate] = useState("");
  const [turnMinutes, setTurnMinutes] = useState("");
  const [turnLaps, setTurnLaps] = useState("");
  const [turnNotes, setTurnNotes] = useState("");
  const [savingTurn, setSavingTurn] = useState(false);

  const [checkBrakes, setCheckBrakes] = useState(false);
  const [checkEngine, setCheckEngine] = useState(false);
  const [checkGearbox, setCheckGearbox] = useState(false);
  const [checkElectronics, setCheckElectronics] = useState(false);
  const [checkNotes, setCheckNotes] = useState("");
  const [savingCheckup, setSavingCheckup] = useState(false);

  const [fuelStart, setFuelStart] = useState("");
  const [fuelEnd, setFuelEnd] = useState("");
  const [fuelLapsDone, setFuelLapsDone] = useState("");
  const [fuelNotes, setFuelNotes] = useState("");
  const [savingFuel, setSavingFuel] = useState(false);

  const [setupFrontPressure, setSetupFrontPressure] = useState("");
  const [setupRearPressure, setSetupRearPressure] = useState("");
  const [setupRideHeight, setSetupRideHeight] = useState("");
  const [setupWingAngle, setSetupWingAngle] = useState("");
  const [setupNotes, setSetupNotes] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);

  const [genericNotes, setGenericNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

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

  const latestSectionData = useMemo(() => {
    const map = new Map<string, EventCarDataRow>();

    for (const row of eventDataRows) {
      if (!map.has(row.section)) {
        map.set(row.section, row);
      }
    }

    return {
      checkup: map.get("checkup") || null,
      fuel: map.get("fuel") || null,
      setup: map.get("setup") || null,
      notes: map.get("notes") || null,
    };
  }, [eventDataRows]);

  const assignedDriversDetailed = useMemo(() => {
    const driversMap = new Map(teamDrivers.map((d) => [d.id, d]));
    return assignedDrivers.map((entry) => ({
      ...entry,
      driver: driversMap.get(entry.driver_id) || null,
    }));
  }, [assignedDrivers, teamDrivers]);

  const availableDrivers = useMemo(() => {
    const assignedIds = new Set(assignedDrivers.map((row) => row.driver_id));
    return teamDrivers.filter((driver) => driver.is_active && !assignedIds.has(driver.id));
  }, [teamDrivers, assignedDrivers]);

  const loadData = async () => {
    if (!eventCarId || !eventId) return;

    try {
      setLoading(true);
      const ctx = await getCurrentTeamContext();

      const [
        { data: eventCarData, error: eventCarError },
        { data: driversData, error: driversError },
        { data: assignedDriversData, error: assignedDriversError },
        { data: sessionsData, error: sessionsError },
        { data: turnsData, error: turnsError },
        { data: eventCarDataRowsData, error: eventCarDataRowsError },
      ] = await Promise.all([
        supabase
          .from("event_cars")
          .select("id, event_id, car_id, driver, status, notes")
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
          .select("id, event_car_id, date, minutes, laps, notes, created_at")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: false }),
        supabase
          .from("event_car_data")
          .select("id, event_car_id, section, data, created_at")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: false }),
      ]);

      if (eventCarError) throw eventCarError;
      if (driversError) throw driversError;
      if (assignedDriversError) throw assignedDriversError;
      if (sessionsError) throw sessionsError;
      if (turnsError) throw turnsError;
      if (eventCarDataRowsError) throw eventCarDataRowsError;

      const eventCarRow = eventCarData as EventCarRow;
      setEventCar(eventCarRow);
      setTeamDrivers((driversData || []) as DriverRow[]);
      setAssignedDrivers((assignedDriversData || []) as DriverEntryRow[]);
      setEventSessions((sessionsData || []) as EventSessionRow[]);
      setTurns((turnsData || []) as EventCarTurnRow[]);
      setEventDataRows((eventCarDataRowsData || []) as EventCarDataRow[]);

      const latestCheckup = (eventCarDataRowsData || []).find((row: any) => row.section === "checkup");
      const latestFuel = (eventCarDataRowsData || []).find((row: any) => row.section === "fuel");
      const latestSetup = (eventCarDataRowsData || []).find((row: any) => row.section === "setup");
      const latestNotes = (eventCarDataRowsData || []).find((row: any) => row.section === "notes");

      if (latestCheckup?.data) {
        setCheckBrakes(Boolean(latestCheckup.data.brakes));
        setCheckEngine(Boolean(latestCheckup.data.engine));
        setCheckGearbox(Boolean(latestCheckup.data.gearbox));
        setCheckElectronics(Boolean(latestCheckup.data.electronics));
        setCheckNotes(latestCheckup.data.notes || "");
      }

      if (latestFuel?.data) {
        setFuelStart(latestFuel.data.fuelStart?.toString?.() || "");
        setFuelEnd(latestFuel.data.fuelEnd?.toString?.() || "");
        setFuelLapsDone(latestFuel.data.lapsDone?.toString?.() || "");
        setFuelNotes(latestFuel.data.notes || "");
      }

      if (latestSetup?.data) {
        setSetupFrontPressure(latestSetup.data.frontPressure?.toString?.() || "");
        setSetupRearPressure(latestSetup.data.rearPressure?.toString?.() || "");
        setSetupRideHeight(latestSetup.data.rideHeight?.toString?.() || "");
        setSetupWingAngle(latestSetup.data.wingAngle?.toString?.() || "");
        setSetupNotes(latestSetup.data.notes || "");
      }

      if (latestNotes?.data) {
        setGenericNotes(latestNotes.data.notes || "");
      }

      if (eventCarRow.event_id) {
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("id, name, date, notes, circuit_id")
          .eq("team_id", ctx.teamId)
          .eq("id", eventCarRow.event_id)
          .single();

        if (!eventError && eventData) {
          setEventRow(eventData as EventRow);

          const circuitId = (eventData as EventRow).circuit_id;
          if (circuitId) {
            const { data: circuitData } = await supabase
              .from("circuits")
              .select("id, name")
              .eq("team_id", ctx.teamId)
              .eq("id", circuitId)
              .single();

            if (circuitData) {
              setCircuit(circuitData as CircuitRow);
            } else {
              setCircuit(null);
            }
          } else {
            setCircuit(null);
          }
        } else {
          setEventRow(null);
          setCircuit(null);
        }
      }

      if (eventCarRow.car_id) {
        const { data: carData } = await supabase
          .from("cars")
          .select("id, name")
          .eq("team_id", ctx.teamId)
          .eq("id", eventCarRow.car_id)
          .single();

        if (carData) {
          setCar(carData as CarRow);
        } else {
          setCar(null);
        }
      } else {
        setCar(null);
      }
    } catch (error: any) {
      console.error("Errore caricamento auto evento:", error);
      showToast(error.message || "Errore caricamento dati", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId, eventCarId]);

  const assignDriverToEventCar = async () => {
    if (!selectedDriverId || !eventCar || !eventCar.event_id) {
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
      showToast("Pilota assegnato correttamente");
      await loadData();
    } catch (error: any) {
      console.error("Errore assegnazione pilota:", error);
      showToast(error.message || "Errore assegnazione pilota", "error");
    } finally {
      setAssigningDriver(false);
    }
  };

  const removeDriverAssignment = async (assignmentId: string) => {
    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase
        .from("driver_event_entries")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", assignmentId);

      if (error) throw error;

      showToast("Pilota rimosso dall'evento");
      await loadData();
    } catch (error: any) {
      console.error("Errore rimozione pilota:", error);
      showToast(error.message || "Errore rimozione pilota", "error");
    }
  };

  const createEventSession = async () => {
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

      showToast("Sessione creata correttamente");
      await loadData();
    } catch (error: any) {
      console.error("Errore creazione sessione:", error);
      showToast(error.message || "Errore creazione sessione", "error");
    } finally {
      setSavingSession(false);
    }
  };

  const deleteEventSession = async (sessionId: string) => {
    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase
        .from("event_sessions")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", sessionId);

      if (error) throw error;

      showToast("Sessione eliminata");
      await loadData();
    } catch (error: any) {
      console.error("Errore eliminazione sessione:", error);
      showToast(error.message || "Errore eliminazione sessione", "error");
    }
  };

  const addTurn = async () => {
    const minutes = Number(turnMinutes);
    const laps = Number(turnLaps || 0);

    if (!turnDate || !minutes || minutes <= 0) {
      showToast("Compila data e minuti validi", "error");
      return;
    }

    try {
      setSavingTurn(true);
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.from("event_car_turns").insert([
        {
          team_id: ctx.teamId,
          event_car_id: eventCarId,
          date: turnDate,
          minutes,
          laps,
          notes: turnNotes.trim() || null,
        },
      ]);

      if (error) throw error;

      setTurnDate("");
      setTurnMinutes("");
      setTurnLaps("");
      setTurnNotes("");

      showToast("Turno aggiunto correttamente");
      await loadData();
    } catch (error: any) {
      console.error("Errore aggiunta turno:", error);
      showToast(error.message || "Errore aggiunta turno", "error");
    } finally {
      setSavingTurn(false);
    }
  };

  const deleteTurn = async (turnId: string) => {
    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase
        .from("event_car_turns")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", turnId);

      if (error) throw error;

      showToast("Turno eliminato");
      await loadData();
    } catch (error: any) {
      console.error("Errore eliminazione turno:", error);
      showToast(error.message || "Errore eliminazione turno", "error");
    }
  };

  const saveSection = async (
    section: "checkup" | "fuel" | "notes" | "setup",
    data: Record<string, any>
  ) => {
    const ctx = await getCurrentTeamContext();

    const { error } = await supabase.from("event_car_data").insert([
      {
        team_id: ctx.teamId,
        event_car_id: eventCarId,
        section,
        data,
      },
    ]);

    if (error) throw error;
  };

  const onSaveCheckup = async () => {
    try {
      setSavingCheckup(true);

      await saveSection("checkup", {
        brakes: checkBrakes,
        engine: checkEngine,
        gearbox: checkGearbox,
        electronics: checkElectronics,
        notes: checkNotes.trim() || "",
      });

      showToast("Checkup salvato");
      await loadData();
    } catch (error: any) {
      console.error("Errore salvataggio checkup:", error);
      showToast(error.message || "Errore salvataggio checkup", "error");
    } finally {
      setSavingCheckup(false);
    }
  };

  const onSaveFuel = async () => {
    try {
      setSavingFuel(true);

      await saveSection("fuel", {
        fuelStart: fuelStart ? Number(fuelStart) : null,
        fuelEnd: fuelEnd ? Number(fuelEnd) : null,
        lapsDone: fuelLapsDone ? Number(fuelLapsDone) : null,
        notes: fuelNotes.trim() || "",
      });

      showToast("Dati carburante salvati");
      await loadData();
    } catch (error: any) {
      console.error("Errore salvataggio fuel:", error);
      showToast(error.message || "Errore salvataggio fuel", "error");
    } finally {
      setSavingFuel(false);
    }
  };

  const onSaveSetup = async () => {
    try {
      setSavingSetup(true);

      await saveSection("setup", {
        frontPressure: setupFrontPressure ? Number(setupFrontPressure) : null,
        rearPressure: setupRearPressure ? Number(setupRearPressure) : null,
        rideHeight: setupRideHeight ? Number(setupRideHeight) : null,
        wingAngle: setupWingAngle ? Number(setupWingAngle) : null,
        notes: setupNotes.trim() || "",
      });

      showToast("Setup salvato");
      await loadData();
    } catch (error: any) {
      console.error("Errore salvataggio setup:", error);
      showToast(error.message || "Errore salvataggio setup", "error");
    } finally {
      setSavingSetup(false);
    }
  };

  const onSaveNotes = async () => {
    try {
      setSavingNotes(true);

      await saveSection("notes", {
        notes: genericNotes.trim() || "",
      });

      showToast("Note salvate");
      await loadData();
    } catch (error: any) {
      console.error("Errore salvataggio note:", error);
      showToast(error.message || "Errore salvataggio note", "error");
    } finally {
      setSavingNotes(false);
    }
  };

  const totalMinutes = turns.reduce((acc, row) => acc + Number(row.minutes || 0), 0);
  const totalLaps = turns.reduce((acc, row) => acc + Number(row.laps || 0), 0);

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        <div className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" />
          Caricamento auto evento...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
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

      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <Wrench size={14} />
                Gestione auto evento
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400 flex flex-wrap items-center gap-2">
                <CarFront size={24} />
                <span>{car?.name || "Auto evento"}</span>
              </h1>

              <div className="mt-3 flex flex-wrap gap-2 text-sm text-yellow-100/80">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <CalendarDays size={14} />
                  {eventRow?.name || "Evento"}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <MapPin size={14} />
                  {circuit?.name || "Autodromo non specificato"}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  {formatDate(eventRow?.date)}
                </span>
              </div>
            </div>

            <Link href={`/calendar/${eventId}`} className="btn-secondary">
              <ArrowLeft size={16} /> Torna evento
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<UserRound size={18} className="text-yellow-600" />}
              label="Piloti assegnati"
              value={String(assignedDrivers.length)}
            />
            <SummaryCard
              icon={<CalendarDays size={18} className="text-yellow-600" />}
              label="Sessioni evento"
              value={String(eventSessions.length)}
            />
            <SummaryCard
              icon={<TimerReset size={18} className="text-yellow-600" />}
              label="Minuti totali"
              value={String(totalMinutes)}
            />
            <SummaryCard
              icon={<TriangleAlert size={18} className="text-yellow-600" />}
              label="Giri totali"
              value={String(totalLaps)}
            />
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-red-500 bg-red-50 p-4 text-red-700 font-bold">
        TEST NUOVA PAGINA EVENT CAR
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserRound className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Piloti assegnati</h2>
          </div>

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
                {assigningDriver ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
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
        </div>

        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Sessioni evento</h2>
          </div>

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
              {savingSession ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
              Crea sessione
            </button>
          </div>

          {eventSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
              Nessuna sessione creata.
            </div>
          ) : (
            <div className="space-y-3">
              {eventSessions.map((session) => (
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
        </div>
      </section>

      <section className="card-base p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <TimerReset className="text-yellow-500" size={18} />
          <h2 className="text-lg font-bold text-neutral-800">Turni</h2>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 mb-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="date"
              className="input-base"
              value={turnDate}
              onChange={(e) => setTurnDate(e.target.value)}
            />
            <input
              type="number"
              className="input-base"
              value={turnMinutes}
              onChange={(e) => setTurnMinutes(e.target.value)}
              placeholder="Minuti"
            />
            <input
              type="number"
              className="input-base"
              value={turnLaps}
              onChange={(e) => setTurnLaps(e.target.value)}
              placeholder="Giri"
            />
            <button
              onClick={addTurn}
              disabled={savingTurn}
              className="btn-primary"
            >
              {savingTurn ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
              Aggiungi turno
            </button>
          </div>

          <textarea
            className="input-base min-h-[90px]"
            value={turnNotes}
            onChange={(e) => setTurnNotes(e.target.value)}
            placeholder="Note turno..."
          />
        </div>

        {turns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
            Nessun turno registrato.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Minuti</th>
                  <th className="p-3 text-left">Giri</th>
                  <th className="p-3 text-left">Note</th>
                  <th className="p-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {turns.map((turn) => (
                  <tr key={turn.id} className="border-t border-neutral-200">
                    <td className="p-3">{formatDate(turn.date)}</td>
                    <td className="p-3">{turn.minutes}</td>
                    <td className="p-3">{turn.laps}</td>
                    <td className="p-3">{turn.notes || "—"}</td>
                    <td className="p-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => deleteTurn(turn.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 text-white px-3 py-2 font-semibold"
                        >
                          <Trash2 size={14} />
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Checkup</h2>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CheckRow label="Freni" checked={checkBrakes} onChange={setCheckBrakes} />
              <CheckRow label="Motore" checked={checkEngine} onChange={setCheckEngine} />
              <CheckRow label="Cambio" checked={checkGearbox} onChange={setCheckGearbox} />
              <CheckRow
                label="Elettronica"
                checked={checkElectronics}
                onChange={setCheckElectronics}
              />
            </div>

            <textarea
              className="input-base min-h-[110px]"
              value={checkNotes}
              onChange={(e) => setCheckNotes(e.target.value)}
              placeholder="Note checkup..."
            />

            <button onClick={onSaveCheckup} disabled={savingCheckup} className="btn-primary self-start">
              {savingCheckup ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salva checkup
            </button>
          </div>
        </div>

        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Fuel className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Fuel</h2>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="number"
                className="input-base"
                value={fuelStart}
                onChange={(e) => setFuelStart(e.target.value)}
                placeholder="Fuel start"
              />
              <input
                type="number"
                className="input-base"
                value={fuelEnd}
                onChange={(e) => setFuelEnd(e.target.value)}
                placeholder="Fuel end"
              />
              <input
                type="number"
                className="input-base"
                value={fuelLapsDone}
                onChange={(e) => setFuelLapsDone(e.target.value)}
                placeholder="Laps done"
              />
            </div>

            <textarea
              className="input-base min-h-[110px]"
              value={fuelNotes}
              onChange={(e) => setFuelNotes(e.target.value)}
              placeholder="Note carburante..."
            />

            <button onClick={onSaveFuel} disabled={savingFuel} className="btn-primary self-start">
              {savingFuel ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salva fuel
            </button>
          </div>
        </div>

        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Assetto</h2>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                className="input-base"
                value={setupFrontPressure}
                onChange={(e) => setSetupFrontPressure(e.target.value)}
                placeholder="Pressione anteriore"
              />
              <input
                type="number"
                className="input-base"
                value={setupRearPressure}
                onChange={(e) => setSetupRearPressure(e.target.value)}
                placeholder="Pressione posteriore"
              />
              <input
                type="number"
                className="input-base"
                value={setupRideHeight}
                onChange={(e) => setSetupRideHeight(e.target.value)}
                placeholder="Ride height"
              />
              <input
                type="number"
                className="input-base"
                value={setupWingAngle}
                onChange={(e) => setSetupWingAngle(e.target.value)}
                placeholder="Wing angle"
              />
            </div>

            <textarea
              className="input-base min-h-[110px]"
              value={setupNotes}
              onChange={(e) => setSetupNotes(e.target.value)}
              placeholder="Note assetto..."
            />

            <button onClick={onSaveSetup} disabled={savingSetup} className="btn-primary self-start">
              {savingSetup ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salva assetto
            </button>
          </div>
        </div>

        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <StickyNote className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Note</h2>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-4">
            <textarea
              className="input-base min-h-[180px]"
              value={genericNotes}
              onChange={(e) => setGenericNotes(e.target.value)}
              placeholder="Note generali auto evento..."
            />

            <button onClick={onSaveNotes} disabled={savingNotes} className="btn-primary self-start">
              {savingNotes ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salva note
            </button>
          </div>
        </div>
      </section>

      <section className="card-base p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="text-yellow-500" size={18} />
          <h2 className="text-lg font-bold text-neutral-800">Ultimi dati salvati</h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          <JsonCard title="Checkup" data={latestSectionData.checkup?.data || null} />
          <JsonCard title="Fuel" data={latestSectionData.fuel?.data || null} />
          <JsonCard title="Setup" data={latestSectionData.setup?.data || null} />
          <JsonCard title="Note" data={latestSectionData.notes?.data || null} />
        </div>
      </section>
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

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900 break-words">{value}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span className="text-sm font-medium text-neutral-800">{label}</span>
    </label>
  );
}

function JsonCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, any> | null;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="font-bold text-neutral-900">{title}</div>
      <div className="mt-3 text-xs text-neutral-600 whitespace-pre-wrap break-words">
        {data ? JSON.stringify(data, null, 2) : "Nessun dato"}
      </div>
    </div>
  );
}