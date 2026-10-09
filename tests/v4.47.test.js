// V4.47: the stop board widens a little when its lines need it (three times on a route, or a wider
// route badge than the island's), outwards from the camera gap and never closer than 8 dp to the
// screen's edges, whether the page grows it out of the island or it's drawn as a new window. Tucked
// back in, it's the island at its own width again.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, runPage } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 7, 45, 0);
const min = (m) => AT + m * 60000;
const data = (b, a, l) => JSON.stringify({ u: AT, r: 45000, rot: 6000, s: 'KH', n: 'Kiln Street (Stop KH)', l: l === undefined ? 'KH' : l, b, a: a || [] });
const SHORT = [{ k: '566', d: 'Wexley', t: min(2), st: 'live' }, { k: '517', d: 'Holbry', t: min(4), st: 'live' }];
const LONG = [{ k: '566', d: 'Wexley', t: min(12), st: 'live', t2: min(24), t3: min(37) }, { k: '517', d: 'Holbry', t: min(14), st: 'live', t2: min(33) }];
const G = (board, b, a, l, extra) => Object.assign({ BusRoutes: '517,566', BusDestLetters: '3', BusScreenW: '448', BusCameraX: '224',
  BusStateBoard: board ? '1' : '0', BusStateIslandData: data(b, a, l) }, extra || {});
const show = (board, b, a, l, extra) => run('island_show.js', { now: AT, globals: G(board, b, a, l, extra) });
const gapMiddle = (r) => +r.busx + Math.round(30 * 0.3) + r.LEFT + 42 / 2;     // where the camera gap's middle is

// ---- 1. Drawn as a new window ----------------------------------------------------------------------
test('short lines: the board is the island\'s own width', () => {
  const island = show(false, SHORT), board = show(true, SHORT);
  assert.deepStrictEqual([board.busww, board.busx], [island.busww, island.busx]);
});

test('three times on a route: the right half grows to fit them, the gap stays over the camera', () => {
  const island = show(false, LONG), board = show(true, LONG);
  assert.ok(board.RIGHT > island.RIGHT, `board ${board.RIGHT} dp, island ${island.RIGHT} dp`);
  assert.strictEqual(board.RIGHT, Math.ceil('12'.length * 8.4) + Math.ceil(' · 24 · 37 min'.length * 8.4) + 4);
  assert.strictEqual(board.LEFT, island.LEFT);
  assert.strictEqual(gapMiddle(board), 224);
});

test('a wider badge among the stop\'s other routes grows the left half, so its destination still shows', () => {
  // (A stop with no letter: on the island the letter's ring takes room the board's lines don't use)
  const others = [{ k: 'N680', d: 'Kelbury Bus Garage', t: [min(26)] }];
  const island = show(false, SHORT, others, ''), board = show(true, SHORT, others, '');
  assert.ok(board.LEFT > island.LEFT, `board ${board.LEFT} dp, island ${island.LEFT} dp`);
  assert.strictEqual(gapMiddle(board), 224);
  assert.strictEqual(show(true, SHORT, others, '', { BusBoardRoutes: 'mine' }).LEFT, island.LEFT, 'not when it shows only yours');
});

test('never closer than 8 dp to the screen\'s edges, and never narrower than the island', () => {
  const island = show(false, LONG).RIGHT, needs = show(true, LONG).RIGHT;
  const cam = String(448 - 21 - 9 - 8 - Math.floor((island + needs) / 2));
  const r = show(true, LONG, [], 'KH', { BusCameraX: cam });
  assert.strictEqual(+r.busx + +r.busww, 448 - 8, `right edge at ${+r.busx + +r.busww} dp`);
  assert.strictEqual(show(true, LONG, [], 'KH', { BusCameraX: '430' }).RIGHT, show(false, LONG, [], 'KH', { BusCameraX: '430' }).RIGHT);
});

test('Bus Refresh keeps the island\'s own width, and the page knows it, for when the board closes', () => {
  const g = G(true, LONG);
  const r = run('island_show.js', { now: AT, globals: g });
  const island = show(false, LONG);
  assert.strictEqual(+g.BusStateIslandRight, island.RIGHT);
  assert.match(r.html, new RegExp('var ISLAND_LEFT = ' + island.LEFT + ', ISLAND_RIGHT = ' + island.RIGHT + ', X_NOW = ' + r.busx + ';'));
});

// ---- 2. Grown out of the island by the page ---------------------------------------------------------
test('the page, run: a tap grows the board wider and further left when its lines need it, and tucks it back to the island', () => {
  const g = G(false, LONG);
  const island = run('island_show.js', { now: AT, globals: Object.assign({}, g) });
  const page = runPage(g, AT);
  page.tap();
  const grow = page.calls.find((c) => c[0] === 'updateOverlayConfig')[1];
  const right = Math.ceil('12'.length * 8.4) + Math.ceil(' · 24 · 37 min'.length * 8.4) + 4;
  assert.deepStrictEqual(grow, { height: String(30 + 2 * 26 + 8), configTransitionMs: 400, configTransitionEasing: 'EaseOut',
    width: String(9 + island.LEFT + 42 + right + 9), x: island.busx });
  assert.strictEqual(page.html.style['--right'], right + 'px');
  page.flush(1000);
  page.calls.length = 0;
  page.tap();
  page.flush(100);
  assert.deepStrictEqual(page.calls.filter((c) => c[0] === 'updateOverlayConfig').map((c) => c[1]),
    [{ height: '30', configTransitionMs: 260, configTransitionEasing: 'EaseIn', width: island.busww, x: island.busx }]);
  page.flush(1000);
  assert.strictEqual(page.html.style['--right'], island.RIGHT + 'px', 'the island\'s own width again');
});

test('the page, run: short lines grow the board downwards only, as before', () => {
  const page = runPage(G(false, SHORT), AT);
  page.tap();
  assert.deepStrictEqual(page.calls.find((c) => c[0] === 'updateOverlayConfig')[1], { height: String(30 + 2 * 26 + 8), configTransitionMs: 400, configTransitionEasing: 'EaseOut' });
});
