// V4.32: the code review's fixes, each with the case that showed the problem.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

const T0 = Date.UTC(2026, 9, 7, 8, 0, 0);
const LAT = 51.33, LON = -0.11;
const bus = (route, min, vehicle) => ({ lineName: route, destinationName: 'Somewhere', timeToStation: Math.round(min * 60), vehicleId: vehicle });
const base = (extra) => Object.assign({ BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'D', BusStateStopName: 'Wexley (Stop D)' }, extra);
const ridingTo = (etaMin, now) => JSON.stringify({ s: 'heading', stop: 'D', bus: true, eta: now + etaMin * 60000, etaAt: now });
const refresh = (g, arrivals, now) => run('refresh.js', { globals: g, now, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } });

// 1. Screen off, a bus over 8 minutes away: times are fetched again once it's within 8
test('screen off: the next bus counts down between fetches, so the buzz still comes in your pocket', () => {
  const g = base({ BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'D' }) });
  refresh(g, [bus('566', 12, 'LF1')], T0);
  const tick = (min) => run('loop_tick.js', { now: T0 + min * 60000, globals: Object.assign({}, g, { SCREEN: 'off', BusStateEndAt: String(T0 + 3600000), BusStateLastPush: String(T0 + min * 60000) }) }).busfetch;
  assert.deepStrictEqual([tick(1), tick(3), tick(5)], ['no', 'no', 'yes'], '12 min away: no fetch until it is 8 min away');
});
test('riding with the screen off: your own bus reaching the stop counts as the next thing', () => {
  const g = base({ BusStateBoarded: JSON.stringify({ k: '517', v: 'YY1', stop: 'M', at: T0 - 600000 }), BusStateTrip: ridingTo(3, T0) });
  refresh(g, [bus('517', 3, 'YY1'), bus('566', 12, 'LF1')], T0);
  assert.ok(Math.abs(+g.BusStateNextAt - (T0 + 180000)) < 1000);
});

// 2. A match left over from a countdown that ended mid-ride
test('Bus End forgets your bus, and an old match is ignored anyway', () => {
  const g = { BusStateStopId: 'D', BusStateMatch: JSON.stringify({ stop: 'D', v: 'OLD', n: 3, at: T0 }) };
  run('end_log.js', { globals: g, locals: { busreason: 'watch' }, now: T0 });
  assert.strictEqual(g.BusStateMatch, '');
  const g2 = base({ BusStateMatch: JSON.stringify({ stop: 'D', k: '517', v: 'OLD', n: 3, at: T0 - 3 * 3600000 }), BusStateTrip: JSON.stringify({ s: 'heading', stop: 'D', bus: true }) });
  assert.strictEqual(refresh(g2, [bus('517', 3, 'YY1')], T0).busbuzz, 'no', 'riding, your bus not known yet: no buzz');
});
test('Bus Status shows your bus only during a countdown', () => {
  const g = { BusStateMatch: JSON.stringify({ stop: 'D', note: 'on the 517 (YY1)', at: T0 }), BusPlaces: '', BusStateRunning: '0' };
  assert.doesNotMatch(run('status.js', { globals: g, now: T0 }).busstatus, /Your bus/);
});

// 3. The next bus on your own route is not a connection
test('riding the 517: the next 517 never buzzes or blocks the 566', () => {
  const g = base({ BusStateBoarded: JSON.stringify({ k: '517', v: 'YY1', stop: 'M', at: T0 - 600000 }) });
  const out = [];
  for (let i = 0; i < 2; i++) {
    const now = T0 + i * 45000; const s = i * 0.75;
    g.BusStateTrip = ridingTo(2.5 - s, now);
    out.push(refresh(g, [bus('517', 2.5 - s, 'YY1'), bus('517', 3.2 - s, 'YY2'), bus('566', 4.5 - s, 'LF1')], now).busbuzz);
  }
  assert.deepStrictEqual(out, ['yes', 'yes']);
  assert.deepStrictEqual(Object.keys(JSON.parse(g.BusStateBuzzed)), ['D|566|LF1']);
  assert.match(JSON.parse(g.BusStateMatch).note, /then the 566/);
});

// 4. Off the bus early, walking to the stop
test('got off early and walking: no longer riding, so the bus you walk to catch shows and can buzz', () => {
  const g = { BusPlaces: `bus|D|Wexley (Stop D)|${LAT}|${LON}|50`, BusRoutes: '517,566', BusStyle: 'pill', BusRefresh: '45',
    BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'D', BusStateStopName: 'Wexley (Stop D)',
    BusStateTrip: JSON.stringify({ s: 'heading', stop: 'D', since: T0 - 240000, minD: 900, bus: true }), BusStateWindow: '[]' };
  let dist = 470;
  for (let t = T0 - 100000; t <= T0; t += 20000, dist -= 28) {
    run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(dist)), gl_longitude: String(LON), gl_time_seconds: String(t / 1000), busspeed: '1.4', busacc: '8' } });
  }
  const trip = JSON.parse(g.BusStateTrip);
  assert.deepStrictEqual([trip.s, trip.bus, trip.eta], ['heading', false, undefined]);
  const r = refresh(g, [bus('566', 4, 'LF1'), bus('517', 15, 'YY9')], T0 + 10000);
  assert.strictEqual(r.busbuzz, 'yes');
  assert.ok(JSON.parse(g.BusStateIslandData).b.some((b) => b.v === 'LF1'));
});

// 5 and 6. Which bus you got on
const w = (now, sAgo, metres, spd) => ({ t: now - sAgo * 1000, lat: +(LAT + m(metres)).toFixed(6), lon: LON, acc: 10, spd });
test('stayed on your bus through a stop: that bus is the one you are on', () => {
  const now = T0;
  const g = { BusPlaces: `bus|B|Stop B|${LAT}|${LON}|50`, BusRoutes: '517,566', BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'B',
    BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'B', since: now - 60000 }),
    BusStateWindow: JSON.stringify([w(now, 70, 0, 0), w(now, 45, 2, 0), w(now, 12, 40, 6)]),
    BusStateCameOn: JSON.stringify({ k: '517', v: 'YY1', stop: 'B', at: now - 40000 }),
    BusStateSeen: JSON.stringify({ s: 'B', b: [{ k: '517', v: 'YY1', d: 'X', t: now - 45000, seen: now - 40000 }, { k: '566', v: 'LF1', d: 'Y', t: now + 100000, seen: now - 40000 }] }) };
  run('watch.js', { globals: g, now, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(160)), gl_longitude: String(LON), gl_time_seconds: String(now / 1000), busspeed: '8', busacc: '10' } });
  assert.strictEqual(JSON.parse(g.BusStateBoarded).v, 'YY1');
});
test('a bus found later ("on a bus after all"): picked by when you left, not by now', () => {
  const now = T0;
  const g = { BusPlaces: `bus|B|Stop B|${LAT}|${LON}|50`, BusRoutes: '517,566', BusStateRunning: '0', TRUN: '', BusStateStopId: 'B',
    BusStateTrip: JSON.stringify({ s: 'left', stop: 'B', since: now - 100000, leftD: 130, walked: true, leftAt: now - 150000 }),
    BusStateWindow: JSON.stringify([110, 90, 70, 50, 30, 10].map((s, i) => w(now, s, 104 + i * 52, 2.6))),
    BusStateSeen: JSON.stringify({ s: 'B', b: [{ k: '566', v: 'LF1', d: 'X', t: now - 150000, seen: now - 160000 }, { k: '517', v: 'YY1', d: 'Y', t: now + 60000, seen: now - 160000 }] }) };
  run('watch.js', { globals: g, now, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(390)), gl_longitude: String(LON), gl_time_seconds: String(now / 1000), busacc: '10' } });
  assert.strictEqual(JSON.parse(g.BusStateBoarded).v, 'LF1');
});

// 7. Starting by hand clears a swipe snooze
test('starting a countdown by hand clears a swipe snooze', () => {
  const g = { BusPlaces: `bus|C|Stop C|${LAT}|${LON}|50`, BusRoutes: '517', BusRadius: '300',
    BusCacheStops: JSON.stringify({ C: { n: 'Stop C', a: LAT, o: LON, r: ['517'] } }), BusStateSnooze: JSON.stringify({ stop: 'A', at: T0 }) };
  const r = run('start.js', { globals: g, now: T0, locals: { gl_latitude: String(LAT), gl_longitude: String(LON) } });
  assert.strictEqual(r.busok, 'yes');
  assert.strictEqual(g.BusStateSnooze, '');
  const g2 = Object.assign({}, g, { BusStateSnooze: JSON.stringify({ stop: 'A', at: T0 }), BusStateArrivedStop: 'C' });
  run('start.js', { globals: g2, now: T0, locals: { gl_latitude: String(LAT), gl_longitude: String(LON), par1: 'arrived' } });
  assert.notStrictEqual(g2.BusStateSnooze, '', 'a start by Bus Watch leaves it alone');
});

// 8. The bus you got on is forgotten once the trip is over
test('the bus you got on is forgotten when you next wait at a stop on foot', () => {
  const now = T0;
  const g = { BusPlaces: `bus|B|Stop B|${LAT}|${LON}|50`, BusRoutes: '517', BusStateRunning: '0', TRUN: '',
    BusStateBoarded: JSON.stringify({ k: '517', v: 'YY1', stop: 'A', at: now - 1800000 }), BusStateTrip: JSON.stringify({ s: 'idle' }) };
  let started = false;
  for (const s of [60, 30, 0]) {
    if (started) break;
    started = run('watch.js', { globals: g, now: now - s * 1000, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(5)), gl_longitude: String(LON), gl_time_seconds: String((now - s * 1000) / 1000), busspeed: '0', busacc: '8' } }).busaction === 'start';
  }
  assert.ok(started);
  assert.strictEqual(g.BusStateBoarded, '');
});

// 10. Screen on while staying put far away: never skipped during a countdown, or by hand
test('the "staying put" skip never applies during a countdown or when run by hand', () => {
  const now = T0;
  const due = (caller, extra) => run('watch_due.js', { now, globals: Object.assign({ BusPlaces: 'bus|S|S|51|0|50', BusStatePushMode: 'far',
    BusStateWindow: JSON.stringify([{ t: now - 60000, lat: 51, lon: 0, acc: 30, spd: -1 }]) }, extra || {}), locals: { buscaller: caller } }).busquiet;
  assert.strictEqual(due('profile=wake'), 'yes');
  assert.strictEqual(due('profile=wake', { BusStateRunning: '1', TRUN: 'Bus Loop' }), 'no');
  assert.strictEqual(due(''), 'no');
});
