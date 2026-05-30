"use client";

import { useEffect, useMemo, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  FileArchive,
  Gauge,
  Info,
  Link2,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  PlayCircle,
  Upload,
  Trash2,
  Users,
  X,
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

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-3 text-sm text-[var(--text-secondary)] shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15";

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
  max_speed?: number | null;
  max_rpm?: number | null;
  avg_speed?: number | null;
  avg_throttle?: number | null;
  avg_brake?: number | null;
  sampled_points_count?: number | null;
  parse_warnings?: string[] | null;
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
  max_speed?: number | null;
  avg_speed?: number | null;
  notes?: string | null;
};

type TelemetrySample = {
  id: string;
  telemetry_file_id?: string | null;
  sample_index?: number | null;
  time_seconds?: number | null;
  distance_m?: number | null;
  lap_number?: number | null;
  values_json?: Record<string, number> | null;
};

type AnalysisAxis = "time" | "distance" | "sample";

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
    <label className="block space-y-2 text-sm font-semibold text-[var(--text-secondary)]">
      <span className="flex items-center gap-2">
        {label}
        {hint ? <span className="text-xs font-normal text-[var(--text-muted)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function InfoBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
      <div className="mb-2 flex items-center gap-2 font-bold text-yellow-100">
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

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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
      return "border-sky-400/30 bg-sky-500/10 text-sky-200";
    case "pending_parse":
      return "border-yellow-400/25 bg-yellow-500/10 text-yellow-100";
    case "needs_review":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "error":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/[0.045] text-[var(--text-secondary)]";
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


type ChannelKey =
  | "ignore"
  | "time"
  | "distance"
  | "lap"
  | "speed"
  | "rpm"
  | "throttle"
  | "brake"
  | "brake_pressure"
  | "gear"
  | "water_temp"
  | "oil_temp"
  | "oil_pressure"
  | "fuel_pressure"
  | "exhaust_temp"
  | "gps_lat"
  | "gps_lon"
  | "lateral_g"
  | "longitudinal_g"
  | "steering_angle"
  | "fuel"
  | "battery_voltage"
  | "lambda"
  | "tire_pressure_fl"
  | "tire_pressure_fr"
  | "tire_pressure_rl"
  | "tire_pressure_rr";

type ChannelDefinition = {
  key: ChannelKey;
  label: string;
  unit: string;
  aliases: string[];
};

type AimCsvMetadata = {
  isAimCsv: boolean;
  format?: string | null;
  session?: string | null;
  vehicle?: string | null;
  racer?: string | null;
  championship?: string | null;
  date?: string | null;
  time?: string | null;
  sampleRate?: number | null;
  durationSeconds?: number | null;
  beaconMarkers: number[];
  segmentTimes: number[];
};

type CsvWizardState = {
  mode: "new" | "existing";
  telemetryFileId?: string;
  fileName: string;
  delimiter: string;
  headers: string[];
  units: Record<string, string>;
  rows: string[][];
  mapping: Record<string, ChannelKey>;
  aimMetadata?: AimCsvMetadata;
  error?: string;
  importing?: boolean;
};

type ParsedChannel = {
  channel_key: string;
  display_name: string;
  source_name: string;
  unit: string;
  mapped_type: string;
  sample_count: number;
  min_value: number | null;
  max_value: number | null;
  avg_value: number | null;
};

type ParsedLap = {
  lap_number: number;
  lap_time_seconds: number | null;
  max_speed: number | null;
  avg_speed: number | null;
  notes?: string | null;
};

type ParsedSample = {
  sample_index: number;
  time_seconds: number | null;
  distance_m: number | null;
  lap_number: number | null;
  values_json: Record<string, number>;
};

type ParsedTelemetryPayload = {
  channels: ParsedChannel[];
  laps: ParsedLap[];
  samples: ParsedSample[];
  summary: {
    channels_count: number;
    samples_count: number;
    sampled_points_count: number;
    duration_seconds: number | null;
    best_lap_seconds: number | null;
    laps_count: number;
    max_speed: number | null;
    max_rpm: number | null;
    avg_speed: number | null;
    avg_throttle: number | null;
    avg_brake: number | null;
    warnings: string[];
  };
};

const MAX_STORED_SAMPLES = 5000;
const MAX_PARSED_ROWS = 60000;

const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  { key: "ignore", label: "Ignora colonna", unit: "", aliases: [] },
  { key: "time", label: "Tempo", unit: "s", aliases: ["time", "timestamp", "tempo", "t", "seconds", "sec"] },
  {
    key: "distance",
    label: "Distanza",
    unit: "m",
    aliases: ["distance", "distanza", "dist", "meter", "meters", "distanceongpsspeed", "distanceonvehiclespeed"],
  },
  { key: "lap", label: "Giro", unit: "", aliases: ["lap", "giro", "lapnumber", "nrgiro", "lapno"] },
  {
    key: "speed",
    label: "Velocità",
    unit: "km/h",
    aliases: ["gpsspeed", "rsrv4bkspeed", "vehiclespeed", "speed", "velocita", "velocità", "vvehicle", "kmh"],
  },
  { key: "rpm", label: "RPM", unit: "rpm", aliases: ["rsv4rpm", "rpm", "engine rpm", "motore", "engine", "girimotore"] },
  {
    key: "throttle",
    label: "Gas / Throttle",
    unit: "%",
    aliases: ["rsv4thrthand", "v4mpthrottle", "throttle", "gas", "acceleratore", "tps", "accel"],
  },
  { key: "brake", label: "Freno", unit: "%", aliases: ["brakepressbias", "brake", "freno", "brakepedal", "brake position"] },
  {
    key: "brake_pressure",
    label: "Pressione freno",
    unit: "bar",
    aliases: ["brakepresfron", "brakepresfront", "brakepresrear", "brakepressure", "pressionefreno", "brake press", "pbrake"],
  },
  { key: "gear", label: "Marcia", unit: "", aliases: ["rsv4gear", "gear", "marcia", "rapport", "gearposition"] },
  {
    key: "water_temp",
    label: "Temp. acqua",
    unit: "°C",
    aliases: ["rsv4engtemp", "engtemp", "watertemp", "h2otemp", "tempacqua", "water", "ect"],
  },
  { key: "oil_temp", label: "Temp. olio", unit: "°C", aliases: ["engineoiltem", "oiltemp", "tempolio", "toil", "oil temperature"] },
  { key: "oil_pressure", label: "Pressione olio", unit: "bar", aliases: ["engineoilpre", "oilpumpinpre", "oilpressure", "pressioneolio", "poil", "oil press"] },
  { key: "fuel_pressure", label: "Pressione benzina", unit: "bar", aliases: ["fuelpressure", "pressionebenzina", "pfuel", "fuel press"] },
  { key: "exhaust_temp", label: "Temp. scarico", unit: "°C", aliases: ["egt", "exhaust", "tempscarico", "exhausttemp"] },
  { key: "gps_lat", label: "GPS latitudine", unit: "deg", aliases: ["gpslatitude", "lat", "latitude", "gpslat", "latitudine"] },
  { key: "gps_lon", label: "GPS longitudine", unit: "deg", aliases: ["gpslongitude", "lon", "lng", "longitude", "gpslon", "longitudine"] },
  { key: "lateral_g", label: "G laterale", unit: "g", aliases: ["gpslatacc", "lateralacc", "lateralg", "latg", "g lateral", "gy"] },
  { key: "longitudinal_g", label: "G longitudinale", unit: "g", aliases: ["gpslonacc", "longitudinala", "longitudinalg", "longg", "g longitudinal", "gx"] },
  { key: "steering_angle", label: "Angolo sterzo", unit: "deg", aliases: ["steering", "sterzo", "steeringangle", "angle"] },
  { key: "fuel", label: "Carburante", unit: "L", aliases: ["fuel", "benzina", "carburante", "fuelused", "fuel level"] },
  { key: "battery_voltage", label: "Batteria", unit: "V", aliases: ["rsv4vbatt", "externalvoltage", "battery", "batt", "voltage", "vbatt", "batteria"] },
  { key: "lambda", label: "Lambda", unit: "", aliases: ["lambda", "afr", "lambda1"] },
  { key: "tire_pressure_fl", label: "Pressione gomma ant. sx", unit: "bar", aliases: ["flpressure", "frontleftpressure", "ant sx", "pressioneant sx"] },
  { key: "tire_pressure_fr", label: "Pressione gomma ant. dx", unit: "bar", aliases: ["frpressure", "frontrightpressure", "ant dx", "pressioneant dx"] },
  { key: "tire_pressure_rl", label: "Pressione gomma post. sx", unit: "bar", aliases: ["rlpressure", "rearleftpressure", "post sx", "pressionepost sx"] },
  { key: "tire_pressure_rr", label: "Pressione gomma post. dx", unit: "bar", aliases: ["rrpressure", "rearrightpressure", "post dx", "pressionepost dx"] },
];

const CHANNEL_BY_KEY = new Map(CHANNEL_DEFINITIONS.map((definition) => [definition.key, definition]));

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const delimiters = [";", ",", "\t"];
  let bestDelimiter = ";";
  let bestCount = -1;

  delimiters.forEach((delimiter) => {
    let insideQuotes = false;
    let count = 0;
    for (let index = 0; index < firstLine.length; index += 1) {
      const char = firstLine[index];
      if (char === '"') insideQuotes = !insideQuotes;
      if (!insideQuotes && char === delimiter) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  });

  return bestDelimiter;
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (!insideQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
      if (rows.length > MAX_PARSED_ROWS) break;
      continue;
    }

    current += char;
  }

  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  return rows;
}

function detectChannelKey(header: string, unit?: string): ChannelKey {
  const normalized = normalizeHeader(header);
  const normalizedUnit = normalizeHeader(unit || "");
  if (!normalized) return "ignore";

  const exactAimRules: Array<[RegExp, ChannelKey]> = [
    [/^time$/, "time"],
    [/^gpsspeed$/, "speed"],
    [/^rsv4rpm$/, "rpm"],
    [/^rsv4gear$/, "gear"],
    [/^rsv4thrthand$/, "throttle"],
    [/^v4mpthrottle$/, "throttle"],
    [/^brakepressbias$/, "brake"],
    [/^brakepresfron/, "brake_pressure"],
    [/^brakepresrear/, "brake_pressure"],
    [/^steering$/, "steering_angle"],
    [/^gpslatitude$/, "gps_lat"],
    [/^gpslongitude$/, "gps_lon"],
    [/^gpslatacc$/, "lateral_g"],
    [/^gpslonacc$/, "longitudinal_g"],
    [/^longitudinala$/, "longitudinal_g"],
    [/^lateralacc$/, "lateral_g"],
    [/^rsv4engtemp$/, "water_temp"],
    [/^engineoiltem$/, "oil_temp"],
    [/^engineoilpre$/, "oil_pressure"],
    [/^fuelpressure$/, "fuel_pressure"],
    [/^rsv4vbatt$/, "battery_voltage"],
    [/^externalvoltage$/, "battery_voltage"],
    [/^distanceongpsspeed$/, "distance"],
  ];

  const exactRule = exactAimRules.find(([pattern]) => pattern.test(normalized));
  if (exactRule) return exactRule[1];

  // Evita falsi positivi frequenti negli export AIM.
  if (normalized.includes("nsat") || normalized.includes("accuracy") || normalized.includes("radius")) return "ignore";
  if (normalized === "rsv4bkspeed" && normalizedUnit !== "kmh") return "ignore";

  for (const definition of CHANNEL_DEFINITIONS) {
    if (definition.key === "ignore") continue;
    const aliases = definition.aliases.map(normalizeHeader);
    if (aliases.some((alias) => alias && (normalized === alias || normalized.includes(alias)))) {
      return definition.key;
    }
  }

  return "ignore";
}

function parseAimSegmentTime(value: string | undefined | null): number | null {
  return parseTimeToSeconds(value || null);
}

function extractAimCsvMetadata(rows: string[][]): AimCsvMetadata | undefined {
  const firstRow = rows[0] || [];
  if (normalizeHeader(firstRow[0] || "") !== "format" || normalizeHeader(firstRow[1] || "") !== "aimcsvfile") {
    return undefined;
  }

  const metadata: AimCsvMetadata = {
    isAimCsv: true,
    format: "AiM CSV File",
    session: null,
    vehicle: null,
    racer: null,
    championship: null,
    date: null,
    time: null,
    sampleRate: null,
    durationSeconds: null,
    beaconMarkers: [],
    segmentTimes: [],
  };

  rows.forEach((row) => {
    const key = normalizeHeader(row[0] || "");
    const value = row[1] || null;

    if (key === "session") metadata.session = value;
    if (key === "vehicle") metadata.vehicle = value;
    if (key === "racer") metadata.racer = value;
    if (key === "championship") metadata.championship = value;
    if (key === "date") metadata.date = value;
    if (key === "time") metadata.time = value;
    if (key === "samplerate") metadata.sampleRate = parseNumeric(value);
    if (key === "duration") metadata.durationSeconds = parseNumeric(value);
    if (key === "beaconmarkers") {
      metadata.beaconMarkers = row
        .slice(1)
        .map((cell) => parseNumeric(cell))
        .filter((number): number is number => number !== null);
    }
    if (key === "segmenttimes") {
      metadata.segmentTimes = row
        .slice(1)
        .map((cell) => parseAimSegmentTime(cell))
        .filter((number): number is number => number !== null);
    }
  });

  return metadata;
}

function findTelemetryHeaderIndex(rows: string[][]) {
  const directIndex = rows.findIndex((row) => normalizeHeader(row[0] || "") === "time" && row.length >= 4);
  if (directIndex >= 0) return directIndex;

  return rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes("time") && normalized.some((cell) => cell.includes("speed") || cell.includes("rpm"));
  });
}

function looksLikeUnitRow(row: string[] | undefined, headerLength: number) {
  if (!row || row.length !== headerLength) return false;
  const normalized = row.map((cell) => normalizeHeader(cell));
  const knownUnits = new Set(["s", "kmh", "rpm", "g", "deg", "degs", "m", "mm", "c", "v", "bar", "gear", "ms", "a"]);
  const matches = normalized.filter((cell) => !cell || knownUnits.has(cell)).length;
  return matches >= Math.max(2, Math.floor(headerLength * 0.35));
}

function makeUniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `Colonna ${index + 1}`;
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function channelPriority(header: string, key: ChannelKey) {
  const normalized = normalizeHeader(header);
  if (key === "speed") {
    if (normalized === "gpsspeed") return 100;
    if (normalized.includes("bkspeed")) return 70;
  }
  if (key === "distance") {
    if (normalized.includes("gpsspeed")) return 100;
    if (normalized.includes("vehiclespeed")) return 70;
  }
  if (key === "throttle") {
    if (normalized.includes("thrthand")) return 100;
    if (normalized.includes("v4mpthrottle")) return 90;
    if (normalized.includes("tps")) return 70;
  }
  if (key === "brake_pressure") {
    if (normalized.includes("fron")) return 100;
    if (normalized.includes("rear")) return 80;
  }
  return 50;
}

function buildInitialCsvMapping(headers: string[], units: Record<string, string>) {
  const mapping: Record<string, ChannelKey> = {};
  const chosenByKey = new Map<ChannelKey, { header: string; priority: number }>();

  headers.forEach((header) => {
    const key = detectChannelKey(header, units[header]);
    if (key === "ignore") {
      mapping[header] = "ignore";
      return;
    }

    const priority = channelPriority(header, key);
    const previous = chosenByKey.get(key);

    if (!previous) {
      chosenByKey.set(key, { header, priority });
      mapping[header] = key;
      return;
    }

    if (priority > previous.priority) {
      mapping[previous.header] = "ignore";
      chosenByKey.set(key, { header, priority });
      mapping[header] = key;
      return;
    }

    mapping[header] = "ignore";
  });

  return mapping;
}

function getAimLapBoundaries(aimMetadata?: AimCsvMetadata) {
  if (!aimMetadata?.isAimCsv || !aimMetadata.segmentTimes?.length || aimMetadata.segmentTimes.length < 3) {
    return [] as { lapNumber: number; start: number; end: number; lapTime: number }[];
  }

  // Segment Times AIM: segmento 0 = out lap, segmenti 1..n-2 = giri validi, ultimo = in lap.
  // Usiamo questi tempi per creare confini cumulativi, più affidabili dei Beacon Markers
  // su alcuni export Race Studio dove i marker non sono sempre coerenti con i campioni.
  const cumulativeStarts: number[] = [];
  let cursor = 0;
  aimMetadata.segmentTimes.forEach((segmentTime) => {
    cumulativeStarts.push(cursor);
    cursor += Number.isFinite(segmentTime) ? segmentTime : 0;
  });

  return aimMetadata.segmentTimes
    .map((lapTime, segmentIndex) => ({
      lapNumber: segmentIndex,
      start: cumulativeStarts[segmentIndex] ?? 0,
      end: (cumulativeStarts[segmentIndex] ?? 0) + lapTime,
      lapTime,
    }))
    .filter((item, segmentIndex, all) => segmentIndex > 0 && segmentIndex < all.length - 1 && item.lapTime > 0);
}

function deriveAimLapNumber(timeSeconds: number | null, aimMetadata?: AimCsvMetadata) {
  if (timeSeconds === null || !aimMetadata?.isAimCsv) return null;

  const boundaries = getAimLapBoundaries(aimMetadata);
  if (boundaries.length > 0) {
    const match = boundaries.find((lap) => timeSeconds >= lap.start && timeSeconds <= lap.end);
    return match?.lapNumber ?? null;
  }

  // Fallback per export AIM che hanno solo Beacon Markers cumulativi.
  if (!aimMetadata.beaconMarkers?.length) return null;
  const markers = aimMetadata.beaconMarkers;
  const segmentIndex = markers.findIndex((marker) => timeSeconds <= marker);
  const resolvedSegmentIndex = segmentIndex >= 0 ? segmentIndex : markers.length - 1;
  if (resolvedSegmentIndex <= 0 || resolvedSegmentIndex >= markers.length - 1) return null;
  return resolvedSegmentIndex;
}

function parseNumeric(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const cleaned = trimmed
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9eE+\-.]/g, "");

  if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "+") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function parseTimeToSeconds(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.includes(":")) {
    const parts = raw.split(":").map((part) => parseNumeric(part));
    if (parts.some((part) => part === null)) return null;
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }

  return parseNumeric(raw);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTelemetry(value: number | null | undefined, decimals = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value?: number | null, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("it-IT", { maximumFractionDigits: decimals });
}

function getSampleValue(sample: TelemetrySample, channelKey: string): number | null {
  const values = sample.values_json || {};
  const value = values[channelKey];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getAxisValue(sample: TelemetrySample, axis: AnalysisAxis): number | null {
  if (axis === "time") return typeof sample.time_seconds === "number" ? sample.time_seconds : null;
  if (axis === "distance") return typeof sample.distance_m === "number" ? sample.distance_m : null;
  return typeof sample.sample_index === "number" ? sample.sample_index : null;
}

function channelDisplayName(channel?: TelemetryChannel, fallback?: string) {
  if (channel?.display_name) return channel.display_name;
  const definition = fallback ? CHANNEL_BY_KEY.get(fallback as ChannelKey) : undefined;
  return definition?.label || fallback || "Canale";
}

function channelUnit(channel?: TelemetryChannel, fallback?: string) {
  if (channel?.unit) return channel.unit;
  const definition = fallback ? CHANNEL_BY_KEY.get(fallback as ChannelKey) : undefined;
  return definition?.unit || "";
}

function channelStats(samples: TelemetrySample[], channelKey: string) {
  const values = samples
    .map((sample) => getSampleValue(sample, channelKey))
    .filter((value): value is number => value !== null);

  return {
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    avg: average(values),
  };
}

function analysisAxisLabel(axis: AnalysisAxis) {
  if (axis === "time") return "Tempo";
  if (axis === "distance") return "Distanza";
  return "Numero campione";
}

function analysisAxisUnit(axis: AnalysisAxis) {
  if (axis === "time") return "s";
  if (axis === "distance") return "m";
  return "#";
}

function findNearestSampleIndex(samples: TelemetrySample[], axis: AnalysisAxis, targetX: number) {
  if (samples.length === 0) return null;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  samples.forEach((sample, index) => {
    const axisValue = getAxisValue(sample, axis) ?? index;
    const delta = Math.abs(axisValue - targetX);
    if (delta < nearestDistance) {
      nearestDistance = delta;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function availableLapNumbersFromSamples(samples: TelemetrySample[]) {
  return Array.from(
    new Set(
      samples
        .map((sample) => sample.lap_number)
        .filter((lap): lap is number => typeof lap === "number" && Number.isFinite(lap))
    )
  ).sort((a, b) => a - b);
}

function bestLapNumberForFile(laps: TelemetryLap[], telemetryFileId: string) {
  const validLaps = laps
    .filter((lap) => lap.telemetry_file_id === telemetryFileId && typeof lap.lap_number === "number" && typeof lap.lap_time_seconds === "number")
    .sort((a, b) => (a.lap_time_seconds || Number.POSITIVE_INFINITY) - (b.lap_time_seconds || Number.POSITIVE_INFINITY));

  return validLaps[0]?.lap_number ?? null;
}

function lapTimeForNumber(laps: TelemetryLap[], telemetryFileId: string, lapNumber: number | null) {
  if (lapNumber === null) return null;
  return laps.find((lap) => lap.telemetry_file_id === telemetryFileId && lap.lap_number === lapNumber)?.lap_time_seconds ?? null;
}

function resolveLapSelection(selection: string, bestLapNumber: number | null) {
  if (selection === "all") return null;
  if (selection === "best") return bestLapNumber;
  const parsed = Number(selection);
  return Number.isFinite(parsed) ? parsed : null;
}

function samplesForLap(samples: TelemetrySample[], lapNumber: number | null) {
  if (lapNumber === null) return samples;
  return samples.filter((sample) => sample.lap_number === lapNumber);
}

function firstFiniteSampleValue(samples: TelemetrySample[], selector: (sample: TelemetrySample) => number | null | undefined) {
  for (const sample of samples) {
    const value = selector(sample);
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function lastFiniteSampleValue(samples: TelemetrySample[], selector: (sample: TelemetrySample) => number | null | undefined) {
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const value = selector(samples[index]);
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeSamplesForLap(samples: TelemetrySample[], axis: AnalysisAxis) {
  if (samples.length === 0) return samples;

  const baseTime = firstFiniteSampleValue(samples, (sample) => sample.time_seconds) ?? samples[0]?.time_seconds ?? 0;
  const baseDistance = firstFiniteSampleValue(samples, (sample) => sample.distance_m) ?? samples[0]?.distance_m ?? 0;
  const lastDistance = lastFiniteSampleValue(samples, (sample) => sample.distance_m);
  const baseSample = firstFiniteSampleValue(samples, (sample) => sample.sample_index) ?? samples[0]?.sample_index ?? 0;

  // Alcuni export/logger possono avere la distanza che decresce durante il giro.
  // Per l'analisi vogliamo sempre che la distanza segua il verso di percorrenza
  // dei campioni: primo punto = 0, poi valori crescenti.
  const distanceIsReversed =
    typeof baseDistance === "number" &&
    typeof lastDistance === "number" &&
    Number.isFinite(baseDistance) &&
    Number.isFinite(lastDistance) &&
    lastDistance < baseDistance;

  return samples.map((sample, index) => {
    let normalizedDistance = sample.distance_m;
    if (typeof sample.distance_m === "number" && typeof baseDistance === "number") {
      normalizedDistance = distanceIsReversed ? baseDistance - sample.distance_m : sample.distance_m - baseDistance;
      if (Number.isFinite(normalizedDistance) && normalizedDistance < 0 && Math.abs(normalizedDistance) < 0.001) {
        normalizedDistance = 0;
      }
    }

    return {
      ...sample,
      time_seconds: typeof sample.time_seconds === "number" ? sample.time_seconds - baseTime : sample.time_seconds,
      distance_m: normalizedDistance,
      sample_index: typeof sample.sample_index === "number" ? sample.sample_index - baseSample : index,
    };
  });
}

function mirrorSamplesOnAxis(samples: TelemetrySample[], axis: AnalysisAxis) {
  if (samples.length === 0) return samples;

  const axisValues = samples
    .map((sample, index) => getAxisValue(sample, axis) ?? index)
    .filter((value): value is number => Number.isFinite(value));

  if (axisValues.length < 2) return samples;

  const minAxis = Math.min(...axisValues);
  const maxAxis = Math.max(...axisValues);

  return samples.map((sample, index) => {
    const currentValue = getAxisValue(sample, axis) ?? index;
    const mirroredValue = minAxis + maxAxis - currentValue;

    if (axis === "time") {
      return { ...sample, time_seconds: mirroredValue };
    }
    if (axis === "distance") {
      return { ...sample, distance_m: mirroredValue };
    }
    return { ...sample, sample_index: mirroredValue };
  });
}


type TrackGpsPoint = {
  sample: TelemetrySample;
  lat: number;
  lon: number;
};

type TrackSpeedLoss = {
  x: number;
  loss: number;
  primarySpeed: number;
  comparisonSpeed: number;
  sample: TelemetrySample;
};

function gpsPointForSample(sample: TelemetrySample): TrackGpsPoint | null {
  const lat = getSampleValue(sample, "gps_lat");
  const lon = getSampleValue(sample, "gps_lon");
  if (lat === null || lon === null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { sample, lat, lon };
}

function downsamplePoints<T>(points: T[], maxPoints = 900) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0);
}

function buildGpsTrackPoints(samples: TelemetrySample[]) {
  return samples.map(gpsPointForSample).filter((point): point is TrackGpsPoint => point !== null);
}

function TrackMapSvg({
  samples,
  comparisonSamples = [],
  highlightedSamples = [],
  highlightedComparisonSamples = [],
  activeSample,
  activeComparisonSample,
  hasComparison,
  primaryLabel,
  comparisonLabel,
  speedLosses = [],
}: {
  samples: TelemetrySample[];
  comparisonSamples?: TelemetrySample[];
  highlightedSamples?: TelemetrySample[];
  highlightedComparisonSamples?: TelemetrySample[];
  activeSample: TelemetrySample | null;
  activeComparisonSample: TelemetrySample | null;
  hasComparison: boolean;
  primaryLabel: string;
  comparisonLabel: string;
  speedLosses?: TrackSpeedLoss[];
}) {
  const primaryGps = buildGpsTrackPoints(samples);
  const comparisonGps = buildGpsTrackPoints(comparisonSamples);
  const highlightedPrimaryGps = buildGpsTrackPoints(highlightedSamples);
  const highlightedComparisonGps = buildGpsTrackPoints(highlightedComparisonSamples);
  const allGps = [...primaryGps, ...comparisonGps];

  if (allGps.length < 5) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm text-[var(--text-muted)]">
        <div className="font-semibold text-[var(--text-primary)]">Mappa pista non disponibile</div>
        <div className="mt-1 text-xs">
          Il file o il giro selezionato non contiene coordinate GPS valide sufficienti per ricostruire il tracciato.
        </div>
      </div>
    );
  }

  const width = 360;
  const height = 300;
  const padding = 24;
  const lats = allGps.map((point) => point.lat);
  const lons = allGps.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latRange = maxLat - minLat || 0.000001;
  const lonRange = maxLon - minLon || 0.000001;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  function project(point: TrackGpsPoint) {
    const rawX = padding + ((point.lon - minLon) / lonRange) * innerWidth;
    const rawY = padding + ((maxLat - point.lat) / latRange) * innerHeight;
    return { x: rawX, y: rawY };
  }

  function pointString(points: TrackGpsPoint[]) {
    return downsamplePoints(points)
      .map((point) => {
        const projected = project(point);
        return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
      })
      .join(" ");
  }

  const activePrimaryGps = activeSample ? gpsPointForSample(activeSample) : null;
  const activeComparisonGps = activeComparisonSample ? gpsPointForSample(activeComparisonSample) : null;
  const activePrimary = activePrimaryGps ? project(activePrimaryGps) : null;
  const activeComparison = activeComparisonGps ? project(activeComparisonGps) : null;
  const isPrimaryZoomed = highlightedPrimaryGps.length > 5 && highlightedPrimaryGps.length < Math.max(primaryGps.length - 4, 0);
  const isComparisonZoomed = highlightedComparisonGps.length > 5 && highlightedComparisonGps.length < Math.max(comparisonGps.length - 4, 0);
  const visibleSpeedLosses = speedLosses
    .map((loss) => {
      const gps = gpsPointForSample(loss.sample);
      return gps ? { ...loss, point: project(gps) } : null;
    })
    .filter((loss): loss is TrackSpeedLoss & { point: { x: number; y: number } } => loss !== null)
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Mappa pista GPS</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Il tracciato resta sempre completo. Lo zoom restringe solo il grafico; sulla mappa viene evidenziato il tratto analizzato.
          </div>
        </div>
        <div className="rounded-full bg-white/[0.075] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
          {allGps.length} punti GPS
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full">
          <rect x="0" y="0" width={width} height={height} fill="#fafafa" />
          <polyline
            points={pointString(primaryGps)}
            fill="none"
            stroke="#111827"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={isPrimaryZoomed ? "0.24" : "0.9"}
          />
          {hasComparison && comparisonGps.length > 5 ? (
            <polyline
              points={pointString(comparisonGps)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="7 7"
              opacity={isComparisonZoomed ? "0.28" : "0.8"}
            />
          ) : null}

          {isPrimaryZoomed ? (
            <polyline
              points={pointString(highlightedPrimaryGps)}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.95"
            />
          ) : null}
          {hasComparison && isComparisonZoomed ? (
            <polyline
              points={pointString(highlightedComparisonGps)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="7 7"
              opacity="0.95"
            />
          ) : null}

          {visibleSpeedLosses.map((loss, index) => (
            <g key={`${loss.x}-${index}`}>
              <circle cx={loss.point.x} cy={loss.point.y} r="6" fill="#dc2626" opacity="0.22" />
              <circle cx={loss.point.x} cy={loss.point.y} r="3.2" fill="#dc2626" stroke="#fff" strokeWidth="1" />
            </g>
          ))}

          {activePrimary ? (
            <g>
              <circle cx={activePrimary.x} cy={activePrimary.y} r="8" fill="#2563eb" opacity="0.18" />
              <circle cx={activePrimary.x} cy={activePrimary.y} r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
            </g>
          ) : null}
          {hasComparison && activeComparison ? (
            <g>
              <circle cx={activeComparison.x} cy={activeComparison.y} r="8" fill="#f59e0b" opacity="0.2" />
              <circle cx={activeComparison.x} cy={activeComparison.y} r="5" fill="#f59e0b" stroke="#111827" strokeWidth="1.5" />
            </g>
          ) : null}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[var(--text-secondary)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-neutral-900" /> tracciato completo</span>
          {isPrimaryZoomed ? <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> tratto analizzato {primaryLabel}</span> : <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> {primaryLabel}</span>}
          {hasComparison ? <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> {isComparisonZoomed ? `tratto analizzato ${comparisonLabel}` : comparisonLabel}</span> : null}
          {visibleSpeedLosses.length ? <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> perdita velocità</span> : null}
        </div>
        {activeSample ? (
          <div className="rounded-xl bg-white/[0.045] px-3 py-2">
            Punto attuale: distanza {formatNumber(activeSample.distance_m, 1)} m · tempo {formatNumber(activeSample.time_seconds, 3)} s · velocità {formatNumber(getSampleValue(activeSample, "speed"), 1)} km/h
          </div>
        ) : null}
      </div>
    </div>
  );
}


function SvgTelemetryChart({
  samples,
  selectedChannels,
  availableChannels,
  axis,
  comparisonSamples = [],
  primaryLabel = "Riferimento",
  comparisonLabel = "Confronto",
}: {
  samples: TelemetrySample[];
  selectedChannels: string[];
  availableChannels: TelemetryChannel[];
  axis: AnalysisAxis;
  comparisonSamples?: TelemetrySample[];
  primaryLabel?: string;
  comparisonLabel?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lockedIndex, setLockedIndex] = useState<number | null>(null);
  const [zoomStartPct, setZoomStartPct] = useState(0);
  const [zoomEndPct, setZoomEndPct] = useState(100);
  const [invertDirection, setInvertDirection] = useState(false);

  const displaySamples = invertDirection ? mirrorSamplesOnAxis(samples, axis) : samples;
  const displayComparisonSamples = invertDirection ? mirrorSamplesOnAxis(comparisonSamples, axis) : comparisonSamples;

  const width = 1120;
  const height = 500;
  const paddingX = 64;
  const paddingY = 50;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const colors = ["#facc15", "#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#ea580c", "#0891b2", "#be123c"];
  const hasComparison = displayComparisonSamples.length > 1;
  const allSamplesForAxis = hasComparison ? [...displaySamples, ...displayComparisonSamples] : displaySamples;

  const rawXValues = allSamplesForAxis
    .map((sample, index) => getAxisValue(sample, axis) ?? index)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const rawMinX = rawXValues.length ? Math.min(...rawXValues) : 0;
  const rawMaxX = rawXValues.length ? Math.max(...rawXValues) : Math.max(samples.length - 1, 1);
  const rawRangeX = rawMaxX - rawMinX || 1;
  const minX = rawMinX + (rawRangeX * zoomStartPct) / 100;
  const maxX = rawMinX + (rawRangeX * zoomEndPct) / 100;
  const xRange = maxX - minX || 1;

  function isSampleInVisibleRange(sample: TelemetrySample, index: number) {
    const x = getAxisValue(sample, axis) ?? index;
    return x >= minX && x <= maxX;
  }

  const visiblePrimarySamples = displaySamples.filter((sample, index) => isSampleInVisibleRange(sample, index));
  const visibleComparisonSamples = displayComparisonSamples.filter((sample, index) => isSampleInVisibleRange(sample, index));

  function pointsForChannel(dataset: TelemetrySample[], channelKey: string, minY: number, yRange: number) {
    return dataset
      .map((sample, sampleIndex) => {
        const y = getSampleValue(sample, channelKey);
        const x = getAxisValue(sample, axis) ?? sampleIndex;
        if (y === null || x < minX || x > maxX) return null;
        const svgX = paddingX + ((x - minX) / xRange) * plotWidth;
        const svgY = paddingY + plotHeight - ((y - minY) / yRange) * plotHeight;
        return `${svgX.toFixed(2)},${svgY.toFixed(2)}`;
      })
      .filter(Boolean)
      .join(" ");
  }

  function channelMax(dataset: TelemetrySample[], channelKey: string) {
    const values = dataset
      .map((sample) => getSampleValue(sample, channelKey))
      .filter((value): value is number => value !== null);
    return values.length ? Math.max(...values) : null;
  }

  function channelAvg(dataset: TelemetrySample[], channelKey: string) {
    const values = dataset
      .map((sample) => getSampleValue(sample, channelKey))
      .filter((value): value is number => value !== null);
    return average(values);
  }

  const series = selectedChannels
    .map((channelKey, index) => {
      const primaryValues = visiblePrimarySamples
        .map((sample) => getSampleValue(sample, channelKey))
        .filter((value): value is number => value !== null);
      const comparisonValues = visibleComparisonSamples
        .map((sample) => getSampleValue(sample, channelKey))
        .filter((value): value is number => value !== null);
      const yValues = [...primaryValues, ...comparisonValues];
      const minY = yValues.length ? Math.min(...yValues) : 0;
      const maxY = yValues.length ? Math.max(...yValues) : 1;
      const yRange = maxY - minY || 1;
      const channel = availableChannels.find((item) => item.channel_key === channelKey);

      return {
        channelKey,
        label: channelDisplayName(channel, channelKey),
        unit: channelUnit(channel, channelKey),
        color: colors[index % colors.length],
        primaryPoints: pointsForChannel(displaySamples, channelKey, minY, yRange),
        comparisonPoints: pointsForChannel(displayComparisonSamples, channelKey, minY, yRange),
        minY,
        maxY,
        count: primaryValues.length + comparisonValues.length,
        primaryMax: channelMax(visiblePrimarySamples, channelKey),
        comparisonMax: channelMax(visibleComparisonSamples, channelKey),
        primaryAvg: channelAvg(visiblePrimarySamples, channelKey),
        comparisonAvg: channelAvg(visibleComparisonSamples, channelKey),
        yForValue(value: number) {
          return paddingY + plotHeight - ((value - minY) / yRange) * plotHeight;
        },
      };
    })
    .filter((item) => item.count > 1 && item.primaryPoints);

  const activeIndex = lockedIndex ?? hoveredIndex;
  const activeSample = activeIndex !== null ? visiblePrimarySamples[activeIndex] : null;
  const activeX = activeSample ? getAxisValue(activeSample, axis) ?? activeIndex ?? 0 : null;
  const activeSvgX = activeX !== null ? paddingX + ((activeX - minX) / xRange) * plotWidth : null;
  const activeComparisonIndex = activeX !== null && hasComparison ? findNearestSampleIndex(visibleComparisonSamples, axis, activeX) : null;
  const activeComparisonSample = activeComparisonIndex !== null ? visibleComparisonSamples[activeComparisonIndex] : null;

  const speedLosses = hasComparison
    ? visiblePrimarySamples
        .map((sample, index) => {
          if (index % 4 !== 0) return null;
          const x = getAxisValue(sample, axis) ?? index;
          const comparisonIndex = findNearestSampleIndex(visibleComparisonSamples, axis, x);
          const comparisonSample = comparisonIndex !== null ? visibleComparisonSamples[comparisonIndex] : null;
          const primarySpeed = getSampleValue(sample, "speed");
          const comparisonSpeed = comparisonSample ? getSampleValue(comparisonSample, "speed") : null;
          if (primarySpeed === null || comparisonSpeed === null) return null;
          const loss = primarySpeed - comparisonSpeed;
          if (loss <= 3) return null;
          return { x, loss, primarySpeed, comparisonSpeed, sample };
        })
        .filter((item): item is TrackSpeedLoss => item !== null)
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 3)
    : [];

  const hasZoom = zoomStartPct > 0 || zoomEndPct < 100;

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const clampedSvgX = Math.min(Math.max(svgX, paddingX), paddingX + plotWidth);
    const targetX = minX + ((clampedSvgX - paddingX) / plotWidth) * xRange;
    const nearest = findNearestSampleIndex(visiblePrimarySamples, axis, targetX);
    setHoveredIndex(nearest);
  }

  function setPresetZoom(start: number, end: number) {
    setLockedIndex(null);
    setHoveredIndex(null);
    setZoomStartPct(start);
    setZoomEndPct(end);
  }

  if (displaySamples.length === 0 || series.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 text-sm text-[var(--text-muted)]">
        Nessun dato sufficiente per disegnare il grafico. Importa un CSV con campioni validi e almeno un canale numerico.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasComparison ? (
        <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-yellow-100">Confronto attivo</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                <span>{primaryLabel}</span>
                <span className="mx-2 text-[var(--text-muted)]">vs</span>
                <span>{comparisonLabel}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-xl bg-white/[0.08] px-3 py-2">
                <div className="text-[var(--text-muted)]">Punti rif.</div>
                <div className="font-bold text-[var(--text-primary)]">{visiblePrimarySamples.length}</div>
              </div>
              <div className="rounded-xl bg-white/[0.08] px-3 py-2">
                <div className="text-[var(--text-muted)]">Punti conf.</div>
                <div className="font-bold text-[var(--text-primary)]">{visibleComparisonSamples.length}</div>
              </div>
              <div className="rounded-xl bg-white/[0.08] px-3 py-2">
                <div className="text-[var(--text-muted)]">V max rif.</div>
                <div className="font-bold text-[var(--text-primary)]">{formatNumber(channelMax(visiblePrimarySamples, "speed"), 1)} km/h</div>
              </div>
              <div className="rounded-xl bg-white/[0.08] px-3 py-2">
                <div className="text-[var(--text-muted)]">V max conf.</div>
                <div className="font-bold text-[var(--text-primary)]">{formatNumber(channelMax(visibleComparisonSamples, "speed"), 1)} km/h</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-3">
        <div className="mb-3 flex flex-col gap-3 text-xs text-[var(--text-muted)] xl:flex-row xl:items-center xl:justify-between">
          <div>
            Asse orizzontale: <span className="font-bold text-[var(--text-primary)]">{analysisAxisLabel(axis)}</span>. Muovi il mouse sul grafico per leggere i valori; clicca per bloccare/sbloccare il riferimento.
            {hasComparison ? <span className="ml-2 font-semibold text-yellow-200">Linea piena: {primaryLabel}. Linea tratteggiata: {comparisonLabel}.</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPresetZoom(0, 100)} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-1.5 font-semibold text-[var(--text-secondary)] transition hover:bg-[rgba(16,23,31,0.96)]">
              Tutto il giro
            </button>
            <button type="button" onClick={() => setPresetZoom(25, 75)} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-1.5 font-semibold text-[var(--text-secondary)] transition hover:bg-[rgba(16,23,31,0.96)]">
              Zoom 50%
            </button>
            <button type="button" onClick={() => setPresetZoom(37, 63)} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-1.5 font-semibold text-[var(--text-secondary)] transition hover:bg-[rgba(16,23,31,0.96)]">
              Zoom 25%
            </button>
            <button
              type="button"
              onClick={() => {
                setLockedIndex(null);
                setHoveredIndex(null);
                setInvertDirection((current) => !current);
              }}
              className={`rounded-xl border px-3 py-1.5 font-semibold transition ${
                invertDirection
                  ? "border-yellow-400/35 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/20"
                  : "border-white/10 bg-white/[0.045] text-[var(--text-secondary)] hover:bg-[rgba(16,23,31,0.96)]"
              }`}
            >
              {invertDirection ? "Verso invertito attivo" : "Inverti verso"}
            </button>
            {lockedIndex !== null ? (
              <button type="button" onClick={() => setLockedIndex(null)} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-1.5 font-semibold text-[var(--text-secondary)] transition hover:bg-[rgba(16,23,31,0.96)]">
                Sblocca riferimento
              </button>
            ) : null}
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="mb-2 flex flex-col gap-1 text-xs text-[var(--text-muted)] md:flex-row md:items-center md:justify-between">
            <span className="font-semibold text-[var(--text-secondary)]">Finestra di analisi / zoom</span>
            <span>
              {analysisAxisLabel(axis)}: {formatNumber(minX, 2)} → {formatNumber(maxX, 2)} {analysisAxisUnit(axis)}
              {hasZoom ? <span className="ml-2 font-semibold text-yellow-200">zoom attivo</span> : null}
              {invertDirection ? <span className="ml-2 font-semibold text-yellow-200">verso invertito</span> : null}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Inizio finestra: {zoomStartPct}%
              <input
                type="range"
                min="0"
                max="99"
                value={zoomStartPct}
                onChange={(event) => {
                  setLockedIndex(null);
                  setZoomStartPct(Math.min(Number(event.target.value), zoomEndPct - 1));
                }}
                className="mt-2 w-full accent-yellow-500"
              />
            </label>
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Fine finestra: {zoomEndPct}%
              <input
                type="range"
                min="1"
                max="100"
                value={zoomEndPct}
                onChange={(event) => {
                  setLockedIndex(null);
                  setZoomEndPct(Math.max(Number(event.target.value), zoomStartPct + 1));
                }}
                className="mt-2 w-full accent-yellow-500"
              />
            </label>
          </div>
          {invertDirection ? (
            <div className="mt-3 rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-2 text-xs leading-5 text-yellow-100">
              Lettura invertita attiva: il cursore, il grafico e il pallino sulla pista scorrono nel verso opposto. Usala quando un export/logger visualizza il giro da fine a inizio.
            </div>
          ) : null}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-2 text-xs text-[var(--text-muted)]">
            <div className="px-2 pb-2 font-semibold text-[var(--text-secondary)]">Grafico canali</div>
            <div className="overflow-x-auto">
              <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[920px] cursor-crosshair select-none"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoveredIndex(null)}
            onClick={() => {
              if (hoveredIndex === null) return;
              setLockedIndex((current) => (current === hoveredIndex ? null : hoveredIndex));
            }}
          >
            <rect x={paddingX} y={paddingY} width={plotWidth} height={plotHeight} rx="14" fill="#fafafa" />
            <line x1={paddingX} y1={paddingY + plotHeight} x2={paddingX + plotWidth} y2={paddingY + plotHeight} stroke="#d4d4d4" />
            <line x1={paddingX} y1={paddingY} x2={paddingX} y2={paddingY + plotHeight} stroke="#d4d4d4" />
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1={paddingX} y1={paddingY + plotHeight * ratio} x2={paddingX + plotWidth} y2={paddingY + plotHeight * ratio} stroke="#e5e5e5" strokeDasharray="5 5" />
            ))}
            {series.map((item) => (
              <g key={item.channelKey}>
                <polyline points={item.primaryPoints} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                {hasComparison && item.comparisonPoints ? (
                  <polyline points={item.comparisonPoints} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="7 7" opacity="0.75" />
                ) : null}
              </g>
            ))}

            {activeSample && activeSvgX !== null ? (
              <>
                <line x1={activeSvgX} y1={paddingY} x2={activeSvgX} y2={paddingY + plotHeight} stroke="#111827" strokeWidth="1.6" strokeDasharray="6 4" />
                {series.map((item) => {
                  const value = getSampleValue(activeSample, item.channelKey);
                  if (value === null) return null;
                  return <circle key={item.channelKey} cx={activeSvgX} cy={item.yForValue(value)} r="4" fill={item.color} stroke="#111827" strokeWidth="1" />;
                })}
                {hasComparison && activeComparisonSample ? series.map((item) => {
                  const value = getSampleValue(activeComparisonSample, item.channelKey);
                  if (value === null) return null;
                  return <rect key={`cmp-${item.channelKey}`} x={activeSvgX - 3} y={item.yForValue(value) - 3} width="6" height="6" fill={item.color} stroke="#111827" strokeWidth="1" />;
                }) : null}
              </>
            ) : null}

            <text x={paddingX} y={height - 10} fontSize="12" fill="#737373">
              {analysisAxisLabel(axis)}{analysisAxisUnit(axis) ? ` (${analysisAxisUnit(axis)})` : ""}: {formatNumber(minX, 2)} → {formatNumber(maxX, 2)}
            </text>
            <text x={paddingX} y="24" fontSize="12" fill="#737373">
              Linee normalizzate per canale: utile per confrontare andamento; i valori reali sono nei pannelli riepilogo.
            </text>
              </svg>
            </div>
          </div>
          <TrackMapSvg
            samples={displaySamples}
            comparisonSamples={displayComparisonSamples}
            highlightedSamples={visiblePrimarySamples}
            highlightedComparisonSamples={visibleComparisonSamples}
            activeSample={activeSample}
            activeComparisonSample={activeComparisonSample}
            hasComparison={hasComparison}
            primaryLabel={primaryLabel}
            comparisonLabel={comparisonLabel}
            speedLosses={speedLosses}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Riferimento cursore</div>
          {activeSample ? (
            <div className="mt-2 space-y-1 text-[var(--text-secondary)]">
              <div><span className="font-semibold text-[var(--text-primary)]">Campione:</span> {activeSample.sample_index ?? activeIndex}</div>
              <div><span className="font-semibold text-[var(--text-primary)]">Tempo:</span> {formatNumber(activeSample.time_seconds, 3)} s</div>
              <div><span className="font-semibold text-[var(--text-primary)]">Distanza:</span> {formatNumber(activeSample.distance_m, 2)} m</div>
              <div><span className="font-semibold text-[var(--text-primary)]">Giro:</span> {activeSample.lap_number ?? "—"}</div>
              {activeComparisonSample ? (
                <div className="mt-2 rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                  Confronto: tempo {formatNumber(activeComparisonSample.time_seconds, 3)} s · distanza {formatNumber(activeComparisonSample.distance_m, 2)} m · giro {activeComparisonSample.lap_number ?? "—"}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-[var(--text-muted)]">Muovi il mouse sul grafico per leggere i valori.</div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Dati nel punto selezionato</div>
              <div className="text-xs text-[var(--text-muted)]">Valori reali del riferimento, del confronto e differenza tra i due.</div>
            </div>
            {activeSample && activeComparisonSample ? <div className="text-xs font-semibold text-yellow-200">Delta = riferimento - confronto</div> : null}
          </div>
          {activeSample ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="py-2 pr-3">Canale</th>
                    <th className="py-2 pr-3">Riferimento</th>
                    {activeComparisonSample ? <th className="py-2 pr-3">Confronto</th> : null}
                    {activeComparisonSample ? <th className="py-2 pr-3">Delta</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {series.map((item) => {
                    const value = getSampleValue(activeSample, item.channelKey);
                    const comparisonValue = activeComparisonSample ? getSampleValue(activeComparisonSample, item.channelKey) : null;
                    const delta = value !== null && comparisonValue !== null ? value - comparisonValue : null;
                    return (
                      <tr key={item.channelKey} className="border-b border-white/10 last:border-0">
                        <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">
                          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}{item.unit ? ` (${item.unit})` : ""}
                        </td>
                        <td className="py-2 pr-3 text-[var(--text-secondary)]">{formatNumber(value, 3)}</td>
                        {activeComparisonSample ? <td className="py-2 pr-3 text-[var(--text-secondary)]">{formatNumber(comparisonValue, 3)}</td> : null}
                        {activeComparisonSample ? <td className={`py-2 pr-3 font-semibold ${delta !== null && Math.abs(delta) > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{formatNumber(delta, 3)}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">Nessun punto selezionato.</div>
          )}
        </div>
      </div>

      {hasComparison ? (
        <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Suggerimenti automatici da verificare</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-white/[0.045] p-3 text-sm text-[var(--text-secondary)]">
              <div className="font-semibold text-[var(--text-primary)]">Sintesi canali selezionati nella finestra</div>
              <div className="mt-2 space-y-1 text-xs">
                {series.slice(0, 6).map((item) => (
                  <div key={item.channelKey} className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      max {formatNumber(item.primaryMax, 2)} / {formatNumber(item.comparisonMax, 2)} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-yellow-500/10 p-3 text-sm text-yellow-100">
              <div className="font-semibold">Possibili punti dove il confronto perde velocità</div>
              {speedLosses.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {speedLosses.map((item) => (
                    <li key={`${item.x}-${item.loss}`}>
                      circa {formatNumber(item.x, 0)} {analysisAxisUnit(axis)}: confronto più lento di {formatNumber(item.loss, 1)} km/h ({formatNumber(item.primarySpeed, 1)} vs {formatNumber(item.comparisonSpeed, 1)}).
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-xs">Nella finestra attuale non vedo perdite velocità evidenti oltre 3 km/h. Prova a restringere la zona o selezionare il canale velocità.</div>
              )}
              <div className="mt-2 text-[11px] text-yellow-100">Indicazioni da verificare con contesto pista, gomme, traffico, meteo, benzina e setup.</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {series.map((item) => (
          <span key={item.channelKey} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}{item.unit ? ` (${item.unit})` : ""}: {formatNumber(item.minY, 2)} / {formatNumber(item.maxY, 2)}
          </span>
        ))}
      </div>
    </div>
  );
}

function validateCsvWizard(wizard: CsvWizardState | null) {
  if (!wizard) return { errors: [] as string[], warnings: [] as string[] };

  const mappedKeys = Object.values(wizard.mapping).filter((key) => key !== "ignore");
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicates = mappedKeys.filter((key, index) => mappedKeys.indexOf(key) !== index);
  const uniqueDuplicates = Array.from(new Set(duplicates));

  if (uniqueDuplicates.length > 0) {
    errors.push(`Ogni canale può essere associato una sola volta. Duplicati: ${uniqueDuplicates.join(", ")}.`);
  }

  const dataChannels = mappedKeys.filter((key) => !["time", "distance", "lap"].includes(key));
  if (dataChannels.length === 0) {
    errors.push("Associa almeno un canale dati, per esempio velocità, RPM, gas o freno.");
  }

  if (!mappedKeys.includes("time")) {
    warnings.push("Manca il canale tempo: durata e grafici time-based potrebbero essere incompleti.");
  }

  if (!mappedKeys.includes("distance")) {
    warnings.push("Manca il canale distanza: la vista Time-Distance stile Race Studio userà il tempo o il numero campione.");
  }

  if (!mappedKeys.includes("lap") && !wizard.aimMetadata?.segmentTimes?.length) {
    warnings.push("Manca il canale giro: non posso calcolare il riepilogo giri automaticamente.");
  }

  if (wizard.aimMetadata?.isAimCsv) {
    warnings.push("File AIM CSV riconosciuto: uso Segment Times AIM per ricostruire i giri e collegare i campioni al giro corretto.");
  }

  if (wizard.rows.length > MAX_STORED_SAMPLES) {
    warnings.push(`Il file ha ${wizard.rows.length} righe: salverò un campionamento di massimo ${MAX_STORED_SAMPLES} punti per i grafici.`);
  }

  return { errors, warnings };
}

function buildParsedTelemetryPayload(wizard: CsvWizardState): ParsedTelemetryPayload {
  const validation = validateCsvWizard(wizard);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join(" "));
  }

  const channelStats = new Map<ChannelKey, { values: number[]; sourceName: string; unit: string }>();
  const parsedRows: ParsedSample[] = [];
  const lapGroups = new Map<number, { times: number[]; speeds: number[] }>();

  wizard.rows.forEach((row, rowIndex) => {
    const valuesJson: Record<string, number> = {};
    let timeSeconds: number | null = null;
    let distanceM: number | null = null;
    let lapNumber: number | null = null;

    wizard.headers.forEach((header, columnIndex) => {
      const key = wizard.mapping[header] || "ignore";
      if (key === "ignore") return;

      const rawValue = row[columnIndex];
      let numeric: number | null;

      if (key === "time") {
        numeric = parseTimeToSeconds(rawValue);
        timeSeconds = numeric;
      } else {
        numeric = parseNumeric(rawValue);
      }

      if (numeric === null) return;

      if (key === "distance") {
        distanceM = numeric;
      } else if (key === "lap") {
        lapNumber = Math.round(numeric);
      } else {
        valuesJson[key] = numeric;
      }

      const stat = channelStats.get(key) || {
        values: [],
        sourceName: header,
        unit: wizard.units[header] || CHANNEL_BY_KEY.get(key)?.unit || "",
      };
      stat.values.push(numeric);
      channelStats.set(key, stat);
    });

    if (lapNumber === null && timeSeconds !== null) {
      lapNumber = deriveAimLapNumber(timeSeconds, wizard.aimMetadata);
    }

    if (Object.keys(valuesJson).length > 0 || timeSeconds !== null || distanceM !== null || lapNumber !== null) {
      parsedRows.push({
        sample_index: rowIndex,
        time_seconds: timeSeconds,
        distance_m: distanceM,
        lap_number: lapNumber,
        values_json: valuesJson,
      });

      if (lapNumber !== null) {
        const group = lapGroups.get(lapNumber) || { times: [], speeds: [] };
        if (timeSeconds !== null) group.times.push(timeSeconds);
        if (typeof valuesJson.speed === "number") group.speeds.push(valuesJson.speed);
        lapGroups.set(lapNumber, group);
      }
    }
  });

  const channels = Array.from(channelStats.entries()).map(([key, stat]) => {
    const definition = CHANNEL_BY_KEY.get(key);
    const minValue = stat.values.length > 0 ? Math.min(...stat.values) : null;
    const maxValue = stat.values.length > 0 ? Math.max(...stat.values) : null;
    const avgValue = average(stat.values);

    return {
      channel_key: key,
      display_name: definition?.label || key,
      source_name: stat.sourceName,
      unit: stat.unit || definition?.unit || "",
      mapped_type: key,
      sample_count: stat.values.length,
      min_value: roundTelemetry(minValue),
      max_value: roundTelemetry(maxValue),
      avg_value: roundTelemetry(avgValue),
    };
  });

  const aimLapBoundaries = getAimLapBoundaries(wizard.aimMetadata);
  const aimHasFullLaps = wizard.aimMetadata?.isAimCsv && aimLapBoundaries.length > 0;
  const lapNumbers = new Set<number>([
    ...Array.from(lapGroups.keys()),
    ...aimLapBoundaries.map((lap) => lap.lapNumber),
  ]);

  const laps = Array.from(lapNumbers)
    .sort((a, b) => a - b)
    .map((lapNumber) => {
      const group = lapGroups.get(lapNumber) || { times: [], speeds: [] };
      const metadataLapTime = aimLapBoundaries.find((lap) => lap.lapNumber === lapNumber)?.lapTime ?? null;
      const calculatedLapTime = group.times.length >= 2 ? Math.max(...group.times) - Math.min(...group.times) : null;
      return {
        lap_number: lapNumber,
        lap_time_seconds: roundTelemetry(metadataLapTime || calculatedLapTime),
        max_speed: roundTelemetry(group.speeds.length > 0 ? Math.max(...group.speeds) : null),
        avg_speed: roundTelemetry(average(group.speeds)),
        notes: aimHasFullLaps ? "Lap ricostruito da Segment Times AIM" : null,
      };
    });

  const sampleStep = Math.max(1, Math.ceil(parsedRows.length / MAX_STORED_SAMPLES));
  const samples = parsedRows.filter((_, index) => index % sampleStep === 0).slice(0, MAX_STORED_SAMPLES);

  const timeValues = parsedRows.map((row) => row.time_seconds).filter((value): value is number => value !== null);
  const speedValues = parsedRows.map((row) => row.values_json.speed).filter((value): value is number => typeof value === "number");
  const rpmValues = parsedRows.map((row) => row.values_json.rpm).filter((value): value is number => typeof value === "number");
  const throttleValues = parsedRows.map((row) => row.values_json.throttle).filter((value): value is number => typeof value === "number");
  const brakeValues = parsedRows
    .map((row) => (typeof row.values_json.brake === "number" ? row.values_json.brake : row.values_json.brake_pressure))
    .filter((value): value is number => typeof value === "number");

  const durationSeconds =
    wizard.aimMetadata?.durationSeconds ||
    (timeValues.length >= 2 ? Math.max(...timeValues) - Math.min(...timeValues) : null);
  const lapTimes = laps.map((lap) => lap.lap_time_seconds).filter((value): value is number => value !== null && value > 0);

  return {
    channels,
    laps,
    samples,
    summary: {
      channels_count: channels.length,
      samples_count: parsedRows.length,
      sampled_points_count: samples.length,
      duration_seconds: roundTelemetry(durationSeconds),
      best_lap_seconds: roundTelemetry(lapTimes.length > 0 ? Math.min(...lapTimes) : null),
      laps_count: laps.length,
      max_speed: roundTelemetry(speedValues.length > 0 ? Math.max(...speedValues) : null),
      max_rpm: roundTelemetry(rpmValues.length > 0 ? Math.max(...rpmValues) : null),
      avg_speed: roundTelemetry(average(speedValues)),
      avg_throttle: roundTelemetry(average(throttleValues)),
      avg_brake: roundTelemetry(average(brakeValues)),
      warnings: validation.warnings,
    },
  };
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
  const [csvWizard, setCsvWizard] = useState<CsvWizardState | null>(null);
  const [parsedCsvDraft, setParsedCsvDraft] = useState<ParsedTelemetryPayload | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [filter, setFilter] = useState("");
  const [archiveViewMode, setArchiveViewMode] = useState<"detailed" | "compact">("compact");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [analysisFile, setAnalysisFile] = useState<TelemetryFile | null>(null);
  const [analysisSamples, setAnalysisSamples] = useState<TelemetrySample[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisAxis, setAnalysisAxis] = useState<AnalysisAxis>("distance");
  const [analysisFullscreen, setAnalysisFullscreen] = useState(false);
  const [analysisPrimaryLap, setAnalysisPrimaryLap] = useState<string>("all");
  const [analysisCompareLap, setAnalysisCompareLap] = useState<string>("none");
  const [analysisCompareFileId, setAnalysisCompareFileId] = useState<string>("");
  const [analysisCompareFileLap, setAnalysisCompareFileLap] = useState<string>("best");
  const [analysisCompareFileSamples, setAnalysisCompareFileSamples] = useState<TelemetrySample[]>([]);
  const [analysisCompareFileLoading, setAnalysisCompareFileLoading] = useState(false);
  const [selectedAnalysisChannels, setSelectedAnalysisChannels] = useState<string[]>([]);

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

  useEffect(() => {
    const savedMode = window.localStorage.getItem("telemetry_archive_view_mode");
    if (savedMode === "compact" || savedMode === "detailed") {
      setArchiveViewMode(savedMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("telemetry_archive_view_mode", archiveViewMode);
  }, [archiveViewMode]);

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


  async function startCsvWizardFromFile(targetFile: File, mode: "new" | "existing", telemetryFileId?: string) {
    setFeedback(null);
    setParsedCsvDraft(mode === "new" ? null : parsedCsvDraft);

    try {
      const text = await targetFile.text();
      const delimiter = detectDelimiter(text);
      const parsedRows = parseDelimitedText(text, delimiter);
      const aimMetadata = extractAimCsvMetadata(parsedRows);
      const headerIndex = findTelemetryHeaderIndex(parsedRows);

      if (headerIndex < 0) {
        throw new Error("Non ho trovato la riga intestazioni dei canali. Per i CSV AIM deve esserci una riga che inizia con Time.");
      }

      const rawHeaders = parsedRows[headerIndex] || [];
      const headers = makeUniqueHeaders(rawHeaders);
      const nextRow = parsedRows[headerIndex + 1];
      const hasUnits = looksLikeUnitRow(nextRow, rawHeaders.length);
      const units = headers.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = hasUnits ? nextRow?.[index] || "" : "";
        return accumulator;
      }, {});

      const rows = parsedRows
        .slice(headerIndex + (hasUnits ? 2 : 1))
        .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
        .map((row) => headers.map((_, index) => row[index] || ""));

      if (headers.length === 0 || rows.length === 0) {
        throw new Error("Il CSV non contiene intestazioni o righe dati leggibili.");
      }

      const mapping = buildInitialCsvMapping(headers, units);

      if (mode === "new" && aimMetadata?.isAimCsv) {
        setForm((current) => ({
          ...current,
          file_name: current.file_name.trim() || targetFile.name,
          source_software: current.source_software.trim() || "AIM Race Studio",
          data_format: "aim_export",
          logger_model: current.logger_model,
          track_name: current.track_name.trim() || aimMetadata.session || "",
          import_status: "pending_parse",
          tags: current.tags.trim() || "aim, race-studio",
        }));
      }

      setCsvWizard({
        mode,
        telemetryFileId,
        fileName: targetFile.name,
        delimiter,
        headers,
        units,
        rows,
        mapping,
        aimMetadata,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore lettura CSV telemetria.";
      setFeedback({ type: "error", message });
    }
  }

  async function saveParsedCsvForFile(telemetryFileId: string, parsedPayload: ParsedTelemetryPayload) {
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.rpc("save_telemetry_parsed_csv", {
      p_team_id: ctx.teamId,
      p_telemetry_file_id: telemetryFileId,
      p_channels: parsedPayload.channels,
      p_laps: parsedPayload.laps,
      p_samples: parsedPayload.samples,
      p_summary: parsedPayload.summary,
    });

    if (error) throw error;
  }

  async function confirmCsvWizard() {
    if (!csvWizard || csvWizard.importing) return;

    try {
      const parsedPayload = buildParsedTelemetryPayload(csvWizard);

      if (csvWizard.mode === "new") {
        setParsedCsvDraft(parsedPayload);
        setCsvWizard(null);
        setFeedback({
          type: "info",
          message: `Canali CSV pronti: ${parsedPayload.summary.channels_count} canali, ${parsedPayload.summary.samples_count} campioni, ${parsedPayload.summary.laps_count} giri. Ora salva il file telemetria per registrare anche i dati importati.`,
        });
        return;
      }

      if (!csvWizard.telemetryFileId) {
        throw new Error("File telemetria non identificato.");
      }

      setCsvWizard({ ...csvWizard, importing: true, error: undefined });
      await saveParsedCsvForFile(csvWizard.telemetryFileId, parsedPayload);
      setCsvWizard(null);
      setFeedback({
        type: "success",
        message: `CSV importato: ${parsedPayload.summary.channels_count} canali, ${parsedPayload.summary.samples_count} campioni letti, ${parsedPayload.summary.sampled_points_count} punti salvati per grafici.`,
      });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore import CSV telemetria.";
      setCsvWizard(csvWizard ? { ...csvWizard, importing: false, error: message } : null);
    }
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

      const { data: insertedFile, error } = await supabase
        .from("telemetry_files")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      if (parsedCsvDraft && insertedFile?.id) {
        await saveParsedCsvForFile(insertedFile.id as string, parsedCsvDraft);
      }

      const importedMessage = parsedCsvDraft
        ? ` Dati CSV importati: ${parsedCsvDraft.summary.channels_count} canali, ${parsedCsvDraft.summary.samples_count} campioni letti, ${parsedCsvDraft.summary.sampled_points_count} punti salvati.`
        : "";

      setForm(buildDefaultForm());
      setFile(null);
      setParsedCsvDraft(null);
      setFeedback({
        type: "success",
        message:
          `File telemetria registrato correttamente.${importedMessage} Ora è collegato ai dati sportivi e pronto per le future analisi canali.`,
      });

      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante il salvataggio del file telemetria.";
      setFeedback({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTelemetryFile(row: TelemetryFile) {
    if (!canEditTelemetry) return;

    const confirmed = window.confirm(
      `Eliminare definitivamente il file telemetria "${row.file_name || "File telemetria"}"?\n\nVerranno eliminati anche canali, giri, campioni grafici e insight collegati.`
    );

    if (!confirmed) return;

    setDeletingFileId(row.id);

    try {
      const ctx = await getCurrentTeamContext();

      const linkedDeletes = await Promise.all([
        supabase.from("telemetry_samples").delete().eq("team_id", ctx.teamId).eq("telemetry_file_id", row.id),
        supabase.from("telemetry_channels").delete().eq("team_id", ctx.teamId).eq("telemetry_file_id", row.id),
        supabase.from("telemetry_laps").delete().eq("team_id", ctx.teamId).eq("telemetry_file_id", row.id),
        supabase.from("telemetry_insights").delete().eq("team_id", ctx.teamId).eq("telemetry_file_id", row.id),
      ]);

      const linkedError = linkedDeletes.find((result) => result.error)?.error;
      if (linkedError) throw linkedError;

      const { error } = await supabase
        .from("telemetry_files")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", row.id);

      if (error) throw error;

      if (row.storage_path) {
        const { error: storageError } = await supabase.storage.from("team-files").remove([row.storage_path]);
        if (storageError) {
          console.warn("File telemetria eliminato dal database, ma non dallo storage:", storageError.message);
        }
      }

      if (analysisFile?.id === row.id) {
        setAnalysisFile(null);
        setAnalysisSamples([]);
        setAnalysisCompareFileId("");
        setAnalysisCompareFileSamples([]);
        setAnalysisCompareFileLap("best");
        setAnalysisFullscreen(false);
      }

      setFeedback({ type: "success", message: "File telemetria eliminato correttamente." });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante l'eliminazione del file telemetria.";
      setFeedback({ type: "error", message });
    } finally {
      setDeletingFileId(null);
    }
  }

  async function fetchTelemetrySamplesForFile(fileId: string) {
    const ctx = await getCurrentTeamContext();
    const pageSize = 1000;
    let from = 0;
    let allSamples: TelemetrySample[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("telemetry_samples")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("telemetry_file_id", fileId)
        .order("sample_index", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const batch = ((data || []) as TelemetrySample[]) || [];
      allSamples = allSamples.concat(batch);

      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return allSamples;
  }

  async function openAnalysis(row: TelemetryFile) {
    setAnalysisFile(row);
    setAnalysisSamples([]);
    setAnalysisLoading(true);
    setAnalysisPrimaryLap("all");
    setAnalysisCompareLap("none");
    setAnalysisCompareFileId("");
    setAnalysisCompareFileLap("best");
    setAnalysisCompareFileSamples([]);

    const rowChannels = channels.filter((channel) => channel.telemetry_file_id === row.id);
    const priority = ["speed", "rpm", "throttle", "brake", "brake_pressure", "gear", "water_temp", "oil_temp"];
    const defaults = priority.filter((key) => rowChannels.some((channel) => channel.channel_key === key));
    const fallback = rowChannels.map((channel) => channel.channel_key || "").filter(Boolean);
    setSelectedAnalysisChannels((defaults.length ? defaults : fallback).slice(0, 4));

    try {
      const allSamples = await fetchTelemetrySamplesForFile(row.id);
      setAnalysisSamples(allSamples);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore caricamento campioni telemetria.";
      setFeedback({ type: "error", message });
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function loadComparisonTelemetryFile(fileId: string) {
    setAnalysisCompareFileId(fileId);
    setAnalysisCompareFileSamples([]);
    setAnalysisCompareFileLap("best");

    if (!fileId) return;

    setAnalysisCompareFileLoading(true);

    try {
      const allSamples = await fetchTelemetrySamplesForFile(fileId);
      setAnalysisCompareFileSamples(allSamples);

      if (analysisPrimaryLap === "all") {
        setAnalysisPrimaryLap("best");
      }
      setAnalysisCompareLap("none");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore caricamento file confronto telemetria.";
      setFeedback({ type: "error", message });
    } finally {
      setAnalysisCompareFileLoading(false);
    }
  }

  const selectedTurn = form.event_car_turn_id ? turns.find((turn) => turn.id === form.event_car_turn_id) : null;
  const analysisLapOptions = analysisFile ? availableLapNumbersFromSamples(analysisSamples) : [];
  const analysisBestLapNumber = analysisFile ? bestLapNumberForFile(laps, analysisFile.id) : null;
  const analysisCompareFile = analysisCompareFileId ? rows.find((row) => row.id === analysisCompareFileId) || null : null;
  const comparisonFileLapOptions = analysisCompareFile ? availableLapNumbersFromSamples(analysisCompareFileSamples) : [];
  const comparisonFileBestLapNumber = analysisCompareFile ? bestLapNumberForFile(laps, analysisCompareFile.id) : null;
  const resolvedPrimaryLap = resolveLapSelection(analysisPrimaryLap, analysisBestLapNumber);
  const resolvedCompareLap = analysisCompareLap === "none" ? null : resolveLapSelection(analysisCompareLap, analysisBestLapNumber);
  const resolvedComparisonFileLap = analysisCompareFile ? resolveLapSelection(analysisCompareFileLap, comparisonFileBestLapNumber) : null;
  const hasExternalComparison = Boolean(analysisCompareFile);
  const rawPrimarySamples = analysisPrimaryLap === "all" ? analysisSamples : samplesForLap(analysisSamples, resolvedPrimaryLap);
  const sameFileCompareSamples = resolvedCompareLap === null ? [] : samplesForLap(analysisSamples, resolvedCompareLap);
  const externalCompareSamples = analysisCompareFile
    ? analysisCompareFileLap === "all"
      ? analysisCompareFileSamples
      : samplesForLap(analysisCompareFileSamples, resolvedComparisonFileLap)
    : [];
  const rawCompareSamples = hasExternalComparison ? externalCompareSamples : sameFileCompareSamples;
  const chartPrimarySamples = normalizeSamplesForLap(rawPrimarySamples, analysisAxis);
  const chartCompareSamples = rawCompareSamples.length > 0 ? normalizeSamplesForLap(rawCompareSamples, analysisAxis) : [];
  const primaryLapTime = analysisFile ? lapTimeForNumber(laps, analysisFile.id, resolvedPrimaryLap) : null;
  const sameFileCompareLapTime = analysisFile ? lapTimeForNumber(laps, analysisFile.id, resolvedCompareLap) : null;
  const externalCompareLapTime = analysisCompareFile ? lapTimeForNumber(laps, analysisCompareFile.id, resolvedComparisonFileLap) : null;
  const compareLapTime = hasExternalComparison ? externalCompareLapTime : sameFileCompareLapTime;
  const primaryLabel = analysisPrimaryLap === "all" ? "Sessione completa" : `Giro ${resolvedPrimaryLap ?? "—"}`;
  const comparisonLabel = hasExternalComparison
    ? `${analysisCompareFile?.file_name || "File confronto"} · ${analysisCompareFileLap === "all" ? "Sessione" : `Giro ${resolvedComparisonFileLap ?? "—"}`}`
    : resolvedCompareLap !== null
      ? `Giro ${resolvedCompareLap}`
      : "Confronto";
  const comparableTelemetryFiles = analysisFile
    ? rows.filter((row) => row.id !== analysisFile.id && (row.sampled_points_count || 0) > 0)
    : [];
  const wizardValidation = validateCsvWizard(csvWizard);

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
    <div className={`flex flex-col gap-6 p-6`}>
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
                  accept=".csv,.txt,.xlsx,.pdf,.zip,video/*,image/*"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] || null;
                    setFile(selectedFile);
                    setParsedCsvDraft(null);
                  }}
                />
              </Field>

              {file && ["csv", "aim_export"].includes(form.data_format) ? (
                <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 text-sm text-sky-200">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-bold">Import guidato CSV disponibile</div>
                      <div className="mt-1 text-xs leading-5">
                        Leggo intestazioni e prime righe, propongo la mappatura dei canali e salvo un campionamento per i grafici futuri.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startCsvWizardFromFile(file, "new")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-[rgba(16,23,31,0.96)] px-4 py-2 text-xs font-bold text-sky-200 transition hover:bg-sky-500/20"
                    >
                      <PlayCircle size={15} />
                      Leggi canali CSV
                    </button>
                  </div>
                </div>
              ) : null}

              {parsedCsvDraft ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={18} className="mt-0.5" />
                      <div>
                        <div className="font-bold">Canali pronti per il salvataggio</div>
                        <div className="mt-1 leading-5">
                          {parsedCsvDraft.summary.channels_count} canali · {parsedCsvDraft.summary.samples_count} campioni letti · {parsedCsvDraft.summary.sampled_points_count} punti salvati per grafici · {parsedCsvDraft.summary.laps_count} giri rilevati.
                        </div>
                        <div className="mt-2 text-xs font-semibold text-emerald-800">
                          Passaggio finale: clicca “Salva telemetria analizzata”. Dopo il salvataggio il file comparirà nell’archivio con il pulsante “Analizza”.
                        </div>
                        {parsedCsvDraft.summary.warnings.length > 0 ? (
                          <div className="mt-2 text-xs text-emerald-800">
                            Avvisi: {parsedCsvDraft.summary.warnings.join(" ")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addFile}
                      disabled={saving}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Upload size={15} />
                      {saving ? "Salvataggio..." : "Salva telemetria analizzata"}
                    </button>
                  </div>
                </div>
              ) : null}

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
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-xs leading-5 text-[var(--text-secondary)]">
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
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-sm font-bold text-[var(--brand-on-accent)] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload size={16} />
                  {saving ? "Salvataggio..." : parsedCsvDraft ? "Salva telemetria analizzata" : "Registra file"}
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
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              className={`${inputClassName} lg:max-w-xl`}
              placeholder="Filtro rapido per nome, evento, pilota, mezzo, tag o note"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />

            <div className="inline-flex w-full rounded-2xl border border-white/15 bg-white/[0.045] p-1 lg:w-auto">
              <button
                type="button"
                onClick={() => setArchiveViewMode("detailed")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition lg:flex-none ${
                  archiveViewMode === "detailed"
                    ? "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
                }`}
              >
                <FileArchive size={15} />
                Dettagliata
              </button>
              <button
                type="button"
                onClick={() => setArchiveViewMode("compact")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition lg:flex-none ${
                  archiveViewMode === "compact"
                    ? "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
                }`}
              >
                <List size={15} />
                Sintetica
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-[var(--text-muted)]">
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

                if (archiveViewMode === "compact") {
                  return (
                    <div key={row.id} className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-3 shadow-sm">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                              {row.file_name || "File telemetria"}
                            </div>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClassName(
                                row.import_status
                              )}`}
                            >
                              {statusLabel(row.import_status)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                            <span>{formatDateTime(row.created_at)}</span>
                            <span>{safeText(event?.name)}</span>
                            <span>{safeText(car?.name)}</span>
                            <span>{driverName(driver)}</span>
                            <span>{safeText(row.track_name)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-5 xl:w-[520px]">
                          <div><span className="font-bold text-[var(--text-primary)]">{row.channels_count || rowChannels.length || 0}</span> canali</div>
                          <div><span className="font-bold text-[var(--text-primary)]">{row.laps_count || rowLaps.length || 0}</span> giri</div>
                          <div><span className="font-bold text-[var(--text-primary)]">{row.sampled_points_count || 0}</span> punti</div>
                          <div>Best {formatDuration(row.best_lap_seconds)}</div>
                          <div>{formatFileSize(row.file_size_bytes)}</div>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          {canEditTelemetry ? (
                            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20">
                              <Database size={14} />
                              CSV
                              <input
                                type="file"
                                accept=".csv,.txt"
                                className="hidden"
                                onChange={(event) => {
                                  const selectedFile = event.target.files?.[0] || null;
                                  if (selectedFile) void startCsvWizardFromFile(selectedFile, "existing", row.id);
                                  event.currentTarget.value = "";
                                }}
                              />
                            </label>
                          ) : null}

                          {(row.sampled_points_count || 0) > 0 || rowChannels.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => void openAnalysis(row)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-100 transition hover:bg-yellow-500/20"
                            >
                              <BarChart3 size={14} />
                              Analizza
                            </button>
                          ) : null}

                          {row.file_url ? (
                            <a
                              href={row.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white/[0.045]"
                            >
                              Apri
                            </a>
                          ) : null}

                          {canEditTelemetry ? (
                            <button
                              type="button"
                              onClick={() => void deleteTelemetryFile(row)}
                              disabled={deletingFileId === row.id}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingFileId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Elimina
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={row.id} className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-bold text-[var(--text-primary)]">
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
                        <div className="mt-1 text-sm text-[var(--text-muted)]">{formatDateTime(row.created_at)}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canEditTelemetry ? (
                          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20">
                            <Database size={15} />
                            Importa CSV
                            <input
                              type="file"
                              accept=".csv,.txt"
                              className="hidden"
                              onChange={(event) => {
                                const selectedFile = event.target.files?.[0] || null;
                                if (selectedFile) void startCsvWizardFromFile(selectedFile, "existing", row.id);
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        ) : null}

                        {(row.sampled_points_count || 0) > 0 || rowChannels.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => void openAnalysis(row)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-500/20"
                          >
                            <BarChart3 size={15} />
                            Analizza
                          </button>
                        ) : null}

                        {row.file_url ? (
                          <a
                            href={row.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-white/[0.045]"
                          >
                            Apri file
                          </a>
                        ) : null}

                        {canEditTelemetry ? (
                          <button
                            type="button"
                            onClick={() => void deleteTelemetryFile(row)}
                            disabled={deletingFileId === row.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingFileId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            Elimina
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2 xl:grid-cols-3">
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
                      <div>Campioni letti: {row.samples_count || 0}</div>
                      <div>Punti grafici: {row.sampled_points_count || 0}</div>
                      <div>Durata: {formatDuration(row.duration_seconds)}</div>
                      <div>Best lap: {formatDuration(row.best_lap_seconds)}</div>
                      <div>V max: {formatNumber(row.max_speed, 1)} km/h</div>
                      <div>RPM max: {formatNumber(row.max_rpm, 0)}</div>
                      <div>Gas medio: {formatNumber(row.avg_throttle, 1)}%</div>
                      <div>Freno medio: {formatNumber(row.avg_brake, 1)}</div>
                    </div>

                    {row.event_car_turn_id ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-xs leading-5 text-[var(--text-secondary)]">
                        Turno collegato: {turnLabels.get(row.event_car_turn_id) || row.event_car_turn_id}
                      </div>
                    ) : null}

                    {row.notes ? (
                      <div className="mt-3 rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-3 text-sm leading-6 text-yellow-100">
                        {row.notes}
                      </div>
                    ) : null}

                    {row.tags && row.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {rowChannels.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm text-[var(--text-secondary)]">
                        <div className="mb-2 font-bold text-[var(--text-primary)]">Canali importati</div>
                        <div className="flex flex-wrap gap-2">
                          {rowChannels.slice(0, 12).map((channel) => (
                            <span
                              key={channel.id}
                              className="rounded-full border border-white/10 bg-[rgba(16,23,31,0.96)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                            >
                              {channel.display_name || channel.channel_key}
                              {channel.unit ? ` (${channel.unit})` : ""}
                            </span>
                          ))}
                          {rowChannels.length > 12 ? (
                            <span className="rounded-full border border-white/10 bg-[rgba(16,23,31,0.96)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
                              +{rowChannels.length - 12} altri
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {row.parse_warnings && row.parse_warnings.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-800">
                        <div className="mb-1 font-bold">Avvisi import</div>
                        {row.parse_warnings.join(" ")}
                      </div>
                    ) : null}

                    {rowInsights.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3 text-sm text-sky-200">
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

      {analysisFile ? (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${analysisFullscreen ? "p-0" : "p-4"}`}>
          <div className={`${analysisFullscreen ? "h-screen max-h-screen w-screen rounded-none" : "max-h-[92vh] w-full max-w-7xl rounded-3xl"} overflow-hidden bg-[rgba(16,23,31,0.96)] shadow-2xl`}>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <div className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                  <BarChart3 className="h-5 w-5 text-yellow-600" />
                  Analisi telemetria
                </div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {analysisFile.file_name || "File telemetria"} · {analysisSamples.length} punti grafici
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnalysisFullscreen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white/[0.045]"
                >
                  {analysisFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  {analysisFullscreen ? "Riduci" : "Tutto schermo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnalysisFile(null);
                    setAnalysisSamples([]);
                    setAnalysisCompareFileId("");
                    setAnalysisCompareFileSamples([]);
                    setAnalysisCompareFileLap("best");
                    setAnalysisFullscreen(false);
                  }}
                  className="rounded-xl border border-white/10 p-2 text-[var(--text-muted)] transition hover:bg-white/[0.045]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={`${analysisFullscreen ? "h-[calc(100vh-88px)]" : "max-h-[calc(92vh-88px)]"} overflow-y-auto p-5`}>
              {analysisLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-sm font-semibold text-[var(--text-secondary)]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Caricamento campioni telemetria...
                </div>
              ) : (
                <>
                  <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Durata</div>
                      <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatDuration(analysisFile.duration_seconds)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Best lap</div>
                      <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatDuration(analysisFile.best_lap_seconds)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">V max</div>
                      <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatNumber(analysisFile.max_speed, 1)} km/h</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">RPM max</div>
                      <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatNumber(analysisFile.max_rpm, 0)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Giri</div>
                      <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{analysisFile.laps_count || laps.filter((lap) => lap.telemetry_file_id === analysisFile.id).length}</div>
                    </div>
                  </div>

                  <div className={`${analysisFullscreen ? "mb-5 grid grid-cols-1 gap-4 2xl:grid-cols-[320px_1fr]" : "mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]"}`}>
                    <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
                      <div className="mb-3 text-sm font-bold text-[var(--text-primary)]">Controlli analisi</div>

                      <Field label="Asse orizzontale" hint="come scorre il grafico">
                        <select
                          className={selectClassName}
                          value={analysisAxis}
                          onChange={(event) => setAnalysisAxis(event.target.value as AnalysisAxis)}
                        >
                          <option value="distance">Distanza pista</option>
                          <option value="time">Tempo sessione</option>
                          <option value="sample">Numero campione</option>
                        </select>
                      </Field>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <Field label="Giro di riferimento" hint="per confrontare su base tempo/distanza">
                          <select
                            className={selectClassName}
                            value={analysisPrimaryLap}
                            onChange={(event) => {
                              setAnalysisPrimaryLap(event.target.value);
                              if (event.target.value === "all") {
                                setAnalysisCompareLap("none");
                                if (analysisCompareFileId) setAnalysisCompareFileLap("all");
                              }
                            }}
                          >
                            <option value="all">Sessione completa</option>
                            {analysisBestLapNumber !== null ? <option value="best">Miglior giro ({analysisBestLapNumber})</option> : null}
                            {analysisLapOptions.map((lap) => (
                              <option key={lap} value={String(lap)}>
                                Giro {lap}{analysisFile ? ` · ${formatDuration(lapTimeForNumber(laps, analysisFile.id, lap))}` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Sovrapponi giro stesso file" hint="linea tratteggiata">
                          <select
                            className={selectClassName}
                            value={analysisCompareLap}
                            disabled={analysisPrimaryLap === "all" || Boolean(analysisCompareFileId)}
                            onChange={(event) => setAnalysisCompareLap(event.target.value)}
                          >
                            <option value="none">Nessun confronto</option>
                            {analysisBestLapNumber !== null ? <option value="best">Miglior giro ({analysisBestLapNumber})</option> : null}
                            {analysisLapOptions.map((lap) => (
                              <option key={lap} value={String(lap)}>
                                Giro {lap}{analysisFile ? ` · ${formatDuration(lapTimeForNumber(laps, analysisFile.id, lap))}` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Confronta con altro file / turno" hint="usa file già analizzati">
                          <select
                            className={selectClassName}
                            value={analysisCompareFileId}
                            onChange={(event) => loadComparisonTelemetryFile(event.target.value)}
                          >
                            <option value="">Nessun confronto esterno</option>
                            {comparableTelemetryFiles.map((row) => {
                              const event = row.event_id ? events.find((item) => item.id === row.event_id) : null;
                              const driver = row.driver_id ? drivers.find((item) => item.id === row.driver_id) : null;
                              return (
                                <option key={row.id} value={row.id}>
                                  {row.file_name || "File telemetria"}{event?.name ? ` · ${event.name}` : ""}{driver ? ` · ${driverName(driver)}` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </Field>

                        {analysisCompareFileId ? (
                          <Field label="Giro del file confronto" hint={analysisCompareFileLoading ? "caricamento campioni..." : "linea tratteggiata"}>
                            <select
                              className={selectClassName}
                              value={analysisCompareFileLap}
                              disabled={analysisCompareFileLoading}
                              onChange={(event) => setAnalysisCompareFileLap(event.target.value)}
                            >
                              <option value="all">Sessione completa</option>
                              {comparisonFileBestLapNumber !== null ? <option value="best">Miglior giro ({comparisonFileBestLapNumber})</option> : null}
                              {comparisonFileLapOptions.map((lap) => (
                                <option key={lap} value={String(lap)}>
                                  Giro {lap}{analysisCompareFile ? ` · ${formatDuration(lapTimeForNumber(laps, analysisCompareFile.id, lap))}` : ""}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ) : null}

                        {analysisCompareFileLoading ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-xs font-semibold text-[var(--text-secondary)]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Caricamento file di confronto...
                          </div>
                        ) : null}

                        {analysisPrimaryLap !== "all" || analysisCompareFileId ? (
                          <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-3 text-xs leading-5 text-yellow-100">
                            Vista confronto: quando confronti giri, tempo e distanza partono da zero per facilitare la sovrapposizione. {chartCompareSamples.length > 0 ? `Delta tempi: ${formatNumber((primaryLapTime ?? 0) - (compareLapTime ?? 0), 3)} s.` : "Seleziona un giro o un altro file per sovrapporre i dati."}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 mb-2 text-sm font-bold text-[var(--text-primary)]">Canali da visualizzare</div>
                      <div className={`${analysisFullscreen ? "max-h-[calc(100vh-420px)]" : "max-h-[360px]"} space-y-2 overflow-y-auto pr-1`}>
                        {channels
                          .filter((channel) => channel.telemetry_file_id === analysisFile.id)
                          .map((channel) => {
                            const key = channel.channel_key || "";
                            if (!key || ["time", "distance", "lap"].includes(key)) return null;
                            const checked = selectedAnalysisChannels.includes(key);
                            return (
                              <label key={channel.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                <span>
                                  <span className="font-semibold">{channelDisplayName(channel, key)}</span>
                                  {channelUnit(channel, key) ? <span className="text-[var(--text-muted)]"> · {channelUnit(channel, key)}</span> : null}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedAnalysisChannels((current) =>
                                      checked ? current.filter((item) => item !== key) : [...current, key]
                                    );
                                  }}
                                />
                              </label>
                            );
                          })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
                      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-bold text-[var(--text-primary)]">Grafico sensori</div>
                          <div className="text-xs text-[var(--text-muted)]">Muovi il cursore sul grafico per leggere valori reali. Il confronto, stesso file o altro file/turno, appare tratteggiato.</div>
                        </div>
                        <div className="text-xs font-semibold text-[var(--text-muted)]">
                          Canali selezionati: {selectedAnalysisChannels.length}
                        </div>
                      </div>

                      <SvgTelemetryChart
                        samples={chartPrimarySamples}
                        selectedChannels={selectedAnalysisChannels}
                        availableChannels={channels.filter((channel) => channel.telemetry_file_id === analysisFile.id)}
                        axis={analysisAxis}
                        comparisonSamples={chartCompareSamples}
                        primaryLabel={primaryLabel}
                        comparisonLabel={comparisonLabel}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
                      <div className="mb-3 text-sm font-bold text-[var(--text-primary)]">Statistiche canali</div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10 text-sm">
                          <thead className="bg-white/[0.045] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">Canale</th>
                              <th className="px-3 py-2">Min</th>
                              <th className="px-3 py-2">Max</th>
                              <th className="px-3 py-2">Media</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 bg-[rgba(16,23,31,0.96)]">
                            {selectedAnalysisChannels.map((key) => {
                              const channel = channels.find((item) => item.telemetry_file_id === analysisFile.id && item.channel_key === key);
                              const stats = channelStats(analysisSamples, key);
                              const unit = channelUnit(channel, key);
                              return (
                                <tr key={key}>
                                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{channelDisplayName(channel, key)}</td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">{formatNumber(stats.min, 2)} {unit}</td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">{formatNumber(stats.max, 2)} {unit}</td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">{formatNumber(stats.avg, 2)} {unit}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
                      <div className="mb-3 text-sm font-bold text-[var(--text-primary)]">Riepilogo giri</div>
                      <div className="max-h-[330px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-white/10 text-sm">
                          <thead className="bg-white/[0.045] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">Giro</th>
                              <th className="px-3 py-2">Tempo</th>
                              <th className="px-3 py-2">V max</th>
                              <th className="px-3 py-2">V media</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 bg-[rgba(16,23,31,0.96)]">
                            {laps
                              .filter((lap) => lap.telemetry_file_id === analysisFile.id)
                              .sort((a, b) => (a.lap_number || 0) - (b.lap_number || 0))
                              .map((lap) => (
                                <tr key={lap.id}>
                                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{lap.lap_number || "—"}</td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">{formatDuration(lap.lap_time_seconds)}</td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">{formatNumber(lap.max_speed, 1)} km/h</td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">{formatNumber(lap.avg_speed, 1)} km/h</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
                    Ora puoi analizzare una sessione completa, isolare un giro, sovrapporre un secondo giro dello stesso file e confrontare anche un altro file/turno già analizzato. Il prossimo passo sarà trasformare questi confronti in insight automatici sui punti di miglioramento.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {csvWizard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl modal-panel shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">Import guidato CSV telemetria</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {csvWizard.fileName} · separatore {csvWizard.delimiter === "\t" ? "tab" : csvWizard.delimiter} · {csvWizard.rows.length} righe dati
                </div>
              </div>
              <button
                type="button"
                onClick={() => (csvWizard.importing ? null : setCsvWizard(null))}
                disabled={csvWizard.importing}
                className="rounded-xl border border-white/10 p-2 text-[var(--text-muted)] transition hover:bg-white/[0.045] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(90vh-170px)] overflow-y-auto p-5">
              <div className="mb-4 rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
                Controlla l'associazione proposta. Le colonne ignorate non verranno importate. Dopo la conferma salvo
                riepilogo canali, giri e un campionamento dei dati per i grafici futuri.
                {csvWizard.aimMetadata?.isAimCsv ? (
                  <div className="mt-3 rounded-xl bg-white/[0.07] p-3 text-xs leading-5 text-yellow-100">
                    <strong>AIM CSV riconosciuto:</strong> {csvWizard.aimMetadata.session || "pista non indicata"} ·{" "}
                    {csvWizard.aimMetadata.vehicle || "veicolo non indicato"} ·{" "}
                    {csvWizard.aimMetadata.racer || "pilota non indicato"} ·{" "}
                    {csvWizard.aimMetadata.segmentTimes.length > 0
                      ? `${Math.max(0, csvWizard.aimMetadata.segmentTimes.length - 2)} giri validi rilevati da Segment Times`
                      : "giri non rilevati"}
                  </div>
                ) : null}
              </div>

              {csvWizard.error ? (
                <FormStatusBanner type="error" message={csvWizard.error} />
              ) : null}

              {wizardValidation.errors.length > 0 ? (
                <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
                  <div className="font-bold">Errori da correggere</div>
                  {wizardValidation.errors.map((error) => (
                    <div key={error}>• {error}</div>
                  ))}
                </div>
              ) : null}

              {wizardValidation.warnings.length > 0 ? (
                <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-800">
                  <div className="font-bold">Avvisi</div>
                  {wizardValidation.warnings.map((warning) => (
                    <div key={warning}>• {warning}</div>
                  ))}
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/[0.045] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Colonna file</th>
                      <th className="px-4 py-3">Unità</th>
                      <th className="px-4 py-3">Esempio</th>
                      <th className="px-4 py-3">Campo telemetria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-[rgba(16,23,31,0.96)]">
                    {csvWizard.headers.map((header, index) => (
                      <tr key={`${header}-${index}`}>
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{header}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{csvWizard.units[header] || "—"}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-[var(--text-muted)]">
                          {csvWizard.rows[0]?.[index] || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="w-full rounded-xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15"
                            value={csvWizard.mapping[header] || "ignore"}
                            onChange={(event) =>
                              setCsvWizard({
                                ...csvWizard,
                                mapping: {
                                  ...csvWizard.mapping,
                                  [header]: event.target.value as ChannelKey,
                                },
                                error: undefined,
                              })
                            }
                            disabled={csvWizard.importing}
                          >
                            {CHANNEL_DEFINITIONS.map((definition) => (
                              <option key={definition.key} value={definition.key}>
                                {definition.label}
                                {definition.unit ? ` (${definition.unit})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="mb-3 text-sm font-bold text-[var(--text-primary)]">Anteprima prime righe</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-[var(--text-secondary)]">
                    <thead>
                      <tr>
                        {csvWizard.headers.slice(0, 8).map((header) => (
                          <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvWizard.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-white/10">
                          {csvWizard.headers.slice(0, 8).map((header, columnIndex) => (
                            <td key={`${rowIndex}-${header}`} className="max-w-[180px] truncate px-3 py-2">
                              {row[columnIndex] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 p-5 md:flex-row md:items-center md:justify-between">
              <div className="text-xs leading-5 text-[var(--text-muted)]">
                {csvWizard.mode === "new"
                  ? "Conferma la mappatura, poi salva il file telemetria per completare l'import."
                  : "Conferma la mappatura: i dati CSV sostituiranno l'eventuale import precedente di questo file."}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCsvWizard(null)}
                  disabled={csvWizard.importing}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-white/[0.045] disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={confirmCsvWizard}
                  disabled={csvWizard.importing || wizardValidation.errors.length > 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-sm font-bold text-[var(--brand-on-accent)] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {csvWizard.importing ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  {csvWizard.importing ? "Import in corso..." : "Conferma mapping"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
