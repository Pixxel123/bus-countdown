// V4.62: Settings tidied. Choices are rows that open, as Android's own Settings does it (a row says the
// setting and what it's set to; a tap opens its choices, one to a line with a radio mark). The Countdown
// page is in three groups, the side switch names the other side, Remove stop stands apart, the TfL key
// is hidden until Change, and the sliders say what they were. Hidden parts of the screen still take up
// their spacing on the phone, so alternatives share a Box, and nothing hidden sits in a spaced list.
// On the island, times two refreshes old hollow the route dots as well as fading the minutes.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, runPage } = require('./harness');

const KEY = '0f3c9a2e7b1d4c6e8a5f2b9d7c1e4a60';
function stopPoint(id, ind, lat, routes) {
  return { naptanId: id, commonName: 'Kiln Street', indicator: ind, lat, lon: -0.29, lineModeGroups: [{ modeName: 'bus', lineIdentifier: routes }] };
}
// Kiln Street: Stop KH (saved) and Stop KJ across the road; Holbry Lane (opp, saved) and its Stop M
function settings(extra) {
  const globals = Object.assign({ TflKey: KEY, BusRoutes: '517,566', BusRefresh: '45', BusTimeout: '30', BusHomeWifi: 'HomeNet', BusWorkWifi: 'WorkNet',
    BusIslandGap: '45', BusIslandY: '9', BusChipX: '76', BusCameraX: '672',
    BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|70\nbus|HO|Holbry Lane (opp)|51.38|-0.29|0',
    BusCacheStops: JSON.stringify({ KH: { r: ['517', '566'], t: 'Holbry' }, HO: { r: ['517'], t: 'Holbry' } }) }, extra || {});
  const near = [stopPoint('KH', 'Stop KH', 51.37, ['517', '566']), stopPoint('KJ', 'Stop KJ', 51.3701, ['517', '566']),
    Object.assign(stopPoint('HO', 'opp', 51.38, ['517']), { commonName: 'Holbry Lane' }), Object.assign(stopPoint('HM', 'Stop M', 51.3801, ['517']), { commonName: 'Holbry Lane' })];
  const locals = { http_response_code: '200', gl_latitude: '51.3702', gl_longitude: '-0.29',
    bp_fine: '0', bp_bg: '0', bp_overlay: 'true', bp_access: 'net.dinglisch.android.taskerm/x', bp_battery: 'true',
    http_data: JSON.stringify({ stopPoints: near }) };
  return JSON.parse(run('settings_open.js', { globals, locals }).buslayout);
}
function all(node, out) {
  out = out || [];
  if (node && typeof node === 'object') {
    if (node.type) out.push(node);
    Object.keys(node).forEach((k) => { if (Array.isArray(node[k])) node[k].forEach((c) => all(c, out)); });
  }
  return out;
}
const page = (layout, name) => layout.root.content[0].children.find((c) => c.id === 'page_' + name);
const texts = (node) => all(node).filter((n) => n.type === 'Text').map((n) => n.text);
const taps = (n) => (n.eventHandlers && n.eventHandlers.handlers.filter((h) => h.events.some((e) => e.type === 'click')).flatMap((h) => h.actions)) || [];
const sets = (n) => taps(n).filter((a) => a.type === 'SetVariable').map((a) => a.variable + '=' + a.value);
const saves = (n) => taps(n).filter((a) => a.type === 'RunTask').map((a) => a.variables);
const FIXED = path.join(__dirname, '..', 'scripts');

// ---- Choices as rows ------------------------------------------------------------------------------------
// One choice: its Column (no spacing) holds the closed row, the open row and the list of options
function choice(layout, pg, label) {
  return all(page(layout, pg)).find((n) => n.type === 'Column' && n.children && n.children[0] && n.children[0].type === 'Row' &&
    texts(n.children[0])[0] === label);
}
test('the Countdown page is in three groups, each a title over a card', () => {
  const pg = page(settings(), 'countdown');
  const titles = pg.children.filter((c) => c.type === 'Text');
  assert.deepStrictEqual(titles.map((t) => t.text), ['While it runs', 'Starting one', 'Recording']);
  titles.forEach((t) => { assert.strictEqual(t.color, 'primary'); assert.strictEqual(t.textSize, '15'); });
  assert.deepStrictEqual(pg.children.map((c) => c.type), ['Text', 'Card', 'Text', 'Card', 'Text', 'Card']);
  const groups = pg.children.filter((c) => c.type === 'Card').map((c) => c.children[0].children.map((x) => x.type === 'Column' ? texts(x.children[0])[0] : x.text));
  assert.deepStrictEqual(groups, [['Update every', 'Stop after', 'Rotate routes every'],
    ['Manual start searches within', 'Heading to a stop', 'Minutes ahead', 'How early the island comes up when you’re heading for a stop.'],
    ['Record trips', 'One file a day in Download/Tasker-bus-trip-data, kept until you delete it.']]);
  assert.doesNotMatch(JSON.stringify(pg), /kept a week/);
});

test('a choice is a row saying what it is set to; a tap opens its options, and tapping again closes them', () => {
  const c = choice(settings(), 'countdown', 'Update every');
  assert.strictEqual(c.verticalArrangement, undefined, 'no spacing: its hidden parts take up no room');
  const [closed, open, list] = c.children;
  assert.deepStrictEqual(sets(closed), ['op_busrefresh_x=yes']);
  assert.deepStrictEqual(sets(open), ['op_busrefresh_x=no']);
  assert.strictEqual(closed.showWhen, '!(%op_busrefresh_x == "yes")');
  assert.strictEqual(open.showWhen, list.showWhen);
  // Closed, it says the setting and what it's set to now (45 s until another is picked)
  const summary = all(closed).filter((n) => n.type === 'Text').slice(1);
  assert.deepStrictEqual(summary.map((n) => n.text), ['30 s', '45 s', '60 s', '90 s']);
  assert.match(summary[1].showWhen, / \| \(/, '45 s shows until something else is picked');
  assert.deepStrictEqual(texts(open), ['Update every']);
});

test('each option is a row with one radio mark; picking it saves straight away and closes the list', () => {
  const list = choice(settings(), 'countdown', 'Update every').children[2];
  assert.deepStrictEqual(list.children.map((r) => texts(r)[0]), ['30 s', '45 s', '60 s', '90 s']);
  list.children.forEach((r, i) => {
    assert.strictEqual(r.type, 'Row');
    const box = r.children[0];
    assert.strictEqual(box.type, 'Box', 'the two marks share one place, so the label never shifts');
    assert.deepStrictEqual(box.children.map((m) => m.url), ['icon:RadioButtonChecked', 'icon:RadioButtonUnchecked']);
    assert.strictEqual(box.children[1].showWhen, '!(' + box.children[0].showWhen + ')');
    const v = ['30', '45', '60', '90'][i];
    assert.deepStrictEqual(sets(r), ['ch_busrefresh_x=' + v, 'op_busrefresh_x=no']);
    assert.deepStrictEqual(saves(r), [{ busaction: 'set', bussetting: 'BusRefresh', busvalue: v }]);
  });
});

test('every choice in Settings is rows: no option buttons or segmented rows left', () => {
  const layout = settings();
  for (const pg of ['countdown', 'wifi', 'island']) {
    const nodes = all(page(layout, pg));
    assert.ok(!nodes.some((n) => n.type === 'SegmentedButtonRow'), pg);
    assert.ok(!nodes.some((n) => n.type === 'Button' && /^✓ /.test(n.text)), pg + ' has no ticked option buttons');
  }
  assert.deepStrictEqual(['Work heads-up from', 'Work heads-up until', 'Stop board shows'].map((l) => !!choice(layout, l === 'Stop board shows' ? 'island' : 'wifi', l)), [true, true, true]);
  // The Island page's buzz: On unless it was turned off
  const buzz = (g) => all(choice(settings(g), 'island', 'Buzz when a bus is under 5 min away').children[0]).filter((n) => n.type === 'Text' && / \| \(/.test(n.showWhen || ''))[0].text;
  assert.strictEqual(buzz(), 'On');
  assert.strictEqual(buzz({ BusBuzz: 'off' }), 'Off');
});

test('Start within is rows too: 50, 100, 200 m or Custom, which opens the box for a distance', () => {
  const c = choice(settings(), 'stops', 'Start within');
  const [closed, , list] = c.children;
  assert.strictEqual(all(closed).filter((n) => n.type === 'Text' && / \| \(/.test(n.showWhen || ''))[0].text, 'Custom, 70 m');
  assert.deepStrictEqual(list.children.map((r) => texts(r)[0]), ['50 m', '100 m', '200 m', 'Custom']);
  assert.ok(sets(list.children[3]).includes('stop_e_a_x=yes'));
  assert.ok(sets(list.children[0]).includes('stop_e_a_x=no'));
  assert.deepStrictEqual(saves(list.children[1]), [{ busaction: 'dist', busstop: 'a', busvalue: '100' }]);
  const box = all(c).find((n) => n.type === 'TextInput');
  assert.strictEqual(box.showWhen, '%stop_e_a_x == "yes"');
});

// ---- Stops -------------------------------------------------------------------------------------------
test('the side switch says it switches, and to which side, on its own line under the name, lined up with it', () => {
  const layout = settings();
  const stops = page(layout, 'stops');
  const kiln = all(stops).find((n) => n.type === 'Column' && n.children && n.children[0].text === 'Kiln Street');
  const sw = kiln.children[1];
  assert.strictEqual(sw.type, 'Box', 'one place for both sides’ switches');
  assert.deepStrictEqual(sw.children.map((r) => [r.type, texts(r)[0]]), [['Row', 'Switch to Stop KJ ⇄'], ['Row', 'Switch to Stop KH ⇄']]);
  assert.deepStrictEqual(sw.children.map(sets), [['pr_a_x=b'], ['pr_a_x=a']]);
  assert.ok(!all(stops).some((n) => n.type === 'IconButton'), 'no bare ⇄ icon');
  // A side with no letter of its own ("opp") is "other side"
  const holbry = all(stops).find((n) => n.type === 'Column' && n.children && n.children[0].text === 'Holbry Lane');
  assert.deepStrictEqual(holbry.children[1].children.map((r) => texts(r)[0]), ['Switch to Stop M ⇄', 'Switch to other side ⇄']);
  assert.strictEqual(texts(stops)[0], 'Your stops', 'no hint line above the stops');
});

test('Remove stop is red text on a line of its own, not a grey button like an unticked route', () => {
  const stops = page(settings(), 'stops');
  const rm = all(stops).filter((n) => n.type === 'Row' && texts(n)[0] === 'Remove stop');
  assert.ok(rm.length >= 1);
  rm.forEach((r) => {
    const t = all(r).find((n) => n.type === 'Text');
    assert.strictEqual(t.color, '#FFB4AB');
    assert.ok(saves(r).some((v) => v.busaction === 'remove' && v.busvalue === 'yes'));
    assert.ok(r.modifiers.some((m) => m.type === 'Padding' && m.top), 'space above it');
  });
  assert.ok(!all(stops).some((n) => n.type === 'Button' && n.text === 'Remove stop'));
  assert.ok(all(stops).some((n) => n.type === 'Button' && n.text === 'Undo'), 'Undo as it was');
});

// ---- Setup -------------------------------------------------------------------------------------------
test('the TfL key is hidden: its last four characters and Change; the box shows only after Change', () => {
  const setup = page(settings(), 'setup');
  const box = all(setup).find((n) => n.type === 'Box');
  const [masked, input] = box.children;
  assert.deepStrictEqual(texts(masked), ['TfL key: ••••4a60']);
  const change = all(masked).find((n) => n.type === 'Button');
  assert.strictEqual(change.text, 'Change');
  assert.deepStrictEqual(sets(change), ['key_edit_x=yes']);
  assert.strictEqual(masked.showWhen, '!(%key_edit_x == "yes")');
  assert.strictEqual(input.type, 'TextInput');
  assert.strictEqual(input.showWhen, '%key_edit_x == "yes"');
  // The key is in the layout once, as the box's value, and nowhere else
  const s = JSON.stringify(settings());
  assert.strictEqual(s.split(KEY).length - 1, 1);
  assert.strictEqual(input.text, KEY);
  // No key yet: the box straight away
  const none = all(page(settings({ TflKey: '' }), 'setup'));
  assert.ok(!none.some((n) => n.type === 'Text' && /^TfL key: /.test(n.text)));
  assert.strictEqual(none.find((n) => n.type === 'TextInput').showWhen, undefined);
});

// ---- Position, and nothing cut short -----------------------------------------------------------------
test('the sliders say what they were set to when Settings opened', () => {
  const labels = texts(page(settings(), 'position')).slice(0, 3);
  assert.deepStrictEqual(labels, ['Camera gap (was 45 dp)', 'Top offset (was 9 dp)', 'Chip offset from left (was 76 dp)']);
});

test('no text in Settings is limited to one line, and hidden alternatives take up no room', () => {
  const layout = settings();
  assert.ok(!all(layout.root).some((n) => n.maxLines), 'nothing is cut short with …');
  // The pages sit in one column; only one shows, so that column has no spacing for the hidden ones
  assert.strictEqual(layout.root.content[0].verticalArrangement, undefined);
});

// ---- The island -------------------------------------------------------------------------------------
test('old times hollow the route dots as well as fading the minutes, which fade to 55%', () => {
  const src = fs.readFileSync(path.join(FIXED, 'island_show.js'), 'utf8');
  assert.match(src, /#p\.stale \.dots i \{ background: none; box-shadow: inset 0 0 0 1px #8A93A6; \}/);
  assert.match(src, /#p\.stale \.dots i\.on \{ box-shadow: inset 0 0 0 1px #fff; \}/);
  assert.match(src, /\.m\.old \{ opacity: \.55; \}/);
  assert.match(src, /\.m2 \{[^}]*font-size: 12px;/);
  const NOW = Date.UTC(2026, 9, 13, 8, 0, 0);
  const data = (u) => JSON.stringify({ u, r: 45000, rot: 6000, s: 'KH', n: 'Kiln Street (Stop KH)', l: 'KH',
    b: [{ k: '566', d: 'Fernleigh', t: NOW + 300000, t2: NOW + 1020000, st: 'live' }, { k: '517', d: 'Holbry', t: NOW + 840000, st: 'live' }] });
  const stale = (u) => {
    const pg = runPage({ BusStateIslandData: data(u), BusRoutes: '517,566', BusScreenW: '448', BusCameraX: '224' }, NOW);
    pg.flush(0);
    return pg.ctx.document.getElementById('p').classList.contains('stale');
  };
  assert.ok(stale(NOW - 100000), 'more than two refreshes old');
  assert.ok(!stale(NOW - 30000));
});

test('the right half is fitted with "· 12 min" at 12 px, as the island draws it', () => {
  const fit = fs.readFileSync(path.join(FIXED, 'shared', 'islandFit.js'), 'utf8');
  const small = fit.match(/function rightNeeded[\s\S]*?var SMALL = '([^']+)'/)[1];
  assert.strictEqual(small, '600 12px system-ui, Roboto, sans-serif');
});

// ---- The main page ------------------------------------------------------------------------------------
// Both sides of a road saved ("Also save the stop across the road?") showed as the same stop twice in
// the Stops entry, as its summary leaves the side off each name. A road is listed once, with the routes
// ticked on either side.
test('the Stops entry lists a road with both sides saved once, with the routes on either side', () => {
  const layout = settings({ BusRoutes: '517,566,289',
    BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|70\nbus|HO|Holbry Lane (opp)|51.38|-0.29|0\nbus|KJ|Kiln Street (Stop KJ)|51.3701|-0.29|0',
    BusCacheStops: JSON.stringify({ KH: { r: ['517', '566'], t: 'Holbry' }, HO: { r: ['517'], t: 'Holbry' }, KJ: { r: ['566', '289'], t: 'Town' } }) });
  const entry = all(page(layout, 'main')).find((n) => n.type === 'Row' && sets(n).includes('bus_page=stops'));
  assert.strictEqual(texts(entry)[1], 'Kiln Street: 517, 566, 289; Holbry Lane: 517');
});
