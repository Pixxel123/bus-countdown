// V4.52: Settings' live position editor, in place of Preview. Settings › Island › Position › Adjust
// live shows the island where it goes, with sliders at the bottom of the screen that move it as they
// slide (the island's page moves and resizes its own window); Done saves and reopens Settings on the
// Position page, Cancel leaves it. A countdown's own island stays hidden meanwhile.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, runPage } = require('./harness');

const AT = Date.UTC(2026, 9, 9, 12, 0, 0);
function all(node, out) {
  out = out || [];
  if (node && typeof node === 'object') {
    if (node.type) out.push(node);
    Object.keys(node).forEach((k) => { if (Array.isArray(node[k])) node[k].forEach((c) => all(c, out)); });
  }
  return out;
}

// ---- 1. Settings ----------------------------------------------------------------------------------------
function settings(extra, locals) {
  const globals = Object.assign({ TflKey: 'key', BusRoutes: '517,566', BusRefresh: '45', BusTimeout: '30', BusHomeWifi: 'HomeNet', BusWorkWifi: 'WorkNet',
    BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|50', BusCacheStops: JSON.stringify({ KH: { r: ['517', '566', '289'], t: 'Holbry' } }) }, extra || {});
  const loc = Object.assign({ http_response_code: '200', gl_latitude: '51.3702', gl_longitude: '-0.29',
    bp_fine: '0', bp_bg: '0', bp_overlay: 'true', bp_access: 'net.dinglisch.android.taskerm/x', bp_battery: 'true',
    http_data: JSON.stringify({ stopPoints: [{ naptanId: 'KH', commonName: 'Kiln Street', indicator: 'Stop KH', lat: 51.37, lon: -0.29,
      lineModeGroups: [{ modeName: 'bus', lineIdentifier: ['517', '566', '289'] }] }] }) }, locals || {});
  return JSON.parse(run('settings_open.js', { globals, locals: loc }).buslayout);
}
const page = (layout, name) => layout.root.content[0].children.find((c) => c.id === 'page_' + name);

test('the Position page has Adjust live in place of Preview: it notes the tap and closes the screen', () => {
  const buttons = all(page(settings(), 'position')).filter((n) => n.type === 'Button');
  assert.deepStrictEqual(buttons.map((b) => b.text), ['Adjust live', 'Reset']);
  assert.deepStrictEqual(buttons[0].eventHandlers.handlers[0].actions, [{ type: 'SetVariable', variable: 'bus_live', value: 'yes' }, { type: 'DismissLayout' }]);
  assert.strictEqual(run('settings_save.js', { globals: {}, locals: { bus_live: 'yes' } }).buslive, 'yes');
  assert.strictEqual(run('settings_save.js', { globals: {}, locals: {} }).buslive, 'no');
});

test('reopened on Position: that page shows while no page is chosen yet, and the main page doesn\'t; otherwise as before', () => {
  const plain = settings(), back = settings({}, { busstartpage: 'position' });
  assert.strictEqual(page(plain, 'position').showWhen, '%bus_page == "position"');
  assert.strictEqual(page(back, 'position').showWhen, '(%bus_page == "position" | %bus_page == "")');
  assert.strictEqual(page(back, 'main').showWhen, page(plain, 'main').showWhen + ' & %bus_page != ""');
  assert.strictEqual(page(back, 'island').showWhen, page(plain, 'island').showWhen);
  assert.deepStrictEqual(settings({}, { busstartpage: '%par1' }), plain, 'opened from the menu: no page asked for');
});

// ---- 2. The panel ---------------------------------------------------------------------------------------
test('the panel: the gap and top offset for the island (or offset and top for the chip), each slide passed on at once', () => {
  const g = { BusIslandGap: '44', BusIslandY: '11', BusScreenW: '448' };
  const r = run('position_open.js', { globals: g, now: AT });
  const nodes = all(JSON.parse(r.buslayout).root);
  const sliders = nodes.filter((n) => n.type === 'Slider');
  assert.deepStrictEqual(sliders.map((s) => [s.id, s.min, s.max, s.value]), [['sl_gap', '26', '80', '44'], ['sl_y', '0', '24', '11']]);
  for (const s of sliders) {
    const acts = s.eventHandlers.handlers[0].actions;
    assert.strictEqual(s.eventHandlers.handlers[0].events[0].type, 'slider_value_changed');
    assert.deepStrictEqual(acts.map((a) => a.type), ['OutputToVariable', 'RunTask']);
    assert.deepStrictEqual([acts[1].task, acts[1].variables], ['Bus Position Set', { busaction: 'move' }]);
  }
  const buttons = nodes.filter((n) => n.type === 'Button');
  assert.deepStrictEqual(buttons.map((b) => [b.text, b.eventHandlers.handlers[0].actions[0].task, b.eventHandlers.handlers[0].actions[0].variables.busaction]),
    [['Cancel', 'Bus Position Done', 'cancel'], ['Done', 'Bus Position Done', 'done']]);
  assert.strictEqual(g.BusStatePrevPos, '44,11,76', 'the island starts where it is');
  assert.strictEqual(+g.BusStateEditing, AT);
  assert.deepStrictEqual([r.busx, r.busww, r.bush], ['8', '432', '300'], 'the screen\'s width, less 8 dp each side');
  const chip = all(JSON.parse(run('position_open.js', { globals: { BusStyle: 'chip', BusChipX: '90' }, now: AT }).buslayout).root).filter((n) => n.type === 'Slider');
  assert.deepStrictEqual(chip.map((s) => [s.id, s.value]), [['sl_cx', '90'], ['sl_y', '9']]);
});

test('Done saves the sliders that moved, within their ranges; Cancel saves nothing; either way the editing is over', () => {
  const save = (action, locals, g) => { const r = run('position_save.js', { globals: g, locals: Object.assign({ busaction: action }, locals) }); return r.busmsg; };
  const g = { BusIslandGap: '42', BusIslandY: '9', BusStateEditing: String(AT) };
  assert.strictEqual(save('done', { set_gap: '47.6', set_y: '%set_y' }, g), 'Saved: camera gap 48 dp');
  assert.deepStrictEqual([g.BusIslandGap, g.BusIslandY, g.BusStateEditing], ['48', '9', '0']);
  assert.strictEqual(save('done', { set_y: '31' }, g), 'Saved: top offset 24 dp', 'kept within the slider\'s range');
  const c = { BusIslandGap: '42', BusStateEditing: String(AT) };
  assert.strictEqual(save('cancel', { set_gap: '60' }, c), 'none');
  assert.deepStrictEqual([c.BusIslandGap, c.BusStateEditing], ['42', '0']);
});

test('while editing (up to 10 minutes), a countdown\'s own island is kept hidden, as if sideways; it still says upright', () => {
  const check = (editingAt) => { const g = { BusStateEditing: String(editingAt) }; const r = run('fullscreen.js', { globals: g, locals: { busconfig: '{1.15 port}' }, now: AT }); return [r.busfullnow, g.BusStateFullscreen]; };
  assert.deepStrictEqual(check(AT - 60000), ['yes', 'no']);
  assert.deepStrictEqual(check(AT - 11 * 60000), ['no', 'no'], 'left open for over 10 minutes: shown again');
  assert.deepStrictEqual(check(0), ['no', 'no']);
});

// ---- 3. The island, live ----------------------------------------------------------------------------------
const SAMPLE = JSON.stringify({ u: AT, r: 45000, rot: 3000, s: 'preview', n: 'Preview (Stop B)', l: 'B', b: [{ k: '517', d: 'Town Centre', t: AT + 5 * 60000, st: 'live' }], a: [] });
const live = (extra) => {
  const g = Object.assign({ BusRoutes: '517', BusScreenW: '448', BusCameraX: '224', BusIslandGap: '42', BusIslandY: '9', BusStatePreviewData: SAMPLE, BusStateIslandData: SAMPLE }, extra || {});
  const locals = { busdatavar: 'BusStatePreviewData', buslive: 'yes' };
  return { built: run('island_show.js', { globals: Object.assign({}, g), locals, now: AT }), page: runPage(g, AT, { locals }) };
};
const moves = (page) => page.calls.filter((c) => c[0] === 'updateOverlayConfig').map((c) => c[1]);

test('the island follows the sliders: a wider gap widens it and keeps the gap over the camera, a new top moves it down', () => {
  const { built, page } = live();
  assert.match(built.html, /<div id="pos" hidden>%BusStatePrevPos<\/div>/);
  page.setText('pos', '50,%set_y,%set_cx');
  const pad = 9, left = built.LEFT, right = built.RIGHT;
  assert.deepStrictEqual(moves(page), [{ width: String(pad + left + 50 + right + pad), x: String(Math.round(224 - 25 - left - pad)), configTransitionMs: 0 }]);
  assert.strictEqual(page.html.style['--gap'], '50px');
  page.setText('pos', '50,14,%set_cx');
  assert.deepStrictEqual(moves(page)[1], { y: '14', configTransitionMs: 0 }, 'the gap is the same: only the top moves');
  page.setText('pos', '50,14,%set_cx');
  assert.strictEqual(moves(page).length, 2, 'nothing new: no move');
});

test('the status bar chip follows its offset from the left and its top; an island not drawn live ignores the sliders', () => {
  const { page } = live({ BusStyle: 'chip' });
  page.setText('pos', '42,12,120');
  assert.deepStrictEqual(moves(page), [{ x: '120', y: '15', configTransitionMs: 0 }]);
  const real = runPage({ BusRoutes: '517', BusStateIslandData: SAMPLE }, AT);
  real.setText('pos', '50,12,120');
  assert.deepStrictEqual(moves(real), []);
});

// ---- 4. In the project ------------------------------------------------------------------------------------
const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const steps = (name) => [...[...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes(`<nme>${name}</nme>`))
  .matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => a[1]);
const code = (x) => +x.match(/<code>(\d+)<\/code>/)[1];
const str = (x, i) => (x.match(new RegExp(`<Str sr="arg${i}" ve="3">([^<]*)</Str>`)) || [0, ''])[1];

test('Bus Settings: Adjust live opens the editor last of all; no preview steps are left', () => {
  const s = steps('Bus Settings');
  const last = s[s.length - 1];
  assert.deepStrictEqual([code(last), str(last, 0)], [130, 'Bus Position']);
  assert.match(last, /<lhs>%buslive<\/lhs><op>2<\/op><rhs>yes<\/rhs>/);
  assert.ok(!/buspreview2|Wait 3 seconds/.test(xml), 'no preview steps anywhere');
});

test('Bus Position hides a countdown\'s island, draws the sample one live and the panel, each for 10 minutes at most', () => {
  const s = steps('Bus Position');
  const at = (re) => s.findIndex((x) => re.test(x));
  const hide = at(/<code>\d+<\/code>[\s\S]*<Str sr="arg0" ve="3">buspill<\/Str>/), live = at(/<Str sr="arg0" ve="3">%buslive<\/Str>/);
  const island = at(/<Str sr="arg2" ve="3">buspreview<\/Str>/), panel = at(/<Str sr="arg2" ve="3">busposition<\/Str>/);
  assert.ok(hide > -1 && hide < live && live < island && island < panel, 'in that order');
  for (const i of [island, panel]) assert.strictEqual(str(s[i], 11), '600000');
});

test('Bus Position Set is one step; Bus Position Done saves, removes both, redraws a countdown\'s island and reopens Settings on Position', () => {
  const set = steps('Bus Position Set');
  assert.deepStrictEqual([set.length, str(set[0], 0), str(set[0], 1)], [1, '%BusStatePrevPos', '%set_gap,%set_y,%set_cx']);
  const done = steps('Bus Position Done');
  const dismissed = done.filter((x) => code(x) === 44 || /<code>480<\/code>/.test(x)).map((x) => str(x, 0));
  assert.ok(dismissed.includes('busposition') && dismissed.includes('buspreview'));
  const performs = done.filter((x) => code(x) === 130).map((x) => [str(x, 0), str(x, 2)]);
  assert.deepStrictEqual(performs, [['Bus Refresh', ''], ['Bus Settings', 'position']]);
});
