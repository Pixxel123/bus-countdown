// Travel mode: still, walking or riding, worked out at every position (4.34). Recorded only, never
// used to decide anything yet: each day of Record trips then tests it on data it wasn't tuned on.
//   travelMode(t, lat, lon, acc) takes one position (its fix time in ms, and Android's accuracy in m)
//   and returns { kv, nv, mode, p }: the filter's speed now and over the last minute (m/s), the most
//   likely mode ('still', 'walk' or 'ride') and how sure it is of each (per cent). The state between
//   positions is kept in BusStateKF.
// Two steps, both tuned on Tuesday 6 and Wednesday 7 October:
//  1. A Kalman filter keeps one best guess of where you are and how fast you're going, and how sure it
//     is. Each position moves the guess on by its speed (predict), then pulls it towards the position
//     by how accurate Android says that is (update). A position far outside what's possible is mostly
//     ignored. A gap of over 5 minutes starts it again.
//  2. A hidden Markov model: three states, how speeds look in each (still near 0 m/s, walking near
//     1.2, riding anything from stopped at lights to 15 m/s), and how long you usually stay in each
//     (riding about 10 minutes), so one slow reading at a red light doesn't make you "walking". It
//     only uses what has happened so far, as the phone must. The speed it reads is the filter's,
//     measured over the last minute or more, which averages out GPS wander indoors.
function travelMode(t, lat, lon, acc) {
  var kf = null; try { kf = JSON.parse(get('BusStateKF') || 'null'); } catch (e) { kf = null; }
  if (kf && t <= kf.t + 500 && kf.out) return kf.out;                 // the same position again
  var rad = Math.PI / 180;
  var r = Math.max(15, (acc || 30) * 1.5);                           // Android's accuracy is optimistic
  var gap = kf ? (t - kf.t) / 1000 : Infinity; var had = !!kf;
  var fresh = !kf || !(gap > 0 && gap <= 300) || !Array.isArray(kf.x) || !Array.isArray(kf.P) || !Array.isArray(kf.p) || !(metres(kf.a, kf.o, lat, lon) <= 20000);
  if (fresh) kf = { a: lat, o: lon, x: [0, 0, 0, 0], P: [r * r, 0, 0, 0, 0, r * r, 0, 0, 0, 0, 25, 0, 0, 0, 0, 25], h: [], p: [0.6, 0.3, 0.1] };
  var zx = (lon - kf.o) * rad * 6371000 * Math.cos(kf.a * rad); var zy = (lat - kf.a) * rad * 6371000;
  var x = kf.x; var P = kf.P;
  if (!fresh) {
    // Predict: constant speed, with room for speeding up or slowing down (0.4 m/s² either way)
    var dt = gap; var q = 0.16; var d4 = dt * dt * dt * dt / 4; var d3 = dt * dt * dt / 2; var d2 = dt * dt;
    var F = [1, 0, dt, 0, 0, 1, 0, dt, 0, 0, 1, 0, 0, 0, 0, 1];
    x = [x[0] + dt * x[2], x[1] + dt * x[3], x[2], x[3]];
    P = add(mul(mul(F, P), tr(F)), [q * d4, 0, q * d3, 0, 0, q * d4, 0, q * d3, q * d3, 0, q * d2, 0, 0, q * d3, 0, q * d2]);
    // Update with the position; one that's wildly off (more than 4 standard deviations) counts for less
    var y0 = zx - x[0]; var y1 = zy - x[1];
    var s00 = P[0] + r * r; var s01 = P[1]; var s10 = P[4]; var s11 = P[5] + r * r; var det = s00 * s11 - s01 * s10;
    var m2 = (y0 * (s11 * y0 - s01 * y1) + y1 * (-s10 * y0 + s00 * y1)) / det;
    var rr = m2 > 16 ? r * Math.sqrt(m2 / 4) : r;
    s00 = P[0] + rr * rr; s11 = P[5] + rr * rr; det = s00 * s11 - s01 * s10;
    var i00 = s11 / det; var i01 = -s01 / det; var i10 = -s10 / det; var i11 = s00 / det;
    var K = [];
    for (var k = 0; k < 4; k++) K.push([P[k * 4] * i00 + P[k * 4 + 1] * i10, P[k * 4] * i01 + P[k * 4 + 1] * i11]);
    x = x.map(function (v, j) { return v + K[j][0] * y0 + K[j][1] * y1; });
    var IKH = [1 - K[0][0], -K[0][1], 0, 0, -K[1][0], 1 - K[1][1], 0, 0, -K[2][0], -K[2][1], 1, 0, -K[3][0], -K[3][1], 0, 1];
    P = mul(IKH, P);
  } else { x = [zx, zy, 0, 0]; }
  var kv = Math.sqrt(x[2] * x[2] + x[3] * x[3]);
  // Speed over the last minute or more: from the filtered position at least 60 s ago (within 5 min)
  var h = (kf.h || []).filter(function (e) { return t - e[0] <= 300000; });
  var back = null; for (var b = h.length - 1; b >= 0; b--) { if (t - h[b][0] >= 60000) { back = h[b]; break; } }
  var nv = back ? Math.sqrt((x[0] - back[1]) * (x[0] - back[1]) + (x[1] - back[2]) * (x[1] - back[2])) / ((t - back[0]) / 1000) : kv;
  h.push([t, Math.round(x[0] * 10) / 10, Math.round(x[1] * 10) / 10]); h = h.slice(-12);
  // The hidden Markov model, one step forward
  var hn = function (s, sd) { return 2 / (sd * Math.sqrt(2 * Math.PI)) * Math.exp(-s * s / (2 * sd * sd)); };
  var nn = function (s, m, sd) { return Math.exp(-(s - m) * (s - m) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI)); };
  var ln = function (s, m, sd) { return s <= 0 ? 0 : Math.exp(-Math.pow(Math.log(s) - Math.log(m), 2) / (2 * sd * sd)) / (s * sd * Math.sqrt(2 * Math.PI)); };
  var emit = [hn(nv, 0.5), nn(nv, 1.2, 0.3), 0.4 * hn(nv, 0.7) + 0.6 * ln(nv, 4, 0.6)];
  var stayFor = [240, 240, 600]; var moveTo = [[0, 0.75, 0.25], [0.6, 0, 0.4], [0.4, 0.6, 0]];
  var step = had && gap > 0 ? Math.min(300, gap) : 20;
  var p = kf.p; var post = [];
  for (var j = 0; j < 3; j++) {
    var prior = 0;
    for (var i = 0; i < 3; i++) { var stay = Math.exp(-step / stayFor[i]); prior += p[i] * (i === j ? stay : (1 - stay) * moveTo[i][j]); }
    post.push(prior * Math.max(1e-6, emit[j]));
  }
  var sum = post[0] + post[1] + post[2]; p = post.map(function (v) { return v / sum; });
  var best = p.indexOf(Math.max(p[0], p[1], p[2]));
  var out = { kv: Math.round(kv * 10) / 10, nv: Math.round(nv * 10) / 10, mode: ['still', 'walk', 'ride'][best], p: p.map(function (v) { return Math.round(v * 100); }) };
  setGlobal('BusStateKF', JSON.stringify({ t: t, a: kf.a, o: kf.o, x: x.map(function (v) { return Math.round(v * 100) / 100; }),
    P: P.map(function (v) { return +v.toPrecision(6); }), h: h, p: p.map(function (v) { return +v.toPrecision(6); }), out: out }));
  return out;
  // 4×4 matrices as flat arrays of 16, row by row
  function mul(A, B) { var C = []; for (var r1 = 0; r1 < 4; r1++) for (var c = 0; c < 4; c++) { var v = 0; for (var n = 0; n < 4; n++) v += A[r1 * 4 + n] * B[n * 4 + c]; C.push(v); } return C; }
  function tr(A) { var C = []; for (var r1 = 0; r1 < 4; r1++) for (var c = 0; c < 4; c++) C.push(A[c * 4 + r1]); return C; }
  function add(A, B) { return A.map(function (v, n) { return v + B[n]; }); }
}
