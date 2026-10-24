// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { TRACKS } from './trackdata';

/**
 * Track recognition. GT7 does not send which track you are on, so it is worked
 * out from where the car drives: once the last few hundred metres lie on a known
 * track, that track's map is shown at once – before you have driven a lap.
 *
 * Known tracks are the 84 built-in GT7 layouts (trackdata.ts) plus any track the
 * app has drawn itself (saved on the phone, e.g. tracks added in later GT7 updates).
 */

export type Pt = [number, number];

export interface KnownTrack {
  id: string;
  /** null for tracks the app drew itself */
  name: string | null;
  points: Pt[];
  /** bounding box [minX, minZ, maxX, maxZ] */
  box: [number, number, number, number];
  length: number;
}

export interface SavedTrack extends KnownTrack {
  savedAt: number;
}

export interface TrackMatch {
  track: KnownTrack;
  score: number;
  /** driven the opposite way of the stored line (a "Reverse" layout) */
  reverse: boolean;
}

export const MAX_TRACKS = 60;
const ON_LINE = 22; // metres from the stored racing line that still count as "on the track"
const MIN_MATCH_DISTANCE = 400; // metres of driving before we guess

export function pathLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

/** Keeps a point every `step` metres (enough for a map, small to store). */
export function simplify(pts: Pt[], step = 6): Pt[] {
  if (pts.length < 3) return pts.slice();
  const out: Pt[] = [pts[0]];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= step) out.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
  }
  return out;
}

function boxOf(pts: Pt[]): [number, number, number, number] {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [x0, z0, x1, z1];
}

/** The built-in GT7 tracks, unpacked once. */
export const BUILT_IN: KnownTrack[] = TRACKS.map((t, i) => {
  const points: Pt[] = [];
  for (let k = 0; k + 1 < t.p.length; k += 2) points.push([t.p[k], t.p[k + 1]]);
  return { id: `gt7-${i}`, name: t.name, points, box: boxOf(points), length: t.length };
});

export function makeTrack(outline: Pt[], now = Date.now()): SavedTrack {
  const points = simplify(outline);
  return { id: `t${now.toString(36)}`, name: null, points, box: boxOf(points), length: pathLength(points), savedAt: now };
}

/** Distance from p to the nearest segment of the closed polyline, and that segment's index. */
export function nearest(p: Pt, line: Pt[]): { d: number; i: number } {
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < line.length; i++) {
    const a = line[i];
    const b = line[(i + 1) % line.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    const k = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0;
    const d = Math.hypot(p[0] - (a[0] + k * dx), p[1] - (a[1] + k * dz));
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return { d: best, i: bi };
}

export const distanceToLine = (p: Pt, line: Pt[]) => nearest(p, line).d;

/** Share of the points that lie on the line. */
function coverage(pts: Pt[], line: Pt[], tolerance = ON_LINE): number {
  let on = 0;
  for (const p of pts) if (nearest(p, line).d <= tolerance) on++;
  return pts.length ? on / pts.length : 0;
}

/** Which way round the stored line the points were driven. */
function isReverse(pts: Pt[], line: Pt[]): boolean {
  const n = line.length;
  let forward = 0;
  let back = 0;
  let prev = nearest(pts[0], line).i;
  for (let k = 1; k < pts.length; k++) {
    const i = nearest(pts[k], line).i;
    const step = (i - prev + n) % n;
    if (step !== 0) {
      if (step < n / 2) forward++;
      else back++;
    }
    prev = i;
  }
  return back > forward;
}

/**
 * All known tracks the recent driving fits, best first. Needs ~400 m of driving.
 * Several layouts can share the same corners (Nürburgring GP / 24h, Lago Maggiore …);
 * then more than one is returned until the driving tells them apart.
 */
export function matchTracks(recent: Pt[], library: KnownTrack[]): TrackMatch[] {
  if (recent.length < 20 || pathLength(recent) < MIN_MATCH_DISTANCE) return [];
  const sample = recent.filter((_, i) => i % 3 === 0);
  const out: TrackMatch[] = [];
  for (const t of library) {
    const [x0, z0, x1, z1] = t.box;
    let inside = 0;
    for (const [x, z] of sample) if (x >= x0 - 40 && x <= x1 + 40 && z >= z0 - 40 && z <= z1 + 40) inside++;
    if (inside / sample.length < 0.95) continue;
    const score = coverage(sample, t.points);
    if (score >= 0.92) out.push({ track: t, score, reverse: false });
  }
  out.sort((a, b) => b.score - a.score);
  for (const m of out.slice(0, 3)) m.reverse = isReverse(sample.slice(-40), m.track.points);
  return out;
}

/** Best single guess (or null). */
export function findTrack(recent: Pt[], library: KnownTrack[]): KnownTrack | null {
  return matchTracks(recent, library)[0]?.track ?? null;
}

/** Display name: "Suzuka Circuit", "Deep Forest Raceway Reverse". */
export function trackTitle(m: TrackMatch): string | null {
  if (!m.track.name) return null;
  return m.reverse ? `${m.track.name} Reverse` : m.track.name;
}

/** True when the drawn outline is a track we already know (built-in or saved). */
export function isKnown(outline: Pt[], library: KnownTrack[]): KnownTrack | null {
  const pts = simplify(outline, 20);
  const len = pathLength(pts);
  for (const t of library) {
    if (Math.abs(t.length - len) > t.length * 0.25) continue;
    if (coverage(pts, t.points) >= 0.9 && coverage(t.points.filter((_, i) => i % 3 === 0), pts) >= 0.9) return t;
  }
  return null;
}

/** Adds a newly drawn track (newest first, oldest dropped) unless it is already known. */
export function addTrack(saved: SavedTrack[], outline: Pt[], now = Date.now(), builtIn: KnownTrack[] = BUILT_IN): SavedTrack[] {
  if (isKnown(outline, [...builtIn, ...saved])) return saved;
  return [makeTrack(outline, now), ...saved].slice(0, MAX_TRACKS);
}

export function isSavedTrack(v: unknown): v is SavedTrack {
  if (!v || typeof v !== 'object') return false;
  const t = v as SavedTrack;
  return typeof t.id === 'string' && t.id.length > 0 && t.id.length < 100
    && (t.name === null || typeof t.name === 'string')
    && Number.isFinite(t.length) && t.length > 0 && Number.isFinite(t.savedAt)
    && Array.isArray(t.points) && t.points.length > 10 && t.points.length <= 8000
    && t.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
    && Array.isArray(t.box) && t.box.length === 4 && t.box.every(Number.isFinite)
    && t.box[0] <= t.box[2] && t.box[1] <= t.box[3]
    && t.points.every(([x, z]) => x >= t.box[0] && x <= t.box[2] && z >= t.box[1] && z <= t.box[3]);
}

/**
 * Follows the driving and keeps score of how often each known track is missed.
 * Layouts that share corners are told apart as soon as the car drives where only
 * one of them goes. The pit lane counts against all tracks alike, so it doesn't
 * rule anything out.
 */
export class TrackFinder {
  private recent: Pt[] = [];
  private distance = 0;
  private misses = new Map<string, number>();
  private seen = 0;

  reset() {
    this.recent = [];
    this.distance = 0;
    this.misses.clear();
    this.seen = 0;
  }

  /** Adds a driven point (call every few metres). */
  add(p: Pt, library: KnownTrack[]) {
    const last = this.recent[this.recent.length - 1];
    if (last) this.distance += Math.hypot(p[0] - last[0], p[1] - last[1]);
    this.recent.push(p);
    if (this.recent.length > 500) this.recent.shift(); // ~2 km
    this.seen++;
    if (this.seen % 2) return; // every other point is plenty
    for (const t of library) {
      const [x0, z0, x1, z1] = t.box;
      const inBox = p[0] >= x0 - 40 && p[0] <= x1 + 40 && p[1] >= z0 - 40 && p[1] <= z1 + 40;
      if (!inBox || nearest(p, t.points).d > ON_LINE) this.misses.set(t.id, (this.misses.get(t.id) ?? 0) + 1);
    }
  }

  /** Points driven so far (since the last reset). */
  get points() {
    return this.recent.length;
  }

  /** The tracks that still fit, best first. `unique` when only one is left. */
  guess(library: KnownTrack[]): { match: TrackMatch; unique: boolean } | null {
    if (this.distance < MIN_MATCH_DISTANCE) return null;
    let least = Infinity;
    for (const t of library) least = Math.min(least, this.misses.get(t.id) ?? 0);
    // ~25 missed checks = the car has driven 200 m where this layout doesn't go
    const still = library.filter((t) => (this.misses.get(t.id) ?? 0) <= least + 25);
    const fits = matchTracks(this.recent, still);
    if (!fits.length) return null;
    fits.sort((a, b) => (this.misses.get(a.track.id) ?? 0) - (this.misses.get(b.track.id) ?? 0) || b.score - a.score);
    return { match: fits[0], unique: fits.length === 1 };
  }
}
