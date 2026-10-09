// V4.48: a stop switched to with its times shows them at once, with its name on the left for 0.6 s
// instead of over the whole island for 1.2 s; a long press is 450 ms, not 550; and Settings' preview
// draws the island at its board's width, so the board appears over it without a step. (4.48 also
// sized the island for Android's font size; 4.50 took that out: see tests/v4.50.test.js.)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, runPage } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 11, 0, 0);
const min = (m) => AT + m * 60000;
const stop = (s, n, b) => ({ u: AT, r: 45000, rot: 6000, s, n, l: '', b, a: [] });
const KH = stop('KH', 'Kiln Street (Stop KH)', [{ k: '566', d: 'Wexley', t: min(3), st: 'live' }, { k: '517', d: 'Holbry', t: min(14), st: 'live' }]);
const KJ = stop('KJ', 'Kiln Street (Stop KJ)', [{ k: '566', d: 'Purley', t: min(4), st: 'live', t2: min(14) }]);
const G = (extra) => Object.assign({ BusRoutes: '517,566', BusDestLetters: '3', BusScreenW: '448', BusCameraX: '224',
  BusStateBoard: '0', BusStateIslandData: JSON.stringify(KH) }, extra || {});

// ---- 1. Switching stop ------------------------------------------------------------------------------
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

// ---- 2. Settings' preview ---------------------------------------------------------------------------
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
