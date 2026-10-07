// The replay itself, shared by build/replay.js (npm run replay) and the tests (tests/tuesday.test.js).
// Plays a recorded day's lines through today's rules: each "check" through Bus Watch (watch.js), each
// "tfl" through Bus Refresh (refresh.js), and starts, ends and swipes the way the tasks would.
// Returns one entry per line played: { t, k, line (as recorded), and what today's rules decided }.
'use strict';
const { run } = require('../tests/harness');

function replay(lines, extraGlobals) {
  const setup = lines.find((l) => l.k === 'setup');
  const g = Object.assign({ BusStateRunning: '0', TRUN: '', BusRecord: 'off', BusRefresh: '45' }, setup ? setup.vars : {}, extraGlobals || {});
  const out = [];
  for (const l of lines) {
    if (l.k === 'end' && l.from === 'island') {            // you swiped it away: as Bus End does
      g.BusStateRunning = '0'; g.TRUN = '';
      run('end_log.js', { globals: g, now: l.t, locals: { busfrom: 'island' } });
      out.push({ t: l.t, k: 'swipe', line: l, note: 'you swiped it away' });
      continue;
    }
    // Countdowns started or ended by something other than Bus Watch (by hand, leaving work, Wi-Fi,
    // time's up) happened on the phone whatever the rules say now, so they're played as they were
    if (l.k === 'start' && !/^(arrived|approach)$/.test(l.mode)) {
      g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = l.stop; g.BusStateStopName = l.name;
      out.push({ t: l.t, k: 'start', line: l, note: `started (${l.mode}) at ${l.name}` });
      continue;
    }
    if (l.k === 'end' && l.from !== 'watch' && g.BusStateRunning === '1') {
      g.BusStateRunning = '0'; g.TRUN = '';
      out.push({ t: l.t, k: 'end', line: l, note: `ended (${l.why || l.from || 'reason not recorded'})` });
      continue;
    }
    if (l.k === 'tfl' && l.code === '200' && g.BusStateRunning === '1' && l.stop === g.BusStateStopId) {
      const arrivals = l.b.filter((b) => b[3] === 'l').map((b) => ({ lineName: b[0], destinationName: '', timeToStation: b[2], vehicleId: b[1] }));
      const r = run('refresh.js', { globals: g, now: l.t, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } });
      const shown = JSON.parse(g.BusStateIslandData || '{}').b || [];
      const soonest = shown.slice().sort((a, b) => a.t - b.t)[0];
      out.push({ t: l.t, k: 'tfl', line: l, buzz: r.busbuzz, soonest: soonest ? { k: soonest.k, v: soonest.v, min: (soonest.t - l.t) / 60000, st: soonest.st } : null });
      continue;
    }
    if (l.k !== 'check' || l.lat === null) continue;
    const r = run('watch.js', { globals: g, now: l.t, locals: { buscaller: l.src === 'hand' ? '' : l.src, gl_latitude: String(l.lat), gl_longitude: String(l.lon),
      gl_time_seconds: String((l.t - (l.age || 0) * 1000) / 1000), busspeed: l.spd === null ? '' : String(l.spd), busbearing: l.brg === null ? '' : String(l.brg),
      busacc: l.acc === null ? '' : String(l.acc) } });
    if (r.busaction === 'start' || r.busaction === 'approach') { g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop; }
    if (r.busaction === 'stop') { g.BusStateRunning = '0'; g.TRUN = ''; }
    const state = JSON.parse(g.BusStateTrip || '{}').s;
    out.push({ t: l.t, k: 'check', line: l, action: r.busaction, state, why: r.why, rate: g.BusStatePushMode,
      same: r.busaction === l.action && state === l.state });
  }
  return { out, globals: g };
}

module.exports = { replay };
