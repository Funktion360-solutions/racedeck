// RaceDeck · Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.
import Constants from 'expo-constants';
interface RaceDeckExtra { ttsEnabled?: boolean; ttsUrl?: string; ttsToken?: string }
const extra = ((Constants.expoConfig?.extra ?? {}) as { racedeck?: RaceDeckExtra }).racedeck ?? {};
export interface CloudVoiceConfig { url: string; token: string }
function config(): CloudVoiceConfig | null {
  if (extra.ttsEnabled !== true || !extra.ttsUrl || !extra.ttsToken || extra.ttsToken.length < 32) return null;
  try {
    const url = new URL(extra.ttsUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.hostname.includes('DIN-VERCEL')) return null;
    return { url: url.href, token: extra.ttsToken };
  } catch { return null; }
}
export const cloudVoice = config();
