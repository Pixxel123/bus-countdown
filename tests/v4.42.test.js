// V4.42: the stop board. Tap the island and it grows down into a board of every bus at the stop,
// the island's own width, the camera gap down the middle; tap again, swipe up or wait to close it.
// Bus Island keeps whether it's open (BusStateBoard) and has Bus Refresh show the island again; the
// settings say what it shows and when it closes, and Preview shows it too.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, compose } = require('./harness');

const AT = Date.UTC(2026, 9, 8, 7, 45, 0);
const data = (extra) => Object.assign({ u: AT, r: 45000, rot: 6000, s: 'KH', n: 'Kiln Street (Stop KH)', l: 'KH',
  b: [{ k: '566', d: 'Wexley', t: AT + 2 * 60000, st: 'live', t2: AT + 8 * 60000, t3: AT + 19 * 60000 }, { k: '517', d: 'Holbry', t: AT + 4 * 60000, st: 'live' }],
  a: [{ k: '289', d: 'Fernleigh', t: [AT + 5 * 60000, AT + 16 * 60000] }, { k: '64', d: 'Thornacre', t: [AT + 11 * 60000] }] }, extra || {});
const show = (g) => run('island_show.js', { globals: Object.assign({ BusRoutes: '517,566', BusDestLetters: '6', BusScreenW: '448', BusCameraX: '224',
  BusStateIslandData: JSON.stringify(data()) }, g), now: AT });

// ---- 1. The island page --------------------------------------------------------------------------
test('open, it is in the island\'s place, at least as wide, taller by a line per route', () => {
  const closed = show({ BusStateBoard: '0' }); const open = show({ BusStateBoard: '1' });
  assert.strictEqual(open.busy, closed.busy, 'it grows downwards');
  assert.ok(+open.busww >= +closed.busww && +open.busx <= +closed.busx, 'and only wider if its lines need it (4.47)');
  assert.strictEqual(+closed.bush, 30);
  assert.strictEqual(+open.bush, 30 + 4 * 26 + 8, 'the stop line, then 2 of yours and 2 others');
  assert.match(open.html, /var BOARD = true;/);
  assert.match(closed.html, /var BOARD = false;/);
  assert.strictEqual(JSON.parse(open.buslayout).root.modifiers.find((m) => m.type === 'Clip').radius, '20');
});

test('up to 8 lines; "your routes only" leaves the others out; the chip has no board', () => {
  const many = data({ a: Array.from({ length: 10 }, (_, i) => ({ k: String(100 + i), d: 'X', t: [AT + (i + 1) * 60000] })) });
  assert.strictEqual(+show({ BusStateBoard: '1', BusStateIslandData: JSON.stringify(many) }).bush, 30 + 8 * 26 + 8);
  assert.strictEqual(+show({ BusStateBoard: '1', BusBoardRoutes: 'mine' }).bush, 30 + 2 * 26 + 8);
  assert.strictEqual(+show({ BusStateBoard: '1', BusStyle: 'chip' }).bush, 24);
});

test('the page: yours in Settings order, then the others; a tap opens or closes it; a swipe up closes it; it closes itself', () => {
  const src = compose(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8'));
  assert.match(show({ BusStateBoard: '1' }).html, /var ROUTE_ORDER = \["517","566"\];/);
  // (4.43: closing goes through closeBoard)
  // (4.43: the board grows out of the island when the bridge can resize its window; else as before)
  assert.match(src, /if \(BOARD\) closeBoard\(\);\s*else if \(!document\.body\.classList\.contains\('chip'\) && !\(CAN_GROW && growBoard\(\)\)\) \{ waitFor\('board'\); runTask\('Bus Island', \{ busfrom: 'island', busisland: 'open' \}\)/);
  assert.match(src, /function closeBoard\(\) \{\s*if \(CAN_GROW\) \{ shrinkBoard\(\); return; \}\s*waitFor\('board'\); runTask\('Bus Island', \{ busfrom: 'island', busisland: 'close' \}\);\s*\}/);
  assert.match(src, /if \(BOARD && dy <= -30 && Math\.abs\(dy\) > Math\.abs\(dx\)\) \{ closeBoard\(\); return; \}/);
  assert.match(src, /if \(BOARD && closeAt && !down && Date\.now\(\) >= closeAt\)/, 'not while a finger is on it');
  assert.match(show({ BusStateBoard: '1', BusBoardSecs: '30' }).html, /BOARD_SECS = 30;/);
  assert.match(show({ BusStateBoard: '1', BusBoardSecs: '0' }).html, /BOARD_SECS = 0;/);
  assert.match(show({ BusStateBoard: '1' }).html, /BOARD_SECS = 10;/, '10 s unless set');
  assert.doesNotMatch(show({ BusStateBoard: '1' }).html.replace('%BusStateIslandData', ''), /%[A-Za-z]/, 'nothing Tasker would take for a variable');
});

test('Bus Refresh keeps a third time on each of your routes for the board', () => {
  const g = { BusRoutes: '566', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)', BusStateRunning: '1' };
  const b = (m, v) => ({ lineName: '566', destinationName: 'Wexley', timeToStation: m * 60, vehicleId: v });
  run('refresh.js', { globals: g, now: AT, locals: { http_response_code: '200', http_data: JSON.stringify([b(2, 'A'), b(8, 'B'), b(19, 'C'), b(30, 'D')]) } });
  const r = JSON.parse(g.BusStateIslandData).b[0];
  assert.deepStrictEqual([r.t, r.t2, r.t3].map((t) => Math.round((t - AT) / 60000)), [2, 8, 19]);
});

// ---- 2. In the project ---------------------------------------------------------------------------
const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const taskBody = (name) => [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes(`<nme>${name}</nme>`));
const steps = (body) => [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => ({
  code: +a[1].match(/<code>(\d+)<\/code>/)[1], args: [...a[1].matchAll(/<Str sr="arg(\d+)" ve="3">([^<]*)<\/Str>/g)].reduce((o, x) => Object.assign(o, { [x[1]]: x[2] }), {}),
  cond: (a[1].match(/<lhs>([^<]*)<\/lhs><op>(\d)<\/op><rhs>([^<]*)<\/rhs>/) || []).slice(1).join(' '),
}));

test('Bus Island: open sets the board on, close off, and both have Bus Refresh draw the island again, as its last step', () => {
  const s = steps(taskBody('Bus Island'));
  const sets = s.filter((x) => x.code === 547).map((x) => [x.args[0], x.args[1], x.cond]);
  // (4.43: a board the page grew itself, busgrow yes, is only noted; Bus Refresh then just fetches if due)
  assert.deepStrictEqual(sets, [['%BusStateBoard', '1', '%busisland 2 open'], ['%BusStateBoard', '0', '%busisland 2 close'],
    ['%busdo', '%busisland', ''], ['%busdo', '%busisland-grown', '%busgrow 2 yes'],
    ['%BusStateBoardSelf', '1', '%busdo 2 open-grown'], ['%BusStateBoardSelf', '0', '%busdo 2 open'],
    ['%BusStateIslandShown', '2', '%busdo 2 open/close/fit']]);   // fit: 4.46
  const last = s[s.length - 1];
  assert.strictEqual(last.code, 130);
  assert.deepStrictEqual([last.args[0], last.args[2], last.cond], ['Bus Refresh', '%busisland', '%busdo 2 switch/open/close/open-grown/fit']);
});

test('drawing it again removes the old one (2: showing, draw again); Bus End closes the board', () => {
  const g = { BusStateIslandShown: '2', BusStateIslandScene: 'buspill' };
  const r = run('island_show.js', { globals: g });
  assert.deepStrictEqual([r.busnewscene, r.busoldscene], ['buspill2', 'buspill']);
  const end = steps(taskBody('Bus End')).filter((x) => x.code === 547).map((x) => x.args[0] + '=' + x.args[1]);
  assert.ok(end.includes('%BusStateBoard=0'));
});

test('opening or closing it shows the times just fetched (under 20 s ago) rather than fetching again', () => {
  const g = { BusStateFetchAt: String(AT - 10000), BusStateFetchStop: 'KH', BusStateStopId: 'KH' };
  assert.strictEqual(run('fetch_due.js', { globals: g, now: AT, locals: { busrefby: 'task=Bus Island', busrefpar: 'open' } }).busfresh, 'yes');
  assert.strictEqual(run('fetch_due.js', { globals: g, now: AT, locals: { busrefby: 'task=Bus Island', busrefpar: 'switch' } }).busfresh, 'no', 'a new stop always fetches');
});

// ---- 3. Settings --------------------------------------------------------------------------------
test('the settings screen has both choices, and saves only known values', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'settings_open.js'), 'utf8');
  assert.match(src, /choices\('Tap for the stop board: show', \[\['All routes', 'all'\], \['Your routes', 'mine'\]\]/);
  assert.match(src, /choices\('Stop board closes', \[\['After 10 s', '10'\], \['After 30 s', '30'\], \['When tapped', '0'\]\]/);
  const g = {};
  run('settings_button.js', { globals: g, locals: { busaction: 'set', bussetting: 'BusBoardSecs', busvalue: '0' } });
  run('settings_button.js', { globals: g, locals: { busaction: 'set', bussetting: 'BusBoardRoutes', busvalue: 'mine' } });
  run('settings_button.js', { globals: g, locals: { busaction: 'set', bussetting: 'BusBoardSecs', busvalue: '5' } });
  assert.deepStrictEqual([g.BusBoardSecs, g.BusBoardRoutes], ['0', 'mine']);
  assert.match(g.BusTempChanged, /stop board closes when tapped/);
});

// (4.52: Preview is gone, replaced by the live position editor, which uses the same sample times)
test('the sample times have other routes for the stop board, and it has a line for each', () => {
  const g = { BusRoutes: '517,566' };
  const r = run('settings_button.js', { globals: g, locals: { busaction: 'preview' }, now: AT });
  const sample = JSON.parse(g.BusStatePreviewData);
  assert.strictEqual(sample.b[0].t3 - AT, 29 * 60000);
  assert.deepStrictEqual(sample.a.map((x) => x.k), ['130', '64']);
  const board = run('island_show.js', { globals: Object.assign({}, g, { BusDestLetters: '6' }), locals: { busdatavar: r.busdatavar, busboard: 'yes' }, now: AT });
  assert.strictEqual(+board.bush, 30 + 4 * 26 + 8);
});
