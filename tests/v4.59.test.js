// V4.59: moving along your route. With no word from TfL about the bus you're on (no live data for the
// route, or no bus named), a slow spell doesn't end the ride while you keep moving forward along one of
// your routes' lines: at 1.4 m/s or more within 2 minutes of last moving at bus speed, 2.2 m/s after.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

// ---- A straight road north: the 517 calls at A, S, X, Y, Z ------------------------------------------
const BASE = 51.37; const LON = -0.28; const T0 = Date.UTC(2026, 9, 12, 7, 30, 0);
const at = (north, east = 0) => [+(BASE + m(north)).toFixed(6), +(LON + east / 69600).toFixed(6)];
const NORTH = [['A', -800], ['S', 0], ['X', 600], ['Y', 1200], ['Z', 1800]].map(([id, n]) => [id, ...at(n)]);
// The positions before this one, 20 s apart and `pace` m/s north (or back south), ending 20 s before T0
const moving = (north, pace, { n = 4, east = 0, spd = 0.5, acc = 10 } = {}) => JSON.stringify(Array.from({ length: n }, (_, i) => {
  const s = (n - i) * 20; return { t: T0 - s * 1000, lat: at(north - pace * s, east)[0], lon: at(0, east)[1], acc, spd };
}));
function world(extra) {
  return Object.assign({
    BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|50\nbus|Z|Market Sq (Stop Z)|${at(1800).join('|')}|50`, BusNearRadius: '50', BusRoutes: '517',
    BusCacheSeq: JSON.stringify([NORTH]), BusStateRunning: '0', TRUN: '', BusStateLastBusAt: String(T0 - 90000),
    BusStateTrip: JSON.stringify({ s: 'onbus', stop: 'S', since: T0 - 300000, boardedAt: 'S' }),
  }, extra);
}
const check = (g, north, { spd = '0.5', acc = '10', east = 0, t = T0 } = {}) => {
  const r = run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(at(north, east)[0]), gl_longitude: String(at(north, east)[1]),
    gl_time_seconds: String(t / 1000), busspeed: spd, busbearing: '', busacc: acc } });
  return { why: r.why, action: r.busaction, trip: JSON.parse(g.BusStateTrip), line: r.busrecline };
};

test('on a bus, crawling on along its route with no word from TfL: still on the bus', () => {
  const g = world({ BusStateWindow: moving(700, 1.6) });
  const r = check(g, 700);
  assert.strictEqual(r.trip.s, 'onbus');
  assert.match(r.why, /on a bus, slow: still along a route at 6 km\/h/);
});

test('a crawl counts at 1.4 m/s only within 2 minutes of bus speed; after that it takes 2.2 m/s', () => {
  assert.strictEqual(check(world({ BusStateWindow: moving(700, 1.6), BusStateLastBusAt: String(T0 - 150000) }), 700).trip.s, 'left');
  const r = check(world({ BusStateWindow: moving(700, 2.5), BusStateLastBusAt: String(T0 - 150000) }), 700);
  assert.strictEqual(r.trip.s, 'onbus');
  assert.match(r.why, /still along a route at 9 km\/h/);
});

test('standing still, off the route\'s line, or going back along it: the ride ends, as before', () => {
  assert.strictEqual(check(world({ BusStateWindow: moving(700, 0) }), 700).trip.s, 'left', 'standing still');
  assert.strictEqual(check(world({ BusStateWindow: moving(700, 1.6, { east: 80 }) }), 700, { east: 80 }).trip.s, 'left', '80 m off the road');
  assert.strictEqual(check(world({ BusStateWindow: moving(640, -1.6) }), 640).trip.s, 'left', 'going back south');
});

test('it needs a minute of positions 50 m or better to go on', () => {
  assert.strictEqual(check(world({ BusStateWindow: moving(700, 1.6, { n: 1 }) }), 700).trip.s, 'left', 'only 40 s of positions');
  assert.strictEqual(check(world({ BusStateWindow: moving(700, 1.6, { acc: 70 }) }), 700).trip.s, 'left', 'rough positions');
});

test('TfL\'s word on your bus comes first: once the bus has gone on, moving along its road doesn\'t keep you on it', () => {
  const follow = JSON.stringify({ v: 'SF40MGA', at: T0 - 10000, n: [['Z', T0 + 60000, 'Stop Z']] });
  const g = world({ BusStateWindow: moving(700, 1.6), BusStateFollow: follow,
    BusStateBoarded: JSON.stringify({ k: '517', v: 'SF40MGA', stop: 'S', at: T0 - 300000, sure: true }) });
  const r = check(g, 700);
  assert.strictEqual(r.trip.s, 'left');
  assert.match(r.why, /off the bus: the 517 has gone on/);
});

test('each check records the pace along the route that kept you on the bus', () => {
  const g = world({ BusStateWindow: moving(700, 1.6), BusRecord: 'on', BusRecordDay: '2026-10-12' });
  const rec = JSON.parse(check(g, 700).line);
  assert.ok(rec.rt >= 1.4 && rec.rt < 1.8, String(rec.rt));
  const h = world({ BusStateWindow: moving(700, 0), BusRecord: 'on', BusRecordDay: '2026-10-12' });
  assert.strictEqual(JSON.parse(check(h, 700).line).rt, undefined);
});

test('riding to a saved stop, a crawl along the route is not "off the bus, on foot", but the 2-minute timer still runs', () => {
  const g = world({ BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'Z', BusStateWindow: moving(700, 1.6, { spd: 1.6 }),
    BusStateTrip: JSON.stringify({ s: 'heading', stop: 'Z', since: T0 - 120000, minD: 1200, bus: true }) });
  const a = [check(g, 700, { spd: '1.6' }), check(g, 716, { spd: '1.6', t: T0 + 10000 })];
  assert.ok(a.every((r) => !/on foot/.test(r.why) && r.trip.bus === true), a.map((r) => r.why).join(' / '));
  assert.match(a[1].why, /slow: still along a route at 6 km\/h/);
  assert.strictEqual(a[1].trip.slowN, 2, 'counting towards "no longer coming up soon"');
  assert.strictEqual(a[1].trip.slowSince, T0);
});

test('Corvel Lodge: off the bus well short and walking on along the road ends it 2 minutes later, as in 4.58', () => {
  const seq = [['A', -2400], ['B', -1200], ['S', 0], ['Z', 800]].map(([id, n]) => [id, ...at(n)]);
  const g = { BusPlaces: `bus|S|Corvel Lodge School (adj)|${BASE}|${LON}|70`, BusNearRadius: '50', BusCacheSeq: JSON.stringify([seq]), BusCacheStops: '{}', BusStateRunning: '0', TRUN: '' };
  let t = T0; const whys = [];
  const step = (x, kmh) => {
    t += 15000;
    const r = run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(at(x)[0]), gl_longitude: String(LON),
      gl_time_seconds: String(t / 1000), busspeed: String(kmh / 3.6), busbearing: '0', busacc: '20' } });
    if (r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    whys.push(r.why); return r.busaction;
  };
  step(-2200, 35); assert.strictEqual(step(-1700, 35), 'approach');
  const off = t; let x = -1690; step(x, 6); let ended = 0;
  for (let i = 1; i < 30 && !ended; i++) { x += 25; if (step(x, 6) === 'stop') ended = (t - off) / 1000; }
  assert.ok(whys.some((w) => /still along a route/.test(w)), 'kept on the bus by the route for a while');
  assert.strictEqual(ended, 150);
});
