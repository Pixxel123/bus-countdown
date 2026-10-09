// V4.45: switching sides without waiting for TfL. After each refresh, while a countdown runs with the
// screen on, Bus Refresh gets the stop a long press goes to ready: its live times, and its timetable
// once a day for routes with no live time there. A long press then shows those times at once (as that
// stop's island data, which opposite.js shows since 4.43), and Bus Refresh builds the island from them
// instead of waiting for TfL.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 7, 30, 0);
const NEARBY = JSON.stringify([{ id: 'KH', name: 'Kiln Street (Stop KH)', dist: 20 }, { id: 'KJ', name: 'Kiln Street (Stop KJ)', dist: 45 }]);
const base = (extra) => Object.assign({ BusRoutes: '517,566', BusStateRunning: '1', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)',
  BusStateNearbyStops: NEARBY, BusStateStopIndex: '0' }, extra || {});
const reply = (list) => JSON.stringify(list.map(([k, m, v, d]) => ({ lineName: k, timeToStation: Math.round(m * 60), vehicleId: v, destinationName: d || 'X' })));

// ---- 1. Getting the next stop ready ----------------------------------------------------------------
test('the stop a long press goes to is got ready while a countdown runs with the screen on, unless its times are under 40 s old', () => {
  const due = (g) => run('prefetch_due.js', { globals: g, now: AT });
  assert.deepStrictEqual([due(base()).busprefetch, due(base()).busprestop, due(base()).busttstop], ['yes', 'KJ', 'KJ']);
  assert.strictEqual(due(base({ BusStatePrefetch: JSON.stringify({ s: 'KJ', at: AT - 30000, b: [] }) })).busprefetch, 'no');
  assert.strictEqual(due(base({ BusStatePrefetch: JSON.stringify({ s: 'KJ', at: AT - 50000, b: [] }) })).busprefetch, 'yes');
  assert.strictEqual(due(base({ BusStateNearbyStops: JSON.stringify([{ id: 'KH', name: 'Kiln Street (Stop KH)' }]) })).busprefetch, 'no', 'no other stop');
  assert.strictEqual(due(base({ BusStateRunning: '0' })).busprefetch, 'no', 'no countdown');
  assert.strictEqual(due(base({ SCREEN: 'off' })).busprefetch, 'no', 'the screen off: no one is about to switch');
  assert.strictEqual(due(base({ BusStateStopIndex: '1', BusStateStopId: 'KJ' })).busprestop, 'KH', 'and back again');
});

test('its reply is kept with each bus\'s expected time, and as that stop\'s island data', () => {
  const g = base({ BusStateIslandData: JSON.stringify({ r: 45000, rot: 6000, s: 'KH' }) });
  const r = run('prefetch_store.js', { globals: g, now: AT, locals: { http_response_code: '200', busprestop: 'KJ',
    http_data: reply([['517', 3, 'V1', 'Holbry'], ['289', 6, 'V2', 'Fernleigh'], ['517', 11, 'V3', 'Holbry'], ['517', 11.5, 'V3', 'Holbry'], ['517', 25, 'V4', 'Holbry']]) } });
  assert.deepStrictEqual(JSON.parse(g.BusStatePrefetch).b[0], ['517', 'V1', AT + 180000, 'Holbry']);
  const kj = JSON.parse(g.BusStateIslandByStop).KJ;
  assert.deepStrictEqual([kj.u, kj.s, kj.n, kj.l, kj.r], [AT, 'KJ', 'Kiln Street (Stop KJ)', 'KJ', 45000]);
  assert.deepStrictEqual(kj.b.map((b) => [b.k, (b.t - AT) / 60000, (b.t2 - AT) / 60000, (b.t3 - AT) / 60000]), [['517', 3, 11, 25]], 'the same bus listed twice counts once');
  assert.deepStrictEqual(kj.a, [{ k: '289', d: 'Fernleigh', t: [AT + 360000] }]);
  assert.strictEqual(r.busliveroutes, '517');
  run('prefetch_store.js', { globals: g, now: AT + 45000, locals: { http_response_code: '503', busprestop: 'KJ', http_data: '' } });
  assert.strictEqual(JSON.parse(g.BusStatePrefetch).at, AT, 'a failed fetch keeps the last');
});

test('its timetable is fetched for that stop, only for your routes with no live time there', () => {
  const g = base({ BusCacheStops: JSON.stringify({ KJ: { r: ['517', '566'] }, KH: { r: ['517', '566'] } }) });
  const t = run('tt_check.js', { globals: g, now: AT, locals: { busttstop: 'KJ', busliveroutes: '517' } });
  assert.deepStrictEqual([t.busttfetch, t.busttcount], ['yes', '1'], 'the 566 at KJ');
});

// ---- 2. A long press -------------------------------------------------------------------------------
test('a long press shows the stop got ready at once, with its times', () => {
  const g = base({ BusStateIslandByStop: JSON.stringify({ KJ: { u: AT - 20000, s: 'KJ', n: 'Kiln Street (Stop KJ)', l: 'KJ', b: [{ k: '517', t: AT + 120000, st: 'live' }], a: [] } }) });
  run('opposite.js', { globals: g, now: AT });
  const d = JSON.parse(g.BusStateIslandData);
  assert.deepStrictEqual([d.s, d.w, d.b.map((b) => b.k)], ['KJ', undefined, ['517']]);
});

test('Bus Refresh uses the kept times on a long press to that stop; anything else fetches as before', () => {
  const ready = JSON.stringify({ s: 'KJ', at: AT - 30000, b: [['517', 'V1', AT + 150000, 'Holbry']] });
  const due = (extra, par) => run('fetch_due.js', { globals: base(Object.assign({ BusStateStopId: 'KJ', BusStatePrefetch: ready }, extra)), now: AT, locals: { busrefby: 'task=Bus Island', busrefpar: par } }).busfresh;
  assert.strictEqual(due({}, 'switch'), 'cached');
  assert.strictEqual(due({ BusStatePrefetch: JSON.stringify({ s: 'KJ', at: AT - 95000, b: [] }) }, 'switch'), 'no', 'over 90 s old: fetch');
  assert.strictEqual(due({ BusStateStopId: 'KX' }, 'switch'), 'no', 'a stop that was not got ready');
  assert.strictEqual(due({}, 'open'), 'no', 'only a switch');
});

test('the kept times become a reply from now; the island is built from it; the 20 s skip and the recording know its age', () => {
  const g = base({ BusStateStopId: 'KJ', BusStateStopName: 'Kiln Street (Stop KJ)', BusStateStopIndex: '1', BusRecord: 'on', BusRecordDay: '2026-10-9',
    BusStatePrefetch: JSON.stringify({ s: 'KJ', at: AT - 30000, b: [['517', 'V1', AT + 150000, 'Holbry'], ['289', 'V2', AT + 400000, 'Fernleigh'], ['566', 'V3', AT - 120000, 'Wexley']] }) });
  const r = run('prefetch_use.js', { globals: g, now: AT });
  assert.deepStrictEqual(JSON.parse(r.http_data).map((a) => [a.lineName, a.timeToStation]), [['517', 150], ['289', 400]], 'gone buses left out');
  const out = run('refresh.js', { globals: g, now: AT, locals: { http_response_code: r.http_response_code, http_data: r.http_data, buscachedat: r.buscachedat } });
  const data = JSON.parse(g.BusStateIslandData);
  assert.deepStrictEqual([data.s, data.b.map((b) => b.k), data.a.map((a) => a.k)], ['KJ', ['517'], ['289']]);
  assert.strictEqual(g.BusStateFetchAt, String(AT - 30000), 'Bus Loop fetches fresh times as soon as it would have');
  const line = out.busrecline.split('\n').map((l) => JSON.parse(l)).filter((l) => l.k === 'tfl').pop();
  assert.strictEqual(line.cached, 30);
});

// ---- 3. In the project ---------------------------------------------------------------------------
const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const body = [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes('<nme>Bus Refresh</nme>'));
const steps = [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => a[1]);
const at = (re) => steps.findIndex((x) => re.test(x));

test('Bus Refresh: kept times instead of the fetch on a long press, and the next stop got ready last of all', () => {
  const useIt = at(/Use them, rather than wait for TfL/), fetchNow = at(/StopPoint\/%BusStateStopId\/Arrivals/), build = at(/Build the departures/);
  assert.ok(useIt > -1 && useIt < fetchNow && fetchNow < build, 'one or the other, then the island is built');
  const tt = at(/Times were just fetched: timetable needed too/), due = at(/Get the stop a long press goes to ready/), other = at(/StopPoint\/%busprestop\/Arrivals/), keep = at(/Keep them for a long press/);
  assert.ok(tt > -1 && tt < due && due < other && other < keep, 'after the island and its own timetable');
  assert.ok(steps.some((x) => /Timetable\/%busttstop/.test(x)), 'its timetable too');
});
