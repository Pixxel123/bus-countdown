// V4.58: following your bus. Riding a bus Bus Watch has named, TfL is asked which stops it calls at next
// (/Vehicle/{id}/Arrivals), and a slow spell only ends the ride once that bus has gone on without you.
// A stop whose buses all go back the way you came (the other side of the road) no longer starts a
// countdown as your bus passes it or you get off by it. And each day's recording has a file of its own,
// named by date.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, m } = require('./harness');

// ---- A straight road north: the 517 calls at A, S, X, Y, Z ------------------------------------------
const BASE = 51.37; const LON = -0.28; const T0 = Date.UTC(2026, 9, 12, 7, 30, 0);
const at = (north, east = 0) => [+(BASE + m(north)).toFixed(6), +(LON + east / 69600).toFixed(6)];
const NORTH = [['A', -800], ['S', 0], ['X', 600], ['Y', 1200], ['Z', 1800]].map(([id, n]) => [id, ...at(n)]);
const BOARDED = JSON.stringify({ k: '517', v: 'SF40MGA', stop: 'S', at: T0 - 300000, sure: true });
// TfL's reply for the bus: its next stops from `from` on, `secs` apart
const follow = (from, { v = 'SF40MGA', age = 10, secs = 60 } = {}) => JSON.stringify({ v, at: T0 - age * 1000,
  n: NORTH.slice(NORTH.findIndex((p) => p[0] === from)).map((p, i) => [p[0], T0 + (i + 1) * secs * 1000, 'Stop ' + p[0]]) });
// The last three positions, crawling north to `north` (Android's speed with each)
const crawl = (north, spd = 0.4) => JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(north - 30 + i * 10)[0], lon: LON, acc: 10, spd })));
function world(extra) {
  return Object.assign({
    BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|50\nbus|Z|Market Sq (Stop Z)|${at(1800).join('|')}|50`, BusNearRadius: '50', BusRoutes: '517',
    BusCacheSeq: JSON.stringify([NORTH]), BusStateRunning: '0', TRUN: '', BusStateBoarded: BOARDED, BusStateLastBusAt: String(T0 - 90000),
    BusStateTrip: JSON.stringify({ s: 'onbus', stop: 'S', since: T0 - 300000, boardedAt: 'S' }),
  }, extra);
}
const check = (g, north, { spd = '0.4', acc = '10', caller = 'profile=moved', east = 0, t = T0, brg = '' } = {}) => {
  const r = run('watch.js', { globals: g, now: t, locals: { buscaller: caller, gl_latitude: String(at(north, east)[0]), gl_longitude: String(at(north, east)[1]),
    gl_time_seconds: String(t / 1000), busspeed: spd, busbearing: brg, busacc: acc } });
  return { why: r.why, action: r.busaction, trip: JSON.parse(g.BusStateTrip) };
};

test('on a bus, slow: the ride carries on while TfL has the bus between the stop before you and the next one', () => {
  const g = world({ BusStateWindow: crawl(700), BusStateFollow: follow('Y') });
  const r = check(g, 700);
  assert.strictEqual(r.trip.s, 'onbus');
  assert.match(r.why, /on a bus, slow: the 517 is still with you \(next stop Stop Y\)/);
});

test('…and ends once the bus has gone on past you (its next stop is beyond the one after you)', () => {
  const g = world({ BusStateWindow: crawl(700), BusStateFollow: follow('Z') });
  const r = check(g, 700);
  assert.strictEqual(r.trip.s, 'left');
  assert.match(r.why, /off the bus: the 517 has gone on, to Stop Z/);
});

test('…or when you are well off its road', () => {
  const g = world({ BusStateWindow: crawl(700), BusStateFollow: follow('Y') });
  assert.strictEqual(check(g, 700, { east: 250 }).trip.s, 'left');
});

test('with no word from TfL (none, too old, or another bus), it ends as before', () => {
  for (const f of [undefined, follow('Y', { age: 150 }), follow('Y', { v: 'LX11AAA' })]) {
    const g = world({ BusStateWindow: crawl(700), BusStateFollow: f });
    assert.strictEqual(check(g, 700).trip.s, 'left', String(f));
  }
});

test('a fix too rough to place you can\'t end a ride TfL had with you in the last minute', () => {
  const g = world({ BusStateWindow: crawl(700), BusStateFollow: follow('Y') });
  check(g, 700);
  const r = check(g, 710, { acc: '90', t: T0 + 20000 });
  assert.strictEqual(r.trip.s, 'onbus');
  assert.match(r.why, /too rough to say otherwise/);
});

test('riding to a saved stop, a crawl is not "off the bus, on foot" while TfL has the bus with you', () => {
  const heading = () => world({ BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStopId: 'Z', BusStateWindow: crawl(700, 1.4),
    BusStateTrip: JSON.stringify({ s: 'heading', stop: 'Z', since: T0 - 120000, minD: 1200, bus: true }) });
  const g = heading(); g.BusStateFollow = follow('Y');
  const a = [check(g, 700, { spd: '1.4' }), check(g, 712, { spd: '1.4', t: T0 + 10000 })];
  assert.ok(a.every((r) => !/on foot/.test(r.why) && r.trip.bus === true), a.map((r) => r.why).join(' / '));
  assert.match(a[1].why, /slow: the 517 is still with you/);
  // Without it, as before: two checks at walking pace and you're taken to be on foot
  const h = heading();
  const b = [check(h, 700, { spd: '1.4' }), check(h, 712, { spd: '1.4', t: T0 + 10000 })];
  assert.match(b[1].why, /\(off the bus, on foot\)/);
});

// ---- The other side of the road ---------------------------------------------------------------------
// Kiln Street (Stop KN) is 20 m east of the road at 1200 m. Its route runs south (back the way the bus
// came), or north. The bus was last seen going north (BusStateHeading, kept while on a bus).
const NORTHWARD = (agoS) => JSON.stringify({ t: T0 - agoS * 1000, b: T0 - agoS * 1000, a: at(900), z: at(1150) });
function across(southbound, extra) {
  const seq = southbound ? [['KN', ...at(1200, 20)], ['KM', ...at(600, 20)]] : [['KN', ...at(1200, 20)], ['KO', ...at(1800, 20)]];
  return world(Object.assign({ BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|50\nbus|KN|Kiln Street (Stop KN)|${at(1200, 20).join('|')}|50`,
    BusCacheSeq: JSON.stringify([NORTH, seq]), BusStateLastBusAt: String(T0 - 30000), BusStateHeading: NORTHWARD(30),
    BusStateWindow: JSON.stringify([60, 40, 20].map((s) => ({ t: T0 - s * 1000, lat: at(1200)[0], lon: LON, acc: 10, spd: 0.2 }))) }, extra));
}

test('on (or just off) a bus by a stop whose buses all go back the way you came: no countdown', () => {
  const r = check(across(true), 1200, { spd: '0.2' });
  assert.strictEqual(r.action, 'none');
  assert.match(r.why, /by Kiln Street \(Stop KN\), but its buses go back the way you came: no countdown/);
});

test('a stop whose buses go on your way (where you might change) still starts; so does a run by hand', () => {
  assert.strictEqual(check(across(false), 1200, { spd: '0.2' }).action, 'start');
  assert.strictEqual(check(across(true), 1200, { spd: '0.2', caller: '' }).action, 'start');
});

test('off the bus over 2 minutes ago (crossed the road for a bus back, say): the countdown starts', () => {
  const g = across(true, { BusStateLastBusAt: String(T0 - 150000), BusStateHeading: NORTHWARD(150),
    BusStateTrip: JSON.stringify({ s: 'left', stop: 'S', since: T0 - 150000 }) });
  assert.strictEqual(check(g, 1200, { spd: '0.2' }).action, 'start');
});

test('the way the bus was going counts for 3 minutes, and a walk never counts as it', () => {
  // Still on the bus by Bus Watch's reckoning, but the way it was going was last seen 4 minutes ago
  assert.strictEqual(check(across(true, { BusStateHeading: NORTHWARD(240) }), 1200, { spd: '0.2' }).action, 'start');
  // Just off the bus, walked south to the stop: the walk south isn't the way the bus came
  const g = across(false, { BusStateTrip: JSON.stringify({ s: 'left', stop: 'S', since: T0 - 60000 }), BusStateHeading: '',
    BusStateWindow: JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(1300 - i * 30)[0], lon: LON, acc: 10, spd: 0.2 }))) });
  assert.strictEqual(check(g, 1200, { spd: '0.2' }).action, 'start');
});

test('a followed ride: your walk back to a connection, while TfL still has the bus with you, is not the way the bus came', () => {
  // Off the 517 at X (600 m), walking back south to Mill Lane (Stop KS), whose bus goes north as you rode.
  // TfL still has the 517 between X and Y, so Bus Watch has you on it for now.
  const g = world({ BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|50\nbus|KS|Mill Lane (Stop KS)|${at(485, 15).join('|')}|50`,
    BusCacheSeq: JSON.stringify([NORTH, [['KS', ...at(485, 15)], ['KT', ...at(1100, 15)]]]), BusStateFollow: follow('Y'),
    BusStateHeading: NORTHWARD(60), BusStateLastBusAt: String(T0 - 5000),
    BusStateWindow: JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(600 - i * 40)[0], lon: LON, acc: 10, spd: 0.2 }))) });
  const r = check(g, 490, { spd: '0.2' });
  const h = JSON.parse(g.BusStateHeading);
  assert.ok(h.z[0] > h.a[0], 'kept as the bus\'s way (north, from TfL\'s stops X to Y), not the walk south');
  assert.strictEqual(r.action, 'start', r.why);
});

test('a bus crawling under bus speed: its way comes from TfL\'s stops, so the other side of the road is still known', () => {
  // Friday: the 566 crawled the last 9 minutes to Kiln Street, never at bus speed; TfL had it with you
  const g = across(true, { BusStateHeading: '' });
  g.BusStateFollow = JSON.stringify({ v: 'SF40MGA', at: T0 - 10000, n: [['Y', T0 + 30000, 'Stop Y'], ['Z', T0 + 150000, 'Stop Z']] });
  const r = check(g, 1180, { spd: '0.2' });
  assert.strictEqual(r.trip.s, 'onbus');
  assert.match(r.why, /go back the way you came: no countdown/);
});

test('Bus Watch keeps the way you\'re going on an ordinary bus ride, followed or not', () => {
  const g = world({ BusStateFollow: '', BusStateHeading: '',
    BusStateWindow: JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(300 + i * 160)[0], lon: LON, acc: 10, spd: 8 }))) });
  check(g, 780, { spd: '8' });
  const h = JSON.parse(g.BusStateHeading);
  assert.strictEqual(h.t, T0);
  assert.ok(h.z[0] > h.a[0], 'north');
});

// ---- Asking TfL ---------------------------------------------------------------------------------------
const due = (g, now = T0) => run('follow_due.js', { globals: g, now });

test('asked only while riding a bus Bus Watch has named, at most every 45 s (20 s while slow)', () => {
  const win = (spd) => JSON.stringify([{ t: T0 - 5000, lat: BASE, lon: LON, acc: 10, spd }]);
  assert.deepStrictEqual([due(world({ BusStateWindow: win(8) })).busfollow, due(world({ BusStateWindow: win(8) })).busfollowv], ['yes', 'SF40MGA']);
  assert.strictEqual(due(world({ BusStateTrip: '{"s":"left","stop":"S"}' })).busfollow, 'no', 'not riding');
  assert.strictEqual(due(world({ BusStateBoarded: '' })).busfollow, 'no', 'no named bus');
  assert.strictEqual(due(world({ BusStateBoarded: BOARDED.replace('true', 'false') })).busfollow, 'no', 'not sure which');
  assert.strictEqual(due(world({ BusStateFollow: follow('Y', { age: 30 }), BusStateWindow: win(8) })).busfollow, 'no', '30 s ago, moving');
  assert.strictEqual(due(world({ BusStateFollow: follow('Y', { age: 30 }), BusStateWindow: win(1) })).busfollow, 'yes', '30 s ago, slow');
  assert.strictEqual(due(world({ BusStateTrip: JSON.stringify({ s: 'heading', stop: 'Z', bus: true }), BusStateWindow: win(8) })).busfollow, 'yes', 'riding to a stop');
});

test('the reply is kept soonest first, a stop once, and recorded', () => {
  const g = { BusRecord: 'on', BusRecordDay: '2026-10-12' };
  run('follow_store.js', { globals: g, now: T0, locals: { busfollowv: 'SF40MGA', http_response_code: '200', http_data: JSON.stringify([
    { naptanId: 'Y', stationName: 'Stop Y', timeToStation: 200 }, { naptanId: 'X', stationName: 'Stop X', timeToStation: 50 }, { naptanId: 'X', stationName: 'Stop X', timeToStation: 52 }]) } });
  const f = JSON.parse(g.BusStateFollow);
  assert.deepStrictEqual([f.v, f.at, f.n.map((x) => [x[0], (x[1] - T0) / 1000, x[2]])], ['SF40MGA', T0, [['X', 50, 'Stop X'], ['Y', 200, 'Stop Y']]]);
  const before = g.BusStateFollow;
  run('follow_store.js', { globals: g, now: T0 + 30000, locals: { busfollowv: 'SF40MGA', http_response_code: '503', http_data: '' } });
  assert.strictEqual(g.BusStateFollow, before, 'a failed request keeps the last');
});

test('Bus Watch asks after watch.js, for the next check, and records what it got (4.61)', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
  const task = xml.match(/<nme>Bus Watch<\/nme>[\s\S]*?<\/Task>/)[0];
  // Each in turn, after the one before
  let from = 0;
  for (const step of ['Where are you in the trip? Move it on', 'Trip recorder on: write what was just recorded', 'Left: end the countdown',
    'Riding a bus Bus Watch has named? Ask TfL where it is', 'Ask TfL which stops your bus calls at next', 'Vehicle/%busfollowv/Arrivals?app_key=%TflKey',
    'Keep them for the next check', 'Trip recorder on: write what was just recorded']) {
    const i = task.indexOf(step, from);
    assert.ok(i > 0, step); from = i;
  }
});

test('each day\'s recording is named by its date and weekday', () => {
  const g = { BusRecord: 'on', BusRecordDay: '' };
  const r = run('end_log.js', { globals: g, now: Date.UTC(2026, 9, 12, 7, 0, 0), locals: { busfrom: 'island' } });
  assert.strictEqual(r.busrecfile, 'Download/Tasker-bus-trip-data/bus-trip-2026-10-12-Mon.jsonl');
});

test('a recorded day replays with TfL\'s word on your bus, as the phone had it', () => {
  const { replay } = require('../build/replay-core');
  const g0 = world({ BusStateWindow: crawl(700) });
  const setup = { t: T0 - 60000, k: 'setup', vars: { BusPlaces: g0.BusPlaces, BusCacheSeq: g0.BusCacheSeq, BusRoutes: '517' } };
  const fol = { t: T0 - 10000, k: 'follow', v: 'SF40MGA', n: [['Y', 70], ['Z', 130]] };
  const pos = { t: T0, k: 'check', src: 'profile=moved', lat: at(700)[0], lon: LON, acc: 10, spd: 0.4, brg: null, age: 0, state: 'onbus', action: 'none' };
  const extra = { BusStateBoarded: BOARDED, BusStateTrip: g0.BusStateTrip, BusStateWindow: g0.BusStateWindow, BusStateLastBusAt: g0.BusStateLastBusAt };
  const withIt = replay([setup, fol, pos], extra).out.find((o) => o.k === 'check');
  assert.strictEqual(withIt.state, 'onbus');
  assert.match(withIt.why, /still with you/);
  assert.strictEqual(replay([setup, pos], extra).out.find((o) => o.k === 'check').state, 'left');
  // A failed request recorded after it leaves the last reply standing
  const failed = { t: T0 - 5000, k: 'follow', v: 'SF40MGA', fail: '503' };
  assert.strictEqual(replay([setup, fol, failed, pos], extra).out.find((o) => o.k === 'check').state, 'onbus');
});

test('after a failed request it waits 90 s, then 180, then 300 at most; an answer goes back to 20 to 45 s', () => {
  const g = world({ BusStateWindow: JSON.stringify([{ t: T0 - 5000, lat: BASE, lon: LON, acc: 10, spd: 8 }]) });
  const ask = (t) => run('follow_due.js', { globals: g, now: t }).busfollow;
  const fail = (t) => run('follow_store.js', { globals: g, now: t, locals: { busfollowv: 'SF40MGA', http_response_code: '', http_data: '' } });
  let t = T0;
  assert.strictEqual(ask(t), 'yes'); fail(t);
  assert.strictEqual(ask(t + 60000), 'no', 'not on the next position');
  assert.strictEqual(ask(t += 90000), 'yes'); fail(t);
  assert.strictEqual(ask(t + 170000), 'no');
  assert.strictEqual(ask(t += 180000), 'yes'); fail(t);
  assert.strictEqual(ask(t + 290000), 'no');
  assert.strictEqual(ask(t += 300000), 'yes'); fail(t);
  assert.strictEqual(ask(t + 290000), 'no', 'never longer than 300 s');
  assert.strictEqual(ask(t += 300000), 'yes');
  run('follow_store.js', { globals: g, now: t, locals: { busfollowv: 'SF40MGA', http_response_code: '200', http_data: JSON.stringify([{ naptanId: 'Y', stationName: 'Stop Y', timeToStation: 60 }]) } });
  assert.strictEqual(JSON.parse(g.BusStateFollowTry).fails, 0);
  assert.strictEqual(ask(t + 46000), 'yes');
});

test('the HTTP step waits 5 s at most for TfL, since Bus Watch waits for it', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
  const task = xml.match(/<nme>Bus Watch<\/nme>[\s\S]*?<\/Task>/)[0];
  const act = task.split('</Action>').find((a) => a.includes('Vehicle/%busfollowv'));
  assert.match(act, /<Int sr="arg8" val="5"\/>/);
});

test('an empty reply, or a bus at the end of its route listing its next trip back, says nothing: as before', () => {
  const g = world({ BusStateWindow: crawl(700) });
  run('follow_store.js', { globals: g, now: T0 - 5000, locals: { busfollowv: 'SF40MGA', http_response_code: '200', http_data: '[]' } });
  assert.strictEqual(check(g, 700).trip.s, 'left');
  // Laying over at Y (say the bus turns back there), TfL lists Y and then the way back to X: no line
  // goes on from Y to X, so it can't be placed
  const h = world({ BusStateWindow: crawl(1190), BusStateFollow: JSON.stringify({ v: 'SF40MGA', at: T0 - 10000, n: [['Y', T0 + 60000, 'Stop Y'], ['X', T0 + 300000, 'Stop X']] }) });
  assert.strictEqual(check(h, 1190).trip.s, 'left');
});

test('Bus Status says what TfL last said about your bus', () => {
  const g = world({ BusStateFollow: follow('Y', { age: 20 }), BusStateFollowTry: JSON.stringify({ v: 'SF40MGA', at: T0, fails: 2 }), BusPlaces: '' });
  const s = run('status.js', { globals: g, now: T0 }).busstatus;
  assert.match(s, /Following your bus: SF40MGA, asked 20 s ago, next stop Stop Y in about 1 min \(the last 2 requests failed\)/);
});

// ---- Settings during a countdown (Monday 12 October: Tasker restarted as the screen was shown) --------
test('Bus Settings takes the island down before showing its screen, and a refresh brings it back after', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
  const task = xml.match(/<nme>Bus Settings<\/nme>[\s\S]*?<\/Task>/)[0];
  let from = 0;
  for (const step of ['Build the settings screen', 'hide the island while Settings is open', 'so a refresh shows it again', 'Show the settings screen',
    'Save what changed', 'A countdown is running: bring the island back', 'Show the island again, with its times']) {
    const i = task.indexOf(step, from);
    assert.ok(i > 0, step); from = i;
  }
});

test('Settings lists at most 6 stops near you besides your saved ones, so more stops nearby don\'t make its layout any bigger', () => {
  const stops = Array.from({ length: 20 }, (_, i) => ({ naptanId: 'N' + i, commonName: 'Some Road ' + i, indicator: 'Stop ' + i, lat: BASE + m(i * 20), lon: LON, distance: i * 20,
    lineModeGroups: [{ modeName: 'bus', lineIdentifier: ['64', '119', '130', '194', '197', '198', '289', '312', '367'] }] }));
  const g = world({ TflKey: 'x' });
  const r = run('settings_open.js', { globals: g, now: T0, locals: { http_response_code: '200', http_data: JSON.stringify({ stopPoints: stops }), gl_latitude: String(BASE), gl_longitude: String(LON) } });
  const shown = JSON.parse(g.BusTempSettings).stops.filter((s) => !s.saved);
  assert.deepStrictEqual(shown.map((s) => s.id), ['N0', 'N1', 'N2', 'N3', 'N4', 'N5']);
  const six = run('settings_open.js', { globals: world({ TflKey: 'x' }), now: T0, locals: { http_response_code: '200', http_data: JSON.stringify({ stopPoints: stops.slice(0, 6) }), gl_latitude: String(BASE), gl_longitude: String(LON) } });
  assert.strictEqual(r.buslayout.length, six.buslayout.length, '20 stops nearby: the same layout as 6');
});

// ---- A countdown lost to Tasker stopping (Monday 12 October, Kiln Street) ------------------------------
// The running flag is still set (only Bus End clears it), but Bus Loop has gone: Tasker restarted
function lostAt(extra) {
  return Object.assign({ BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|50`, BusNearRadius: '50', BusRoutes: '517', BusStateStopId: 'S',
    BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'S', since: T0 - 120000 }), BusStateRunning: '1', TRUN: 'Bus Watch',
    BusStateWindow: JSON.stringify([60, 40, 20].map((s) => ({ t: T0 - s * 1000, lat: at(-20)[0], lon: LON, acc: 10, spd: 0.2 }))) }, extra);
}

test('a countdown lost to Tasker stopping starts again where you are, rather than counting as left', () => {
  const g = lostAt();
  const r = check(g, -20, { spd: '0.2' });
  assert.strictEqual(r.action, 'start');
  assert.match(r.why, /stopped without ending \(Tasker restarted\?\), so it starts again: start/);
  assert.strictEqual(g.BusStateRunning, '0');
});

test('one Bus End ended (swiped, time up, Wi-Fi) still counts as left, as before', () => {
  const g = lostAt({ BusStateRunning: '0' });
  const r = check(g, -20, { spd: '0.2' });
  assert.strictEqual(r.action, 'none');
  assert.strictEqual(r.trip.s, 'left');
});

test('lost while heading for a stop: back to looking afresh, so it shows again when you get there', () => {
  const g = lostAt({ BusStateTrip: JSON.stringify({ s: 'heading', stop: 'S', since: T0 - 60000, minD: 300 }) });
  g.BusStateWindow = JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(-400 + i * 30)[0], lon: LON, acc: 10, spd: 1.4 })));
  const r = check(g, -300, { spd: '1.4' });
  assert.notStrictEqual(r.trip.s, 'left');
  assert.match(r.why, /stopped without ending/);
});

// ---- When TfL doesn't answer (Monday 12 October, Wexley Stop D, 17:43 to 17:48) ------------------------
test('every route at a stop gets its timetable on the first visit of the day, so a route live then still has one when TfL stops answering', () => {
  const g = { BusStateStopId: 'D', BusRoutes: '566,517', BusCacheStops: JSON.stringify({ D: { r: ['566', '517'] } }) };
  const r = run('tt_check.js', { globals: g, now: T0, locals: {} });
  assert.strictEqual(g.BusTempTimetableRoutes, '566,517');
  assert.strictEqual(r.busttcount, '2');
  // Both stored: nothing more to fetch today
  g.BusCacheTimetable = JSON.stringify({ D: { date: new Date(T0).toDateString(), r: { 566: { t: [[1080, 0]], n: ['Holbry'] }, 517: { t: [], n: [] } } } });
  assert.strictEqual(run('tt_check.js', { globals: g, now: T0 + 60000, locals: {} }).busttfetch, 'no');
});

test('a timetable request that failed is tried again 5 minutes later, not tomorrow; an empty answer is kept', () => {
  const g = { BusStateStopId: 'D', BusRoutes: '566', BusCacheStops: JSON.stringify({ D: { r: ['566'] } }) };
  run('tt_store.js', { globals: g, now: T0, locals: { busttroute: '566', http_response_code: '', http_data: '' } });
  const saved = JSON.parse(g.BusCacheTimetable).D.r['566'];
  assert.deepStrictEqual([saved.t, saved.fail], [[], T0]);
  assert.strictEqual(run('tt_check.js', { globals: g, now: T0 + 4 * 60000, locals: {} }).busttfetch, 'no');
  assert.strictEqual(run('tt_check.js', { globals: g, now: T0 + 5 * 60000, locals: {} }).busttfetch, 'yes');
  run('tt_store.js', { globals: g, now: T0 + 6 * 60000, locals: { busttroute: '566', http_response_code: '200', http_data: JSON.stringify({ timetable: { routes: [] } }) } });
  assert.strictEqual(JSON.parse(g.BusCacheTimetable).D.r['566'].fail, undefined);
  assert.strictEqual(run('tt_check.js', { globals: g, now: T0 + 20 * 60000, locals: {} }).busttfetch, 'no', 'no journeys today: not asked again');
});

test('a failed request records why, and the debug log says so', () => {
  const g = { BusRecord: 'on', BusRecordDay: '2026-10-12', BusRefresh: '45', BusRoutes: '566', BusStateStopId: 'D', BusStateStopName: 'Wexley (Stop D)' };
  run('refresh.js', { globals: g, now: T0, locals: { http_response_code: '', http_data: '', errmsg: 'java.net.UnknownHostException: api.tfl.gov.uk', busstart: String(T0 - 500) } });
  const file = Object.keys(require('./harness').files).filter((f) => /bus-trip-/.test(f)).sort().pop();
  const line = require('./harness').files[file].trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.k === 'tfl').pop();
  assert.strictEqual(line.err, 'java.net.UnknownHostException: api.tfl.gov.uk');
  assert.match(JSON.parse(g.BusDebugLog).join('\n'), /TfL didn’t answer \(java\.net\.UnknownHostException/);
  // With nothing from Tasker either: "no reply"
  run('refresh.js', { globals: g, now: T0 + 60000, locals: { http_response_code: '', http_data: '' } });
  const last = require('./harness').files[file].trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.k === 'tfl').pop();
  assert.strictEqual(last.err, 'no reply');
});

test('the request for live times clears Tasker\'s last error first', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
  const task = xml.match(/<nme>Bus Refresh<\/nme>[\s\S]*?<\/Task>/)[0];
  const i = task.indexOf('so a failed request says why'); const j = task.indexOf('StopPoint/%BusStateStopId/Arrivals', i);
  assert.ok(i > 0 && j > i);
});

test('lost while heading for a stop: the countdown comes back as you carry on towards it', () => {
  const g = lostAt({ BusStateTrip: JSON.stringify({ s: 'heading', stop: 'S', since: T0 - 60000, minD: 300 }), BusApproachMin: '5' });
  g.BusStateWindow = JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(-390 + i * 25)[0], lon: LON, acc: 10, spd: 1.4 })));
  const r = check(g, -300, { spd: '1.4', brg: '0' });
  assert.deepStrictEqual([r.action, r.trip.s], ['approach', 'heading']);
  assert.match(r.why, /stopped without ending \(Tasker restarted\?\), so it starts again: heading to High St/);
});

test('lost, but you\'d already gone: on a bus 600 m up the route by the first check, so it\'s handled as having left, and the boarding is seen', () => {
  const g = lostAt({ BusCacheSeq: JSON.stringify([NORTH]), BusStateTrip: JSON.stringify({ s: 'atstop', stop: 'S', since: T0 - 240000 }),
    BusStateWindow: JSON.stringify([150, 120, 90].map((s, i) => ({ t: T0 - s * 1000, lat: at(i * 10)[0], lon: LON, acc: 10, spd: i < 2 ? 0.2 : 8 }))) });
  const r = check(g, 600, { spd: '8' });
  assert.strictEqual(r.trip.s, 'onbus');
  assert.match(r.why, /stopped without ending \(Tasker restarted\?\): on a bus from High St/);
  assert.doesNotMatch(r.why, /starts again/);
});

test('a lost countdown starts again only once per stop in 15 minutes, and never through a swipe\'s snooze', () => {
  const g = lostAt({ BusStateLostAt: JSON.stringify({ stop: 'S', at: T0 - 5 * 60000 }) });
  const r = check(g, -20, { spd: '0.2' });
  assert.deepStrictEqual([r.action, r.trip.s], ['none', 'left']);
  assert.match(r.why, /it did already, so not again/);
  const h = lostAt({ BusStateSnooze: JSON.stringify({ stop: 'S', at: T0 - 60000 }) });
  const s = check(h, -20, { spd: '0.2' });
  assert.strictEqual(s.action, 'none');
  assert.doesNotMatch(s.why, /starts again/);
});

test('Settings hides the island whether it\'s showing or due to be drawn again, brings it back last and only with Bus Loop running, and Bus Refresh doesn\'t draw it while Settings is open', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
  const settings = xml.match(/<nme>Bus Settings<\/nme>[\s\S]*?<\/Task>/)[0];
  const acts = settings.split('</Action>');
  const dismiss = acts.find((a) => /hide the island while Settings is open/.test(a));
  assert.match(dismiss, /<lhs>%BusStateIslandShown<\/lhs>\s*<op>2<\/op>\s*<rhs>1\/2<\/rhs>/);
  const iBack = acts.findIndex((a) => /Show the island again, with its times/.test(a));
  const iLoop = acts.findIndex((a) => /Bus Loop is really running/.test(a));
  const iSaid = acts.findIndex((a) => /Say what was saved, if anything/.test(a));
  const iPos = acts.findIndex((a) => /Adjust live was tapped: the live position editor/.test(a));
  assert.ok(iSaid < iLoop && iLoop < iBack && iBack < iPos, [iSaid, iLoop, iBack, iPos].join(' '));
  assert.match(acts[iLoop], /<lhs>%TRUN<\/lhs>\s*<op>2<\/op>\s*<rhs>\*Bus Loop\*<\/rhs>/);
  assert.match(acts[iBack], /<Str sr="arg2" ve="3">settings<\/Str>/);
  const refresh = xml.match(/<nme>Bus Refresh<\/nme>[\s\S]*?<\/Task>/)[0].split('</Action>');
  const iNo = refresh.findIndex((a) => /not while Settings is open/.test(a));
  const iDraw = refresh.findIndex((a) => /Island not up yet, or to be drawn again/.test(a));
  assert.ok(iNo > 0 && iNo < iDraw);
  assert.match(refresh[iNo], /<lhs>%TRUN<\/lhs>\s*<op>2<\/op>\s*<rhs>\*Bus Settings\*<\/rhs>/);
});

test('a reply with an error code is recorded as that, not "no reply"; a timetable 404 is kept for the day, a 503 tried again', () => {
  const g = { BusRecord: 'on', BusRecordDay: '2026-10-12', BusRefresh: '45', BusRoutes: '566', BusStateStopId: 'D', BusStateStopName: 'Wexley (Stop D)' };
  run('refresh.js', { globals: g, now: T0, locals: { http_response_code: '503', http_data: '' } });
  const file = Object.keys(require('./harness').files).filter((f) => /bus-trip-/.test(f)).sort().pop();
  const line = require('./harness').files[file].trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.k === 'tfl').pop();
  assert.strictEqual(line.err, 'HTTP 503');
  const t = { BusStateStopId: 'D', BusRoutes: '566' };
  run('tt_store.js', { globals: t, now: T0, locals: { busttroute: '566', http_response_code: '404', http_data: '' } });
  assert.strictEqual(JSON.parse(t.BusCacheTimetable).D.r['566'].fail, undefined);
  run('tt_store.js', { globals: t, now: T0, locals: { busttroute: '566', http_response_code: '503', http_data: '' } });
  assert.strictEqual(JSON.parse(t.BusCacheTimetable).D.r['566'].fail, T0);
});

test('Bus Status counts a stop\'s timetable only once it has one, and says which routes are still waiting', () => {
  const g = world({ BusPlaces: '', BusCacheTimetable: JSON.stringify({ D: { date: new Date(T0).toDateString(), r: { 566: { t: [], n: [], fail: T0 } } },
    G: { date: new Date(T0).toDateString(), r: { 517: { t: [[600, 0]], n: ['Holbry'] } } } }) });
  assert.match(run('status.js', { globals: g, now: T0 }).busstatus, /Timetables: 1 stop today; not yet for 1 route \(TfL didn’t answer: tried again 5 minutes later\)/);
});

test('lost, and already pulling away on a bus just past the stop: handled as having left, so the boarding can still be seen', () => {
  const g = lostAt();
  g.BusStateWindow = JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(40 + i * 30)[0], lon: LON, acc: 10, spd: 7 })));
  const r = check(g, 140, { spd: '7' });
  assert.strictEqual(r.trip.s, 'left');
  assert.doesNotMatch(r.why, /starts again/);
});
