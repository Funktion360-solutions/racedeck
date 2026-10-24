// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { Flag, Frame, has } from '../telemetry/frame';
import type { Stats } from '../telemetry/tracker';

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
}

export const defaultEngineer: EngineerSettings = {
  enabled: true, lapTimes: true, delta: true, fuel: true, tyres: true, position: true, race: true, chatty: 'normal', rate: 1,
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
  private lapsSinceFuelStatus = 0;
  private shortFuelWarnedLap = -10;

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
      return out;
    }

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
      this.fuelReport(f, s, cfg, say);
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

  /** Spoken once per lap, right after the lap time. */
  private fuelReport(f: Frame, s: Stats, cfg: EngineerSettings, say: (c: Category, p: Message['priority'], t: string) => void) {
    const left = s.fuelLapsLeft;
    if (left === null) return;
    this.lapsSinceFuelStatus++;
    const remaining = f.totalLaps > 0 ? f.totalLaps - f.lap + 1 : null; // laps still to drive, incl. this one
    const whole = Math.floor(left);
    const enough = remaining !== null && left >= remaining + 0.05;
    if (enough) {
      // Enough to finish: say it once, then stay quiet about fuel.
      if (!this.fuelOkSaid && left >= remaining + 0.3) {
        this.fuelOkSaid = true;
        say('fuel', 1, 'Brændstoffet rækker til mål.');
      }
    } else if (left < 1.2) {
      say('fuel', 3, 'Brændstof kritisk. Box denne omgang!');
    } else if (remaining !== null) {
      if (f.lap - this.shortFuelWarnedLap >= 2) {
        this.shortFuelWarnedLap = f.lap;
        const short = remaining - left;
        say('fuel', 2, `Brændstoffet rækker ikke til mål. Du mangler ${comma(short, 1)} omgang${short >= 1.05 ? 'e' : ''}. Spar brændstof eller box.`);
      }
    } else if (left < 3.2) {
      say('fuel', 2, `Brændstof til ${whole} omgang${whole === 1 ? '' : 'e'}.`);
    } else if (cfg.chatty === 'high' || this.lapsSinceFuelStatus >= 5) {
      this.lapsSinceFuelStatus = 0;
      say('fuel', 1, `Brændstof til ${whole} omgange.`);
    }
  }
}
