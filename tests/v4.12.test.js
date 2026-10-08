// Version 4.12: fixes from the code review, each with the case that showed the problem
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

const BASE = 51.37, LON = -0.08;

test('on a bus heading south, a northbound stop behind you is never "coming up"', () => {
  // Both directions of one route share the road: northbound A-S-X-T-Z, southbound Z-T2-X-S2-A
  const north = [['A', BASE - m(800), LON], ['S', BASE, LON], ['X', BASE + m(600), LON], ['T', BASE + m(1200), LON], ['Z', BASE + m(2000), LON]];
  const south = [['Z', BASE + m(2000), LON], ['T2', BASE + m(1210), LON + 0.0002], ['X', BASE + m(600), LON], ['S2', BASE + m(10), LON + 0.0002], ['A', BASE - m(800), LON]];
  const g = { BusPlaces: `bus|T|Park Rd northbound (T)|${BASE + m(1200)}|${LON}|50\nbus|S2|High St southbound (S2)|${BASE + m(10)}|${LON + 0.0002}|50`,
    BusNearRadius: '50', BusCacheSeq: JSON.stringify([north, south]), BusCacheStops: '{}', BusStateRunning: '0', TRUN: '' };
  let t = Date.UTC(2026, 9, 5, 9, 0, 0);
  const seen = [];
  for (const x of [1300, 1000, 800, 600, 400]) {
    t += 15000;
    const r = run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)), gl_longitude: String(LON),
      gl_time_seconds: String(t / 1000), busspeed: String(30 / 3.6), busbearing: '180', busacc: '8' } });
    seen.push(r.busaction === 'approach' ? g.BusStateArrivedStop : '-');
    if (r.busaction === 'approach') break;
  }
  assert.ok(!seen.includes('T'), 'never the northbound stop behind you');
  assert.strictEqual(seen[seen.length - 1], 'S2', 'the southbound stop ahead');
});

test('waiting still at the stop for 3 minutes does not trip the safety net; moving without positions does', () => {
  const now = Date.now();
  const tick = (spd, agoMin) => run('loop_tick.js', { now, globals: { BusRefresh: '45', BusStateEndAt: String(now + 600000), SCREEN: 'on',
    BusStateLastPush: String(now - agoMin * 60000), BusStateWindow: JSON.stringify([{ t: now - agoMin * 60000, spd }]) } }).busnopush;
  assert.strictEqual(tick(0, 3), 'no', 'standing still: silence is expected');
  assert.strictEqual(tick(0, 11), 'yes', 'but not for over 10 minutes');
  assert.strictEqual(tick(8, 3), 'yes', 'moving at bus speed with nothing for 3 minutes: something is wrong');
});

test('arrival distances count as at most 200 m', () => {
  const g = { BusPlaces: `bus|S|Sel (Stop S)|${BASE}|${LON}|400`, BusNearRadius: '50', BusStateRunning: '0', TRUN: '' };
  const t = Date.UTC(2026, 9, 5, 9, 0, 0);
  const at = (x) => run('watch.js', { globals: Object.assign({}, g), now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)),
    gl_longitude: String(LON), gl_time_seconds: String(t / 1000), busspeed: '0', busbearing: '', busacc: '8' } }).busaction;
  assert.strictEqual(at(300), 'none', '300 m away is not "at the stop", even with 400 m saved');
  assert.strictEqual(at(150), 'start');
});

test('the direction table is rebuilt when a saved stop changes, even to one with a same-length line', () => {
  const g = { BusPlaces: `bus|AAAA|Stop one (A)|${BASE}|${LON}|100`, BusNearRadius: '50', BusCacheSeq: '[]', BusStateRunning: '0', TRUN: '',
    BusStateLastPlace: 'work', BusHomeAt: JSON.stringify({ lat: BASE - 0.02, lon: LON, n: 3 }) };
  const t = Date.UTC(2026, 9, 5, 18, 0, 0);
  const check = () => run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(900)), gl_longitude: String(LON),
    gl_time_seconds: String(t / 1000), busspeed: '0', busbearing: '', busacc: '8' } });
  check(); const first = g.BusCacheDirKey;
  g.BusPlaces = `bus|BBBB|Stop two (B)|${BASE}|${LON}|100`;      // same length, different stop
  check();
  assert.notStrictEqual(g.BusCacheDirKey, first);
  assert.ok(JSON.parse(g.BusCacheDir).BBBB, 'the new stop is in the table');
});

test('while backing off, times still fade on the normal refresh timing', () => {
  const now = Date.UTC(2026, 9, 5, 8, 0, 0);
  const g = { BusRefresh: '45', BusRoutes: '517', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'X (Stop A)', BusStateFailCount: '2',
    BusCacheTimetable: JSON.stringify({ S: { r: { '517': { t: [[480 + 5, 0], [480 + 20, 0]], n: ['Holbry'] } } } }) };
  run('refresh.js', { globals: g, now, locals: { http_response_code: '0', http_data: '' } });
  assert.strictEqual(g.BusStateNextWait, '300', 'the next try is backed off');
  assert.strictEqual(JSON.parse(g.BusStateIslandData).r, 45000, 'but fading uses the usual 45 s');
});

test('shown from a bus, then you get off well short of the stop: it ends once you are walking', () => {
  // Corvel Lodge, 09:36: heading by bus to a stop 1.8 km ahead, then walking at 6 km/h
  const seq = [['A', BASE - m(2400), LON], ['B', BASE - m(1200), LON], ['S', BASE, LON], ['Z', BASE + m(800), LON]];
  const g = { BusPlaces: `bus|S|Corvel Lodge School (adj)|${BASE}|${LON}|70`, BusNearRadius: '50', BusCacheSeq: JSON.stringify([seq]),
    BusCacheStops: '{}', BusStateRunning: '0', TRUN: '' };
  let t = Date.UTC(2026, 9, 5, 8, 34, 0);
  const at = (x, kmh) => {
    t += 15000;
    const r = run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)), gl_longitude: String(LON),
      gl_time_seconds: String(t / 1000), busspeed: String(kmh / 3.6), busbearing: '0', busacc: '20' } });
    if (r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    if (r.busaction === 'stop') { g.BusStateRunning = '0'; g.TRUN = ''; }
    return r.busaction;
  };
  assert.strictEqual(at(-2200, 35), 'none', 'over 3 minutes away by bus');
  assert.strictEqual(at(-1700, 35), 'approach', 'coming up by bus (35 km/h: 3 minutes is about 1,750 m)');
  assert.strictEqual(at(-1690, 6), 'none', 'got off: one slow check is not enough');
  // Since 4.39 it takes 2 minutes of walking, not just three checks (a tram held at a stop for 25 s
  // had ended a countdown): positions every 15 s, and the first of them still reads as the bus
  for (let i = 1; i < 9; i++) assert.strictEqual(at(-1690 + i * 25, 6), 'none', 'still under 2 minutes');
  assert.strictEqual(at(-1465, 6), 'stop', 'walking, about 15 minutes away: no longer coming up soon');
});

test('a bus crawling in traffic for a moment does not end it', () => {
  const seq = [['A', BASE - m(2400), LON], ['S', BASE, LON], ['Z', BASE + m(800), LON]];
  const g = { BusPlaces: `bus|S|Stop S|${BASE}|${LON}|70`, BusNearRadius: '50', BusCacheSeq: JSON.stringify([seq]), BusCacheStops: '{}', BusStateRunning: '0', TRUN: '' };
  let t = Date.UTC(2026, 9, 5, 8, 34, 0);
  const at = (x, kmh) => {
    t += 15000;
    const r = run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)), gl_longitude: String(LON),
      gl_time_seconds: String(t / 1000), busspeed: String(kmh / 3.6), busbearing: '0', busacc: '10' } });
    if (r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    return r.busaction;
  };
  at(-1700, 35);
  assert.ok(['approach'].includes(at(-1400, 35)) || g.BusStateRunning === '1');
  assert.deepStrictEqual([at(-1390, 5), at(-1380, 5), at(-1100, 30)], ['none', 'none', 'none']);
});

test('a bus held up just after leaving your stop (still inside its circle) does not pop it up again', () => {
  // Waiting at Stop S, board, the bus pulls away then crawls at the lights while still within 100 m
  const g = { BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|100`, BusNearRadius: '50', BusCacheStops: '{}', BusStateRunning: '0', TRUN: '' };
  let t = Date.UTC(2026, 9, 6, 8, 20, 0);
  const at = (x, kmh, dt = 15) => {
    t += dt * 1000;
    const r = run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)), gl_longitude: String(LON),
      gl_time_seconds: String(t / 1000), busspeed: String(kmh / 3.6), busbearing: '0', busacc: '10' } });
    if (r.busaction === 'start' || r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    if (r.busaction === 'stop') { g.BusStateRunning = '0'; g.TRUN = ''; }
    return r.busaction + ':' + JSON.parse(g.BusStateTrip).s;
  };
  assert.strictEqual(at(0, 0), 'start:atstop', 'waiting at the stop');
  at(2, 0, 60);
  // Pulls away (positions 5 s apart at 20 to 25 km/h), still well inside the 100 m circle
  const away = [at(25, 20, 5), at(50, 22, 5), at(70, 25, 5), at(88, 25, 5)];
  assert.ok(away.includes('stop:onbus'), `boarded and away: ${away.join(', ')}`);
  // Then held at the lights, still inside the circle, crawling and then stopped
  const held = [at(90, 3), at(92, 1), at(93, 1, 20), at(94, 0.5, 20)];
  assert.ok(!held.some((h) => h.startsWith('start')), `held at the lights inside the circle: ${held.join(', ')}`);
});
