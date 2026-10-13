/* ==================================================================
   Bus Watch · Keep where your bus calls next (4.58)
   TfL's reply for the bus you're riding (/Vehicle/{id}/Arrivals): the
   stops it calls at next, soonest first, kept as BusStateFollow = { v:
   registration, at: when fetched, n: [[stop id, expected (ms), stop
   name], ...] } for Bus Watch (shared/followBus.js). A failed fetch
   keeps the last (Bus Watch stops trusting it after 2 minutes), and is
   counted in BusStateFollowTry, so follow_due.js waits longer before
   the next. The
   recorder keeps the first six stops, with seconds away, so a recorded
   day replays with them (build/replay-core.js).
   ================================================================== */
/* @include get */
/* @include loc */
var now = Date.now();
var answered = false;
if (loc('http_response_code') === '200' && loc('busfollowv')) {
  try {
    var calls = JSON.parse(http_data).map(function (p) { return [p.naptanId, now + p.timeToStation * 1000, p.stationName || '']; })
      .sort(function (a, b) { return a[1] - b[1]; })
      .filter(function (p, i, all) { return p[0] && (i === 0 || p[0] !== all[i - 1][0]); })
      .slice(0, 12);
    var bus = loc('busfollowv');
    setGlobal('BusStateFollow', JSON.stringify({ v: bus, at: now, n: calls }));
    record('follow', { v: bus, n: calls.slice(0, 6).map(function (p) { return [p[0], Math.round((p[1] - now) / 1000)]; }) });
    answered = true;
  } catch (e) {}
}
// For follow_due.js: answered (ask again in 20 to 45 s), or failed once more (wait longer each time)
var tried = null; try { tried = JSON.parse(get('BusStateFollowTry') || 'null'); } catch (e) { tried = null; }
if (tried && loc('busfollowv')) setGlobal('BusStateFollowTry', JSON.stringify({ v: tried.v, at: tried.at, fails: answered ? 0 : (tried.fails || 0) + 1 }));
if (!answered && loc('busfollowv')) record('follow', { v: loc('busfollowv'), fail: loc('http_response_code') || 'no reply' });

/* @include record */
