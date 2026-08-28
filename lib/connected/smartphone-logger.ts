export type SmartphoneLoggerCircuit = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  detectionRadiusM: number | null;
};

export type SmartphoneLoggerSample = {
  ts: string;
  lat: number;
  lon: number;
  engine_on: true;
  speed_kph: number;
  accuracy_m?: number;
};

export type SmartphoneLoggerWindow = {
  external_window_id: string;
  circuitId: string;
  samplesCount: number;
  startedAt: string;
  endedAt: string;
  payload: {
    max_gap_seconds: number;
    track_entry_speed_kph: number;
    track_exit_speed_kph: number;
    track_exit_hold_seconds: number;
    samples: SmartphoneLoggerSample[];
  };
};

export type SmartphoneLoggerSnapshot = {
  state: "idle" | "armed" | "capturing";
  matchedCircuitId: string | null;
  matchedCircuitName: string | null;
  samplesBuffered: number;
  trackSeen: boolean;
};

export type SmartphoneLoggerUpdate = SmartphoneLoggerSnapshot & {
  finalizedWindow?: SmartphoneLoggerWindow;
};

type NumericSample = SmartphoneLoggerSample & { tsMs: number };

type SmartphoneLoggerOptions = {
  preRollSeconds?: number;
  activitySpeedKph?: number;
  trackEntrySpeedKph?: number;
  trackExitSpeedKph?: number;
  trackExitHoldSeconds?: number;
  localStopHoldSeconds?: number;
  outsideHoldSeconds?: number;
  maxGapSeconds?: number;
  maxSamples?: number;
};

const EARTH_RADIUS_M = 6371000;

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function clampFinite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function publicSample(sample: NumericSample): SmartphoneLoggerSample {
  const { tsMs: _tsMs, ...rest } = sample;
  return rest;
}

export class SmartphoneLoggerEngine {
  private circuits: SmartphoneLoggerCircuit[];
  private readonly preRollSeconds: number;
  private readonly activitySpeedKph: number;
  private readonly trackEntrySpeedKph: number;
  private readonly trackExitSpeedKph: number;
  private readonly trackExitHoldSeconds: number;
  private readonly localStopHoldSeconds: number;
  private readonly outsideHoldSeconds: number;
  private readonly maxGapSeconds: number;
  private readonly maxSamples: number;

  private armed = false;
  private armId = "";
  private sequence = 0;
  private preRoll: NumericSample[] = [];
  private active: NumericSample[] = [];
  private activeCircuitId: string | null = null;
  private trackSeen = false;
  private lowSpeedSince: number | null = null;
  private outsideSince: number | null = null;
  private lastWindowEndMs = 0;
  private lastSampleMs = 0;

  constructor(circuits: SmartphoneLoggerCircuit[], options: SmartphoneLoggerOptions = {}) {
    this.circuits = circuits;
    this.preRollSeconds = options.preRollSeconds ?? 45;
    this.activitySpeedKph = options.activitySpeedKph ?? 8;
    this.trackEntrySpeedKph = options.trackEntrySpeedKph ?? 45;
    this.trackExitSpeedKph = options.trackExitSpeedKph ?? 20;
    this.trackExitHoldSeconds = options.trackExitHoldSeconds ?? 20;
    this.localStopHoldSeconds = options.localStopHoldSeconds ?? 35;
    this.outsideHoldSeconds = options.outsideHoldSeconds ?? 12;
    this.maxGapSeconds = options.maxGapSeconds ?? 90;
    this.maxSamples = options.maxSamples ?? 1950;
  }

  setCircuits(circuits: SmartphoneLoggerCircuit[]) {
    this.circuits = circuits;
  }

  arm(armId: string, sequence = 0) {
    this.armed = true;
    this.armId = armId;
    this.sequence = Math.max(0, Math.floor(sequence));
    this.resetCapture();
    return this.snapshot();
  }

  disarm(): SmartphoneLoggerUpdate {
    const finalizedWindow = this.trackSeen ? this.finalizeWindow() : undefined;
    this.armed = false;
    this.preRoll = [];
    this.resetCapture();
    return { ...this.snapshot(), finalizedWindow };
  }

  getSequence() {
    return this.sequence;
  }

  update(input: { tsMs: number; lat: number; lon: number; speedKph: number; accuracyM?: number }): SmartphoneLoggerUpdate {
    if (!this.armed) return this.snapshot();
    const tsMs = clampFinite(input.tsMs, Date.now());
    if (tsMs <= 0 || !Number.isFinite(input.lat) || !Number.isFinite(input.lon)) return this.snapshot();
    if (this.lastSampleMs && tsMs <= this.lastSampleMs) return this.snapshot();

    const speedKph = Math.max(0, clampFinite(input.speedKph));
    const sample: NumericSample = {
      ts: new Date(tsMs).toISOString(),
      tsMs,
      lat: input.lat,
      lon: input.lon,
      engine_on: true,
      speed_kph: speedKph,
      ...(Number.isFinite(input.accuracyM) ? { accuracy_m: Math.max(0, Number(input.accuracyM)) } : {}),
    };

    if (this.lastSampleMs && (tsMs - this.lastSampleMs) / 1000 > this.maxGapSeconds) {
      // Un buco lungo rende la finestra non affidabile. Se avevamo già visto la pista,
      // chiudiamo quanto raccolto; altrimenti ripartiamo senza generare ore false.
      const finalizedWindow = this.trackSeen ? this.finalizeWindow() : undefined;
      this.preRoll = [];
      this.resetCapture();
      this.lastSampleMs = tsMs;
      this.pushPreRoll(sample);
      return { ...this.snapshot(), finalizedWindow };
    }
    this.lastSampleMs = tsMs;

    const matched = this.matchCircuit(sample.lat, sample.lon);
    this.pushPreRoll(sample);

    if (!this.active.length) {
      if (matched && speedKph >= this.activitySpeedKph) {
        this.activeCircuitId = matched.id;
        this.active = this.preRoll.filter((s) => s.tsMs > this.lastWindowEndMs);
        this.trackSeen = speedKph >= this.trackEntrySpeedKph;
        this.lowSpeedSince = null;
        this.outsideSince = null;
      }
      return this.snapshot(matched);
    }

    const previous = this.active[this.active.length - 1];
    if (!previous || previous.tsMs !== sample.tsMs) this.active.push(sample);

    const sameCircuit = Boolean(matched && matched.id === this.activeCircuitId);
    if (sameCircuit && speedKph >= this.trackEntrySpeedKph) this.trackSeen = true;

    if (this.trackSeen) {
      if (sameCircuit) this.outsideSince = null;
      else if (this.outsideSince == null) this.outsideSince = tsMs;

      if (speedKph <= this.activitySpeedKph) {
        if (this.lowSpeedSince == null) this.lowSpeedSince = tsMs;
      } else {
        this.lowSpeedSince = null;
      }

      const outsideLongEnough = this.outsideSince != null && tsMs - this.outsideSince >= this.outsideHoldSeconds * 1000;
      const stoppedLongEnough = this.lowSpeedSince != null && tsMs - this.lowSpeedSince >= this.localStopHoldSeconds * 1000;
      if (outsideLongEnough || stoppedLongEnough) {
        const finalizedWindow = this.finalizeWindow();
        this.preRoll = this.preRoll.filter((s) => s.tsMs > this.lastWindowEndMs);
        return { ...this.snapshot(matched), finalizedWindow };
      }
    } else {
      const captureDuration = this.active.length ? tsMs - this.active[0].tsMs : 0;
      if (captureDuration > 5 * 60 * 1000) {
        // Movimento nel paddock senza ingresso pista: non trasformarlo in ore lavoro.
        this.resetCapture();
      }
    }

    // Browser GPS ~1 Hz: 1950 campioni coprono più di 30 minuti. Se si raggiunge il limite
    // non spezzare il giro in silenzio; conserviamo gli estremi e alleggeriamo il buffer.
    if (this.active.length > this.maxSamples) {
      const first = this.active[0];
      const last = this.active[this.active.length - 1];
      const middle = this.active.slice(1, -1).filter((_, index) => index % 2 === 0);
      this.active = [first, ...middle, last];
    }

    return this.snapshot(matched);
  }

  private pushPreRoll(sample: NumericSample) {
    this.preRoll.push(sample);
    const cutoff = Math.max(this.lastWindowEndMs, sample.tsMs - this.preRollSeconds * 1000);
    this.preRoll = this.preRoll.filter((s) => s.tsMs > cutoff);
  }

  private matchCircuit(lat: number, lon: number) {
    let best: { id: string; name: string; distanceM: number } | null = null;
    for (const circuit of this.circuits) {
      if (circuit.latitude == null || circuit.longitude == null || circuit.detectionRadiusM == null) continue;
      const distance = distanceM(lat, lon, circuit.latitude, circuit.longitude);
      if (distance > circuit.detectionRadiusM) continue;
      if (!best || distance < best.distanceM) best = { id: circuit.id, name: circuit.name, distanceM: distance };
    }
    return best;
  }

  private finalizeWindow(): SmartphoneLoggerWindow | undefined {
    if (!this.active.length || !this.trackSeen || !this.activeCircuitId) {
      this.resetCapture();
      return undefined;
    }
    const samples = this.active.filter((s) => s.tsMs > this.lastWindowEndMs);
    if (samples.length < 2) {
      this.resetCapture();
      return undefined;
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    this.sequence += 1;
    this.lastWindowEndMs = last.tsMs;
    const window: SmartphoneLoggerWindow = {
      external_window_id: `mobile:${this.armId}:${this.sequence}`.slice(0, 200),
      circuitId: this.activeCircuitId,
      samplesCount: samples.length,
      startedAt: first.ts,
      endedAt: last.ts,
      payload: {
        max_gap_seconds: this.maxGapSeconds,
        track_entry_speed_kph: this.trackEntrySpeedKph,
        track_exit_speed_kph: this.trackExitSpeedKph,
        track_exit_hold_seconds: this.trackExitHoldSeconds,
        samples: samples.map(publicSample),
      },
    };
    this.resetCapture();
    return window;
  }

  private resetCapture() {
    this.active = [];
    this.activeCircuitId = null;
    this.trackSeen = false;
    this.lowSpeedSince = null;
    this.outsideSince = null;
  }

  private snapshot(matched?: { id: string; name: string } | null): SmartphoneLoggerSnapshot {
    return {
      state: !this.armed ? "idle" : this.active.length ? "capturing" : "armed",
      matchedCircuitId: matched?.id ?? this.activeCircuitId,
      matchedCircuitName: matched?.name ?? this.circuits.find((c) => c.id === this.activeCircuitId)?.name ?? null,
      samplesBuffered: this.active.length,
      trackSeen: this.trackSeen,
    };
  }
}
