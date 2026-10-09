/* ==================================================================
   Bus Settings Button · What was tapped?
   Run by buttons on the settings screen, which pass busaction:
     set      -> a choice (bussetting, busvalue): saved straight away
     remove   -> a saved stop removed or kept (busstop, busvalue yes/no), for the save step
     tick     -> a route tapped at a stop (busstop, busroute, busvalue y/n),
                 recorded in BusTempTicks for the save step
     dist     -> a stop's arrival distance chosen (busstop, busvalue in metres),
                 recorded in BusTempDists for the save step
     preview  -> show the island with sample times and the unsaved slider
                 values (set_gap and set_y come across as locals), then its
                 stop board
     app      -> open Tasker's app info (location, battery)
     overlay  -> open "Display over other apps" for Tasker
     access   -> open Accessibility settings
   Output: buspreview = yes / no, busintent, busuri (for the Java steps)
   ================================================================== */
/* @include loc */
/* @include get */

var action = loc('busaction');

// A setting chosen on the settings screen: save it now. Only known settings and values are
// accepted; anything else is ignored.
var ALLOWED = {
  BusRefresh: ['30', '45', '60', '90'], BusTimeout: ['15', '30', '45', '60'], BusRotate: ['4', '6', '8', '10'],
  BusRadius: ['200', '300', '500', '800'], BusDestLetters: ['3', '6', '10'],
  BusLeaveShow: ['off', 'work', 'home', 'both'], BusApproach: ['off', 'walk', 'both'], BusApproachMin: ['2', '3', '5'], BusRecord: ['off', 'on'], BusGlanceFrom: ['off', '16:30', '17:00', '17:30'], BusGlanceTo: ['17:30', '18:00', '18:30', '19:00'], BusStyle: ['pill', 'chip'], BusBorder: ['off', 'on'],
  BusBoardRoutes: ['all', 'mine'], BusBoardSecs: ['10', '30', '0'], BusBuzz: ['on', 'off'],
  BusHomeWifi: null, BusWorkWifi: null                          // any network name ("" clears work)
};
var NAMES = { BusRefresh: 'refresh every', BusTimeout: 'end after', BusRotate: 'time per route', BusRadius: 'search distance', BusDestLetters: 'destination letters', BusLeaveShow: 'next buses on leaving', BusApproach: 'heading to a stop', BusApproachMin: 'minutes ahead', BusRecord: 'record trips', BusGlanceFrom: 'heads-up at work from', BusGlanceTo: 'heads-up until',
              BusStyle: 'show as', BusBorder: 'countdown border', BusBoardRoutes: 'stop board shows', BusBoardSecs: 'stop board closes', BusBuzz: 'buzz when a bus is near',
              BusHomeWifi: 'home Wi-Fi', BusWorkWifi: 'work Wi-Fi' };
if (action === 'set') {
  var setting = loc('bussetting'); var value = loc('busvalue');
  if (value.charAt(0) === '%') value = '';
  var ok = setting in ALLOWED && (ALLOWED[setting] ? ALLOWED[setting].indexOf(value) > -1 : (value !== '' || setting === 'BusWorkWifi'));
  if (ok && value !== get(setting)) {
    setGlobal(setting, value);
    var done = JSON.parse(get('BusTempChanged') || '{}');         // for the message when the screen closes
    var shownAs = setting === 'BusBoardSecs' ? (value === '0' ? 'when tapped' : 'after ' + value + ' s')
      : setting === 'BusBoardRoutes' ? (value === 'mine' ? 'your routes only' : 'all routes')
      : { pill: 'island', chip: 'status bar' }[value] || value;
    done[setting] = NAMES[setting] + ' ' + (shownAs || 'cleared');
    setGlobal('BusTempChanged', JSON.stringify(done));
  }
}

// A saved stop removed (busvalue yes) or kept after all (no): remember it (BusTempRemoved)
if (action === 'remove') {
  var rm = JSON.parse(get('BusTempRemoved') || '{}');
  if (loc('busstop')) { rm[loc('busstop')] = loc('busvalue') === 'yes'; setGlobal('BusTempRemoved', JSON.stringify(rm)); }
}

// A distance chosen for a stop (50, 100, 200, or a typed custom number): remember it (BusTempDists)
if (action === 'dist') {
  var dists = JSON.parse(get('BusTempDists') || '{}');
  var m = Math.round(parseFloat(loc('busvalue')));
  if (loc('busstop') && m >= 10 && m <= 2000) { dists[loc('busstop')] = m; setGlobal('BusTempDists', JSON.stringify(dists)); }
}

// A route tapped on the settings screen: remember it until Save changes (BusTempTicks)
if (action === 'tick') {
  var taps = JSON.parse(get('BusTempTicks') || '{}');
  var stopKey = loc('busstop'); var routeKey = loc('busroute');
  if (stopKey && routeKey) { taps[stopKey] = taps[stopKey] || {}; taps[stopKey][routeKey] = loc('busvalue') === 'n' ? 'n' : 'y'; setGlobal('BusTempTicks', JSON.stringify(taps)); }
}
var buspreview = action === 'preview' ? 'yes' : 'no';
var busintent = '';
var busuri = '';
var busdatavar = '';
var busprevgap = '';
var busprevy = '';
var busprevchip = '';

if (buspreview === 'yes') {
  var routes = (get('BusRoutes') || '25,N25').split(',').slice(0, 2);
  var now = Date.now();
  // Sample times: your first two routes (the first with its next three buses, for the stop board),
  // and two other routes for the board (4.42)
  var others = ['130', '64', '289', '412'].filter(function (r) { return routes.indexOf(r) < 0; }).slice(0, 2);
  setGlobal('BusStatePreviewData', JSON.stringify({ u: now, r: 45000, rot: 3000, s: 'preview', n: 'Preview (Stop B)', l: 'B',
    b: routes.map(function (r, k) {
      return k ? { k: r, d: 'Station Road', t: now + 38 * 60000, st: 'sched' }
               : { k: r, d: 'Town Centre', t: now + 5 * 60000, st: 'live', t2: now + 17 * 60000, st2: 'live', t3: now + 29 * 60000, st3: 'live' };
    }),
    a: [{ k: others[0], d: 'Hospital', t: [now + 7 * 60000, now + 19 * 60000] }, { k: others[1], d: 'Riverside', t: [now + 12 * 60000] }] }));
  busdatavar = 'BusStatePreviewData';
  busprevchip = routes[0] + ' in 5 min';                           // for a status bar preview
  if (loc('set_gap')) busprevgap = String(Math.round(parseFloat(loc('set_gap'))));
  if (loc('set_y')) busprevy = String(Math.round(parseFloat(loc('set_y'))));
} else if (action === 'app') {
  busintent = 'android.settings.APPLICATION_DETAILS_SETTINGS'; busuri = 'package:net.dinglisch.android.taskerm';
} else if (action === 'overlay') {
  busintent = 'android.settings.action.MANAGE_OVERLAY_PERMISSION'; busuri = 'package:net.dinglisch.android.taskerm';
} else if (action === 'access') {
  busintent = 'android.settings.ACCESSIBILITY_SETTINGS';
}
