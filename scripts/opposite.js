/* ==================================================================
   Bus Island · Make the next nearby stop current (a long press on the island)
   Steps through the stops Bus Start found (usually the stop across
   the road first), wrapping round at the end.
   ================================================================== */
var stops = JSON.parse(global('BusStateNearbyStops') || '[]');
if (stops.length) {
  var i = (parseInt(global('BusStateStopIndex'), 10) + 1) % stops.length;
  setGlobal('BusStateStopIndex', String(i));
  setGlobal('BusStateStopId', stops[i].id);
  setGlobal('BusStateStopName', stops[i].name);
  setGlobal('BusStateStopDistance', String(stops[i].dist));
}
