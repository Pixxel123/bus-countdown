// The stop a long press goes to, and what the island shows for it (4.56): the next of the stops Bus
// Start found (usually the one across the road), wrapping round, with its island data if that's under
// 3 minutes old, or else its name, waiting for times (w). Shared by opposite.js, which switches to it,
// and refresh.js and prefetch_store.js, which hand it to the island's page (nx) so a hold shows it at
// once. at: the time; cur: the island's data now (its refresh and rotation times are kept). null with
// fewer than two stops.
function nextStop(at, cur) {
  var stops = getJSON('BusStateNearbyStops', []);
  if (stops.length < 2) return null;
  var i = ((parseInt(get('BusStateStopIndex'), 10) || 0) + 1) % stops.length;
  var byStop = getJSON('BusStateIslandByStop', {});
  var was = byStop[stops[i].id];
  return { i: i, stop: stops[i], d: was && at - was.u < 3 * 60000 ? was
    : { u: at, r: cur.r, rot: cur.rot, s: stops[i].id, n: stops[i].name, l: stopLetter(stops[i].name), b: [], a: [], w: 1 } };
}
