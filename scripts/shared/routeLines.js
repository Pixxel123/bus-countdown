// Your routes' lines of stops (4.61), shared by everything in Bus Watch that places you on a route:
// following your bus, moving along a route, the stop coming up by bus, how far past a stop you are.
// Each used to read BusCacheSeq and work out its own distances, up to five times a check, with four
// copies of the same sums. Needs metres (shared/metres.js).
//   routeLines() -> [{ seq, cum }]: each route's stops in order, [[id, lat, lon], ...] (BusCacheSeq),
//   and metres along the route to each. Read once per script run.
function routeLines() {
  if (routeLines.lines) return routeLines.lines;          // kept on the function, so Tasker doesn't hand it back as a local
  var seqs = getJSON('BusCacheSeq', []);
  routeLines.lines = seqs.map(function (sq) {
    var cum = [0]; for (var c = 1; c < sq.length; c++) cum.push(cum[c - 1] + metres(sq[c - 1][1], sq[c - 1][2], sq[c][1], sq[c][2]));
    return { seq: sq, cum: cum };
  });
  return routeLines.lines;
}

// Where a point falls on one segment of a line (stop j to stop j + 1), in metres on a flat local
// map centred on the point: off (how far from the segment), f (0 at stop j to 1 at stop j + 1),
// along (metres along the route), dx, dy (the segment's run east and north) and len. null for a
// segment of no length (two stops in the same place).
function onSegment(line, j, pLat, pLon) {
  var R = Math.PI / 180; var kx = Math.cos(pLat * R) * 6371000 * R; var ky = 6371000 * R;
  var a = line.seq[j]; var b = line.seq[j + 1];
  var ax = (a[2] - pLon) * kx; var ay = (a[1] - pLat) * ky; var dx = (b[2] - pLon) * kx - ax; var dy = (b[1] - pLat) * ky - ay;
  var len2 = dx * dx + dy * dy; if (!len2) return null;
  var f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return { off: Math.sqrt(Math.pow(ax + f * dx, 2) + Math.pow(ay + f * dy, 2)), f: f, along: line.cum[j] + f * (line.cum[j + 1] - line.cum[j]),
    dx: dx, dy: dy, len: Math.sqrt(len2), j: j };
}

// The nearest point on a line to a point, from segment `from` up to (not including) `to` (all of it
// when left out), skipping any segment keep(j) says no to. onSegment's result, or null.
function nearestOnLine(line, pLat, pLon, from, to, keep) {
  var best = null;
  for (var j = Math.max(0, from || 0); j < Math.min(line.seq.length - 1, to === undefined ? Infinity : to); j++) {
    if (keep && !keep(j)) continue;
    var s = onSegment(line, j, pLat, pLon);
    if (s && (!best || s.off < best.off)) best = s;
  }
  return best;
}
