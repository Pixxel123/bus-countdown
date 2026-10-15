// V4.63: the same rules, tidier. Saved state is read by one helper (getJSON, in shared/get.js) rather
// than a copy of the same five lines in each script, and how you've been moving (speed, trend, pace
// away, closing in, settled, staying put, when you left a stop) is worked out in shared/movement.js
// rather than inside Bus Watch. And npm run compare replays recordings through an earlier version and
// this one, and lists every difference.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { run, m, compose } = require('./harness');
const { compareDirs } = require('../build/replay-compare');

const scripts = path.join(__dirname, '..', 'scripts');
const code = (f) => fs.readFileSync(path.join(scripts, f), 'utf8');

// The shared pieces on their own, with Tasker's global() standing in
const ctx = { Math, JSON, String, G: {}, global: (k) => ctx.G[k] };
vm.createContext(ctx);
vm.runInContext(compose('/* @include get */\n/* @include metres */\n/* @include movement */'), ctx);
const LAT = 51.3; const LON = -0.1; const T0 = Date.UTC(2026, 9, 14, 8, 0, 0);
const at = (secs, metresNorth, spd) => ({ t: T0 + secs * 1000, lat: LAT + m(metresNorth), lon: LON, acc: 10, spd: spd === undefined ? -1 : spd });

test('getJSON: the value, or the fallback when it is empty, not JSON, or null', () => {
  const read = (raw, fallback) => { ctx.G = raw === undefined ? {} : { V: raw }; return ctx.getJSON('V', fallback); };
  assert.deepStrictEqual(read('{"s":"onbus"}', {}), { s: 'onbus' });
  assert.deepStrictEqual(read('[1,2]', []), [1, 2]);
  assert.strictEqual(read('0', null), 0);
  for (const raw of [undefined, '', '   ', '%V', 'not json', 'null']) assert.deepStrictEqual(read(raw, { s: 'idle' }), { s: 'idle' }, JSON.stringify(raw));
  assert.strictEqual(read('', null), null);
  // A fresh fallback each time, so a script changing what it got can't change the next one's
  const a = read('', {}); a.x = 1; assert.deepStrictEqual(read('', {}), {});
});

test('the copies of the read are gone (4.64: the last one too)', () => {
  const left = [];
  for (const f of fs.readdirSync(scripts).filter((n) => n.endsWith('.js')).map((n) => n).concat(fs.readdirSync(path.join(scripts, 'shared')).map((n) => 'shared/' + n))) {
    code(f).split('\n').forEach((l, i) => { if (/try \{[^}]*JSON\.parse\(get\(/.test(l)) left.push(`${f}:${i + 1}`); });
  }
  assert.deepStrictEqual(left, []);
});

test('a saved state holding null no longer stops Bus Watch, Bus Refresh, Bus Status or Bus Loop', () => {
  const g = { BusPlaces: 'bus|S1|Test Stop|51.3|-0.1|80', BusStateTrip: 'null', BusStateWindow: 'null', BusStateMatch: 'null', BusStateSeen: 'null', BusStateBuzzed: 'null' };
  const r = run('watch.js', { globals: g, now: T0, locals: { buscaller: 'profile=moved', gl_latitude: '51.31', gl_longitude: '-0.1', gl_time_seconds: String(T0 / 1000), busspeed: '', busbearing: '', busacc: '10' } });
  assert.strictEqual(JSON.parse(g.BusStateTrip).s, 'idle');
  assert.ok(r.why !== undefined);
  for (const s of ['refresh.js', 'status.js', 'loop_tick.js']) {
    assert.doesNotThrow(() => run(s, { globals: Object.assign({}, g), now: T0, locals: { http_response_code: '200', http_data: '[]' } }), s);
  }
});

test('movement: speed is the median of the last three readings, and -1 with none', () => {
  assert.strictEqual(ctx.moveSpeed([]), -1);
  assert.strictEqual(ctx.moveSpeed([at(0, 0, 9), at(10, 0, 1.2), at(20, 0, -1), at(30, 0, 1.4), at(40, 0, 20)]), 1.4);
  assert.strictEqual(ctx.moveSpeed([at(0, 0, -1), at(10, 0, 3)]), 3);
});

test('movement: trend away from a point, from the last four positions', () => {
  const away = [0, 20, 40, 60, 80].map((d, i) => at(i * 15, d));
  assert.ok(Math.abs(ctx.moveTrend(away, LAT, LON) - 80 / 60) < 0.05);
  assert.ok(ctx.moveTrend(away.slice().reverse().map((w, i) => Object.assign({}, w, { t: T0 + i * 15000 })), LAT, LON) < -1);
  assert.strictEqual(ctx.moveTrend(away.slice(0, 2), LAT, LON), 0, 'too few positions');
});

test('movement: settled, staying put, pace away, closing in, and when you left a stop', () => {
  const still = [0, 30, 60, 90].map((s) => at(s, s % 60 ? 5 : 0));
  assert.strictEqual(ctx.moveSlowedDown(still, T0 + 90000), true);
  assert.strictEqual(ctx.moveSlowedDown([0, 30, 60].map((s) => at(s, s * 1.4)), T0 + 60000), false, 'walking');
  const wander = [0, 40, 80, 120, 160].map((s, i) => at(s, [0, 60, -40, 50, -30][i]));
  assert.strictEqual(ctx.moveStayingPut(wander), true, 'indoor wander within 80 m');
  assert.strictEqual(ctx.moveStayingPut(wander.slice(0, 3)), false, 'under 2 minutes');
  const stop = { lat: LAT, lon: LON, r: 60 };
  const ride = [0, 30, 60, 90, 120].map((s) => at(s, s * 3));
  const now = Object.assign({}, stop, { d: 360 });
  assert.ok(Math.abs(ctx.movePaceAway(ride, T0 + 120000, now) - 3) < 0.05);
  const walkIn = [0, 30, 60].map((s) => at(s, 300 - s * 1.5));
  assert.ok(Math.abs(ctx.moveClosing(walkIn, T0 + 60000, Object.assign({}, stop, { d: 210 })) - 1.5) < 0.05);
  assert.strictEqual(ctx.moveClosing(walkIn.slice(1), T0 + 60000, stop), -1, 'nothing 45 s back');
  assert.strictEqual(ctx.moveLeftAt(ride, Object.assign({}, stop, { r: 100 })), T0, 'the last position within 40 m, before one only inside the circle');
  assert.strictEqual(ctx.moveLeftAt(ride.slice(1), Object.assign({}, stop, { r: 100 })), T0 + 30000, 'failing that, the last inside its circle');
  assert.strictEqual(ctx.moveLeftAt(ride.slice(2), stop), 0, 'neither');
});

test('Bus Watch uses shared/movement.js rather than its own copies', () => {
  const w = code('watch.js');
  assert.ok(w.includes('/* @include movement */'));
  for (const re of [/function trend\(/, /paceAway = function/, /function closingSpeed\(/, /function leftTime\(/, /var settled = \(function/, /var staying = \(function/]) assert.ok(!re.test(w), String(re));
});

test('npm run compare: the same code replays identically; a changed rule shows where', () => {
  const lines = fs.readFileSync(path.join(__dirname, 'fixtures', 'tue-6-oct-excerpts.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const root = path.join(__dirname, '..');
  const same = compareDirs(root, root, lines);
  assert.strictEqual(same.same, true);
  assert.ok(same.runs > 100);
  // A copy where waiting at a stop is worded differently
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-compare-test-'));
  try {
    fs.cpSync(path.join(root, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
    fs.cpSync(path.join(root, 'build'), path.join(copy, 'build'), { recursive: true });
    fs.mkdirSync(path.join(copy, 'tests')); fs.copyFileSync(path.join(__dirname, 'harness.js'), path.join(copy, 'tests', 'harness.js'));
    const w = path.join(copy, 'scripts', 'watch.js');
    const before = fs.readFileSync(w, 'utf8'); const after = before.replace("why = 'waiting at ' + tripStop.n;", "why = 'standing at ' + tripStop.n;");
    assert.notStrictEqual(after, before);
    fs.writeFileSync(w, after);
    const changed = compareDirs(root, copy, lines);
    assert.strictEqual(changed.same, false);
    assert.strictEqual(changed.firstRun.script, 'watch.js');
    assert.ok(changed.decisions.length > 0);
    assert.ok(changed.decisions.every((d) => /waiting at/.test(d.before) && /standing at/.test(d.now)), JSON.stringify(changed.decisions[0]));
  } finally { fs.rmSync(copy, { recursive: true, force: true }); }
});
