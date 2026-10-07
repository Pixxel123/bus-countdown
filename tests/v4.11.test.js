// Version 4.11: Wi-Fi hysteresis, backing off when TfL can't be reached, next two buses and an
// easier swipe to dismiss. (Written first, as todo tests, before the build that added them.)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

const WORK = { lat: 51.5, lon: -0.1 };

// ---- Wi-Fi hysteresis: losing the office (or home) Wi-Fi only counts as leaving once you've also
//      moved 50 m from that place, or the Wi-Fi has stayed gone for two checks in a row ----------
function check(g, ssid, metresFromWork) {
  const locals = { buscaller: 'profile=moved', busssid: ssid };
  if (metresFromWork !== null) { locals.gl_latitude = String(WORK.lat + m(metresFromWork)); locals.gl_longitude = String(WORK.lon); }
  return run('watch_due.js', { globals: g, locals }).busleave;
}
function atWork() {
  return { BusPlaces: 'bus|S|Stop|51.51|-0.1|100', BusHomeWifi: 'Home', BusWorkWifi: 'Office', BusLeaveShow: 'work',
    BusWorkAt: JSON.stringify({ lat: WORK.lat, lon: WORK.lon, n: 5 }), BusStateLastWifi: 'Office', BusStateRunning: '0', TRUN: '' };
}

test('a brief Wi-Fi drop at your desk is not leaving work', () => {
  const g = atWork();
  assert.strictEqual(check(g, '<unknown ssid>', 10), 'no');     // dropped, still at your desk
  assert.strictEqual(check(g, '"Office"', 10), 'no');           // and back again
});

test('walking out counts once you are 50 m from work', () => {
  const g = atWork();
  assert.strictEqual(check(g, '<unknown ssid>', 20), 'no');      // just off the Wi-Fi, inside
  assert.strictEqual(check(g, '<unknown ssid>', 80), 'yes');     // outside and away
});

test('or once the Wi-Fi has stayed gone for two checks, even without a position', () => {
  const g = atWork();
  assert.strictEqual(check(g, '<unknown ssid>', null), 'no');
  assert.strictEqual(check(g, '<unknown ssid>', null), 'yes');
});

// ---- Backing off when TfL can't be reached: each failure doubles the wait (45, 90, 180 s, at most
//      300 s); the first success goes straight back to normal -------------------------------------
function refresh(g, code) {
  const ok = code === '200';
  run('refresh.js', { globals: g, locals: { http_response_code: code, http_data: ok ? JSON.stringify([{ lineName: '517', destinationName: 'Holbry', timeToStation: 240 }]) : '' } });
  return g.BusStateNextWait;
}
test('no signal: the wait between refreshes doubles, up to 5 minutes', () => {
  const g = { BusRefresh: '45', BusRoutes: '517', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'X (Stop A)' };
  assert.deepStrictEqual(['0', '0', '0', '0'].map((c) => refresh(g, c)), ['90', '180', '300', '300']);
});
test('the first successful refresh goes straight back to normal', () => {
  const g = { BusRefresh: '45', BusRoutes: '517', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'X (Stop A)' };
  refresh(g, '0'); refresh(g, '0');
  assert.strictEqual(refresh(g, '200'), '45');
});

// ---- Next two buses: each route on the island carries its next bus and the one after, shown as
//      "5 · 12 min" (the second quieter). Only one bus coming: just the one time. -----------------
function islandData(arrivals) {
  const g = { BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'Ashenhurst (Stop B)' };
  const now = Date.UTC(2026, 9, 5, 8, 0, 0);
  run('refresh.js', { globals: g, now, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } });
  return { data: JSON.parse(g.BusStateIslandData), now };
}
test('each route carries its next two buses', () => {
  const { data, now } = islandData([
    { lineName: '517', destinationName: 'Holbry', timeToStation: 300 },
    { lineName: '517', destinationName: 'Holbry', timeToStation: 720 },
    { lineName: '566', destinationName: 'Fernleigh', timeToStation: 540 },
  ]);
  const r517 = data.b.find((b) => b.k === '517');
  assert.strictEqual(Math.round((r517.t - now) / 60000), 5);
  assert.strictEqual(Math.round((r517.t2 - now) / 60000), 12);
  const r566 = data.b.find((b) => b.k === '566');
  assert.strictEqual(r566.t2, undefined, 'only one 566 coming: no second time');
});

// ---- Easier swipe to dismiss: the island's gesture decision lives in scripts/shared/swipe.js (a pure
//      function the page and these tests share): decideSwipe(dx, ms) -> 'next' | 'previous' |
//      'dismiss' | 'none', with dx the sideways movement in dp (negative = left) and ms how long
//      the swipe took. Route changes keep working as now; dismissing needs 90 dp, or 60 dp if fast.
function decide(dx, ms) {
  return run('shared/swipe.js').decideSwipe(dx, ms);
}
test('short swipes still change route, both ways', () => {
  assert.strictEqual(decide(-40, 200), 'next');
  assert.strictEqual(decide(40, 200), 'previous');
  assert.strictEqual(decide(-70, 400), 'next');              // a longer, unhurried swipe is still a route change
});
test('a tiny movement does nothing', () => {
  assert.strictEqual(decide(-15, 120), 'none');
});
test('dismiss from 90 dp, either way', () => {
  assert.strictEqual(decide(-95, 500), 'dismiss');
  assert.strictEqual(decide(95, 500), 'dismiss');
});
test('a fast fling dismisses from 60 dp; the same distance slowly is a route change', () => {
  assert.strictEqual(decide(-65, 70), 'dismiss');            // about 0.9 dp per ms
  assert.strictEqual(decide(-65, 300), 'next');
});
