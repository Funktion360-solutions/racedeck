// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { isExpoGo } from '../telemetry/udp';

/**
 * Push-to-talk: listens for one Danish question with the phone's own speech
 * recognition (free). Needs the native module `expo-speech-recognition`, which
 * is not part of Expo Go – there the quick-question buttons are used instead.
 */

export interface Subscription {
  remove(): void;
}

export interface Recognizer {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  start(options: object): void;
  stop(): void;
  supportsOnDeviceRecognition?(): boolean;
  abort?(): void;
  addListener(event: string, listener: (ev: { results?: { transcript?: string }[]; isFinal?: boolean; error?: string }) => void): Subscription;
}

export function load(): Recognizer | null {
  if (isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition');
    return (mod?.ExpoSpeechRecognitionModule as Recognizer) ?? null;
  } catch {
    return null;
  }
}

export const canListen = () => load() !== null;

/** Listens for one question (max 7 s). Resolves with what was said, or null. */
export async function listenOnce(onPartial: (text: string) => void): Promise<string | null> {
  const rec = load();
  if (!rec) return null;
  const permission = await rec.requestPermissionsAsync();
  if (!permission.granted) throw new Error('RaceDeck har ikke adgang til mikrofon og talegenkendelse. Slå det til under telefonens indstillinger.');

  return new Promise((resolve) => {
    let heard = '';
    let settled = false;
    const subs: Subscription[] = [];
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subs.forEach((s) => s.remove());
      try {
        rec.stop();
      } catch {
        // already stopped
      }
      resolve(heard.trim() || null);
    };
    const timer = setTimeout(finish, 7000);
    subs.push(
      rec.addListener('result', (ev) => {
        const text = ev.results?.[0]?.transcript ?? '';
        if (text) {
          heard = text;
          onPartial(text);
        }
        if (ev.isFinal) finish();
      }),
      rec.addListener('error', finish),
      rec.addListener('end', finish),
    );
    try { rec.start({
      lang: 'da-DK',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      // Keep the engineer's voice on the loudspeaker/headphones after listening.
      iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth'], mode: 'default' },
    }); } catch { finish(); }
  });
}

export function stopListening() {
  try {
    load()?.stop();
  } catch {
    // nothing to stop
  }
}
