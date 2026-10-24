// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { WidgetKind } from '../model/layouts';
import type { Settings } from '../model/store';
import { Flag, Frame, fuelPercent, gearText, has, speedKmh, suggestedGearText } from '../telemetry/frame';
import type { Snapshot } from '../telemetry/hub';
import * as fmt from './format';
import { C, alpha, numFont, tyreColor, tyreLabel } from './theme';

export interface WidgetProps {
  t: Snapshot;
  s: Settings;
  accent: string;
  racing: boolean;
  w: number; // content width
  h: number; // content height
}

// ---------- Building blocks ----------

export function Cap({ children, color = C.muted, size = 9, style }: { children: React.ReactNode; color?: string; size?: number; style?: TextStyle }) {
  return (
    <Text numberOfLines={1} style={[{ color, fontSize: size, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

export function Num({ children, size, color = C.text, weight = 700, style }: { children: React.ReactNode; size: number; color?: string; weight?: 600 | 700 | 800; style?: TextStyle }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.35}
      style={[numFont(weight), { color, fontSize: Math.max(8, size), lineHeight: Math.max(8, size) * 1.05, fontVariant: ['tabular-nums'] }, style]}
    >
      {children}
    </Text>
  );
}

function Bar({ value, color, vertical = false, thickness = 8 }: { value: number; color: string; vertical?: boolean; thickness?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[
        { backgroundColor: alpha(C.border, 0.75), borderRadius: 5, overflow: 'hidden' },
        vertical ? { flex: 1, width: thickness, justifyContent: 'flex-end' } : { height: thickness, width: '100%' },
      ]}
    >
      <View style={[{ backgroundColor: color, borderRadius: 5 }, vertical ? { height: (`${v * 100}%` as `${number}%`), width: '100%' } : { width: (`${v * 100}%` as `${number}%`), height: '100%' }]} />
    </View>
  );
}

export function shiftFraction(f: Frame): number {
  if (f.rpmAlertMin > 0 && f.rpmAlertMax > f.rpmAlertMin) {
    const start = f.rpmAlertMin - (f.rpmAlertMax - f.rpmAlertMin) * 1.5;
    return Math.max(0, Math.min(1, (f.rpm - start) / (f.rpmAlertMax - start)));
  }
  return Math.max(0, Math.min(1, f.rpm / 9000));
}
export const atLimit = (f: Frame) => has(f, Flag.revLimiter) || (f.rpmAlertMax > 0 && f.rpm >= f.rpmAlertMax);

/** Shift lights from the car's own RPM window. Racing style = round LEDs green → yellow → red → blue. */
export function ShiftLights({ f, n, accent, racing, flash, height }: { f: Frame; n: number; accent: string; racing: boolean; flash: boolean; height: number }) {
  const blinkOn = Math.floor(Date.now() / 100) % 2 === 0;
  const lit = flash && atLimit(f) ? (blinkOn ? n : 0) : Math.round(shiftFraction(f) * n);
  return (
    <View style={{ flexDirection: 'row', height, gap: racing ? 4 : 3, alignItems: 'center', justifyContent: 'space-between' }}>
      {Array.from({ length: n }, (_, i) => {
        const p = i / n;
        const on = i < lit;
        if (racing) {
          const c = !on ? C.ledOff : p < 0.35 ? C.ledGreen : p < 0.6 ? C.ledYellow : p < 0.85 ? C.ledRed : C.ledBlue;
          return (
            <View
              key={i}
              style={{ width: height, height, borderRadius: height / 2, backgroundColor: c, shadowColor: c, shadowOpacity: on ? 0.9 : 0, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }}
            />
          );
        }
        const c = !on ? C.border : p < 0.55 ? accent : p < 0.8 ? C.warm : C.hot;
        return <View key={i} style={{ flex: 1, height: '100%', borderRadius: 2, backgroundColor: c }} />;
      })}
    </View>
  );
}

const spd = (s: Settings, kmh: number) => (s.useMPH ? kmh / 1.609344 : kmh);
const unit = (s: Settings) => (s.useMPH ? 'mph' : 'km/t');

function Big({ value, unitText, color, w, h, ratio = 0.62 }: { value: string; unitText?: string; color: string; w: number; h: number; ratio?: number }) {
  const size = Math.min(h * ratio, (w / Math.max(2, value.length)) * 1.8);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Num size={size} color={color}>{value}</Num>
      {unitText ? <Text style={{ color: C.muted, fontSize: Math.max(10, size * 0.18), fontWeight: '600', marginLeft: 4, marginBottom: size * 0.12 }}>{unitText}</Text> : null}
    </View>
  );
}

// ---------- Widgets ----------

function Speed({ t, s, accent, w, h }: WidgetProps) {
  const tall = h > 150;
  return (
    <View style={{ flex: 1 }}>
      <Big value={fmt.integer(spd(s, speedKmh(t.frame)))} unitText={unit(s)} color={accent} w={w} h={tall ? h * 0.5 : h * 0.8} />
      <View style={{ marginTop: 'auto' }}>
        {tall ? (
          <>
            <Cap>Topfart</Cap>
            <Num size={Math.min(30, w / 4)} weight={600}>{fmt.decimal(spd(s, t.stats.topSpeedKmh), 0)}</Num>
          </>
        ) : (
          <Cap>Top {fmt.decimal(spd(s, t.stats.topSpeedKmh), 0)}</Cap>
        )}
      </View>
    </View>
  );
}

function Rpm({ t, s, accent, racing, w, h }: WidgetProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <Big value={fmt.integer(t.frame.rpm)} unitText="rpm" color={accent} w={w} h={h * 0.75} />
      <ShiftLights f={t.frame} n={14} accent={accent} racing={racing} flash={s.shiftFlash} height={racing ? Math.min(14, w / 20) : 12} />
    </View>
  );
}

function Gear({ t, accent, w, h }: WidgetProps) {
  const sg = suggestedGearText(t.frame);
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Num size={h * 0.85} color={accent} weight={800}>{gearText(t.frame.gear)}</Num>
      {sg ? <Num size={Math.min(26, w / 4)} color={C.warm}>↑{sg}</Num> : null}
    </View>
  );
}

function Cockpit({ t, s, accent, racing, w, h }: WidgetProps) {
  const f = t.frame;
  const sg = suggestedGearText(f);
  const bar = Math.max(10, Math.min(22, w * 0.07));
  const lightH = racing ? Math.max(10, Math.min(18, w / 16)) : Math.max(8, Math.min(14, h * 0.06));
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <ShiftLights f={f} n={12} accent={accent} racing={racing} flash={s.shiftFlash} height={lightH} />
      <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
        <View style={{ width: bar, alignItems: 'center', gap: 4 }}>
          <Bar value={f.brake} color={C.hot} vertical thickness={bar} />
          <Cap>B</Cap>
        </View>
        <View style={[styles.center, racing && { backgroundColor: C.racingGear, borderRadius: 8 }]}>
          {sg ? <Num size={Math.max(14, h * 0.1)} color={C.warm} style={{ position: 'absolute', top: 4, right: 8 }}>↑{sg}</Num> : null}
          <Num size={Math.min(h * 0.55, w * 0.4)} weight={800} color={atLimit(f) ? C.hot : C.text}>{gearText(f.gear)}</Num>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Num size={Math.max(16, Math.min(h * 0.11, w * 0.09))} color={accent}>{fmt.integer(spd(s, speedKmh(f)))}</Num>
              <Cap size={8}>{unit(s)}</Cap>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Num size={Math.max(16, Math.min(h * 0.11, w * 0.09))}>{fmt.integer(f.rpm)}</Num>
              <Cap size={8}>rpm</Cap>
            </View>
          </View>
        </View>
        <View style={{ width: bar, alignItems: 'center', gap: 4 }}>
          <Bar value={f.throttle} color={accent} vertical thickness={bar} />
          <Cap>G</Cap>
        </View>
      </View>
    </View>
  );
}

function Pedals({ t, accent }: WidgetProps) {
  const row = (label: string, v: number, color: string) => (
    <View style={{ gap: 4 }}>
      <View style={styles.between}>
        <Cap>{label}</Cap>
        <Num size={14} weight={600}>{Math.round(v * 100)}%</Num>
      </View>
      <Bar value={v} color={color} />
    </View>
  );
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
      {row('Gas', t.frame.throttle, accent)}
      {row('Bremse', t.frame.brake, C.hot)}
    </View>
  );
}

function Fuel({ t, accent, w, h }: WidgetProps) {
  const fuel = fuelPercent(t.frame);
  const st = t.stats;
  const low = st.fuelLapsLeft != null ? st.fuelLapsLeft < 1.5 : fuel < 10;
  const roomy = w > 260 && h > 70;
  const barH = Math.max(24, h * (roomy ? 0.45 : 0.5));
  const figure = (value: string, label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
      <Num size={20}>{value}</Num>
      <Cap size={8} style={{ marginBottom: 3 }}>{label}</Cap>
    </View>
  );
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View style={{ height: barH, borderRadius: 6, overflow: 'hidden', backgroundColor: alpha(C.border, 0.75), justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (`${fuel}%` as `${number}%`), backgroundColor: low ? C.hot : accent, opacity: 0.85 }} />
        <Num size={Math.min(32, barH * 0.6)} style={{ textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>{fmt.decimal(fuel)}%</Num>
      </View>
      <View style={[styles.between, { marginTop: 'auto' }]}>
        {roomy ? (
          <>
            <Cap>⛽</Cap>
            {figure(fmt.decimal(st.fuelPerLap), 'pr. omg.')}
            {figure(fmt.decimal(st.fuelLapsLeft), 'omg. tilbage')}
            {figure(fmt.duration(st.fuelTimeLeft), 'tid tilbage')}
          </>
        ) : (
          figure(fmt.decimal(st.fuelLapsLeft), 'omg. tilbage')
        )}
      </View>
    </View>
  );
}

function FuelCompact({ t, accent, w, h }: WidgetProps) {
  const f = t.frame;
  const st = t.stats;
  const litres = f.fuelCapacity > 0 ? f.fuelLevel : null;
  const perLap = st.fuelPerLap != null && f.fuelCapacity > 0 ? (st.fuelPerLap * f.fuelCapacity) / 100 : st.fuelPerLap;
  const low = (st.fuelLapsLeft ?? 99) < 1.5;
  return (
    <Trio
      w={w}
      h={h}
      items={[
        [litres != null ? fmt.decimal(litres, 0) : fmt.decimal(fuelPercent(f), 0), litres != null ? 'Liter' : '%', C.text],
        [fmt.decimal(perLap, 2), 'Pr. omg.', C.text],
        [fmt.decimal(st.fuelLapsLeft), 'Omg. tilbage', low ? C.ledRed : accent],
      ]}
    />
  );
}

function Trio({ items, w, h }: { items: [string, string, string][]; w: number; h: number }) {
  const size = Math.min(h * 0.55, (w / 3) * 0.4);
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
      {items.map(([v, label, color], i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Num size={size} weight={800} color={color}>{v}</Num>
          <Cap size={8}>{label}</Cap>
        </View>
      ))}
    </View>
  );
}

function RaceInfo({ t, w, h }: WidgetProps) {
  const f = t.frame;
  return (
    <Trio
      w={w}
      h={h}
      items={[
        [fmt.duration(t.stats.sessionTime), 'Løb', C.text],
        [f.position > 0 ? `${f.position}/${f.totalPositions}` : '—', 'Plads', C.text],
        [f.lap > 0 ? (f.totalLaps > 0 ? `${f.lap}/${f.totalLaps}` : String(f.lap)) : '—', 'Omgang', C.text],
      ]}
    />
  );
}

function LapTime({ t, accent, w, h }: WidgetProps) {
  const f = t.frame;
  return (
    <View style={{ flex: 1 }}>
      <Big value={fmt.lap(t.stats.currentLap)} color={accent} w={w} h={h * 0.7} ratio={0.7} />
      <View style={[styles.between, { marginTop: 'auto' }]}>
        <Cap>Omgang</Cap>
        <Num size={14} weight={600}>{f.lap > 0 ? (f.totalLaps > 0 ? `${f.lap}/${f.totalLaps}` : String(f.lap)) : '—'}</Num>
      </View>
    </View>
  );
}

function LapTimes({ t, racing, w, h }: WidgetProps) {
  const st = t.stats;
  const size = Math.max(15, Math.min(40, h / 9, w / 5.5));
  const rows: [string, number | null, string][] = [
    ['Aktuel omgang', st.currentLap, C.muted],
    ['Seneste', st.lastLap, C.lastLap],
    ['Bedste', st.bestLap, C.bestLap],
    ['Gennemsnit', st.averageLap, C.avgLap],
  ];
  return (
    <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'flex-end' }}>
      {rows.map(([label, value, color], i) => (
        <View key={label} style={{ alignItems: 'flex-end' }}>
          <Cap color={color}>{label}</Cap>
          <Num size={size} weight={racing ? 800 : 600} color={racing ? (i === 0 ? C.ledYellow : C.racingCyan) : C.text}>{fmt.lap(value)}</Num>
        </View>
      ))}
    </View>
  );
}

function Delta({ t, w, h }: WidgetProps) {
  const d = t.stats.delta;
  const color = d == null ? C.muted : d <= 0 ? C.ledGreen : C.ledRed;
  const amount = Math.min(1, Math.abs(d ?? 0)) * 50;
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Num size={Math.min(h * 0.6, w * 0.26)} weight={800} color={color}>{fmt.delta(d)}</Num>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: alpha(C.border, 0.6), overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: (`${(d ?? 0) <= 0 ? 50 - amount : 50}%` as `${number}%`), width: (`${amount}%` as `${number}%`), backgroundColor: color }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%' as `${number}%`, width: 2, marginLeft: -1, backgroundColor: C.text }} />
      </View>
    </View>
  );
}

function LapCount({ t, accent, w, h }: WidgetProps) {
  const f = t.frame;
  return <Big value={f.lap > 0 ? String(f.lap) : '—'} unitText={f.totalLaps > 0 ? `/ ${f.totalLaps}` : undefined} color={accent} w={w} h={h} />;
}

function Position({ t, accent, w, h }: WidgetProps) {
  const f = t.frame;
  return <Big value={f.position > 0 ? `P${f.position}` : '—'} unitText={f.totalPositions > 0 ? `/ ${f.totalPositions}` : undefined} color={accent} w={w} h={h} />;
}

function Tyres({ t, s, racing, w, h }: WidgetProps) {
  const labels = ['V for', 'H for', 'V bag', 'H bag'];
  const tileW = (w - 8) / 2;
  const tileH = (h - 8) / 2;
  const tile = (i: number) => {
    const temp = t.frame.tyres[i];
    const color = tyreColor(temp, s);
    return (
      <View
        key={i}
        style={{
          flex: 1, borderRadius: 12, borderWidth: racing ? 2 : 1, borderColor: alpha(color, 0.5), backgroundColor: alpha(color, temp > 1 ? 0.16 : 0.08),
          alignItems: 'center', justifyContent: 'space-between', padding: 6,
        }}
      >
        <Cap size={8}>{labels[i]}</Cap>
        <Num size={Math.min(tileH * 0.45, tileW * 0.36)} color={temp > 1 ? color : C.muted}>{temp > 1 ? `${Math.round(temp)}°` : '—'}</Num>
        {tileH > 70 ? <Cap size={8} color={color}>{tyreLabel(temp, s)}</Cap> : <View />}
      </View>
    );
  };
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>{[tile(0), tile(1)]}</View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>{[tile(2), tile(3)]}</View>
    </View>
  );
}

function TrackMap({ t, accent }: WidgetProps) {
  const pts = t.stats.outline;
  const car = t.stats.car;
  if (pts.length <= 5) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>Kør en omgang, så tegner RaceDeck banen.</Text>
      </View>
    );
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const size = Math.max(x1 - x0, z1 - z0, 1);
  const pad = size * 0.06;
  const d = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + (t.stats.outlineComplete ? 'Z' : '');
  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height="100%" viewBox={`${x0 - pad} ${z0 - pad} ${x1 - x0 + 2 * pad} ${z1 - z0 + 2 * pad}`} preserveAspectRatio="xMidYMid meet">
        <Path d={d} fill="none" stroke={C.muted} strokeOpacity={0.7} strokeWidth={size / 110} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={pts[0][0]} cy={pts[0][1]} r={size / 140} fill={C.text} />
        {car ? <Circle cx={car[0]} cy={car[1]} r={size / 40} fill={accent} fillOpacity={0.3} /> : null}
        {car ? <Circle cx={car[0]} cy={car[1]} r={size / 70} fill={accent} /> : null}
      </Svg>
      {!t.stats.outlineComplete ? <Cap style={{ position: 'absolute', left: 0, bottom: 0 }}>Tegner banen …</Cap> : null}
    </View>
  );
}

function Assists({ t }: WidgetProps) {
  const pill = (label: string, on: boolean, color: string) => (
    <View style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color : alpha(C.border, 0.5) }}>
      <Num size={20} color={on ? '#000' : C.faint}>{label}</Num>
    </View>
  );
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
      {pill('TCS', has(t.frame, Flag.tcs), C.warm)}
      {pill('ASM', has(t.frame, Flag.asm), C.cold)}
      {has(t.frame, Flag.handbrake) ? pill('H', true, C.hot) : null}
    </View>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.between}>
      <Cap>{label}</Cap>
      <Num size={16} weight={600}>{value}</Num>
    </View>
  );
}

function Temps({ t }: WidgetProps) {
  const f = t.frame;
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
      <StatLine label="Vand" value={`${fmt.decimal(f.waterTemp, 0)}°`} />
      <StatLine label="Olie" value={`${fmt.decimal(f.oilTemp, 0)}°`} />
      {has(f, Flag.hasTurbo) ? <StatLine label="Turbo" value={`${fmt.decimal(f.boost, 2)} bar`} /> : null}
    </View>
  );
}

function Distance({ t, s, accent, w, h }: WidgetProps) {
  const km = s.useMPH ? t.stats.distanceKm / 1.609344 : t.stats.distanceKm;
  return (
    <View style={{ flex: 1 }}>
      <Big value={fmt.decimal(km)} unitText={s.useMPH ? 'mi' : 'km'} color={accent} w={w} h={h * 0.7} />
      <View style={{ marginTop: 'auto' }}>
        <StatLine label="Topfart" value={fmt.decimal(spd(s, t.stats.topSpeedKmh), 0)} />
      </View>
    </View>
  );
}

function Timer({ t, accent, w, h }: WidgetProps) {
  return <Big value={fmt.clock(t.stats.sessionTime)} color={accent} w={w} h={h} ratio={0.6} />;
}

export const WIDGETS: Record<WidgetKind, (p: WidgetProps) => React.ReactElement> = {
  cockpit: Cockpit, speed: Speed, rpm: Rpm, gear: Gear, pedals: Pedals, fuel: Fuel, fuelCompact: FuelCompact,
  lapTime: LapTime, lapTimes: LapTimes, delta: Delta, lapCount: LapCount, position: Position, raceInfo: RaceInfo,
  tyres: Tyres, map: TrackMap, assists: Assists, temps: Temps, distance: Distance, timer: Timer,
};

/** Widgets that draw their own headings. */
export const NO_TITLE = new Set<WidgetKind>(['tyres', 'cockpit', 'lapTimes', 'raceInfo']);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
});
