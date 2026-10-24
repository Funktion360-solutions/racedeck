const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
const llm = load('src/engineer/llm.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('AI wording rejects reversed meaning and lost negative signs', () => {
  for (const [original, rewrite] of [
    ['3 tiendedele foran.', '3 tiendedele bagud.'],
    ['Fordækkene er for varme.', 'Bagdækkene er for kolde.'],
    ['Delta -0,3 sekunder.', 'Delta 0,3 sekunder.'],
  ]) assert.equal(llm.isSafeRewrite(original, rewrite), false);
  assert.equal(llm.isSafeRewrite('Sidste omgang!', 'Nu er det sidste omgang!'), true);
});
test('Ollama can select a known sentence but cannot supply a new one', async () => {
  let reply = '{"choice":1}';
  const api = load('src/engineer/llm.ts', {}, { fetch: async () => Response.json({ message: { content: reply } }) });
  const settings = { enabled: true, host: '192.168.1.2', model: 'test' };
  assert.equal(await api.rephrase(settings, 'Sidste omgang!', {}), 'Nu er det sidste omgang!');
  reply = '{"choice":999,"text":"Du fører!"}';
  assert.equal(await api.rephrase(settings, 'Sidste omgang!', {}), null);
});
test('Free questions produce replies only from validated structured data', () => {
  assert.equal(llm.answerForTopic('delta', { delta_sekunder: -.3 }), 'Du er 0,30 sekunder foran din bedste omgang.');
  assert.equal(llm.answerForTopic('delta', { delta_sekunder: .3 }), 'Du er 0,30 sekunder bagud din bedste omgang.');
  assert.match(llm.answerForTopic('laps', { bedste_omgang: NaN }), /ikke nok data/);
  assert.match(llm.answerForTopic('unknown', {}), /ikke nok data/);
});
for (const action of ['leave', 'mute', 'reset', 'hush']) test(`Pending AI rewrite is dropped after ${action}`, async () => {
  let resolve;
  const spoken = [];
  const voice = { configure() {}, setRate() {}, stop() {}, say(m) { spoken.push(m); }, test() {} };
  class Brain { observe() { return [{ text: 'Sidste omgang!', priority: 1, category: 'race', at: Date.now() }]; } reset() {} }
  const { engineer } = load('src/engineer/index.ts', {
    '../config': { cloudVoice: null }, './answers': {}, './brain': { EngineerBrain: Brain, defaultEngineer: { enabled: true } },
    './llm': { defaultOllama: {}, rephrase: () => new Promise(r => { resolve = r; }), warmUp: async () => ({ ok: true }) },
    './pit': {}, './tyres': {}, './voice': { voice },
  });
  engineer.configure({ enabled: true, rate: 1 }, {});
  engineer.configureAi({ ollama: { enabled: true }, voice: 'device' });
  engineer.setActive(true);
  engineer.observe({ tyres: [70, 70, 70, 70] }, {});
  if (action === 'leave') engineer.setActive(false);
  if (action === 'mute') engineer.configure({ enabled: false, rate: 1 }, {});
  if (action === 'reset') engineer.reset();
  if (action === 'hush') engineer.hush();
  resolve('Nu er det sidste omgang!');
  await flush();
  assert.equal(spoken.length, 0);
});
test('Stopped cloud voice never plays a late download', async () => {
  let finish;
  let played = 0;
  const { voice } = load('src/engineer/voice.ts', {
    'expo-audio': { createAudioPlayer() { played++; throw new Error('should not play'); } },
    'expo-speech': { stop() {}, getAvailableVoicesAsync: async () => [], speak() { played++; } },
    './eleven': { getApiKey: async () => null, synthesizeShared: () => new Promise(r => { finish = r; }) },
  });
  voice.configure({ engine: 'ai', rate: 1, voiceId: '', cloud: { url: 'https://example.com/api/tts', token: 'test' }, variant: 'a' });
  voice.test('Radiotjek.');
  voice.stop();
  finish('file:///late.mp3');
  await flush();
  assert.equal(played, 0);
});
