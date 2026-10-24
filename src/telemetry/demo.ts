// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { Flag, Frame, emptyFrame } from './frame';

/**
 * Fake telemetry so the app can be tried without a PS5: a car laps a closed
 * circuit (~80 s) with braking zones, gear changes, fuel use and tyre heat.
 */
const CORNERS: [at: number, speed: number, width: number][] = [
  [0.12, 95, 0.035], [0.27, 140, 0.03], [0.41, 70, 0.03], [0.55, 165, 0.025],
  [0.68, 110, 0.035], [0.83, 85, 0.03], [0.95, 150, 0.02],
];

function targetSpeed(p: number): number {
  let v = 262;
  for (const [at, speed, width] of CORNERS) {
    let d = Math.abs(p - at);
    d = Math.min(d, 1 - d);
    const influence = Math.max(0, 1 - d / (width * 3.2));
    v = Math.min(v, speed + (262 - speed) * (1 - influence * influence));
  }
  return v;
}

function trackPoint(p: number): [number, number] {
  const a = p * 2 * Math.PI;
  const r = 520 + 140 * Math.sin(a * 3) + 60 * Math.cos(a * 5);
  return [r * Math.cos(a) * 1.25, r * Math.sin(a) * 0.8];
}

const GEAR_TOP = [0, 70, 108, 145, 182, 220, 400];

export class DemoDriver {
  private tick = 0;
  private lap = 0; // 0 = on the grid, so lap 1 is timed from the start
  private lapStart = 0;
  private best = -1;
  private last = -1;
  private fuel = 100;
  private progress = 0;
  private pace = 1;

  next(): Frame {
    this.tick++;
    const dt = 1 / 60;
    if (this.lap === 0 && this.tick % 60 === 0) {
      this.lap = 1;
      this.lapStart = this.tick;
    }
    const target = targetSpeed(this.progress);
    const look = targetSpeed((this.progress + 0.018) % 1);
    const base = Math.min(target, look + 35);
    const speed = base * this.pace * (1 + 0.012 * Math.sin(this.progress * 2 * Math.PI * 5));
    const braking = look < base - 25;
    this.progress += (speed / 3.6) * dt / 4100;

    if (this.progress >= 1) {
      this.progress -= 1;
      const ms = Math.round(((this.tick - this.lapStart) / 60) * 1000);
      this.last = ms;
      this.best = this.best < 0 ? ms : Math.min(this.best, ms);
      this.lap++;
      this.lapStart = this.tick;
      this.pace = 0.985 + Math.random() * 0.03;
      if (this.lap > 10) {
        this.lap = 0;
        this.fuel = 100;
        this.best = -1;
        this.last = -1;
      }
    }
    this.fuel = Math.max(0, this.fuel - (braking ? 0.0004 : 0.0024) * (speed / 200));

    let gear = 6;
    for (let g = 1; g <= 6; g++) {
      if (speed < GEAR_TOP[g]) {
        gear = g;
        break;
      }
    }
    const low = GEAR_TOP[gear - 1];
    const high = Math.min(GEAR_TOP[gear], 262);
    const ratio = Math.max(0, Math.min(1, (speed - low * 0.75) / Math.max(1, high - low * 0.75)));
    const rpm = 3800 + ratio * 4400;
    const throttle = braking ? 0 : speed >= target - 1 ? 0.55 + 0.45 * ratio : 1;
    const [x, z] = trackPoint(this.progress);
    const t = this.tick / 60;

    let flags = Flag.onTrack | Flag.inGear | Flag.hasTurbo;
    if (throttle > 0.95 && gear <= 2) flags |= Flag.tcs;
    if (rpm > 8050) flags |= Flag.revLimiter;

    return {
      ...emptyFrame(),
      x, z, rpm,
      fuelLevel: this.fuel * 0.65,
      fuelCapacity: 65,
      speedMS: speed / 3.6,
      boost: braking ? -0.6 : 0.9 * ratio,
      waterTemp: 86 + 4 * Math.sin(this.tick / 900),
      oilTemp: 98 + 6 * Math.sin(this.tick / 1300),
      tyres: [0, 1, 2, 3].map((i) => (i < 2 ? 84 : 78) + 16 * Math.sin(t * 0.11 + i * 1.3) + (braking && i < 2 ? 6 : 0)) as Frame['tyres'],
      tick: this.tick,
      lap: this.lap,
      totalLaps: 10,
      bestLapMs: this.best,
      lastLapMs: this.last,
      position: Math.max(1, 6 - Math.floor(this.lap / 2)),
      totalPositions: 16,
      rpmAlertMin: 7200,
      rpmAlertMax: 8100,
      flags,
      gear,
      suggestedGear: rpm > 7900 && gear < 6 ? gear + 1 : 15,
      throttle,
      brake: braking ? Math.min(1, (base - look) / 45) : 0,
      carCode: 3337,
    };
  }
}
