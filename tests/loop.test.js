// Bus Loop timing (loop.js, loop_tick.js) and asking for positions again (push_params.js)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run } = require('./harness');

test('a normal countdown lasts BusTimeout minutes', () => {
  const g = { BusTimeout: '30', BusRefresh: '45' }; const now = Date.now();
  run('loop.js', { globals: g, now });
  assert.strictEqual(Math.round((+g.BusStateEndAt - now) / 60000), 30);
});
test('a heads-up at work lasts a minute', () => {
  const now = Date.now(); const g = { BusTimeout: '30', BusRefresh: '45', BusStateGlance: String(now) };
  run('loop.js', { globals: g, now });
  assert.strictEqual(Math.round((+g.BusStateEndAt - now) / 1000), 60);
});
test('after the minute: ends at your desk, carries on if you have left the office Wi-Fi', () => {
  const now = Date.now();
  const desk = { BusStateEndAt: String(now - 1000), BusStateGlance: String(now - 61000), BusStateWifi: 'Office', BusWorkWifi: 'Office', BusRefresh: '45', SCREEN: 'on' };
  const left = Object.assign({}, desk, { BusStateWifi: '' });        // copied before the run changes desk
  assert.strictEqual(run('loop_tick.js', { globals: desk, now }).busdone, 'yes');
  assert.strictEqual(run('loop_tick.js', { globals: left, now }).busdone, 'no');
});
test('waits longer while the next bus is far off', () => {
  const g = { BusRefresh: '45', BusStateEndAt: String(Date.now() + 60000), BusStateNextWait: '90', SCREEN: 'on', BusStateLastPush: String(Date.now()) };
  assert.strictEqual(run('loop_tick.js', { globals: g }).buswait, '90');
});
test('safety net: no position for 2 minutes with the screen on', () => {
  const now = Date.now(); const base = { BusRefresh: '45', BusStateEndAt: String(now + 60000), SCREEN: 'on' };
  assert.strictEqual(run('loop_tick.js', { globals: Object.assign({}, base, { BusStateLastPush: String(now - 30000) }), now }).busnopush, 'no');
  assert.strictEqual(run('loop_tick.js', { globals: Object.assign({}, base, { BusStateLastPush: String(now - 150000) }), now }).busnopush, 'yes');
  assert.strictEqual(run('loop_tick.js', { globals: Object.assign({}, base, { SCREEN: 'off', BusStateLastPush: '0' }), now }).busnopush, 'no');
});
test('positions are asked for again at the current rate (every 30 m on first run)', () => {
  assert.deepStrictEqual([run('push_params.js').buspushms, run('push_params.js').buspushm], ['20000', '30']);
  const g = { BusStatePushMs: '10000', BusStatePushM: '20' };
  assert.deepStrictEqual([run('push_params.js', { globals: g }).buspushms, run('push_params.js', { globals: g }).buspushm], ['10000', '20']);
});

test('still waiting at the stop when time is up: the countdown carries on, up to 2 hours', () => {
  const now = Date.now();
  const g = (trip, startedMinAgo) => ({ BusTimeout: '30', BusRefresh: '45', SCREEN: 'on', BusStateLastPush: String(now), BusStateStopId: 'S',
    BusStateEndAt: String(now - 1000), BusStateStartedAt: String(now - startedMinAgo * 60000), BusStateTrip: JSON.stringify(trip) });
  const waiting = g({ s: 'atstop', stop: 'S' }, 30);
  assert.strictEqual(run('loop_tick.js', { globals: waiting, now }).busdone, 'no', 'still at the stop after 30 minutes');
  assert.ok(+waiting.BusStateEndAt > now, 'given more time');
  assert.strictEqual(run('loop_tick.js', { globals: g({ s: 'atstop', stop: 'S' }, 121), now }).busdone, 'yes', 'but not past 2 hours');
  assert.strictEqual(run('loop_tick.js', { globals: g({ s: 'heading', stop: 'S' }, 30), now }).busdone, 'yes', 'heading there, not waiting: ends as before');
  assert.strictEqual(run('loop_tick.js', { globals: g({ s: 'left', stop: 'S' }, 30), now }).busdone, 'yes', 'left: ends');
});
