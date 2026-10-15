// V4.64: a Wi-Fi drop while you're still at home or work no longer starts a countdown. In one recording
// the work Wi-Fi dropped for six minutes at the desk: the stop by work started its countdown (8 m from
// work), and two minutes later the second screen-on without the Wi-Fi was taken for leaving and
// showed the next buses again. Now, just off home or work Wi-Fi (in the last 5 minutes) and
// within 30 m of that place, the stop by it doesn't start; and a screen-on check, which gets its fix
// after the Wi-Fi rules, has the newest position Bus Watch kept (under 3 minutes old) stand in for it.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, m } = require('./harness');
const { replay } = require('../build/replay-core');
const { compareDirs } = require('../build/replay-compare');

const LAT = 51.3; const LON = -0.1; const T = Date.UTC(2026, 9, 13, 14, 21, 35);
const STOP = [LAT + m(60), LON];                                   // the stop by work, 60 m from your desk
const world = (extra) => Object.assign({ BusPlaces: `bus|W1|Work Stop|${STOP[0]}|${STOP[1]}|70`, BusRoutes: '517', BusHomeWifi: 'Home', BusWorkWifi: 'Office',
  BusWorkAt: JSON.stringify({ lat: LAT, lon: LON, n: 10 }), BusStateRunning: '0', TRUN: '' }, extra);

test('coming off home or work Wi-Fi is kept with its time; other changes are not', () => {
  const save = (before, now) => { const g = world({ BusStateWifi: before }); run('wifi_save.js', { globals: g, now: T, locals: { busssid: now } }); return g.BusStateWifiLeftAt; };
  assert.deepStrictEqual(JSON.parse(save('Office', '<unknown ssid>')), { place: 'work', at: T });
  assert.deepStrictEqual(JSON.parse(save('Home', '"Cafe"')), { place: 'home', at: T });
  assert.strictEqual(save('', '"Office"'), undefined, 'getting to work');
  assert.strictEqual(save('Cafe', '<unknown ssid>'), undefined, 'leaving another network');
  assert.strictEqual(save('Office', '"Office"'), undefined, 'no change');
});

// One check at the stop by work: metres from where work is, seconds since the work Wi-Fi went
function check(fromWork, leftAgo, extra, caller = 'profile=wake') {
  const g = world(Object.assign({ BusStateWifiLeftAt: leftAgo === null ? '' : JSON.stringify({ place: 'work', at: T - leftAgo * 1000 }) }, extra));
  return run('watch.js', { globals: g, now: T, locals: { buscaller: caller, gl_latitude: String(LAT + m(fromWork)), gl_longitude: String(LON),
    gl_time_seconds: String(T / 1000 - 2), busspeed: '', busbearing: '', busacc: '15' } });
}

test('just off work Wi-Fi and still at your desk: the stop by work does not start', () => {
  const r = check(8, 2);
  assert.strictEqual(r.busaction, 'none');
  assert.match(r.why, /just off work Wi-Fi, and still there \(8 m away\): no countdown/);
});

test('it still starts once you are 30 m or more from work, after 5 minutes, without the Wi-Fi change, or by hand', () => {
  assert.strictEqual(check(43, 2).busaction, 'start', 'leaving: the first position was 43 m out in that recording');
  assert.strictEqual(check(8, 6 * 60).busaction, 'start', 'off the Wi-Fi for over 5 minutes');
  assert.strictEqual(check(8, null).busaction, 'start', 'never on work Wi-Fi');
  assert.strictEqual(check(8, 2, {}, '').busaction, 'start', 'run by hand');
  const home = check(8, 2, { BusStateWifiLeftAt: JSON.stringify({ place: 'home', at: T - 2000 }) });
  assert.strictEqual(home.busaction, 'start', 'off home Wi-Fi says nothing about the stop by work');
});

// The Wi-Fi rules on a screen-on check, the second off work Wi-Fi (no position of its own)
function secondScreenOn(window) {
  const g = world({ BusStateLastWifi: 'Office', BusStateOffWifi: '1', BusStateWindow: JSON.stringify(window) });
  const r = run('watch_due.js', { globals: g, now: T, locals: { buscaller: 'profile=wake', busssid: '<unknown ssid>' } });
  return { leave: r.busleave, off: g.BusStateOffWifi, last: g.BusStateLastWifi };
}
const fix = (secsAgo, fromWork, acc = 15) => ({ t: T - secsAgo * 1000, lat: LAT + m(fromWork), lon: LON, acc, spd: -1 });

test('a screen-on check uses the newest position Bus Watch kept: 8 m from work two minutes ago is not leaving', () => {
  assert.deepStrictEqual(secondScreenOn([fix(135, 8)]), { leave: 'no', off: '2', last: 'Office' });
});

test('...but one 50 m or more away is, and with none recent or good enough it is two checks, as before', () => {
  assert.strictEqual(secondScreenOn([fix(30, 70)]).leave, 'yes', '70 m from work');
  assert.strictEqual(secondScreenOn([fix(200, 8)]).leave, 'yes', 'over 3 minutes old');
  assert.strictEqual(secondScreenOn([fix(30, 8, 80)]).leave, 'yes', 'a fix only good to 80 m');
  assert.strictEqual(secondScreenOn([]).leave, 'yes', 'none at all');
});

test('a pushed position still uses its own position, not the window', () => {
  const g = world({ BusStateLastWifi: 'Office', BusStateOffWifi: '0', BusStateWindow: JSON.stringify([fix(20, 8)]) });
  const r = run('watch_due.js', { globals: g, now: T, locals: { buscaller: 'profile=moved', busssid: '<unknown ssid>', gl_latitude: String(LAT + m(60)), gl_longitude: String(LON) } });
  assert.strictEqual(r.busleave, 'yes');
});

test('a replay plays the Wi-Fi changes through wifi_save.js, so the rule works on recordings too', () => {
  const setup = { t: T - 60000, k: 'setup', vars: world({ BusStateWifi: 'Office' }) };
  const at = (secs, fromWork, src = 'profile=wake') => ({ t: T + secs * 1000, k: 'check', src, lat: LAT + m(fromWork), lon: LON, acc: 15, spd: null, brg: null, age: 1, state: 'idle', action: 'none', why: '' });
  const day = [setup, { t: T - 2000, k: 'wifi', from: 'work', to: 'none' }, at(0, 8), at(400, 8)];
  const { out, globals } = replay(day);
  assert.deepStrictEqual(out.map((o) => o.k), ['wifi', 'check', 'check']);
  assert.strictEqual(out[0].note, 'Wi-Fi: work to none');
  assert.deepStrictEqual(JSON.parse(globals.BusStateWifiLeftAt), { place: 'work', at: T - 2000 });
  assert.strictEqual(out[1].action, 'none', 'just off it, at your desk');
  assert.strictEqual(out[2].action, 'start', 'still off it nearly 7 minutes later: then it starts, as before');
});

test('npm run compare --wifi: the same code identical, with the Wi-Fi rules played', () => {
  const lines = fs.readFileSync(path.join(__dirname, 'fixtures', 'tue-6-oct-excerpts.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const root = path.join(__dirname, '..');
  const r = compareDirs(root, root, lines, { wifi: true });
  assert.strictEqual(r.same, true);
  assert.ok(r.runs > 150);
});
