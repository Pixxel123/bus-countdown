// V4.55: the screen coming on at home or at work no longer takes a location fix once Bus Watch has
// learned where that place is. The fix was only used to refine %BusHomeAt / %BusWorkAt, whose running
// average stops gaining weight at 10 positions, and getting it held Tasker for up to 7 seconds on every
// screen-on (on 9 October, a Text to Calendar chip copied just after unlocking at work waited 8 s
// instead of 2). Pushed positions still refine it, and a run by hand still checks.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 12, 29, 33);
const LEARNED = JSON.stringify({ lat: 51.3712, lon: -0.2901, n: 10 });
function check(ssid, caller, extra) {
  const globals = Object.assign({ BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|50', BusHomeWifi: 'HomeNet', BusWorkWifi: 'WorkNet',
    BusStateRunning: '0', TRUN: '', BusHomeAt: LEARNED, BusWorkAt: LEARNED }, extra || {});
  const r = run('watch_due.js', { now: AT, globals, locals: { buscaller: caller, busssid: ssid } });
  return { quiet: r.busquiet, due: r.busdue, info: globals.BusStateWatchInfo };
}

test('screen on at work, where work is already known: no fix', () => {
  const r = check('"WorkNet"', 'profile=wake');
  assert.strictEqual(r.quiet, 'yes');
  assert.strictEqual(r.due, 'no');
  assert.match(r.info, /skipped: on work Wi-Fi/);
});

test('screen on at home, where home is already known: no fix', () => {
  assert.strictEqual(check('"HomeNet"', 'profile=wake').quiet, 'yes');
});

test('Bus Loop\'s safety net on home or work Wi-Fi: no fix either', () => {
  assert.strictEqual(check('"WorkNet"', 'profile=loop').quiet, 'yes');
});

test('a place still being learned (under 10 positions, or none) still takes the fix', () => {
  assert.strictEqual(check('"WorkNet"', 'profile=wake', { BusWorkAt: '' }).quiet, 'no');
  assert.strictEqual(check('"WorkNet"', 'profile=wake', { BusWorkAt: JSON.stringify({ lat: 51.37, lon: -0.29, n: 9 }) }).quiet, 'no');
  assert.strictEqual(check('"WorkNet"', 'profile=wake', { BusWorkAt: 'not json' }).quiet, 'no');
  // Home known doesn't count for work
  assert.strictEqual(check('"WorkNet"', 'profile=wake', { BusWorkAt: '' }).quiet, 'no');
});

test('a pushed position on work Wi-Fi is still recorded, and a run by hand still checks', () => {
  assert.strictEqual(check('"WorkNet"', 'profile=moved').quiet, 'no');
  assert.strictEqual(check('"WorkNet"', '').quiet, 'no');
  assert.strictEqual(check('"WorkNet"', '').due, 'yes');
});

test('away from home and work Wi-Fi, the screen coming on still checks', () => {
  const r = check('<unknown ssid>', 'profile=wake');
  assert.strictEqual(r.quiet, 'no');
  assert.strictEqual(r.due, 'yes');
});

test('getting home during a countdown still ends it, without a fix', () => {
  const globals = { BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStartWifi: '' };
  const r = run('watch_due.js', { now: AT, globals: Object.assign({ BusPlaces: 'bus|KH|K|51.37|-0.29|50', BusHomeWifi: 'HomeNet', BusWorkWifi: 'WorkNet', BusHomeAt: LEARNED }, globals),
    locals: { buscaller: 'profile=wake', busssid: '"HomeNet"' } });
  assert.strictEqual(r.busend, 'yes');
  assert.strictEqual(r.busquiet, 'yes');
});
