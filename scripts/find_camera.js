/* ==================================================================
   Bus Find Camera · Where is the camera?
   Reads what the Java Function steps above got from Android:
     busrects   = the display cutout's bounding rectangles, e.g.
                  "[Rect(612, 26 - 732, 110)]" (pixels)
     busmetrics = the display metrics, e.g.
                  "DisplayMetrics{density=3.0, width=1344, height=2992, ...}"
   and turns them into dp settings for the island:
     BusCameraX   = camera centre, from the left edge
     BusScreenW   = screen width
     BusIslandGap = camera width plus a small margin each side
     BusIslandY   = top of the island, so its middle lines up with the camera
   If anything is missing (no cutout, or the calls failed), nothing is changed.
   Output: busfound (message)
   ================================================================== */
function text(v) { return (v === undefined || v === null || String(v).charAt(0) === '%') ? '' : String(v); }
// Two routes to the same information (display service, then window service); use whichever worked
var rectsText = text(typeof busrects === 'undefined' ? undefined : busrects);
if (!/Rect\(/.test(rectsText)) rectsText = text(typeof busrects2 === 'undefined' ? undefined : busrects2);
var metricsText = text(typeof busmetrics === 'undefined' ? undefined : busmetrics);
var r = rectsText.match(/Rect\((-?\d+),\s*(-?\d+)\s*-\s*(-?\d+),\s*(-?\d+)\)/);
var dens = metricsText.match(/density=([\d.]+)/);
var w = metricsText.match(/width=(\d+)/); var h = metricsText.match(/height=(\d+)/);

var busfound;
if (!r || !dens || !w) {
  // Say exactly what came back, so the next fix can be targeted
  busfound = 'Camera not found, so the island settings are unchanged. Android returned: cutout "' +
             (rectsText || 'nothing') .slice(0, 80) + '", screen "' + (metricsText || 'nothing').slice(0, 80) + '"' +
             (typeof buscuterr !== 'undefined' && buscuterr && String(buscuterr).charAt(0) !== '%' ? '. Error: ' + buscuterr : '');
} else {
  var d = parseFloat(dens[1]);
  var left = +r[1]; var top = +r[2]; var right = +r[3]; var bottom = +r[4];
  var screenPx = Math.min(+w[1], h ? +h[1] : +w[1]);           // portrait width
  var H = parseInt(global('BusIslandH'), 10) || 30;
  var camX = Math.round((left + right) / 2 / d);
  var camW = Math.round((right - left) / d);
  var camY = (top + bottom) / 2 / d;
  var gap = camW + 8;                                            // 4 dp either side (Android's rectangle already has some margin)
  var y = Math.max(0, Math.round(camY - H / 2));
  setGlobal('BusCameraX', String(camX));
  setGlobal('BusScreenW', String(Math.round(screenPx / d)));
  setGlobal('BusIslandGap', String(gap));
  setGlobal('BusIslandY', String(y));
  busfound = 'Camera found: ' + camW + ' dp wide, centred ' + camX + ' dp from the left (screen ' +
             Math.round(screenPx / d) + ' dp). Island gap set to ' + gap + ' dp, top to ' + y + ' dp.';
}
