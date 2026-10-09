/* ==================================================================
   Bus Refresh · Keep the next stop's times for a long press (4.45)
   TfL's reply for the stop a long press goes to, kept two ways:
   - BusStatePrefetch = { s: stop, at: when fetched, b: [[route, vehicle,
     expected (ms), destination], ...] }, with each bus's expected time
     (not seconds away), so Bus Refresh can build the island from it a
     little later as if it had just arrived (prefetch_use.js);
   - that stop's entry in BusStateIslandByStop (as refresh.js keeps it
     for stops it has shown), so opposite.js shows its times the moment
     you hold the island: your routes' next three times and the stop's
     other routes, live times only (Bus Refresh adds the timetable's a
     moment later);
   - and (4.56) as the island's nx, so its page shows it the moment you
     hold the island, without waiting for Tasker.
   A failed fetch keeps the last.
   Output: busliveroutes (your routes with a live time there, for
           tt_check.js: the timetable is only needed for the others)
   ================================================================== */
/* @include get */
/* @include loc */
/* @include stopLetter */
/* @include nextStop */
var now = Date.now();
var busliveroutes = '';
if (loc('http_response_code') === '200' && loc('busprestop')) {
  try {
    var got = JSON.parse(http_data).map(function (b) { return [b.lineName, b.vehicleId || '', now + b.timeToStation * 1000, b.destinationName || '']; })
      .sort(function (a, b) { return a[2] - b[2]; });
    setGlobal('BusStatePrefetch', JSON.stringify({ s: loc('busprestop'), at: now, b: got }));
    var mine = get('BusRoutes').split(',').map(function (s) { return s.trim(); });
    // Your routes: the soonest bus on each, and the next two (a time within a minute of the one
    // before is TfL listing the same bus twice), as refresh.js builds them
    var perRoute = [];
    var seen = {};
    got.forEach(function (x) {
      if (mine.indexOf(x[0]) < 0) return;
      var r = seen[x[0]];
      if (!r) { seen[x[0]] = { k: x[0], d: x[3], t: x[2], st: 'live', v: x[1] }; perRoute.push(seen[x[0]]); }
      else if (r.t2 === undefined && x[2] - r.t >= 60000) { r.t2 = x[2]; r.st2 = 'live'; }
      else if (r.t2 !== undefined && r.t3 === undefined && x[2] - r.t2 >= 60000) { r.t3 = x[2]; r.st3 = 'live'; }
    });
    busliveroutes = perRoute.map(function (r) { return r.k; }).join(',');
    // The stop's other routes, soonest first: up to 8, three times each (as refresh.js, 4.41)
    var others = [];
    var byRoute = {};
    got.forEach(function (x) {
      if (mine.indexOf(x[0]) >= 0) return;
      if (!byRoute[x[0]]) { if (others.length >= 8) return; byRoute[x[0]] = { k: x[0], d: x[3], t: [] }; others.push(byRoute[x[0]]); }
      if (byRoute[x[0]].t.length < 3) byRoute[x[0]].t.push(x[2]);
    });
    var stops = []; try { stops = JSON.parse(get('BusStateNearbyStops') || '[]'); } catch (e) { stops = []; }
    var stop = stops.filter(function (s) { return s.id === loc('busprestop'); })[0] || { name: '' };
    var cur = {}; try { cur = JSON.parse(get('BusStateIslandData') || '{}') || {}; } catch (e) { cur = {}; }
    var byStop = {}; try { byStop = JSON.parse(get('BusStateIslandByStop') || '{}') || {}; } catch (e) { byStop = {}; }
    byStop[loc('busprestop')] = { u: now, r: cur.r, rot: cur.rot, s: loc('busprestop'), n: stop.name, l: stopLetter(stop.name), b: perRoute, a: others };
    // The 4 stops with the newest times, as refresh.js keeps them
    setGlobal('BusStateIslandByStop', JSON.stringify(Object.keys(byStop).sort(function (a, b) { return byStop[b].u - byStop[a].u; }).slice(0, 4)
      .reduce(function (o, k) { o[k] = byStop[k]; return o; }, {})));
    // The island's page gets them too (4.56: nx, as refresh.js hands it), so a hold shows these times
    // at once. Only nx changes, in its place, so the page doesn't restart the route's turn.
    var nextHere = nextStop(now, cur);
    if (nextHere && nextHere.stop.id === loc('busprestop') && cur.s) {
      cur.nx = nextHere.d;
      setGlobal('BusStateIslandData', JSON.stringify(cur));
    }
  } catch (e) {}
}
