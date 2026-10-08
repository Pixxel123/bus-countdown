// V4.36: walking briskly away from a stop no longer reads as passing it on a bus. On Wednesday evening
// (positions here are stand-ins, the distances, accuracies and speeds are the phone's), walking away
// from the stop the heads-up showed at about 7 km/h, one fix jumped 88 m in 20 s (±29 m, then ±45 m),
// which Bus Watch read as 4.4 m/s, and Android then gave one reading of 15 km/h. Two fast readings out
// of three made it "passed Corvel Lodge (opp) on a bus", and the trip stayed "on a bus" while you
// walked on.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

const T0 = Date.UTC(2026, 9, 7, 16, 17, 3);
const LAT = 51.33, LON = -0.31;
const world = () => ({
  BusPlaces: `bus|M|Corvel Lodge (opp)|${LAT}|${LON}|70`, BusRoutes: '517,566', BusRadius: '300', BusNearRadius: '70',
  BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'M', BusStateStopName: 'Corvel Lodge (opp)',
  BusStateTrip: JSON.stringify({ s: 'heading', stop: 'M', since: T0 - 60000, minD: 112 }),
});
// [seconds from 17:17:03, metres from the stop, accuracy ±m, Android's speed in m/s or null]. The fix at
// 66 s is 263 m out: averaged with the ±104 m one before it, that's the 247 m Bus Status showed.
const WALK = [[0, 112, 12, null], [11, 116, 26, 1.94], [33, 163, 22, 1.94], [46, 159, 29, null], [54, 158, 104, null],
  [66, 263, 45, null], [124, 329, 33, 4.3], [146, 329, 59, null], [167, 380, 29, null], [204, 423, 25, 1.94]];
function check(g, [s, d, acc, spd]) {
  const now = T0 + s * 1000;
  const locals = { buscaller: 'profile=moved', gl_latitude: String(LAT + m(d)), gl_longitude: String(LON), gl_time_seconds: String(now / 1000), busacc: String(acc) };
  if (spd !== null) locals.busspeed = String(spd);
  const r = run('watch.js', { globals: g, now, locals });
  return { state: JSON.parse(g.BusStateTrip).s, action: r.busaction, why: r.why || '' };
}

test('walking away from the stop at 7 km/h, with one jumpy fix and one high Android reading: you turned away, not on a bus', () => {
  const g = world(); const out = WALK.map((p) => check(g, p));
  const ended = out.find((o) => o.action === 'stop');
  assert.ok(ended, 'the countdown still ends: you walked away from that stop');
  assert.doesNotMatch(ended.why, /on a bus|passed/, ended.why);
  assert.ok(out.every((o) => o.state !== 'onbus'), 'never "on a bus": ' + out.map((o) => o.state).join(', '));
  assert.ok(!(parseInt(g.BusStateLastBusAt, 10) > 0), 'and no bus noted, so stops by home and work still pop up');
});

test('the jumpy fix is not read as bus speed: allowing for its accuracy, it could have been walking', () => {
  const g = world(); WALK.slice(0, 6).forEach((p) => check(g, p));
  const win = JSON.parse(g.BusStateWindow);
  assert.strictEqual(win[win.length - 1].spd, 4.2, 'held at 4.2 m/s: neither a bus nor walking');
});

test('a bus really passing the stop is still seen: two fast readings in a row, with good fixes', () => {
  const g = world();
  // Riding past at 8 m/s, a fix every 15 s, ±10 m, no reading from Android
  const ride = [[0, 112, 10, null], [15, 232, 10, null], [30, 352, 10, null], [45, 472, 10, null]];
  const out = ride.map((p) => check(g, p));
  assert.ok(out.some((o) => o.state === 'onbus'), out.map((o) => o.state + ' ' + o.why).join(' | '));
});

test('a bus pulling away from the stop you were waiting at is seen as soon as before, with ordinary fixes', () => {
  const g = world(); g.BusStateTrip = JSON.stringify({ s: 'atstop', stop: 'M', since: T0 - 120000, minD: 5 });
  // 6 m/s, a fix every 10 s, ±12 m
  const ride = [0, 1, 2].map((i) => [i * 10, 5 + i * 60, 12, null]);
  const out = ride.map((p) => check(g, p));
  assert.deepStrictEqual(out.map((o) => o.state), ['atstop', 'atstop', 'onbus']);
});
