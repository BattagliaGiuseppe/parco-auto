export const AIM_PRODUCTION_POLICY_ID = "aim_track_session_strict_v1";
const POLICY_ID = AIM_PRODUCTION_POLICY_ID;
const POLICY_VERSION = "p2.9.4.4";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function secondsBetween(startedAt, endedAt) {
  const start = Date.parse(String(startedAt || ""));
  const end = Date.parse(String(endedAt || ""));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return (end - start) / 1000;
}

function pushCheck(checks, id, ok, detail, severity = "block") {
  checks.push({ id, ok: Boolean(ok), severity, detail });
}

/**
 * P2.9.4.4 production gate for automatic AiM Official Ingest.
 *
 * This first production policy intentionally covers TRACK sessions only.
 * It is fail-closed: a file that cannot be understood with the official AiM
 * timing provider and high-confidence OUT/TIMED/IN semantics stays out of the
 * official database and requires a dry-run/manual review.
 */
export function evaluateAimProductionImport(payload) {
  const checks = [];
  const warnings = [];
  const timing = payload?.metadata?.timing_validation || {};
  const laps = payload?.metadata?.lap_normalization || {};
  const quality = payload?.metadata?.quality || {};

  const sessionSeconds = secondsBetween(payload?.started_at, payload?.ended_at);
  const trackSeconds = finite(payload?.track_seconds);
  const engineSeconds = finite(payload?.engine_seconds);
  const lapCount = Number.isInteger(payload?.laps_count) ? payload.laps_count : Number(payload?.laps_count);
  const detailedLaps = Array.isArray(payload?.laps) ? payload.laps : [];

  pushCheck(
    checks,
    "official_timing_provider",
    timing.provider === "aim_official_dll" && timing.official_ingest_ready === true,
    `provider=${timing.provider || "missing"}; ready=${timing.official_ingest_ready === true}`,
  );
  pushCheck(
    checks,
    "lap_normalization_high_confidence",
    laps.method === "race_studio_boundary_semantics_v1" && laps.confidence === "high",
    `method=${laps.method || "missing"}; confidence=${laps.confidence || "missing"}`,
  );
  pushCheck(
    checks,
    "out_and_in_boundaries_present",
    Boolean(laps.out_lap) && Boolean(laps.in_lap),
    `out=${Boolean(laps.out_lap)}; in=${Boolean(laps.in_lap)}`,
  );
  pushCheck(
    checks,
    "timed_laps_present",
    Number.isFinite(lapCount) && lapCount >= 1 && detailedLaps.length === lapCount,
    `laps_count=${Number.isFinite(lapCount) ? lapCount : "invalid"}; detailed=${detailedLaps.length}`,
  );

  const uniqueLapNumbers = new Set();
  let lapsValid = detailedLaps.length > 0;
  for (let index = 0; index < detailedLaps.length; index += 1) {
    const lap = detailedLaps[index];
    const number = Number(lap?.lap_number);
    const time = finite(lap?.lap_time_seconds);
    if (!Number.isInteger(number) || number !== index + 1 || uniqueLapNumbers.has(number) || time === null || time <= 0 || time > 3600) {
      lapsValid = false;
      break;
    }
    uniqueLapNumbers.add(number);
  }
  pushCheck(checks, "timed_laps_valid", lapsValid, `unique_valid=${lapsValid}; count=${detailedLaps.length}`);

  pushCheck(
    checks,
    "session_time_window_valid",
    sessionSeconds !== null && sessionSeconds > 0 && sessionSeconds <= 172800,
    `session_seconds=${sessionSeconds === null ? "invalid" : sessionSeconds.toFixed(3)}`,
  );

  // Small tolerance only for timestamp/float representation, never to mask a
  // materially inconsistent log.
  const tolerance = 5;
  pushCheck(
    checks,
    "track_time_within_session",
    sessionSeconds !== null && trackSeconds !== null && trackSeconds > 0 && trackSeconds <= sessionSeconds + tolerance,
    `track_seconds=${trackSeconds ?? "missing"}; session_seconds=${sessionSeconds ?? "invalid"}`,
  );

  const outSeconds = finite(laps?.out_lap?.duration_seconds);
  const inSeconds = finite(laps?.in_lap?.duration_seconds);
  const timedSum = detailedLaps.reduce((sum, lap) => sum + (finite(lap?.lap_time_seconds) || 0), 0);
  const lapTableTrackSeconds = outSeconds !== null && inSeconds !== null
    ? outSeconds + timedSum + inSeconds
    : null;
  pushCheck(
    checks,
    "track_time_matches_lap_table",
    trackSeconds !== null && lapTableTrackSeconds !== null && Math.abs(trackSeconds - lapTableTrackSeconds) <= 0.25,
    `track_seconds=${trackSeconds ?? "missing"}; lap_table_seconds=${lapTableTrackSeconds === null ? "invalid" : lapTableTrackSeconds.toFixed(3)}`,
  );

  pushCheck(
    checks,
    "engine_time_within_session",
    engineSeconds === null || (engineSeconds >= 0 && sessionSeconds !== null && engineSeconds <= sessionSeconds + tolerance),
    `engine_seconds=${engineSeconds ?? "not_available"}; session_seconds=${sessionSeconds ?? "invalid"}`,
  );

  const maxSpeed = finite(payload?.max_speed);
  const maxRpm = finite(payload?.max_rpm);
  pushCheck(checks, "max_speed_plausible", maxSpeed === null || (maxSpeed >= 0 && maxSpeed <= 600), `max_speed=${maxSpeed ?? "not_available"}`);
  pushCheck(checks, "max_rpm_plausible", maxRpm === null || (maxRpm >= 0 && maxRpm <= 30000), `max_rpm=${maxRpm ?? "not_available"}`);

  if (!payload?.track_name) warnings.push("track_name_missing");
  if (!payload?.metadata?.driver) warnings.push("driver_missing_use_device_or_event_binding");
  if (!payload?.metadata?.vehicle) warnings.push("vehicle_missing_use_connected_device_binding");
  if (engineSeconds === null) warnings.push("engine_seconds_missing_hours_may_require_estimation_or_review");
  if (maxSpeed === null) warnings.push("max_speed_missing");
  if (maxRpm === null) warnings.push("max_rpm_missing");
  if (payload?.metadata?.timing_basis === "file_mtime_fallback") warnings.push("session_timestamp_uses_file_mtime_fallback");
  if (quality.max_speed_unit_known === false) warnings.push("speed_unit_unknown");

  let bestLapSeconds = null;
  let bestLapNumber = null;
  for (const lap of detailedLaps) {
    const time = finite(lap?.lap_time_seconds);
    if (time !== null && (bestLapSeconds === null || time < bestLapSeconds)) {
      bestLapSeconds = time;
      bestLapNumber = Number(lap.lap_number);
    }
  }

  const blocking = checks.filter((check) => !check.ok && check.severity === "block");
  const status = blocking.length ? "blocked" : "ready";

  return {
    id: POLICY_ID,
    version: POLICY_VERSION,
    mode: "track_session_strict_v1",
    status,
    automatic_official_ingest: status === "ready",
    blocking_reasons: blocking.map((check) => check.id),
    warnings,
    checks,
    derived: {
      session_seconds: sessionSeconds === null ? null : Number(sessionSeconds.toFixed(3)),
      timed_laps: Number.isFinite(lapCount) ? lapCount : null,
      track_seconds: trackSeconds,
      engine_seconds: engineSeconds,
      timing_provider: timing.provider || null,
      lap_normalization_method: laps.method || null,
      lap_table_track_seconds: lapTableTrackSeconds === null ? null : Number(lapTableTrackSeconds.toFixed(3)),
      best_lap_number: bestLapNumber,
      best_lap_seconds: bestLapSeconds,
    },
  };
}

export function attachAimProductionImportPolicy(payload) {
  const decision = evaluateAimProductionImport(payload);
  return {
    payload: {
      ...payload,
      metadata: {
        ...(payload?.metadata || {}),
        production_import_policy: decision,
      },
    },
    decision,
  };
}
