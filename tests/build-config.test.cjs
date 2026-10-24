const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./load.cjs');
const { verify } = require('../scripts/prepare-voice.cjs');
test('Build setup probes empty text and accepts only the expected rejection', async () => {
  const token = 'a'.repeat(64);
  let calls = 0;
  await verify(token, async (url, request) => {
    calls++;
    assert.equal(url, 'https://racedeck.funktion360.dk/api/tts');
    assert.equal(JSON.parse(request.body).text, '');
    assert.equal(request.headers.Authorization, `Bearer ${token}`);
    return Response.json({ error: 'Teksten skal indeholde 1–300 tegn.' }, { status: 400 });
  });
  assert.equal(calls, 1);
  await assert.rejects(verify(token, async () => new Response(null, { status: 503 })), /lukket/);
  await assert.rejects(verify(token, async () => new Response(null, { status: 401 })), /matcher ikke/);
});
test('Dynamic config keeps cloud off without local file and merges IDs with local config', () => {
  const config = { name: 'RaceDeck', extra: { eas: { projectId: 'test-project' }, racedeck: { ttsEnabled: false } } };
  let exists = false;
  const configure = load('app.config.js', { 'node:path': path, 'node:fs': { existsSync: () => exists, readFileSync: () => JSON.stringify({ ttsEnabled: true, ttsToken: 'test-token'.repeat(8), ttsUrl: 'https://racedeck.funktion360.dk/api/tts' }) } }, { __dirname: '/app' });
  assert.equal(configure({ config }).extra.racedeck.ttsEnabled, false);
  exists = true;
  const result = configure({ config });
  assert.equal(result.extra.eas.projectId, 'test-project');
  assert.equal(result.extra.racedeck.ttsEnabled, true);
});
