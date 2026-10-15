// How you've been moving, from Bus Watch's window of recent positions (BusStateWindow: up to 6, the
// last 5 minutes, each { t, lat, lon, acc, spd }). Gathered here in 4.63; each worked the same in
// watch.js before. fixT is the newest position's time (ms); st is a stop as watch.js has it
// ({ lat, lon, d (metres from you now), r (its circle) }).

// Speed: the median of the last three readings, so one jumpy fix can't fake (or hide) a bus.
// -1 when there's none
function moveSpeed(win) {
  var recent = win.map(function (w) { return w.spd; }).filter(function (v) { return v >= 0; }).slice(-3).sort(function (a, c) { return a - c; });
  return recent.length ? recent[Math.floor(recent.length / 2)] : -1;
}

// Moving away from a point: the trend of your distance from it across the window (least squares, m/s)
function moveTrend(win, pLat, pLon) {
  var part = win.slice(-4);                         // the most recent positions only
  if (part.length < 3) return 0;
  var xs = part.map(function (w) { return (w.t - part[0].t) / 1000; }); var ys = part.map(function (w) { return metres(w.lat, w.lon, pLat, pLon); });
  var n = xs.length; var mx = 0; var my = 0; var sxy = 0; var sxx = 0; var k;
  for (k = 0; k < n; k++) { mx += xs[k] / n; my += ys[k] / n; }
  for (k = 0; k < n; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) * (xs[k] - mx); }
  return sxx > 0 ? sxy / sxx : 0;
}

// Slowed down, though a rough fix makes the speed reading bounce about even when you're standing
// still: over the last 30 to 90 seconds of positions, less than 25 m from where you were, under
// 0.5 m/s. Walking past a stop covers 40 m or more in that time.
function moveSettled(win, fixT) {
  var recentW = win.filter(function (w) { return fixT - w.t <= 90000; });
  if (recentW.length < 3) return false;
  var a = recentW[0]; var z = recentW[recentW.length - 1]; var span = (z.t - a.t) / 1000;
  if (span < 30) return false;
  var moved = metres(a.lat, a.lon, z.lat, z.lon);
  return moved < 25 && moved / span < 0.5;
}

// Staying put somewhere, allowing for indoor GPS wander: at least 4 positions over 2 minutes or more
// (in the last 5), all within 80 m of where they average out. Walking 2 minutes covers 170 m. Only
// used to slow the pushes down far from your stops (Tuesday evening indoors, the fix wandered 30
// to 70 m, so moveSettled never held).
function moveStaying(win) {
  if (win.length < 4 || win[win.length - 1].t - win[0].t < 120000) return false;
  var mLat = 0; var mLon = 0;
  win.forEach(function (w) { mLat += w.lat / win.length; mLon += w.lon / win.length; });
  return win.every(function (w) { return metres(w.lat, w.lon, mLat, mLon) <= 80; });
}

// Steady pace away from a stop: the fastest average over 90 seconds or more of the window. Walking
// tops out under 2 m/s even with GPS error; over 2.2 m/s for that long is a bus, however slowly it
// crawled through traffic (Tuesday, leaving Wexley on the 566: 2.6 m/s for nearly 3 minutes, which
// a single speed reading never showed)
function movePaceAway(win, fixT, st) {
  var best = 0;
  win.forEach(function (w) { var dt = (fixT - w.t) / 1000; if (dt >= 90) best = Math.max(best, (st.d - metres(w.lat, w.lon, st.lat, st.lon)) / dt); });
  return best;
}

// How fast you've been closing in on a stop (m/s): your distance from it now against a position 45
// seconds to 4 minutes back (the oldest such in the window). Straight-line both times, so a bend in
// the road affects both alike. -1 when there's nothing to go on.
function moveClosing(win, fixT, st) {
  for (var i = 0; i < win.length; i++) {
    var dt = (fixT - win[i].t) / 1000;
    if (dt >= 45 && dt <= 240) return (metres(win[i].lat, win[i].lon, st.lat, st.lon) - st.d) / dt;
  }
  return -1;
}

// When you left a stop: the last position within 40 m of it, or failing that inside its circle (0 if
// the window no longer has one)
function moveLeftAt(win, st) {
  var near = 0; var inCircle = 0;
  win.forEach(function (w) { var d = metres(w.lat, w.lon, st.lat, st.lon); if (d <= 40) near = w.t; if (d <= st.r) inCircle = w.t; });
  return near || inCircle;
}
