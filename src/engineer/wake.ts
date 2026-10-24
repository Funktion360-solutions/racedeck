// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { Platform } from 'react-native';
import { Recognizer, Subscription, load } from './listen';

/**
 * Hands-free: the phone listens all the time while drive mode is open, and when
 * you say "Mads" the race engineer answers – "Mads, hvornår skal jeg i pit?".
 * Saying just "Mads" makes him answer "Ja?" and listen for the question.
 *
 * Uses the phone's own Danish speech recognition (free). It pauses while Mads
 * is talking, so he doesn't hear himself.
 */

/** Ways the recogniser may write the name. */
const NAME = /\b(mads|mats|madds|mad's|matz|maz)\b[\s,.!?:-]*/i;

/** "Mads, hvad er min bedste omgang" → { called: true, question: "hvad er min bedste omgang" } */
export function parseWake(text: string): { called: boolean; question: string } {
  const m = NAME.exec(text);
  if (!m) return { called: false, question: '' };
  const question = text.slice(m.index + m[0].length).trim().replace(/^[,.!?\s]+/, '');
  return { called: true, question };
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

export interface WakeEvents {
  onListeningChange?: (listening: boolean) => void;
  /** "Mads" heard with nothing after it: say "Ja?" */
  onCalled: () => void;
  /** A question for Mads. */
  onQuestion: (question: string) => void;
  /** What is being heard after the name (for the caption). */
  onHearing: (text: string | null) => void;
  /** Permission refused / not available. */
  onError: (message: string) => void;
}

export class WakeListener {
  private rec: Recognizer | null = null;
  private subs: Subscription[] = [];
  private running = false; // wanted on
  private paused = false; // the engineer is talking
  private active = false; // a recognition session is running
  private awaitingQuestion = 0; // until this time, the next sentence is the question
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private epoch = 0;

  constructor(private events: WakeEvents) {}

  get available() {
    return load() !== null;
  }

  async start() {
    if (this.running) return;
    this.rec = load();
    if (!this.rec) return;
    const epoch = ++this.epoch;
    try {
      const p = await this.rec.requestPermissionsAsync();
      if (epoch !== this.epoch) return;
      if (!p.granted) {
        this.events.onError('RaceDeck har ikke adgang til mikrofon og talegenkendelse. Slå det til i telefonens indstillinger.');
        return;
      }
      if (!this.rec.supportsOnDeviceRecognition?.()) {
        this.events.onError('Lokal talegenkendelse er ikke tilgængelig. Brug spørgsmålsknapperne.');
        return;
      }
    } catch {
      if (epoch === this.epoch) this.events.onError('Lokal talegenkendelse kunne ikke startes. Brug spørgsmålsknapperne.');
      return;
    }
    this.running = true;
    this.session();
  }

  stop() {
    this.epoch++;
    this.running = false;
    this.awaitingQuestion = 0;
    this.events.onHearing(null);
    this.halt();
  }

  /** Pause while the engineer talks (or while push-to-talk is used). */
  pause(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) this.halt();
    else if (this.running) this.schedule(400);
  }

  private halt() {
    this.events.onListeningChange?.(false);
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    if (this.active) {
      try {
        if (this.rec?.abort) this.rec.abort();
        else this.rec?.stop();
      } catch {
        // already stopped
      }
    }
    this.active = false;
  }

  private schedule(ms: number) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.session();
    }, ms);
  }

  private session() {
    const rec = this.rec;
    if (!rec || !this.running || this.paused || this.active) return;
    this.active = true;
    const done = () => {
      if (!this.active) return;
      this.subs.forEach((s) => s.remove());
      this.subs = [];
      this.active = false;
      this.events.onListeningChange?.(false);
      if (this.running && !this.paused) this.schedule(250); // keep listening
    };
    this.subs.push(
      rec.addListener('result', (ev) => {
        const text = ev.results?.[0]?.transcript ?? '';
        if (!text) return;
        const waiting = Date.now() < this.awaitingQuestion;
        const { called, question } = parseWake(text);
        if (called) this.events.onHearing(question || '…');
        else if (waiting) this.events.onHearing(text);
        if (!ev.isFinal) return; // wait for the end of the sentence
        if (called && wordCount(question) >= 2) {
          this.awaitingQuestion = 0;
          this.events.onHearing(null);
          this.events.onQuestion(question);
        } else if (called) {
          this.awaitingQuestion = Date.now() + 8000;
          this.events.onCalled();
        } else if (waiting && wordCount(text) >= 1) {
          this.awaitingQuestion = 0;
          this.events.onHearing(null);
          this.events.onQuestion(text);
        }
      }),
      rec.addListener('error', (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          this.running = false;
          this.events.onError('Talegenkendelse er ikke tilladt. Slå den til i telefonens indstillinger.');
        }
        else if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
          this.running = false;
          this.events.onError('Talegenkendelse stoppede. Brug mikrofonknappen eller spørgsmålsknapperne.');
        }
        done();
      }),
      rec.addListener('end', done),
    );
    try {
      rec.start({
        lang: 'da-DK',
        interimResults: true,
        // iOS: one sentence per session, a new one starts straight after. Android 13+: one long
        // session (no beep between sentences).
        continuous: Platform.OS === 'android',
        requiresOnDeviceRecognition: true, // Never fall back to server speech recognition.
        addsPunctuation: false,
        contextualStrings: ['Mads', 'pit', 'brændstof', 'dæk', 'delta', 'omgang', 'bedste omgang', 'box'],
        iosTaskHint: 'confirmation',
        iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'], mode: 'default' },
        androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1200 },
      });
      if (this.active) this.events.onListeningChange?.(true);
    } catch {
      this.running = false;
      done();
      this.events.onError('Lokal talegenkendelse kunne ikke startes.');
    }
  }
}
