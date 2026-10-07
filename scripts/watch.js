/* ==================================================================
   Bus Watch · Where are you in a trip, and what should the island do?
   Used by Bus Moved (each pushed position) and Bus Watch (screen on, or
   run by hand). BusPlaces has one line per saved stop: "bus|id|name|
   lat|lon|radius" (no radius means BusNearRadius).

   A trip is a small state machine (BusStateTrip), so each position only
   has to answer "from where we are, does this move us on?":
     idle     no island. At a stop and slowed down -> at stop (start).
              Heading for a stop, due within a few minutes -> heading.
     heading  island showing, not there yet. Reached it and slowed ->
              at stop. Passed it or turned away, or on a bus going away,
              or got off well short of it (walking, over twice the
              minutes-ahead setting away, three checks running) -> left.
     at stop  waiting. On a bus heading away -> on bus (end). Walking
              steadily away, or past the end distance -> left (end).
     on bus   riding (no island, unless a saved stop is coming up on the
              route). Walking pace again -> left.
     left     island gone. That stop only starts again once you've come
              back 100 m from the furthest you went, or after 15 minutes.
              Other stops are free.
   Ending by swiping, timing out or getting home also moves to "left".

   Decisions use a sliding window of the last 6 positions
   (BusStateWindow): speed is the median of the last three readings
   (Android's own, or worked out from the window), and "moving away" is
   the trend of your distance from the stop across the window, not one
   jump. Poor fixes (over 25 m accuracy) are averaged with the previous
   one. On a bus, stops ahead are found by projecting you onto the
   route's line of stops (BusCacheSeq), not by compass direction.

   Swiping the island away snoozes everything (BusStateSnooze) until
   you've been to that stop and left it, clear of all your stops, or for
   30 minutes (a run by hand ignores that). Just off a bus, or on one,
   the stop by home or work never pops up: you've arrived. How often
   Android pushes positions follows the state as well.
   Output: busaction (start / approach / stop / none), busnote (what it
           found), busdwell (yes: in a circle but still walking),
           busnearedge (metres outside the nearest stop's circle),
           buspushmode / buspushms / buspushm (a new position rate)
   ================================================================== */
/* @include get */
/* @include loc */
/* @include metres */

var now = Date.now();
var lat = parseFloat(loc('gl_latitude')); var lon = parseFloat(loc('gl_longitude'));
var fixT = parseFloat(loc('gl_time_seconds')) > 0 ? parseFloat(loc('gl_time_seconds')) * 1000 : now;
var fixAge = Math.round((now - fixT) / 1000);
var accuracy = parseFloat(loc('busacc') || loc('gl_coordinates_accuracy')) || null;
var stale = fixAge > 180;
var caller = loc('buscaller');
var byHand = !/^profile/.test(caller);
var androidSpeed = loc('busspeed') !== '' ? parseFloat(loc('busspeed')) : -1;       // m/s, -1 = unknown
var bearing = loc('busbearing') !== '' ? parseFloat(loc('busbearing')) : -1;

var busaction = 'none';
var busdwell = 'no';
var why = '';
var skipped = '';                    // why approaching() passed over a stop, for the note
var afterAll = '';                   // set when a walk away turns out to have been a bus
var closest = null;
var trip = { s: 'idle' };

if (!stale && !isNaN(lat) && !isNaN(lon)) {
  // ---- Sliding window of recent positions, with smoothing ----------------------------------
  var win = []; try { win = JSON.parse(get('BusStateWindow') || '[]'); } catch (e) {}
  win = win.filter(function (w) { return now - w.t < 5 * 60000; });        // only the last 5 minutes
  // A poor fix (over 25 m) is averaged with the previous one, weighted by how accurate each is
  var prevW = win.length ? win[win.length - 1] : null;
  if (accuracy && accuracy > 25 && prevW && fixT - prevW.t < 30000 && prevW.acc) {
    var wNow = 1 / (accuracy * accuracy); var wPrev = 1 / (prevW.acc * prevW.acc);
    lat = (lat * wNow + prevW.lat * wPrev) / (wNow + wPrev);
    lon = (lon * wNow + prevW.lon * wPrev) / (wNow + wPrev);
  }
  if (!prevW || fixT > prevW.t + 1000) {
    var est = androidSpeed;
    // No reading from Android (most of the time: only 13% of Tuesday's positions had one): worked out
    // from the newest position at least 8 s back with a decent fix (50 m or better; a poor one makes
    // a jump that looks like a fast bus), and never more than 30 m/s
    if (est < 0 && (accuracy || 15) <= 50) {
      for (var b = win.length - 1; b >= 0; b--) {
        if (fixT - win[b].t >= 8000 && (win[b].acc || 15) <= 50) { est = Math.min(30, metres(win[b].lat, win[b].lon, lat, lon) / ((fixT - win[b].t) / 1000)); break; }
      }
    }
    win.push({ t: fixT, lat: +lat.toFixed(6), lon: +lon.toFixed(6), acc: accuracy || 15, spd: est >= 0 ? +est.toFixed(2) : -1 });
    win = win.slice(-6);
    setGlobal('BusStateWindow', JSON.stringify(win));
  }
  // Speed: the median of the last three readings, so one jumpy fix can't fake (or hide) a bus
  var recent = win.map(function (w) { return w.spd; }).filter(function (v) { return v >= 0; }).slice(-3).sort(function (a, c) { return a - c; });
  var speed = recent.length ? recent[Math.floor(recent.length / 2)] : -1;
  // Moving away from a point: the trend of your distance from it across the window (least squares, m/s)
  function trend(pLat, pLon) {
    var part = win.slice(-4);                         // the most recent positions only
    if (part.length < 3) return 0;
    var xs = part.map(function (w) { return (w.t - part[0].t) / 1000; }); var ys = part.map(function (w) { return metres(w.lat, w.lon, pLat, pLon); });
    var n = xs.length; var mx = 0; var my = 0; var sxy = 0; var sxx = 0; var k;
    for (k = 0; k < n; k++) { mx += xs[k] / n; my += ys[k] / n; }
    for (k = 0; k < n; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) * (xs[k] - mx); }
    return sxx > 0 ? sxy / sxx : 0;
  }

  // ---- Saved stops: distances, circles, the nearest ------------------------------------------
  var defaultR = parseFloat(get('BusNearRadius')) || 50;
  var target = sideTarget();
  var stops = [];
  get('BusPlaces').split('\n').forEach(function (row) {
    var p = row.split('|');
    if (p[0] !== 'bus' || p.length < 5) return;
    // Arrival distance: the stop's own, or BusNearRadius; never more than 200 m (bigger circles made
    // countdowns start far away and restart as you left)
    var st = { id: p[1], n: p[2], lat: parseFloat(p[3]), lon: parseFloat(p[4]), r: Math.min(200, parseFloat(p[5]) > 0 ? parseFloat(p[5]) : defaultR) };
    st.d = metres(lat, lon, st.lat, st.lon); st.edge = st.d - st.r; st.pref = headsTowards(st.id, target);
    stops.push(st);
    if (!closest || st.edge < closest.edge) closest = { name: st.n, d: st.d, radius: st.r, edge: st.edge };
  });
  var beyondAll = stops.every(function (st) { return st.d > st.r * 1.6; });
  // Inside more than one circle (both sides of a road): the side heading your way wins, then the nearer
  var insideStops = stops.filter(function (st) { return st.d <= st.r; })
    .sort(function (a, c) { return (c.pref - a.pref) || (a.edge - c.edge); });
  function endAtFor(st) { return Math.max(Math.min(250, Math.max(150, 3 * st.r)), st.r + 100); }


  // ---- The trip state, kept in step with what's actually happening --------------------------
  try { trip = JSON.parse(get('BusStateTrip') || '{"s":"idle"}'); } catch (e) { trip = { s: 'idle' }; }
  var running = get('BusStateRunning') === '1' && /(^|,)Bus Loop(,|$)/.test(get('TRUN'));
  if (get('BusStateRunning') === '1' && !running) setGlobal('BusStateRunning', '0');
  var shownId = get('BusStateStopId');
  var shown = stops.filter(function (st) { return st.id === shownId; })[0];
  if (running && shown && (trip.stop !== shownId || trip.s === 'idle' || trip.s === 'left' || trip.s === 'onbus')) {
    // A countdown started some other way (by hand, leaving work, heads-up): pick it up
    trip = { s: shown.d <= shown.r ? 'atstop' : 'heading', stop: shownId, since: now, minD: Math.round(shown.d) };
  } else if (!running && (trip.s === 'atstop' || trip.s === 'heading')) {
    // Ended without us (swiped, timed out, got home): treat it as left
    var was = stops.filter(function (st) { return st.id === trip.stop; })[0];
    trip = { s: 'left', stop: trip.stop, since: now, leftD: was ? Math.round(was.d) : 0 };
  }
  // Swiped away (Bus End notes it in BusStateSnooze: the stop, and when): nothing starts anywhere
  // until you've got near the stop and then away from it, clear of all your stops, or for 30 minutes.
  // A run by hand ignores this. It's kept apart from the trip, and the "got near" part matters: on
  // Tuesday, swiped on the bus 300 m before the stop, you were already clear of all your stops, so
  // the old rule lifted it on the next position and the island came straight back.
  var snoozeRaw = get('BusStateSnooze') || '';
  var snooze = null; try { snooze = snoozeRaw ? JSON.parse(snoozeRaw) : null; } catch (e) { snooze = null; }
  if (snooze) {
    var sStop = stops.filter(function (st) { return st.id === snooze.stop; })[0];
    if (sStop) snooze.minD = Math.min(snooze.minD === undefined ? sStop.d : snooze.minD, Math.round(sStop.d));
    // Away: reached it and then 150 m past the closest you came, or 300 m further off than that
    // closest point without reaching it (turned back)
    var awayNow = sStop ? ((snooze.minD <= Math.max(sStop.r, 120) && sStop.d > snooze.minD + 150) || sStop.d > snooze.minD + 300) : true;
    var lifted = now - snooze.at > 30 * 60000 || (beyondAll && awayNow);
    var updated = lifted ? '' : JSON.stringify(snooze);
    // Only if it hasn't just been replaced by a new swipe while this check was running
    if (updated !== snoozeRaw && (get('BusStateSnooze') || '') === snoozeRaw) setGlobal('BusStateSnooze', updated);
    if (lifted) snooze = null;
  }
  var snoozed = !!snooze && !byHand;
  var snoozedAt = snoozed ? snooze.at : 0;
  var from = function (to, note) { trip = Object.assign({}, trip, { s: to, since: now }, note || {}); };
  var tripStop = stops.filter(function (st) { return st.id === trip.stop; })[0];

  // ---- What this position means, from the current state --------------------------------------
  // Slowed down: the speed reading is walking pace or less (unknown counts as slow), or, since a rough
  // fix makes the reading bounce about even when you're standing still, you've hardly got anywhere:
  // over the last 30 to 90 seconds of positions, less than 25 m from where you were, under 0.5 m/s.
  // Walking past a stop covers 40 m or more in that time.
  var settled = (function () {
    var recentW = win.filter(function (w) { return fixT - w.t <= 90000; });
    if (recentW.length < 3) return false;
    var a = recentW[0]; var z = recentW[recentW.length - 1]; var span = (z.t - a.t) / 1000;
    if (span < 30) return false;
    var moved = metres(a.lat, a.lon, z.lat, z.lon);
    return moved < 25 && moved / span < 0.5;
  })();
  // Staying put somewhere, allowing for indoor GPS wander: at least 4 positions over 2 minutes or more
  // (in the last 5), all within 80 m of where they average out. Walking 2 minutes covers 170 m. Only
  // used to slow the pushes down far from your stops (Tuesday evening indoors, the fix wandered 30
  // to 70 m, so "settled" above never held).
  var staying = (function () {
    if (win.length < 4 || win[win.length - 1].t - win[0].t < 120000) return false;
    var mLat = 0; var mLon = 0;
    win.forEach(function (w) { mLat += w.lat / win.length; mLon += w.lon / win.length; });
    return win.every(function (w) { return metres(w.lat, w.lon, mLat, mLon) <= 80; });
  })();
  var slow = speed < 0 || speed <= 0.8 || settled;
  var lastTwo = win.map(function (w) { return w.spd; }).filter(function (v) { return v >= 0; }).slice(-2);
  var bus = speed > 4.2 || (lastTwo.length === 2 && lastTwo[0] > 4.2 && lastTwo[1] > 4.2);   // or the last two both fast
  // Steady pace away from a stop: the fastest average over 90 seconds or more of the window. Walking
  // tops out under 2 m/s even with GPS error; over 2.2 m/s for that long is a bus, however slowly it
  // crawled through traffic (Tuesday, leaving Wexley on the 566: 2.6 m/s for nearly 3 minutes, which
  // a single speed reading never showed)
  var paceAway = function (st) {
    var best = 0;
    win.forEach(function (w) { var dt = (fixT - w.t) / 1000; if (dt >= 90) best = Math.max(best, (st.d - metres(w.lat, w.lon, st.lat, st.lon)) / dt); });
    return best;
  };
  // On a bus lately (in the last 5 minutes): BusStateLastBusAt. Used to tell getting off at the stop
  // by home or work (no countdown) from walking up to it to catch one
  if (bus) setGlobal('BusStateLastBusAt', String(now));
  var byBusLately = now - (parseInt(get('BusStateLastBusAt'), 10) || 0) < 5 * 60000;
  if (trip.s === 'atstop' && tripStop) {
    var away = trend(tripStop.lat, tripStop.lon);
    if (bus && away > 1 && tripStop.d > tripStop.r * 0.5) {
      busaction = 'stop'; why = 'on the bus, away from ' + tripStop.n + noteBoarded(tripStop); from('onbus', { boardedAt: tripStop.id });
    } else if (tripStop.d > Math.max(tripStop.r + 50, 120) && paceAway(tripStop) > 2.2) {
      busaction = 'stop'; why = 'on the bus, away from ' + tripStop.n + ' (' + Math.round(paceAway(tripStop) * 3.6) + ' km/h for the last few minutes)' + noteBoarded(tripStop);
      setGlobal('BusStateLastBusAt', String(now)); from('onbus', { boardedAt: tripStop.id });
    } else if (tripStop.d > endAtFor(tripStop) || (away > 0.4 && win.length >= 3 && tripStop.d > Math.max(tripStop.r + 50, 120))) {
      busaction = 'stop'; why = 'walking away from ' + tripStop.n; from('left', { leftD: Math.round(tripStop.d), walked: true });
    } else why = 'waiting at ' + tripStop.n;
  } else if (trip.s === 'heading' && tripStop) {
    trip.minD = Math.min(trip.minD || tripStop.d, Math.round(tripStop.d));
    var awayH = trend(tripStop.lat, tripStop.lon);
    if (tripStop.d <= tripStop.r && slow) { from('atstop'); why = 'reached ' + tripStop.n; }
    else if (bus && awayH > 1 && tripStop.d > endAtFor(tripStop)) { busaction = 'stop'; why = 'passed ' + tripStop.n + ' on a bus'; from('onbus'); }
    else if (trip.minD <= tripStop.r && awayH > 0.4 && tripStop.d > Math.max(tripStop.r + 50, 120)) { busaction = 'stop'; why = 'went past ' + tripStop.n; from('left', { leftD: Math.round(tripStop.d) }); }
    else if (tripStop.d > trip.minD + 200 && tripStop.d > endAtFor(tripStop)) { busaction = 'stop'; why = (bus ? 'passed ' : 'turned away from ') + tripStop.n; from(bus ? 'onbus' : 'left', { leftD: Math.round(tripStop.d) }); }
    // No longer coming up soon: shown while on a bus, but you got off (or slowed right down) well short
    // of it. At walking pace or slower, and more than twice BusApproachMin away at that pace, on three
    // checks in a row (so a bus crawling in traffic for a moment doesn't count), it ends. If you then
    // speed up towards it again (back on a bus), it can show again once you're 100 m closer.
    else if (!bus && speed >= 0 && speed <= 2.5 && tripStop.d > endAtFor(tripStop) &&
             tripStop.d / Math.max(speed, 0.3) > 2 * (parseFloat(get('BusApproachMin')) || 3) * 60 && (trip.slowN = (trip.slowN || 0) + 1) >= 3) {
      busaction = 'stop'; why = tripStop.n + ' is no longer coming up soon (' + Math.round(tripStop.d) + ' m at ' + Math.round(speed * 3.6) + ' km/h)';
      from('left', { leftD: Math.round(tripStop.d), slowN: 0 });
    }
    else { why = 'heading to ' + tripStop.n + ', ' + Math.round(tripStop.d) + ' m'; if (bus || speed > 2.5) trip.slowN = 0; }
  } else if (running) {
    why = 'a countdown is already running';
  } else {
    // Off the bus (or so it looks: a crawl in traffic reads the same). Keep the stop you boarded at, so
    // it still counts as just left: a bus held up while still inside that stop's circle mustn't pop
    // the island up for the stop you've just got on at
    if (trip.s === 'onbus' && !bus && speed >= 0 && speed < 2) {
      var boarded = stops.filter(function (st) { return st.id === trip.stop; })[0];
      from('left', { leftD: boarded ? Math.round(boarded.d) : 0, maxD: trip.maxD || 0 });
    }
    if (trip.s === 'left' && (now - trip.since > 15 * 60000)) trip = { s: 'idle' };
    // Ended as walking away, but you've kept up more than 2.2 m/s from that stop for 90 seconds or
    // more since: it was a bus after all, pulling away slowly (the countdown ended either way; this
    // keeps the trip, and the recording, right)
    if (trip.s === 'left' && trip.walked && now - trip.since < 5 * 60000) {
      var leftFrom = stops.filter(function (st) { return st.id === trip.stop; })[0];
      if (leftFrom && paceAway(leftFrom) > 2.2) {
        afterAll = 'on a bus after all, from ' + leftFrom.n + ' (' + Math.round(paceAway(leftFrom) * 3.6) + ' km/h for the last few minutes)' + noteBoarded(leftFrom);
        setGlobal('BusStateLastBusAt', String(now)); from('onbus', { boardedAt: leftFrom.id, leftD: Math.round(leftFrom.d), walked: false });
      }
    }
    if (trip.s === 'left' || trip.s === 'onbus') {    // how far you've gone since leaving that stop
      var leftStop = stops.filter(function (st) { return st.id === trip.stop; })[0];
      if (leftStop) trip.maxD = Math.max(trip.maxD || 0, Math.round(leftStop.d));
    }
    var arrival = insideStops.filter(function (st) { return !justLeft(st); })[0];
    if (arrival && (snoozed && !byHand)) why = 'snoozed: you swiped it away; it comes back once you\u2019ve been to that stop and left it, or at ' + new Date(snoozedAt + 30 * 60000).toTimeString().slice(0, 5);
    else if (arrival && byBusLately && !byHand && homeOrWork(arrival)) why = 'off the bus at ' + arrival.n + ', by ' + homeOrWork(arrival) + ': no countdown (you\u2019ve arrived)';
    else if (arrival && !slow && !byHand) { why = 'passing by at ' + Math.round(speed * 3.6) + ' km/h: waits until you slow down (or stay put for 30 s)'; busdwell = 'yes'; }
    else if (arrival) {
      busaction = 'start'; why = settled && speed > 0.8 ? 'start (you have stayed put, though the GPS speed reads ' + Math.round(speed * 3.6) + ' km/h)' : 'start';
      setGlobal('BusStateArrivedStop', arrival.id); setGlobal('BusStateStartMode', 'arrived|' + now);
      trip = { s: 'atstop', stop: arrival.id, since: now };
    } else if (insideStops.length && !byHand) why = 'you\u2019ve just left this stop: it starts again if you come back';
    else if (!snoozed) {
      var ahead = approaching();
      if (ahead) {
        busaction = 'approach'; why = ahead.why;
        setGlobal('BusStateArrivedStop', ahead.id); setGlobal('BusStateStartMode', 'approach|' + now);
        trip = { s: 'heading', stop: ahead.id, since: now, minD: Math.round(ahead.d), bus: ahead.bus };
      } else why = skipped || (trip.s === 'onbus' ? 'on a bus' : 'not close enough');
    } else why = 'snoozed: you swiped it away; it comes back once you\u2019ve been to that stop and left it, or at ' + new Date(snoozedAt + 30 * 60000).toTimeString().slice(0, 5);
  }
  // Riding a bus to the stop: when you'd get there at the pace you've been closing in on it, for
  // Bus Refresh to pick out the bus you're on (the one TfL has arriving then)
  if (trip.s === 'heading' && trip.bus && tripStop) {
    var closing = closingSpeed(tripStop);
    if (closing > 0.5) { trip.eta = Math.round(fixT + tripStop.d / closing * 1000); trip.etaAt = now; }
  }
  if (afterAll && busaction === 'none') why = afterAll;
  setGlobal('BusStateTrip', JSON.stringify(trip));
  if (busaction === 'stop') setGlobal('BusStateEndWhy', why);         // for Bus End's note in the recorder
}

// Heading for a saved stop, due there within BusApproachMin minutes.
//   On foot (0.8 to 2.5 m/s): moving towards it, within 45 degrees of Android's direction of travel.
//   By bus (faster, if BusApproach allows): you're projected onto the route's line of stops, and the
//   first saved stop further along the route, within reach, is the one coming up.
function approaching() {
  var setting = get('BusApproach') || 'both';
  if (setting === 'off' || speed <= 0.8) return null;
  var onABus = speed > 2.5;
  if (onABus && setting !== 'both') return null;
  var limit = (parseFloat(get('BusApproachMin')) || 3) * 60;
  var best = null;
  if (onABus) {
    var onRoute = alongRoute(speed * limit);
    if (onRoute) best = { id: onRoute.st.id, n: onRoute.st.n, d: onRoute.along, eta: onRoute.along / speed, pref: onRoute.st.pref };
  } else if (bearing >= 0) {
    stops.forEach(function (st) {
      var toStop = bearingTo(lat, lon, st.lat, st.lon);
      var off = Math.abs(((toStop - bearing) % 360 + 540) % 360 - 180);
      var eta = st.d / speed;
      // Heading to a pair of stops: the side heading your way wins, then the sooner
      if (off <= 45 && eta <= limit && st.d > 30 && (!best || (st.pref && !best.pref) || (st.pref === best.pref && eta < best.eta))) best = { id: st.id, n: st.n, d: st.d, eta: eta, pref: st.pref };
    });
  }
  if (!best || justLeft(best)) return null;
  // On a bus to the stop by home or work: that's where you get off, so no pop-up (Tuesday, both
  // arrivals were swiped away or ignored). A stop where you change buses still shows.
  var place = onABus ? homeOrWork(stops.filter(function (st) { return st.id === best.id; })[0] || best) : '';
  if (place) { skipped = 'on a bus to ' + best.n + ', by ' + place + ': no pop-up (you get off there)'; return null; }
  best.bus = onABus;
  best.why = 'heading to ' + best.n + ' (' + Math.round(best.d) + ' m, about ' + Math.max(1, Math.round(best.eta / 60)) + ' min ' + (onABus ? 'by bus' : 'on foot') + ')';
  return best;
}

// How fast you've been closing in on a stop (m/s): your distance from it now against a position 45
// seconds to 4 minutes back (the oldest such in the window). Straight-line both times, so a bend in
// the road affects both alike. -1 when there's nothing to go on.
function closingSpeed(st) {
  for (var i = 0; i < win.length; i++) {
    var dt = (fixT - win[i].t) / 1000;
    if (dt >= 45 && dt <= 240) return (metres(win[i].lat, win[i].lon, st.lat, st.lon) - st.d) / dt;
  }
  return -1;
}

// Which bus you got on at a stop: the one TfL had arriving nearest the time you left it (the last
// position within 40 m of it, or failing that inside its circle), from the buses Bus Refresh last
// listed there, including any gone from the list in the last 5 minutes (BusStateSeen), but never the
// bus you came in on (BusStateCameOn: changing at Wexley on Tuesday, that one was nearer). Saved as
// BusStateBoarded, so the next stop knows your bus at once, and recorded with how far TfL's time was
// from when you actually left (for checking TfL's predictions). Returns a note for the reason, or ''.
function noteBoarded(st) {
  var seenHere = {}; try { seenHere = JSON.parse(get('BusStateSeen') || '{}'); } catch (e) {}
  if (seenHere.s !== st.id) return '';
  var leftAt = 0; var inCircle = 0;
  win.forEach(function (w) { var d = metres(w.lat, w.lon, st.lat, st.lon); if (d <= 40) leftAt = w.t; if (d <= st.r) inCircle = w.t; });
  leftAt = leftAt || inCircle || now;
  var cameOn = null; try { cameOn = JSON.parse(get('BusStateCameOn') || 'null'); } catch (e) {}
  var best = null;
  (seenHere.b || []).forEach(function (x) {
    if (cameOn && cameOn.stop === st.id && cameOn.v === x.v && now - cameOn.at < 30 * 60000) return;   // the bus you got off
    var off = x.t - leftAt;
    if (off >= -180000 && off <= 360000 && (!best || Math.abs(off) < Math.abs(best.t - leftAt))) best = x;
  });
  if (!best) return '';
  setGlobal('BusStateBoarded', JSON.stringify({ k: best.k, v: best.v, stop: st.id, at: leftAt }));
  record('board', { stop: st.id, route: best.k, v: best.v, tfl: Math.round((best.t - leftAt) / 1000) });
  return ': the ' + best.k + ' (' + best.v + ')';
}

// A saved stop within 400 m of home or work (where Bus Watch has learned they are, from your Wi-Fi):
// 'home', 'work', or ''
function homeOrWork(st) {
  var places = [['home', 'BusHomeAt'], ['work', 'BusWorkAt']];
  for (var i = 0; i < places.length; i++) {
    var at = null; try { at = JSON.parse(get(places[i][1]) || 'null'); } catch (e) { at = null; }
    if (at && at.lat !== undefined && metres(st.lat, st.lon, at.lat, at.lon) <= 400) return places[i][0];
  }
  return '';
}
// Where you are along a route: the nearest segment of any route's line of stops (within 60 m), and
// the first saved stop after it, measured along the route. Returns { st, along } or null.
function alongRoute(maxAlong) {
  var seqs = []; try { seqs = JSON.parse(get('BusCacheSeq') || '[]'); } catch (e) {}
  var savedById = {}; stops.forEach(function (st) { savedById[st.id] = st; });
  var R = Math.PI / 180; var kx = Math.cos(lat * R) * 6371000 * R; var ky = 6371000 * R;   // degrees to metres, locally
  // Your direction of travel, as a unit vector (east, north): Android's bearing, or else the way the
  // window of recent positions has moved. Both directions of a route share the road, so a segment
  // only counts if it runs the same way you're going (within 60 degrees); otherwise a stop behind
  // you, on the other direction's line, could look "ahead".
  var tx = 0; var ty = 0;
  if (bearing >= 0) { tx = Math.sin(bearing * R); ty = Math.cos(bearing * R); }
  else if (win.length >= 2) {
    var w0 = win[0]; var w1 = win[win.length - 1];
    tx = (w1.lon - w0.lon) * kx; ty = (w1.lat - w0.lat) * ky;
    var tl = Math.sqrt(tx * tx + ty * ty); if (tl < 20) return null; tx /= tl; ty /= tl;
  } else return null;
  var found = null;
  seqs.forEach(function (seq) {
    for (var i = 0; i < seq.length - 1; i++) {
      var ax = (seq[i][2] - lon) * kx; var ay = (seq[i][1] - lat) * ky; var bx = (seq[i + 1][2] - lon) * kx; var by = (seq[i + 1][1] - lat) * ky;
      var dx = bx - ax; var dy = by - ay; var len2 = dx * dx + dy * dy;
      if (!len2 || (dx * tx + dy * ty) / Math.sqrt(len2) < 0.5) continue;      // runs the other way
      var f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      var off = Math.sqrt(Math.pow(ax + f * dx, 2) + Math.pow(ay + f * dy, 2));
      if (off > 60) continue;
      // From this point, walk along the route to the first saved stop ahead
      var along = Math.sqrt(len2) * (1 - f);
      for (var j = i + 1; j < seq.length && along <= maxAlong; j++) {
        if (savedById[seq[j][0]] && along > 30) {
          if (!found || along < found.along) found = { st: savedById[seq[j][0]], along: along };
          break;
        }
        if (j < seq.length - 1) along += metres(seq[j][1], seq[j][2], seq[j + 1][1], seq[j + 1][2]);
      }
    }
  });
  return found;
}

// Left a stop a moment ago: for 15 minutes it only starts again if you come back at least 100 m
// closer than where you left it. Stops a big arrival distance restarting it as you go.
function justLeft(st) {
  // The stop you've just left, walking or on a bus (including the one you boarded at)
  if (!st || (trip.s !== 'left' && trip.s !== 'onbus') || trip.stop !== st.id || now - (trip.since || 0) > 15 * 60000) return false;
  var furthest = Math.max(trip.maxD || 0, trip.leftD || 0);
  return !(furthest - st.d >= 100);                  // free again once you've come back 100 m from your furthest
}

var gps = [];
if (accuracy) gps.push('\u00b1' + Math.round(accuracy) + ' m');
gps.push(fixAge + ' s old');
if (typeof speed !== 'undefined' && speed >= 0) gps.push(Math.round(speed * 3.6) + ' km/h');
function age(sec) { return sec >= 7200 ? Math.round(sec / 3600) + ' hours' : sec >= 120 ? Math.round(sec / 60) + ' minutes' : sec + ' seconds'; }
var busnote = stale ? 'Bus Watch: no fresh location (GPS needs a view of the sky); the newest was ' + age(fixAge) + ' old, so it was ignored'
  : isNaN(lat) ? 'Bus Watch: no GPS fix'
  : !closest ? 'Bus Watch: no saved stops (tick routes at your stops in Bus Settings)'
  : 'Bus Watch: [' + trip.s + '] ' + closest.name + ' is ' + Math.round(closest.d) + ' m away (starts within ' + closest.radius + ' m): ' + why + '.' + (gps.length ? ' GPS ' + gps.join(', ') : '');

// How often Android should push positions next, from the trip state (a request is only made when
// it changes, in BusStatePushMode):
//   heading or at the stop   every 20 m (at most every 10 s)
//   passing through a circle every 15 s, even standing still, so stopping there is noticed
//   near a stop's circle     every 10 m, so arriving at a small circle is never missed
//   anywhere else            every 30 m (at most every 20 s); back to this once over 80 m away
//   staying put 300 m or more outside all your stops' circles: every 100 m (at most once a minute),
//     until you're 150 m from where you stopped, or 250 m from a stop's circle. Indoors the fix wanders 30 to
//     70 m, which beat the 30 m step: Tuesday evening, sitting still for an hour, it checked 79 times.
var RATES = { countdown: ['10000', '20'], dwell: ['15000', '0'], near: ['5000', '10'], arrive: ['20000', '30'], far: ['60000', '100'] };
var rateNow = get('BusStatePushMode') || 'arrive';
var edgeNow = closest ? closest.edge : Infinity;
var farAt = null; try { farAt = JSON.parse(get('BusStateFarAt') || 'null'); } catch (e) { farAt = null; }
var stillFar = rateNow === 'far' && farAt && !isNaN(lat) && edgeNow > 250 && metres(lat, lon, farAt.lat, farAt.lon) < 150;
var goFar = typeof staying !== 'undefined' && (staying || settled) && !byBusLately && edgeNow > 300;
var rateWant = (trip.s === 'heading' || trip.s === 'atstop') ? 'countdown'
  : busdwell === 'yes' ? 'dwell'
  : (edgeNow > 0 && edgeNow <= 40) ? 'near'
  : stillFar || (goFar && trip.s !== 'onbus') ? 'far'
  : edgeNow > 80 ? 'arrive'
  : (rateNow === 'countdown' || rateNow === 'dwell') ? 'near' : rateNow;
if (rateWant === 'far' && rateNow !== 'far') setGlobal('BusStateFarAt', JSON.stringify({ lat: +lat.toFixed(6), lon: +lon.toFixed(6) }));
if (stale || isNaN(lat)) rateWant = rateNow;
var buspushmode = rateWant !== rateNow ? rateWant : 'none';
var buspushms = RATES[rateWant][0];
var buspushm = RATES[rateWant][1];
if (buspushmode !== 'none') { setGlobal('BusStatePushMode', rateWant); setGlobal('BusStatePushMs', buspushms); setGlobal('BusStatePushM', buspushm); }

// For Bus Moved: how far outside the nearest saved stop's circle you are (negative means inside)
var busnearedge = closest ? String(Math.round(closest.edge)) : '';

// For Bus Status: what this check decided
setGlobal('BusStateWatchInfo', (get('BusStateWatchInfo') || '') + ' \u2192 ' + busnote.replace(/^Bus Watch: /, ''));

/* @include record */
/* @include sides */

/* @include debugLog */
debugLog((caller === 'profile=moved' ? '(pushed) ' : '') + busnote.replace(/^Bus Watch: /, '') + (busaction !== 'none' ? ' => ' + busaction : ''));
// Recorder: the position as it came in, and what was decided from it
record('check', { src: caller || 'hand', lat: isNaN(lat) ? null : +lat.toFixed(6), lon: isNaN(lon) ? null : +lon.toFixed(6), acc: accuracy,
  spd: androidSpeed >= 0 ? +androidSpeed.toFixed(2) : null, brg: bearing >= 0 ? Math.round(bearing) : null, age: fixAge,
  v: typeof speed !== 'undefined' && speed >= 0 ? +speed.toFixed(2) : null,       // the speed the rules used (Android's, or worked out)
  bus: typeof bus !== 'undefined' && bus ? 1 : 0, settled: typeof settled !== 'undefined' && settled ? 1 : 0, rate: rateWant,
  state: trip.s, stop: trip.stop || '', action: busaction, why: why, near: closest ? { n: closest.name, d: Math.round(closest.d), r: closest.radius } : null });
