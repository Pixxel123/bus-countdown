// The trip recorder: nothing is written unless it's turned on; each day's file starts with your
// setup; positions, decisions, TfL replies and buzzes each become a line; and a recorded day can be
// replayed (build/replay.js)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { run, m, files } = require('./harness');

const BASE = 51.37, LON = -0.08;
const at = Date.UTC(2026, 9, 6, 8, 20, 0);
const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(at).getDay()];
const FILE = `Download/bus-trip-${day}.jsonl`;
const world = (extra) => Object.assign({ BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|100`, BusNearRadius: '50', BusRoutes: '517', BusStateRunning: '0', TRUN: '' }, extra);
const check = (g, x, t, kmh) => run('watch.js', { globals: g, now: t, locals: { buscaller: 'profile=moved', gl_latitude: String(BASE + m(x)), gl_longitude: String(LON),
  gl_time_seconds: String(t / 1000), busspeed: String(kmh / 3.6), busbearing: '0', busacc: '12' } });
const lines = () => (files[FILE] || '').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('off (the default): nothing is written', () => {
  delete files[FILE];
  check(world(), -40, at, 0);
  assert.strictEqual(files[FILE], undefined);
});

test('on: the day starts with your setup, then a line per position with what was decided', () => {
  delete files[FILE];
  const g = world({ BusRecord: 'on' });
  check(g, -40, at, 0);
  check(g, -38, at + 30000, 0);
  const l = lines();
  assert.strictEqual(l[0].k, 'setup');
  assert.match(l[0].vars.BusPlaces, /High St/);
  assert.deepStrictEqual(l.slice(1).map((x) => x.k), ['check', 'check']);
  assert.strictEqual(l[1].action, 'start');
  assert.strictEqual(l[1].state, 'atstop');
  assert.ok(Math.abs(l[1].lat - (BASE + m(-40))) < 1e-5 && l[1].acc === 12);
});

test('a new day starts its weekday file afresh (so a week is kept)', () => {
  files[FILE] = 'last week\n';
  const g = world({ BusRecord: 'on', BusRecordDay: 'some other day' });
  check(g, -40, at, 0);
  assert.ok(!files[FILE].includes('last week'));
});

test('TfL replies are recorded with vehicles and seconds away; a buzz is recorded and logged', () => {
  delete files[FILE];
  const g = { BusRecord: 'on', BusRefresh: '45', BusRoutes: '517', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'High St (Stop S)' };
  run('refresh.js', { globals: g, now: at, locals: { http_response_code: '200', busstart: String(at - 800),
    http_data: JSON.stringify([{ lineName: '517', destinationName: 'Holbry', timeToStation: 240, vehicleId: 'BX1' }]) } });
  const l = lines();
  const tfl = l.find((x) => x.k === 'tfl'), buzz = l.find((x) => x.k === 'buzz');
  assert.deepStrictEqual(tfl.b, [['517', 'BX1', 240, 'l']]);
  assert.strictEqual(tfl.took, 800);
  assert.strictEqual(buzz.route, '517');
  assert.match(JSON.parse(g.BusDebugLog).join('\n'), /Buzz: 517 in 4 min \(1 of 2\)/);
});

test('a recorded day replays, and matches what was decided on the phone', () => {
  delete files[FILE];
  const g = world({ BusRecord: 'on' });
  [[-150, 0, 5], [-40, 60, 1], [-38, 30, 0], [-36, 30, 0]].reduce((t, [x, dt, kmh]) => {
    t += dt * 1000; const r = check(g, x, t, kmh);
    if (r.busaction === 'start' || r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    return t;
  }, at);
  const tmp = path.join(os.tmpdir(), 'bus-trip-test.jsonl');
  fs.writeFileSync(tmp, files[FILE]);
  const out = execFileSync('node', [path.join(__dirname, '..', 'build', 'replay.js'), tmp], { encoding: 'utf8' });
  assert.match(out, /4 positions replayed; 0 decided differently/);
});
