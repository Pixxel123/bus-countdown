// V4.48: the island is sized for Android's font size (115% on the phone: the page drew its text 15%
// bigger than the widths were measured at, so "3 · 14 min" showed as "3 · 14 m"); a stop switched to
// with its times shows them at once, with its name on the left for 0.6 s instead of over the whole
// island for 1.2 s; a long press is 450 ms, not 550; and Settings' preview draws the island at
// its board's width, so the board appears over it without a step.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, runPage } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 11, 0, 0);
const min = (m) => AT + m * 60000;
const stop = (s, n, b) => ({ u: AT, r: 45000, rot: 6000, s, n, l: '', b, a: [] });
const KH = stop('KH', 'Kiln Street (Stop KH)', [{ k: '566', d: 'Wexley', t: min(3), st: 'live' }, { k: '517', d: 'Holbry', t: min(14), st: 'live' }]);
const KJ = stop('KJ', 'Kiln Street (Stop KJ)', [{ k: '566', d: 'Purley', t: min(4), st: 'live', t2: min(14) }]);
const G = (extra) => Object.assign({ BusRoutes: '517,566', BusDestLetters: '3', BusScreenW: '448', BusCameraX: '224',
  BusStateBoard: '0', BusStateIslandData: JSON.stringify(KH) }, extra || {});
const w = (t, zoom) => Math.ceil(t.length * 8.4 * (zoom || 1));      // the harness's text width (no canvas)

// ---- 1. Android's font size ------------------------------------------------------------------------
test('every width is measured at the font size the page draws at (BusStateTextZoom)', () => {
  const plain = run('island_show.js', { now: AT, globals: G() });
  const big = run('island_show.js', { now: AT, globals: G({ BusStateTextZoom: '1.15' }) });
  // The right half: the widest time ("14 min"), 4 dp, and two route dots with 10 dp before them
  assert.strictEqual(plain.RIGHT, w('14 min') + 4 + 21);
  assert.strictEqual(big.RIGHT, w('14 min', 1.15) + 4 + 21);
  assert.ok(big.LEFT > plain.LEFT, `left half ${big.LEFT} dp at 115%, ${plain.LEFT} dp at 100%`);
  assert.match(big.html, /var ZOOM_SIZED = 1\.15;/);
});

test('Bus Refresh fits the island at that size too', () => {
  const g = G({ BusStateTextZoom: '1.15', BusStateRunning: '1', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)',
    BusStateIslandShown: '0' });
  const tfl = JSON.stringify([{ lineName: '566', vehicleId: 'V1', timeToStation: 180, destinationName: 'Wexley' },
    { lineName: '517', vehicleId: 'V2', timeToStation: 840, destinationName: 'Holbry' }]);
  run('refresh.js', { now: AT, globals: g, locals: { http_response_code: '200', http_data: tfl } });
  assert.strictEqual(+g.BusStateIslandRight, w('14 min', 1.15) + 4 + 21);
});

test('the page, run: a second after it appears, it measures the minutes it drew, and asks for the island again only if it was sized for another', () => {
  const asked = (page) => page.calls.filter((c) => c[0] === 'runTask' && c[1].variables.busisland === 'zoom').map((c) => c[1].variables);
  const after = (page, ms) => { page.flush(ms); return asked(page); };
  const page = runPage(G(), AT, { zoom: 1.15 });
  assert.deepStrictEqual(after(page, 999), [], 'not while the Bus Refresh that drew it may still be removing the old one');
  assert.deepStrictEqual(after(page, 1000), [{ busisland: 'zoom', buszoom: '1.15' }]);
  assert.deepStrictEqual(after(runPage(G({ BusStateTextZoom: '1.15' }), AT, { zoom: 1.15 }), 1000), [], 'sized for it already');
  assert.deepStrictEqual(after(runPage(G(), AT, { zoom: 1 }), 1000), [], 'Android at 100%');
  assert.deepStrictEqual(after(runPage(G(), AT), 1000), [], 'nothing to measure');
  assert.deepStrictEqual(after(runPage(G(), AT, { zoom: 3 }), 1000), [{ busisland: 'zoom', buszoom: '2' }], 'kept within 0.8 to 2, as the builder reads it');
});

const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const taskBody = (name) => [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes(`<nme>${name}</nme>`));
const steps = (name) => [...taskBody(name).matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => a[1]);

test('Bus Island keeps the size the page found, and has the island fitted afresh and drawn again, only if it is a new one', () => {
  const s = steps('Bus Island');
  const at = (re) => s.findIndex((x) => re.test(x));
  const zoom = at(/<lhs>%busisland<\/lhs><op>2<\/op><rhs>zoom<\/rhs>/), changed = at(/<lhs>%buszoom<\/lhs><op>3<\/op><rhs>%BusStateTextZoom<\/rhs>/);
  const keep = at(/<Str sr="arg0" ve="3">%BusStateTextZoom<\/Str>/), afresh = at(/<Str sr="arg0" ve="3">%BusStateIslandRight<\/Str>/);
  const asFit = at(/Draw it again at its new width/), what = at(/What to do: as asked/);
  assert.ok(zoom > -1 && zoom < changed && changed < keep && keep < afresh && afresh < asFit && asFit < what, 'inside both Ifs, before deciding what to do');
  assert.deepStrictEqual([s[asFit + 1], s[asFit + 2]].map((x) => +x.match(/<code>(\d+)<\/code>/)[1]), [38, 38], 'then both End Ifs');
  assert.match(s[keep], /%buszoom/);
  assert.match(s[afresh], /<Str sr="arg1" ve="3">0<\/Str>/);
});

// ---- 2. Switching stop ------------------------------------------------------------------------------
test('the page, run: a stop switched to with its times shows them at once, its name on the left for 0.6 s', () => {
  const page = runPage(G(), AT);
  page.push(KJ);
  assert.match(page.L.innerHTML, /Stop KJ · Kiln Street/);
  assert.match(page.R.innerHTML, /4/, 'its times already');
  assert.doesNotMatch(page.R.innerHTML, /Kiln Street/);
  page.advance(650);
  assert.match(page.L.innerHTML, /566/, 'then its first route');
  assert.doesNotMatch(page.L.innerHTML, /Kiln Street/);
});

test('the page, run: still waiting for its times, the whole island shows its name until they come', () => {
  const page = runPage(G(), AT);
  page.push(Object.assign({}, KJ, { b: [], w: 1 }));
  assert.match(page.L.innerHTML, /Stop KJ/);
  assert.match(page.R.innerHTML, /Kiln Street/);
  page.advance(1300);
  assert.match(page.R.innerHTML, /Kiln Street/, 'no times yet');
  page.push(KJ);
  assert.match(page.R.innerHTML, /4/);
});

test('the page, run: a long press is 450 ms', () => {
  const switched = (page) => page.calls.some((c) => c[0] === 'runTask' && c[1].variables.busisland === 'switch');
  const page = runPage(G(), AT);
  page.hold(449);
  assert.ok(!switched(page), 'not yet');
  page.flush(450);
  assert.ok(switched(page));
});

// ---- 3. Settings' preview ---------------------------------------------------------------------------
test('preview: the island is drawn at its board\'s width and place, so the board appears over it without a step', () => {
  const LONG = stop('preview', 'Preview (Stop B)', [{ k: '566', d: 'Wexley', t: min(12), st: 'live', t2: min(24), t3: min(37) }]);
  const g = G({ BusStatePreviewData: JSON.stringify(LONG) });
  const preview = (board) => run('island_show.js', { now: AT, globals: Object.assign({}, g), locals: { busdatavar: 'BusStatePreviewData', busboard: board ? 'yes' : 'no' } });
  const island = preview(false), board = preview(true);
  assert.deepStrictEqual([island.busww, island.busx], [board.busww, board.busx]);
  assert.ok(+island.bush < +board.bush, 'the island is still its own height');
  // A real island keeps its own width (the page grows its board out of it)
  const real = run('island_show.js', { now: AT, globals: G({ BusStateIslandData: JSON.stringify(LONG) }) });
  assert.ok(+real.busww < +board.busww);
});
