// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

/** Danish number formatting without relying on Intl (works on every JS engine). */
export function decimal(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits).replace('.', ',').replace('-', '−');
}

export function integer(v: number): string {
  const n = Math.round(v);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + s;
}

export function lap(seconds: number | null | undefined): string {
  if (seconds == null || !(seconds > 0)) return '—';
  const ms = Math.round(seconds * 1000);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

export function clock(seconds: number | null | undefined): string {
  const t = Math.floor(seconds ?? 0);
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const t = Math.floor(seconds);
  return t >= 3600 ? clock(t) : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function delta(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  return (seconds >= 0 ? '+' : '−') + Math.abs(seconds).toFixed(3);
}
