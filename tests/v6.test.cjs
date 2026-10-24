const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
const data = load('src/telemetry/trackdata.ts');
const tracks = load('src/telemetry/tracks.ts', { './trackdata': data });
const frame = load('src/telemetry/frame.ts');
const { RaceTracker } = load('src/telemetry/tracker.ts', { './tracks': tracks, './frame': frame });
const circle = Array.from({ length: 300 }, (_, i) => [100000 + 1000 * Math.cos(i * Math.PI / 150), 100000 + 1000 * Math.sin(i * Math.PI / 150)]);

test('Built-in maps have usable geometry and saved maps reject corrupt coordinates', () => {
  assert.equal(tracks.BUILT_IN.length, 84);
  for (const track of tracks.BUILT_IN) {
    assert.ok(track.points.length > 10);
    assert.ok(track.length > 0);
    assert.ok(track.points.every(p => p.every(Number.isFinite)));
  }
  const saved = tracks.makeTrack(circle, 1);
  assert.equal(tracks.isSavedTrack(saved), true);
  for (const invalid of [null, {}, { ...saved, length: NaN }, { ...saved, points: [[1, null], ...circle] }, { ...saved, box: [0, 0, 1, 1] }]) assert.equal(tracks.isSavedTrack(invalid), false);
});
test('Track matching needs enough driving, rejects remote paths and detects reverse direction', () => {
  const known = tracks.makeTrack(circle, 1);
  assert.equal(tracks.matchTracks(circle.slice(0, 10), [known]).length, 0);
  assert.equal(tracks.matchTracks(circle.map(([x,z]) => [x + 10000, z]), [known]).length, 0);
  assert.equal(tracks.matchTracks(circle.slice(0, 80), [known])[0].reverse, false);
  assert.equal(tracks.matchTracks(circle.slice(0, 80).reverse(), [known])[0].reverse, true);
});
test('Saved map library deduplicates maps, limits size and survives session reset', () => {
  const one = tracks.addTrack([], circle, 1, []);
  assert.equal(tracks.addTrack(one, circle, 2, []), one);
  const many = Array.from({length: 65}, (_, i) => tracks.makeTrack(circle.map(([x,z]) => [x + i * 10000, z]), i + 1));
  assert.equal(tracks.addTrack(many, circle.map(([x,z]) => [x + 999999, z]), 999, []).length, 60);
  const tracker = new RaceTracker();
  tracker.library = one;
  const callback = () => {};
  tracker.onTrackDrawn = callback;
  tracker.reset();
  assert.equal(tracker.library, one);
  assert.equal(tracker.onTrackDrawn, callback);
  assert.equal(tracker.stats.trackName, null);
});
function drive(tracker, count, fuelDrop) {
  for (let i=0; i<count; i++) {
    const [x,z] = circle[i % circle.length];
    tracker.ingest({ ...frame.emptyFrame(), flags: frame.Flag.onTrack, tick: i * 6, lap: 1, totalLaps: 10, speedMS: 200, fuelCapacity: 100, fuelLevel: 100-i*fuelDrop, x, z, carCode: 1 });
  }
}
test('Recognised map enables a marked fuel estimate before a whole lap; refuel clears it', () => {
  const tracker = new RaceTracker();
  tracker.library = [tracks.makeTrack(circle, 1)];
  drive(tracker, 100, .01);
  assert.equal(tracker.stats.trackKnown, true);
  assert.equal(tracker.stats.fuelEstimated, true);
  assert.ok(tracker.stats.fuelLapsLeft > 0);
  assert.equal(tracker.stats.lapTimes.length, 0);
  tracker.ingest({ ...frame.emptyFrame(), flags: frame.Flag.onTrack, tick: 600, lap: 1, fuelCapacity: 100, fuelLevel: 100, carCode: 1 });
  assert.equal(tracker.stats.fuelEstimated, false);
  assert.equal(tracker.stats.fuelLapsLeft, null);
});
test('Unchanged fuel stays unknown rather than claiming unlimited remaining laps', () => {
  const tracker = new RaceTracker();
  tracker.library = [tracks.makeTrack(circle, 1)];
  drive(tracker, 100, 0);
  assert.equal(tracker.stats.fuelUnchanged, true);
  assert.equal(tracker.stats.fuelLapsLeft, null);
});
test('Pit guidance identifies preliminary fuel estimates', () => {
  const { pitPlan } = load('src/engineer/pit.ts');
  const f = { lap: 1, totalLaps: 10, fuelLevel: 50, fuelCapacity: 100 };
  const options = { reserveLaps: .3, tyreStintLaps: 0, stintStartLap: 1 };
  const stats = { fuelPerLap: 10, fuelLapsLeft: 5, fuelEstimated: true };
  assert.match(pitPlan(f, stats, options).text, /^Foreløbigt brændstofskøn:/);
  assert.doesNotMatch(pitPlan(f, { ...stats, fuelEstimated: false }, options).text, /^Foreløbigt/);
});
function wakeSetup({ supported = true, permission = Promise.resolve({granted:true}) } = {}) {
  const listeners = new Map(); const starts = []; const errors = []; const questions = []; const called = [];
  let aborts = 0;
  const recognizer = {
    requestPermissionsAsync: () => permission, supportsOnDeviceRecognition: () => supported,
    addListener: (event, fn) => { listeners.set(event, fn); return { remove() { if(listeners.get(event) === fn) listeners.delete(event); } }; },
    start: opts => starts.push(opts), abort: () => { aborts++; },
  };
  const { WakeListener, parseWake } = load('src/engineer/wake.ts', { 'react-native': { Platform: { OS:'ios' } }, './listen': { load: () => recognizer } });
  const w = new WakeListener({ onCalled: () => called.push(true), onQuestion: q => questions.push(q), onHearing() {}, onError: e => errors.push(e) });
  return { w, starts, errors, questions, called, listeners, parseWake, get aborts() {return aborts;} };
}
test('Hands-free ignores ordinary speech and routes only final questions after the name', async () => {
  const x = wakeSetup(); await x.w.start();
  assert.equal(x.starts[0].requiresOnDeviceRecognition, true);
  x.listeners.get('result')({ results: [{transcript:'hvornår skal jeg i pit'}], isFinal:true });
  assert.equal(x.questions.length, 0);
  x.listeners.get('result')({ results: [{transcript:'Mads, hvornår skal jeg i pit?'}], isFinal:false });
  assert.equal(x.questions.length, 0);
  x.listeners.get('result')({ results: [{transcript:'Mads, hvornår skal jeg i pit?'}], isFinal:true });
  assert.equal(x.questions[0], 'hvornår skal jeg i pit?');
  x.w.stop(); assert.equal(x.listeners.size, 0);
});
test('Saying Mads alone acknowledges and accepts a follow-up question', async () => {
  const x = wakeSetup(); await x.w.start();
  x.listeners.get('result')({ results: [{transcript:'Mads'}], isFinal:true });
  assert.equal(x.called.length, 1);
  x.listeners.get('result')({ results: [{transcript:'hvad er min bedste omgang'}], isFinal:true });
  assert.equal(x.questions[0], 'hvad er min bedste omgang');
  x.w.stop();
});
test('Stopping during a permission dialog cannot start microphone later', async () => {
  let finish;
  const x = wakeSetup({permission:new Promise(r => {finish = r;})});
  const pending = x.w.start(); x.w.stop(); finish({granted:true}); await pending;
  assert.equal(x.starts.length, 0);
});
test('Hands-free refuses cloud recognition, pauses for speech, and cancels restarts on stop', async () => {
  const unavailable = wakeSetup({supported:false}); await unavailable.w.start();
  assert.equal(unavailable.starts.length, 0); assert.equal(unavailable.errors.length, 1);
  const x = wakeSetup(); x.w.pause(true); await x.w.start(); assert.equal(x.starts.length, 0);
  x.w.pause(false); x.w.stop(); await new Promise(r => setTimeout(r, 450));
  assert.equal(x.starts.length, 0);
});

test('Demo retains lap statistics without trying to identify synthetic coordinates as a real track', () => {
  const { DemoDriver } = load('src/telemetry/demo.ts', { './frame': frame });
  const tracker = new RaceTracker(); tracker.recognizeTracks = false;
  const demo = new DemoDriver();
  for(let i=0; i<15000; i++) tracker.ingest(demo.next());
  assert.ok(tracker.stats.lapTimes.length > 0);
  assert.equal(tracker.stats.trackKnown, false);
  tracker.reset(); assert.equal(tracker.recognizeTracks, false);
});
test('Forgetting saved maps during startup cannot restore them from a late storage read', async () => {
  let finishRead; const writes = [];
  const storage = { getItem: () => new Promise(r => {finishRead = r;}), setItem: async (k,v) => {writes.push(JSON.parse(v));} };
  const { hub } = load('src/telemetry/hub.ts', {
    '@react-native-async-storage/async-storage': storage,
    'react': {}, './demo': {DemoDriver:class {}}, './frame':frame,
    './tracker':{RaceTracker,emptyStats:load('src/telemetry/tracker.ts',{'./tracks':tracks,'./frame':frame}).emptyStats},
    './tracks':tracks, './udp':{}, '../engineer':{engineer:{reset(){}}},
  });
  hub.forgetTracks(); finishRead(JSON.stringify([tracks.makeTrack(circle, 1)]));
  await new Promise(r => setImmediate(r));
  assert.equal(hub.savedTracks, 0); assert.equal(writes[0].length, 0);
});
test('Voice busy state pauses hands-free immediately and releases it on stop', async () => {
  const { voice } = load('src/engineer/voice.ts', {
    'expo-audio': {},
    'expo-speech': {stop(){},getAvailableVoicesAsync:async()=>[],speak(){}},
    './eleven':{},
  });
  const states = []; const off = voice.onBusyChange(x=>states.push(x));
  voice.test('Radiotjek.'); voice.stop(); off();
  assert.deepEqual(states, [false,true,false]);
});
test('Shared track geometry cannot supply an arbitrary lap length for fuel estimates', () => {
  const tracker = new RaceTracker();
  const a = tracks.makeTrack(circle, 1);
  const b = { ...tracks.makeTrack(circle, 2), name: 'Alternative layout', length: a.length * 2 };
  tracker.library = [{...a,name:'First layout'}, b];
  drive(tracker, 100, .01);
  assert.equal(tracker.stats.trackKnown, true);
  assert.match(tracker.stats.trackName, /^Mulig bane:/);
  assert.equal(tracker.stats.trackLength, null);
  assert.equal(tracker.stats.fuelEstimated, false);
  assert.equal(tracker.stats.fuelLapsLeft, null);
});
test('Denied microphone permission never starts recognition', async () => {
  const x = wakeSetup({ permission:Promise.resolve({granted:false}) });
  await x.w.start();
  assert.equal(x.starts.length, 0);
  assert.equal(x.errors.length, 1);
  x.w.stop();
});
