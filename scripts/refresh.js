/* ==================================================================
   Bus Refresh · Build the departures
   Input : http_data = TfL live arrivals for the current stop
           BusCacheTimetable = today's scheduled departures (fallback)
   Every departure is turned into one common shape, which is all the
   island reads. V5 trains will produce the same shape:
     { k: label (route), d: destination, t: due (ms), st: status }
     st = live | sched (timetable) | late | cancel (late/cancel: trains, V5)
   Output: busnodata = yes when there's nothing at all to show
           busliveroutes = your routes with a live time (for tt_check.js)
           BusStateIslandData (global, read live by the island)
   ================================================================== */
/* @include get */
/* @include loc */
/* @include routesHere */
/* @include boardRows */
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

// The stop's other routes (4.41), for the stop board to come: every route TfL lists here that isn't
// one of yours, soonest first, with its next three times, up to 8 routes. Kept in the island's data
// (a) and recorded (o), so replays can test the board. Nothing else here reads them.
var otherBuses = [];
if (code === '200') {
  try {
    JSON.parse(http_data).forEach(function (b) {
      if (mine.indexOf(b.lineName) >= 0) return;
      otherBuses.push({ k: b.lineName, d: b.destinationName || '', t: now + b.timeToStation * 1000, v: b.vehicleId || '' });
    });
  } catch (e) { otherBuses = []; }
}
otherBuses.sort(function (a, b) { return a.t - b.t; });
var otherRoutes = []; var otherByRoute = {};
otherBuses.forEach(function (x) {
  if (!otherByRoute[x.k]) {
    if (otherRoutes.length >= 8) return;
    otherByRoute[x.k] = { k: x.k, d: x.d, t: [] }; otherRoutes.push(otherByRoute[x.k]);
  }
  if (otherByRoute[x.k].t.length < 3) otherByRoute[x.k].t.push(x.t);
});

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
// For tt_check.js, after the island: only routes with no live time need the timetable (4.43)
var busliveroutes = liveRoutes.join(',');
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
// three rides were each within 10 to 30 seconds of their bus's time. Your bus then leaves the island
// (you're on it, so it isn't news), never buzzes, and the buses after it are your connections; Bus
// Status says which bus you're on and when you'll get there. BusStateMatch keeps the state between
// refreshes (cleared once you're not riding).
var stopId = get('BusStateStopId');
var tripNow = {}; try { tripNow = JSON.parse(get('BusStateTrip') || '{}'); } catch (e) {}
var riding = tripNow.s === 'heading' && !!tripNow.bus && tripNow.stop === stopId;
var match = {}; try { match = JSON.parse(get('BusStateMatch') || '{}'); } catch (e) {}
// A match from another stop, or more than 10 minutes old (a countdown that ended mid-ride), is
// forgotten: an old one would read as "your bus has already arrived" and let your own bus buzz (4.32)
if (match.stop !== stopId || now - (match.at || 0) > 10 * 60000) match = { stop: stopId, n: 0 };
var yourBus = null;
if (riding) {
  var boarded = null; try { boarded = JSON.parse(get('BusStateBoarded') || 'null'); } catch (e) {}
  var boardedHere = boarded && now - boarded.at < 90 * 60000 && deps.some(function (x) { return x.v === boarded.v; });
  if (boardedHere) { if (match.v !== boarded.v || match.by !== 'boarded') match = { stop: stopId, k: boarded.k, v: boarded.v, n: 2, by: 'boarded', firm: boarded.sure !== false }; }
  else if (tripNow.eta && now - (tripNow.etaAt || 0) < 120000) {
    var m = matchBus(deps, tripNow.eta);
    if (m && m.v === match.v) { match.n++; match.err = Math.round(m.err); }
    else if (m) match = { stop: stopId, k: m.k, v: m.v, n: 1, by: 'eta', err: Math.round(m.err) };
  }
  var likely = match.n >= 2 ? deps.filter(function (x) { return x.v === match.v; })[0] || null : null;
  // Only a bus you were seen getting on counts as yours for the island and the buzz (4.34). A match
  // on arrival time alone stays a "probably": on Wednesday, coming into Kiln Street on the tram, your
  // arrival time matched the 566 WD21TSS, and 4.33 hid the very bus you were about to catch. A tram
  // or a car closing in on a stop looks just like a bus doing so; only getting on at a stop tells
  // them apart. A "probably" bus stays on the island like any other, and nothing buzzes while you
  // ride (as when your bus isn't known), but Bus Status and the recording still name it.
  match.sure = match.by === 'boarded' && match.firm !== false;
  if (likely && match.sure) yourBus = likely;
  // Kept for Bus Watch, so the bus you came in on is never taken for the one you then get on
  if (likely) setGlobal('BusStateCameOn', JSON.stringify({ k: likely.k, v: likely.v, stop: stopId, at: now, sure: match.sure }));
  if (likely && !match.noted) {
    match.noted = true;
    debugLog('Your bus: the ' + likely.k + ' (' + likely.v + ')' + (match.sure ? ', the one you got on' : ', probably: ' + match.err + ' s from your own arrival time'));
    record('match', { stop: stopId, route: likely.k, v: likely.v, by: match.by, sure: match.sure, err: match.err === undefined ? null : match.err });
  }
}
// The connection: the first bus on another route due after yours gets there (one before it can't be
// caught, and a later bus on your own route is no use: 4.32)
var named = yourBus || (typeof likely !== 'undefined' ? likely : null);
var connection = named ? deps.filter(function (x) { return x.v !== named.v && x.k !== named.k && x.t > named.t + 30000; })[0] : null;
match.note = named ? (yourBus ? '' : 'probably ') + 'on the ' + named.k + ' (' + named.v + '), at ' + get('BusStateStopName') + ' in about ' +
  Math.max(1, Math.round((named.t - now) / 60000)) + ' min' + (connection ? '; then the ' + connection.k + ' ' +
  Math.round((connection.t - named.t) / 60000) + ' min after you get there' : '') : '';
match.at = now;
setGlobal('BusStateMatch', riding ? JSON.stringify(match) : '');
// While you ride, the island shows only the buses you could change to: your own bus is left out
// (4.30; 4.28 and 4.29 labelled it "You" instead). If it's the only bus listed, it stays, as an
// ordinary bus with its real destination, rather than the island saying "No buses".
if (yourBus) {
  var others = deps.filter(function (x) { return x.v !== yourBus.v; });
  deps = others.length ? others : deps.map(function (x) { return Object.assign({}, x, { mine: true }); });
  // Later buses on the route you're riding (the next 517 behind your 517) can't help you, but shown
  // like any other bus they can look like yours: their badge is drawn idle, in the grey of the
  // island's idle dots, instead of TfL red (4.31). Nothing else about them changes.
  deps = deps.map(function (x) { return x.k === yourBus.k && x.v !== yourBus.v ? Object.assign({}, x, { idle: true }) : x; });
}
var busnodata = (code !== '200' && !deps.length) ? 'yes' : 'no';
// When these times arrived, for Bus Refresh's next run (fetch_due.js: a second fetch within 20 s is skipped)
if (code === '200') { setGlobal('BusStateFetchAt', String(now)); setGlobal('BusStateFetchStop', get('BusStateStopId')); }

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
setGlobal('BusStateNextMin', String(Math.round(soonest * 10) / 10));   // for Bus Status and old versions of Bus Loop
// When the next thing happens, as a time (so it counts down between refreshes): the soonest bus
// shown, or your own bus reaching the stop if that's sooner. Bus Loop fetches with the screen off
// once this is within 8 minutes. (Before 4.32 it kept the minutes from the last fetch, which never
// counted down: a bus 12 minutes away meant no fetch, and no buzz, with the phone in your pocket.)
var nextAt = deps.length ? deps[0].t : 0;
if (yourBus && (!nextAt || yourBus.t < nextAt)) nextAt = yourBus.t;
setGlobal('BusStateNextAt', nextAt ? String(nextAt) : '');

// The island shows the soonest departure on each route, and the one after it on that route (t2,
// st2) when there is one, as "5 · 12 min"
var seen = {}; var perRoute = [];
deps.forEach(function (x) {
  if (!seen[x.k]) { seen[x.k] = Object.assign({}, x); perRoute.push(seen[x.k]); }
  // (TfL sometimes lists the same bus twice: a time within a minute of the first is the same bus)
  else if (seen[x.k].t2 === undefined && x.t - seen[x.k].t >= 60000) { seen[x.k].t2 = x.t; seen[x.k].st2 = x.st; }
  // and a third for the stop board (4.42; the island itself shows two)
  else if (seen[x.k].t2 !== undefined && seen[x.k].t3 === undefined && x.t - seen[x.k].t2 >= 60000) { seen[x.k].t3 = x.t; seen[x.k].st3 = x.st; }
});

// One bus at a time: only the soonest bus at the stop, whatever its route, can buzz. Within 5 minutes
// it buzzes three times, on two refreshes in a row (so you notice even if the first passes you by),
// then stays quiet. The next bus only gets its turn once that one has gone from the list, so two
// routes arriving close together give only one set of buzzes. Buses are told apart by TfL's
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
var buzzRiding = riding && !(match.n >= 2 && match.sure && !yourBus);
var first = deps.filter(function (x) { return x.t - now > -60000 && (!buzzRiding || (yourBus && !x.mine && !x.idle && x.t > yourBus.t + 30000)); })
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
  b: deps.map(function (x) { return [x.k, x.v || '', Math.round((x.t - now) / 1000), x.kept ? 'k' : x.st === 'sched' ? 's' : 'l']; }),
  o: otherBuses.length ? otherBuses.map(function (x) { return [x.k, x.v, Math.round((x.t - now) / 1000), x.d]; }) : undefined });   // the stop's other routes (4.41)
/* @include stopLetter */
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
  setGlobal('BusStateIslandShown', '2');        // showing, but to be drawn again (so the old one is removed)
}
// The stop board, open, has a line for each route (island_show.js keeps how many it was drawn with):
// a route coming or going draws it again at its new height (4.43: it now opens before fetching)
var rowsNow = boardRows(perRoute.length, otherRoutes.length, get('BusBoardRoutes') === 'mine');
// (Not for a board the page grew out of the island itself: it resizes its own window, 4.43)
if (get('BusStateBoard') === '1' && get('BusStateBoardSelf') !== '1' && get('BusStateIslandShown') === '1' && get('BusStateBoardRows') !== '' && get('BusStateBoardRows') !== String(rowsNow)) {
  setGlobal('BusStateIslandShown', '2');
}
var islandData = {
  u: now,                                                       // when this data arrived
  r: 1000 * normalWait,                                         // the usual time between refreshes: border and fading
  rot: Math.round(1000 * (parseFloat(get('BusRotate')) || 6)),  // time per route: border with several
  s: get('BusStateStopId'), n: get('BusStateStopName'),         // current stop (a change = Bus Opposite)
  l: busletter,                                                 // its letter ("B", "BK"), or "" for none
  b: perRoute,
  a: otherRoutes                                                // the stop's other routes: { k, d, t: [up to 3 times] } (4.41)
};
setGlobal('BusStateIslandData', JSON.stringify(islandData));
// Each stop's last island data, for the 4 stops fetched most recently (4.43): a long press shows the
// stop it switches to at once, with these times if they're under 3 minutes old (opposite.js)
var byStop = {}; try { byStop = JSON.parse(get('BusStateIslandByStop') || '{}') || {}; } catch (e) {}
byStop[islandData.s] = islandData;
setGlobal('BusStateIslandByStop', JSON.stringify(Object.keys(byStop).sort(function (a, b) { return byStop[b].u - byStop[a].u; }).slice(0, 4)
  .reduce(function (o, k) { o[k] = byStop[k]; return o; }, {})));

// Chip: "25 in 5 min" in the status bar, plain lines when it's opened
function mins(x) { var m = Math.round((x.t - now) / 60000); return (x.st === 'sched' ? '~' : '') + (m < 1 ? (x.st === 'sched' ? '1' : 'now') : m); }
