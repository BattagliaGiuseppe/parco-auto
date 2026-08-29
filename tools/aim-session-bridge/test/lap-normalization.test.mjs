import assert from "node:assert/strict";
import { normalizeAimLaps, normalizedTimedLapPayload } from "../lib/lap-normalization.mjs";

// Fixture sintetica costruita sulla struttura Race Studio validata in P2.9.4.1:
// OUT + 13 giri cronometrati + IN.
const durations = [
  43.525,
  231.815,
  114.137,
  107.475,
  104.219,
  103.680,
  102.229,
  102.128,
  100.904,
  101.858,
  102.408,
  101.927,
  101.829,
  103.555,
  194.044,
];

let cursor = 0;
const raw = durations.map((seconds, index) => {
  const startTime = cursor;
  cursor += Math.round(seconds * 1000);
  return { num: index, startTime, endTime: cursor };
});

const normalized = normalizeAimLaps(raw);
const laps = normalizedTimedLapPayload(normalized);

assert.equal(normalized.method, "race_studio_boundary_semantics_v1");
assert.equal(normalized.confidence, "high");
assert.equal(normalized.rawCount, 15);
assert.equal(laps.length, 13);
assert.equal(normalized.out.rawIndex, 0);
assert.equal(normalized.in.rawIndex, 14);
assert.deepEqual(laps.map((lap) => lap.lap_number), Array.from({ length: 13 }, (_, i) => i + 1));

const best = laps.reduce((a, b) => a.lap_time_seconds <= b.lap_time_seconds ? a : b);
assert.equal(best.lap_number, 8);
assert.equal(best.lap_time_seconds, 100.904);
assert.equal(Number(normalized.trackSeconds.toFixed(3)), 1715.733);

console.log("P2.9.4.1 lap normalization OK: OUT + 13 timed + IN, best lap 8 = 1:40.904");
