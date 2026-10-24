// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

/**
 * Tyre wear you report yourself. GT7 shows wear on screen but doesn't send it
 * in the telemetry, so you tell the engineer ("dækkene har 70 procent tilbage")
 * and he works out the wear per lap and when the tyres will be done.
 */

export interface TyreReport {
  /** The lap you were on when you reported. */
  lap: number;
  /** Percent of tyre left (100 = new). Report the most worn tyre. */
  remaining: number;
}

export interface TyreEstimate {
  remainingNow: number;
  perLap: number;
  /** Box at the end of this lap to change tyres before they drop below the limit. */
  changeLap: number | null;
  lapsLeft: number | null;
}

/**
 * Estimates wear from the reports in this stint. New tyres (100 %) are assumed
 * at the start of the stint; with two or more reports the newest trend is used.
 */
export function estimateTyres(reports: TyreReport[], stintStartLap: number, lap: number, changeAt: number): TyreEstimate | null {
  if (!reports.length) return null;
  const last = reports[reports.length - 1];
  let perLap: number;
  if (reports.length >= 2) {
    const first = reports[0];
    perLap = (first.remaining - last.remaining) / Math.max(1, last.lap - first.lap);
  } else {
    perLap = (100 - last.remaining) / Math.max(1, last.lap - stintStartLap);
  }
  perLap = Math.max(0, perLap);
  const remainingNow = Math.max(0, Math.min(100, last.remaining - perLap * Math.max(0, lap - last.lap)));
  if (perLap < 0.05) return { remainingNow, perLap, changeLap: null, lapsLeft: null };
  const lapsLeft = (remainingNow - changeAt) / perLap;
  const changeLap = lap + Math.max(0, Math.floor(lapsLeft)) - 1;
  return { remainingNow, perLap, changeLap: Math.max(lap, changeLap), lapsLeft };
}

export type TyreCommand = { kind: 'report'; remaining: number } | { kind: 'newTyres' };

const WORD_NUMBERS: Record<string, number> = {
  ti: 10, tyve: 20, tredive: 30, fyrre: 40, halvtreds: 50, tres: 60, halvfjerds: 70, firs: 80, halvfems: 90, hundrede: 100, halvdelen: 50, halv: 50,
};

/**
 * Understands Danish tyre reports:
 * "dækkene har 70 procent tilbage" → 70 · "dækkene er 30 procent slidt" → 70 · "dæk 65" → 65 · "nye dæk" → reset.
 */
export function parseTyreCommand(text: string): TyreCommand | null {
  const q = ' ' + text.toLowerCase().replace(/[^a-zæøå0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  if (/ (nye|friske|skiftet|skiftede) dæk/.test(q) || / skiftet dækkene/.test(q)) return { kind: 'newTyres' };
  if (!/ (dæk|dækkene|dækket|gummi|slid|slidt|slidte)/.test(q)) return null;
  let n: number | null = null;
  const digits = q.match(/ (\d{1,3}) /);
  if (digits) n = Number(digits[1]);
  else {
    for (const [word, value] of Object.entries(WORD_NUMBERS)) {
      if (q.includes(` ${word} `)) {
        n = value;
        break;
      }
    }
  }
  if (n === null || n < 0 || n > 100) return null;
  const isWear = / (slid|slidt|slidte|brugt|brugte|væk)/.test(q) && !/ (tilbage|igen|rest|resten|tilovers)/.test(q);
  return { kind: 'report', remaining: isWear ? 100 - n : n };
}
