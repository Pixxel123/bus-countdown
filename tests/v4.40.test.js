// V4.40: boarding proved by distance. Once you've left a stop you'd got to, being 150 m or more along a
// route that calls there, faster than walking on average since you left it, means you got on a bus
// there, whatever ended the countdown (OneBusAway's reminders tell boarding the same way).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, m } = require('./harness');
const { replay } = require('../build/replay-core');

const clock = (o) => new Date(o.t + 3600000).toISOString().slice(11, 19);
const day = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ---- 1. Replayed --------------------------------------------------------------------------------
test('Tuesday 17:20 at Corvel Lodge: the countdown ended without Bus Watch, and the 517 you got on is still found', () => {
  const out = replay(day('tue-6-oct-excerpts.jsonl')).out;
  const got = out.find((o) => o.k === 'check' && /on a bus from Corvel Lodge School \(opp\)/.test(o.why || ''));
  assert.ok(got, '4.39 never saw this boarding: the trip was already "left"');
  assert.strictEqual(clock(got), '17:21:49');
  assert.match(got.why, /m along its route in \d+ s\): the 517 \(LA28LPG\)$/);
  assert.strictEqual(got.state, 'onbus');
});

test('Wednesday 08:51 at Kiln Street: off the tram and onto the 566, which is found as the bus you got on', () => {
  const out = replay(day('wed-7-oct-morning.jsonl')).out;
  const checks = out.filter((o) => o.k === 'check');
  const went = checks.find((o) => clock(o) === '08:51:03');
  assert.match(went.why, /went past Kiln Street/, 'the tram stood at the stop without the countdown seeing you get there');
  const got = checks.find((o) => /on a bus from Kiln Street \(Stop KH\)/.test(o.why || ''));
  assert.ok(got, '4.39 took this for still being on the tram');
  assert.match(got.why, /: the 566 \(WD21TSS\)$/);
  assert.ok(checks.filter((o) => clock(o) > clock(got) && clock(o) <= '09:00:30').every((o) => o.state === 'onbus'));
});

test('Thursday: held at Wexley on the 517 you were seen getting on, you are still on that bus, not on one from Wexley', () => {
  const out = replay(day('thu-8-oct-morning.jsonl')).out;
  assert.ok(!out.some((o) => o.k === 'check' && /on a bus from Wexley/.test(o.why || '')));
  assert.ok(out.some((o) => o.k === 'check' && /still on the bus past Wexley/.test(o.why || '')));
});

// ---- 2. A straight road, one route through High St (Stop S) -------------------------------------
const BASE = 51.37; const LON = -0.28; const T0 = Date.UTC(2026, 9, 9, 7, 0, 0);
function world() {
  return {
    BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|50`, BusNearRadius: '50', BusRoutes: '517',
    BusCacheSeq: JSON.stringify([[['A', +(BASE - m(800)).toFixed(6), LON], ['S', BASE, LON], ['X', +(BASE + m(600)).toFixed(6), LON], ['Z', +(BASE + m(1500)).toFixed(6), LON]]]),
    // At the stop for 4 minutes, with the 517 SF40MGA due now
    BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'S', since: T0 - 240000 }),
    BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'S',
    BusStateSeen: JSON.stringify({ s: 'S', b: [{ k: '517', v: 'SF40MGA', d: 'X', t: T0 + 10000, seen: T0 - 20000 }, { k: '517', v: 'SF89KTE', d: 'X', t: T0 + 900000, seen: T0 - 20000 }] }),
    BusStateWindow: JSON.stringify([60, 40, 20].map((s) => ({ t: T0 - s * 1000, lat: BASE, lon: LON, acc: 10, spd: 0 }))),
  };
}
// steps: [seconds after T0, metres north of the stop, metres east of the route]
function ride(g, steps) {
  return steps.map(([s, north, east = 0]) => {
    const r = run('watch.js', { globals: g, now: T0 + s * 1000, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(north)),
      gl_longitude: String(LON + east / 69600), gl_time_seconds: String(T0 / 1000 + s), busspeed: '', busbearing: '', busacc: '10' } });
    return { why: r.why, state: JSON.parse(g.BusStateTrip).s };
  });
}

test('a countdown that timed out while you stood at the stop, then 150 m along the route in 40 s: you got on, and on which bus', () => {
  const g = world();
  g.BusStateRunning = '0'; g.TRUN = '';          // Bus Loop timed out at T0
  const out = ride(g, [[5, 0], [25, 60], [45, 180]]);
  assert.strictEqual(out[0].state, 'left');
  assert.strictEqual(out[2].state, 'onbus');
  assert.match(out[2].why, /^on a bus from High St \(Stop S\) \(180 m along its route in \d+ s\): the 517 \(SF40MGA\)$/);
  assert.strictEqual(JSON.parse(g.BusStateBoarded).v, 'SF40MGA');
});

test('walking on along the route past the stop is still walking: 200 m in 2½ minutes', () => {
  const g = world();
  g.BusStateRunning = '0'; g.TRUN = '';
  const out = ride(g, [[5, 0], [40, 50], [80, 100], [120, 150], [155, 200]]);
  assert.ok(out.every((o) => o.state === 'left'), out.map((o) => o.why).join(' / '));
  assert.ok(!g.BusStateBoarded);
});

test('fast, but on a road the route doesn\'t take (a tram line, say): not a boarding at that stop', () => {
  const g = world();
  g.BusStateRunning = '0'; g.TRUN = '';
  const out = ride(g, [[5, 0], [25, 60, 120], [45, 180, 250]]);
  assert.ok(!out.some((o) => /on a bus from High St/.test(o.why)));
});

test('a stop you never got to doesn\'t count: heading for it, the countdown ends 300 m short, and a bus takes you past', () => {
  const g = world();
  g.BusStateTrip = JSON.stringify({ s: 'heading', stop: 'S', since: T0 - 120000, minD: 300 });
  g.BusStateWindow = JSON.stringify([60, 40, 20].map((s) => ({ t: T0 - s * 1000, lat: +(BASE - m(300)).toFixed(6), lon: LON, acc: 10, spd: 0 })));
  g.BusStateRunning = '0'; g.TRUN = '';
  const out = ride(g, [[5, -300], [25, -100], [45, 160]]);
  assert.ok(!out.some((o) => /on a bus from High St/.test(o.why)));
});
