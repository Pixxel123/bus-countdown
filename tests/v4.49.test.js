// V4.49: Settings › Island can turn off the buzz when a bus is under 5 minutes away (BusBuzz). The
// island still shows the times as usual, and the main page's Island entry says "no buzz" while it's off.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run } = require('./harness');

// ---- 1. The buzz --------------------------------------------------------------------------------------
const base = (extra) => Object.assign({ BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: 'Ashenhurst (Stop B)' }, extra || {});
const bus = (route, min, vehicle) => ({ lineName: route, destinationName: 'Somewhere', timeToStation: Math.round(min * 60), vehicleId: vehicle });
const refresh = (g, arrivals, now) => run('refresh.js', { globals: g, now, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } });

test('off: no buzz for a bus under 5 minutes, and nothing noted as buzzed, but the island still has its times', () => {
  const g = base({ BusBuzz: 'off' }); let now = Date.UTC(2026, 9, 9, 8, 0, 0);
  const at = (min) => { now += 45000; return refresh(g, [bus('517', min, 'BX1')], now); };
  assert.deepStrictEqual([at(4.6), at(3.9), at(3.1)].map((r) => r.busbuzz), ['no', 'no', 'no']);
  assert.strictEqual(g.BusStateBuzzAt, undefined);
  assert.deepStrictEqual(JSON.parse(g.BusStateBuzzed), {});
  assert.strictEqual(JSON.parse(g.BusStateIslandData).b[0].k, '517');
});

test('on, or never set: buzzes as before', () => {
  for (const extra of [{ BusBuzz: 'on' }, {}]) {
    const g = base(extra); let now = Date.UTC(2026, 9, 9, 8, 0, 0);
    const at = (min) => { now += 45000; return refresh(g, [bus('517', min, 'BX1')], now).busbuzz; };
    assert.deepStrictEqual([at(4.6), at(3.9), at(3.1)], ['yes', 'yes', 'no']);
  }
});

test('turned back on with a bus already near: it gets its two buzzes then', () => {
  const g = base({ BusBuzz: 'off' }); let now = Date.UTC(2026, 9, 9, 8, 0, 0);
  const at = (min) => { now += 45000; return refresh(g, [bus('517', min, 'BX1')], now).busbuzz; };
  at(4.6);
  g.BusBuzz = 'on';
  assert.deepStrictEqual([at(3.9), at(3.1), at(2.4)], ['yes', 'yes', 'no']);
});

// ---- 2. Settings --------------------------------------------------------------------------------------
function settings(extra) {
  const globals = Object.assign({ TflKey: 'key', BusRoutes: '517,566', BusRefresh: '45', BusTimeout: '30', BusHomeWifi: 'HomeNet', BusWorkWifi: 'WorkNet',
    BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|50', BusCacheStops: JSON.stringify({ KH: { r: ['517', '566', '289'], t: 'Holbry' } }) }, extra || {});
  const locals = { http_response_code: '200', gl_latitude: '51.3702', gl_longitude: '-0.29',
    bp_fine: '0', bp_bg: '0', bp_overlay: 'true', bp_access: 'net.dinglisch.android.taskerm/x', bp_battery: 'true',
    http_data: JSON.stringify({ stopPoints: [{ naptanId: 'KH', commonName: 'Kiln Street', indicator: 'Stop KH', lat: 51.37, lon: -0.29,
      lineModeGroups: [{ modeName: 'bus', lineIdentifier: ['517', '566', '289'] }] }] }) };
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
// The option ticked when the page opens: its tick also shows while none has been tapped (" | (...)")
const ticked = (layout, setting) => all(page(layout, 'island')).find((n) => n.type === 'Button' && /^✓ /.test(n.text) &&
  JSON.stringify(n.eventHandlers || {}).includes(setting) && / \| \(/.test(n.showWhen)).text;

test('the Island page has the choice, On unless it was turned off, and saves it straight away', () => {
  const on = all(page(settings(), 'island')).filter((n) => n.type === 'Button' && JSON.stringify(n.eventHandlers || {}).includes('BusBuzz'));
  assert.deepStrictEqual(on.map((n) => n.text), ['✓ On', 'On', '✓ Off', 'Off']);
  assert.ok(all(page(settings(), 'island')).some((n) => n.type === 'Text' && /Buzz when a bus is under 5 min away/.test(n.text)));
  assert.strictEqual(ticked(settings(), 'BusBuzz'), '✓ On');
  assert.strictEqual(ticked(settings({ BusBuzz: 'off' }), 'BusBuzz'), '✓ Off');
});

test('Bus Settings Button saves on or off, and nothing else', () => {
  const set = (value, g) => { run('settings_button.js', { globals: g, locals: { busaction: 'set', bussetting: 'BusBuzz', busvalue: value } }); return g; };
  const g = set('off', {});
  assert.strictEqual(g.BusBuzz, 'off');
  assert.match(g.BusTempChanged, /buzz when a bus is near off/);
  assert.strictEqual(set('loud', { BusBuzz: 'on' }).BusBuzz, 'on');
});

test('the main page\'s Island entry says "no buzz" while it is off', () => {
  const entryText = (layout) => JSON.stringify(page(layout, 'main'));
  assert.match(entryText(settings({ BusBuzz: 'off' })), /no buzz/);
  assert.doesNotMatch(entryText(settings()), /no buzz/);
});
