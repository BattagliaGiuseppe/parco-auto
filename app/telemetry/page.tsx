"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Audiowide } from "next/font/google";
import {
  Activity,
  BarChart3,
  Clock,
  FileArchive,
  Gauge,
  Info,
  Link2,
  Upload,
  Users,
} from "lucide-react";

import EmptyState from "@/components/EmptyState";
import FormStatusBanner from "@/components/FormStatusBanner";
import PageHeader from "@/components/PageHeader";
import PagePermissionState from "@/components/PagePermissionState";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import { usePermissionAccess } from "@/lib/permissions";
import { supabase } from "@/lib/supabaseClient";
import { uploadTeamFile } from "@/lib/storage";
import { getCurrentTeamContext } from "@/lib/teamContext";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

const inputClassName =
  "w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";

const selectClassName = inputClassName;

type Feedback = {
  type: "success" | "error" | "info";
  message: string;
};

type TelemetryForm = {
  file_name: string;
  notes: string;
  car_id: string;
  driver_id: string;
  event_id: string;
  session_id: string;
  event_car_turn_id: string;
  file_category: string;
  source_software: string;
  data_format: string;
  logger_model: string;
  track_name: string;
  tags: string;
  import_status: string;
};

type TelemetryFile = {
  id: string;
  team_id?: string;
  file_name?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
  file_type?: string | null;
  file_size_bytes?: number | null;
  notes?: string | null;
  car_id?: string | null;
  driver_id?: string | null;
  event_id?: string | null;
  session_id?: string | null;
  event_car_turn_id?: string | null;
  file_category?: string | null;
  source_software?: string | null;
  data_format?: string | null;
  logger_model?: string | null;
  track_name?: string | null;
  import_status?: string | null;
  channels_count?: number | null;
  samples_count?: number | null;
  duration_seconds?: number | null;
  best_lap_seconds?: number | null;
  laps_count?: number | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Car = {
  id: string;
  name: string;
};

type Driver = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
};

type EventRow = {
  id: string;
  name: string;
  circuit?: string | null;
  location?: string | null;
  date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type SessionRow = {
  id: string;
  name?: string | null;
  event_id?: string | null;
  starts_at?: string | null;
  start_time?: string | null;
  created_at?: string | null;
};

type EventCar = {
  id: string;
  event_id?: string | null;
  car_id?: string | null;
};

type TurnRow = {
  id: string;
  event_car_id?: string | null;
  event_session_id?: string | null;
  driver_id?: string | null;
  minutes?: number | null;
  laps?: number | null;
  best_lap_time?: string | number | null;
  avg_lap_time?: string | number | null;
  recorded_at?: string | null;
  created_at?: string | null;
};

type TelemetryInsight = {
  id: string;
  telemetry_file_id?: string | null;
  event_car_turn_id?: string | null;
  category?: string | null;
  severity?: string | null;
  title?: string | null;
  description?: string | null;
  recommendation?: string | null;
  created_at?: string | null;
};

type TelemetryChannel = {
  id: string;
  telemetry_file_id?: string | null;
  channel_key?: string | null;
  display_name?: string | null;
  unit?: string | null;
};

type TelemetryLap = {
  id: string;
  telemetry_file_id?: string | null;
  lap_number?: number | null;
  lap_time_seconds?: number | null;
};

function buildDefaultForm(): TelemetryForm {
  return {
    file_name: "",
    notes: "",
    car_id: "",
    driver_id: "",
    event_id: "",
    session_id: "",
    event_car_turn_id: "",
    file_category: "datalog",
    source_software: "AIM Race Studio",
    data_format: "csv",
    logger_model: "",
    track_name: "",
    tags: "",
    import_status: "pending_parse",
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-neutral-700">
      <span className="flex items-center gap-2">
        {label}
        {hint ? <span className="text-xs font-normal text-neutral-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function InfoBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="mb-2 flex items-center gap-2 font-bold text-yellow-950">
        <Info size={16} />
        Telemetria intelligente
      </div>
      {children}
    </div>
  );
}

function safeText(value?: string | null) {
  return value && value.trim() ? value.trim() : "—";
}

function driverName(driver?: Driver) {
  if (!driver) return "—";
  const full = `${driver.first_name || ""} ${driver.last_name || ""}`.trim();
  return driver.nickname ? `${full || driver.nickname} (${driver.nickname})` : full || "—";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  if (minutes <= 0) return `${rest.toFixed(3)} s`;
  return `${minutes}:${rest.toFixed(3).padStart(6, "0")}`;
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "pending_parse":
      return "Da analizzare";
    case "parsed":
      return "Dati letti";
    case "analysis_ready":
      return "Analisi pronta";
    case "needs_review":
      return "Da verificare";
    case "error":
      return "Errore";
    default:
      return "Archiviato";
  }
}

function statusClassName(status?: string | null) {
  switch (status) {
    case "analysis_ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "parsed":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "pending_parse":
      return "border-yellow-200 bg-yellow-50 text-yellow-800";
    case "needs_review":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-600";
  }
}

function categoryLabel(category?: string | null) {
  switch (category) {
    case "datalog":
      return "Datalog";
    case "video":
      return "Video onboard";
    case "pdf_report":
      return "Report PDF";
    case "setup_sheet":
      return "Setup sheet";
    case "engineer_notes":
      return "Note ingegnere";
    case "analysis_export":
      return "Export analisi";
    default:
      return "Altro";
  }
}

export default function TelemetryPage() {
  const access = usePermissionAccess();
  const canViewTelemetry = access.hasPermission("telemetry.view");
  const canEditTelemetry = access.hasPermission("telemetry.edit", ["owner", "admin"]);

  const [rows, setRows] = useState<TelemetryFile[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [eventCars, setEventCars] = useState<EventCar[]>([]);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [channels, setChannels] = useState<TelemetryChannel[]>([]);
  const [laps, setLaps] = useState<TelemetryLap[]>([]);
  const [insights, setInsights] = useState<TelemetryInsight[]>([]);
  const [form, setForm] = useState(buildDefaultForm());
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const ctx = await getCurrentTeamContext();

      const [
        filesRes,
        carsRes,
        driversRes,
        eventsRes,
        sessionsRes,
        eventCarsRes,
        turnsRes,
        channelsRes,
        lapsRes,
        insightsRes,
      ] = await Promise.all([
        supabase
          .from("telemetry_files")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("created_at", { ascending: false }),
        supabase.from("cars").select("id,name").eq("team_id", ctx.teamId).order("name"),
        supabase
          .from("drivers")
          .select("id,first_name,last_name,nickname")
          .eq("team_id", ctx.teamId)
          .order("last_name"),
        supabase.from("events").select("*").eq("team_id", ctx.teamId).order("created_at", { ascending: false }),
        supabase.from("event_sessions").select("*").eq("team_id", ctx.teamId).order("created_at", { ascending: false }),
        supabase.from("event_cars").select("*").eq("team_id", ctx.teamId),
        supabase.from("event_car_turns").select("*").eq("team_id", ctx.teamId).order("created_at", { ascending: false }),
        supabase.from("telemetry_channels").select("*").eq("team_id", ctx.teamId),
        supabase.from("telemetry_laps").select("*").eq("team_id", ctx.teamId),
        supabase
          .from("telemetry_insights")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("created_at", { ascending: false }),
      ]);

      if (filesRes.error) throw filesRes.error;
      if (carsRes.error) throw carsRes.error;
      if (driversRes.error) throw driversRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (eventCarsRes.error) throw eventCarsRes.error;
      if (turnsRes.error) throw turnsRes.error;

      setRows((filesRes.data || []) as TelemetryFile[]);
      setCars((carsRes.data || []) as Car[]);
      setDrivers((driversRes.data || []) as Driver[]);
      setEvents((eventsRes.data || []) as EventRow[]);
      setSessions((sessionsRes.data || []) as SessionRow[]);
      setEventCars((eventCarsRes.data || []) as EventCar[]);
      setTurns((turnsRes.data || []) as TurnRow[]);
      setChannels(((channelsRes.data || []) as TelemetryChannel[]) || []);
      setLaps(((lapsRes.data || []) as TelemetryLap[]) || []);
      setInsights(((insightsRes.data || []) as TelemetryInsight[]) || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore caricamento telemetria.";
      setFeedback({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewTelemetry) {
      void load();
    }
  }, [access.loading, canViewTelemetry]);

  const maps = useMemo(() => {
    return {
      cars: new Map(cars.map((car) => [car.id, car])),
      drivers: new Map(drivers.map((driver) => [driver.id, driver])),
      events: new Map(events.map((event) => [event.id, event])),
      sessions: new Map(sessions.map((session) => [session.id, session])),
      eventCars: new Map(eventCars.map((eventCar) => [eventCar.id, eventCar])),
    };
  }, [cars, drivers, events, sessions, eventCars]);

  const turnLabels = useMemo(() => {
    const labels = new Map<string, string>();

    turns.forEach((turn) => {
      const eventCar = turn.event_car_id ? maps.eventCars.get(turn.event_car_id) : undefined;
      const event = eventCar?.event_id ? maps.events.get(eventCar.event_id) : undefined;
      const car = eventCar?.car_id ? maps.cars.get(eventCar.car_id) : undefined;
      const driver = turn.driver_id ? maps.drivers.get(turn.driver_id) : undefined;
      const session = turn.event_session_id ? maps.sessions.get(turn.event_session_id) : undefined;

      const date = formatDateTime(turn.recorded_at || turn.created_at);
      const pieces = [
        event?.name || "Evento",
        car?.name || "Mezzo",
        session?.name || "Sessione",
        driver ? driverName(driver) : "Pilota non assegnato",
        `${turn.minutes || 0} min`,
        date,
      ];

      labels.set(turn.id, pieces.filter(Boolean).join(" · "));
    });

    return labels;
  }, [turns, maps]);

  const stats = useMemo(
    () => [
      {
        label: "File registrati",
        value: String(rows.length),
        icon: <FileArchive className="h-5 w-5" />,
        helper: "Pacchetti telemetria archiviati",
      },
      {
        label: "Turni collegati",
        value: String(new Set(rows.map((row) => row.event_car_turn_id).filter(Boolean)).size),
        icon: <Link2 className="h-5 w-5" />,
        helper: "File collegati a turni specifici",
      },
      {
        label: "Da analizzare",
        value: String(rows.filter((row) => row.import_status === "pending_parse").length),
        icon: <Gauge className="h-5 w-5" />,
        helper: "File pronti per parsing/import canali",
      },
      {
        label: "Insight tecnici",
        value: String(insights.length),
        icon: <BarChart3 className="h-5 w-5" />,
        helper: "Base futura per ingegnere di pista",
      },
    ],
    [rows, insights.length]
  );

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const car = row.car_id ? maps.cars.get(row.car_id) : undefined;
      const driver = row.driver_id ? maps.drivers.get(row.driver_id) : undefined;
      const event = row.event_id ? maps.events.get(row.event_id) : undefined;
      const session = row.session_id ? maps.sessions.get(row.session_id) : undefined;
      const turn = row.event_car_turn_id ? turnLabels.get(row.event_car_turn_id) : "";

      return [
        row.file_name,
        row.notes,
        row.source_software,
        row.file_category,
        row.data_format,
        row.logger_model,
        row.track_name,
        row.tags?.join(" "),
        car?.name,
        driverName(driver),
        event?.name,
        session?.name,
        turn,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filter, rows, maps, turnLabels]);

  function handleTurnChange(turnId: string) {
    const selectedTurn = turns.find((turn) => turn.id === turnId);
    if (!selectedTurn) {
      setForm({ ...form, event_car_turn_id: "" });
      return;
    }

    const eventCar = selectedTurn.event_car_id ? maps.eventCars.get(selectedTurn.event_car_id) : undefined;

    setForm({
      ...form,
      event_car_turn_id: turnId,
      car_id: eventCar?.car_id || form.car_id,
      event_id: eventCar?.event_id || form.event_id,
      session_id: selectedTurn.event_session_id || form.session_id,
      driver_id: selectedTurn.driver_id || form.driver_id,
    });
  }

  function handleDataFormatChange(dataFormat: string) {
    const parseable = ["csv", "xlsx", "aim_export"].includes(dataFormat);
    setForm({
      ...form,
      data_format: dataFormat,
      import_status: parseable ? "pending_parse" : "archived",
    });
  }

  async function addFile() {
    if (!canEditTelemetry || saving) return;

    const ctx = await getCurrentTeamContext();
    setFeedback(null);

    if (!file && !form.file_name.trim()) {
      setFeedback({
        type: "error",
        message: "Carica un file o inserisci almeno un nome.",
      });
      return;
    }

    setSaving(true);

    try {
      let payload: Partial<TelemetryFile> & {
        team_id: string;
        uploaded_by_team_user_id?: string | null;
      } = {
        team_id: ctx.teamId,
        file_name: form.file_name.trim() || file?.name || "File telemetria",
        notes: form.notes.trim() || null,
        car_id: form.car_id || null,
        driver_id: form.driver_id || null,
        event_id: form.event_id || null,
        session_id: form.session_id || null,
        event_car_turn_id: form.event_car_turn_id || null,
        file_category: form.file_category || "datalog",
        source_software: form.source_software.trim() || null,
        data_format: form.data_format || null,
        logger_model: form.logger_model.trim() || null,
        track_name: form.track_name.trim() || null,
        tags: parseTags(form.tags),
        import_status: form.import_status || "archived",
        uploaded_by_team_user_id: ctx.teamUserId,
      };

      if (file) {
        const upload = await uploadTeamFile({
          file,
          area: "telemetry",
          recordId: form.event_id || form.car_id || form.event_car_turn_id || "generic",
        });

        payload = {
          ...payload,
          file_name: form.file_name.trim() || upload.fileName,
          file_url: upload.publicUrl,
          storage_path: upload.path,
          file_type: upload.mimeType,
          file_size_bytes: upload.sizeBytes,
        };
      }

      const { error } = await supabase.from("telemetry_files").insert([payload]);

      if (error) throw error;

      setForm(buildDefaultForm());
      setFile(null);
      setFeedback({
        type: "success",
        message:
          "File telemetria registrato correttamente. Ora è collegato ai dati sportivi e pronto per le future analisi canali.",
      });

      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante il salvataggio del file telemetria.";
      setFeedback({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  const selectedTurn = form.event_car_turn_id ? turns.find((turn) => turn.id === form.event_car_turn_id) : null;

  if (access.loading) {
    return (
      <PagePermissionState
        title="Telemetria"
        subtitle="Archivio tecnico e dati performance"
        icon={<Activity className="h-6 w-6" />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Telemetria"
        subtitle="Archivio tecnico e dati performance"
        icon={<Activity className="h-6 w-6" />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewTelemetry) {
    return (
      <PagePermissionState
        title="Telemetria"
        subtitle="Archivio tecnico e dati performance"
        icon={<Activity className="h-6 w-6" />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo telemetria."
      />
    );
  }

  return (
    <div className={`${audiowide.className} flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Telemetria"
        subtitle="Collega file, eventi, turni e dati tecnici per costruire la base del futuro ingegnere di pista."
        icon={<Activity className="h-6 w-6" />}
      />

      <StatsGrid items={stats} />

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      {!canEditTelemetry ? (
        <FormStatusBanner type="info" message="Hai accesso in sola lettura a questo modulo." />
      ) : null}

      <InfoBlock>
        In questa fase la telemetria viene organizzata e collegata ai turni. Il prossimo step sarà leggere CSV/Excel
        esportati da logger o Race Studio, mappare i canali e creare grafici confrontabili tra piloti, turni e setup.
      </InfoBlock>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {canEditTelemetry ? (
          <SectionCard
            title="Nuovo file telemetria"
            subtitle="Archivia file e collegalo a evento, mezzo, pilota, sessione e turno."
          >
            <div className="space-y-4">
              <Field label="Nome file" hint="opzionale, altrimenti uso il nome del file">
                <input
                  className={inputClassName}
                  value={form.file_name}
                  onChange={(event) => setForm({ ...form, file_name: event.target.value })}
                  placeholder="AIM Mugello T4 Rossi.csv"
                />
              </Field>

              <Field label="File">
                <input
                  className={inputClassName}
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Categoria">
                  <select
                    className={selectClassName}
                    value={form.file_category}
                    onChange={(event) => setForm({ ...form, file_category: event.target.value })}
                  >
                    <option value="datalog">Datalog</option>
                    <option value="video">Video onboard</option>
                    <option value="pdf_report">Report PDF</option>
                    <option value="setup_sheet">Setup sheet</option>
                    <option value="engineer_notes">Note ingegnere</option>
                    <option value="analysis_export">Export analisi</option>
                    <option value="other">Altro</option>
                  </select>
                </Field>

                <Field label="Formato dati">
                  <select
                    className={selectClassName}
                    value={form.data_format}
                    onChange={(event) => handleDataFormatChange(event.target.value)}
                  >
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel/XLSX</option>
                    <option value="aim_export">AIM export</option>
                    <option value="pdf">PDF</option>
                    <option value="video">Video</option>
                    <option value="image">Immagine</option>
                    <option value="zip">ZIP</option>
                    <option value="other">Altro</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Software origine">
                  <input
                    className={inputClassName}
                    value={form.source_software}
                    onChange={(event) => setForm({ ...form, source_software: event.target.value })}
                    placeholder="AIM Race Studio"
                  />
                </Field>

                <Field label="Logger / dispositivo">
                  <input
                    className={inputClassName}
                    value={form.logger_model}
                    onChange={(event) => setForm({ ...form, logger_model: event.target.value })}
                    placeholder="Solo 2 DL, MyChron, ECU..."
                  />
                </Field>
              </div>

              <Field label="Turno specifico" hint="consigliato per analisi future">
                <select
                  className={selectClassName}
                  value={form.event_car_turn_id}
                  onChange={(event) => handleTurnChange(event.target.value)}
                >
                  <option value="">Nessun turno collegato</option>
                  {turns.map((turn) => (
                    <option key={turn.id} value={turn.id}>
                      {turnLabels.get(turn.id) || turn.id}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedTurn ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
                  Il turno selezionato aggiorna automaticamente evento, mezzo, pilota e sessione se questi dati sono
                  presenti sul turno.
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Mezzo">
                  <select
                    className={selectClassName}
                    value={form.car_id}
                    onChange={(event) => setForm({ ...form, car_id: event.target.value })}
                  >
                    <option value="">Mezzo</option>
                    {cars.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Pilota">
                  <select
                    className={selectClassName}
                    value={form.driver_id}
                    onChange={(event) => setForm({ ...form, driver_id: event.target.value })}
                  >
                    <option value="">Pilota</option>
                    {drivers.map((row) => (
                      <option key={row.id} value={row.id}>
                        {driverName(row)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Evento">
                  <select
                    className={selectClassName}
                    value={form.event_id}
                    onChange={(event) => setForm({ ...form, event_id: event.target.value })}
                  >
                    <option value="">Evento</option>
                    {events.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Sessione">
                  <select
                    className={selectClassName}
                    value={form.session_id}
                    onChange={(event) => setForm({ ...form, session_id: event.target.value })}
                  >
                    <option value="">Sessione</option>
                    {sessions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name || "Sessione"}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Tracciato">
                <input
                  className={inputClassName}
                  value={form.track_name}
                  onChange={(event) => setForm({ ...form, track_name: event.target.value })}
                  placeholder="Mugello, Misano, Vallelunga..."
                />
              </Field>

              <Field label="Tag" hint="separati da virgola">
                <input
                  className={inputClassName}
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="best lap, qualifica, test gomme"
                />
              </Field>

              <Field label="Note tecniche">
                <textarea
                  className={`${inputClassName} min-h-28`}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Condizioni pista, gomme, setup, commento pilota..."
                />
              </Field>

              <div className="flex justify-end">
                <button
                  onClick={addFile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black shadow-sm transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload size={16} />
                  {saving ? "Salvataggio..." : "Registra file"}
                </button>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Archivio telemetria"
          subtitle="Consulta file e metadati collegati a eventi, turni e performance."
          className={canEditTelemetry ? "" : "xl:col-span-2"}
        >
          <div className="mb-4">
            <input
              className={inputClassName}
              placeholder="Filtro rapido per nome, evento, pilota, mezzo, tag o note"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              Caricamento archivio telemetria...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nessun file registrato"
              description="Carica il primo file telemetria e collegalo a evento, mezzo, pilota e turno."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((row) => {
                const car = row.car_id ? maps.cars.get(row.car_id) : undefined;
                const driver = row.driver_id ? maps.drivers.get(row.driver_id) : undefined;
                const event = row.event_id ? maps.events.get(row.event_id) : undefined;
                const session = row.session_id ? maps.sessions.get(row.session_id) : undefined;
                const rowChannels = channels.filter((channel) => channel.telemetry_file_id === row.id);
                const rowLaps = laps.filter((lap) => lap.telemetry_file_id === row.id);
                const rowInsights = insights.filter((insight) => insight.telemetry_file_id === row.id);

                return (
                  <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-bold text-neutral-900">
                            {row.file_name || "File telemetria"}
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassName(
                              row.import_status
                            )}`}
                          >
                            {statusLabel(row.import_status)}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-neutral-500">{formatDateTime(row.created_at)}</div>
                      </div>

                      {row.file_url ? (
                        <a
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        >
                          Apri file
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700 md:grid-cols-2 xl:grid-cols-3">
                      <div>Categoria: {categoryLabel(row.file_category)}</div>
                      <div>Formato: {safeText(row.data_format)}</div>
                      <div>Software: {safeText(row.source_software)}</div>
                      <div>Logger: {safeText(row.logger_model)}</div>
                      <div>Tracciato: {safeText(row.track_name)}</div>
                      <div>Evento: {safeText(event?.name)}</div>
                      <div>Mezzo: {safeText(car?.name)}</div>
                      <div>Pilota: {driverName(driver)}</div>
                      <div>Sessione: {safeText(session?.name)}</div>
                      <div>Turno: {row.event_car_turn_id ? "Collegato" : "—"}</div>
                      <div>Canali: {row.channels_count || rowChannels.length || 0}</div>
                      <div>Giri: {row.laps_count || rowLaps.length || 0}</div>
                      <div>Campioni: {row.samples_count || 0}</div>
                      <div>Durata: {formatDuration(row.duration_seconds)}</div>
                      <div>Best lap: {formatDuration(row.best_lap_seconds)}</div>
                    </div>

                    {row.event_car_turn_id ? (
                      <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
                        Turno collegato: {turnLabels.get(row.event_car_turn_id) || row.event_car_turn_id}
                      </div>
                    ) : null}

                    {row.notes ? (
                      <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm leading-6 text-yellow-900">
                        {row.notes}
                      </div>
                    ) : null}

                    {row.tags && row.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {rowInsights.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                        <div className="mb-2 font-bold">Insight tecnici</div>
                        <div className="space-y-2">
                          {rowInsights.slice(0, 3).map((insight) => (
                            <div key={insight.id}>
                              <span className="font-semibold">{insight.title}</span>
                              {insight.recommendation ? ` — ${insight.recommendation}` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
