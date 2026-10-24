// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { BUILT_IN, Pt, SavedTrack, TrackFinder, trackTitle } from './tracks';
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
  /** fuel figures are an estimate from the distance driven (no whole lap measured yet) */
  fuelEstimated: boolean;
  /** no measurable fuel drop yet; this does not prove consumption is disabled */
  fuelUnchanged: boolean;
  /** lap length in metres (known track, or the last whole lap) */
  trackLength: number | null;
  /** driven line [x, z] in metres; once a full lap is driven, that lap */
  outline: [number, number][];
  outlineComplete: boolean;
  /** the map came from a known track (recognised), not drawn this session */
  trackKnown: boolean;
  /** e.g. "Suzuka Circuit" when recognised */
  trackName: string | null;
  car: [number, number] | null;
}

export const emptyStats = (): Stats => ({
  currentLap: null, lapTimes: [], lastLap: null, bestLap: null, averageLap: null, delta: null,
  topSpeedKmh: 0, distanceKm: 0, sessionTime: 0, fuelPerLap: null, fuelLapsLeft: null, fuelTimeLeft: null, fuelEstimated: false, fuelUnchanged: false, trackLength: null,
  outline: [], outlineComplete: false, trackKnown: false, trackName: null, car: null,
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
  /** fuel and distance since we started watching (or the last refuel), for an early estimate */
  private fuelRefStart: number | null = null;
  private fuelRefDistance = 0;
  private lastLapDistance: number | null = null;
  /** packets in a row with a lower lap number (a new race, not a stray packet) */
  private lapDropCount = 0;
  private trace: [number, number][] = [];
  private traceLength = 0;
  /** recognises the track from the driving */
  private finder = new TrackFinder();
  private matchCountdown = 0;
  /** recognised for sure (only one track fits) – stop looking */
  private trackLocked = false;
  /** Tracks the app drew itself (kept across resets). Built-in GT7 tracks are always known. */
  library: SavedTrack[] = [];
  /** Synthetic demo coordinates must not be matched against real circuits. */
  recognizeTracks = true;
  /** Called when a new track outline has been drawn, so it can be saved. */
  onTrackDrawn: ((outline: Pt[]) => void) | null = null;
  private watchedFromStart = false;
  private lapDistance = 0;
  private samples: Sample[] = [];
  private finishedSamples: Sample[] | null = null;
  private reference: Sample[] = [];
  private referenceTime: number | null = null;

  reset() {
    const { library, onTrackDrawn, recognizeTracks } = this;
    Object.assign(this, new RaceTracker(), { library, onTrackDrawn, recognizeTracks });
  }

  private known() {
    if (!this.recognizeTracks) return [];
    return this.library.length ? [...BUILT_IN, ...this.library] : BUILT_IN;
  }

  private completeOutline(outline: Pt[]) {
    const s = this.stats;
    s.outline = outline;
    s.outlineComplete = true;
    s.trackKnown = false;
    s.trackName = null;
    this.trackLocked = true;
    this.onTrackDrawn?.(outline);
  }

  ingest(f: Frame) {
    // New race (lap counter went down) or a different car: start over.
    this.lapDropCount = this.lastLap !== null && f.lap < this.lastLap ? this.lapDropCount + 1 : 0;
    if (this.lapDropCount >= 3 || (this.lastCar !== null && f.carCode !== 0 && f.carCode !== this.lastCar)) {
      this.reset();
    } else if (this.lapDropCount > 0) {
      return; // ignore a stray (out of order) packet
    }
    this.lastCar = f.carCode;
    const s = this.stats;

    const delta = this.lastTick === null ? 0 : f.tick - this.lastTick;
    const dt = delta > 0 && delta < 120 ? delta / 60 : 0;
    this.lastTick = f.tick;

    const driving = has(f, Flag.onTrack) && !has(f, Flag.paused) && !has(f, Flag.loading);
    if (driving) {
      this.lapDistance += f.speedMS * dt;
      this.fuelRefDistance += f.speedMS * dt;
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
      if (completed && this.watchedFromStart && this.lapDistance > 300) this.lastLapDistance = this.lapDistance;
      this.samples = [];
      this.lapDistance = 0;
      this.lapStartTick = f.tick;
      this.ticksSinceLapChange = 0;
      if (completed) {
        this.pendingLap = true;
        if (this.watchedFromStart && !s.outlineComplete && !this.trackLocked && this.trace.length > 50) this.completeOutline(this.trace);
      }
      this.trace = [];
      this.traceLength = 0;
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
    if (this.lastFuel !== null && fuel > this.lastFuel + 0.5) {
      this.refuelled = true;
      this.fuelRefStart = fuel; // start the early estimate again after a pit stop
      this.fuelRefDistance = 0;
    }
    this.lastFuel = fuel;
    if (driving && this.fuelRefStart === null) {
      this.fuelRefStart = fuel;
      this.fuelRefDistance = 0;
    }
    if (changed) {
      if (completed && this.fuelAtLapStart !== null && !this.refuelled) {
        const used = this.fuelAtLapStart - fuel;
        if (used > 0.01) this.fuelUsage = [...this.fuelUsage, used].slice(-3);
      }
      this.fuelAtLapStart = fuel;
      this.refuelled = false;
    }
    if (!s.trackKnown && this.lastLapDistance !== null) s.trackLength = this.lastLapDistance;
    const usedSinceRef = this.fuelRefStart !== null ? this.fuelRefStart - fuel : 0;
    let perLap: number | null = null;
    s.fuelEstimated = false;
    if (this.fuelUsage.length) {
      perLap = this.fuelUsage.reduce((a, b) => a + b, 0) / this.fuelUsage.length;
    } else if (s.trackLength && this.fuelRefDistance >= 800 && usedSinceRef > 0.02) {
      // No whole lap measured yet: estimate from the distance driven so far.
      perLap = (usedSinceRef / this.fuelRefDistance) * s.trackLength;
      s.fuelEstimated = true;
    }
    s.fuelUnchanged = !this.fuelUsage.length && this.fuelRefDistance >= 1500 && usedSinceRef <= 0.02;
    if (perLap !== null && perLap > 0) {
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
    if (driving && !this.trackLocked) {
      const last = this.trace[this.trace.length - 1];
      let add = true;
      if (last) {
        const d = Math.hypot(f.x - last[0], f.z - last[1]);
        if (d > 300) {
          // teleported (restart, rewind): start the drawing again
          this.trace = [];
          this.traceLength = 0;
          this.finder.reset();
        } else if (d < 4) add = false;
        else this.traceLength += d;
      }
      if (add) {
        const p: Pt = [f.x, f.z];
        this.trace.push(p);
        if (this.trace.length > 8000) this.trace.splice(0, this.trace.length - 8000);
        this.finder.add(p, this.known());
      }
      if (!s.trackKnown) s.outline = this.trace;
      // Back where the drawing started after a whole lap: the track is drawn,
      // even if we joined in the middle of a lap.
      const first = this.trace[0];
      if (!s.trackKnown && first && this.traceLength > 1000 && Math.hypot(f.x - first[0], f.z - first[1]) < 20) {
        this.completeOutline(this.trace.slice());
      } else if (--this.matchCountdown <= 0) {
        // A known GT7 track (or one we drew before)? Then show its map at once.
        this.matchCountdown = 30; // twice a second
        const g = this.finder.guess(this.known());
        if (g) {
          // Layouts sharing corners: show the best guess, and settle once only one is left.
          s.outline = g.match.track.points;
          s.outlineComplete = true;
          s.trackKnown = true;
          const title = trackTitle(g.match);
          s.trackName = title && !g.unique ? `Mulig bane: ${title}` : title;
          // Shared corners do not identify which layout (and lap length) is in use.
          s.trackLength = g.unique ? g.match.track.length : this.lastLapDistance;
          if (g.unique && this.finder.points >= 150) this.trackLocked = true;
        } else if (s.trackKnown && this.finder.points >= 100) {
          // The guess no longer fits: go back to drawing the track ourselves.
          s.trackKnown = false;
          s.trackName = null;
          s.trackLength = this.lastLapDistance;
          s.outlineComplete = false;
          s.outline = this.trace;
        }
      }
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
