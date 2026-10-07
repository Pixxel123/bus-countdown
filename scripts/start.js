/* ==================================================================
   Bus Start · Pick nearby stops
   Only your saved stops (BusPlaces) are ever shown: up to four within
   BusRadius that your routes call at, nearest first (the saved stop you
   just arrived at, first of all). Bus Opposite (long press on the
   island) steps through the rest.
   Starting by hand also clears a snooze from dismissing the island.
   Output: busok = yes / no, busproblem = message when no
   ================================================================== */
/* @include get */
/* @include loc */

// Each output gets its own var line: Tasker only hands back variables declared that way
var busok = 'no';
var busproblem = '';

var lat = parseFloat(gl_latitude); var lon = parseFloat(gl_longitude);
var pool = JSON.parse(get('BusCacheStops') || '{}');
var radius = parseFloat(get('BusRadius')) || 300;
// Started because you left home or work Wi-Fi (par1 = leaving): you may still be some way from
// the stop, so look further (1 km) and put your saved stops first
// Why Bus Start is running: par1 (arrived / approach / leaving / glance), or, if that didn't come
// through, the note Bus Watch or Bus Moved left just before starting it (BusStateStartMode, "mode|time",
// used if under a minute old). Started any other way, it's a manual start.
var mode = loc('par1');
if (!mode) {
  var note = String(global('BusStateStartMode') || '').split('|');
  if (note[0] && Date.now() - (parseInt(note[1], 10) || 0) < 60000) mode = note[0];
}
var leaving = mode === 'leaving' || mode === 'glance';        // glance: the heads-up at work
// Started by Bus Watch because you're at a saved stop (par1 = arrived): show that stop first, not
// whichever stop on your routes happens to be nearest (which may not be one you saved)
var arrivedId = (mode === 'arrived' || mode === 'approach') ? get('BusStateArrivedStop') : '';
// Heading towards a stop: it can be up to a few minutes away by bus, so look much further
if (mode === 'approach') radius = Math.max(radius, 3000);
var saved = get('BusPlaces').split('\n').map(function (l) { return l.split('|')[1]; });
if (leaving) radius = Math.max(radius, 1000);
var target = sideTarget();
var prefIds = saved.filter(function (id) { return headsTowards(id, target); });

if (!Object.keys(pool).length) {
  busproblem = "Couldn't get your routes' stops from TfL";
} else if (isNaN(lat) || isNaN(lon)) {
  busproblem = 'No GPS fix, try again';
} else {
  var stops = Object.keys(pool)
    .map(function (id) { return { id: id, name: pool[id].n, dist: Math.round(metres(lat, lon, pool[id].a, pool[id].o)) }; })
    .filter(function (s) { return s.dist <= radius && saved.indexOf(s.id) > -1; })   // saved stops only
    .sort(function (a, b) {
      if (arrivedId) return (b.id === arrivedId) - (a.id === arrivedId) || (saved.indexOf(b.id) > -1) - (saved.indexOf(a.id) > -1) || a.dist - b.dist;
      // Leaving work (or home): the side heading your way first; a manual start is simply nearest first
      if (leaving) return (prefIds.indexOf(b.id) > -1) - (prefIds.indexOf(a.id) > -1) || a.dist - b.dist;
      return a.dist - b.dist;
    })
    .slice(0, 4);

  setGlobal('BusStateNearbyStops', JSON.stringify(stops));
  setGlobal('BusStateStopIndex', '0');
  if (stops.length) {
    setGlobal('BusStateStopId', stops[0].id);
    setGlobal('BusStateStopName', stops[0].name);
    setGlobal('BusStateStopDistance', String(stops[0].dist));
    setGlobal('BusStateStartMode', '');                      // used: clear it                        // closest you've been to the stop (see Bus Watch)
    setGlobal('BusStateLastPush', String(Date.now()));    // pushed positions start now (see Bus Moved)
    setGlobal('BusStateGlance', mode === 'glance' ? String(Date.now()) : '');   // a heads-up: Bus Loop ends it after a minute
    // The Wi-Fi network this countdown started on: Bus Watch ends a countdown on home or work
    // Wi-Fi unless it started on that same network
    setGlobal('BusStateStartWifi', get('BusStateWifi'));
    busok = 'yes';
  } else {
    busproblem = 'None of your saved stops are within ' + radius + ' m (add stops in Bus Settings)';
  }
}

/* @include metres */
/* @include sides */
/* @include record */

/* @include debugLog */
debugLog(busok === 'yes' ? 'Countdown started for ' + get('BusStateStopName') + (mode ? ' (' + mode + ')' : ' (by hand)') : 'Nothing started: ' + (typeof busproblem !== 'undefined' ? busproblem : ''));
record(busok === 'yes' ? 'start' : 'nostart', { stop: get('BusStateStopId'), name: get('BusStateStopName'), mode: mode || 'hand', battery: get('BATT') });
