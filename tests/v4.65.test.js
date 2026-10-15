// V4.65: clearer names, same rules. BusStateWifiLeftAt is now { place, at } (it was { p, t } in 4.64),
// and the 4.64 rule gets the cases its tests left out: a drop, back on, then a second drop; and the
// edges of it, 30 m from the place and 5 minutes after the drop.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

const LAT = 51.3; const LON = -0.1; const T = Date.UTC(2026, 9, 15, 9, 0, 0);
const STOP = [LAT + m(60), LON];                                   // the stop by work, 60 m from your desk
const world = (extra) => Object.assign({ BusPlaces: `bus|W1|Work Stop|${STOP[0]}|${STOP[1]}|70`, BusRoutes: '517', BusHomeWifi: 'Home', BusWorkWifi: 'Office',
  BusWorkAt: JSON.stringify({ lat: LAT, lon: LON, n: 10 }), BusStateRunning: '0', TRUN: '' }, extra);

// One check at the stop by work, with BusStateWifiLeftAt as given and you fromWork metres from work
function check(fromWork, leftAt) {
  const g = world({ BusStateWifiLeftAt: JSON.stringify(leftAt) });
  return run('watch.js', { globals: g, now: T, locals: { buscaller: 'profile=wake', gl_latitude: String(LAT + m(fromWork)), gl_longitude: String(LON),
    gl_time_seconds: String(T / 1000 - 2), busspeed: '', busbearing: '', busacc: '15' } });
}

test('a drop, back on, then a second drop: the time kept is the second drop', () => {
  const g = world({ BusStateWifi: 'Office' });
  const wifi = (secs, ssid) => run('wifi_save.js', { globals: g, now: T + secs * 1000, locals: { busssid: ssid } });
  wifi(0, '<unknown ssid>');
  assert.deepStrictEqual(JSON.parse(g.BusStateWifiLeftAt), { place: 'work', at: T });
  wifi(60, '"Office"');
  assert.deepStrictEqual(JSON.parse(g.BusStateWifiLeftAt), { place: 'work', at: T }, 'getting back on leaves it as it was');
  wifi(120, '<unknown ssid>');
  assert.deepStrictEqual(JSON.parse(g.BusStateWifiLeftAt), { place: 'work', at: T + 120000 });
});

test('the edges: within 30 m and within 5 minutes of the drop holds it back; just past either does not', () => {
  assert.strictEqual(check(29, { place: 'work', at: T - 2000 }).busaction, 'none', '29 m');
  assert.strictEqual(check(31, { place: 'work', at: T - 2000 }).busaction, 'start', '31 m');
  assert.strictEqual(check(8, { place: 'work', at: T - 5 * 60000 }).busaction, 'none', 'exactly 5 minutes');
  assert.strictEqual(check(8, { place: 'work', at: T - 5 * 60000 - 1000 }).busaction, 'start', '5 minutes and a second');
  assert.strictEqual(check(8, { place: 'work', at: T + 1000 }).busaction, 'start', 'a drop timed after the check');
});

test('a value kept by 4.64 ({ p, t }) is not read: at worst one countdown in the 5 minutes after updating', () => {
  assert.strictEqual(check(8, { p: 'work', t: T - 2000 }).busaction, 'start');
});
