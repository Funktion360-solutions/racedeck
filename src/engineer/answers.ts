// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { spokenGap, spokenLap } from './brain';
import { PitOptions, pitPlan } from './pit';
import type { TyreEstimate } from './tyres';

/**
 * Lets you ask the race engineer questions in Danish – no AI, no internet.
 * The question is matched against keywords, and the answer is built from live data.
 */

export interface AnswerFrame {
  lap: number;
  totalLaps: number;
  position: number;
  totalPositions: number;
  tyres: number[]; // FL, FR, RL, RR °C
  fuelLevel: number;
  fuelCapacity: number;
  waterTemp: number;
  oilTemp: number;
}

export interface AnswerStats {
  currentLap: number | null;
  lapTimes: number[];
  lastLap: number | null;
  bestLap: number | null;
  averageLap: number | null;
  delta: number | null;
  topSpeedKmh: number;
  sessionTime: number;
  fuelPerLap: number | null;
  fuelLapsLeft: number | null;
}

export interface AnswerLimits {
  tyreCold: number;
  tyreWarm: number;
  tyreHot: number;
  useMPH: boolean;
}

export type Topic = 'pit' | 'fuel' | 'tyres' | 'best' | 'last' | 'average' | 'delta' | 'position' | 'laps' | 'speed' | 'time' | 'engine' | 'status' | 'help';

/** Quick questions shown as buttons (same wording the voice understands). */
export const QUICK_QUESTIONS: { topic: Topic; label: string; question: string }[] = [
  { topic: 'status', label: '📋 Status', question: 'Hvordan går det?' },
  { topic: 'pit', label: '🔧 Pit', question: 'Hvornår skal jeg i pit?' },
  { topic: 'fuel', label: '⛽ Brændstof', question: 'Hvor meget brændstof har jeg?' },
  { topic: 'tyres', label: '🛞 Dæk', question: 'Hvordan har dækkene det?' },
  { topic: 'delta', label: '± Delta', question: 'Er jeg foran eller bagud?' },
  { topic: 'best', label: '🏁 Bedste', question: 'Hvad er min bedste omgang?' },
  { topic: 'last', label: '⏱ Seneste', question: 'Hvad var min seneste omgang?' },
  { topic: 'position', label: '🏆 Plads', question: 'Hvilken plads ligger jeg på?' },
  { topic: 'laps', label: '🔁 Omgange', question: 'Hvor mange omgange er der tilbage?' },
];

const normalize = (q: string) =>
  ' ' + q.toLowerCase().replace(/[^a-zæøå0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

/** Keyword rules, checked in order – the first match wins. */
const RULES: [Topic, RegExp][] = [
  ['help', / (hjælp|hvad kan du|hvad kan jeg spørge)/],
  ['pit', / (pit|pitten|pitstop|pitstoppet|box|boxe|depot|hvornår skal jeg ind|hvornår skal jeg stoppe|stop|tanke|tanker|strategi)/],
  ['fuel', / (brændstof|benzin|diesel|tank|tanken|fuel|brænd|rækker)/],
  ['tyres', / (dæk|dækkene|dækket|hjul|temperatur på dæk|gummi|slid|slidt|slidte)/],
  ['engine', / (motor|vand|olie|køler)/],
  ['average', / (gennemsnit|gennemsnitlig|snit)/],
  ['best', / (bedste|hurtigste|rekord|pb)/],
  ['last', / (seneste|sidste omgangstid|forrige|sidste tid|hvad kørte jeg)/],
  ['position', / (hvem er foran|hvem fører|hvem vinder)/],
  ['delta', / (foran|bagud|delta|hurtigere|langsommere|tempo|pace)/],
  ['position', / (plads|placering|position|nummer|fører|hvem er foran)/],
  ['laps', / (omgange tilbage|hvor mange omgange|omgang er jeg|hvilken omgang|mål|målstreg|sidste omgang)/],
  ['speed', / (topfart|tophastighed|max fart|hurtigt kørte|fart)/],
  ['time', / (tid|hvor længe|klokken|minutter)/],
  ['status', / (hvordan går|status|opdatering|update|hvordan ser|situation|går det)/],
];

export function topicOf(question: string): Topic | null {
  const q = normalize(question);
  for (const [topic, re] of RULES) if (re.test(q)) return topic;
  return null;
}

const comma = (v: number, d = 0) => v.toFixed(d).replace('.', ',');
const TYRE = ['venstre fordæk', 'højre fordæk', 'venstre bagdæk', 'højre bagdæk'];

function tyreWord(t: number, l: AnswerLimits): string {
  // "et dæk" is neuter in Danish: koldt / optimalt / varmt
  if (t < l.tyreCold + 5) return 'koldt';
  if (t <= l.tyreWarm) return 'optimalt';
  if (t < l.tyreHot) return 'varmt';
  return 'for varmt';
}

function fuelAnswer(f: AnswerFrame, s: AnswerStats): string {
  const pct = f.fuelCapacity > 0 ? (f.fuelLevel / f.fuelCapacity) * 100 : f.fuelLevel;
  const litres = f.fuelCapacity > 0 ? `${comma(f.fuelLevel)} liter, ` : '';
  if (s.fuelLapsLeft === null) return `Tanken er på ${comma(pct)} procent. ${litres ? `Det er ${litres.slice(0, -2)}. ` : ''}Jeg kender ikke forbruget endnu – kør en hel omgang.`;
  const left = s.fuelLapsLeft;
  let text = `Brændstof til ${comma(left, 1)} omgange. ${litres ? `Du har ${litres}` : 'Du har '}${comma(pct)} procent.`;
  if (f.totalLaps > 0) {
    const remaining = f.totalLaps - f.lap + 1;
    text += left >= remaining + 0.05 ? ' Det rækker til mål.' : ` Det rækker ikke til mål – du mangler ${comma(remaining - left, 1)} omgang${remaining - left >= 1.05 ? 'e' : ''}.`;
  }
  return text;
}

function tyreAnswer(f: AnswerFrame, l: AnswerLimits): string {
  const t = f.tyres.map((x) => Math.round(x));
  if (t.every((x) => x <= 1)) return 'Jeg har ingen dæktemperaturer endnu.';
  const words = f.tyres.map((x) => tyreWord(x, l));
  const temps = `Fordæk ${t[0]} og ${t[1]} grader, bagdæk ${t[2]} og ${t[3]}.`;
  if (words.every((w) => w === 'optimalt')) return `${temps} Alle fire er optimale.`;
  const issues = [0, 1, 2, 3].filter((i) => words[i] !== 'optimalt').map((i) => `${TYRE[i]} er ${words[i]}`);
  return `${temps} ${issues.join(', ').replace(/^./, (c) => c.toUpperCase())}.`;
}

function deltaAnswer(s: AnswerStats): string {
  if (s.delta === null) return s.bestLap ? 'Jeg har ikke en delta lige nu. Den kommer, når du er i gang med en omgang.' : 'Jeg har ingen delta endnu – kør en hel omgang først.';
  if (Math.abs(s.delta) < 0.05) return 'Du er lige på din bedste tid.';
  return `Du er ${spokenGap(s.delta)} ${s.delta < 0 ? 'foran' : 'bagud'} i forhold til din bedste omgang.`;
}

function positionAnswer(f: AnswerFrame): string {
  if (f.position <= 0) return 'Der er ingen placering i denne session.';
  if (f.position === 1) return `Du fører løbet${f.totalPositions > 0 ? ` foran ${f.totalPositions - 1} andre` : ''}!`;
  return `Du ligger nummer ${f.position}${f.totalPositions > 0 ? ` af ${f.totalPositions}` : ''}.`;
}

function lapsAnswer(f: AnswerFrame): string {
  if (f.lap <= 0) return 'Løbet er ikke startet endnu.';
  if (f.totalLaps <= 0) return `Du er på omgang ${f.lap}. Der er ikke et fast antal omgange.`;
  if (f.lap >= f.totalLaps) return 'Det er sidste omgang!';
  const after = f.totalLaps - f.lap;
  return `Du er på omgang ${f.lap} af ${f.totalLaps}. ${after} omgang${after === 1 ? '' : 'e'} tilbage efter denne.`;
}

export interface AnswerContext {
  pit: PitOptions;
  /** From your own wear reports, if any. */
  tyreWear?: TyreEstimate | null;
  tyreChangeAt?: number;
}

export function answer(question: string, f: AnswerFrame, s: AnswerStats, l: AnswerLimits, ctx?: AnswerContext): string {
  const topic = topicOf(question);
  switch (topic) {
    case 'pit':
      return pitPlan(f, s, ctx?.pit ?? { reserveLaps: 0.3, tyreStintLaps: 0, stintStartLap: 1 }).text;
    case 'fuel':
      return fuelAnswer(f, s);
    case 'tyres': {
      let text = tyreAnswer(f, l);
      if (ctx && f.lap > 0) {
        const onTyres = Math.max(0, f.lap - ctx.pit.stintStartLap);
        text += ` Dækkene har kørt ${onTyres} omgang${onTyres === 1 ? '' : 'e'}.`;
        if (ctx.pit.tyreStintLaps > 0) {
          const left = ctx.pit.tyreStintLaps - onTyres;
          text += left > 0 ? ` Dækskift om ${left} omgang${left === 1 ? '' : 'e'}.` : ' Det er tid til nye dæk.';
        }
        const wear = ctx.tyreWear;
        if (wear) {
          text += ` Ud fra din melding har du cirka ${Math.round(wear.remainingNow)} procent tilbage`;
          text += wear.changeLap !== null ? `, og de holder til omkring omgang ${wear.changeLap}.` : '.';
        } else {
          text += ' Sig til, hvor meget dæk du har tilbage, fx "dækkene har 70 procent", så regner jeg det med i pitplanen.';
        }
      }
      return text;
    }
    case 'best':
      return s.bestLap ? `Din bedste omgang er ${spokenLap(s.bestLap)}.` : 'Du har ikke sat en omgangstid endnu.';
    case 'last': {
      if (!s.lastLap) return 'Du har ikke kørt en hel omgang endnu.';
      const gap = s.bestLap && s.lastLap > s.bestLap + 0.0005 ? ` ${spokenGap(s.lastLap - s.bestLap)} efter din bedste.` : s.bestLap ? ' Det er din bedste.' : '';
      return `Seneste omgang var ${spokenLap(s.lastLap)}.${gap}`;
    }
    case 'average':
      return s.averageLap ? `Dit gennemsnit er ${spokenLap(s.averageLap)} over ${s.lapTimes.length} omgang${s.lapTimes.length === 1 ? '' : 'e'}.` : 'Jeg har ingen omgangstider endnu.';
    case 'delta':
      return deltaAnswer(s);
    case 'position':
      return positionAnswer(f);
    case 'laps':
      return lapsAnswer(f);
    case 'speed': {
      const v = l.useMPH ? s.topSpeedKmh / 1.609344 : s.topSpeedKmh;
      return s.topSpeedKmh > 0 ? `Din topfart er ${comma(v)} ${l.useMPH ? 'miles i timen' : 'kilometer i timen'}.` : 'Jeg har ikke målt nogen fart endnu.';
    }
    case 'time': {
      const m = Math.floor(s.sessionTime / 60);
      return `Du har kørt i ${m} minut${m === 1 ? '' : 'ter'} og ${Math.floor(s.sessionTime % 60)} sekunder.`;
    }
    case 'engine':
      return f.waterTemp > 1 ? `Vandet er ${comma(f.waterTemp)} grader og olien ${comma(f.oilTemp)} grader.` : 'Jeg har ingen motortemperaturer endnu.';
    case 'status': {
      const parts = [positionAnswer(f)];
      if (s.lastLap) parts.push(`Seneste omgang ${spokenLap(s.lastLap)}.`);
      if (s.fuelLapsLeft !== null) parts.push(`Brændstof til ${comma(s.fuelLapsLeft, 1)} omgange.`);
      const hot = f.tyres.filter((t) => t >= l.tyreHot).length;
      parts.push(hot === 1 ? 'Et dæk er for varmt.' : hot ? `${hot} dæk er for varme.` : 'Dækkene er okay.');
      return f.position > 0 ? parts.join(' ') : parts.slice(1).join(' ') || 'Alt ser fint ud.';
    }
    case 'help':
      return 'Du kan spørge hvornår du skal i pit, om brændstof, dæk, din bedste eller seneste omgang, delta, placering, omgange tilbage, topfart eller motoren.';
    default:
      return 'Det forstod jeg ikke. Spørg fx om brændstof, dæk eller din bedste omgang.';
  }
}
