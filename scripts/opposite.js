/* ==================================================================
   Bus Island · Make the next nearby stop current (a long press on the island)
   Steps through the stops Bus Start found (usually the stop across
   the road first), wrapping round at the end.
   The island shows the new stop straight away (4.43): its name, and its
   times if they were fetched under 3 minutes ago (they count down from
   then), until Bus Refresh brings fresh ones. Until then it kept showing
   the old stop for the 4 to 5 s the fetch took.
   4.56: the island's page has usually switched by itself already (from nx,
   which refresh.js hands it); this makes it the current stop, with the
   one after it as its nx, so another hold switches straight back.
   ================================================================== */
/* @include get */
/* @include stopLetter */
/* @include nextStop */
var stops = JSON.parse(global('BusStateNearbyStops') || '[]');
if (stops.length) {
  var cur = {}; try { cur = JSON.parse(global('BusStateIslandData') || '{}') || {}; } catch (e) {}
  var next = nextStop(Date.now(), cur) || { i: 0, stop: stops[0], d: Object.assign({}, cur, { nx: undefined }) };
  setGlobal('BusStateStopIndex', String(next.i));
  setGlobal('BusStateStopId', next.stop.id);
  setGlobal('BusStateStopName', next.stop.name);
  setGlobal('BusStateStopDistance', String(next.stop.dist));
  var after = nextStop(Date.now(), cur);
  setGlobal('BusStateIslandData', JSON.stringify(after ? Object.assign({}, next.d, { nx: after.d }) : next.d));
}
