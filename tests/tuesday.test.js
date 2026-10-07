// Tuesday 6 October, replayed: excerpts of a real recorded day (tests/fixtures), through today's rules.
// Each test is one of the moments the recording showed going wrong in V4.26. (The timings, distances
// and TfL replies are real; the stop names, stop codes, routes, number plates and the place on the map
// are stand-ins, home and work are 200 m from their stops, and the Wi-Fi names are made up.)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { replay } = require('../build/replay-core');

const lines = fs.readFileSync(path.join(__dirname, 'fixtures', 'tue-6-oct-excerpts.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const { out } = replay(lines);
const clock = (o) => new Date(o.t + 3600000).toISOString().slice(11, 19);        // London time (BST)
const between = (a, b) => out.filter((o) => clock(o) >= a && clock(o) <= b);
const checks = (a, b) => between(a, b).filter((o) => o.k === 'check');
const at = (hms, k) => out.find((o) => clock(o) === hms && (!k || o.k === k));

test('09:17 on the 517 to work: no pop-up for the stop by work, and none once off the bus', () => {
  const morning = checks('09:12:00', '09:22:00');
  assert.ok(morning.length > 15);
  assert.deepStrictEqual(morning.filter((o) => o.action !== 'none').map((o) => `${clock(o)} ${o.action}`), []);
  assert.match(at('09:17:36', 'check').why, /by work: no pop-up/);
  assert.match(at('09:20:07', 'check').why, /off the bus at Corvel Lodge School \(adj\)/);
  assert.match(at('09:21:53', 'check').why, /off the bus at Corvel Lodge School \(opp\)/, 'walking past the other stop to work');
});

test('17:05 TfL drops the 517 due in 7 minutes: it stays on the island with ~, and buzzes at about 4½ minutes', () => {
  // On the phone the island showed the next bus, 20 minutes away, and the first buzz came at 1.9
  for (const hms of ['17:05:28', '17:06:22', '17:07:02']) {
    const o = at(hms, 'tfl');
    assert.strictEqual(o.line.b.some((b) => b[1] === 'WA12DKD'), false, 'TfL really had dropped it');
    assert.strictEqual(o.soonest.v, 'WA12DKD', hms);
    assert.strictEqual(o.soonest.st, 'sched', 'shown with ~, as an estimate');
  }
  assert.strictEqual(at('17:05:28', 'tfl').buzz, 'no', 'still 6 minutes away');
  const firstBuzz = between('17:02:00', '17:12:00').find((o) => o.k === 'tfl' && o.buzz === 'yes');
  assert.strictEqual(clock(firstBuzz), '17:07:02');
  assert.ok(firstBuzz.soonest.min > 4 && firstBuzz.soonest.min < 5);
});

test('17:11 a bus that drops out under 2 minutes away has been and gone: not kept', () => {
  const o = at('17:11:08', 'tfl');
  assert.strictEqual(o.soonest.v, 'LA28LPG');
});

test('17:40 on the 517 to Wexley, where you change: still shown, no buzz for the bus you are on', () => {
  assert.strictEqual(at('17:40:37', 'check').action, 'approach');
  const riding = between('17:40:37', '17:43:49').filter((o) => o.k === 'tfl');
  assert.ok(riding.length >= 5);
  assert.deepStrictEqual(riding.filter((o) => o.buzz === 'yes').map(clock), [], 'riding LA28LPG to the stop');
  const waiting = between('17:43:50', '17:47:00').filter((o) => o.k === 'tfl' && o.buzz === 'yes');
  assert.strictEqual(waiting[0].soonest.v, 'LE15BXA', 'the 566 buzzes once your bus has reached the stop');
});

test('17:44 two refreshes 6 seconds apart give one buzz, not two together', () => {
  const buzzes = between('17:44:00', '17:47:00').filter((o) => o.k === 'tfl' && o.buzz === 'yes');
  for (let i = 1; i < buzzes.length; i++) assert.ok(buzzes[i].t - buzzes[i - 1].t >= 30000);
});

test('17:48 leaving Wexley on the 566 in traffic ends as "on the bus", not "walking away"', () => {
  const o = at('17:48:28', 'check');
  assert.strictEqual(o.action, 'stop');
  assert.strictEqual(o.state, 'onbus');
  assert.match(o.why, /on the bus, away from Wexley/);
});

test('18:19 on the 566 home: no pop-up for the stop by home (on the phone you swiped it away twice)', () => {
  const home = checks('18:17:00', '18:21:00');
  assert.deepStrictEqual(home.filter((o) => o.action !== 'none').map((o) => `${clock(o)} ${o.action}`), []);
  assert.match(at('18:19:12', 'check').why, /by home: no pop-up/);
});

// ---- Which bus you're on (V4.28) -------------------------------------------------------------------
// The same excerpts, and again with home and work unknown so the rides to work and home show their
// countdowns too: each of Tuesday's three rides is matched to the bus you were really on.
const all = replay(lines, { BusHomeAt: '', BusWorkAt: '' }).out;
const allAt = (hms, k) => all.find((o) => clock(o) === hms && (!k || o.k === k));

test('09:18 on the 517 to work: matched to WH63YOX on the second refresh', () => {
  assert.strictEqual(allAt('09:17:46', 'tfl').yours, null, 'one refresh isn\'t enough');
  assert.strictEqual(allAt('09:18:37', 'tfl').yours, 'WH63YOX');
  // The recording starts with you already on it, so you were never seen getting on: since 4.34 a
  // match on arrival time alone is only "probably", and the bus stays on the island
  assert.strictEqual(allAt('09:18:37', 'tfl').match.sure, false);
  assert.ok(allAt('09:18:37', 'tfl').shown.includes('WH63YOX'), 'so it stays on the island (4.34)');
  assert.ok(all.filter((o) => o.k === 'tfl' && o.yours && clock(o) < '10:00').every((o) => o.yours === 'WH63YOX'), 'never any other');
});

test('17:41 on the 517 to Wexley: matched to LA28LPG, with the 566 as your connection', () => {
  const o = at('17:41:39', 'tfl');
  assert.strictEqual(o.yours, 'LA28LPG');
  // Not seen getting on at 17:20 (the countdown there ended without Bus Watch, so the trip was already
  // "left"), so since 4.34 it's only "probably" yours
  assert.match(o.match.note, /^probably on the 517 \(LA28LPG\), at Wexley .* in about 2 min; then the 566 6 min after you get there$/);
});

test('17:48 leaving Wexley: you got on LE15BXA (not LA28LPG, the bus you came in on)', () => {
  assert.match(at('17:48:28', 'check').why, /: the 566 \(LE15BXA\)$/);
});

test('18:19 on the 566 home: known at once, as the bus you got on at Wexley', () => {
  const o = allAt('18:19:21', 'tfl');
  assert.strictEqual(o.yours, 'LE15BXA');
  assert.strictEqual(o.match.by, 'boarded');
});
