// RaceDeck · Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.
// Closed by default. Enable only after configuring the provider credit cap and
// Vercel access/rate-limit rules. A shared app token is NOT per-user identity.
declare const process: { env: Record<string, string | undefined> };
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers });
}
export function GET() { return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } }); }
export async function POST(request: Request): Promise<Response> {
  const env = process.env;
  if (env.RACEDECK_TTS_ENABLED !== 'true' || env.RACEDECK_TTS_CREDIT_LIMIT_CONFIRMED !== 'true' || env.RACEDECK_TTS_RATE_LIMIT_READY !== 'true') return error(503, 'AI-stemmen er ikke aktiveret.');
  const token = env.RACEDECK_APP_TOKEN;
  if (!token || token.length < 32 || request.headers.get('authorization') !== `Bearer ${token}`) return error(401, 'Manglende eller ugyldig adgang.');
  const key = env.ELEVENLABS_API_KEY;
  const voice = env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return error(503, 'AI-stemmen er ikke konfigureret.');
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return error(415, 'JSON kræves.');
  if (Number(request.headers.get('content-length') ?? 0) > 2048) return error(413, 'For stor besked.');
  let input: { text?: unknown; variant?: unknown; speed?: unknown };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2048) return error(413, 'For stor besked.');
    input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return error(400, 'Ugyldig besked.');
  } catch { return error(400, 'Ugyldig JSON.'); }
  const text = typeof input.text === 'string' ? input.text.replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > 300) return error(400, 'Teksten skal indeholde 1–300 tegn.');
  if (input.variant !== undefined && !['a', 'b'].includes(input.variant as string)) return error(400, 'Ugyldig stemme.');
  if (input.speed !== undefined && (typeof input.speed !== 'number' || !Number.isFinite(input.speed) || input.speed < .8 || input.speed > 1.2)) return error(400, 'Ugyldig hastighed.');
  const voiceId = input.variant === 'b' ? env.ELEVENLABS_VOICE_ID_B || voice : voice;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  const timer = setTimeout(cancel, 8000);
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: 'POST', signal: controller.signal,
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL || 'eleven_flash_v2_5', voice_settings: { stability: .5, similarity_boost: .8, speed: input.speed ?? 1 } }),
    });
    if (!response.ok) {
      console.error('RaceDeck TTS upstream status', response.status);
      return error(response.status === 429 || response.status === 402 ? 429 : 502, 'AI-stemmen er ikke tilgængelig.');
    }
    return new Response(await response.arrayBuffer(), { headers: { ...headers, 'Content-Type': 'audio/mpeg' } });
  } catch {
    console.error('RaceDeck TTS request failed');
    return error(controller.signal.aborted ? 504 : 502, 'AI-stemmen svarede ikke.');
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
