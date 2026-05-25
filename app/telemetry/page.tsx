"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Audiowide } from "next/font/google";
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
  Loader2,
  PlayCircle,
  Upload,
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

function deriveAimLapNumber(timeSeconds: number | null, aimMetadata?: AimCsvMetadata) {
  if (timeSeconds === null || !aimMetadata?.beaconMarkers?.length) return null;

  const markers = aimMetadata.beaconMarkers;
  const segmentIndex = markers.findIndex((marker) => timeSeconds <= marker);
  const resolvedSegmentIndex = segmentIndex >= 0 ? segmentIndex : markers.length - 1;

  // AIM esporta di solito: out lap, giri validi, in lap.
  // Segmento 0 = uscita box, ultimo segmento = rientro box.
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

function SvgTelemetryChart({
  samples,
  selectedChannels,
  availableChannels,
  axis,
}: {
  samples: TelemetrySample[];
  selectedChannels: string[];
  availableChannels: TelemetryChannel[];
  axis: AnalysisAxis;
}) {
  const width = 920;
  const height = 320;
  const paddingX = 54;
  const paddingY = 34;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const colors = ["#facc15", "#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#ea580c", "#0891b2", "#be123c"];

  const xValues = samples.map((sample) => getAxisValue(sample, axis));
  const validX = xValues.filter((value): value is number => value !== null);
  const minX = validX.length ? Math.min(...validX) : 0;
  const maxX = validX.length ? Math.max(...validX) : Math.max(samples.length - 1, 1);
  const xRange = maxX - minX || 1;

  const series = selectedChannels
    .map((channelKey, index) => {
      const values = samples
        .map((sample, sampleIndex) => {
          const y = getSampleValue(sample, channelKey);
          const x = getAxisValue(sample, axis) ?? sampleIndex;
          return y === null ? null : { x, y };
        })
        .filter((point): point is { x: number; y: number } => point !== null);

      const yValues = values.map((point) => point.y);
      const minY = yValues.length ? Math.min(...yValues) : 0;
      const maxY = yValues.length ? Math.max(...yValues) : 1;
      const yRange = maxY - minY || 1;

      const points = values
        .map((point) => {
          const x = paddingX + ((point.x - minX) / xRange) * plotWidth;
          const y = paddingY + plotHeight - ((point.y - minY) / yRange) * plotHeight;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

      const channel = availableChannels.find((item) => item.channel_key === channelKey);

      return {
        channelKey,
        label: channelDisplayName(channel, channelKey),
        unit: channelUnit(channel, channelKey),
        color: colors[index % colors.length],
        points,
        minY,
        maxY,
        count: values.length,
      };
    })
    .filter((item) => item.count > 1);

  if (samples.length === 0 || series.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-500">
        Nessun dato sufficiente per disegnare il grafico. Importa un CSV con campioni validi e almeno un canale numerico.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]">
          <rect x={paddingX} y={paddingY} width={plotWidth} height={plotHeight} rx="14" fill="#fafafa" />
          <line x1={paddingX} y1={paddingY + plotHeight} x2={paddingX + plotWidth} y2={paddingY + plotHeight} stroke="#d4d4d4" />
          <line x1={paddingX} y1={paddingY} x2={paddingX} y2={paddingY + plotHeight} stroke="#d4d4d4" />
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={paddingX}
              y1={paddingY + plotHeight * ratio}
              x2={paddingX + plotWidth}
              y2={paddingY + plotHeight * ratio}
              stroke="#e5e5e5"
              strokeDasharray="5 5"
            />
          ))}
          {series.map((item) => (
            <polyline key={item.channelKey} points={item.points} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          <text x={paddingX} y={height - 8} fontSize="12" fill="#737373">
            {axis === "time" ? "tempo" : axis === "distance" ? "distanza" : "campione"}: {formatNumber(minX, 2)} → {formatNumber(maxX, 2)}
          </text>
          <text x={paddingX} y="20" fontSize="12" fill="#737373">
            Linee normalizzate per canale: utile per confrontare andamento, non scala assoluta condivisa.
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {series.map((item) => (
          <span key={item.channelKey} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
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

  if (!mappedKeys.includes("lap") && !wizard.aimMetadata?.beaconMarkers?.length) {
    warnings.push("Manca il canale giro: non posso calcolare il riepilogo giri automaticamente.");
  }

  if (wizard.aimMetadata?.isAimCsv) {
    warnings.push("File AIM CSV riconosciuto: uso Beacon Markers e Segment Times per ricostruire i giri.");
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

  const aimLapTimes = wizard.aimMetadata?.segmentTimes || [];
  const aimHasFullLaps = wizard.aimMetadata?.isAimCsv && aimLapTimes.length >= 3;

  const laps = Array.from(lapGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([lapNumber, group]) => {
      const metadataLapTime = aimHasFullLaps ? aimLapTimes[lapNumber] ?? null : null;
      const calculatedLapTime = group.times.length >= 2 ? Math.max(...group.times) - Math.min(...group.times) : null;
      return {
        lap_number: lapNumber,
        lap_time_seconds: roundTelemetry(metadataLapTime || calculatedLapTime),
        max_speed: roundTelemetry(group.speeds.length > 0 ? Math.max(...group.speeds) : null),
        avg_speed: roundTelemetry(average(group.speeds)),
        notes: aimHasFullLaps ? "Lap ricostruito da Beacon Markers / Segment Times AIM" : null,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analysisFile, setAnalysisFile] = useState<TelemetryFile | null>(null);
  const [analysisSamples, setAnalysisSamples] = useState<TelemetrySample[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisAxis, setAnalysisAxis] = useState<AnalysisAxis>("time");
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

  async function openAnalysis(row: TelemetryFile) {
    setAnalysisFile(row);
    setAnalysisSamples([]);
    setAnalysisLoading(true);

    const rowChannels = channels.filter((channel) => channel.telemetry_file_id === row.id);
    const priority = ["speed", "rpm", "throttle", "brake", "brake_pressure", "gear", "water_temp", "oil_temp"];
    const defaults = priority.filter((key) => rowChannels.some((channel) => channel.channel_key === key));
    const fallback = rowChannels.map((channel) => channel.channel_key || "").filter(Boolean);
    setSelectedAnalysisChannels((defaults.length ? defaults : fallback).slice(0, 4));

    try {
      const ctx = await getCurrentTeamContext();
      const { data, error } = await supabase
        .from("telemetry_samples")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("telemetry_file_id", row.id)
        .order("sample_index", { ascending: true });

      if (error) throw error;

      setAnalysisSamples((data || []) as TelemetrySample[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore caricamento campioni telemetria.";
      setFeedback({ type: "error", message });
    } finally {
      setAnalysisLoading(false);
    }
  }

  const selectedTurn = form.event_car_turn_id ? turns.find((turn) => turn.id === form.event_car_turn_id) : null;
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
                  accept=".csv,.txt,.xlsx,.pdf,.zip,video/*,image/*"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] || null;
                    setFile(selectedFile);
                    setParsedCsvDraft(null);
                  }}
                />
              </Field>

              {file && ["csv", "aim_export"].includes(form.data_format) ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
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
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
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

                      <div className="flex flex-wrap gap-2">
                        {canEditTelemetry ? (
                          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100">
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
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-900 transition hover:bg-yellow-100"
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
                            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                          >
                            Apri file
                          </a>
                        ) : null}
                      </div>
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

                    {rowChannels.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                        <div className="mb-2 font-bold text-neutral-900">Canali importati</div>
                        <div className="flex flex-wrap gap-2">
                          {rowChannels.slice(0, 12).map((channel) => (
                            <span
                              key={channel.id}
                              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600"
                            >
                              {channel.display_name || channel.channel_key}
                              {channel.unit ? ` (${channel.unit})` : ""}
                            </span>
                          ))}
                          {rowChannels.length > 12 ? (
                            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-500">
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

      {analysisFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
              <div>
                <div className="flex items-center gap-2 text-lg font-bold text-neutral-900">
                  <BarChart3 className="h-5 w-5 text-yellow-600" />
                  Analisi telemetria
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {analysisFile.file_name || "File telemetria"} · {analysisSamples.length} punti grafici
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnalysisFile(null);
                  setAnalysisSamples([]);
                }}
                className="rounded-xl border border-neutral-200 p-2 text-neutral-500 transition hover:bg-neutral-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-5">
              {analysisLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm font-semibold text-neutral-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Caricamento campioni telemetria...
                </div>
              ) : (
                <>
                  <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Durata</div>
                      <div className="mt-1 text-lg font-bold text-neutral-900">{formatDuration(analysisFile.duration_seconds)}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Best lap</div>
                      <div className="mt-1 text-lg font-bold text-neutral-900">{formatDuration(analysisFile.best_lap_seconds)}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">V max</div>
                      <div className="mt-1 text-lg font-bold text-neutral-900">{formatNumber(analysisFile.max_speed, 1)} km/h</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">RPM max</div>
                      <div className="mt-1 text-lg font-bold text-neutral-900">{formatNumber(analysisFile.max_rpm, 0)}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Giri</div>
                      <div className="mt-1 text-lg font-bold text-neutral-900">{analysisFile.laps_count || laps.filter((lap) => lap.telemetry_file_id === analysisFile.id).length}</div>
                    </div>
                  </div>

                  <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="mb-3 text-sm font-bold text-neutral-900">Canali da visualizzare</div>

                      <Field label="Asse X">
                        <select
                          className={selectClassName}
                          value={analysisAxis}
                          onChange={(event) => setAnalysisAxis(event.target.value as AnalysisAxis)}
                        >
                          <option value="time">Tempo</option>
                          <option value="distance">Distanza</option>
                          <option value="sample">Numero campione</option>
                        </select>
                      </Field>

                      <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {channels
                          .filter((channel) => channel.telemetry_file_id === analysisFile.id)
                          .map((channel) => {
                            const key = channel.channel_key || "";
                            if (!key || ["time", "distance", "lap"].includes(key)) return null;
                            const checked = selectedAnalysisChannels.includes(key);
                            return (
                              <label key={channel.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                                <span>
                                  <span className="font-semibold">{channelDisplayName(channel, key)}</span>
                                  {channelUnit(channel, key) ? <span className="text-neutral-400"> · {channelUnit(channel, key)}</span> : null}
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

                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-bold text-neutral-900">Grafico sensori</div>
                          <div className="text-xs text-neutral-500">Prima versione: linee normalizzate per confrontare l'andamento dei canali.</div>
                        </div>
                        <div className="text-xs font-semibold text-neutral-500">
                          Canali selezionati: {selectedAnalysisChannels.length}
                        </div>
                      </div>

                      <SvgTelemetryChart
                        samples={analysisSamples}
                        selectedChannels={selectedAnalysisChannels}
                        availableChannels={channels.filter((channel) => channel.telemetry_file_id === analysisFile.id)}
                        axis={analysisAxis}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="mb-3 text-sm font-bold text-neutral-900">Statistiche canali</div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-200 text-sm">
                          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                            <tr>
                              <th className="px-3 py-2">Canale</th>
                              <th className="px-3 py-2">Min</th>
                              <th className="px-3 py-2">Max</th>
                              <th className="px-3 py-2">Media</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 bg-white">
                            {selectedAnalysisChannels.map((key) => {
                              const channel = channels.find((item) => item.telemetry_file_id === analysisFile.id && item.channel_key === key);
                              const stats = channelStats(analysisSamples, key);
                              const unit = channelUnit(channel, key);
                              return (
                                <tr key={key}>
                                  <td className="px-3 py-2 font-semibold text-neutral-800">{channelDisplayName(channel, key)}</td>
                                  <td className="px-3 py-2 text-neutral-600">{formatNumber(stats.min, 2)} {unit}</td>
                                  <td className="px-3 py-2 text-neutral-600">{formatNumber(stats.max, 2)} {unit}</td>
                                  <td className="px-3 py-2 text-neutral-600">{formatNumber(stats.avg, 2)} {unit}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="mb-3 text-sm font-bold text-neutral-900">Riepilogo giri</div>
                      <div className="max-h-[330px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-neutral-200 text-sm">
                          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                            <tr>
                              <th className="px-3 py-2">Giro</th>
                              <th className="px-3 py-2">Tempo</th>
                              <th className="px-3 py-2">V max</th>
                              <th className="px-3 py-2">V media</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 bg-white">
                            {laps
                              .filter((lap) => lap.telemetry_file_id === analysisFile.id)
                              .sort((a, b) => (a.lap_number || 0) - (b.lap_number || 0))
                              .map((lap) => (
                                <tr key={lap.id}>
                                  <td className="px-3 py-2 font-semibold text-neutral-800">{lap.lap_number || "—"}</td>
                                  <td className="px-3 py-2 text-neutral-600">{formatDuration(lap.lap_time_seconds)}</td>
                                  <td className="px-3 py-2 text-neutral-600">{formatNumber(lap.max_speed, 1)} km/h</td>
                                  <td className="px-3 py-2 text-neutral-600">{formatNumber(lap.avg_speed, 1)} km/h</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
                    Questa è la prima vista grafica. Il passo successivo sarà confrontare due turni o due piloti e generare insight automatici sui punti di miglioramento.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {csvWizard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
              <div>
                <div className="text-lg font-bold text-neutral-900">Import guidato CSV telemetria</div>
                <div className="mt-1 text-sm text-neutral-500">
                  {csvWizard.fileName} · separatore {csvWizard.delimiter === "\t" ? "tab" : csvWizard.delimiter} · {csvWizard.rows.length} righe dati
                </div>
              </div>
              <button
                type="button"
                onClick={() => (csvWizard.importing ? null : setCsvWizard(null))}
                disabled={csvWizard.importing}
                className="rounded-xl border border-neutral-200 p-2 text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(90vh-170px)] overflow-y-auto p-5">
              <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
                Controlla l'associazione proposta. Le colonne ignorate non verranno importate. Dopo la conferma salvo
                riepilogo canali, giri e un campionamento dei dati per i grafici futuri.
                {csvWizard.aimMetadata?.isAimCsv ? (
                  <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs leading-5 text-yellow-900">
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
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
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

              <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">Colonna file</th>
                      <th className="px-4 py-3">Unità</th>
                      <th className="px-4 py-3">Esempio</th>
                      <th className="px-4 py-3">Campo telemetria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {csvWizard.headers.map((header, index) => (
                      <tr key={`${header}-${index}`}>
                        <td className="px-4 py-3 font-semibold text-neutral-800">{header}</td>
                        <td className="px-4 py-3 text-neutral-500">{csvWizard.units[header] || "—"}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-neutral-500">
                          {csvWizard.rows[0]?.[index] || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
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

              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3 text-sm font-bold text-neutral-800">Anteprima prime righe</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-neutral-600">
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
                        <tr key={rowIndex} className="border-t border-neutral-200">
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

            <div className="flex flex-col gap-3 border-t border-neutral-200 p-5 md:flex-row md:items-center md:justify-between">
              <div className="text-xs leading-5 text-neutral-500">
                {csvWizard.mode === "new"
                  ? "Conferma la mappatura, poi salva il file telemetria per completare l'import."
                  : "Conferma la mappatura: i dati CSV sostituiranno l'eventuale import precedente di questo file."}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCsvWizard(null)}
                  disabled={csvWizard.importing}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={confirmCsvWizard}
                  disabled={csvWizard.importing || wizardValidation.errors.length > 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black shadow-sm transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
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
