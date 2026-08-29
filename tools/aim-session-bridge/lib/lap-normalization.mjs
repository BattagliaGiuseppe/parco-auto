function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function durationMs(lap) {
  const start = finite(lap?.startTime);
  const end = finite(lap?.endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

function summary(item) {
  if (!item) return null;
  return {
    raw_index: item.rawIndex,
    raw_lap_num: finite(item.raw?.num),
    duration_seconds: Number((item.durationMs / 1000).toFixed(3)),
    ...(item.distanceMeters !== null ? { distance_m: Number(item.distanceMeters.toFixed(1)) } : {}),
  };
}

function areConsecutiveRawNumbers(items) {
  const nums = items.map((item) => finite(item.raw?.num));
  if (nums.some((num) => num === null)) return false;
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }
  return true;
}

function distanceFallback(items) {
  const distances = items
    .map((item) => item.distanceMeters)
    .filter((value) => value !== null && value > 50)
    .sort((a, b) => a - b);

  if (distances.length < 3) return null;
  const median = distances[Math.floor(distances.length / 2)];
  const timed = items.filter(
    (item) => item.distanceMeters !== null && item.distanceMeters >= median * 0.9,
  );
  return timed.length ? { timed, median } : null;
}

/**
 * Normalizza la lap table XRK nel modello mostrato da Race Studio:
 *   OUT + giri cronometrati + IN.
 *
 * AiM restituisce normalmente anche i due segmenti di confine. Quando la
 * sequenza LAP è completa e consecutiva, il primo record è l'OUT e l'ultimo
 * l'IN; i record intermedi sono i soli giri da inviare come laps ufficiali.
 *
 * In file anomali/non consecutivi non inventiamo OUT/IN: usiamo un fallback
 * conservativo basato sulla distanza GPS e segnaliamo la confidenza ridotta.
 */
export function normalizeAimLaps(rawLaps, { distanceResolver } = {}) {
  const source = Array.isArray(rawLaps) ? rawLaps : [];
  const items = source
    .map((raw, rawIndex) => {
      const ms = durationMs(raw);
      if (ms === null || ms < 5000 || ms > 3_600_000) return null;
      const resolvedDistance = typeof distanceResolver === "function" ? finite(distanceResolver(raw, rawIndex)) : null;
      return {
        raw,
        rawIndex,
        durationMs: ms,
        distanceMeters: resolvedDistance !== null && resolvedDistance > 0 ? resolvedDistance : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.raw.startTime) - Number(b.raw.startTime));

  if (!items.length) {
    return {
      method: "none",
      confidence: "none",
      rawCount: source.length,
      usableCount: 0,
      timed: [],
      out: null,
      in: null,
      trackSeconds: 0,
      diagnostics: { reason: "no_usable_laps" },
    };
  }

  const consecutive = areConsecutiveRawNumbers(items);
  if (items.length >= 3 && consecutive) {
    const out = items[0];
    const inLap = items[items.length - 1];
    const timed = items.slice(1, -1);
    const trackSeconds = items.reduce((sum, item) => sum + item.durationMs, 0) / 1000;

    return {
      method: "race_studio_boundary_semantics_v1",
      confidence: "high",
      rawCount: source.length,
      usableCount: items.length,
      timed,
      out,
      in: inLap,
      trackSeconds,
      diagnostics: {
        consecutive_raw_lap_numbers: true,
        out_lap: summary(out),
        in_lap: summary(inLap),
      },
    };
  }

  const fallback = distanceFallback(items);
  const timed = fallback?.timed || items;
  const trackSeconds = timed.reduce((sum, item) => sum + item.durationMs, 0) / 1000;

  return {
    method: fallback ? "distance_fallback_v1" : "raw_fallback_v1",
    confidence: fallback ? "medium" : "low",
    rawCount: source.length,
    usableCount: items.length,
    timed,
    out: null,
    in: null,
    trackSeconds,
    diagnostics: {
      consecutive_raw_lap_numbers: consecutive,
      ...(fallback ? { median_lap_distance_m: Number(fallback.median.toFixed(1)) } : {}),
      reason: consecutive ? "boundary_semantics_not_applicable" : "non_consecutive_lap_table",
    },
  };
}

export function normalizedTimedLapPayload(normalized) {
  return normalized.timed.map((item, index) => ({
    lap_number: index + 1,
    lap_time_seconds: Number((item.durationMs / 1000).toFixed(3)),
    metadata: {
      aim_segment_type: "timed",
      aim_raw_index: item.rawIndex,
      aim_raw_lap_num: finite(item.raw?.num),
      ...(item.distanceMeters !== null ? { distance_m: Number(item.distanceMeters.toFixed(1)) } : {}),
    },
  }));
}
