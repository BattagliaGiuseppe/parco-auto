import { parseXrk } from "aim-xrk";
import { normalizeAimLaps, normalizedTimedLapPayload } from "./lap-normalization.mjs";
import { officialAimDllAvailable, readAimOfficialDllSession } from "./aim-official-dll-provider.mjs";

const BRIDGE_VERSION = "p2.9.4.3";
const PARSER_ID = "aim-xrk";

function key(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function channelStats(channel) {
  if (!channel?.values?.length) return null;
  let min = Infinity;
  let max = -Infinity;
  let finiteCount = 0;
  const distinct = new Set();
  for (const raw of channel.values) {
    const value = finite(raw);
    if (value === null) continue;
    finiteCount += 1;
    if (value < min) min = value;
    if (value > max) max = value;
    if (distinct.size < 128) distinct.add(value);
  }
  if (!finiteCount) return null;
  return { min, max, finiteCount, distinct: distinct.size, dead: min === max };
}

function findChannel(log, aliases, options = {}) {
  const wanted = new Set(aliases.map(key));
  const candidates = [];
  for (const [name, channel] of Object.entries(log.channels || {})) {
    const names = [name, channel?.name, channel?.shortName, channel?.func].map(key);
    if (!names.some((nameKey) => wanted.has(nameKey))) continue;
    const stats = channelStats(channel);
    if (!stats) continue;
    let score = 0;
    if (!stats.dead) score += 20;
    if (stats.distinct >= 8) score += 10;
    if (options.kind === "rpm") {
      if (stats.max >= 1000 && stats.max <= 30000) score += 30;
      if (stats.max < 300) score -= 50;
    }
    if (options.kind === "speed") {
      if (stats.max > 5) score += 15;
    }
    candidates.push({ channel, stats, score, name });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function unitKey(unit) {
  return String(unit || "").toLowerCase().replace(/\s+/g, "");
}

function speedFactorToKph(unit) {
  const u = unitKey(unit);
  if (["km/h", "kmh", "kph"].includes(u)) return 1;
  if (["m/s", "mps", "ms-1", "m/s²"].includes(u)) return 3.6;
  if (["mph"].includes(u)) return 1.609344;
  return null;
}

function speedFactorToMps(unit) {
  const kph = speedFactorToKph(unit);
  return kph === null ? null : kph / 3.6;
}

function maxChannelValue(candidate, factor = 1) {
  if (!candidate?.stats) return null;
  return candidate.stats.max * factor;
}

function integrateEngineSeconds(rpmCandidate, thresholdRpm = 500) {
  const ch = rpmCandidate?.channel;
  if (!ch?.timecodes?.length || ch.timecodes.length !== ch.values.length) return null;
  let seconds = 0;
  const gaps = [];
  for (let i = 1; i < ch.timecodes.length; i++) {
    const dt = Number(ch.timecodes[i]) - Number(ch.timecodes[i - 1]);
    if (Number.isFinite(dt) && dt > 0 && dt < 10000) gaps.push(dt);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const medianDt = gaps[Math.floor(gaps.length / 2)];
  const maxTrustedDt = Math.max(1000, medianDt * 3);
  for (let i = 1; i < ch.timecodes.length; i++) {
    const prev = finite(ch.values[i - 1]);
    const curr = finite(ch.values[i]);
    const dt = Number(ch.timecodes[i]) - Number(ch.timecodes[i - 1]);
    if (prev === null || curr === null || !Number.isFinite(dt) || dt <= 0 || dt > maxTrustedDt) continue;
    if (prev > thresholdRpm || curr > thresholdRpm) seconds += dt / 1000;
  }
  return Math.max(0, seconds);
}

function lapDistanceMeters(speedCandidate, lap) {
  const ch = speedCandidate?.channel;
  if (!ch?.timecodes?.length || ch.timecodes.length !== ch.values.length) return null;
  const factor = speedFactorToMps(ch.units);
  if (factor === null) return null;
  let distance = 0;
  for (let i = 1; i < ch.timecodes.length; i++) {
    const t0 = Number(ch.timecodes[i - 1]);
    const t1 = Number(ch.timecodes[i]);
    if (t1 <= lap.startTime || t0 >= lap.endTime) continue;
    const v0 = finite(ch.values[i - 1]);
    const v1 = finite(ch.values[i]);
    if (v0 === null || v1 === null || !Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue;
    distance += ((v0 + v1) / 2) * factor * ((t1 - t0) / 1000);
  }
  return distance > 0 ? distance : null;
}

function getMetadata(log, aliases) {
  const wanted = new Set(aliases.map(key));
  for (const [name, value] of Object.entries(log.metadata || {})) {
    if (wanted.has(key(name)) && value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function parseAimDate(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = String(value).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  let [, d, m, y, hh = "0", mm = "0", ss = "0"] = match;
  if (y.length === 2) y = `20${y}`;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sessionDurationMs(log) {
  let maxMs = 0;
  for (const channel of Object.values(log.channels || {})) {
    const t = channel?.timecodes;
    if (t?.length) {
      const last = Number(t[t.length - 1]);
      if (Number.isFinite(last) && last > maxMs) maxMs = last;
    }
  }
  for (const lap of log.laps || []) {
    const end = Number(lap.endTime);
    if (Number.isFinite(end) && end > maxMs) maxMs = end;
  }
  return maxMs;
}

function resolveSessionTimes(log, fileStat) {
  const durationMs = sessionDurationMs(log);
  const date = getMetadata(log, ["Log Date", "Date", "Session Date"]);
  const time = getMetadata(log, ["Log Time", "Time", "Session Time"]);
  const combined = date && time ? `${date} ${time}` : date;
  const metadataStart = parseAimDate(combined);
  if (metadataStart) {
    return {
      startedAt: metadataStart,
      endedAt: new Date(metadataStart.getTime() + durationMs),
      durationMs,
      basis: "aim_metadata",
    };
  }
  const endedAt = new Date(fileStat.mtimeMs);
  return {
    startedAt: new Date(endedAt.getTime() - durationMs),
    endedAt,
    durationMs,
    basis: "file_mtime_fallback",
  };
}

export function parseAimSession(buffer, { fileName, fileStat, filePath, timingProvider = "auto", aimDllPath = "" }) {
  const log = parseXrk(buffer);
  const speed = findChannel(log, ["GPS Speed", "GPS_Speed", "Speed", "Vehicle Speed", "RSV4 BkSpeed"], { kind: "speed" });
  const rpm = findChannel(log, ["RSV4 RPM", "RPM", "Engine RPM", "OBDII_RPM", "OBD RPM"], { kind: "rpm" });

  const wantOfficial = timingProvider === "aim_official_dll" ||
    (timingProvider === "auto" && filePath && officialAimDllAvailable(aimDllPath));
  const official = wantOfficial
    ? readAimOfficialDllSession(filePath, { dllPath: aimDllPath })
    : null;
  if (timingProvider === "aim_official_dll" && !official) {
    throw new Error("Provider timing AiM DLL richiesto ma non disponibile.");
  }

  const lapSource = official?.laps || log.laps;
  const normalizedLaps = normalizeAimLaps(lapSource, {
    distanceResolver: (lap) => lapDistanceMeters(speed, lap),
  });
  const laps = normalizedTimedLapPayload(normalizedLaps);
  const times = resolveSessionTimes(log, fileStat);

  const speedToKph = speed ? speedFactorToKph(speed.channel.units) : null;
  const parsedMaxSpeedKph = speedToKph === null ? null : maxChannelValue(speed, speedToKph);
  const parsedMaxRpm = maxChannelValue(rpm, 1);
  const parsedEngineSeconds = integrateEngineSeconds(rpm);
  const maxSpeedKph = finite(official?.max_speed_kph) ?? parsedMaxSpeedKph;
  const maxRpm = finite(official?.max_rpm) ?? parsedMaxRpm;
  const engineSeconds = finite(official?.engine_seconds) ?? parsedEngineSeconds;
  const trackSeconds = normalizedLaps.trackSeconds;

  const payload = {
    started_at: times.startedAt.toISOString(),
    ended_at: times.endedAt.toISOString(),
    track_seconds: Number(trackSeconds.toFixed(3)),
    laps_count: laps.length,
    laps,
    ...(engineSeconds !== null && engineSeconds > 0 ? { engine_seconds: Number(engineSeconds.toFixed(3)) } : {}),
    ...(maxSpeedKph !== null ? { max_speed: Number(maxSpeedKph.toFixed(3)) } : {}),
    ...(maxRpm !== null ? { max_rpm: Number(maxRpm.toFixed(0)) } : {}),
    ...((official?.metadata?.track || getMetadata(log, ["Track", "Venue", "Circuit"])) ? {
      track_name: official?.metadata?.track || getMetadata(log, ["Track", "Venue", "Circuit"]),
    } : {}),
    metadata: {
      bridge_version: BRIDGE_VERSION,
      parser: PARSER_ID,
      parser_mode: "isolated_replaceable",
      source_file_name: fileName,
      timing_basis: times.basis,
      timing_validation: {
        provider: official ? "aim_official_dll" : "aim-xrk",
        lap_table_source: official ? "aim_official_dll_get_lap_info" : "parsed_xrk_lap_table",
        nominal_precision_ms: 1,
        official_dll_validated: Boolean(official),
        official_ingest_ready: Boolean(official),
        policy: official ? "official_aim_dll_authoritative" : "dry_run_until_official_aim_dll_provider",
        ...(official?.dll ? { dll: official.dll } : {}),
      },
      logger_model: getMetadata(log, ["Logger Model", "Logger", "Device Model"]),
      logger_serial: getMetadata(log, ["Logger Serial", "Serial", "Serial Number"]),
      driver: official?.metadata?.racer || getMetadata(log, ["Driver", "Racer"]),
      vehicle: official?.metadata?.vehicle || getMetadata(log, ["Vehicle"]),
      venue: official?.metadata?.track || getMetadata(log, ["Venue", "Track"]),
      selected_channels: {
        speed: official?.selected_channels?.speed || speed?.name || null,
        speed_unit: official?.selected_channels?.speed_unit || speed?.channel?.units || null,
        rpm: official?.selected_channels?.rpm || rpm?.name || null,
      },
      lap_normalization: {
        method: normalizedLaps.method,
        confidence: normalizedLaps.confidence,
        raw_segments: normalizedLaps.rawCount,
        usable_segments: normalizedLaps.usableCount,
        timed_laps: laps.length,
        track_seconds_basis: normalizedLaps.method === "race_studio_boundary_semantics_v1"
          ? "out_plus_timed_plus_in"
          : "accepted_segments",
        ...normalizedLaps.diagnostics,
      },
      quality: {
        raw_laps: Array.isArray(log.laps) ? log.laps.length : 0,
        accepted_laps: laps.length,
        timed_laps: laps.length,
        lap_normalization_method: normalizedLaps.method,
        lap_normalization_confidence: normalizedLaps.confidence,
        engine_seconds_from_rpm: engineSeconds !== null,
        max_speed_unit_known: speedToKph !== null,
      },
    },
  };

  if (!payload.laps_count && !payload.engine_seconds && !payload.track_seconds) {
    throw new Error("Sessione AiM priva di attività utilizzabile.");
  }

  return { payload, diagnostics: payload.metadata };
}
