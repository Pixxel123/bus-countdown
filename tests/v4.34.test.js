// V4.34: only a bus you were seen getting on counts as yours; Bus Refresh doesn't fetch twice within
// 20 s; and the travel mode (still, walking or riding) is worked out and recorded, on trial.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { run, m, compose, files } = require('./harness');
const { replay } = require('../build/replay-core');

const T0 = Date.UTC(2026, 9, 7, 8, 0, 0);
const LAT = 51.33, LON = -0.11;
const base = (extra) => Object.assign({ BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)' }, extra);
const bus = (route, min, vehicle) => ({ lineName: route, destinationName: 'Wexley', timeToStation: Math.round(min * 60), vehicleId: vehicle });
const ridingTo = (etaMin, now) => JSON.stringify({ s: 'heading', stop: 'KH', bus: true, eta: now + etaMin * 60000, etaAt: now });
function refresh(g, arrivals, now, code = '200') {
  const r = run('refresh.js', { globals: g, now, locals: { http_response_code: code, http_data: code === '200' ? JSON.stringify(arrivals) : '' } });
  return { buzz: r.busbuzz, shown: JSON.parse(g.BusStateIslandData).b.map((b) => b.v), idle: JSON.parse(g.BusStateIslandData).b.filter((b) => b.idle).map((b) => b.v) };
}

// ---- 1. Wednesday at Kiln Street ------------------------------------------------------------------
test('on a tram into Kiln Street, your arrival matches the 566 you are about to catch: it stays on the island, not greyed', () => {
  const g = base(); let now = T0; let r;
  for (const [eta, owe, ovw] of [[3.2, 3.7, 7.6], [2.4, 2.9, 6.8], [1.6, 2.6, 6.1]]) {
    g.BusStateTrip = ridingTo(eta, now);
    r = refresh(g, [bus('566', owe, 'WD21TSS'), bus('566', ovw, 'NA39ECX'), bus('517', 27, 'WA84SAE')], now);
    now += 45000;
  }
  const match = JSON.parse(g.BusStateMatch);
  assert.strictEqual(match.v, 'WD21TSS', 'still worked out, for Bus Status and the recording');
  assert.strictEqual(match.sure, false, 'but only as "probably": you were never seen getting on it');
  assert.ok(r.shown.includes('WD21TSS'), 'the bus you are about to catch is on the island');
  assert.deepStrictEqual(r.idle, [], 'and the next 566 is not greyed out');
  assert.strictEqual(r.buzz, 'no', 'nothing buzzes while you ride, as when your bus is not known');
  assert.match(match.note, /^probably on the 566 \(WD21TSS\)/);
});

test('the same ride, having been seen getting on WD21TSS: it is yours, and leaves the island as before', () => {
  const g = base({ BusStateBoarded: JSON.stringify({ k: '566', v: 'WD21TSS', stop: 'U', at: T0 - 300000 }), BusStateTrip: ridingTo(3, T0) });
  const r = refresh(g, [bus('566', 3, 'WD21TSS'), bus('566', 7.6, 'NA39ECX'), bus('517', 9, 'WG84LLS')], T0);
  assert.strictEqual(JSON.parse(g.BusStateMatch).sure, true);
  assert.deepStrictEqual(r.shown, ['NA39ECX', 'WG84LLS']);
  assert.deepStrictEqual(r.idle, ['NA39ECX']);
});

// ---- 2. A crawl in traffic no longer forgets the bus you got on ------------------------------------
const crawlWorld = (lastBusAgo) => ({ BusPlaces: `bus|M|Corvel Lodge (opp)|${LAT}|${LON}|70`, BusRoutes: '517', BusStateRunning: '0', TRUN: '',
  BusStateTrip: JSON.stringify({ s: 'left', stop: 'M', since: T0 - 16 * 60000 }), BusStateLastBusAt: String(T0 - lastBusAgo),
  BusStateBoarded: JSON.stringify({ k: '517', v: 'LA28LPG', stop: 'M', at: T0 - 20 * 60000 }) });
const crawl = (g) => run('watch.js', { globals: g, now: T0, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(4000)), gl_longitude: String(LON), gl_time_seconds: String(T0 / 1000), busspeed: '1', busacc: '12' } });
test('15 minutes after "leaving", still on the bus (at bus speed in the last 5 minutes): the bus you got on is kept', () => {
  const g = crawlWorld(60000); crawl(g);
  assert.strictEqual(JSON.parse(g.BusStateTrip).s, 'idle');
  assert.strictEqual(JSON.parse(g.BusStateBoarded).v, 'LA28LPG');
});
test('15 minutes after leaving, and no bus speed lately: the trip is over and the bus is forgotten (as in 4.32)', () => {
  const g = crawlWorld(10 * 60000); crawl(g);
  assert.strictEqual(g.BusStateBoarded, '');
});

// ---- 3. Tuesday, replayed ------------------------------------------------------------------------
const tue = fs.readFileSync(path.join(__dirname, 'fixtures', 'tue-6-oct-excerpts.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const out = replay(tue).out;
const clock = (o) => new Date(o.t + 3600000).toISOString().slice(11, 19);
const at = (hms, k) => out.find((o) => clock(o) === hms && (!k || o.k === k));
test('Tuesday 17:20:31: an ending with no reason that no position on the phone caused is played as it happened', () => {
  // (The position a second later decided nothing; only an ending just after a position that stopped
  // the countdown is left to today's rules)
  assert.ok(at('17:20:31', 'end'), 'played');
  assert.strictEqual(at('17:20:32', 'check').state, 'left');
});
test('Tuesday 17:41 into Wexley: LA28LPG, seen being got on since 4.40, is yours and leaves the island', () => {
  // (4.34 to 4.39 never saw you get on at Corvel Lodge, so it was "probably" yours and stayed on the
  // island; a bus only matched on arrival time still does: see the tram case below)
  const o = at('17:41:39', 'tfl');
  assert.deepStrictEqual([o.match.v, o.match.by, o.match.sure], ['LA28LPG', 'boarded', true]);
  assert.ok(!o.shown.includes('LA28LPG'));
  assert.strictEqual(o.buzz, 'no');
});

// ---- 3b. A boarding worked out with a "probably" bus's help isn't sure either -----------------------
const seen = (now, list) => JSON.stringify({ s: 'KH', b: list.map(([k, v, inSec, gone]) => Object.assign({ k, v, d: 'X', t: now + inSec * 1000, seen: now - 20000 }, gone ? { gone: true } : {})) });
const boardAt = (cameOnSure) => {
  const now = T0;
  const g = { BusPlaces: `bus|KH|Kiln Street (Stop KH)|${LAT}|${LON}|50`, BusRoutes: '566,517', BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'KH',
    BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'KH', since: now - 240000 }),
    BusStateWindow: JSON.stringify([[70, 0, 0], [45, 2, 0], [12, 40, 6]].map(([s, d, v]) => ({ t: now - s * 1000, lat: +(LAT + m(d)).toFixed(6), lon: LON, acc: 10, spd: v }))),
    BusStateCameOn: JSON.stringify({ k: '566', v: 'WD21TSS', stop: 'KH', at: now - 250000, sure: cameOnSure }),
    BusStateSeen: seen(now, [['566', 'WD21TSS', -40], ['566', 'NA39ECX', 300]]) };
  run('watch.js', { globals: g, now, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(160)), gl_longitude: String(LON), gl_time_seconds: String(now / 1000), busspeed: '8', busacc: '10' } });
  return JSON.parse(g.BusStateBoarded || 'null');
};
test('the tram case: a "probably" bus you came in on can make the wrong bus look boarded, so that boarding is saved as not sure', () => {
  const b = boardAt(false);
  assert.ok(b, 'a bus is still noted');
  assert.strictEqual(b.sure, false);
  const g = base({ BusStateBoarded: JSON.stringify(b), BusStateTrip: ridingTo(3, T0 + 60000) });
  const r = refresh(g, [bus('566', 3, b.v), bus('517', 9, 'WG84LLS')], T0 + 60000);
  assert.strictEqual(JSON.parse(g.BusStateMatch).sure, false, 'so it hides nothing at the next stop');
  assert.ok(r.shown.includes(b.v));
});
test('the bus you came in on for sure: the boarding is sure too (as in 4.33)', () => {
  assert.strictEqual(boardAt(true).sure, true);
});
test('kept through a crawl, the bus you got on goes once you have been off bus speed for 5 minutes', () => {
  const g = crawlWorld(60000); crawl(g);
  assert.ok(g.BusStateBoarded);
  g.BusStateLastBusAt = String(T0 - 6 * 60000);
  run('watch.js', { globals: g, now: T0 + 20000, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(4010)), gl_longitude: String(LON), gl_time_seconds: String((T0 + 20000) / 1000), busspeed: '1', busacc: '12' } });
  assert.strictEqual(g.BusStateBoarded, '');
});

// ---- 4. No second fetch within 20 s ----------------------------------------------------------------
// (Bus Refresh copies %caller1 into %busrefby: scripts can't read %caller1 itself)
const due = (g, caller, now) => run('fetch_due.js', { globals: g, now, locals: { busrefby: caller } }).busfresh;
test('Bus Loop or the screen coming on within 20 s of the last fetch for this stop: skipped', () => {
  const g = { BusStateStopId: 'G', BusStateFetchStop: 'G', BusStateFetchAt: String(T0) };
  assert.deepStrictEqual([due(g, 'task=Bus Loop', T0 + 10000), due(g, 'task=Bus Wake', T0 + 19000)], ['yes', 'yes']);
  assert.strictEqual(due(g, 'task=Bus Loop', T0 + 25000), 'no', '25 s on: TfL has new times');
});
test('switching stop, a Settings preview or a run by hand always fetches', () => {
  const g = { BusStateStopId: 'D', BusStateFetchStop: 'G', BusStateFetchAt: String(T0) };
  assert.strictEqual(due(g, 'task=Bus Loop', T0 + 5000), 'no', 'a different stop');
  g.BusStateStopId = 'G';
  assert.deepStrictEqual([due(g, 'task=Bus Island', T0 + 5000), due(g, 'task=Bus Settings', T0 + 5000), due(g, '', T0 + 5000)], ['no', 'no', 'no']);
});
test('Bus Refresh notes when times last arrived, but not after a failed fetch', () => {
  const g = base(); refresh(g, [bus('517', 4, 'YY1')], T0);
  assert.deepStrictEqual([g.BusStateFetchAt, g.BusStateFetchStop], [String(T0), 'KH']);
  refresh(g, [], T0 + 30000, '');
  assert.strictEqual(g.BusStateFetchAt, String(T0));
});
test('in the project: %caller1 copied, the check, then fetching to buzzing skipped together inside one If; the island block outside it', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
  const task = xml.slice(xml.indexOf('<nme>Bus Refresh</nme>'));
  const acts = [...task.slice(0, task.indexOf('</Task>')).matchAll(/<Action sr="act\d+" ve="\d+">[\s\S]*?<\/Action>/g)].map((x) => x[0]);
  const idx = (re) => acts.findIndex((a) => re.test(a));
  const iCopy = idx(/<Str sr="arg0" ve="3">%busrefby<\/Str>[\s\S]*<Str sr="arg1" ve="3">%caller1<\/Str>/), iCheck = idx(/Fetched these times under 20 s ago/);
  const iIf = idx(/<code>37<\/code>[\s\S]*<lhs>%busfresh<\/lhs><op>3<\/op><rhs>yes<\/rhs>/);
  const iHttp = idx(/StopPoint\/%BusStateStopId\/Arrivals/), iIsland = idx(/Island not up yet/);
  assert.ok(iCopy >= 0 && iCopy < iCheck && iCheck < iIf && iIf < iHttp && iHttp < iIsland, [iCopy, iCheck, iIf, iHttp, iIsland].join(' '));
  // Nesting: count If (37) and End If (38) between the busfresh If and the island step: back to level 0
  let depth = 0;
  for (let i = iIf; i < iIsland; i++) { if (/<code>37<\/code>/.test(acts[i])) depth++; if (/<code>38<\/code>/.test(acts[i])) depth--; }
  assert.strictEqual(depth, 0, 'the busfresh If is closed before the island block');
});

// ---- 5. Travel mode, on trial ------------------------------------------------------------------------
const ctx = { Math, JSON, setGlobal: (k, v) => { ctx.G[k] = String(v); }, get: (k) => ctx.G[k] || '', G: {} };
vm.createContext(ctx); vm.runInContext(compose('/* @include metres */\n/* @include travelMode */'), ctx);
const ride = (points) => { ctx.G = {}; return points.map(([t, metresNorth, acc]) => ctx.travelMode(T0 + t * 1000, LAT + m(metresNorth), LON, acc)); };
const rnd = (i) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
test('sitting indoors, the position wandering 30–60 m: still', () => {
  const r = ride(Array.from({ length: 40 }, (_, i) => [i * 20, (rnd(i) - 0.5) * 60, 25]));
  assert.ok(r.slice(10).every((x) => x.mode === 'still'), r.map((x) => x.mode).join(' '));
});
test('walking at 1.3 m/s: walking', () => {
  const r = ride(Array.from({ length: 30 }, (_, i) => [i * 15, i * 15 * 1.3 + (rnd(i) - 0.5) * 10, 10]));
  assert.ok(r.slice(8).filter((x) => x.mode === 'walk').length >= 20, r.map((x) => x.mode).join(' '));
});
test('on a bus that stops every few hundred metres: riding throughout, red lights included', () => {
  let x = 0; const pts = [];
  for (let i = 0; i < 60; i++) { const stopped = i % 8 >= 6; x += stopped ? 0 : 20 * 6; pts.push([i * 20, x + (rnd(i) - 0.5) * 16, 12]); }
  const r = ride(pts);
  assert.ok(r.slice(6).every((p) => p.mode === 'ride'), r.map((p) => p.mode).join(' '));
});
test('the same position twice changes nothing; a gap of over 5 minutes starts again', () => {
  ctx.G = {};
  const a = ctx.travelMode(T0, LAT, LON, 10); const kf = ctx.G.BusStateKF;
  assert.strictEqual(JSON.stringify(ctx.travelMode(T0, LAT, LON, 10)), JSON.stringify(a)); assert.strictEqual(ctx.G.BusStateKF, kf);
  ctx.travelMode(T0 + 20000, LAT + m(150), LON, 10);
  const later = ctx.travelMode(T0 + 20000 + 6 * 60000, LAT + m(3000), LON, 10);
  assert.strictEqual(later.nv, 0, 'no speed made up across the gap');
});
test('a stored state of the wrong shape starts it again rather than switching it off for good', () => {
  for (const bad of ['"abc"', '{}', '[]', '5']) { ctx.G = { BusStateKF: bad }; const r = ctx.travelMode(T0, LAT, LON, 10); assert.strictEqual(r.mode, 'still', bad); }
});
test('Tuesday, replayed: riding the 517 reads as riding; waiting at Corvel Lodge as still; and nothing it says changes a decision', () => {
  const checks = (a, b) => out.filter((o) => o.k === 'check' && clock(o) >= a && clock(o) <= b);
  const rideChecks = checks('17:22:00', '17:29:40');
  assert.ok(rideChecks.filter((o) => o.mode === 'ride').length >= rideChecks.length - 1, rideChecks.map((o) => o.mode).join(' '));
  const wait = checks('17:15:00', '17:17:40');
  assert.ok(wait.every((o) => o.mode === 'still'), wait.map((o) => o.mode).join(' '));
  // Record-only: nothing outside the recording and Bus Status reads it
  const scripts = path.join(__dirname, '..', 'scripts');
  const code = (f) => fs.readFileSync(path.join(scripts, f), 'utf8').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const uses = code('watch.js').split('\n').filter((l) => /tmode/.test(l));
  assert.ok(uses.every((l) => /^var tmode = null;|tmode = travelMode\(|tmode \? tmode\./.test(l.trim())), 'only declared, set, and written to the recording:\n' + uses.join('\n'));
  const readers = fs.readdirSync(scripts).filter((f) => f.endsWith('.js') && /BusStateMode|BusStateKF/.test(code(f)));
  assert.deepStrictEqual(readers.sort(), ['status.js', 'watch.js']);
});
test('the recording carries the travel mode with every position', () => {
  const g = { BusPlaces: `bus|S|High St (Stop S)|${LAT}|${LON}|100`, BusNearRadius: '50', BusRoutes: '517', BusStateRunning: '0', TRUN: '', BusRecord: 'on' };
  for (const k of Object.keys(files)) delete files[k];
  run('watch.js', { globals: g, now: T0, locals: { buscaller: 'profile=moved', gl_latitude: String(LAT + m(-400)), gl_longitude: String(LON), gl_time_seconds: String(T0 / 1000), busspeed: '', busacc: '12' } });
  const line = Object.values(files).join('').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.k === 'check');
  assert.ok(line && line.mode === 'still' && Array.isArray(line.mp) && line.kv === 0, JSON.stringify(line));
});
