/* ==================================================================
   Bus Watch · Should we check, and has the Wi-Fi changed?
   Runs before every check: from Bus Moved (Android pushed a position),
   from Bus Wake (the screen came on) and when run by hand.
   Wi-Fi comes first because it needs no location:
     - on home or work Wi-Fi there's nothing to check;
     - a countdown that started somewhere else ends when you get there;
     - just leaving work (or home, as BusLeaveShow says) starts one for
       your nearest saved stop.
   Output: busdue, busend, busleave, busquiet (each yes / no)
   ================================================================== */
/* @include get */
/* @include loc */
/* @include metres */

// Saved stops should all read "type|id|name|lat|lon|radius". Older lines without the type are
// fixed here, and blank lines and duplicates are dropped.
(function tidyPlaces() {
  var raw = get('BusPlaces');
  if (!raw.trim()) return;
  var seen = {}; var out = [];
  raw.split(/\r?\n/).forEach(function (line) {
    var p = line.trim().split('|').map(function (x) { return x.trim(); });
    if (!p[0]) return;
    if (p[0] !== 'bus' && p[0] !== 'rail' && p.length >= 4 && !isNaN(parseFloat(p[2]))) p = ['bus'].concat(p.slice(0, 5));
    if (seen[p[0] + p[1]]) return;
    seen[p[0] + p[1]] = true;
    out.push(p.join('|'));
  });
  if (out.join('\n') !== raw) setGlobal('BusPlaces', out.join('\n'));
})();

// Who asked: Bus Moved, Bus Wake, or you (scripts can't read %caller1, so the task passes it on)
var caller = loc('buscaller');
var fromMoved = caller === 'profile=moved';
var fromWake = caller === 'profile=wake' || caller === 'profile=loop';   // Bus Loop's safety net counts as a screen-on check
var byHand = !fromMoved && !fromWake;

// The Wi-Fi network you're on: read just before this when the task has the Java steps (busssid),
// otherwise the one Bus Wake or Bus Moved last saw (BusStateWifi)
/* @include wifiName */
var wifiNow = typeof busssid === 'undefined' ? get('BusStateWifi') : wifiName();
var onHome = wifiNow !== '' && wifiNow === get('BusHomeWifi');
var onWork = wifiNow !== '' && wifiNow === get('BusWorkWifi');
function known(n) { return n !== '' && (n === get('BusHomeWifi') || n === get('BusWorkWifi')); }

var countdownOn = get('BusStateRunning') === '1' && /(^|,)Bus Loop(,|$)/.test(get('TRUN'));
var lastWifi = get('BusStateLastWifi');
// Losing home or work Wi-Fi only counts as leaving once you're also 50 m from that place (its position
// is recorded in BusHomeAt / BusWorkAt), or, with no position to go on, once the Wi-Fi has stayed
// gone for two checks in a row. Until then the last network is kept (BusStateLastWifi) and the
// checks off it are counted (BusStateOffWifi), so a brief drop at your desk is ignored.
var hereLat = parseFloat(loc('gl_latitude'));
var hereLon = parseFloat(loc('gl_longitude'));
function metresFrom(placeVar) {
  var at = null; try { at = JSON.parse(get(placeVar) || 'null'); } catch (e) {}
  if (!at || !at.lat || isNaN(hereLat) || isNaN(hereLon)) return null;
  return metres(hereLat, hereLon, at.lat, at.lon);
}
var offCount = parseInt(get('BusStateOffWifi'), 10) || 0;
var reallyLeft = false;
if (known(lastWifi) && !known(wifiNow)) {
  var fromPlace = metresFrom(lastWifi === get('BusHomeWifi') ? 'BusHomeAt' : 'BusWorkAt');
  if (fromPlace !== null ? fromPlace >= 50 : offCount + 1 >= 2) reallyLeft = true;
  else offCount++;
}
if (onHome) setGlobal('BusStateLastPlace', 'home');        // for which side of the road comes first
if (onWork) setGlobal('BusStateLastPlace', 'work');
if (reallyLeft || known(wifiNow) || !known(lastWifi)) { setGlobal('BusStateLastWifi', wifiNow); offCount = 0; }
setGlobal('BusStateOffWifi', String(offCount));

// Got home or to the office: end the countdown, unless it started on that same network
// (one you started by hand at your desk carries on)
var busend = (countdownOn && (onHome || onWork) && wifiNow !== get('BusStateStartWifi')) ? 'yes' : 'no';
// Just left work (or home, or both, as BusLeaveShow says): show the next buses from your nearest
// saved stop. Otherwise a countdown only starts when you reach a saved stop's arrival distance.
var leaveShow = get('BusLeaveShow') || 'work';
var leftWhich = lastWifi === get('BusHomeWifi') ? 'home' : lastWifi === get('BusWorkWifi') ? 'work' : '';
var leaveWanted = leaveShow === 'both' || leaveShow === leftWhich;
var busleave = (!countdownOn && reallyLeft && leaveWanted && get('BusPlaces') !== '') ? 'yes' : 'no';
if (busleave === 'yes') setGlobal('BusStateStartMode', 'leaving|' + Date.now());

// Staying put well away from your stops (Bus Watch has slowed the pushes right down: BusStatePushMode
// is "far"), the screen coming on doesn't need a fresh GPS fix if there was one in the last 2 minutes
// (Tuesday evening, 39 screen-on checks in under an hour, sitting in the same place)
var lastFix = 0; try { var winNow = JSON.parse(get('BusStateWindow') || '[]'); lastFix = winNow.length ? winNow[winNow.length - 1].t : 0; } catch (e) {}
var quietFar = fromWake && !countdownOn && get('BusStatePushMode') === 'far' && Date.now() - lastFix < 120000;
var busquiet = quietFar && !onHome && !onWork ? 'yes' : 'no';      // Bus Watch stops before getting a fix
var why = get('BusPlaces') === '' ? 'no saved stops'
        : onHome ? 'on home Wi-Fi'
        : onWork ? 'on work Wi-Fi'
        : quietFar ? 'staying put away from your stops, checked under 2 minutes ago'
        : '';
var busdue = (byHand || why === '') ? 'yes' : 'no';

// For Bus Status: what this check decided, and why
setGlobal('BusStateWatchInfo', new Date().toTimeString().slice(0, 5) + ' ' +
  (fromWake ? '(screen on) ' : fromMoved ? '(position pushed) ' : '(by hand) ') +
  (busend === 'yes' ? 'ended the countdown: ' + why
   : busleave === 'yes' ? 'you left ' + (lastWifi === get('BusHomeWifi') ? 'home' : 'work') + ' Wi-Fi: started a countdown for your nearest stop'
   : busdue === 'yes' ? 'checked location' : 'skipped: ' + why));

/* @include debugLog */
if (busend === 'yes' || busleave === 'yes' || !fromMoved) debugLog(get('BusStateWatchInfo').replace(/^\d\d:\d\d /, ''));
