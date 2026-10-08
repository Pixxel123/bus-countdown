// V4.41: Bus Refresh keeps the stop's other routes (the ones that aren't yours) for the stop board to
// come: in the island's data, soonest first, three times each, up to 8 routes; recorded and replayed.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, files } = require('./harness');
const { replay } = require('../build/replay-core');

const NOW = Date.UTC(2026, 9, 8, 7, 44, 0);
const bus = (k, mins, v, d) => ({ lineName: k, destinationName: d || 'X', timeToStation: Math.round(mins * 60), vehicleId: v });
function refresh(arrivals, extra) {
  const g = Object.assign({ BusRoutes: '566,517', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)', BusStateRunning: '1' }, extra || {});
  const r = run('refresh.js', { globals: g, now: NOW, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } });
  return { g, r, data: JSON.parse(g.BusStateIslandData) };
}

test('other routes are kept apart from yours: soonest route first, its next three times', () => {
  const { data } = refresh([bus('566', 2, 'SF40MGA', 'Wexley'), bus('289', 9, 'A1', 'Fernleigh'), bus('64', 5, 'B1', 'Thornacre'),
    bus('289', 20, 'A2', 'Fernleigh'), bus('64', 12, 'B2', 'Thornacre'), bus('64', 25, 'B3', 'Thornacre'), bus('64', 40, 'B4', 'Thornacre')]);
  assert.deepStrictEqual(data.b.map((x) => x.k), ['566'], 'the island itself is unchanged');
  assert.deepStrictEqual(data.a.map((x) => [x.k, x.d, x.t.map((t) => Math.round((t - NOW) / 60000))]),
    [['64', 'Thornacre', [5, 12, 25]], ['289', 'Fernleigh', [9, 20]]]);
});

test('up to 8 other routes, and none when TfL lists only yours', () => {
  const many = Array.from({ length: 11 }, (_, i) => bus(String(100 + i), i + 1, 'V' + i));
  assert.strictEqual(refresh(many).data.a.length, 8);
  assert.deepStrictEqual(refresh([bus('517', 4, 'C1')]).data.a, []);
});

test('the recorder keeps them with each reply, and a replay hands them back to Bus Refresh', () => {
  refresh([bus('517', 4, 'C1', 'Holbry'), bus('289', 9, 'A1', 'Fernleigh')], { BusRecord: 'on', BusRecordDay: '2026-10-8' });
  const day = Object.keys(files).filter((f) => /bus-trip-/.test(f)).sort().pop();
  const line = files[day].trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.k === 'tfl').pop();
  assert.deepStrictEqual(line.o, [['289', 'A1', 540, 'Fernleigh']]);
  const setup = { t: NOW - 1000, k: 'setup', vars: { BusRoutes: '566,517', BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|50' } };
  const start = { t: NOW - 500, k: 'start', stop: 'KH', name: 'Kiln Street (Stop KH)', mode: 'hand' };
  const { globals } = replay([setup, start, Object.assign({}, line, { t: NOW })]);
  assert.deepStrictEqual(JSON.parse(globals.BusStateIslandData).a.map((x) => [x.k, x.d]), [['289', 'Fernleigh']]);
});

test('a reply with no other routes records no "o", as before', () => {
  refresh([bus('517', 4, 'C1')], { BusRecord: 'on', BusRecordDay: '2026-10-8' });
  const day = Object.keys(files).filter((f) => /bus-trip-/.test(f)).sort().pop();
  const line = files[day].trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.k === 'tfl').pop();
  assert.strictEqual(line.o, undefined);
});
