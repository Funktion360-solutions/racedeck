const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
const token = 'a'.repeat(40);
const base = { RACEDECK_TTS_ENABLED: 'true', RACEDECK_TTS_CREDIT_LIMIT_CONFIRMED: 'true', RACEDECK_TTS_RATE_LIMIT_READY: 'true', RACEDECK_APP_TOKEN: token, ELEVENLABS_API_KEY: 'test-only', ELEVENLABS_VOICE_ID: 'voice-test' };
function setup(env = base) {
  const calls = [];
  const api = load('website/api/tts.ts', {}, { process: { env }, fetch: async (url, options) => { calls.push({ url, options }); return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }); } });
  return { ...api, calls };
}
function request(body, auth = `Bearer ${token}`) { return new Request('https://example.com/api/tts', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
test('TTS is closed by default and GET never generates speech', async () => {
  const api = setup({});
  assert.equal((await api.POST(request({ text: 'Test' }))).status, 503);
  assert.equal(api.GET().status, 405);
  assert.equal(api.calls.length, 0);
});
test('TTS cannot be activated without provider cap and access controls being confirmed', async () => {
  for (const setting of ['RACEDECK_TTS_CREDIT_LIMIT_CONFIRMED', 'RACEDECK_TTS_RATE_LIMIT_READY']) {
    const api = setup({ ...base, [setting]: 'false' });
    assert.equal((await api.POST(request({ text: 'Test' }))).status, 503);
    assert.equal(api.calls.length, 0);
  }
});
test('TTS rejects bad access and invalid inputs before calling provider', async () => {
  const api = setup();
  assert.equal((await api.POST(request({ text: 'Test' }, 'bad'))).status, 401);
  for (const input of [null, { text: '' }, { text: 'x'.repeat(301) }, { text: 'Test', speed: -1 }, { text: 'Test', variant: 'unknown' }]) assert.equal((await api.POST(request(input))).status, 400);
  assert.equal(api.calls.length, 0);
});
test('TTS sends text in POST body and returns private, uncached audio', async () => {
  const api = setup();
  const response = await api.POST(request({ text: 'Radiotjek.', speed: 1, variant: 'a' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].url.includes('Radiotjek'), false);
  assert.equal(JSON.parse(api.calls[0].options.body).text, 'Radiotjek.');
  assert.equal(api.calls[0].options.headers['xi-api-key'], 'test-only');
});

test('Provider errors log only a safe error code and hide provider details', async () => {
  for (const code of ['voice_not_found', 'invalid_model_id', 'secret key with spaces']) {
    const logs = [];
    const api = load('website/api/tts.ts', {}, {
      process: { env: base },
      console: { error: (...args) => logs.push(args) },
      fetch: async () => Response.json({ detail: { status: code, message: 'private provider message' } }, { status: 400 }),
    });
    const response = await api.POST(request({ text: 'Radiotjek.' }));
    assert.equal(response.status, 502);
    assert.deepEqual(logs[0], ['RaceDeck TTS upstream status', 400, 'code', code.includes(' ') ? 'unknown' : code]);
    assert.equal((await response.text()).includes('private provider message'), false);
  }
});
