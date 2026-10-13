// V4.60: walking towards a stop inside its circle shows it. A stop with a big circle (Ashenhurst's is
// 200 m) used to wait as "passing by" until you slowed down, however straight you walked to it.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

// Stop S, with a 200 m circle, on a road running north; you walk north towards it from the south
const BASE = 51.37; const LON = -0.28; const T0 = Date.UTC(2026, 9, 13, 7, 14, 0);
const at = (north, east = 0) => [+(BASE + m(north)).toFixed(6), +(LON + east / 69600).toFixed(6)];
// The positions before this one, 20 s apart at `pace` m/s, ending 20 s before T0 at `from`, going north
// (or east, for walking past)
const walked = (from, pace, { east = false, n = 4 } = {}) => JSON.stringify(Array.from({ length: n }, (_, i) => {
  const s = (n - i) * 20; const p = east ? at(from[0], from[1] - pace * (s - 20)) : at(from[0] - pace * (s - 20), from[1]);
  return { t: T0 - s * 1000, lat: p[0], lon: p[1], acc: 12, spd: pace };
}));
function world(extra) {
  return Object.assign({ BusPlaces: `bus|S|Ashenhurst (Stop U)|${BASE}|${LON}|200`, BusNearRadius: '400', BusRoutes: '517',
    BusApproach: 'both', BusApproachMin: '2', BusStateRunning: '0', TRUN: '' }, extra);
}
const check = (g, north, east = 0, { spd = '1.6', t = T0 } = {}) => {
  const r = run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(at(north, east)[0]), gl_longitude: String(at(north, east)[1]),
    gl_time_seconds: String(t / 1000), busspeed: spd, busbearing: '', busacc: '15' } });
  return { why: r.why, action: r.busaction, trip: JSON.parse(g.BusStateTrip || '{}'), mode: g.BusStateStartMode };
};

test('walking straight to a stop, inside its circle: shown now, without waiting to slow down', () => {
  const g = world({ BusStateWindow: walked([-180, 0], 1.6) });
  const r = check(g, -150);
  assert.strictEqual(r.action, 'approach');
  assert.strictEqual(r.trip.s, 'heading');
  assert.strictEqual(r.trip.bus, false);
  assert.match(r.mode, /^approach\|/);
  assert.match(r.why, /heading to Ashenhurst \(Stop U\) \(150 m, about 2 min on foot, getting nearer at 6 km\/h\)/);
});

test('…then reaching it and slowing down is "reached", with nothing to start again', () => {
  const g = world({ BusStateWindow: walked([-180, 0], 1.6) });
  check(g, -150);
  Object.assign(g, { BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'S' });     // the countdown Bus Loop runs
  g.BusStateWindow = JSON.stringify(JSON.parse(g.BusStateWindow).concat([0, 1, 2].map((i) => ({ t: T0 + (60 + i * 20) * 1000, lat: at(-10)[0], lon: LON, acc: 12, spd: 0.1 }))));
  const r = check(g, -10, 0, { spd: '0.1', t: T0 + 120000 });
  assert.strictEqual(r.trip.s, 'atstop');
  assert.strictEqual(r.action, 'none');
  assert.match(r.why, /reached Ashenhurst/);
});

test('walking past it, across its circle 120 m off, still waits until you slow down', () => {
  const g = world({ BusStateWindow: walked([-120, -30], 1.6, { east: true }) });
  const r = check(g, -120, 0);
  assert.strictEqual(r.action, 'none');
  assert.match(r.why, /passing by/);
});

test('too far to be there within the minutes-ahead setting at your pace, or heading for stops off: waits as before', () => {
  assert.match(check(world({ BusStateWindow: walked([-180, 0], 1.6), BusApproachMin: '1' }), -150).why, /passing by/);
  assert.match(check(world({ BusStateWindow: walked([-180, 0], 1.6), BusApproach: 'off' }), -150).why, /passing by/);
});

test('a stop by home: shown as you set off from home, not as you walk home past it', () => {
  // Home 250 m south of the stop (behind you): setting off
  const setOff = world({ BusStateWindow: walked([-180, 0], 1.6), BusHomeAt: JSON.stringify({ lat: at(-250)[0], lon: LON, n: 10 }) });
  assert.strictEqual(check(setOff, -150).action, 'approach');
  // Home 250 m north of the stop (ahead of you, past it): walking home
  const goingHome = world({ BusStateWindow: walked([-180, 0], 1.6), BusHomeAt: JSON.stringify({ lat: at(250)[0], lon: LON, n: 10 }) });
  const r = check(goingHome, -150);
  assert.strictEqual(r.action, 'none');
  assert.match(r.why, /passing by/);
});

test('it needs 45 seconds of positions to know you\'re getting nearer', () => {
  const r = check(world({ BusStateWindow: walked([-180, 0], 1.6, { n: 1 }) }), -150);
  assert.match(r.why, /passing by/);
});
