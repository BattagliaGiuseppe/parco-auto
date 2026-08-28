export type LiveGpsSample = {
  ts: string | number | Date;
  lat: number;
  lon: number;
  speedKph?: number;
};

export type ReferencePoint = {
  lat: number;
  lon: number;
  elapsed_s: number;
  progress?: number;
};

export type DeltaResult = {
  valid: boolean;
  deltaSeconds: number | null;
  lapElapsedSeconds: number;
  referenceElapsedSeconds: number | null;
  progress: number | null;
  distanceToReferenceM: number | null;
  matchedSegmentIndex: number | null;
};

type PreparedPoint = ReferencePoint & { progress: number };

const EARTH_RADIUS_M = 6371000;

function toMs(value: LiveGpsSample["ts"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Date.parse(value);
}

function distanceM(a: Pick<ReferencePoint, "lat" | "lon">, b: Pick<ReferencePoint, "lat" | "lon">): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function xyMeters(lat: number, lon: number, originLat: number, originLon: number) {
  const latRad = (originLat * Math.PI) / 180;
  return {
    x: ((lon - originLon) * Math.PI / 180) * EARTH_RADIUS_M * Math.cos(latRad),
    y: ((lat - originLat) * Math.PI / 180) * EARTH_RADIUS_M,
  };
}

export function buildReferenceProfile(samples: LiveGpsSample[], lapStartedAt: LiveGpsSample["ts"], maxPoints = 240): ReferencePoint[] {
  if (samples.length < 2) throw new Error("Servono almeno 2 campioni GPS per creare un riferimento.");
  const startMs = toMs(lapStartedAt);
  if (!Number.isFinite(startMs)) throw new Error("Timestamp inizio giro non valido.");

  const clean = samples
    .map((sample) => ({ ...sample, ms: toMs(sample.ts) }))
    .filter((sample) => Number.isFinite(sample.ms) && Number.isFinite(sample.lat) && Number.isFinite(sample.lon) && sample.ms >= startMs)
    .sort((a, b) => a.ms - b.ms);
  if (clean.length < 2) throw new Error("Campioni GPS insufficienti dopo la validazione.");

  const target = Math.max(2, Math.min(400, Math.floor(maxPoints)));
  const step = clean.length <= target ? 1 : (clean.length - 1) / (target - 1);
  const selected = clean.length <= target
    ? clean
    : Array.from({ length: target }, (_, i) => clean[Math.min(clean.length - 1, Math.round(i * step))]);

  let totalDistance = 0;
  const cumulative = [0];
  for (let i = 1; i < selected.length; i += 1) {
    totalDistance += distanceM(selected[i - 1], selected[i]);
    cumulative.push(totalDistance);
  }

  return selected.map((sample, index) => ({
    lat: sample.lat,
    lon: sample.lon,
    elapsed_s: Math.max(0, (sample.ms - startMs) / 1000),
    progress: totalDistance > 0 ? cumulative[index] / totalDistance : index / Math.max(1, selected.length - 1),
  }));
}

export class LiveDeltaEngine {
  private readonly points: PreparedPoint[];
  private readonly maxMatchDistanceM: number;
  private lapStartedMs: number | null = null;
  private lastSegmentIndex = 0;
  private lastProgress = 0;

  constructor(referencePoints: ReferencePoint[], options?: { maxMatchDistanceM?: number }) {
    if (referencePoints.length < 2) throw new Error("Reference lap non valido.");
    this.maxMatchDistanceM = options?.maxMatchDistanceM ?? 40;

    let totalDistance = 0;
    const cumulative = [0];
    for (let i = 1; i < referencePoints.length; i += 1) {
      totalDistance += distanceM(referencePoints[i - 1], referencePoints[i]);
      cumulative.push(totalDistance);
    }

    this.points = referencePoints.map((point, index) => ({
      ...point,
      progress: Number.isFinite(point.progress)
        ? Math.max(0, Math.min(1, Number(point.progress)))
        : totalDistance > 0
          ? cumulative[index] / totalDistance
          : index / Math.max(1, referencePoints.length - 1),
    }));
  }

  startLap(at: LiveGpsSample["ts"]) {
    const ms = toMs(at);
    if (!Number.isFinite(ms)) throw new Error("Timestamp avvio giro non valido.");
    this.lapStartedMs = ms;
    this.lastSegmentIndex = 0;
    this.lastProgress = 0;
  }

  reset() {
    this.lapStartedMs = null;
    this.lastSegmentIndex = 0;
    this.lastProgress = 0;
  }

  update(sample: LiveGpsSample): DeltaResult {
    const sampleMs = toMs(sample.ts);
    const lapElapsedSeconds = this.lapStartedMs === null || !Number.isFinite(sampleMs)
      ? 0
      : Math.max(0, (sampleMs - this.lapStartedMs) / 1000);

    if (this.lapStartedMs === null || !Number.isFinite(sampleMs) || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) {
      return { valid: false, deltaSeconds: null, lapElapsedSeconds, referenceElapsedSeconds: null, progress: null, distanceToReferenceM: null, matchedSegmentIndex: null };
    }

    const firstPass = this.lastProgress <= 0.001;
    const searchStart = firstPass ? 0 : Math.max(0, this.lastSegmentIndex - 6);
    const searchEnd = firstPass ? this.points.length - 2 : Math.min(this.points.length - 2, this.lastSegmentIndex + 45);

    let best: { distance: number; elapsed: number; progress: number; index: number } | null = null;
    for (let i = searchStart; i <= searchEnd; i += 1) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const originLat = (a.lat + b.lat + sample.lat) / 3;
      const originLon = (a.lon + b.lon + sample.lon) / 3;
      const pa = xyMeters(a.lat, a.lon, originLat, originLon);
      const pb = xyMeters(b.lat, b.lon, originLat, originLon);
      const ps = xyMeters(sample.lat, sample.lon, originLat, originLon);
      const vx = pb.x - pa.x;
      const vy = pb.y - pa.y;
      const len2 = vx * vx + vy * vy;
      const rawT = len2 > 0 ? ((ps.x - pa.x) * vx + (ps.y - pa.y) * vy) / len2 : 0;
      const t = Math.max(0, Math.min(1, rawT));
      const qx = pa.x + vx * t;
      const qy = pa.y + vy * t;
      const dx = ps.x - qx;
      const dy = ps.y - qy;
      const distance = Math.hypot(dx, dy);
      const progress = a.progress + (b.progress - a.progress) * t;
      if (!firstPass && progress + 0.025 < this.lastProgress) continue;
      const elapsed = a.elapsed_s + (b.elapsed_s - a.elapsed_s) * t;
      if (!best || distance < best.distance) best = { distance, elapsed, progress, index: i };
    }

    if (!best || best.distance > this.maxMatchDistanceM) {
      return { valid: false, deltaSeconds: null, lapElapsedSeconds, referenceElapsedSeconds: null, progress: null, distanceToReferenceM: best?.distance ?? null, matchedSegmentIndex: best?.index ?? null };
    }

    if (best.progress >= this.lastProgress - 0.01) {
      this.lastProgress = Math.max(this.lastProgress, best.progress);
      this.lastSegmentIndex = best.index;
    }

    return {
      valid: true,
      deltaSeconds: lapElapsedSeconds - best.elapsed,
      lapElapsedSeconds,
      referenceElapsedSeconds: best.elapsed,
      progress: best.progress,
      distanceToReferenceM: best.distance,
      matchedSegmentIndex: best.index,
    };
  }
}
