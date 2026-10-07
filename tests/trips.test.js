// Replayed trips through Bus Watch's state machine (watch.js), one pushed position at a time.
// A straight north-south road: Stop S (100 m circle) at 0 m, Stop T (50 m) 1,200 m north, on one
// route. After each position the test plays the part of Bus Start / Bus End, as the tasks would.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

const BASE = 51.37, LON = -0.08;
function world(extra) {
  return Object.assign({
    BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|100\nbus|T|Park Rd (Stop T)|${(BASE + m(1200)).toFixed(6)}|${LON}|50`,
    BusNearRadius: '50',
    BusCacheStops: JSON.stringify({ S: { n: 'High St (Stop S)', a: BASE, o: LON, r: ['1'] }, T: { n: 'Park Rd (Stop T)', a: BASE + m(1200), o: LON, r: ['1'] } }),
    BusCacheSeq: JSON.stringify([[['A', +(BASE - m(800)).toFixed(6), LON], ['S', BASE, LON], ['X', +(BASE + m(600)).toFixed(6), LON], ['T', +(BASE + m(1200)).toFixed(6), LON], ['Z', +(BASE + m(2000)).toFixed(6), LON]]]),
    BusStateRunning: '0', TRUN: '',
  }, extra || {});
}

// steps: [metres north of Stop S, seconds since the last step, km/h or null (unknown), options]
function trip(steps, extra) {
  const g = world(extra);
  let t = Date.UTC(2026, 9, 5, 9, 0, 0);
  const out = [];
  for (const [x, dt, kmh, opt = {}] of steps) {
    if (x === 'swipe') {        // Bus End from the island: end_log.js marks the trip left (swiped)
      g.BusStateRunning = '0'; g.TRUN = '';
      run('end_log.js', { globals: g, locals: { busfrom: 'island' }, now: t });
      out.push({ x, action: 'swipe', state: 'left' });
      continue;
    }
    t += dt * 1000;
    const r = run('watch.js', {
      globals: g, now: t,
      locals: {
        buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)), gl_longitude: String(LON), gl_time_seconds: String(t / 1000),
        busspeed: kmh === null ? '' : String(kmh / 3.6), busbearing: opt.bearing === undefined ? '' : String(opt.bearing), busacc: String(opt.acc || 8),
      },
    });
    if (r.busaction === 'start' || r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    if (r.busaction === 'stop') { g.BusStateRunning = '0'; g.TRUN = ''; }
    out.push({ x, action: r.busaction, state: JSON.parse(g.BusStateTrip || '{}').s, why: r.why, rate: r.buspushmode, dwell: r.busdwell });
  }
  return out;
}
const actions = (out) => out.map((o) => o.action);

test('walking straight past a stop: shown as you approach, gone once past', () => {
  const out = trip([[-150, 0, 5, { bearing: 0 }], [-60, 30, 5, { bearing: 0 }], [0, 40, 5, { bearing: 0 }], [60, 45, 5, { bearing: 0 }], [160, 70, 5, { bearing: 0 }]]);
  assert.strictEqual(out[0].action, 'approach');
  assert.strictEqual(out[4].action, 'stop');
  assert.strictEqual(out[4].state, 'left');
});

test('walking up, waiting, then the bus: ends as the bus pulls away', () => {
  const out = trip([[-150, 0, 5, { bearing: 0 }], [-20, 90, 5, { bearing: 0 }], [-5, 15, 0.5], [-5, 60, 0], [30, 20, 20], [180, 20, 30]]);
  assert.strictEqual(out[3].state, 'atstop');
  assert.strictEqual(out[5].action, 'stop');
  assert.strictEqual(out[5].state, 'onbus');
});

test('waiting, then walking away with no speed readings: ends on the distance trend', () => {
  const out = trip([[-10, 0, null], [-10, 60, null], [40, 30, null], [90, 30, null], [140, 30, null], [190, 30, null]]);
  assert.strictEqual(out[0].action, 'start');
  assert.strictEqual(out[5].action, 'stop');
  assert.deepStrictEqual(actions(out).slice(1, 5), ['none', 'none', 'none', 'none']);
});

test('on a bus: the saved stop ahead is found along the route, and ends once passed', () => {
  const out = trip([[-900, 0, 30], [-600, 20, 30], [300, 60, 30], [700, 40, 30]]);
  assert.strictEqual(out[1].action, 'approach');
  assert.match(out[1].why, /by bus/);
  assert.strictEqual(out[3].action, 'stop');
});

test('one jumpy fix while waiting does not end the countdown', () => {
  const out = trip([[0, 0, 0], [5, 30, 0], [120, 15, 40, { acc: 70 }], [8, 15, 0], [6, 30, 0]]);
  assert.strictEqual(out[0].action, 'start');
  assert.ok(!actions(out).includes('stop'));
  assert.strictEqual(out[4].state, 'atstop');
});

test('passing through a circle at walking pace waits, and positions come every 15 s', () => {
  const out = trip([[-40, 0, 5]]);
  assert.strictEqual(out[0].action, 'none');
  assert.strictEqual(out[0].dwell, 'yes');
  assert.strictEqual(out[0].rate, 'dwell');
});

test('after a swipe it stays away, even back at the stop', () => {
  const out = trip([[0, 0, 0], [3, 30, 0], ['swipe'], [4, 30, 0], [20, 300, 3, { bearing: 180 }]]);
  assert.deepStrictEqual(actions(out).slice(3), ['none', 'none']);
  assert.strictEqual(out[4].state, 'left');
  assert.match(out[4].why, /snoozed|just left/);
});

test('a stop just walked away from does not restart as you carry on', () => {
  // Ended at 253 m with a 400 m circle used to restart at 293 m (the Wexley loop)
  const g = { BusPlaces: `bus|S|Sel (Stop S)|${BASE}|${LON}|400` };
  const out = trip([[-5, 0, 0], [-5, 30, 0], [150, 40, 5], [300, 40, 5], [420, 40, 5], [480, 30, 5], [520, 30, 5]], g);
  const stopAt = out.findIndex((o) => o.action === 'stop');
  assert.ok(stopAt > 0, 'it ends');
  assert.ok(!out.slice(stopAt + 1).some((o) => o.action === 'start'), 'and does not start again');
});

test('standing at the stop with a rough fix (speed reading bouncing at 4-6 km/h) still starts it', () => {
  // Ashenhurst, 08:18: 27 m from the stop, GPS ±24 m, the speed reading never dropping below 4 km/h
  const out = trip([[-27, 0, 5, { acc: 24 }], [-12, 15, 6, { acc: 24 }], [-35, 15, 4, { acc: 24 }], [-20, 15, 5, { acc: 24 }]]);
  assert.strictEqual(out[0].action, 'none');
  assert.ok(out.slice(1).some((o) => o.action === 'start'), 'starts once you have stayed put for 30 s');
  assert.match(out.find((o) => o.action === 'start').why, /stayed put/);
});

test('walking past at 5 km/h with the same rough fix still does not start it', () => {
  const out = trip([[-140, 0, 5, { acc: 24, bearing: 180 }], [-120, 15, 5, { acc: 24, bearing: 180 }], [-100, 15, 5, { acc: 24, bearing: 180 }], [-80, 15, 5, { acc: 24, bearing: 180 }], [-60, 15, 5, { acc: 24, bearing: 180 }]],
    { BusPlaces: `bus|S|Sel (Stop S)|${BASE}|${LON}|200` });
  assert.ok(!out.some((o) => o.action === 'start'));
});
