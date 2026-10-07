// Which of the buses listed at a stop is the one you're riding towards it. eta is when you'd get
// there at the pace you've been closing in (ms). Each bus's TfL time is compared with it: the
// closest wins if it's within 2½ minutes, and no other vehicle is within 2 minutes of being as
// close (otherwise it's too close to call this time). The same vehicle listed twice isn't a rival.
// Returns { k, v, t, err (seconds off) } or null.
function matchBus(buses, eta) {
  var c = buses.filter(function (x) { return x.v && !x.gone; })
    .map(function (x) { return { k: x.k, v: x.v, t: x.t, err: Math.abs(x.t - eta) / 1000 }; })
    .sort(function (a, b) { return a.err - b.err; });
  if (!c.length || c[0].err > 150) return null;
  var rival = c.filter(function (x) { return x.v !== c[0].v; })[0];
  if (rival && rival.err - c[0].err < 120) return null;
  return c[0];
}
