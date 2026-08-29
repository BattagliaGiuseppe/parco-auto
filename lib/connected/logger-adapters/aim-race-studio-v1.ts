import type { JsonObject, LoggerAdapter } from "./types";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseDurationSeconds(value: unknown): number | null {
  const direct = finiteNumber(value);
  if (direct !== null) return direct;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const parts = text.split(":").map((part) => Number(part.replace(",", ".")));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function sourceObjects(input: JsonObject): JsonObject[] {
  const objects: JsonObject[] = [input];
  for (const key of ["payload", "data", "values", "channels", "telemetry", "sample", "summary", "session"]) {
    const value = input[key];
    if (isObject(value)) objects.push(value);
  }
  return objects;
}

function lookup(input: JsonObject, aliases: string[]): unknown {
  const wanted = new Set(aliases.map(normalizeKey));
  for (const object of sourceObjects(input)) {
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(normalizeKey(key))) return value;
    }
  }
  return undefined;
}

function copyIfDefined(target: JsonObject, key: string, value: unknown) {
  if (value !== undefined && value !== null && value !== "") target[key] = value;
}

function aimMetadata(input: JsonObject): JsonObject {
  const existing = isObject(input.metadata) ? input.metadata : {};
  const metadata: JsonObject = { ...existing, aim_format: "race_studio_bridge_v1" };
  const model = lookup(input, ["model", "device_model", "logger_model"]);
  const serial = lookup(input, ["serial", "serial_number", "device_serial"]);
  const software = lookup(input, ["software", "source_software", "race_studio_version"]);
  if (model != null) metadata.aim_model = model;
  if (serial != null) metadata.aim_serial = serial;
  if (software != null) metadata.aim_software = software;
  return metadata;
}

function normalizeSpeedKph(input: JsonObject): number | null {
  const raw = lookup(input, [
    "speed_kph", "gps_speed_kph", "gps speed kph", "gps speed", "gpsspeed", "vehicle speed", "vehiclespeed",
    "rsrv4 bkspeed", "rsrv4bkspeed", "speed",
  ]);
  const value = finiteNumber(raw);
  if (value === null) return null;
  const unit = stringValue(lookup(input, ["speed_unit", "gps_speed_unit", "gps speed unit"]));
  if (unit && ["m/s", "ms", "mps"].includes(unit.toLowerCase().replace(/\s/g, ""))) return value * 3.6;
  if (unit && ["mph"].includes(unit.toLowerCase())) return value * 1.609344;
  return value;
}

function normalizeLiveState(input: JsonObject): JsonObject {
  const out: JsonObject = {};

  copyIfDefined(out, "activity_state", stringValue(lookup(input, ["activity_state", "activity state", "state"])) || undefined);
  copyIfDefined(out, "circuit_id", stringValue(lookup(input, ["circuit_id", "circuit id", "track_id", "track id"])) || undefined);
  copyIfDefined(out, "speed_kph", normalizeSpeedKph(input));
  copyIfDefined(out, "rpm", finiteNumber(lookup(input, ["rpm", "rsv4 rpm", "rsv4rpm", "engine rpm", "engine speed"])));
  copyIfDefined(out, "gear", stringValue(lookup(input, ["gear", "rsv4 gear", "rsv4gear", "gear position", "gearposition"])) || undefined);
  copyIfDefined(out, "lap_number", finiteNumber(lookup(input, ["lap_number", "lap number", "lap", "lap no", "lapno"])));
  copyIfDefined(out, "current_lap_seconds", parseDurationSeconds(lookup(input, ["current_lap_seconds", "current lap time", "currentlaptime", "lap time", "laptime"])));
  copyIfDefined(out, "last_lap_seconds", parseDurationSeconds(lookup(input, ["last_lap_seconds", "last lap time", "lastlaptime", "previous lap time"])));
  copyIfDefined(out, "best_lap_seconds", parseDurationSeconds(lookup(input, ["best_lap_seconds", "best lap time", "bestlaptime", "best lap"])));
  copyIfDefined(out, "delta_seconds", finiteNumber(lookup(input, ["delta_seconds", "lap delta", "lapdelta", "delta", "predictive delta"])));
  copyIfDefined(out, "gps_accuracy_m", finiteNumber(lookup(input, ["gps_accuracy_m", "gps accuracy", "gpsaccuracy", "gps radius", "gpsradius"])));
  copyIfDefined(out, "source_timestamp", stringValue(lookup(input, ["source_timestamp", "timestamp", "sample_timestamp", "sample time", "datetime"])) || undefined);

  out.metadata = aimMetadata(input);
  return out;
}

function normalizeLap(raw: unknown, index: number): JsonObject | null {
  if (!isObject(raw)) return null;
  const lap: JsonObject = {};
  const number = finiteNumber(lookup(raw, ["lap_number", "lap number", "lap", "lap no", "lapno"])) ?? index + 1;
  copyIfDefined(lap, "lap_number", Math.trunc(number));
  copyIfDefined(lap, "lap_time_seconds", parseDurationSeconds(lookup(raw, ["lap_time_seconds", "lap time", "laptime", "time", "segment time", "segmenttime"])));
  copyIfDefined(lap, "max_speed", normalizeSpeedKph(raw));
  copyIfDefined(lap, "started_at", stringValue(lookup(raw, ["started_at", "start time", "lap start", "lap_start"])) || undefined);
  copyIfDefined(lap, "ended_at", stringValue(lookup(raw, ["ended_at", "end time", "lap end", "lap_end"])) || undefined);
  const sectors = lookup(raw, ["sector_times", "sector times", "sectors"]);
  if (Array.isArray(sectors)) lap.sector_times = sectors.map(parseDurationSeconds).filter((value): value is number => value !== null);
  if (isObject(raw.metadata)) lap.metadata = raw.metadata;
  return lap;
}

function normalizeOfficialSession(input: JsonObject): JsonObject {
  const out: JsonObject = {};
  copyIfDefined(out, "started_at", stringValue(lookup(input, ["started_at", "start time", "session start", "session_start", "sessionstart"])) || undefined);
  copyIfDefined(out, "ended_at", stringValue(lookup(input, ["ended_at", "end time", "session end", "session_end", "sessionend"])) || undefined);
  copyIfDefined(out, "engine_on_at", stringValue(lookup(input, ["engine_on_at", "engine on", "engine start"])) || undefined);
  copyIfDefined(out, "engine_off_at", stringValue(lookup(input, ["engine_off_at", "engine off", "engine stop"])) || undefined);
  copyIfDefined(out, "engine_seconds", parseDurationSeconds(lookup(input, ["engine_seconds", "engine time", "engine duration"])));
  copyIfDefined(out, "track_entry_at", stringValue(lookup(input, ["track_entry_at", "track entry", "pit out", "pitout"])) || undefined);
  copyIfDefined(out, "track_exit_at", stringValue(lookup(input, ["track_exit_at", "track exit", "pit in", "pitin"])) || undefined);
  copyIfDefined(out, "track_seconds", parseDurationSeconds(lookup(input, ["track_seconds", "track time", "track duration", "session duration", "duration"])));

  const rawLaps = lookup(input, ["laps", "lap data", "lapdata", "segments", "segment times"]);
  if (Array.isArray(rawLaps)) {
    const laps = rawLaps.map(normalizeLap).filter((lap): lap is JsonObject => lap !== null);
    out.laps = laps;
    copyIfDefined(out, "laps_count", finiteNumber(lookup(input, ["laps_count", "laps count", "lap count", "lapcount"])) ?? laps.length);
  } else {
    copyIfDefined(out, "laps_count", finiteNumber(lookup(input, ["laps_count", "laps count", "lap count", "lapcount"])));
  }

  copyIfDefined(out, "best_lap_seconds", parseDurationSeconds(lookup(input, ["best_lap_seconds", "best lap time", "bestlaptime", "best lap"])));
  copyIfDefined(out, "max_speed", normalizeSpeedKph(input));
  copyIfDefined(out, "max_rpm", finiteNumber(lookup(input, ["max_rpm", "max rpm", "maximum rpm", "rpm max"])));
  copyIfDefined(out, "latitude", finiteNumber(lookup(input, ["latitude", "gps latitude", "gpslatitude", "gps lat", "gpslat"])));
  copyIfDefined(out, "longitude", finiteNumber(lookup(input, ["longitude", "gps longitude", "gpslongitude", "gps lon", "gpslon", "gps lng"])));
  copyIfDefined(out, "detected_circuit_id", stringValue(lookup(input, ["detected_circuit_id", "circuit_id", "track_id"])) || undefined);
  copyIfDefined(out, "track_name", stringValue(lookup(input, ["track_name", "track", "circuit", "venue"])) || undefined);
  copyIfDefined(out, "detection_confidence", finiteNumber(lookup(input, ["detection_confidence", "confidence"])));
  copyIfDefined(out, "points_count", finiteNumber(lookup(input, ["points_count", "samples_count", "sample count"])));
  copyIfDefined(out, "raw_storage_path", stringValue(lookup(input, ["raw_storage_path", "raw file", "file path"])) || undefined);
  out.metadata = aimMetadata(input);
  return out;
}

export const aimRaceStudioV1Adapter: LoggerAdapter = {
  id: "aim_race_studio_v1",
  version: "1.0.0",
  label: "AiM / Race Studio v1",
  description: "Traduce payload JSON con nomenclatura AiM/Race Studio nel formato canonico della piattaforma.",
  channels: ["live_state", "official_session"],
  normalizeLiveState,
  normalizeOfficialSession,
};
