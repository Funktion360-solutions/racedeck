// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

/**
 * Pit strategy: when to box and how much fuel to add.
 *
 * Built only from what GT7 actually sends: fuel level, measured fuel use per lap
 * (average of the last 3 whole laps) and the race length in laps. GT7 does not
 * send tyre wear, so tyre stops come from a stint length you choose yourself.
 */

export interface PitFrame {
  lap: number;
  totalLaps: number;
  fuelLevel: number;
  fuelCapacity: number;
}

export interface PitStats {
  fuelPerLap: number | null; // % per lap
  fuelLapsLeft: number | null;
}

export interface PitOptions {
  /** Laps of fuel to keep as a safety margin when pitting (e.g. 0.3). */
  reserveLaps: number;
  /** Change tyres after this many laps (0 = off). */
  tyreStintLaps: number;
  /** Lap on which the current tyre stint started. */
  stintStartLap: number;
  /** From your own wear reports: change tyres at the end of this lap (overrides tyreStintLaps). */
  tyreBoxLap?: number | null;
}

export type PitStatus = 'unknown' | 'noStop' | 'save' | 'box' | 'boxNow';

export interface PitPlan {
  status: PitStatus;
  /** Box at the end of this lap. */
  boxLap: number | null;
  lapsUntil: number | null;
  reason: 'fuel' | 'tyres' | 'both' | null;
  /** Fuel to add at the stop. */
  addPercent: number | null;
  addLitres: number | null;
  /** Fuel saving needed to finish without a stop (0.04 = 4 %). */
  saveRate: number | null;
  shortLaps: number | null;
  /** Spoken Danish sentence. */
  text: string;
  /** Short text for the widget. */
  headline: string;
  detail: string;
}

const comma = (v: number, d = 0) => v.toFixed(d).replace('.', ',');

function fuelPhrase(addPercent: number | null, addLitres: number | null): string {
  if (addLitres !== null) return `Tank ${comma(addLitres)} liter.`;
  if (addPercent !== null) return `Tank ${comma(addPercent)} procent.`;
  return '';
}

export function pitPlan(f: PitFrame, s: PitStats, o: PitOptions): PitPlan {
  const base: PitPlan = { status: 'unknown', boxLap: null, lapsUntil: null, reason: null, addPercent: null, addLitres: null, saveRate: null, shortLaps: null, text: '', headline: '—', detail: '' };
  const lap = Math.max(1, f.lap);
  const hasRaceLength = f.totalLaps > 0;
  const remaining = hasRaceLength ? f.totalLaps - lap + 1 : null; // laps still to drive, incl. this one
  const tyreBoxLap = o.tyreBoxLap != null ? o.tyreBoxLap : o.tyreStintLaps > 0 ? o.stintStartLap + o.tyreStintLaps - 1 : null;
  const needTyres = tyreBoxLap !== null && (!hasRaceLength || tyreBoxLap < f.totalLaps);

  if (f.lap <= 0) return { ...base, text: 'Løbet er ikke startet endnu.', headline: 'Venter', detail: 'Løbet er ikke startet' };
  if (remaining !== null && remaining <= 0) return { ...base, status: 'noStop', text: 'Løbet er slut.', headline: 'Mål', detail: '' };

  const perLap = s.fuelPerLap;
  const left = s.fuelLapsLeft;
  if (perLap === null || left === null) {
    if (needTyres && tyreBoxLap !== null) {
      return planBox(base, lap, tyreBoxLap, 'tyres', null, null, f);
    }
    return { ...base, text: 'Jeg kender ikke brændstofforbruget endnu. Kør en hel omgang, så laver jeg en plan.', headline: 'Måler …', detail: 'Kør en hel omgang' };
  }

  const fuelNow = left * perLap; // % in the tank
  const needFuel = remaining !== null ? left < remaining + 0.05 : true;

  if (remaining !== null && !needFuel && !needTyres) {
    return { ...base, status: 'noStop', text: 'Intet pitstop nødvendigt. Brændstoffet rækker til mål.', headline: 'Intet stop', detail: `Rækker til mål · ${comma(left, 1)} omg.` };
  }

  // The last lap you can finish (with the reserve still in the tank).
  const usable = left - o.reserveLaps;
  const fuelBoxLap = lap + Math.floor(usable) - 1;

  // Short by a little? Saving fuel may beat a stop.
  if (remaining !== null && needFuel && !needTyres) {
    const short = remaining - left;
    const saveRate = 1 - fuelNow / remaining / perLap;
    if (saveRate > 0 && saveRate <= 0.06) {
      const boxLap = Math.max(lap, fuelBoxLap);
      return {
        ...base,
        status: 'save',
        boxLap,
        lapsUntil: boxLap - lap,
        reason: 'fuel',
        saveRate,
        shortLaps: short,
        text: `Du mangler ${comma(short, 1)} omgang brændstof. Spar ${comma(Math.max(1, Math.ceil(saveRate * 100)))} procent pr. omgang, så klarer du dig uden stop. Ellers box senest i slutningen af omgang ${boxLap}.`,
        headline: `Spar ${Math.max(1, Math.ceil(saveRate * 100))} %`,
        detail: `eller box omg. ${boxLap}`,
      };
    }
  }

  let boxLap: number;
  let reason: PitPlan['reason'];
  if (needFuel && needTyres && tyreBoxLap !== null) {
    boxLap = Math.min(fuelBoxLap, tyreBoxLap);
    reason = Math.abs(fuelBoxLap - tyreBoxLap) <= 1 ? 'both' : fuelBoxLap < tyreBoxLap ? 'fuel' : 'tyres';
  } else if (needTyres && tyreBoxLap !== null) {
    boxLap = tyreBoxLap;
    reason = 'tyres';
  } else {
    boxLap = fuelBoxLap;
    reason = 'fuel';
  }
  boxLap = Math.max(lap, boxLap);

  // How much to add: enough for the laps after the stop plus the reserve – no more weight than needed.
  let addPercent: number | null = null;
  if (remaining !== null) {
    const fuelAtBox = Math.max(0, fuelNow - (boxLap - lap + 1) * perLap);
    const lapsAfter = f.totalLaps - boxLap;
    const need = (lapsAfter + o.reserveLaps) * perLap;
    addPercent = Math.max(0, Math.min(100 - fuelAtBox, need - fuelAtBox));
    if (reason === 'tyres' && addPercent < 1) addPercent = 0;
  } else {
    addPercent = 100 - Math.max(0, fuelNow - (boxLap - lap + 1) * perLap); // unknown race length: fill up
  }
  return planBox(base, lap, boxLap, reason, addPercent, perLap, f);
}

function planBox(base: PitPlan, lap: number, boxLap: number, reason: PitPlan['reason'], addPercent: number | null, perLap: number | null, f: PitFrame): PitPlan {
  const lapsUntil = boxLap - lap;
  const addLitres = addPercent !== null && f.fuelCapacity > 0 && f.fuelCapacity !== 100 ? Math.ceil((addPercent / 100) * f.fuelCapacity) : null;
  const pct = addPercent !== null ? Math.ceil(addPercent) : null;
  const fuel = addPercent !== null && addPercent >= 0.5 ? fuelPhrase(pct, addLitres) : '';
  const tyres = reason === 'both' ? ' Skift også dæk.' : '';
  const why = reason === 'tyres' ? ' for nye dæk' : '';
  let text: string;
  let headline: string;
  if (lapsUntil <= 0) {
    text = `Box, box! Kom ind denne omgang${why}. ${fuel}${tyres}`.trim();
    headline = 'BOX NU';
  } else if (lapsUntil === 1) {
    text = `Box${why} næste omgang, i slutningen af omgang ${boxLap}. ${fuel}${tyres}`.trim();
    headline = `Box omg. ${boxLap}`;
  } else {
    text = `Box${why} i slutningen af omgang ${boxLap}, om ${lapsUntil} omgange. ${fuel}${tyres}`.trim();
    headline = `Box omg. ${boxLap}`;
  }
  const add = addLitres !== null ? `+${addLitres} L` : pct !== null ? `+${pct} %` : '';
  const detail = [lapsUntil <= 0 ? 'denne omgang' : `om ${lapsUntil} omg.`, add, reason === 'tyres' || reason === 'both' ? 'dæk' : ''].filter(Boolean).join(' · ');
  return { ...base, status: lapsUntil <= 0 ? 'boxNow' : 'box', boxLap, lapsUntil, reason, addPercent: pct, addLitres, text: text.replace(/\s+/g, ' '), headline, detail };
}
