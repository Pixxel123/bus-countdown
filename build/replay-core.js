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
    // You swiped it away: as Bus End does. Only if today's rules have a countdown showing too: a swipe
    // of one they wouldn't have shown never happened (4.32)
    if (l.k === 'end' && l.from === 'island') {
      if (g.BusStateRunning !== '1') { out.push({ t: l.t, k: 'swipe', line: l, note: 'swiped on the phone (no countdown here to swipe)' }); continue; }
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
    // (Recordings before 4.27 have no reason on any ending, from: ''. A Bus Watch ending there comes
    // just after the position that caused it, which today's rules have already played, so by then the
    // countdown is only still running here if today's rules kept it going.)
    // (4.34: an ending with no reason written up to 2 s after a position that stopped it, on the phone,
    // was Bus Watch's own: today's rules decide those for themselves. Any other ending with no reason
    // (Tuesday 17:20:31 came a second before a position that didn't stop anything) was something else,
    // and is played as it happened.)
    const watchEnd = l.k === 'end' && l.from === '' && lines.some((c) => c.k === 'check' && c.action === 'stop' && l.t - c.t >= 0 && l.t - c.t <= 2000);
    if (l.k === 'end' && l.from !== 'watch' && !watchEnd && g.BusStateRunning === '1') {
      g.BusStateRunning = '0'; g.TRUN = '';
      out.push({ t: l.t, k: 'end', line: l, note: `ended (${l.why || l.from || 'reason not recorded'})` });
      continue;
    }
    // Every TfL reply, failed ones too: on the phone Bus Refresh runs either way (and keeps the buses
    // TfL last listed when a fetch fails)
    if (l.k === 'tfl' && g.BusStateRunning === '1' && l.stop === g.BusStateStopId) {
      const ok = l.code === '200';
      const arrivals = ok ? l.b.filter((b) => b[3] === 'l').map((b) => ({ lineName: b[0], destinationName: '', timeToStation: b[2], vehicleId: b[1] })) : [];
      const r = run('refresh.js', { globals: g, now: l.t, locals: { http_response_code: ok ? '200' : String(l.code || ''), http_data: ok ? JSON.stringify(arrivals) : '' } });
      const shown = JSON.parse(g.BusStateIslandData || '{}').b || [];
      const soonest = shown.slice().sort((a, b) => a.t - b.t)[0];
      let match = {}; try { match = JSON.parse(g.BusStateMatch || '{}'); } catch (e) { match = {}; }
      // Your bus: worked out (on two refreshes, or as the bus you got on) and listed in this reply
      const yours = match.n >= 2 && l.b.some((b) => b[1] === match.v) ? match.v : null;
      out.push({ t: l.t, k: 'tfl', line: l, buzz: r.busbuzz, soonest: soonest ? { k: soonest.k, v: soonest.v, min: (soonest.t - l.t) / 60000, st: soonest.st, d: soonest.d } : null,
        yours, shown: shown.map((b) => b.v || ''), match, trip: JSON.parse(g.BusStateTrip || '{}') });
      continue;
    }
    if (l.k !== 'check' || l.lat === null) continue;
    const r = run('watch.js', { globals: g, now: l.t, locals: { buscaller: l.src === 'hand' ? '' : l.src, gl_latitude: String(l.lat), gl_longitude: String(l.lon),
      gl_time_seconds: String((l.t - (l.age || 0) * 1000) / 1000), busspeed: l.spd === null ? '' : String(l.spd), busbearing: l.brg === null ? '' : String(l.brg),
      busacc: l.acc === null ? '' : String(l.acc) } });
    if (r.busaction === 'start' || r.busaction === 'approach') {             // as Bus Start does
      g.BusStateRunning = '1'; g.TRUN = 'Bus Loop'; g.BusStateStopId = g.BusStateArrivedStop;
      const row = (g.BusPlaces || '').split('\n').map((x) => x.split('|')).find((p) => p[1] === g.BusStateStopId);
      g.BusStateStopName = row ? row[2] : '';
    }
    if (r.busaction === 'stop') { g.BusStateRunning = '0'; g.TRUN = ''; }
    const state = JSON.parse(g.BusStateTrip || '{}').s;
    let md = null; try { md = JSON.parse(g.BusStateMode || 'null'); } catch (e) { md = null; }   // travel mode on trial (4.34)
    out.push({ t: l.t, k: 'check', line: l, action: r.busaction, state, why: r.why, rate: g.BusStatePushMode, mode: md && md.t === l.t ? md.m : null, kv: md && md.t === l.t ? md.v : null,
      same: r.busaction === l.action && state === l.state });
  }
  return { out, globals: g };
}

module.exports = { replay };
