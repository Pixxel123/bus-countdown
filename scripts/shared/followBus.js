// Following your bus (4.58). While you ride a bus Bus Watch has named (BusStateBoarded), TfL is asked
// which stops it calls at next (/Vehicle/{id}/Arrivals, follow_store.js keeps them in BusStateFollow).
// Your position can't say much on its own: a bus crawling in traffic moves at walking pace, so on
// Thursday and Friday Bus Watch had you off the bus for 80 of the 148 minutes you rode. The bus's next
// stop can: the bus is somewhere between the stop before it and that stop, so if you are too, you're
// most likely still on it, and if the bus has gone on past you (or you're well off its road), you're
// not.
//   followBus(lat, lon, accuracy, now) -> { with: true or false, why } or null (nothing to go on: no
//   named bus, no reply from TfL in the last 2 minutes, a fix worse than 60 m, or stops not in
//   BusCacheSeq)
// It can only say "with you" until the bus reaches its next stop after you get off (a minute or two),
// so nothing that needs a quick answer waits on it: it only stops a slow spell ending a ride.
function followBus(fLat, fLon, fAcc, fNow) {
  var fb = null; try { fb = JSON.parse(get('BusStateBoarded') || 'null'); } catch (e) { fb = null; }
  var ff = null; try { ff = JSON.parse(get('BusStateFollow') || 'null'); } catch (e) { ff = null; }
  if (!fb || !fb.v || fb.sure === false || !ff || ff.v !== fb.v || fNow - ff.at > 120000 || (fAcc || 15) > 60) return null;
  // Stops still to come: TfL's times move on by themselves, so a reply a minute old still says where
  // the bus is now (one due up to 30 s ago may be standing there yet)
  var ahead = (ff.n || []).filter(function (x) { return x[1] >= fNow - 30000; });
  if (!ahead.length) return null;
  // The bus's line of stops: one with its next stop, and the one after that further on (so it's the
  // right direction), from BusCacheSeq
  var fSeqs = []; try { fSeqs = JSON.parse(get('BusCacheSeq') || '[]'); } catch (e) { fSeqs = []; }
  var seq = null; var at = -1; var sure = false;
  fSeqs.forEach(function (sq) {
    var k = -1; for (var i = 1; i < sq.length && k < 0; i++) if (sq[i][0] === ahead[0][0]) k = i;
    if (k < 1) return;
    var onward = ahead.length < 2 || sq.slice(k + 1).some(function (p) { return p[0] === ahead[1][0]; });
    if (!seq || (onward && !sure)) { seq = sq; at = k; sure = onward; }
  });
  // With two or more stops ahead, a line that has them in that order, or nothing: at the end of a
  // route TfL may list the bus's next trip back, which no line through its next stop follows on from
  if (!seq || (ahead.length >= 2 && !sure)) return null;
  // Metres along the line to each stop, and where you are on it: the nearest segment near the bus
  // (from 6 stops before its next stop to 4 after), flattened locally
  var R = Math.PI / 180; var kx = Math.cos(fLat * R) * 6371000 * R; var ky = 6371000 * R;
  var cum = [0]; for (var c = 1; c < seq.length; c++) cum.push(cum[c - 1] + metres(seq[c - 1][1], seq[c - 1][2], seq[c][1], seq[c][2]));
  var off = Infinity; var you = 0;
  for (var j = Math.max(0, at - 6); j < Math.min(seq.length - 1, at + 4); j++) {
    var ax = (seq[j][2] - fLon) * kx; var ay = (seq[j][1] - fLat) * ky; var dx = (seq[j + 1][2] - fLon) * kx - ax; var dy = (seq[j + 1][1] - fLat) * ky - ay;
    var len2 = dx * dx + dy * dy; if (!len2) continue;
    var f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    var o = Math.sqrt(Math.pow(ax + f * dx, 2) + Math.pow(ay + f * dy, 2));
    if (o < off) { off = o; you = cum[j] + f * (cum[j + 1] - cum[j]); }
  }
  var nextName = ahead[0][2] || 'its next stop';
  var route = fb.k ? 'the ' + fb.k : 'your bus';
  if (off > 100) return { with: false, why: route + ' is on another road (' + Math.round(off) + ' m away)' };
  if (you < cum[at - 1] - 150) return { with: false, why: route + ' has gone on, to ' + nextName };
  if (you > cum[at] + 150) return { with: false, why: route + ' is behind you, still to reach ' + nextName };
  // dir: the way the bus is going, from the stop before its next one to that stop (for goesBack: the
  // bus's way, whatever your feet are doing)
  return { with: true, why: route + ' is still with you (next stop ' + nextName + ')', dir: [[seq[at - 1][1], seq[at - 1][2]], [seq[at][1], seq[at][2]]] };
}

// Just off a bus, or still on it, inside a saved stop whose buses all go back the way you came: on
// Thursday and Friday evenings the 566 home passed Kiln Street on the other side of the road, close
// enough to be inside its circle, and slowing there started a countdown for buses back to Wexley.
// True when every route at the stop (BusCacheSeq) leaves it heading within 60 degrees of straight back
// along the way the bus was last going (BusStateHeading, kept by watch.js: from TfL's stops while it
// has your bus with you, or from your positions at bus speed; never from a walk after getting off).
// While Bus Watch has you on the bus, that's from the last 3 minutes (on Friday the 566 crawled the
// last 9 minutes to Kiln Street, so only TfL's word gave its way); once you're off it, only within 2
// minutes of last moving at bus speed, so crossing the road for a bus back soon shows its countdown.
function goesBack(st, gNow, onBus) {
  var hd = null; try { hd = JSON.parse(get('BusStateHeading') || 'null'); } catch (e) { hd = null; }
  if (!hd || !hd.a || !hd.z || (onBus ? gNow - hd.t > 3 * 60000 : gNow - (hd.b || 0) > 2 * 60000)) return false;
  var a = hd.a; var z = hd.z;
  var R = Math.PI / 180; var kx = Math.cos(st.lat * R); var tx = (z[1] - a[1]) * kx; var ty = z[0] - a[0];
  var gSeqs = []; try { gSeqs = JSON.parse(get('BusCacheSeq') || '[]'); } catch (e) { gSeqs = []; }
  var leaving = [];
  gSeqs.forEach(function (sq) {
    for (var i = 0; i < sq.length - 1; i++) {
      if (sq[i][0] !== st.id) continue;
      var dx = (sq[i + 1][2] - sq[i][2]) * kx; var dy = sq[i + 1][1] - sq[i][1]; var dl = Math.sqrt(dx * dx + dy * dy);
      if (dl) leaving.push((dx * tx + dy * ty) / (dl * Math.sqrt(tx * tx + ty * ty)));
    }
  });
  return leaving.length > 0 && leaving.every(function (cos) { return cos < -0.5; });
}

// Moving along one of your routes (4.59): the same idea as followBus, without TfL. A bus in traffic
// moves at walking pace now and then, but it keeps to its route's line and keeps going forward along
// it; a walk after getting off soon stops doing one or the other. On Monday the 517 had no live data
// all day, so there was no bus to follow, and Bus Watch had you off the bus for 41 of the 53 minutes
// you rode it.
//   movingAlong(win, minPace) -> { pace } (metres a second along the line) or null
// True when the window's positions (fixes 50 m or better, at least 3, over a minute or more) are all
// within 40 m of one line in BusCacheSeq, never more than 25 m back along it, and average minPace or
// more forward along it. Each position is placed on the line near the one before (300 m back to
// 1500 m on), so a route that passes the same road twice can't jump between them.
function movingAlong(rWin, minPace) {
  var pts = rWin.filter(function (w) { return (w.acc || 15) <= 50; });
  if (pts.length < 3) return null;
  var span = (pts[pts.length - 1].t - pts[0].t) / 1000; if (span < 60) return null;
  var rSeqs = []; try { rSeqs = JSON.parse(get('BusCacheSeq') || '[]'); } catch (e) { rSeqs = []; }
  var R = Math.PI / 180; var best = null;
  rSeqs.forEach(function (sq) {
    var cum = [0]; for (var c = 1; c < sq.length; c++) cum.push(cum[c - 1] + metres(sq[c - 1][1], sq[c - 1][2], sq[c][1], sq[c][2]));
    var alongs = []; var furthest = null;
    for (var k = 0; k < pts.length; k++) {
      var p = pts[k]; var kx = Math.cos(p.lat * R) * 6371000 * R; var ky = 6371000 * R; var off = Infinity; var along = 0;
      for (var j = 0; j < sq.length - 1; j++) {
        if (furthest !== null && (cum[j + 1] < furthest - 300 || cum[j] > furthest + 1500)) continue;
        var ax = (sq[j][2] - p.lon) * kx; var ay = (sq[j][1] - p.lat) * ky; var dx = (sq[j + 1][2] - p.lon) * kx - ax; var dy = (sq[j + 1][1] - p.lat) * ky - ay;
        var len2 = dx * dx + dy * dy; if (!len2) continue;
        var f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)); var o = Math.sqrt(Math.pow(ax + f * dx, 2) + Math.pow(ay + f * dy, 2));
        if (o < off) { off = o; along = cum[j] + f * (cum[j + 1] - cum[j]); }
      }
      if (off > 40) return;                                   // off this line
      if (furthest !== null && along < furthest - 25) return;  // going back along it
      alongs.push(along); furthest = Math.max(furthest === null ? along : furthest, along);
    }
    var pace = (alongs[alongs.length - 1] - alongs[0]) / span;
    if (!best || pace > best.pace) best = { pace: pace };
  });
  return best && best.pace >= minPace ? best : null;
}
