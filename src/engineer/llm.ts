// RaceDeck · Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.
// Ollama selects approved wording/topics. It never authors authoritative race facts.
export interface OllamaSettings { enabled: boolean; host: string; model: string }
export const defaultOllama: OllamaSettings = { enabled: false, host: '', model: 'qwen2.5:7b' };
const baseUrl = (host: string) => {
  const value = host.trim();
  if (!value) return '';
  try {
    const url = new URL(/^https?:\/\//.test(value) ? value : `http://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return '';
    // Unencrypted model requests are restricted to the local network.
    const local = url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^10\./.test(url.hostname) || /^192\.168\./.test(url.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname) || url.hostname === '127.0.0.1';
    if (url.protocol === 'http:' && !local) return '';
    if (!url.port) url.port = '11434';
    return url.origin;
  } catch { return ''; }
};
async function chat(o: OllamaSettings, system: string, user: string, timeoutMs: number): Promise<string | null> {
  const url = baseUrl(o.host);
  if (!o.enabled || !url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/api/chat`, {
      method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: o.model || defaultOllama.model, stream: false, format: 'json', keep_alive: '30m',
        options: { temperature: 0, num_predict: 60 }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { message?: { content?: string } };
    return data.message?.content ?? null;
  } catch { return null; } finally { clearTimeout(timer); }
}
export const numbersIn = (text: string) => text.match(/[-+−]?\d+(?:[.,]\d+)?/g) ?? [];
export function cleanReply(text: string) { return text.trim(); }
export function approvedRewrites(text: string): string[] {
  const variants = [text];
  if (text.startsWith('Ny bedste omgang! ')) variants.push(text.replace('Ny bedste omgang!', 'Det er din nye bedste omgang!'));
  if (text === 'Dækkene er kolde. Pas på grebet.') variants.push('Dækkene er kolde, så pas på grebet.');
  if (/^Brændstof til \d+(?:,\d+)? omgang(?:e)?\.$/.test(text)) variants.push(`Du har ${text.charAt(0).toLowerCase()}${text.slice(1)}`);
  if (text === 'Sidste omgang!') variants.push('Nu er det sidste omgang!');
  return variants;
}
export function isSafeRewrite(original: string, rewrite: string, _facts = ''): boolean {
  return approvedRewrites(original).includes(rewrite);
}
export async function rephrase(o: OllamaSettings, text: string, facts: Record<string, unknown>, timeoutMs = 1500): Promise<string | null> {
  if (!o.enabled) return null;
  const alternatives = approvedRewrites(text);
  if (alternatives.length < 2) return null;
  const raw = await chat(o, 'Du vælger den mest mundrette danske radiobesked fra en liste. Svar KUN med JSON {"choice": et indeks fra listen}. Ingen ny tekst.', JSON.stringify({ alternatives, facts }), timeoutMs);
  try {
    const choice = JSON.parse(raw ?? '').choice;
    return Number.isInteger(choice) && choice >= 0 && choice < alternatives.length ? alternatives[choice] : null;
  } catch { return null; }
}
const topics = ['fuel', 'tyres', 'laps', 'delta', 'position', 'unknown'] as const;
export type AiTopic = typeof topics[number];
export function answerForTopic(topic: AiTopic, data: Record<string, unknown>): string {
  const numeric = (key: string) => typeof data[key] === 'number' && Number.isFinite(data[key]) ? data[key] as number : null;
  const fmt = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
  if (topic === 'fuel' && typeof data.pitplan === 'string') return data.pitplan;
  if (topic === 'position') { const n = numeric('plads'); if (n !== null && n > 0) return `Du ligger på plads ${Math.round(n)}.`; }
  if (topic === 'delta') { const n = numeric('delta_sekunder'); if (n !== null) return n === 0 ? 'Du er lige på din bedste tid.' : `Du er ${fmt(Math.abs(n), 2)} sekunder ${n < 0 ? 'foran' : 'bagud'} din bedste omgang.`; }
  if (topic === 'laps') { const n = numeric('bedste_omgang'); if (n !== null && n > 0) return `Din bedste omgang er ${fmt(n, 3)} sekunder.`; }
  if (topic === 'tyres') { const values = data.daek_temperatur_vf_hf_vb_hb; if (Array.isArray(values) && values.length === 4 && values.every(v => typeof v === 'number' && Number.isFinite(v))) return `Dæktemperaturerne er ${values.map(v => Math.round(v)).join(', ')} grader: venstre for, højre for, venstre bag og højre bag.`; }
  return 'Det har jeg ikke nok data til at svare på. Spørg om brændstof, dæk, omgangstid, delta eller placering.';
}
export async function askOllama(o: OllamaSettings, question: string, data: Record<string, unknown>, timeoutMs = 8000): Promise<string | null> {
  if (!o.enabled) return null;
  const raw = await chat(o, `Klassificér kørerens spørgsmål. Vælg kun et emne fra ${topics.join(', ')}. Svar KUN JSON {"topic":"emne"}. Ved spørgsmål om bremsepunkter, sektorer, greb eller hvor der tabes tid vælges unknown.`, question.slice(0, 500), timeoutMs);
  try { const topic = JSON.parse(raw ?? '').topic; return topics.includes(topic) ? answerForTopic(topic, data) : null; } catch { return null; }
}
export async function warmUp(o: OllamaSettings): Promise<{ ok: boolean; ms: number; text: string }> {
  const start = Date.now();
  const reply = await chat(o, 'Svar kun med JSON {"ready":true}.', 'Radiotjek', 60000);
  let ok = false;
  try { ok = JSON.parse(reply ?? '').ready === true; } catch { /* invalid response */ }
  return { ok, ms: Date.now() - start, text: ok ? 'Radiotjek. AI-hjernen er klar.' : 'Kunne ikke nå AI-hjernen. Kontrollér adresse, model og adgang på dit lokale netværk.' };
}
