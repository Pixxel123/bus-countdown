// Smaller pieces: the stop letter, refresh spacing, fresh positions, swiping, route orders
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run } = require('./harness');

function refresh(stopName, minutesAway) {
  const g = { BusRefresh: '45', BusRoutes: '517', BusStyle: 'pill', BusStateStopId: 'S', BusStateStopName: stopName };
  run('refresh.js', { globals: g, locals: { http_response_code: '200', http_data: JSON.stringify([{ lineName: '517', destinationName: 'Holbry', timeToStation: minutesAway * 60 }]) } });
  return { data: JSON.parse(g.BusStateIslandData), wait: g.BusStateNextWait };
}
test('stop letters: one or two letters, nothing for "opp" or arrows', () => {
  assert.strictEqual(refresh('Ashenhurst (Stop B)', 5).data.l, 'B');
  assert.strictEqual(refresh('Park Lane (Stop BK)', 5).data.l, 'BK');
  assert.strictEqual(refresh('Corvel Lodge School (opp)', 5).data.l, '');
  assert.strictEqual(refresh('High Street (->N)', 5).data.l, '');
});
test('refreshes every 90 s while the next bus is over 10 minutes away, 45 s otherwise', () => {
  assert.strictEqual(refresh('X (Stop A)', 14).wait, '90');
  assert.strictEqual(refresh('X (Stop A)', 4).wait, '45');
});
test('a position must be under a minute old during a countdown, 3 minutes otherwise', () => {
  const now = Date.now(); const age90 = { gl_latitude: '51.3', gl_time_seconds: String(now / 1000 - 90) };
  assert.strictEqual(run('loc_age.js', { globals: { BusStateRunning: '1' }, locals: age90, now }).busstale, 'yes');
  assert.strictEqual(run('loc_age.js', { globals: { BusStateRunning: '0' }, locals: age90, now }).busstale, 'no');
});
test('swiping the island away holds the trip as left, and snoozes in its own variable', () => {
  const g = { BusStateStopId: 'S' };
  run('end_log.js', { globals: g, locals: { busfrom: 'island' } });
  assert.strictEqual(JSON.parse(g.BusStateTrip).s, 'left');
  assert.strictEqual(JSON.parse(g.BusStateSnooze).stop, 'S');
});
test('route orders are kept from TfL\'s sequence reply', () => {
  const g = { BusTempFetchSeq: '[]' };
  run('cache_seq.js', { globals: g, locals: { http_response_code: '200', http_data: JSON.stringify({ stopPointSequences: [{ stopPoint: [{ id: 'A', lat: 51.1, lon: -0.1 }, { id: 'B', lat: 51.2, lon: -0.1 }] }] }) } });
  assert.deepStrictEqual(JSON.parse(g.BusTempFetchSeq), [[['A', 51.1, -0.1], ['B', 51.2, -0.1]]]);
});

test('Bus Status always has the full report ready for the clipboard, and says so', () => {
  const g = { BusStateVersion: '4.23', BusDebugLog: JSON.stringify(['08:18:00 (pushed) passing by']) };
  const r = run('debugging.js', { globals: g, locals: { busstatus: 'No countdown running' } });
  assert.match(r.busdebug, /STATUS\nNo countdown running[\s\S]*LAST DECISIONS[\s\S]*passing by/);
  assert.match(r.busshown, /Copied to the clipboard/);
});
