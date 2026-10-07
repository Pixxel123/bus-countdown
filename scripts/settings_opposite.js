/* ==================================================================
   Bus Settings · Find the stop across the road, to ask about it
   Runs after the route stop lists are refreshed. For each stop you've
   just added and each route you chose there, the nearest other stop that
   route calls at, within 200 m, is almost always the same route in the
   opposite direction. Nothing is saved here: the next step asks you,
   showing each stop's name and letter (and which way it goes).
   Stops you've removed or said no to (BusPlacesSkip) aren't offered.
   Output: busoppask (yes/no), busoppitems (the list, comma-separated),
           BusTempOppCandidates (the stops, for the next step)
   ================================================================== */
/* @include get */
/* @include metres */

var pool = JSON.parse(get('BusCacheStops') || '{}');
var picked = JSON.parse(get('BusTempOpposite') || '[]');
var places = get('BusPlaces') ? get('BusPlaces').split('\n') : [];
var skip = get('BusPlacesSkip') ? get('BusPlacesSkip').split(',') : [];
var have = places.map(function (l) { return l.split('|')[1]; });
var candidates = [];

picked.forEach(function (st) {
  st.routes.forEach(function (route) {
    var best = null;
    Object.keys(pool).forEach(function (id) {
      var s = pool[id];
      if (id === st.id || s.r.indexOf(route) < 0) return;
      var d = metres(st.lat, st.lon, s.a, s.o);
      if (d <= 200 && (!best || d < best.d)) best = { id: id, s: s, d: d };
    });
    if (!best || have.indexOf(best.id) > -1 || skip.indexOf(best.id) > -1) return;
    if (candidates.some(function (c) { return c.id === best.id; })) return;
    // The list item: its name with its letter, and which way it goes. No commas: they separate items.
    var label = (best.s.n + (best.s.t ? ' towards ' + best.s.t : '')).replace(/,/g, ' ');
    candidates.push({ id: best.id, n: best.s.n, a: best.s.a, o: best.s.o, label: label });
  });
});

setGlobal('BusTempOppCandidates', JSON.stringify(candidates));
var busoppask = candidates.length ? 'yes' : 'no';
var busoppitems = candidates.map(function (c) { return c.label; }).join(',');
setGlobal('BusTempOpposite', '');
