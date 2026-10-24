// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { createAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import type { CloudVoiceConfig } from '../config';
import type { Message } from './brain';
import { getApiKey, synthesize, synthesizeShared } from './eleven';

/**
 * Speaks the race engineer's messages. For the natural AI voice it tries, in order:
 *
 * 1. The user's OWN ElevenLabs key (stored encrypted on the phone) – then the user
 *    pays for their own use. Sentences are cached on the phone.
 * 2. RaceDeck's shared voice via the Vercel server (the key stays on the server,
 *    RaceDeck pays for usage within its configured provider limits; sentences are cached locally).
 * 3. The phone's built-in Danish voice – when the AI voice is off, offline, slow
 *    (> 3 s) or the monthly quota is used up.
 *
 * One message at a time, most important first. Urgent messages (priority 3)
 * interrupt; messages older than 6 s are dropped – old news is worse than silence.
 */

export const LANGUAGE = 'da-DK';
export type VoiceEngine = 'ai' | 'device';

export interface VoiceInfo {
  identifier: string;
  name: string;
  enhanced: boolean;
}

let danishVoice: VoiceInfo | null | undefined; // undefined = not looked up yet

/** Finds the best Danish phone voice (prefers enhanced/premium quality). */
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

type Player = ReturnType<typeof createAudioPlayer>;

class Voice {
  private queue: Message[] = [];
  private speaking = false;
  private rate = 1;
  private generation = 0; // ignores callbacks from utterances that were stopped
  private engine: VoiceEngine = 'device';
  private voiceId = '';
  private cloud: CloudVoiceConfig | null = null;
  private variant: 'a' | 'b' = 'a';
  /** Last problem with the AI voice, shown in settings. */
  lastError: string | null = null;
  private player: Player | null = null;
  private request: AbortController | null = null;
  private cleanupPlayer: (() => void) | null = null;
  /** After repeated AI-voice failures (offline, no credits) use the phone voice for a while. */
  private cloudFailures = 0;
  private cloudPausedUntil = 0;
  /** Called with every sentence that is spoken (drive mode shows it as a caption). */
  onSpeak: ((text: string) => void) | null = null;

  configure(o: { engine: VoiceEngine; rate: number; voiceId: string; cloud: CloudVoiceConfig | null; variant: 'a' | 'b' }) {
    this.engine = o.engine;
    this.rate = o.rate;
    this.voiceId = o.voiceId;
    this.cloud = o.cloud;
    this.variant = o.variant;
    this.lastError = null;
    this.cloudFailures = 0;
    this.cloudPausedUntil = 0;
  }

  setRate(rate: number) {
    this.rate = rate;
  }

  /** True when the AI voice will be used for the next sentence. */
  get usingAiVoice(): boolean {
    return this.engine === 'ai' && (this.voiceId !== '' || this.cloud !== null) && Date.now() >= this.cloudPausedUntil;
  }

  say(m: Message) {
    // Never queue two messages about the same thing.
    this.queue = this.queue.filter((q) => q.category !== m.category);
    if (m.priority === 3 && this.speaking) {
      this.queue = [m, ...this.queue];
      this.halt();
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

  /** Speaks right away, ignoring the queue (answers and "Test stemme"). */
  test(text: string) {
    this.queue = [];
    this.halt();
    this.speak(text);
  }

  stop() {
    this.queue = [];
    this.halt();
  }

  private halt() {
    this.generation++;
    this.request?.abort();
    this.request = null;
    this.speaking = false;
    Speech.stop();
    this.cleanupPlayer?.();
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
    this.onSpeak?.(text);
    this.speaking = true;
    const id = ++this.generation;
    if (this.usingAiVoice) this.speakCloud(text, id);
    else this.speakDevice(text, id);
  }

  private finished(id: number) {
    if (id === this.generation) setTimeout(() => id === this.generation && this.next(), 300); // a short breath
  }

  private speakDevice(text: string, id: number) {
    findDanishVoice()
      .catch(() => null)
      .then((v) => {
        if (id !== this.generation) return; // stopped while we looked up the voice
        Speech.speak(text, {
          language: LANGUAGE,
          voice: v?.identifier,
          rate: this.rate,
          pitch: 1,
          onDone: () => this.finished(id),
          onStopped: () => this.finished(id),
          onError: () => this.finished(id),
        });
      });
  }

  private speakCloud(text: string, id: number) {
    const request = new AbortController();
    this.request = request;
    (async () => {
      const key = this.voiceId ? await getApiKey() : null;
      if (key) return { uri: await synthesize(text, this.voiceId, key, this.rate, 3000, request.signal), local: true }; // own key
      if (this.cloud) {
        return { uri: await synthesizeShared(text, this.cloud, this.variant, this.rate, request.signal), local: true };
      }
      throw new Error('Ingen AI-stemme sat op. Indsæt din egen ElevenLabs-nøgle under Indstillinger.');
    })()
      .then(({ uri, local }) => {
        if (id !== this.generation) return;
        if (local) {
          this.cloudFailures = 0;
          this.lastError = null;
        }
        this.play(uri, text, id, local ? 2000 : 3000);
      })
      .catch((e: Error) => {
        if (id !== this.generation) return;
        this.lastError = e?.name === 'AbortError' ? 'AI-stemmen var for langsom – telefonens stemme blev brugt.' : e?.message ?? 'AI-stemmen fejlede.';
        this.cloudFailed();
        if (id === this.generation) this.speakDevice(text, id);
      }).finally(() => { if (this.request === request) this.request = null; });
  }

  private play(uri: string, text: string, id: number, startTimeoutMs: number) {
    let player: Player;
    try {
      player = createAudioPlayer({ uri });
    } catch {
      this.speakDevice(text, id);
      return;
    }
    this.player = player;
    let started = false;
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      sub.remove();
      try {
        player.pause();
        player.remove();
      } catch {
        // already released
      }
      if (this.player === player) this.player = null;
      if (this.cleanupPlayer === cleanup) this.cleanupPlayer = null;
    };
    this.cleanupPlayer = cleanup;
    // Not playing within the time limit (offline, server down, quota used up): use the phone voice.
    const safety = setTimeout(() => {
      if (started || id !== this.generation) return;
      cleanup();
      this.cloudFailed();
      if (!this.lastError) this.lastError = 'AI-stemmen svarede ikke (intet net, eller månedens kvote er brugt) – telefonens stemme blev brugt.';
      this.speakDevice(text, id);
    }, startTimeoutMs);
    const sub = player.addListener('playbackStatusUpdate', (status: { playing?: boolean; didJustFinish?: boolean }) => {
      if (status.playing && !started) {
        started = true;
        this.cloudFailures = 0;
        this.lastError = null;
      }
      if (status.didJustFinish) {
        cleanup();
        this.finished(id);
      }
    });
    try { player.play(); } catch { cleanup(); this.cloudFailed(); if (id === this.generation) this.speakDevice(text, id); }
  }

  private cloudFailed() {
    this.cloudFailures++;
    if (this.cloudFailures >= 2) {
      this.cloudPausedUntil = Date.now() + 5 * 60_000; // try the AI voice again in 5 minutes
      this.cloudFailures = 0;
    }
  }
}

export const voice = new Voice();
