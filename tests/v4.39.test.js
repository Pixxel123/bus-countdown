// V4.39, from Thursday morning (tests/fixtures/thu-8-oct-morning.jsonl: stand-in names, codes,
// routes, plates and positions; home, work and Wi-Fi are the Tuesday excerpts' stand-ins). The tram
// into Kiln Street, the 517 from there to work, staying on it through Wexley. On the phone (4.37):
// the tram standing still for 25 s ended the countdown and it came back 2 minutes later; getting on
// the 517 (LE35YTX) was noted as the 566 (SF40MGA), due a minute earlier and gone; and after the 517
// waited at Wexley a minute and a half, the rest of the ride counted as "just left a stop".
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { replay } = require('../build/replay-core');

const lines = fs.readFileSync(path.join(__dirname, 'fixtures', 'thu-8-oct-morning.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const clock = (o) => new Date(o.t + 3600000).toISOString().slice(11, 19);
const { out } = replay(lines);
const checks = (a, b) => out.filter((o) => o.k === 'check' && clock(o) >= a && clock(o) <= b);

test('the tram held short of Kiln Street does not end its countdown: one countdown from 08:40 until you get on', () => {
  const tram = checks('08:40:00', '08:48:00');
  assert.ok(tram.some((o) => o.line.action === 'stop'), 'on the phone it ended at 08:42:34');
  assert.deepStrictEqual(tram.filter((o) => o.action !== 'none').map((o) => clock(o) + ' ' + o.action), ['08:40:26 approach']);
  assert.ok(tram.some((o) => /standing still/.test(o.why)), 'standing still on the tram does not count as walking off it');
});

test('getting on at Kiln Street: the 517 you caught, not the 566 that went a minute before', () => {
  const on = checks('08:48:08', '08:48:08')[0];
  assert.match(on.why, /^on the bus, away from Kiln Street \(Stop KH\): the 517 \(LE35YTX\)$/);
  assert.match(on.line.why, /the 566 \(SF40MGA\)/, 'the phone picked the 566');
});

test('held at Wexley a minute and a half, then riding on to work: still on the bus, and still the 517', () => {
  const r = replay(lines.filter((l) => clock(l) <= '09:08:00'));
  const after = r.out.filter((o) => o.k === 'check' && clock(o) >= '09:07:00');
  assert.match(after.find((o) => o.state === 'onbus').why, /^still on the bus past Wexley \/ Thornacre Precinct \(Stop G\)/);
  assert.strictEqual(JSON.parse(r.globals.BusStateBoarded).v, 'LE35YTX');
  assert.ok(out.filter((o) => o.k === 'check' && clock(o) >= '09:07:50' && clock(o) <= '09:16:00').every((o) => o.state === 'onbus'));
});

test('on the way to Wexley the 517 is known as yours, as the bus you got on', () => {
  const t = out.find((o) => o.k === 'tfl' && clock(o) >= '09:00:50' && o.line.stop === out.find((x) => x.k === 'tfl' && clock(x) >= '09:00:50').line.stop);
  assert.strictEqual(t.match.v, 'LE35YTX');
  assert.strictEqual(t.match.by, 'boarded');
});
