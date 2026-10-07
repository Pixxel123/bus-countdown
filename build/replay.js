// Replay a recorded day (Download/bus-trip-<Day>.jsonl from the phone) through Bus Watch's rules as
// they are now, and show where today's code decides differently from what happened on the phone.
//   npm run replay -- path/to/bus-trip-Tue.jsonl
// Each "check" line is one position as it came in; the day's "setup" line gives your stops and
// settings. Start and end are played as the tasks would (Bus Start / Bus End).
'use strict';
const fs = require('fs');
const { run } = require('../tests/harness');

const file = process.argv[2];
if (!file) { console.error('Usage: npm run replay -- bus-trip-Tue.jsonl'); process.exit(1); }
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const setup = lines.find((l) => l.k === 'setup');
const g = Object.assign({ BusStateRunning: '0', TRUN: '' }, setup ? setup.vars : {});
let differ = 0, checks = 0;
for (const l of lines) {
  if (l.k === 'end' && l.from === 'island') {            // you swiped it away: as Bus End does
    g.BusStateRunning = '0'; g.TRUN = '';
    run('end_log.js', { globals: g, now: l.t, locals: { busfrom: 'island' } });
    console.log(new Date(l.t).toTimeString().slice(0, 8), '  you swiped it away');
    continue;
  }
  if (l.k !== 'check' || l.lat === null) continue;
  checks++;
  const r = run('watch.js', { globals: g, now: l.t, locals: { buscaller: l.src === 'hand' ? '' : l.src, gl_latitude: String(l.lat), gl_longitude: String(l.lon),
    gl_time_seconds: String((l.t - (l.age || 0) * 1000) / 1000), busspeed: l.spd === null ? '' : String(l.spd), busbearing: l.brg === null ? '' : String(l.brg),
    busacc: l.acc === null ? '' : String(l.acc) } });
  if (r.busaction === 'start' || r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
  if (r.busaction === 'stop') { g.BusStateRunning = '0'; g.TRUN = ''; }
  const now = JSON.parse(g.BusStateTrip || '{}').s;
  const same = r.busaction === l.action && now === l.state;
  if (!same) differ++;
  console.log(new Date(l.t).toTimeString().slice(0, 8), same ? '  ' : '≠ ', `[${now}] ${r.busaction} ${r.why}` +
    (same ? '' : `   (on the phone: [${l.state}] ${l.action} ${l.why})`));
}
console.log(`\n${checks} positions replayed; ${differ} decided differently from the phone.`);
