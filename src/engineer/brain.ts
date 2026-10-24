// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { Flag, Frame, has } from '../telemetry/frame';
import type { Stats } from '../telemetry/tracker';
import { PitOptions, PitPlan, pitPlan } from './pit';
import { TyreEstimate, TyreReport, estimateTyres } from './tyres';

/**
 * The race engineer's brain: watches telemetry and decides *when* there is
 * something worth saying, and *what* to say (in Danish). No AI, no internet –
 * fixed rules, so it is instant and never says anything made up.
 */

export type Chattiness = 'low' | 'normal' | 'high';

export interface EngineerSettings {
  enabled: boolean;
  lapTimes: boolean;
  delta: boolean;
  fuel: boolean;
  tyres: boolean;
  position: boolean;
  race: boolean;
  chatty: Chattiness;
  rate: number; // speaking speed, 1 = normal
  /** Laps of fuel to keep as a margin when pitting. */
  pitReserve: number;
  /** Change tyres after this many laps (0 = off). GT7 doesn't send tyre wear. */
  tyreStint: number;
  /** Change tyres when this many percent are left (used with your own wear reports). */
  tyreChangeAt: number;
}

export const defaultEngineer: EngineerSettings = {
  enabled: true, lapTimes: true, delta: true, fuel: true, tyres: true, position: true, race: true, chatty: 'normal', rate: 1,
  pitReserve: 0.3, tyreStint: 0, tyreChangeAt: 25,
};

export interface TyreLimits {
  tyreCold: number;
  tyreHot: number;
}

export type Category = 'lapTimes' | 'delta' | 'fuel' | 'tyres' | 'position' | 'race';

export interface Message {
  text: string;
  /** 3 = urgent (interrupts), 2 = important, 1 = nice to know */
  priority: 1 | 2 | 3;
  category: Category;
  at: number; // ms timestamp
}

// ---------- Spoken Danish ----------

const comma = (v: number, digits: number) => v.toFixed(digits).replace('.', ',');

/** 79.83 → "1 minut 19,8" · 45.2 → "45,2 sekunder" */
export function spokenLap(seconds: number): string {
  const tenths = Math.round(seconds * 10) / 10;
  const m = Math.floor(tenths / 60);
  const s = tenths - m * 60;
  if (m === 0) return `${comma(s, 1)} sekunder`;
  return `${m} ${m === 1 ? 'minut' : 'minutter'} ${comma(s, 1)}`;
}

/** 0.34 → "3 tiendedele" · 1.46 → "1,5 sekunder" */
export function spokenGap(seconds: number): string {
  const a = Math.abs(seconds);
  if (a < 0.95) {
    const t = Math.max(1, Math.round(a * 10));
    return t === 1 ? 'en tiendedel' : `${t} tiendedele`;
  }
  return `${comma(a, 1)} sekunder`;
}

const TYRE_NAMES = ['venstre fordæk', 'højre fordæk', 'venstre bagdæk', 'højre bagdæk'];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Venstre fordæk er for varmt." / "Fordækkene er for varme." */
function tyreSentence(hot: number[]): string {
  return `${tyreGroup(hot)} for ${hot.length === 1 ? 'varmt' : 'varme'}.`;
}

function tyreGroup(hot: number[]): string {
  const set = new Set(hot);
  if (set.size === 4) return 'Alle fire dæk er';
  if (set.size === 2 && set.has(0) && set.has(1)) return 'Fordækkene er';
  if (set.size === 2 && set.has(2) && set.has(3)) return 'Bagdækkene er';
  if (set.size === 1) return `${capital(TYRE_NAMES[hot[0]])} er`; // singular: caller adds "for varmt"
  const names = hot.map((i) => TYRE_NAMES[i]);
  return `${capital(names.slice(0, -1).join(', '))} og ${names[names.length - 1]} er`;
}

// ---------- Brain ----------

export class EngineerBrain {
  private synced = false;
  private lapCount = 0; // number of recorded lap times
  private lastLap: number | null = null;
  private deltaSpoken = new Set<number>();
  private lastPosition: number | null = null;
  private positionCandidate: number | null = null;
  private positionSince = 0;
  private tyreWarned = [-1e12, -1e12, -1e12, -1e12];
  /** A tyre is re-armed once it has cooled 3 °C below the limit, so a tyre that stays hot isn't repeated. */
  private tyreArmed = [true, true, true, true];
  private coldWarned = false;
  private warmSaid = false;
  private fuelOkSaid = false;
  // Pit strategy and tyre stint
  private stintStartLap = 1;
  private lastFuelPct: number | null = null;
  private plan: PitPlan | null = null;
  private planSpokenLap = -10;
  private planSpokenBoxLap: number | null = null;
  private boxNowCalledLap = -1;
  private stintLapTimes: { lap: number; time: number }[] = [];
  private degradeWarnedLap = -10;
  private tyreReports: TyreReport[] = [];
  private tyreLowWarned = false;
  private askedForWear = false;
  private currentLap = 0;

  /** Pit strategy settings plus the tyre stint and your wear reports. */
  pitOptions(cfg: EngineerSettings): PitOptions {
    const est = this.tyreEstimate(cfg);
    return { reserveLaps: cfg.pitReserve, tyreStintLaps: cfg.tyreStint, stintStartLap: this.stintStartLap, tyreBoxLap: est?.changeLap ?? null };
  }

  tyreEstimate(cfg: EngineerSettings): TyreEstimate | null {
    return estimateTyres(this.tyreReports, this.stintStartLap, Math.max(1, this.currentLap), cfg.tyreChangeAt);
  }

  /** You told the engineer how much tyre is left (most worn tyre, %). Returns his reply. */
  reportTyres(remaining: number, cfg: EngineerSettings): string {
    const lap = Math.max(1, this.currentLap);
    this.tyreReports = [...this.tyreReports.filter((r) => r.lap !== lap), { lap, remaining }];
    this.askedForWear = true;
    this.tyreLowWarned = remaining <= cfg.tyreChangeAt + 10 ? this.tyreLowWarned : false;
    const est = this.tyreEstimate(cfg);
    const done = Math.max(0, lap - this.stintStartLap);
    let text = `Noteret: ${Math.round(remaining)} procent dæk tilbage`;
    if (!est || est.perLap < 0.05) return `${text}. Jeg skal bruge en melding mere for at se, hvor hurtigt de slides.`;
    text += ` efter ${done} omgang${done === 1 ? '' : 'e'}. Det er cirka ${est.perLap.toFixed(1).replace('.', ',')} procent pr. omgang.`;
    if (est.remainingNow <= cfg.tyreChangeAt) text += ' Dækkene er slidte – box for nye dæk.';
    else if (est.changeLap !== null) text += ` De holder til omkring omgang ${est.changeLap}, hvor du skifter ved ${cfg.tyreChangeAt} procent.`;
    return text;
  }

  /** You told the engineer you have new tyres. */
  newTyres(): string {
    this.stintStartLap = Math.max(1, this.currentLap);
    this.tyreReports = [];
    this.stintLapTimes = [];
    this.tyreLowWarned = false;
    this.askedForWear = false;
    return 'Noteret: nye dæk. Sig til om et par omgange, hvor meget de er slidt.';
  }

  reset() {
    Object.assign(this, new EngineerBrain());
  }

  observe(f: Frame, s: Stats, cfg: EngineerSettings, tyres: TyreLimits, now: number): Message[] {
    const out: Message[] = [];
    const say = (category: Category, priority: Message['priority'], text: string) => {
      if (cfg[category]) out.push({ text, priority, category, at: now });
    };

    // First packet, or the tracker was reset (new race): just catch up silently.
    if (!this.synced || s.lapTimes.length < this.lapCount) {
      this.reset();
      this.synced = true;
      this.lapCount = s.lapTimes.length;
      this.lastLap = f.lap;
      this.lastPosition = f.position > 0 ? f.position : null;
      this.stintStartLap = 1; // joined mid-race: assume the tyres are from the start
      this.currentLap = f.lap;
      this.lastFuelPct = fuelPct(f);
      return out;
    }

    // --- Pit stop detected (the tank was filled): new stint ---
    const pct = fuelPct(f);
    if (this.lastFuelPct !== null && pct > this.lastFuelPct + 3) {
      const hadReports = this.tyreReports.length > 0;
      this.stintStartLap = Math.max(1, f.lap);
      this.stintLapTimes = [];
      this.tyreReports = [];
      this.tyreLowWarned = false;
      this.askedForWear = false;
      this.fuelOkSaid = false;
      this.planSpokenLap = -10;
      this.planSpokenBoxLap = null;
      say('fuel', 1, hadReports ? 'Godt stop. Jeg regner med nye dæk.' : 'Godt stop.');
    }
    this.currentLap = f.lap;
    this.lastFuelPct = pct;

    const driving = has(f, Flag.onTrack) && !has(f, Flag.paused) && !has(f, Flag.loading);
    if (!driving) return out;

    // --- New lap started: race progress ---
    if (this.lastLap !== null && f.lap > this.lastLap) {
      this.deltaSpoken.clear();
      if (f.totalLaps > 1) {
        if (f.lap === f.totalLaps) say('race', 3, 'Sidste omgang!');
        else if (f.lap === f.totalLaps - 1 && cfg.chatty !== 'low') say('race', 1, 'To omgange tilbage.');
      }
    }
    this.lastLap = f.lap;

    // --- A lap time was recorded ---
    if (s.lapTimes.length > this.lapCount) {
      const times = s.lapTimes;
      const lap = times[times.length - 1];
      const previous = times.slice(0, -1);
      const prevBest = previous.length ? Math.min(...previous) : null;
      if (prevBest === null) say('lapTimes', 1, `Omgang ${spokenLap(lap)}.`);
      else if (lap < prevBest) say('lapTimes', 2, `Ny bedste omgang! ${spokenLap(lap)}.`);
      else if (cfg.chatty !== 'low' || lap - prevBest < 0.3) say('lapTimes', 1, `${spokenLap(lap)}. ${spokenGap(lap - prevBest)} efter din bedste.`);
      this.lapCount = times.length;
      this.stintLapTimes.push({ lap: f.lap - 1, time: lap });
      this.pitReport(f, s, cfg, say);
      this.tyreWear(f, cfg, say);
    }

    // --- Last chance: remind mid-lap when the box is this lap ---
    if (this.plan?.status === 'boxNow' && s.bestLap && s.currentLap !== null && s.currentLap >= 0.65 * s.bestLap && this.boxNowCalledLap !== f.lap) {
      this.boxNowCalledLap = f.lap;
      say('fuel', 3, 'Box, box, box! Pit denne omgang.');
    }

    // --- Delta against the best lap, at fixed points in the lap ---
    if (s.delta !== null && s.bestLap && s.currentLap !== null) {
      const checkpoints = cfg.chatty === 'high' ? [0.33, 0.66] : [0.5];
      for (const cp of checkpoints) {
        if (!this.deltaSpoken.has(cp) && s.currentLap >= cp * s.bestLap) {
          this.deltaSpoken.add(cp);
          const d = s.delta;
          if (Math.abs(d) < 0.05) say('delta', 1, 'Lige på din bedste tid.');
          else say('delta', 1, `${capital(spokenGap(d))} ${d < 0 ? 'foran' : 'bagud'}.`);
        }
      }
    }

    // --- Tyres ---
    for (let i = 0; i < 4; i++) if (f.tyres[i] < tyres.tyreHot - 3) this.tyreArmed[i] = true;
    const newlyHot = [0, 1, 2, 3].filter((i) => f.tyres[i] >= tyres.tyreHot && this.tyreArmed[i] && now - this.tyreWarned[i] > 60_000);
    if (newlyHot.length) {
      // Mention every tyre that is hot right now, so both fronts become "Fordækkene".
      const hotNow = [0, 1, 2, 3].filter((i) => f.tyres[i] >= tyres.tyreHot && (this.tyreArmed[i] || newlyHot.includes(i)));
      hotNow.forEach((i) => {
        this.tyreWarned[i] = now;
        this.tyreArmed[i] = false;
      });
      say('tyres', 2, tyreSentence(hotNow));
    }
    const allCold = f.tyres.every((t) => t > 1 && t < tyres.tyreCold);
    if (!this.coldWarned && allCold && s.sessionTime > 15) {
      this.coldWarned = true;
      say('tyres', 1, 'Dækkene er kolde. Pas på grebet.');
    }
    if (this.coldWarned && !this.warmSaid && f.tyres.every((t) => t >= tyres.tyreCold + 10)) {
      this.warmSaid = true;
      if (cfg.chatty !== 'low') say('tyres', 1, 'Dækkene er varme nu.');
    }

    // --- Position (must hold for 2.5 s, so side-by-side battles don't spam) ---
    if (f.position > 0) {
      if (this.lastPosition === null) this.lastPosition = f.position;
      else if (f.position === this.lastPosition) this.positionCandidate = null;
      else if (this.positionCandidate !== f.position) {
        this.positionCandidate = f.position;
        this.positionSince = now;
      } else if (now - this.positionSince > 2500) {
        const gained = f.position < this.lastPosition;
        if (gained && f.position === 1) say('position', 2, 'Du fører løbet!');
        else if (gained) say('position', 2, `Plads ${f.position}. Godt overhalet!`);
        else say('position', 2, `Du er faldet til plads ${f.position}.`);
        this.lastPosition = f.position;
        this.positionCandidate = null;
      }
    }

    return out;
  }

  /** Spoken once per lap, right after the lap time: the pit plan. */
  private pitReport(f: Frame, s: Stats, cfg: EngineerSettings, say: (c: Category, p: Message['priority'], t: string) => void) {
    const plan = pitPlan(f, s, this.pitOptions(cfg));
    this.plan = plan;
    switch (plan.status) {
      case 'noStop':
        if (!this.fuelOkSaid && f.totalLaps > 0) {
          this.fuelOkSaid = true;
          say('fuel', 1, plan.text);
        }
        break;
      case 'save':
        if (f.lap - this.planSpokenLap >= 2) {
          this.planSpokenLap = f.lap;
          say('fuel', 2, plan.text);
        }
        break;
      case 'box':
        if (plan.lapsUntil === 1 || plan.boxLap !== this.planSpokenBoxLap || f.lap - this.planSpokenLap >= (cfg.chatty === 'high' ? 2 : 3)) {
          this.planSpokenLap = f.lap;
          this.planSpokenBoxLap = plan.boxLap;
          say('fuel', plan.lapsUntil === 1 ? 2 : 1, plan.text);
        }
        break;
      case 'boxNow':
        say('fuel', 3, plan.text);
        break;
      default:
        break;
    }
  }

  /**
   * GT7 doesn't send tyre wear, so we look at the lap times instead: if the last
   * three laps of this stint are clearly slower than the stint's best three, the
   * tyres are probably going off.
   */
  private tyreWear(f: Frame, cfg: EngineerSettings, say: (c: Category, p: Message['priority'], t: string) => void) {
    // From your own wear reports
    const est = this.tyreEstimate(cfg);
    if (est && !this.tyreLowWarned && est.remainingNow <= cfg.tyreChangeAt + 10) {
      this.tyreLowWarned = true;
      say('tyres', 2, `Dækkene er ved at være slidte. Cirka ${Math.round(est.remainingNow)} procent tilbage.`);
    }
    // Ask for a report after a few laps on the same tyres (once per stint)
    const onTyres = f.lap - this.stintStartLap;
    const lapsToGo = f.totalLaps > 0 ? f.totalLaps - f.lap : 99;
    if (!this.askedForWear && !this.tyreReports.length && onTyres >= 5 && lapsToGo >= 3 && cfg.chatty !== 'low') {
      this.askedForWear = true;
      say('tyres', 1, 'Hvor meget dæk har du tilbage? Sig fx "dækkene har 70 procent", så regner jeg det med i pitplanen.');
    }
    const laps = this.stintLapTimes.filter((t) => t.lap > this.stintStartLap).map((t) => t.time);
    if (laps.length < 5) return;
    const best = Math.min(...laps);
    const clean = laps.filter((t) => t < best * 1.15); // ignore spins, traffic and pit laps
    if (clean.length < 5) return;
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const ref = mean([...clean].sort((a, b) => a - b).slice(0, 3));
    const recent = mean(clean.slice(-3));
    const gap = recent - ref;
    if (gap >= 0.8 && f.lap - this.degradeWarnedLap >= 4) {
      this.degradeWarnedLap = f.lap;
      say('tyres', cfg.chatty === 'low' ? 1 : 2, `Dine omgange er ${spokenGap(gap)} langsommere end dine bedste i denne stint. Dækkene er nok ved at være slidte.`);
    }
  }

  /** Laps driven on the current tyres. */
  stintLaps(f: Frame): number {
    return Math.max(0, f.lap - this.stintStartLap);
  }
}

function fuelPct(f: Frame): number {
  return f.fuelCapacity > 0 ? (f.fuelLevel / f.fuelCapacity) * 100 : f.fuelLevel;
}
