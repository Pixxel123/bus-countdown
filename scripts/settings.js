/* ==================================================================
   Bus Start · Settings
   The one place every setting is defined. Change any of them in
   Tasker's Variables tab (add it with + if it isn't listed). Empty or
   invalid values are replaced with the defaults below.
   Output: BusStateReady (global) = yes / no
   ================================================================== */
/* @include get */
function atLeast(min) { return function (v) { return parseFloat(v) >= min; }; }

var SETTINGS = [
  // [ name,          default, valid when...           ]  what it does
  ['BusStyle',      'pill',  function (v) { return /^(pill|chip)$/.test(v); }],  // island, or the status bar chip
  ['BusRadius',     '300',   atLeast(50)],    // metres: how far Bus Start looks for stops
  ['BusRefresh',    '45',    atLeast(15)],    // seconds between TfL refreshes
  ['BusTimeout',    '30',    atLeast(1)],     // minutes before the countdown gives up
  ['BusRotate',     '6',     atLeast(2)],     // seconds each route shows on the island
  ['BusDestLetters', '3',   function (v) { return v === '3' || v === '6' || v === '10'; }],   // letters of the destination the island has room for
  ['BusIslandGap',  '42',    atLeast(0)],     // dp: space left over the camera
  ['BusNearRadius', '50',    atLeast(10)],    // metres: arrival distance for a newly saved stop
  ['BusChipX',      '76',    function (v) { var n = parseFloat(v); return n >= 0 && n <= 300; }],   // status bar chip: dp from the left
  ['BusApproach', 'both', function (v) { return /^(off|walk|both)$/.test(v); }],   // show stops you're heading towards
  ['BusApproachMin', '3', function (v) { return /^(2|3|5)$/.test(v); }],
  ['BusRecord', 'off', function (v) { return /^(on|off)$/.test(v); }],          // trip recorder (off unless you turn it on)         // ...this many minutes ahead
  ['BusLeaveShow', 'work', function (v) { return /^(off|work|home|both)$/.test(v); }],   // leaving which Wi-Fi shows the nearest stop
  ['BusGlanceFrom', '17:00', function (v) { return v === 'off' || /^\d{1,2}:\d{2}$/.test(v); }],   // heads-up at work: from (or off)
  ['BusGlanceTo',   '18:00', function (v) { return /^\d{1,2}:\d{2}$/.test(v); }],                  // and until
  ['BusBorder',     'off',   function (v) { return v === 'on' || v === 'off'; }],   // countdown border round the island
];
SETTINGS.forEach(function (s) { if (!s[2](get(s[0]))) setGlobal(s[0], s[1]); });


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

var ready = get('TflKey') !== '' && get('BusRoutes') !== '';
setGlobal('BusStateReady', ready ? 'yes' : 'no');
