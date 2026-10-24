// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

/** One decoded GT7 telemetry packet (60 per second while driving). */
export interface Frame {
  x: number;
  y: number;
  z: number;
  rpm: number;
  fuelLevel: number;
  fuelCapacity: number;
  speedMS: number;
  boost: number; // bar, relative
  oilPressure: number;
  waterTemp: number;
  oilTemp: number;
  /** front left, front right, rear left, rear right (°C) */
  tyres: [number, number, number, number];
  tick: number;
  lap: number;
  totalLaps: number;
  bestLapMs: number;
  lastLapMs: number;
  position: number;
  totalPositions: number;
  rpmAlertMin: number;
  rpmAlertMax: number;
  flags: number;
  gear: number;
  suggestedGear: number;
  throttle: number; // 0..1
  brake: number; // 0..1
  carCode: number;
}

export const emptyFrame = (): Frame => ({
  x: 0, y: 0, z: 0, rpm: 0, fuelLevel: 0, fuelCapacity: 0, speedMS: 0, boost: 0, oilPressure: 0,
  waterTemp: 0, oilTemp: 0, tyres: [0, 0, 0, 0], tick: 0, lap: 0, totalLaps: 0, bestLapMs: -1, lastLapMs: -1,
  position: -1, totalPositions: -1, rpmAlertMin: 0, rpmAlertMax: 0, flags: 0, gear: 0, suggestedGear: 15,
  throttle: 0, brake: 0, carCode: 0,
});

export const Flag = {
  onTrack: 1 << 0,
  paused: 1 << 1,
  loading: 1 << 2,
  inGear: 1 << 3,
  hasTurbo: 1 << 4,
  revLimiter: 1 << 5,
  handbrake: 1 << 6,
  asm: 1 << 10,
  tcs: 1 << 11,
} as const;

export const has = (f: Frame, flag: number) => (f.flags & flag) !== 0;
export const speedKmh = (f: Frame) => f.speedMS * 3.6;
export const fuelPercent = (f: Frame) =>
  Math.max(0, Math.min(100, f.fuelCapacity > 0 ? (f.fuelLevel / f.fuelCapacity) * 100 : f.fuelLevel));
export const gearText = (g: number) => (g === 0 ? 'R' : g === 15 ? 'N' : String(g));
export const suggestedGearText = (f: Frame) =>
  f.suggestedGear === 15 || f.suggestedGear === f.gear ? null : gearText(f.suggestedGear);

/** Parses a decrypted packet. */
export function parseFrame(b: Uint8Array): Frame | null {
  if (b.length < 0x128) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const f32 = (o: number) => {
    const n = v.getFloat32(o, true);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    x: f32(0x04),
    y: f32(0x08),
    z: f32(0x0c),
    rpm: f32(0x3c),
    fuelLevel: f32(0x44),
    fuelCapacity: f32(0x48),
    speedMS: f32(0x4c),
    boost: f32(0x50) - 1,
    oilPressure: f32(0x54),
    waterTemp: f32(0x58),
    oilTemp: f32(0x5c),
    tyres: [f32(0x60), f32(0x64), f32(0x68), f32(0x6c)],
    tick: v.getInt32(0x70, true),
    lap: v.getInt16(0x74, true),
    totalLaps: v.getInt16(0x76, true),
    bestLapMs: v.getInt32(0x78, true),
    lastLapMs: v.getInt32(0x7c, true),
    position: v.getInt16(0x84, true),
    totalPositions: v.getInt16(0x86, true),
    rpmAlertMin: v.getInt16(0x88, true),
    rpmAlertMax: v.getInt16(0x8a, true),
    flags: v.getUint16(0x8e, true),
    gear: b[0x90] & 0x0f,
    suggestedGear: b[0x90] >> 4,
    throttle: b[0x91] / 255,
    brake: b[0x92] / 255,
    carCode: v.getInt32(0x124, true),
  };
}
