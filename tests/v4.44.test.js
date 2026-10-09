// V4.44: Settings laid out like Android's own: a main page of entries (each saying what it's set to
// now) that open pages of their own, under a top app bar whose back arrow goes up a level, and saves
// and closes from the main page.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run } = require('./harness');

function settings(extra) {
  const globals = Object.assign({ TflKey: 'key', BusRoutes: '517,566', BusRefresh: '45', BusTimeout: '30', BusHomeWifi: 'HomeNet', BusWorkWifi: 'WorkNet',
    BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|50', BusCacheStops: JSON.stringify({ KH: { r: ['517', '566', '289'], t: 'Holbry' } }) }, extra || {});
  const locals = { http_response_code: '200', gl_latitude: '51.3702', gl_longitude: '-0.29',
    bp_fine: '0', bp_bg: '0', bp_overlay: 'true', bp_access: 'net.dinglisch.android.taskerm/x', bp_battery: 'true',
    http_data: JSON.stringify({ stopPoints: [{ naptanId: 'KH', commonName: 'Kiln Street', indicator: 'Stop KH', lat: 51.37, lon: -0.29,
      lineModeGroups: [{ modeName: 'bus', lineIdentifier: ['517', '566', '289'] }] }] }) };
  const r = run('settings_open.js', { globals, locals });
  return JSON.parse(r.buslayout);
}
function all(node, out) {
  out = out || [];
  if (node && typeof node === 'object') {
    if (node.type) out.push(node);
    Object.keys(node).forEach((k) => { if (Array.isArray(node[k])) node[k].forEach((c) => all(c, out)); });
  }
  return out;
}

test('Settings is a Scaffold with a top app bar, and a page for each part', () => {
  const layout = settings();
  assert.strictEqual(layout.root.type, 'Scaffold');
  assert.strictEqual(layout.root.topBar[0].type, 'TopAppBar');
  const pages = layout.root.content[0].children.map((c) => c.id);
  assert.deepStrictEqual(pages, ['page_main', 'page_stops', 'page_countdown', 'page_wifi', 'page_island', 'page_position', 'page_setup']);
  const ids = all(layout.root).map((n) => n.id).filter(Boolean);
  assert.strictEqual(new Set(ids).size, ids.length, 'every id is unique');
});

test('the main page has an entry for each page, saying what it is set to now', () => {
  const layout = settings();
  const main = layout.root.content[0].children[0];
  const entries = all(main).filter((n) => n.type === 'Row' && n.eventHandlers);
  const to = entries.map((e) => e.eventHandlers.handlers[0].actions[0]);
  assert.deepStrictEqual(to.map((a) => [a.variable, a.value]), [['bus_page', 'stops'], ['bus_page', 'countdown'], ['bus_page', 'wifi'], ['bus_page', 'island'], ['bus_page', 'setup']]);
  const summaries = entries.map((e) => e.children[1].children[1].text);
  assert.deepStrictEqual(summaries.slice(0, 4), ['Kiln Street: 517, 566', 'Every 45 s, ends after 30 min', 'HomeNet and WorkNet', 'Island, the stop board closes after 10 s']);
  assert.strictEqual(summaries[4], 'TfL key added, all permissions on');
  // Position is one level down, from Island
  const island = layout.root.content[0].children[4];
  const pos = all(island).find((n) => n.type === 'Row' && n.eventHandlers);
  assert.deepStrictEqual(pos.eventHandlers.handlers[0].actions[0], { type: 'SetVariable', variable: 'bus_page', value: 'position' });
});

test('one page shows at a time, and the back arrow goes up a level (and saves and closes from the main page)', () => {
  const layout = settings();
  const pages = layout.root.content[0].children;
  assert.strictEqual(pages[0].showWhen, ['stops', 'countdown', 'wifi', 'island', 'position', 'setup'].map((p) => '%bus_page != "' + p + '"').join(' & '));
  pages.slice(1).forEach((p) => assert.strictEqual(p.showWhen, '%bus_page == "' + p.id.slice(5) + '"'));
  const backs = layout.root.topBar[0].navigationIcon[0].children;
  assert.deepStrictEqual(backs.map((b) => b.eventHandlers.handlers[0].actions.map((a) => a.type + ':' + (a.value || ''))),
    [['SetVariable:yes', 'DismissLayout:'], ['SetVariable:island'], ['SetVariable:main']]);
  assert.strictEqual(backs[0].eventHandlers.handlers[0].actions[0].variable, 'bus_save');
  assert.ok(backs.every((b) => b.icon === 'icon:ArrowBack'));
  const titles = layout.root.topBar[0].title[0].children;
  assert.deepStrictEqual(titles.map((t) => t.text), ['Bus Countdown', 'Stops and routes', 'Countdown', 'Home and work', 'Island', 'Position', 'Setup']);
});

test('first run: the main page says what to do first', () => {
  const layout = settings({ TflKey: '', BusRoutes: '' });
  const main = layout.root.content[0].children[0];
  assert.match(main.children[0].text, /Add your TfL key under Setup/);
});
