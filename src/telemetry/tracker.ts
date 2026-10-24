// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { Flag, Frame, fuelPercent, has, speedKmh } from './frame';

/** Values GT7 doesn't send directly, worked out from the packet stream. */
export interface Stats {
  currentLap: number | null; // seconds
  lapTimes: number[];
  lastLap: number | null;
  bestLap: number | null;
  averageLap: number | null;
  /** current lap minus best lap at the same distance (negative = faster) */
  delta: number | null;
  topSpeedKmh: number;
  distanceKm: number;
  sessionTime: number;
  fuelPerLap: number | null; // percent per lap
  fuelLapsLeft: number | null;
  fuelTimeLeft: number | null; // seconds
  /** driven line [x, z] in metres; once a full lap is driven, that lap */
  outline: [number, number][];
  outlineComplete: boolean;
  car: [number, number] | null;
}

export const emptyStats = (): Stats => ({
  currentLap: null, lapTimes: [], lastLap: null, bestLap: null, averageLap: null, delta: null,
  topSpeedKmh: 0, distanceKm: 0, sessionTime: 0, fuelPerLap: null, fuelLapsLeft: null, fuelTimeLeft: null,
  outline: [], outlineComplete: false, car: null,
});

type Sample = [distance: number, time: number];

export class RaceTracker {
  stats: Stats = emptyStats();
  private lastTick: number | null = null;
  private lastLap: number | null = null;
  private lastCar: number | null = null;
  private lapStartTick: number | null = null;
  private pendingLap = false;
  private ticksSinceLapChange = 0;
  private lastRecordedMs = -1;
  private fuelAtLapStart: number | null = null;
  private refuelled = false;
  private lastFuel: number | null = null;
  private fuelUsage: number[] = [];
  private trace: [number, number][] = [];
  private watchedFromStart = false;
  private lapDistance = 0;
  private samples: Sample[] = [];
  private finishedSamples: Sample[] | null = null;
  private reference: Sample[] = [];
  private referenceTime: number | null = null;

  reset() {
    Object.assign(this, new RaceTracker());
  }

  ingest(f: Frame) {
    // New race (lap counter went down) or a different car: start over.
    if ((this.lastLap !== null && f.lap < this.lastLap) || (this.lastCar !== null && f.carCode !== 0 && f.carCode !== this.lastCar)) {
      this.reset();
    }
    this.lastCar = f.carCode;
    const s = this.stats;

    const delta = this.lastTick === null ? 0 : f.tick - this.lastTick;
    const dt = delta > 0 && delta < 120 ? delta / 60 : 0;
    this.lastTick = f.tick;

    const driving = has(f, Flag.onTrack) && !has(f, Flag.paused) && !has(f, Flag.loading);
    if (driving) {
      this.lapDistance += f.speedMS * dt;
      s.sessionTime += dt;
      s.distanceKm += (f.speedMS * dt) / 1000;
      s.topSpeedKmh = Math.max(s.topSpeedKmh, speedKmh(f));
    }

    const changed = this.lastLap !== null && f.lap !== this.lastLap;
    const completed = changed && f.lap > (this.lastLap as number) && (this.lastLap as number) >= 1;
    const fuel = fuelPercent(f);

    // Laps
    if (changed) {
      this.finishedSamples = completed && this.watchedFromStart ? this.samples : null;
      this.samples = [];
      this.lapDistance = 0;
      this.lapStartTick = f.tick;
      this.ticksSinceLapChange = 0;
      if (completed) {
        this.pendingLap = true;
        if (this.watchedFromStart && !s.outlineComplete && this.trace.length > 50) {
          s.outline = this.trace;
          s.outlineComplete = true;
        }
      }
      this.trace = [];
      this.watchedFromStart = true;
    } else {
      this.ticksSinceLapChange++;
    }
    // GT7 may update "last lap" a few packets after the lap counter changes.
    if (this.pendingLap && f.lastLapMs > 0 && (f.lastLapMs !== this.lastRecordedMs || this.ticksSinceLapChange > 90)) {
      this.pendingLap = false;
      this.lastRecordedMs = f.lastLapMs;
      const t = f.lastLapMs / 1000;
      s.lapTimes = [...s.lapTimes, t];
      if (this.finishedSamples && (this.referenceTime === null || t < this.referenceTime)) {
        this.reference = this.finishedSamples;
        this.referenceTime = t;
      }
      this.finishedSamples = null;
    }
    s.lastLap = f.lastLapMs > 0 ? f.lastLapMs / 1000 : s.lapTimes[s.lapTimes.length - 1] ?? null;
    s.bestLap = f.bestLapMs > 0 ? f.bestLapMs / 1000 : s.lapTimes.length ? Math.min(...s.lapTimes) : null;
    s.averageLap = s.lapTimes.length ? s.lapTimes.reduce((a, b) => a + b, 0) / s.lapTimes.length : null;

    // Fuel: average of the last three whole laps without refuelling.
    if (this.lastFuel !== null && fuel > this.lastFuel + 0.5) this.refuelled = true;
    this.lastFuel = fuel;
    if (changed) {
      if (completed && this.fuelAtLapStart !== null && !this.refuelled) {
        const used = this.fuelAtLapStart - fuel;
        if (used > 0.01) this.fuelUsage = [...this.fuelUsage, used].slice(-3);
      }
      this.fuelAtLapStart = fuel;
      this.refuelled = false;
    }
    if (this.fuelUsage.length) {
      const perLap = this.fuelUsage.reduce((a, b) => a + b, 0) / this.fuelUsage.length;
      const laps = fuel / perLap;
      const recent = s.lapTimes.slice(-3);
      s.fuelPerLap = perLap;
      s.fuelLapsLeft = laps;
      s.fuelTimeLeft = recent.length ? (laps * recent.reduce((a, b) => a + b, 0)) / recent.length : null;
    } else {
      s.fuelPerLap = s.fuelLapsLeft = s.fuelTimeLeft = null;
    }

    // Track map
    s.car = f.x === 0 && f.z === 0 ? null : [f.x, f.z];
    if (driving && !s.outlineComplete) {
      const last = this.trace[this.trace.length - 1];
      let add = true;
      if (last) {
        const d = Math.hypot(f.x - last[0], f.z - last[1]);
        if (d > 300) this.trace = [];
        else if (d < 4) add = false;
      }
      if (add) {
        this.trace.push([f.x, f.z]);
        if (this.trace.length > 8000) this.trace.splice(0, this.trace.length - 8000);
      }
      s.outline = this.trace;
    }

    // Current lap time and delta
    s.currentLap = this.lapStartTick !== null && f.lap > 0 ? Math.max(0, (f.tick - this.lapStartTick) / 60) : null;
    s.delta = null;
    if (s.currentLap !== null) {
      const lastSample = this.samples[this.samples.length - 1];
      if (!lastSample || this.lapDistance - lastSample[0] >= 10) this.samples.push([this.lapDistance, s.currentLap]);
      const ref = this.referenceAt(this.lapDistance);
      if (ref !== null) s.delta = s.currentLap - ref;
    }

    this.lastLap = f.lap;
  }

  private referenceAt(distance: number): number | null {
    const r = this.reference;
    if (r.length <= 10 || distance > r[r.length - 1][0]) return null;
    let lo = 0;
    let hi = r.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (r[mid][0] <= distance) lo = mid;
      else hi = mid;
    }
    const span = r[hi][0] - r[lo][0];
    const k = span > 0 ? Math.max(0, Math.min(1, (distance - r[lo][0]) / span)) : 0;
    return r[lo][1] + (r[hi][1] - r[lo][1]) * k;
  }
}
