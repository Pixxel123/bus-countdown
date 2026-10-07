// Home and work Wi-Fi rules (watch_due.js), checked before any location
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run } = require('./harness');

function due(globals, ssid, caller = 'profile=moved') {
  const g = Object.assign({ BusPlaces: 'bus|S|Stop|51.37|-0.08|100', BusHomeWifi: 'Home', BusWorkWifi: 'Office', BusStateRunning: '0', TRUN: '' }, globals);
  const r = run('watch_due.js', { globals: g, locals: { buscaller: caller, busssid: ssid } });
  return { due: r.busdue, end: r.busend, leave: r.busleave, g };
}

test('on home Wi-Fi: nothing to check', () => assert.strictEqual(due({}, '"Home"').due, 'no'));
test('away from Wi-Fi: check location', () => assert.strictEqual(due({}, '<unknown ssid>').due, 'yes'));
test('run by hand on home Wi-Fi still checks', () => assert.strictEqual(due({}, '"Home"', 'ui').due, 'yes'));

test('getting home ends a countdown that started elsewhere', () => {
  assert.strictEqual(due({ BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStartWifi: '' }, '"Home"').end, 'yes');
});
test('a countdown started on home Wi-Fi carries on there', () => {
  assert.strictEqual(due({ BusStateRunning: '1', TRUN: 'Bus Loop', BusStateStartWifi: 'Home' }, '"Home"').end, 'no');
});

// Leaving counts after two checks off the Wi-Fi when there's no position (see v4.11.test.js for the
// 50 m rule), so these check twice with the same variables
function leaves(globals) {
  const first = due(globals, '<unknown ssid>');
  return due(first.g, '<unknown ssid>').leave;
}
test('leaving work shows the nearest stop (default)', () => {
  assert.strictEqual(leaves({ BusStateLastWifi: 'Office' }), 'yes');
});
test('leaving home does not (default), unless set to home or both', () => {
  assert.strictEqual(leaves({ BusStateLastWifi: 'Home' }), 'no');
  assert.strictEqual(leaves({ BusStateLastWifi: 'Home', BusLeaveShow: 'both' }), 'yes');
});
test('the last of home or work you were at is remembered, for which side comes first', () => {
  assert.strictEqual(due({}, '"Office"').g.BusStateLastPlace, 'work');
});
