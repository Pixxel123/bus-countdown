/* ==================================================================
   Bus Refresh · Build the departures
   Input : http_data = TfL live arrivals for the current stop
           BusCacheTimetable = today's scheduled departures (fallback)
   Every departure is turned into one common shape, which is all the
   island reads. V5 trains will produce the same shape:
     { k: label (route), d: destination, t: due (ms), st: status }
     st = live | sched (timetable) | late | cancel (late/cancel: trains, V5)
   Output: busnodata = yes when there's nothing at all to show
           BusStateIslandData (global, read live by the island)
   ================================================================== */
/* @include get */
/* @include loc */
/* @include routesHere */
/* @include debugLog */
/* @include record */
/* @include matchBus */
var mine = get('BusRoutes').split(',').map(function (s) { return s.trim(); });
var code = loc('http_response_code');
var now = Date.now();

// Live predictions on my routes (none if TfL couldn't be reached)
var deps = [];
if (code === '200') {
  try {
    JSON.parse(http_data).forEach(function (b) {
      if (mine.indexOf(b.lineName) < 0) return;
      deps.push({ k: b.lineName, d: b.destinationName, t: now + b.timeToStation * 1000, st: 'live', v: b.vehicleId || '' });
    });
  } catch (e) { deps = []; }
}

// Buses TfL drops for a while: every so often a bus still minutes away vanishes from TfL's list for
// a few refreshes, then comes back (Tuesday 6 Oct: the 517 due in 7 minutes disappeared for 2½
// minutes, the island showed the next one at 20 minutes, and the buzz came at 1.9). So each bus
// seen live is remembered (BusStateSeen, for this stop). One missing from this fetch, or from a
// failed fetch, stays on its last countdown, shown with "~" as an estimate, while it's still at
// least 2 minutes away and was seen in the last 3 minutes. Closer than that, it has probably come
// and gone, so it's dropped.
var seenBefore = {}; try { seenBefore = JSON.parse(get('BusStateSeen') || '{}'); } catch (e) {}
var remembered = seenBefore.s === get('BusStateStopId') ? (seenBefore.b || []) : [];
var listed = {}; deps.forEach(function (x) { if (x.v) listed[x.k + '|' + x.v] = true; });
var keptNow = [];
var goneNow = [];                    // gone from the list in the last 5 minutes: for Bus Watch to tell which you boarded
remembered.forEach(function (x) {
  if (listed[x.k + '|' + x.v] || mine.indexOf(x.k) < 0) return;
  if (!x.gone && x.t - now >= 2 * 60000 && now - x.seen <= 3 * 60000) {
    keptNow.push(x.k + ' ' + x.v);
    deps.push({ k: x.k, d: x.d, t: x.t, st: 'sched', v: x.v, kept: x.seen });
  } else if (now - x.seen <= 5 * 60000) goneNow.push({ k: x.k, v: x.v, d: x.d, t: x.t, seen: x.seen, gone: true });
});
setGlobal('BusStateSeen', JSON.stringify({ s: get('BusStateStopId'), b: deps.filter(function (x) { return x.v; }).map(function (x) {
  return { k: x.k, v: x.v, d: x.d, t: x.t, seen: x.kept || now };       // a kept bus keeps the time it was last really seen
}).concat(goneNow) }));
if (keptNow.length) debugLog('TfL dropped ' + keptNow.join(', ') + ': kept on its last countdown, with ~');

// Timetable fallback: each of my routes here with no live prediction gets its next scheduled departure
var d0 = new Date(); var nowMin = d0.getHours() * 60 + d0.getMinutes() + d0.getSeconds() / 60;
var tt = JSON.parse(get('BusCacheTimetable') || '{}')[get('BusStateStopId')];
var liveRoutes = deps.map(function (x) { return x.k; });
Object.keys((tt && tt.r) || {}).forEach(function (route) {
  var saved = tt.r[route];
  if (liveRoutes.indexOf(route) > -1 || mine.indexOf(route) < 0 || !saved || !saved.t) return;
  var next = saved.t.map(function (p) { return { m: p[0] < nowMin - 180 ? p[0] + 1440 : p[0], d: saved.n[p[1]] }; })  // after-midnight runs
    .filter(function (p) { return p.m >= nowMin; }).sort(function (a, b) { return a.m - b.m; }).slice(0, 2);   // the next two
  next.forEach(function (n) { deps.push({ k: route, d: n.d || 'Timetable', t: now + (n.m - nowMin) * 60000, st: 'sched' }); });
});

deps.sort(function (a, b) { return a.t - b.t; });

// ---- Which bus you're on --------------------------------------------------------------------------
// Riding a bus towards this stop (Bus Watch's trip is "heading", by bus), the bus you're on is one of
// those listed here. Bus Watch keeps when you'd get there at the pace you've been closing in
// (trip.eta); the bus whose TfL time agrees with that on two refreshes in a row is yours (matchBus).
// Or, straight away, the bus you got on at your last stop (BusStateBoarded), if it's listed. Tuesday's
// three rides were each within 10 to 30 seconds of their bus's time. Your bus then shows as "Your
// bus" on the island, never buzzes, and the buses after it are your connections. BusStateMatch keeps
// the state between refreshes (cleared once you're not riding).
var stopId = get('BusStateStopId');
var tripNow = {}; try { tripNow = JSON.parse(get('BusStateTrip') || '{}'); } catch (e) {}
var riding = tripNow.s === 'heading' && !!tripNow.bus && tripNow.stop === stopId;
var match = {}; try { match = JSON.parse(get('BusStateMatch') || '{}'); } catch (e) {}
if (match.stop !== stopId) match = { stop: stopId, n: 0 };
var yourBus = null;
if (riding) {
  var boarded = null; try { boarded = JSON.parse(get('BusStateBoarded') || 'null'); } catch (e) {}
  var boardedHere = boarded && now - boarded.at < 90 * 60000 && deps.some(function (x) { return x.v === boarded.v; });
  if (boardedHere) { if (match.v !== boarded.v || match.by !== 'boarded') match = { stop: stopId, k: boarded.k, v: boarded.v, n: 2, by: 'boarded' }; }
  else if (tripNow.eta && now - (tripNow.etaAt || 0) < 120000) {
    var m = matchBus(deps, tripNow.eta);
    if (m && m.v === match.v) { match.n++; match.err = Math.round(m.err); }
    else if (m) match = { stop: stopId, k: m.k, v: m.v, n: 1, by: 'eta', err: Math.round(m.err) };
  }
  if (match.n >= 2) yourBus = deps.filter(function (x) { return x.v === match.v; })[0] || null;
  // Kept for Bus Watch, so the bus you came in on is never taken for the one you then get on
  if (yourBus) setGlobal('BusStateCameOn', JSON.stringify({ v: yourBus.v, stop: stopId, at: now }));
  if (yourBus && !match.noted) {
    match.noted = true;
    debugLog('Your bus: the ' + yourBus.k + ' (' + yourBus.v + ')' + (match.by === 'boarded' ? ', the one you got on' : ', ' + match.err + ' s from your own arrival time'));
    record('match', { stop: stopId, route: yourBus.k, v: yourBus.v, by: match.by, err: match.err === undefined ? null : match.err });
  }
}
// The connection: the first bus due after yours gets there (one before it can't be caught)
var connection = yourBus ? deps.filter(function (x) { return x.v !== yourBus.v && x.t > yourBus.t + 30000; })[0] : null;
match.note = yourBus ? 'on the ' + yourBus.k + ' (' + yourBus.v + '), at ' + get('BusStateStopName') + ' in about ' +
  Math.max(1, Math.round((yourBus.t - now) / 60000)) + ' min' + (connection ? '; then the ' + connection.k + ' ' +
  Math.round((connection.t - yourBus.t) / 60000) + ' min after you get there' : '') : '';
setGlobal('BusStateMatch', riding ? JSON.stringify(match) : '');
// On the island it takes the destination's place, in the same quiet grey: "Your bus", or "You" when
// the island has room for only a few letters there (BusDestLetters, 3 by default). (4.28 coloured it
// light blue; 4.29 took that out, since the island is meant to be quiet.)
var yourLabel = (parseInt(get('BusDestLetters'), 10) || 3) >= 6 ? 'Your bus' : 'You';
if (yourBus) deps = deps.map(function (x) { return x.v === yourBus.v ? Object.assign({}, x, { d: yourLabel, mine: true }) : x; });
var busnodata = (code !== '200' && !deps.length) ? 'yes' : 'no';

// Refresh less often while the next bus is far off: more than 10 minutes away, wait twice
// BusRefresh (90 s by default) before the next fetch; closer than that, BusRefresh as normal.
// Bus Loop reads BusStateNextWait.
var baseWait = parseInt(get('BusRefresh'), 10) || 45;
var soonest = deps.length ? (deps[0].t - now) / 60000 : 0;
var nextWait = soonest > 10 ? 2 * baseWait : baseWait;
// TfL couldn't be reached (no signal, say): each failure in a row doubles the wait, up to 5 minutes;
// the first success goes straight back to normal (BusStateFailCount)
var normalWait = nextWait;                       // for fading old times (not stretched by backing off)
var fails = code === '200' ? 0 : (parseInt(get('BusStateFailCount'), 10) || 0) + 1;
setGlobal('BusStateFailCount', String(fails));
if (fails) nextWait = Math.min(300, baseWait * Math.pow(2, fails));
setGlobal('BusStateNextWait', String(nextWait));
setGlobal('BusStateNextMin', String(Math.round(soonest * 10) / 10));   // Bus Loop refreshes with the screen off when this is 8 or less

// The island shows the soonest departure on each route, and the one after it on that route (t2,
// st2) when there is one, as "5 · 12 min"
var seen = {}; var perRoute = [];
deps.forEach(function (x) {
  if (!seen[x.k]) { seen[x.k] = Object.assign({}, x); perRoute.push(seen[x.k]); }
  // (TfL sometimes lists the same bus twice: a time within a minute of the first is the same bus)
  else if (seen[x.k].t2 === undefined && x.t - seen[x.k].t >= 60000) { seen[x.k].t2 = x.t; seen[x.k].st2 = x.st; }
});

// One bus at a time: only the soonest bus at the stop, whatever its route, can buzz. Within 5 minutes
// it buzzes three times, on two refreshes in a row (so you notice even if the first passes you by),
// then stays quiet. The next bus only gets its turn once that one has gone from the list, so two
// routes arriving close together give one set of buzzes, not two. Buses are told apart by TfL's
// vehicle id (or, for a timetable time, the scheduled minute) at this stop; BusStateBuzzed keeps
// how many times each has buzzed, and forgets buses no longer listed.
//   The two buzzes are at least 30 seconds apart (two refreshes close together, the screen coming
//   on just after one, felt like one long buzz: BusStateBuzzAt).
//   Riding a bus towards the stop: never your own bus. Until it's known which that is, no buzz at all;
//   once it is, only a connection (due after you get there) can buzz.
var buzzed = {}; try { buzzed = JSON.parse(get('BusStateBuzzed') || '{}'); } catch (e) {}
var keyOf = function (x) { return get('BusStateStopId') + '|' + x.k + '|' + (x.v || Math.round(x.t / 60000)); };
var stillHere = {};
var busbuzz = 'no';               // its own "var": Tasker only passes back results declared this way
var sinceBuzz = now - (parseInt(get('BusStateBuzzAt'), 10) || 0);
deps.forEach(function (x) { if (buzzed[keyOf(x)]) stillHere[keyOf(x)] = buzzed[keyOf(x)]; });
// Riding, once your bus is known: the soonest connection buzzes instead (a bus due before yours gets
// there can't be caught); until it's known, nothing does
// (Your bus known but no longer listed: it has reached the stop, so you're there, and buzzing is as usual)
var buzzRiding = riding && !(match.n >= 2 && !yourBus);
var first = deps.filter(function (x) { return x.t - now > -60000 && (!buzzRiding || (yourBus && !x.mine && x.t > yourBus.t + 30000)); })
  .sort(function (a, b) { return a.t - b.t; })[0];
if (first && (first.t - now) / 60000 < 5 && (stillHere[keyOf(first)] || 0) < 2 && sinceBuzz >= 30000) {
  busbuzz = 'yes';
  stillHere[keyOf(first)] = (stillHere[keyOf(first)] || 0) + 1;
  setGlobal('BusStateBuzzAt', String(now));
}
setGlobal('BusStateBuzzed', JSON.stringify(stillHere));
if (busbuzz === 'yes') {
  debugLog('Buzz: ' + first.k + ' in ' + Math.max(0, Math.round((first.t - now) / 60000)) + ' min (' + stillHere[keyOf(first)] + ' of 2)');
  record('buzz', { stop: get('BusStateStopId'), route: first.k, v: first.v || '', min: Math.round((first.t - now) / 6000) / 10, n: stillHere[keyOf(first)] });
}
// Recorder: TfL's predictions as they came (route, vehicle, seconds away), for steadier times,
// matching you to your bus, and spotting buses that have left
record('tfl', { stop: get('BusStateStopId'), code: code, you: yourBus ? yourBus.v : undefined, took: loc('busstart') ? Date.now() - parseInt(loc('busstart'), 10) : null,
  b: deps.map(function (x) { return [x.k, x.v || '', Math.round((x.t - now) / 1000), x.kept ? 'k' : x.st === 'sched' ? 's' : 'l']; }) });
// The stop's letter, from its TfL indicator ("Stop B" -> B, "Stop BK" -> BK). Stops without one
// (indicators like "opp" or "->N", or none at all) get no letter, and the island shows none.
function stopLetter(name) {
  var m = /\(([^)]*)\)\s*$/.exec(name || ''); var ind = m ? m[1].trim() : '';
  var l = /^stop\s+([a-z][a-z0-9]?)$/i.exec(ind);
  return l ? l[1].toUpperCase() : '';
}
var busletter = stopLetter(get('BusStateStopName'));

// The island's size depends on how many of your routes this stop has (one dot each, whether or not
// they're showing right now) and, for the chip, the stop letter. If that changes (a different
// stop, or new settings), it's shown again at the new size. Same form as island_show.js: i or c
// (island or status bar chip), route count, L and the letter's length. A change (including switching
// Show as in Settings) shows it again in the new shape.
var shape = (get('BusStyle') === 'chip' ? 'c' : 'i') + routesHere(perRoute.length) +
  (busletter ? 'L' + busletter.length : '');                 // the chip is wider with a stop letter
// (The right half always has room for "~88 · ~88 min", so times, timetable "~" and second times
// coming and going never change the size, and never redraw the island.)
if (get('BusStateIslandShown') === '1' && get('BusStateIslandShape') !== '' && get('BusStateIslandShape') !== shape) {
  setGlobal('BusStateIslandShown', '0');
}
setGlobal('BusStateIslandData', JSON.stringify({
  u: now,                                                       // when this data arrived
  r: 1000 * normalWait,                                         // the usual time between refreshes: border and fading
  rot: Math.round(1000 * (parseFloat(get('BusRotate')) || 6)),  // time per route: border with several
  s: get('BusStateStopId'), n: get('BusStateStopName'),         // current stop (a change = Bus Opposite)
  l: busletter,                                                 // its letter ("B", "BK"), or "" for none
  b: perRoute
}));

// Chip: "25 in 5 min" in the status bar, plain lines when it's opened
function mins(x) { var m = Math.round((x.t - now) / 60000); return (x.st === 'sched' ? '~' : '') + (m < 1 ? (x.st === 'sched' ? '1' : 'now') : m); }
