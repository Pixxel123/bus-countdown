// V4.57: the island grows at once and shrinks at the next refresh with 8 dp or more to spare (no
// waiting for two), and grows in place between refreshes when a bus turns due: "1 · 15 min" becoming "Due · 14 min" used to drop the
// second time and leave "Due" alone in a gap sized for the longer line.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, runPage } = require('./harness');

const AT = Date.UTC(2026, 9, 11, 7, 46, 20);
// At the refresh, 20 s ago: the 517 a minute away, the next in 15. Now it's due.
const DATA = { u: AT - 20000, r: 45000, rot: 6000, s: 'KH', n: 'Kiln Street (Stop KH)', l: 'KH',
  b: [{ k: '517', d: 'Holbry', t: AT + 10000, st: 'live', t2: AT + 14.6 * 60000, st2: 'live' }] };
const G = () => ({ BusRoutes: '517', BusDestLetters: '3', BusScreenW: '448', BusCameraX: '224',
  BusStateIslandData: JSON.stringify(DATA), BusStateIslandRight: '54' });
// The page, run, as drawn at 54 dp; then its minutes are drawn again with "Due · 15 min" not fitting
function turnedDue(innerWidth) {
  const g = G();
  const shown = run('island_show.js', { globals: Object.assign({}, g), now: AT });
  const page = runPage(g, AT, { innerWidth: innerWidth === undefined ? +shown.busww : innerWidth });
  page.calls.length = 0;
  page.R.scrollWidth = 120; page.R.clientWidth = 54;
  page.push(Object.assign({}, DATA, { u: AT - 19000 }));        // drawn again, with no new width from Bus Refresh
  return { page, shown };
}

test('Bus Refresh shrinks the right half at the next refresh with 8 dp or more to spare', () => {
  const g = { BusRoutes: '517', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)', BusStateIslandShown: '1', BusStateIslandRight: '200', BusStateIslandFitStop: 'KH' };
  const b = (m) => ({ lineName: '517', destinationName: 'Holbry', timeToStation: m * 60, vehicleId: 'V' + m });
  run('refresh.js', { globals: g, now: AT, locals: { http_response_code: '200', http_data: JSON.stringify([b(4)]) } });
  assert.strictEqual(+g.BusStateIslandRight, Math.ceil('4 min'.length * 8.4) + 4);
  assert.strictEqual(JSON.parse(g.BusStateIslandData).fit, +g.BusStateIslandRight);
  assert.strictEqual(g.BusStateIslandShown, '1', 'not drawn again: the page resizes itself');
});

test('the page, run: a bus turned due since the refresh grows the island in place, keeping the next time', () => {
  const { page, shown } = turnedDue();
  const grow = page.calls.filter((c) => c[0] === 'updateOverlayConfig').map((c) => c[1]);
  assert.strictEqual(grow.length, 1);
  assert.ok(+grow[0].width > +shown.busww, 'wider');
  assert.match(page.R.innerHTML, /class="m due">Due<\/span><span class="m2">· 15 min/, 'both times kept');
  assert.ok(!page.calls.some((c) => c[0] === 'runTask'), 'nothing asked of Tasker');
});

test('the page, run: if its window can\'t resize itself, the second time is dropped as before, and nothing is drawn again', () => {
  const { page } = turnedDue(999);                              // the page doesn't follow its window
  assert.ok(!page.calls.some((c) => c[0] === 'updateOverlayConfig' || c[0] === 'runTask'));
  assert.match(page.R.innerHTML, /class="m due">Due<\/span>(<span class="dots">.*)?$/);
  assert.doesNotMatch(page.R.innerHTML, /m2/);
});

test('less than 8 dp to spare: kept as it is', () => {
  const b = (m) => ({ lineName: '517', destinationName: 'Holbry', timeToStation: m * 60, vehicleId: 'V' + m });
  const fit = Math.ceil('4 min'.length * 8.4) + 4;
  for (const [drawn, kept] of [[fit + 7, true], [fit + 8, false]]) {
    const g = { BusRoutes: '517', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)', BusStateIslandShown: '1', BusStateIslandRight: String(drawn), BusStateIslandFitStop: 'KH' };
    run('refresh.js', { globals: g, now: AT, locals: { http_response_code: '200', http_data: JSON.stringify([b(4)]) } });
    assert.strictEqual(+g.BusStateIslandRight, kept ? drawn : fit, String(drawn));
  }
});
