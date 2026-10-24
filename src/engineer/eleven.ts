// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';

/**
 * ElevenLabs with the user's OWN API key ("bring your own key").
 *
 * The key is stored encrypted on the phone (Keychain / Keystore) and only ever
 * sent to api.elevenlabs.io. There is no RaceDeck server in between, so nobody
 * can run up a bill on RaceDeck's account – each user pays for (or uses the free
 * tier of) their own ElevenLabs account.
 */

const KEY_NAME = 'racedeck.elevenlabs.key';
const API = 'https://api.elevenlabs.io/v1';
export const ELEVEN_MODEL = 'eleven_flash_v2_5'; // fast and supports Danish

let cachedKey: string | null | undefined;

export async function getApiKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  try {
    cachedKey = (await SecureStore.getItemAsync(KEY_NAME)) || null;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

export async function setApiKey(key: string | null): Promise<void> {
  const k = key?.trim() || null;
  if (k) await SecureStore.setItemAsync(KEY_NAME, k);
  else await SecureStore.deleteItemAsync(KEY_NAME);
  cachedKey = k;
}

export interface ElevenVoice {
  id: string;
  name: string;
  /** e.g. "Danish" from the voice's labels, when known */
  language: string | null;
}

/** Lists the voices in the user's ElevenLabs account ("My Voices"). Needs a key with Voices permission. */
export async function listVoices(apiKey: string): Promise<ElevenVoice[]> {
  const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': apiKey } });
  if (res.status === 401) throw new Error('Nøglen blev afvist. Tjek at den er kopieret helt, og at den har adgang til "Voices".');
  if (!res.ok) throw new Error(`ElevenLabs svarede ${res.status}.`);
  const data = (await res.json()) as { voices?: { voice_id: string; name: string; labels?: Record<string, string> }[] };
  return (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    language: v.labels?.language ?? v.labels?.accent ?? null,
  }));
}

/** Tiny stable hash for cache file names. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export class ElevenError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Returns a local file URI with the spoken sentence (MP3). Sentences are cached
 * on the phone, so "Sidste omgang!" only costs characters the first time.
 */
export async function synthesize(text: string, voiceId: string, apiKey: string, speed: number, timeoutMs: number, signal?: AbortSignal): Promise<string> {
  const file = new File(Paths.cache, `tts-${hash(`${voiceId}|${speed.toFixed(2)}|${text}`)}.mp3`);
  if (file.exists) return file.uri;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: ELEVEN_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.8, speed)) },
      }),
    });
    if (!res.ok) {
      const msg =
        res.status === 401 ? 'Nøglen blev afvist af ElevenLabs.'
          : res.status === 402 || res.status === 429 ? 'ElevenLabs-kvoten er brugt op (eller for mange på én gang).'
            : res.status === 404 ? 'Stemmen findes ikke på din konto. Vælg en stemme igen.'
              : `ElevenLabs svarede ${res.status}.`;
      throw new ElevenError(msg, res.status);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    file.write(bytes);
    return file.uri;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** Shared voice uses POST; private speech and access tokens never go in a URL. */
export async function synthesizeShared(text: string, cloud: import('../config').CloudVoiceConfig, variant: 'a' | 'b', speed: number, signal?: AbortSignal): Promise<string> {
  const rate = Math.min(1.2, Math.max(.8, speed));
  // Separate from BYOK cache. An expired/rotated shared token starts a new cache namespace.
  const file = new File(Paths.cache, `shared-${hash(`${cloud.url}|${cloud.token}|${variant}|${rate.toFixed(2)}|${text}`)}.mp3`);
  if (file.exists) return file.uri;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 3000);
  try {
    const response = await fetch(cloud.url, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${cloud.token}`, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, variant, speed: rate }),
    });
    if (!response.ok) throw new ElevenError('Fælles AI-stemme er ikke tilgængelig.', response.status);
    file.write(new Uint8Array(await response.arrayBuffer()));
    return file.uri;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
