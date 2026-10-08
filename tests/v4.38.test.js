// V4.38: a train standing near a bus stop no longer shows that stop as one you're riding to; the trip
// recorder only counts a day as started once its first line is really written, and Bus Status says
// what's in today's file; Bus Status says when you're off the bus you last got on.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run, files } = require('./harness');
const { replay } = require('../build/replay-core');

const clock = (o) => new Date(o.t + 3600000).toISOString().slice(11, 19);
const evening = fs.readFileSync(path.join(__dirname, 'fixtures', 'wed-7-oct-evening.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ---- 1. Wednesday evening, the train into Wexley ----------------------------------------------------
test('a train standing at Wexley, 200 m from the route, with fixes of ±82 m and worse: no pop-up for the bus stop', () => {
  const checks = replay(evening).out.filter((o) => o.k === 'check' && clock(o) >= '17:35:00' && clock(o) <= '17:46:00');
  assert.ok(checks.length >= 10);
  assert.ok(checks.some((o) => o.line.action === 'approach'), 'on the phone (4.33) it popped up for Wexley / Thornacre Precinct (Stop D)');
  assert.deepStrictEqual(checks.filter((o) => o.action === 'approach' || o.state === 'heading').map(clock), []);
});

test('a real bus heading for a saved stop, with ordinary fixes, still shows it a couple of minutes ahead (Tuesday and Wednesday replay as before)', () => {
  const tue = fs.readFileSync(path.join(__dirname, 'fixtures', 'tue-6-oct-excerpts.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const at = replay(tue).out.find((o) => o.k === 'check' && clock(o) === '17:40:37');
  assert.strictEqual(at.action, 'approach');
});

// ---- 2. The trip recorder ------------------------------------------------------------------------------
const NOW = Date.UTC(2026, 9, 8, 7, 5, 0);
const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(NOW).getDay()];
const FILE = `Download/Tasker-bus-trip-data/bus-trip-${day}.jsonl`;
const endLog = (g, now, locals) => run('end_log.js', { now, globals: g, locals: Object.assign({ busfrom: 'island' }, locals) });

test('if the first write of the day fails, the day is not marked as started: the next line starts the file, with the setup', () => {
  delete files[FILE];
  const g = { BusRecord: 'on', BusRecordDay: '2026-10-7', BusStateStopId: 'S', BusRoutes: '517' };
  endLog(g, NOW, { writeFile: () => { throw new Error('EACCES (Permission denied)'); } });
  assert.strictEqual(g.BusRecordDay, '2026-10-7', 'still yesterday: nothing was written today');
  assert.match(g.BusRecordErr, /EACCES/);
  endLog(g, NOW + 60000);
  assert.strictEqual(g.BusRecordDay, '2026-10-8');
  assert.strictEqual(g.BusRecordErr, '');
  const lines = files[FILE].trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(lines[0].k, 'setup', 'the file starts with the setup, so the day replays');
  assert.strictEqual(lines.length, 2);
});

function status(g, now) { return run('status.js', { globals: g, now }).busstatus; }

test('Bus Status says how many lines today\'s file has and when the last was written, as Tasker reads it', () => {
  delete files[FILE];
  const g = { BusRecord: 'on', BusRecordDay: '2026-10-7', BusStateStopId: 'S', BusRoutes: '517', BusPlaces: '' };
  endLog(g, NOW);
  assert.match(status(g, NOW + 60000), new RegExp(`Recording trips: on \\(Downloads/Tasker-bus-trip-data/bus-trip-${day}\\.jsonl: 2 lines, last at 08:05\\)`));
});

test('Bus Status says when today\'s file is missing, and the last write error', () => {
  delete files[FILE];
  const g = { BusRecord: 'on', BusRecordDay: '2026-10-8', BusRecordErr: '08:04 EACCES (Permission denied)', BusRoutes: '517', BusPlaces: '' };
  const s = status(g, NOW);
  assert.match(s, /bus-trip-\w{3}\.jsonl: not found; last write failed at 08:04 EACCES/);
});

// ---- 3. "Last got on", once you're off it -------------------------------------------------------------
test('Bus Status still names the bus you last got on, but says you are off it once you are on foot', () => {
  const boarded = JSON.stringify({ k: '566', v: 'SF40MGA', stop: 'KH', at: NOW - 18 * 60000, sure: true });
  const base = { BusRoutes: '517,566', BusPlaces: 'bus|KH|Kiln Street (Stop KH)|51.37|-0.29|50\nbus|G|Wexley / Thornacre Precinct (Stop G)|51.34|-0.31|100', BusStateBoarded: boarded };
  const riding = status(Object.assign({ BusStateTrip: JSON.stringify({ s: 'heading', stop: 'G', bus: true, since: NOW - 240000 }) }, base), NOW);
  assert.match(riding, /Last got on: the 566 \(SF40MGA\) at Kiln Street \(Stop KH\), 07:47\n/);
  const walking = status(Object.assign({ BusStateTrip: JSON.stringify({ s: 'heading', stop: 'G', bus: false, since: NOW - 240000 }) }, base), NOW);
  assert.match(walking, /Last got on: the 566 \(SF40MGA\) at Kiln Street \(Stop KH\), 07:47 \(off it now\)/);
});
