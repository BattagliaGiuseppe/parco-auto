import assert from "node:assert/strict";
import { evaluateAimProductionImport } from "../lib/production-import-policy.mjs";

const timed = [231.929,114.178,107.475,104.220,103.679,102.229,102.128,100.905,101.858,102.409,101.926,101.830,103.554];
const out = 43.357;
const incoming = 194.169;
const trackSeconds = Number((out + timed.reduce((a,b)=>a+b,0) + incoming).toFixed(3));

function realVallelungaPayload() {
  return {
    started_at: "2026-04-19T09:42:29.000Z",
    ended_at: "2026-04-19T10:11:24.630Z",
    track_seconds: trackSeconds,
    engine_seconds: 1711.967,
    laps_count: 13,
    laps: timed.map((seconds, index) => ({ lap_number: index + 1, lap_time_seconds: seconds })),
    max_speed: 230.887683,
    max_rpm: 14191,
    track_name: "Vallelunga",
    metadata: {
      timing_basis: "aim_metadata",
      timing_validation: {
        provider: "aim_official_dll",
        official_ingest_ready: true,
      },
      lap_normalization: {
        method: "race_studio_boundary_semantics_v1",
        confidence: "high",
        raw_segments: 15,
        timed_laps: 13,
        out_lap: { duration_seconds: out },
        in_lap: { duration_seconds: incoming },
      },
      quality: { max_speed_unit_known: true },
      driver: null,
      vehicle: null,
    },
  };
}

{
  const result = evaluateAimProductionImport(realVallelungaPayload());
  assert.equal(result.status, "ready");
  assert.equal(result.automatic_official_ingest, true);
  assert.equal(result.derived.timed_laps, 13);
  assert.equal(result.derived.best_lap_number, 8);
  assert.equal(result.derived.best_lap_seconds, 100.905);
  assert.equal(result.derived.lap_table_track_seconds, trackSeconds);
  assert.deepEqual(result.blocking_reasons, []);
  assert(result.warnings.includes("driver_missing_use_device_or_event_binding"));
  assert(result.warnings.includes("vehicle_missing_use_connected_device_binding"));
}

{
  const payload = realVallelungaPayload();
  payload.metadata.timing_validation.provider = "aim-xrk";
  payload.metadata.timing_validation.official_ingest_ready = false;
  const result = evaluateAimProductionImport(payload);
  assert.equal(result.status, "blocked");
  assert(result.blocking_reasons.includes("official_timing_provider"));
}

{
  const payload = realVallelungaPayload();
  payload.track_seconds += 20;
  const result = evaluateAimProductionImport(payload);
  assert.equal(result.status, "blocked");
  assert(result.blocking_reasons.includes("track_time_matches_lap_table"));
}

{
  const payload = realVallelungaPayload();
  payload.laps[7].lap_number = 9;
  const result = evaluateAimProductionImport(payload);
  assert.equal(result.status, "blocked");
  assert(result.blocking_reasons.includes("timed_laps_valid"));
}

console.log("P2.9.4.4 production import policy tests: OK");
