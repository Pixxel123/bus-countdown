/* Bus Settings · First run? Measure the camera before opening the screen.
   Output: busfirst = yes when the camera hasn't been measured yet */
var v = global('BusCameraX');
var busfirst = (v === undefined || v === null || v === '' || String(v).charAt(0) === '%') ? 'yes' : 'no';

/* Saved places should all be "type|id|name|lat|lon|radius". A line saved in the older
   "id|name|lat|lon|radius" form (no type) was being skipped, so it's repaired here, and
   stray spaces, blank lines and duplicate stops are removed. */
(function repairPlaces() {
  var raw = global('BusPlaces');
  if (raw === undefined || raw === null || String(raw).charAt(0) === '%' || !String(raw).trim()) return;
  var seen = {}; var out = [];
  String(raw).split(/\r?\n/).forEach(function (line) {
    line = line.trim();
    if (!line) return;
    var p = line.split('|').map(function (x) { return x.trim(); });
    if (p[0] !== 'bus' && p[0] !== 'rail' && p.length >= 4 && !isNaN(parseFloat(p[2])) && !isNaN(parseFloat(p[3]))) p = ['bus'].concat(p.slice(0, 5));
    if (seen[p[0] + p[1]]) return;
    seen[p[0] + p[1]] = true;
    out.push(p.join('|'));
  });
  if (out.join('\n') !== String(raw)) setGlobal('BusPlaces', out.join('\n'));
})();
