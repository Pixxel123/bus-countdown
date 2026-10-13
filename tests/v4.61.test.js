// V4.61: a tidier Bus Watch. TfL is asked about your bus after each check, for the next one, so no
// check waits on it; what a check records is written once; and everything that places you on a route
// shares one reading of the route lists and one set of sums (shared/routeLines.js). Each check records
// how long it took to get to the state machine (ms), and each answer about your bus how long TfL took.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { run, m, compose } = require('./harness');

const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const watchSteps = () => {
  const body = [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((x) => x[1]).find((b) => b.includes('<nme>Bus Watch</nme>'));
  return [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => ({
    code: +a[1].match(/<code>(\d+)<\/code>/)[1], label: unescape((a[1].match(/<label>(.*?)<\/label>/) || [0, ''])[1]).trim(), text: unescape(a[1]) }));
};
// Each step with how many Ifs it sits inside
const withDepth = (s) => { let d = 0; return s.map((a) => { if (a.code === 38) d--; const r = Object.assign({ depth: d }, a); if (a.code === 37) d++; return r; }); };
const find = (s, re, from = 0) => s.findIndex((a, i) => i >= from && re.test(a.label));

test('Bus Watch never stops part-way: every way through reaches the one write of what it recorded', () => {
  const s = withDepth(watchSteps());
  assert.ok(!s.some((a) => a.code === 137), 'no Stop actions');
  const check = find(s, /^Where are you in the trip\? Move it on/);
  const write = find(s, /^Trip recorder on: write what was just recorded/, check);
  assert.ok(check > 0 && write > check);
  assert.strictEqual(s[write].depth, 0, 'not inside any If: a quiet check, or one on home Wi-Fi, still writes its Wi-Fi line');
  assert.strictEqual(s.filter((a, i) => i < check && /^Trip recorder on/.test(a.label)).length, 0, 'nothing written before the check');
  // The early "nothing more to do" points are Ifs around the rest of the check
  for (const [v, op] of [['%busquiet', 3], ['%busmovedok', 2], ['%busdue', 3]]) {
    const at = s.findIndex((a) => a.code === 37 && a.text.includes(`<lhs>${v}</lhs><op>${op}</op>`));
    assert.ok(at > -1 && at < check, v);
  }
});

test('the island is started or ended before TfL is asked about your bus, which is for the next check', () => {
  const s = withDepth(watchSteps());
  const write = find(s, /^Trip recorder on: write what was just recorded/, find(s, /^Where are you in the trip/));
  const acts = find(s, /^Checked: act on it/);
  const ends = find(s, /^Left: end the countdown/);
  const due = find(s, /^Riding a bus Bus Watch has named\? Ask TfL where it is, for the next check/);
  const ask = s.findIndex((a) => a.text.includes('Vehicle/%busfollowv/Arrivals'));
  const keep = find(s, /^Keep them for the next check/);
  assert.ok(write < acts && acts < ends && ends < due && due < ask && ask < keep, [write, acts, ends, due, ask, keep].join(' '));
  assert.match(s[acts].text, /<lhs>%busaction<\/lhs><op>2<\/op><rhs>none\/start\/approach\/stop<\/rhs>/, 'only once the check has run');
  assert.ok(s[due].depth >= 1, 'inside "Checked: act on it"');
  assert.match(s[keep + 1].label, /^Trip recorder on: write what was just recorded/, 'the answer written straight after');
});

test('a check reads the route lists once, however many things place you on a route', () => {
  // On a bus Bus Watch named, crawling: following your bus, and the way back at a stop you're passing
  const BASE = 51.37; const LON = -0.28; const T0 = Date.UTC(2026, 9, 13, 7, 30, 0);
  const at = (n) => [+(BASE + m(n)).toFixed(6), LON];
  const NORTH = [['A', -800], ['S', 0], ['X', 600], ['Y', 1200], ['Z', 1800]].map(([id, n]) => [id, ...at(n)]);
  let reads = 0;
  // Passing Kiln Street (Stop X), 100 m back, inside its circle: is it the other side of the road?
  const g0 = { BusPlaces: `bus|S|High St (Stop S)|${BASE}|${LON}|50\nbus|X|Kiln Street (Stop X)|${at(600).join('|')}|150\nbus|Z|Market Sq (Stop Z)|${at(1800).join('|')}|50`, BusNearRadius: '50', BusRoutes: '517',
    BusCacheSeq: JSON.stringify([NORTH]), BusStateRunning: '0', TRUN: '', BusStateLastBusAt: String(T0 - 90000),
    BusStateBoarded: JSON.stringify({ k: '517', v: 'SF40MGA', stop: 'S', at: T0 - 300000, sure: true }),
    BusStateFollow: JSON.stringify({ v: 'SF40MGA', at: T0 - 10000, n: [['Y', T0 + 60000, 'Stop Y'], ['Z', T0 + 120000, 'Stop Z']] }),
    BusStateWindow: JSON.stringify([60, 40, 20].map((s, i) => ({ t: T0 - s * 1000, lat: at(670 + i * 10)[0], lon: LON, acc: 10, spd: 0.4 }))),
    BusStateTrip: JSON.stringify({ s: 'onbus', stop: 'S', since: T0 - 300000, boardedAt: 'S' }) };
  const g = new Proxy(g0, { has: (t, k) => { if (k === 'BusCacheSeq') reads++; return k in t; } });
  const r = run('watch.js', { globals: g, now: T0, locals: { buscaller: 'profile=moved', gl_latitude: String(at(700)[0]), gl_longitude: String(LON),
    gl_time_seconds: String(T0 / 1000), busspeed: '0.4', busbearing: '', busacc: '10' } });
  assert.strictEqual(r.busaction, 'start', 'slow, on the bus, at a stop it carries on from: a countdown there, as in 4.60');
  assert.strictEqual(reads, 1, 'read once (twice in 4.60: following the bus, then the way back)');
});

test('the shared sums: where a point falls on a route line, and the nearest point on it', () => {
  const ctx = { global: (k) => ({ BusCacheSeq: JSON.stringify([[['A', 51.37, -0.28], ['B', 51.37 + m(500), -0.28], ['C', 51.37 + m(500), -0.28 + 500 / 69600]]]) })[k], Math, JSON, parseInt, parseFloat, isNaN };
  vm.createContext(ctx);
  vm.runInContext(compose('/* @include get */\n/* @include metres */\n/* @include routeLines */') +
    '\nvar line = routeLines()[0]; var mid = onSegment(line, 0, 51.37 + ' + m(250) + ', -0.28 + 10 / 69600); var near = nearestOnLine(line, 51.37 + ' + m(520) + ', -0.28 + 300 / 69600);' +
    '\nvar again = routeLines() === routeLines(); var skipFirst = nearestOnLine(line, 51.37 + ' + m(250) + ', -0.28, 0, undefined, function (j) { return j > 0; });', ctx);
  assert.ok(Math.abs(ctx.line.cum[2] - 1000) < 2, String(ctx.line.cum[2]));
  assert.ok(Math.abs(ctx.mid.off - 10) < 0.5 && Math.abs(ctx.mid.along - 250) < 1 && Math.abs(ctx.mid.f - 0.5) < 0.01, JSON.stringify(ctx.mid));
  assert.strictEqual(ctx.near.j, 1);
  assert.ok(Math.abs(ctx.near.off - 20) < 0.5 && Math.abs(ctx.near.along - 800) < 2, JSON.stringify(ctx.near));
  assert.strictEqual(ctx.again, true, 'read once, then kept');
  assert.strictEqual(ctx.skipFirst.j, 1, 'a segment it is told to skip is skipped');
});

test('each check records how long it took to get to the state machine, and each answer about your bus how long TfL took', () => {
  const T0 = Date.UTC(2026, 9, 13, 7, 30, 0);
  const g = { BusRecord: 'on', BusRecordDay: '2026-10-13', BusPlaces: '', BusStateRunning: '0', TRUN: '' };
  const r = run('watch.js', { globals: g, now: T0, locals: { buscaller: 'profile=moved', busstart: String(T0 - 850), gl_latitude: '51.37', gl_longitude: '-0.28',
    gl_time_seconds: String(T0 / 1000), busspeed: '0', busbearing: '', busacc: '10' } });
  assert.strictEqual(JSON.parse(r.busrecline.split('\n').pop()).ms, 850);
  g.BusStateFollowTry = JSON.stringify({ v: 'SF40MGA', at: T0 - 640, fails: 0 });
  const ok = run('follow_store.js', { globals: g, now: T0, locals: { busfollowv: 'SF40MGA', http_response_code: '200', http_data: '[{"naptanId":"Y","stationName":"Stop Y","timeToStation":60}]' } });
  assert.strictEqual(JSON.parse(ok.busrecline).took, 640);
  const fail = run('follow_store.js', { globals: g, now: T0 + 5000, locals: { busfollowv: 'SF40MGA', http_response_code: '', http_data: '' } });
  assert.deepStrictEqual([JSON.parse(fail.busrecline).fail, JSON.parse(fail.busrecline).took], ['no reply', 5640]);
});
