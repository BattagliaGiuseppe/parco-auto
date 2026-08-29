import type { JsonObject, LoggerAdapter } from "./types";

function cloneObject(payload: JsonObject): JsonObject {
  return { ...payload };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CANONICAL_TOP_LEVEL_FIELDS = new Set([
  "activity_state",
  "circuit_id",
  "speed_kph",
  "rpm",
  "gear",
  "lap_number",
  "current_lap_seconds",
  "last_lap_seconds",
  "best_lap_seconds",
  "delta_seconds",
  "gps_accuracy_m",
  "source_timestamp",
  "started_at",
  "ended_at",
  "engine_seconds",
  "track_seconds",
  "laps_count",
  "laps",
]);

function hasCanonicalTopLevelFields(payload: JsonObject): boolean {
  return Object.keys(payload).some((key) => CANONICAL_TOP_LEVEL_FIELDS.has(key));
}

/**
 * canonical_v1 accetta entrambe le forme:
 *   1) payload canonico diretto: { speed_kph: 120, ... }
 *   2) envelope API:            { payload: { speed_kph: 120, ... } }
 *
 * Se sono presenti campi canonici al primo livello, questi hanno sempre priorità
 * per evitare di interpretare accidentalmente un eventuale campo "payload"
 * applicativo come envelope.
 */
function normalizeCanonicalPayload(input: JsonObject): JsonObject {
  if (hasCanonicalTopLevelFields(input)) {
    return cloneObject(input);
  }

  const nestedPayload = input.payload;
  if (isJsonObject(nestedPayload)) {
    return cloneObject(nestedPayload);
  }

  return cloneObject(input);
}

export const canonicalV1Adapter: LoggerAdapter = {
  id: "canonical_v1",
  version: "1.0.1",
  label: "Motorsport Management Canonical v1",
  description: "Formato canonico nativo della piattaforma. Accetta payload diretto o envelope { payload: {...} }.",
  channels: ["live_state", "official_session"],
  normalizeLiveState(payload) {
    return normalizeCanonicalPayload(payload);
  },
  normalizeOfficialSession(payload) {
    return normalizeCanonicalPayload(payload);
  },
};
