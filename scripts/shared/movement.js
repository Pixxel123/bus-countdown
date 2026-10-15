// How you've been moving, from Bus Watch's window of recent positions (BusStateWindow: up to 6, the
// last 5 minutes, each { t, lat, lon, acc, spd }). Gathered here in 4.63; each worked the same in
// watch.js before. win is that window, oldest first; fixT is the newest position's time (ms); st is a
// stop as watch.js has it ({ lat, lon, d (metres from you now), r (its circle) }).

// Speed: the median of the last three readings, so one jumpy fix can't fake (or hide) a bus.
// -1 when there's none
function moveSpeed(win) {
  var lastSpeeds = win.map(function (fix) { return fix.spd; }).filter(function (v) { return v >= 0; }).slice(-3).sort(function (x, y) { return x - y; });
  return lastSpeeds.length ? lastSpeeds[Math.floor(lastSpeeds.length / 2)] : -1;
}

// Moving away from a point: the trend of your distance from it across the window (m/s): the slope of
// a straight line fitted through (seconds, metres away) by least squares, covariance over variance
function moveTrend(win, fromLat, fromLon) {
  var latest = win.slice(-4);                       // the most recent positions only
  if (latest.length < 3) return 0;
  var secs = latest.map(function (fix) { return (fix.t - latest[0].t) / 1000; });
  var away = latest.map(function (fix) { return metres(fix.lat, fix.lon, fromLat, fromLon); });
  var n = secs.length; var meanSecs = 0; var meanAway = 0; var covariance = 0; var variance = 0; var k;
  for (k = 0; k < n; k++) { meanSecs += secs[k] / n; meanAway += away[k] / n; }
  for (k = 0; k < n; k++) { covariance += (secs[k] - meanSecs) * (away[k] - meanAway); variance += (secs[k] - meanSecs) * (secs[k] - meanSecs); }
  return variance > 0 ? covariance / variance : 0;
}

// Slowed down, though a rough fix makes the speed reading bounce about even when you're standing
// still: over the last 30 to 90 seconds of positions, less than 25 m from where you were, under
// 0.5 m/s. Walking past a stop covers 40 m or more in that time.
function moveSlowedDown(win, fixT) {
  var lastNinety = win.filter(function (fix) { return fixT - fix.t <= 90000; });
  if (lastNinety.length < 3) return false;
  var first = lastNinety[0]; var last = lastNinety[lastNinety.length - 1]; var spanSecs = (last.t - first.t) / 1000;
  if (spanSecs < 30) return false;
  var moved = metres(first.lat, first.lon, last.lat, last.lon);
  return moved < 25 && moved / spanSecs < 0.5;
}

// Staying put somewhere, allowing for indoor GPS wander: at least 4 positions over 2 minutes or more
// (in the last 5), all within 80 m of where they average out. Walking 2 minutes covers 170 m. Only
// used to slow the pushes down far from your stops (indoors one evening, the fix wandered 30 to 70
// m, so moveSlowedDown never held).
function moveStayingPut(win) {
  if (win.length < 4 || win[win.length - 1].t - win[0].t < 120000) return false;
  var centreLat = 0; var centreLon = 0;
  win.forEach(function (fix) { centreLat += fix.lat / win.length; centreLon += fix.lon / win.length; });
  return win.every(function (fix) { return metres(fix.lat, fix.lon, centreLat, centreLon) <= 80; });
}

// Steady pace away from a stop: the fastest average over 90 seconds or more of the window. Walking
// tops out under 2 m/s even with GPS error; over 2.2 m/s for that long is a bus, however slowly it
// crawled through traffic (one recorded ride: 2.6 m/s for nearly 3 minutes, which a single speed
// reading never showed)
function movePaceAway(win, fixT, st) {
  var bestPace = 0;
  win.forEach(function (fix) {
    var secsBack = (fixT - fix.t) / 1000;
    if (secsBack >= 90) bestPace = Math.max(bestPace, (st.d - metres(fix.lat, fix.lon, st.lat, st.lon)) / secsBack);
  });
  return bestPace;
}

// How fast you've been closing in on a stop (m/s): your distance from it now against a position 45
// seconds to 4 minutes back (the oldest such in the window). Straight-line both times, so a bend in
// the road affects both alike. -1 when there's nothing to go on.
function moveClosing(win, fixT, st) {
  for (var i = 0; i < win.length; i++) {
    var secsBack = (fixT - win[i].t) / 1000;
    if (secsBack >= 45 && secsBack <= 240) return (metres(win[i].lat, win[i].lon, st.lat, st.lon) - st.d) / secsBack;
  }
  return -1;
}

// When you left a stop: the last position within 40 m of it, or failing that inside its circle (0 if
// the window no longer has one)
function moveLeftAt(win, st) {
  var lastNearAt = 0; var lastInCircleAt = 0;
  win.forEach(function (fix) { var d = metres(fix.lat, fix.lon, st.lat, st.lon); if (d <= 40) lastNearAt = fix.t; if (d <= st.r) lastInCircleAt = fix.t; });
  return lastNearAt || lastInCircleAt;
}
