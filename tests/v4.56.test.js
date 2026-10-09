// V4.56: switching to the other side of the road as the hold ends. The island's data carries the stop a
// long press goes to (nx: its island data, as opposite.js shows it), so the page shows it the moment
// the hold is long enough, then tells Tasker. And a stop switched to with its times shows its route and
// times at once, sliding in, rather than its name on the left for 0.6 s: measured on 9 October, a
// switch took 1.6 s from finger down, 0.25 to 0.4 s of it dimmed while Tasker ran opposite.js and 0.8 s
// of it the name ("opp · Mar…", which said nothing the destination didn't).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, runPage } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 13, 13, 0);
const min = (m) => AT + m * 60000;
const KH = { id: 'KH', name: 'Kiln Street (Stop KH)', dist: 20 };
const KJ = { id: 'KJ', name: 'Kiln Street (Stop KJ)', dist: 45 };
const KX = { id: 'KX', name: 'Kiln Street (Stop KX)', dist: 160 };
const isl = (s, n, b, extra) => Object.assign({ u: AT, r: 45000, rot: 6000, s, n, l: '', b, a: [] }, extra || {});
const DKH = isl('KH', KH.name, [{ k: '566', d: 'Wexley', t: min(8), st: 'live' }]);
const DKJ = isl('KJ', KJ.name, [{ k: '566', d: 'Purley', t: min(2), st: 'live', t2: min(15) }]);

// ---- 1. The island's data carries the next stop -------------------------------------------------------
function refreshed(extra) {
  const g = Object.assign({ BusRefresh: '45', BusRoutes: '566', BusStyle: 'pill', BusStateStopId: 'KH', BusStateStopName: KH.name,
    BusStateNearbyStops: JSON.stringify([KH, KJ]), BusStateStopIndex: '0',
    BusStateIslandByStop: JSON.stringify({ KJ: Object.assign({}, DKJ, { u: AT - 30000 }) }) }, extra || {});
  run('refresh.js', { globals: g, now: AT, locals: { http_response_code: '200',
    http_data: JSON.stringify([{ lineName: '566', destinationName: 'Wexley', timeToStation: 480, vehicleId: 'V1' }]) } });
  return g;
}

test('refresh.js: the island\'s data carries the stop a long press goes to, with its times', () => {
  const d = JSON.parse(refreshed().BusStateIslandData);
  assert.strictEqual(d.s, 'KH');
  assert.deepStrictEqual([d.nx.s, d.nx.n, d.nx.w, d.nx.b.map((b) => b.d)], ['KJ', KJ.name, undefined, ['Purley']]);
});

test('refresh.js: its times over 3 minutes old, or none: its name, waiting for times (as opposite.js shows it)', () => {
  const old = refreshed({ BusStateIslandByStop: JSON.stringify({ KJ: Object.assign({}, DKJ, { u: AT - 200000 }) }) });
  assert.deepStrictEqual([JSON.parse(old.BusStateIslandData).nx.s, JSON.parse(old.BusStateIslandData).nx.w], ['KJ', 1]);
  const none = refreshed({ BusStateIslandByStop: '' });
  assert.deepStrictEqual([JSON.parse(none.BusStateIslandData).nx.s, JSON.parse(none.BusStateIslandData).nx.b], ['KJ', []]);
});

test('refresh.js: only one stop nearby, no next stop; and the kept island data never nests one', () => {
  const one = refreshed({ BusStateNearbyStops: JSON.stringify([KH]) });
  assert.strictEqual(JSON.parse(one.BusStateIslandData).nx, undefined);
  const g = refreshed();
  const byStop = JSON.parse(g.BusStateIslandByStop);
  assert.ok(Object.values(byStop).every((d) => !('nx' in d)), 'BusStateIslandByStop holds no nx');
});

test('the next stop is the one after the current, wrapping round (three stops)', () => {
  const g = refreshed({ BusStateNearbyStops: JSON.stringify([KH, KJ, KX]), BusStateStopIndex: '2', BusStateStopId: 'KX', BusStateStopName: KX.name });
  assert.strictEqual(JSON.parse(g.BusStateIslandData).nx.s, 'KH');
});

test('prefetch_store.js: the times just got ready for the next stop go straight into the island\'s data, nothing else changes', () => {
  const g = refreshed({ BusStateIslandByStop: '' });
  const before = JSON.parse(g.BusStateIslandData);
  run('prefetch_store.js', { globals: g, now: AT + 1000, locals: { http_response_code: '200', busprestop: 'KJ',
    http_data: JSON.stringify([{ lineName: '566', destinationName: 'Purley', timeToStation: 120, vehicleId: 'V2' }]) } });
  const after = JSON.parse(g.BusStateIslandData);
  assert.deepStrictEqual([after.nx.s, after.nx.w, after.nx.b.map((b) => b.v)], ['KJ', undefined, ['V2']]);
  delete before.nx; delete after.nx;
  assert.deepStrictEqual(after, before);
  assert.deepStrictEqual(Object.keys(JSON.parse(g.BusStateIslandData)), Object.keys(JSON.parse(JSON.stringify(Object.assign(before, { nx: 1 })))), 'in the same order, so the page sees only nx change');
});

test('opposite.js: the stop switched to, carrying the one after it (with two stops, the one you left)', () => {
  const g = { BusStateNearbyStops: JSON.stringify([KH, KJ]), BusStateStopIndex: '0', BusStateStopId: 'KH',
    BusStateIslandData: JSON.stringify(DKH), BusStateIslandByStop: JSON.stringify({ KH: DKH, KJ: DKJ }) };
  run('opposite.js', { globals: g, now: AT });
  const d = JSON.parse(g.BusStateIslandData);
  assert.deepStrictEqual([g.BusStateStopId, d.s, d.nx.s, d.nx.b.map((b) => b.d)], ['KJ', 'KJ', 'KH', ['Wexley']]);
});

// ---- 2. The page ------------------------------------------------------------------------------------
const G = (data) => ({ BusRoutes: '566', BusDestLetters: '3', BusScreenW: '448', BusCameraX: '224', BusStateBoard: '0',
  BusStateIslandData: JSON.stringify(data) });
const pEl = (page) => page.ctx.document.getElementById('p');
const switched = (page) => page.calls.filter((c) => c[0] === 'runTask' && c[1].variables.busisland === 'switch').length;

test('the page, run: a hold switches to the next stop itself, the moment it is long enough, then tells Tasker', () => {
  const page = runPage(G(Object.assign({}, DKH, { nx: DKJ })), AT);
  assert.match(page.L.innerHTML, /Wex/);
  page.hold(450);
  assert.match(page.L.innerHTML, /566/, 'its route');
  assert.match(page.L.innerHTML, /Pur/, 'and destination, at once');
  assert.doesNotMatch(page.L.innerHTML, /Kiln Street/, 'not its name');
  assert.match(page.R.innerHTML, /2/, 'its times');
  assert.ok(!pEl(page).classList.contains('wait'), 'not dimmed: nothing to wait for');
  assert.strictEqual(switched(page), 1, 'Tasker is told, to make it the current stop');
});

test('the page, run: Tasker\'s own update for the same stop then changes nothing you can see', () => {
  const page = runPage(G(Object.assign({}, DKH, { nx: DKJ })), AT);
  page.hold(450);
  const before = page.L.innerHTML;
  page.push(Object.assign({}, DKJ, { nx: DKH }));             // opposite.js
  assert.strictEqual(page.L.innerHTML, before);
  page.advance(700);
  assert.match(page.L.innerHTML, /Pur/);
});

test('the page, run: the next stop still waiting for its times shows its name at once', () => {
  const page = runPage(G(Object.assign({}, DKH, { nx: isl('KJ', KJ.name, [], { w: 1 }) })), AT);
  page.hold(450);
  assert.match(page.L.innerHTML, /Stop KJ/);
  assert.match(page.R.innerHTML, /Kiln Street/);
});

test('the page, run: no next stop in its data (only one stop, or older data): it waits for Tasker, as before', () => {
  const page = runPage(G(DKH), AT);
  page.hold(450);
  assert.ok(pEl(page).classList.contains('wait'));
  assert.strictEqual(switched(page), 1);
  page.push(DKJ);
  assert.ok(!pEl(page).classList.contains('wait'));
});

test('the page, run: a stop switched to with its times shows its route at once (no name first), sliding in', () => {
  const page = runPage(G(DKH), AT);
  page.push(DKJ);
  assert.match(page.L.innerHTML, /566/);
  assert.match(page.L.innerHTML, /Pur/);
  assert.doesNotMatch(page.L.innerHTML, /Kiln Street/);
});

test('the page, run: only the next stop\'s times changing (prefetch_store.js) doesn\'t restart the route\'s turn', () => {
  const two = Object.assign({}, DKH, { b: [DKH.b[0], { k: '517', d: 'Holbry', t: min(12), st: 'live' }] });
  const page = runPage(G(Object.assign({}, two, { nx: isl('KJ', KJ.name, [], { w: 1 }) })), AT);
  page.advance(4000);
  page.push(Object.assign({}, two, { nx: DKJ }));
  page.advance(2100);
  assert.match(page.L.innerHTML, /517/, 'the next route came on time, 6 s after the first');
  page.hold(450);
  assert.match(page.L.innerHTML, /Pur/, 'and a hold uses the times just got ready');
});
