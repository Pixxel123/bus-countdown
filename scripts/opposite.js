/* ==================================================================
   Bus Island · Make the next nearby stop current (a long press on the island)
   Steps through the stops Bus Start found (usually the stop across
   the road first), wrapping round at the end.
   The island shows the new stop straight away (4.43): its name, and its
   times if they were fetched under 3 minutes ago (they count down from
   then), until Bus Refresh brings fresh ones. Until then it kept showing
   the old stop for the 4 to 5 s the fetch took.
   ================================================================== */
/* @include stopLetter */
var stops = JSON.parse(global('BusStateNearbyStops') || '[]');
if (stops.length) {
  var i = (parseInt(global('BusStateStopIndex'), 10) + 1) % stops.length;
  setGlobal('BusStateStopIndex', String(i));
  setGlobal('BusStateStopId', stops[i].id);
  setGlobal('BusStateStopName', stops[i].name);
  setGlobal('BusStateStopDistance', String(stops[i].dist));
  var byStop = {}; try { byStop = JSON.parse(global('BusStateIslandByStop') || '{}') || {}; } catch (e) {}
  var cur = {}; try { cur = JSON.parse(global('BusStateIslandData') || '{}') || {}; } catch (e) {}
  var was = byStop[stops[i].id];
  // w: waiting for its times (the island shows the stop's name until they come)
  setGlobal('BusStateIslandData', JSON.stringify(was && Date.now() - was.u < 3 * 60000 ? was
    : { u: Date.now(), r: cur.r, rot: cur.rot, s: stops[i].id, n: stops[i].name, l: stopLetter(stops[i].name), b: [], a: [], w: 1 }));
}
