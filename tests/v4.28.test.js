// V4.28: which bus you're on. While you ride a bus towards a stop with its countdown showing, the bus
// whose TfL time agrees with your own arrival time on two refreshes is yours; the bus you got on at
// your last stop is known at once. (Tuesday's real rides are in tuesday.test.js.)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, compose } = require('./harness');
const vm = require('vm');

// matchBus on its own (shared/matchBus.js)
const ctx = {}; vm.createContext(ctx); vm.runInContext(compose('/* @include matchBus */'), ctx);
const T0 = Date.UTC(2026, 9, 7, 8, 0, 0);
const at = (min, v, k = '517') => ({ k, v, t: T0 + min * 60000 });

test('the bus nearest your own arrival time is yours, if it\'s within 2½ minutes', () => {
  assert.strictEqual(ctx.matchBus([at(2.5, 'A'), at(20, 'B')], T0 + 2.8 * 60000).v, 'A');
  assert.strictEqual(ctx.matchBus([at(6, 'A'), at(20, 'B')], T0 + 2 * 60000), null, '4 minutes out: none');
});
test('too close to call when another bus is nearly as close', () => {
  assert.strictEqual(ctx.matchBus([at(2, 'A'), at(3.5, 'B')], T0 + 2.7 * 60000), null);
  assert.strictEqual(ctx.matchBus([at(2, 'A'), at(2.2, 'A')], T0 + 2.5 * 60000).v, 'A', 'TfL listing the same bus twice is no rival');
});
test('timetable times and buses already gone never match', () => {
  assert.strictEqual(ctx.matchBus([{ k: '517', t: T0 + 120000 }, Object.assign(at(2, 'A'), { gone: true })], T0 + 120000), null);
});

// Bus Refresh with a ride in progress
const base = (extra) => Object.assign({ BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'D', BusStateStopName: 'Wexley (Stop D)' }, extra);
const bus = (route, min, vehicle) => ({ lineName: route, destinationName: 'Somewhere', timeToStation: Math.round(min * 60), vehicleId: vehicle });
const ridingTo = (etaMin, now) => JSON.stringify({ s: 'heading', stop: 'D', bus: true, eta: now + etaMin * 60000, etaAt: now });
function refresh(g, arrivals, now) {
  const r = run('refresh.js', { globals: g, now, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } });
  const shown = JSON.parse(g.BusStateIslandData).b;
  let match = {}; try { match = JSON.parse(g.BusStateMatch || '{}'); } catch (e) { match = {}; }
  const yours = match.n >= 2 && arrivals.some((a) => a.vehicleId === match.v) ? match.v : null;
  return { buzz: r.busbuzz, yours, shown: shown.map((b) => b.v), labels: shown.map((b) => b.d) };
}

test('two refreshes agreeing: your bus is worked out and left off the island; one isn\'t enough', () => {
  const g = base(); let now = T0;
  g.BusStateTrip = ridingTo(2.6, now);
  assert.strictEqual(refresh(g, [bus('517', 2.5, 'YY1'), bus('566', 8.7, 'LF1')], now).yours, null);
  now += 40000; g.BusStateTrip = ridingTo(1.9, now);
  const r = refresh(g, [bus('517', 1.8, 'YY1'), bus('566', 8, 'LF1')], now);
  assert.strictEqual(r.yours, 'YY1');
  assert.deepStrictEqual(r.shown, ['LF1'], 'only the connection (4.30)');
  assert.match(JSON.parse(g.BusStateMatch).note, /^on the 517 \(YY1\), at Wexley \(Stop D\) in about 2 min; then the 566 6 min after you get there$/);
});

test('if your bus is the only one listed, it stays on the island as an ordinary bus', () => {
  const g = base({ BusStateBoarded: JSON.stringify({ k: '517', v: 'YY1', stop: 'M', at: T0 - 600000 }), BusStateTrip: ridingTo(2, T0) });
  const r = refresh(g, [bus('517', 2, 'YY1')], T0);
  assert.deepStrictEqual([r.shown, r.labels], [['YY1'], ['Somewhere']]);
  assert.strictEqual(r.buzz, 'no', 'and still never buzzes');
});

test('the bus you got on at your last stop is yours straight away', () => {
  const g = base({ BusStateBoarded: JSON.stringify({ k: '517', v: 'YY1', stop: 'M', at: T0 - 20 * 60000 }), BusStateTrip: ridingTo(3, T0) });
  assert.strictEqual(refresh(g, [bus('566', 2.9, 'LF1'), bus('517', 3.2, 'YY1')], T0).yours, 'YY1', 'even with another bus nearer your time');
});

test('riding, once your bus is known: a connection under 5 minutes buzzes; your bus, and one due before it, never do', () => {
  const g = base({ BusStateBoarded: JSON.stringify({ k: '517', v: 'YY1', stop: 'M', at: T0 - 600000 }), BusStateTrip: ridingTo(2, T0) });
  assert.strictEqual(refresh(g, [bus('566', 1, 'LF0'), bus('517', 2, 'YY1'), bus('566', 9, 'LF1')], T0).buzz, 'no');
  g.BusStateTrip = ridingTo(1.5, T0 + 45000);
  assert.strictEqual(refresh(g, [bus('517', 1.5, 'YY1'), bus('566', 4.5, 'LF1')], T0 + 45000).buzz, 'yes', 'the 566, 3 minutes after you get there');
});

test('riding, before your bus is known: no buzz at all', () => {
  const g = base({ BusStateTrip: ridingTo(2.5, T0) });
  assert.strictEqual(refresh(g, [bus('517', 2.5, 'YY1'), bus('566', 4, 'LF1')], T0).buzz, 'no');
});

test('not riding (waiting at the stop): no match is kept', () => {
  const g = base({ BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'D' }), BusStateMatch: JSON.stringify({ stop: 'D', v: 'YY1', n: 3 }) });
  assert.strictEqual(refresh(g, [bus('517', 2, 'YY1')], T0).yours, null);
  assert.strictEqual(g.BusStateMatch, '');
});

test('a bus that drops off the list is remembered as gone for 5 minutes, for telling which one you got on', () => {
  const g = base({ BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'D' }) });
  refresh(g, [bus('566', 1, 'LF1'), bus('566', 12, 'LF2')], T0);
  refresh(g, [bus('566', 11, 'LF2')], T0 + 60000);
  const seen = JSON.parse(g.BusStateSeen).b;
  assert.deepStrictEqual(seen.map((x) => [x.v, !!x.gone]), [['LF2', false], ['LF1', true]]);
  refresh(g, [bus('566', 5, 'LF2')], T0 + 7 * 60000);
  assert.deepStrictEqual(JSON.parse(g.BusStateSeen).b.map((x) => x.v), ['LF2']);
});

test('the island never highlights a bus (4.29)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  assert.doesNotMatch(src, /\.mine|' mine'/);
});
