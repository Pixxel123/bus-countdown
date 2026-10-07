// V4.27, from the first recorded day: the swipe snooze, stops by home and work, leaving on a slow bus,
// quieter pushes when staying put, keeping buses TfL drops, buzz timing, and the recorder's new notes.
// A straight north-south road as in trips.test.js: Stop S (100 m circle) at 0 m, Stop T (50 m)
// 1,200 m north, on one route.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m, files } = require('./harness');

const BASE = 51.37, LON = -0.08;
function world(extra) {
  return Object.assign({
    BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|100\nbus|T|Park Rd (Stop T)|${(BASE + m(1200)).toFixed(6)}|${LON}|50`,
    BusNearRadius: '50',
    BusCacheSeq: JSON.stringify([[['A', +(BASE - m(800)).toFixed(6), LON], ['S', BASE, LON], ['X', +(BASE + m(600)).toFixed(6), LON], ['T', +(BASE + m(1200)).toFixed(6), LON], ['Z', +(BASE + m(2000)).toFixed(6), LON]]]),
    BusStateRunning: '0', TRUN: '',
  }, extra || {});
}
// steps: [metres north of Stop S (or 'swipe'), seconds since the last step, km/h or null, options]
function trip(steps, g = world()) {
  let t = Date.UTC(2026, 9, 6, 17, 0, 0);
  const out = [];
  for (const [x, dt, kmh, opt = {}] of steps) {
    t += dt * 1000;
    if (x === 'swipe') {
      g.BusStateRunning = '0'; g.TRUN = '';
      run('end_log.js', { globals: g, locals: { busfrom: 'island' }, now: t });
      out.push({ x, action: 'swipe' });
      continue;
    }
    const r = run('watch.js', { globals: g, now: t, locals: {
      buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)), gl_longitude: String(LON + (opt.east ? opt.east / 69600 : 0)),
      gl_time_seconds: String(t / 1000), busspeed: kmh === null ? '' : String(kmh / 3.6), busbearing: opt.bearing === undefined ? '' : String(opt.bearing),
      busacc: String(opt.acc || 8) } });
    if (r.busaction === 'start' || r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    if (r.busaction === 'stop') { g.BusStateRunning = '0'; g.TRUN = ''; }
    out.push({ x, action: r.busaction, state: JSON.parse(g.BusStateTrip || '{}').s, why: r.why, rate: g.BusStatePushMode });
  }
  return { out, g };
}

// ---- The swipe snooze ------------------------------------------------------------------------------

test('swiped on a bus 300 m before the stop: it stays away (it used to come straight back)', () => {
  const { out, g } = trip([[300, 0, 30, { bearing: 0 }], [550, 30, 30, { bearing: 0 }],
    ['swipe', 3], [600, 4, 30, { bearing: 0 }], [800, 24, 30, { bearing: 0 }], [1000, 24, 30, { bearing: 0 }]]);
  assert.strictEqual(out[0].action, 'approach', 'Stop T coming up');
  assert.deepStrictEqual(out.slice(3).map((o) => o.action), ['none', 'none', 'none']);
  assert.match(out[3].why, /snoozed/);
  assert.ok(g.BusStateSnooze, 'still snoozed');
});

test('the snooze lifts once you have been to that stop and left it, clear of all your stops', () => {
  const { out, g } = trip([[800, 0, 30, { bearing: 0 }], [950, 18, 30, { bearing: 0 }], ['swipe', 3],
    [1190, 30, 3], [1200, 20, 0], [1260, 40, 5], [1330, 50, 5], [1420, 60, 5]]);
  assert.deepStrictEqual(out.slice(3, 5).map((o) => o.action), ['none', 'none'], 'at the stop: nothing starts');
  assert.strictEqual(g.BusStateSnooze, '', '150 m past it and clear of both circles');
});

test('a swipe landing while a check is running isn\'t overwritten by it', () => {
  // Bus Watch reads an older snooze (A), then a new swipe lands (B) before Bus Watch writes its results
  const t = Date.UTC(2026, 9, 6, 17, 0, 5);
  const A = JSON.stringify({ stop: 'S', at: t - 60000 }); const B = JSON.stringify({ stop: 'T', at: t });
  const g = world({ BusStateSnooze: A }); let reads = 0;
  const proxy = new Proxy(g, { get: (o, k) => { if (k === 'BusStateSnooze' && ++reads > 1) o.BusStateSnooze = B; return o[k]; } });
  run('watch.js', { globals: proxy, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(900)), gl_longitude: String(LON),
    gl_time_seconds: String(t / 1000), busspeed: '8', busbearing: '0', busacc: '8' } });
  assert.strictEqual(g.BusStateSnooze, B);
});

// ---- Stops by home and work -------------------------------------------------------------------------

const homeByT = () => world({ BusHomeAt: JSON.stringify({ lat: +(BASE + m(1400)).toFixed(6), lon: LON, n: 10 }) });

test('on a bus to the stop by home: no pop-up, and none when you get off there', () => {
  const { out } = trip([[300, 0, 30, { bearing: 0 }], [550, 30, 30, { bearing: 0 }], [800, 30, 30, { bearing: 0 }], [1050, 30, 30, { bearing: 0 }],
    [1195, 25, 3], [1200, 20, 0], [1205, 30, 0]], homeByT());
  assert.deepStrictEqual(out.map((o) => o.action), ['none', 'none', 'none', 'none', 'none', 'none', 'none']);
  assert.match(out[2].why, /on a bus to Park Rd \(Stop T\), by home: no pop-up/);
  assert.match(out[6].why, /off the bus at Park Rd \(Stop T\), by home: no countdown/);
});

test('walking to the stop by home (no bus lately) still starts it', () => {
  const g = homeByT();
  g.BusStateLastBusAt = String(Date.UTC(2026, 9, 6, 16, 0, 0));       // an hour ago
  const { out } = trip([[1400, 0, 5, { bearing: 180 }], [1300, 70, 5, { bearing: 180 }], [1220, 60, 5, { bearing: 180 }], [1205, 20, 0.5], [1205, 30, 0]], g);
  assert.ok(out.some((o) => o.action === 'start' || o.action === 'approach'));
});

test('on a bus to a stop that isn\'t by home or work (a change): still shown', () => {
  const { out } = trip([[300, 0, 30, { bearing: 0 }], [550, 30, 30, { bearing: 0 }]]);
  assert.strictEqual(out[0].action, 'approach');
});

// ---- Leaving a stop on a slow bus -----------------------------------------------------------------

test('leaving a stop at 9 km/h for 2 minutes is a bus, not a walk', () => {
  // Positions every 20 s: the countdown ends as you pass 150 m, then the steady pace shows it was a bus
  const { out } = trip([[0, 0, 0], [5, 30, 0], [5, 30, 0], [55, 20, null], [100, 20, null], [150, 20, null], [210, 20, null], [260, 20, null], [310, 20, null], [360, 20, null]]);
  assert.strictEqual(out.filter((o) => o.action === 'stop').length, 1);
  assert.strictEqual(out[out.length - 1].state, 'onbus');
  assert.ok(out.some((o) => /on a bus after all, from High St/.test(o.why)));
});

test('positions held back for 2½ minutes (as at Wexley): ends as on the bus straight away', () => {
  const { out } = trip([[0, 0, 0], [5, 30, 0], [5, 30, 0], [30, 10, null], [75, 10, 15], [430, 147, null]]);
  const end = out.find((o) => o.action === 'stop');
  assert.strictEqual(end.state, 'onbus');
  assert.match(end.why, /on the bus, away from High St/);
});

test('walking away from a stop is still walking away', () => {
  const { out } = trip([[0, 0, 0], [5, 30, 0], [5, 30, 0], [35, 20, null], [63, 20, null], [91, 20, null], [119, 20, null], [147, 20, null], [175, 20, null], [203, 20, null], [231, 20, null], [259, 20, null]]);
  const end = out.find((o) => o.action === 'stop');
  assert.strictEqual(end.state, 'left');
  assert.match(end.why, /walking away/);
});

test('a poor fix next to a good one doesn\'t make up a fast bus', () => {
  const { out } = trip([[-2000, 0, null], [-1990, 25, null, { acc: 100 }], [-1550, 22, null]]);
  assert.strictEqual(out[2].action, 'none');
});

// ---- Staying put far from your stops ----------------------------------------------------------------

test('staying put 1 km from your stops, with the fix wandering 40 m: positions slow to every 100 m', () => {
  const wander = [0, 35, -30, 20, -40, 30, -25, 10];
  const { out } = trip(wander.map((e, i) => [-1000 + (i % 2 ? 20 : -20), i ? 30 : 0, null, { east: e, acc: 40 }]));
  assert.strictEqual(out[out.length - 1].rate, 'far');
  const moved = trip(wander.map((e, i) => [-1000, i ? 30 : 0, null, { east: e, acc: 40 }]).concat([[-800, 120, null], [-650, 100, null]]));
  assert.strictEqual(moved.out[moved.out.length - 1].rate, 'arrive', 'moved 150 m: back to every 30 m');
});

test('screen on while staying put far away: no new fix if there was one in the last 2 minutes', () => {
  const now = Date.UTC(2026, 9, 6, 19, 30, 0);
  const due = (ago) => run('watch_due.js', { now, globals: { BusPlaces: 'bus|S|S|51|0|50', BusStatePushMode: 'far',
    BusStateWindow: JSON.stringify([{ t: now - ago, lat: 51, lon: 0, acc: 30, spd: -1 }]) }, locals: { buscaller: 'profile=wake' } }).busquiet;
  assert.strictEqual(due(60000), 'yes');
  assert.strictEqual(due(180000), 'no');
});

// ---- Keeping buses TfL drops ---------------------------------------------------------------------

const base = () => ({ BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'Corvel Lodge School (opp)' });
const bus = (route, min, vehicle) => ({ lineName: route, destinationName: 'Wexley', timeToStation: Math.round(min * 60), vehicleId: vehicle });
function refresh(g, arrivals, now, code = '200') {
  const r = run('refresh.js', { globals: g, now, locals: { http_response_code: code, http_data: JSON.stringify(arrivals) } });
  const shown = JSON.parse(g.BusStateIslandData).b.slice().sort((a, b) => a.t - b.t);
  return { buzz: r.busbuzz, first: shown[0] ? `${shown[0].v} ${shown[0].st} ${Math.round((shown[0].t - now) / 60000)}` : '' };
}

test('a bus TfL drops while 7 minutes away stays on its countdown, with ~, for up to 3 minutes', () => {
  const g = base(); const t0 = Date.UTC(2026, 9, 6, 16, 4, 0);
  refresh(g, [bus('517', 7, 'LV1'), bus('517', 23, 'YY1')], t0);
  assert.strictEqual(refresh(g, [bus('517', 22, 'YY1')], t0 + 60000).first, 'LV1 sched 6');
  assert.strictEqual(refresh(g, [bus('517', 21, 'YY1')], t0 + 150000).first, 'LV1 sched 5');
  assert.strictEqual(refresh(g, [bus('517', 20, 'YY1')], t0 + 200000).first, 'YY1 live 20', 'over 3 minutes unseen: let go');
});

test('it buzzes as it passes 5 minutes, and its return is the second buzz', () => {
  const g = base(); const t0 = Date.UTC(2026, 9, 6, 16, 4, 0);
  refresh(g, [bus('517', 6, 'LV1')], t0);
  assert.strictEqual(refresh(g, [], t0 + 75000).buzz, 'yes', '4¾ minutes, kept');
  assert.strictEqual(refresh(g, [bus('517', 3.5, 'LV1')], t0 + 120000).buzz, 'yes', 'back on TfL\'s list');
});

test('one that drops out under 2 minutes away has probably gone, so it isn\'t kept', () => {
  const g = base(); const t0 = Date.UTC(2026, 9, 6, 16, 4, 0);
  refresh(g, [bus('517', 2.2, 'LV1'), bus('517', 15, 'YY1')], t0);
  assert.strictEqual(refresh(g, [bus('517', 14, 'YY1')], t0 + 45000).first, 'YY1 live 14');
});

test('TfL unreachable: the buses it last listed carry on (with ~) before the timetable is needed', () => {
  const g = base(); const t0 = Date.UTC(2026, 9, 6, 16, 4, 0);
  refresh(g, [bus('517', 9, 'LV1')], t0);
  assert.strictEqual(refresh(g, [], t0 + 45000, '').first, 'LV1 sched 8');
});

// ---- Buzz timing ----------------------------------------------------------------------------------

test('two refreshes 6 seconds apart: one buzz, the second waits for the next refresh', () => {
  const g = base(); const t0 = Date.UTC(2026, 9, 6, 16, 44, 48);
  assert.strictEqual(refresh(g, [bus('566', 4.7, 'LF1')], t0).buzz, 'yes');
  assert.strictEqual(refresh(g, [bus('566', 4.6, 'LF1')], t0 + 6000).buzz, 'no');
  assert.strictEqual(refresh(g, [bus('566', 4.0, 'LF1')], t0 + 40000).buzz, 'yes');
});

test('riding a bus to the stop: no buzz for the bus you are on; it starts once you are at the stop', () => {
  const g = Object.assign(base(), { BusStateTrip: JSON.stringify({ s: 'heading', stop: 'S', bus: true }) });
  const t0 = Date.UTC(2026, 9, 6, 16, 40, 0);
  assert.strictEqual(refresh(g, [bus('517', 2.5, 'YY1'), bus('566', 4.5, 'LF1')], t0).buzz, 'no');
  g.BusStateTrip = JSON.stringify({ s: 'atstop', stop: 'S' });
  assert.strictEqual(refresh(g, [bus('566', 4, 'LF1')], t0 + 180000).buzz, 'yes');
});

test('a bus that buzzed at one stop can buzz again at the next (each stop counts its own)', () => {
  const g = base(); const t0 = Date.UTC(2026, 9, 6, 16, 0, 0);
  refresh(g, [bus('517', 4, 'YY1')], t0); refresh(g, [bus('517', 3, 'YY1')], t0 + 45000);
  g.BusStateStopId = 'D';
  assert.strictEqual(refresh(g, [bus('517', 4, 'YY1')], t0 + 600000).buzz, 'yes');
});

// ---- The recorder ---------------------------------------------------------------------------------

test('every ending says why', () => {
  const end = (locals, extra) => {
    for (const k of Object.keys(files)) delete files[k];
    const g = Object.assign({ BusRecord: 'on', BusRecordDay: 'x', BusStateStopId: 'S' }, extra || {});
    run('end_log.js', { globals: g, locals });
    const last = Object.values(files)[0].trim().split('\n').pop();
    return JSON.parse(last);
  };
  assert.strictEqual(end({ busreason: 'wifi' }).from, 'wifi');
  assert.strictEqual(end({ busreason: 'timeout' }).why, 'time’s up');
  assert.strictEqual(end({ busreason: 'watch' }, { BusStateEndWhy: 'on the bus, away from High St' }).why, 'on the bus, away from High St');
  assert.strictEqual(end({ busfrom: 'island', busreason: '%par1' }).from, 'island');
  assert.strictEqual(end({ busreason: '%par1' }).from, 'unknown');
});

test('a change of Wi-Fi is recorded, as home / work / other (never the network\'s name)', () => {
  for (const k of Object.keys(files)) delete files[k];
  const g = { BusRecord: 'on', BusRecordDay: 'x', BusStateWifi: 'Virgin One', BusWorkWifi: 'Virgin One', BusHomeWifi: 'HomeNet' };
  run('wifi_save.js', { globals: g, locals: { busssid: '' } });
  const line = JSON.parse(Object.values(files)[0].trim().split('\n').pop());
  assert.deepStrictEqual([line.k, line.from, line.to], ['wifi', 'work', 'none']);
  assert.ok(!JSON.stringify(line).includes('Virgin'));
});

test('each check records the speed the rules used, and whether that looked like a bus', () => {
  for (const k of Object.keys(files)) delete files[k];
  trip([[0, 0, 30, { bearing: 0 }], [250, 30, 30, { bearing: 0 }]], world({ BusRecord: 'on', BusRecordDay: 'x' }));
  const line = JSON.parse(Object.values(files)[0].trim().split('\n').pop());
  assert.strictEqual(line.bus, 1);
  assert.ok(line.v > 8);
  assert.ok('rate' in line && 'settled' in line);
});
