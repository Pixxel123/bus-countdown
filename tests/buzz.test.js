// One bus at a time: the soonest bus, whatever its route, buzzes three times on two refreshes in a
// row when it's within 5 minutes, then stays quiet; the next only gets its turn once it's gone. With
// the screen off, times are still fetched when a bus is close, so the buzz comes in your pocket
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run } = require('./harness');

const base = () => ({ BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'Ashenhurst (Stop B)' });
const bus = (route, min, vehicle) => ({ lineName: route, destinationName: 'Somewhere', timeToStation: Math.round(min * 60), vehicleId: vehicle });
function refresh(g, arrivals, now) {
  return run('refresh.js', { globals: g, now, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } }).busbuzz;
}

test('the same bus buzzes on the first two refreshes under 5 minutes, then not again', () => {
  const g = base(); let now = Date.UTC(2026, 9, 5, 8, 0, 0);
  const at = (min) => { now += 45000; return refresh(g, [bus('517', min, 'BX1')], now); };
  assert.deepStrictEqual([at(7), at(5.5), at(4.6), at(3.9), at(3.1), at(2.4)], ['no', 'no', 'yes', 'yes', 'no', 'no']);
});

test('the next bus gets its own two buzzes', () => {
  const g = base(); let now = Date.UTC(2026, 9, 5, 8, 0, 0);
  const at = (arr) => { now += 45000; return refresh(g, arr, now); };
  at([bus('517', 4, 'BX1')]); at([bus('517', 3, 'BX1')]);
  assert.strictEqual(at([bus('517', 2, 'BX1')]), 'no');
  assert.strictEqual(at([bus('517', 4.5, 'BX2')]), 'yes', 'BX1 has gone; BX2 is under 5 minutes');
});

test('two routes each under 5 minutes: still one buzz per refresh (three pulses), twice', () => {
  const g = base(); let now = Date.UTC(2026, 9, 5, 8, 0, 0);
  const at = (arr) => { now += 45000; return refresh(g, arr, now); };
  assert.deepStrictEqual([at([bus('517', 4, 'A'), bus('566', 4.5, 'B')]), at([bus('517', 3, 'A'), bus('566', 3.5, 'B')]), at([bus('517', 2, 'A'), bus('566', 2.5, 'B')])], ['yes', 'yes', 'no']);
});

test('with the screen off, times are fetched only when a bus is within 8 minutes', () => {
  const now = Date.now();
  const tick = (screen, nextMin) => run('loop_tick.js', { now, globals: { BusRefresh: '45', BusStateEndAt: String(now + 600000), SCREEN: screen,
    BusStateLastPush: String(now), BusStateNextMin: String(nextMin) } }).busfetch;
  assert.strictEqual(tick('on', 20), 'yes');
  assert.strictEqual(tick('off', 20), 'no', 'screen off, nothing close: save the battery');
  assert.strictEqual(tick('off', 7), 'yes', 'screen off, a bus within 8 minutes: keep fetching so the buzz comes');
});

test('one bus at a time: a second route under 5 minutes waits until the first bus has gone', () => {
  const g = base(); let now = Date.UTC(2026, 9, 5, 8, 0, 0);
  const at = (arr) => { now += 45000; return refresh(g, arr, now); };
  assert.deepStrictEqual([
    at([bus('517', 4.8, 'A'), bus('566', 7, 'B')]),      // the 517 is first: buzz
    at([bus('517', 4.0, 'A'), bus('566', 6.2, 'B')]),    // the 517 again: buzz (its second)
    at([bus('517', 3.2, 'A'), bus('566', 4.6, 'B')]),    // the 566 is now under 5 too, but the 517 is first: quiet
    at([bus('517', 2.4, 'A'), bus('566', 3.8, 'B')]),    // still the 517's turn: quiet
    at([bus('566', 3.0, 'B')]),                          // the 517 has gone: the 566's turn
    at([bus('566', 2.2, 'B')]),                          // its second
    at([bus('566', 1.4, 'B')]),                          // and then quiet
  ], ['yes', 'yes', 'no', 'no', 'yes', 'yes', 'no']);
});

test('a bus on the other route that is sooner is the one that buzzes, never both', () => {
  const g = base(); let now = Date.UTC(2026, 9, 5, 8, 0, 0);
  const at = (arr) => { now += 45000; return refresh(g, arr, now); };
  at([bus('517', 4.5, 'A'), bus('566', 3.5, 'B')]);
  assert.deepStrictEqual(Object.keys(JSON.parse(g.BusStateBuzzed)), ['566|B']);
});
