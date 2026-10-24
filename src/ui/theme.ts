// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import type { Settings } from '../model/store';
import type { WidgetKind } from '../model/layouts';

export const C = {
  bg: '#101513',
  panel: '#181e1b',
  panelHigh: '#1e2622',
  border: '#2a332d',
  text: '#f0f3ec',
  muted: '#87938b',
  faint: '#49584c',
  onAccent: '#14200b',
  cold: '#79caff',
  good: '#7ee07a',
  warm: '#f5d76b',
  hot: '#f27a6b',
  lastLap: '#f5d76b',
  bestLap: '#e46cf0',
  avgLap: '#6be08a',
  // Racerdisplay style
  black: '#000000',
  racingFrame: '#e8ecef',
  racingCyan: '#3fd8f2',
  racingGear: '#2b3138',
  ledOff: '#1a1f24',
  ledGreen: '#39f25a',
  ledYellow: '#ffe14d',
  ledRed: '#ff3b30',
  ledBlue: '#3d6bff',
};

export const ACCENTS = ['#c7f568', '#79caff', '#f5b96b', '#e9a4da', '#ffd23f'];
export const ACCENT_NAMES = ['Lime', 'Blå', 'Orange', 'Rosa', 'Gul'];
export const accentColor = (i: number) => ACCENTS[((i % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];

/** Set by App once the condensed font has loaded; falls back to the system font. */
export const fontState = { loaded: false };
export const numFont = (weight: 600 | 700 | 800 = 700) =>
  fontState.loaded
    ? { fontFamily: weight === 800 ? 'BarlowCondensed_800ExtraBold' : weight === 600 ? 'BarlowCondensed_600SemiBold' : 'BarlowCondensed_700Bold' }
    : { fontWeight: (weight === 800 ? '800' : weight === 600 ? '600' : '700') as '600' | '700' | '800' };

export function racingFrameColor(kind: WidgetKind, accent: string): string {
  if (kind === 'assists') return C.racingCyan;
  if (kind === 'temps') return '#f5b96b';
  if (kind === 'delta' || kind === 'cockpit' || kind === 'gear' || kind === 'rpm') return accent;
  return C.racingFrame;
}

// ---- Tyres: smooth fade blue → green → yellow → red ----
type RGB = [number, number, number];
const hexRgb = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

export function tyreColor(t: number, s: Pick<Settings, 'tyreCold' | 'tyreWarm' | 'tyreHot'>): string {
  if (!(t > 1)) return C.faint;
  const optimal = Math.min(s.tyreCold + 10, s.tyreWarm);
  const yellowAt = (s.tyreWarm + s.tyreHot) / 2;
  const stops: [number, RGB][] = [
    [s.tyreCold, hexRgb(0x4fa8ff)], [optimal, hexRgb(0x6be07a)], [s.tyreWarm, hexRgb(0x6be07a)],
    [yellowAt, hexRgb(0xf5d76b)], [s.tyreHot, hexRgb(0xf2564b)],
  ];
  let c = stops[stops.length - 1][1];
  if (t <= stops[0][0]) c = stops[0][1];
  else {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [a, ca] = stops[i - 1];
        const [b, cb] = stops[i];
        const f = b > a ? (t - a) / (b - a) : 1;
        c = [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * f)) as RGB;
        break;
      }
    }
  }
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function tyreLabel(t: number, s: Pick<Settings, 'tyreCold' | 'tyreWarm' | 'tyreHot'>): string {
  if (!(t > 1)) return '';
  if (t < s.tyreCold + 5) return 'Kold';
  if (t <= s.tyreWarm) return 'Optimal';
  if (t < s.tyreHot) return 'Varm';
  return 'For varm';
}

/** Adds alpha to a hex or rgb() colour. */
export function alpha(color: string, a: number): string {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = color.match(/\d+/g);
  return m ? `rgba(${m[0]},${m[1]},${m[2]},${a})` : color;
}
