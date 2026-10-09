// V4.50: the island's text no longer grows and moves right when its window widens. Since 4.46 the page
// widens its own window through Tasker's bridge (fitted to its times, and 4.47's wider board), and the
// web view zoomed the whole page by the widths' ratio (606 / 558 dp: 1.086, measured on the phone),
// cutting the times short. The viewport is pinned at scale 1; if the page is zoomed all the same, the
// island is drawn again. 4.48's sizing for Android's font size is gone: the text was never drawn at
// 115%, it was this zoom.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, runPage } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 11, 30, 0);
const min = (m) => AT + m * 60000;
const data = (b, extra) => Object.assign({ u: AT, r: 45000, rot: 6000, s: 'KH', n: 'Kiln Street (Stop KH)', l: '', b, a: [] }, extra || {});
const ONE = [{ k: '407', d: 'Sutton', t: min(13), st: 'live' }];
const LONG = [{ k: '566', d: 'Wexley', t: min(12), st: 'live', t2: min(24), t3: min(37) }, { k: '517', d: 'Holbry', t: min(14), st: 'live', t2: min(33) }];
const G = (b) => ({ BusRoutes: '517,566,407', BusDestLetters: '3', BusScreenW: '448', BusCameraX: '224', BusStateBoard: '0', BusStateIslandData: JSON.stringify(data(b)) });
const fits = (page) => page.calls.filter((c) => c[0] === 'runTask' && c[1].variables.busisland === 'fit');

test('the page\'s viewport is pinned at scale 1', () => {
  const r = run('island_show.js', { now: AT, globals: G(ONE) });
  assert.match(r.html, /<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no">/);
});

// The page fitting itself to wider times (4.46): the window takes the new width, then is checked
function widen(scale) {
  const g = G(ONE), island = run('island_show.js', { now: AT, globals: Object.assign({}, g) });
  const page = runPage(g, AT, { scale: 1 });
  page.ctx.innerWidth = +island.busww;                              // the page as wide as its window
  const r = island.RIGHT + 40;
  page.push(data(ONE, { u: AT + 1000, fit: r }));
  assert.deepStrictEqual(page.calls.find((c) => c[0] === 'updateOverlayConfig')[1].width, String(+island.busww + 40), 'the window widens through the bridge');
  page.ctx.innerWidth = +island.busww + 40;                         // it took
  page.ctx.visualViewport.scale = scale;                            // and the web view did (or didn't) zoom
  page.flush(420);
  return page;
}

test('widened and zoomed all the same: the island is drawn again', () => {
  assert.strictEqual(fits(widen(1.086)).length, 1);
});

test('widened and not zoomed: nothing more to do', () => {
  assert.strictEqual(fits(widen(1)).length, 0);
});

test('the stop board widening (4.47): zoomed all the same, the island is drawn again; not zoomed, nothing more', () => {
  for (const [scale, expected] of [[1.05, 1], [1, 0]]) {
    const page = runPage(G(LONG), AT, { scale: 1 });
    page.tap();
    assert.ok(page.calls.find((c) => c[0] === 'updateOverlayConfig')[1].width, 'it widens');
    page.ctx.visualViewport.scale = scale;
    page.flush(450);
    assert.strictEqual(fits(page).length, expected, `scale ${scale}`);
  }
});

test('4.48\'s sizing for Android\'s font size is gone', () => {
  const dir = path.join(__dirname, '..');
  for (const f of ['scripts/island_show.js', 'scripts/shared/islandFit.js', 'build/assemble.py']) {
    assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /TextZoom|TEXT_ZOOM|measureZoom|busisland: 'zoom'/, f);
  }
});
