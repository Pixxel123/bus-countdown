// Replay a recorded day (Downloads/Tasker-bus-trip-data/bus-trip-<Day>.jsonl from the phone) through Bus Watch's rules as
// they are now, and show where today's code decides differently from what happened on the phone.
//   npm run replay -- path/to/bus-trip-Tue.jsonl
// Each "check" line is one position as it came in; the day's "setup" line gives your stops and
// settings. Start and end are played as the tasks would (Bus Start / Bus End). The work is done by
// build/replay-core.js, which the tests use too.
'use strict';
const fs = require('fs');
const { replay } = require('./replay-core');

const file = process.argv[2];
if (!file) { console.error('Usage: npm run replay -- bus-trip-Tue.jsonl'); process.exit(1); }
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const time = (t) => new Date(t).toTimeString().slice(0, 8);
let differ = 0, checks = 0;
for (const o of replay(lines).out) {
  if (o.k === 'check') {
    checks++; if (!o.same) differ++;
    const l = o.line;
    console.log(time(o.t), o.same ? '  ' : '≠ ', `[${o.state}] ${o.action} ${o.why}` + (o.same ? '' : `   (on the phone: [${l.state}] ${l.action} ${l.why})`) +
      (o.mode ? `   {travel mode: ${o.mode}, ${o.kv} m/s}` : ''));
  } else if (o.k === 'tfl') {
    if (o.buzz === 'yes') console.log(time(o.t), '  buzz:', o.soonest ? `${o.soonest.k} ${o.soonest.v} in ${o.soonest.min.toFixed(1)} min` : '');
  } else console.log(time(o.t), '  ' + o.note);
}
console.log(`\n${checks} positions replayed; ${differ} decided differently from the phone.`);
