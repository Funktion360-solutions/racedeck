// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import * as Speech from 'expo-speech';
import type { Message } from './brain';

/**
 * Speaks the engineer's messages in Danish with the phone's own voice.
 * - One message at a time, most important first.
 * - Urgent messages (priority 3) interrupt whatever is being said.
 * - Messages that waited more than 6 s are dropped – old news is worse than silence.
 */

export const LANGUAGE = 'da-DK';

export interface VoiceInfo {
  identifier: string;
  name: string;
  enhanced: boolean;
}

let danishVoice: VoiceInfo | null | undefined; // undefined = not looked up yet

/** Finds the best Danish voice installed on the phone (prefers enhanced/premium quality). */
export async function findDanishVoice(): Promise<VoiceInfo | null> {
  if (danishVoice !== undefined) return danishVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const danish = voices.filter((v) => (v.language ?? '').toLowerCase().replace('_', '-').startsWith('da'));
    danish.sort((a, b) => Number(b.quality === 'Enhanced') - Number(a.quality === 'Enhanced'));
    const v = danish[0];
    danishVoice = v ? { identifier: v.identifier, name: v.name, enhanced: v.quality === 'Enhanced' } : null;
  } catch {
    danishVoice = null;
  }
  return danishVoice;
}

class Voice {
  private queue: Message[] = [];
  private speaking = false;
  private rate = 1;
  private generation = 0; // ignores callbacks from utterances that were stopped

  setRate(rate: number) {
    this.rate = rate;
  }

  say(m: Message) {
    // Never queue two messages about the same thing.
    this.queue = this.queue.filter((q) => q.category !== m.category);
    if (m.priority === 3 && this.speaking) {
      this.queue = [m, ...this.queue];
      this.generation++;
      Speech.stop();
      this.next();
      return;
    }
    this.queue.push(m);
    if (this.queue.length > 3) {
      this.queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
      this.queue = this.queue.slice(0, 3);
    }
    if (!this.speaking) this.next();
  }

  /** Speaks right away, ignoring the queue (used by "Test stemme"). */
  test(text: string) {
    this.queue = [];
    this.generation++;
    Speech.stop();
    this.speaking = false;
    this.speak(text);
  }

  stop() {
    this.queue = [];
    this.generation++;
    Speech.stop();
    this.speaking = false;
  }

  private next() {
    this.speaking = false;
    const now = Date.now();
    this.queue = this.queue.filter((m) => now - m.at < 6000);
    if (!this.queue.length) return;
    this.queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
    const m = this.queue.shift() as Message;
    this.speak(m.text);
  }

  private speak(text: string) {
    this.speaking = true;
    const id = ++this.generation;
    const done = () => {
      if (id === this.generation) setTimeout(() => id === this.generation && this.next(), 350); // a short breath
    };
    findDanishVoice()
      .catch(() => null)
      .then((voice) => {
        if (id !== this.generation) return; // stopped while we looked up the voice
        Speech.speak(text, {
          language: LANGUAGE,
          voice: voice?.identifier,
          rate: this.rate,
          pitch: 1,
          onDone: done,
          onStopped: done,
          onError: done,
        });
      });
  }
}

export const voice = new Voice();
