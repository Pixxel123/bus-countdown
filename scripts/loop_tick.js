/* ==================================================================
   Bus Loop · Each cycle: time up? And how long to wait next
   Time's up after BusTimeout minutes, unless you're still waiting at the
   stop (then it carries on, up to 2 hours from the start).
   BusStateNextWait comes from Bus Refresh: longer while the next bus is
   more than 10 minutes away. With the screen off (no fetches), BusRefresh.
   Output: busdone = yes / no, buswait (seconds), busfetch (yes: fetch times
   this cycle: screen on, or a bus within 8 minutes), busnopush (yes: no
   pushed position for 2 minutes, or 10 if you were standing still)
   ================================================================== */
/* @include get */
var busdone = Date.now() >= (parseInt(get('BusStateEndAt'), 10) || 0) ? 'yes' : 'no';
// A heads-up's minute is up: if you've left the office Wi-Fi by now, carry on as a normal countdown
// for the walk; still at your desk, it ends
if (busdone === 'yes' && get('BusStateGlance') !== '') {
  var stillAtWork = get('BusStateWifi') !== '' && get('BusStateWifi') === get('BusWorkWifi');
  if (!stillAtWork) {
    setGlobal('BusStateEndAt', String(parseInt(get('BusStateGlance'), 10) + (parseFloat(get('BusTimeout')) || 30) * 60000));
    busdone = 'no';
  }
  setGlobal('BusStateGlance', '');
}
// Time's up, but you're still waiting at the stop (Bus Watch's trip state is "at the stop": it only
// leaves that when you move off): carry on for another BusTimeout, up to 2 hours from the start. The
// limit is there for a countdown that never noticed you'd left.
var trip = {}; try { trip = JSON.parse(get('BusStateTrip') || '{}'); } catch (e) {}
var startedAt = parseInt(get('BusStateStartedAt'), 10) || 0;
if (busdone === 'yes' && trip.s === 'atstop' && trip.stop === get('BusStateStopId') && startedAt && Date.now() - startedAt < 2 * 3600000) {
  setGlobal('BusStateEndAt', String(Math.min(Date.now() + (parseFloat(get('BusTimeout')) || 30) * 60000, startedAt + 2 * 3600000)));
  busdone = 'no';
  var extended = true;
}
// Fetch times this cycle? Always with the screen on; with it off only when a bus is due within 8
// minutes, so the buzz for a bus under 5 minutes still comes with the phone in your pocket
// (BusStateNextAt is a time, so it counts down between fetches; BusStateNextMin, from versions before
// 4.32, was a snapshot that didn't)
var nextAtT = parseInt(get('BusStateNextAt'), 10);
var nextMin = nextAtT ? (nextAtT - Date.now()) / 60000 : parseFloat(get('BusStateNextMin'));
var busfetch = (get('SCREEN') !== 'off' || (!isNaN(nextMin) && nextMin <= 8)) ? 'yes' : 'no';
var base = parseInt(get('BusRefresh'), 10) || 45;
var chosen = parseInt(get('BusStateNextWait'), 10) || base;
var buswait = String(get('SCREEN') === 'off' ? base : Math.max(15, Math.min(chosen, 300)));
// Safety net: Android should push a position every 20 m during a countdown (Bus Moved). If none has
// arrived for 2 minutes with the screen on, ask for them again and check your location here, so a
// countdown still ends when you leave even if the pushes have stopped (or Bus Moved isn't listening).
var lastPush = parseInt(get('BusStateLastPush'), 10) || 0;
// Standing still (the last speed Bus Watch saw was walking pace or less), Android rightly sends
// nothing: positions come when you move 20 m. Then silence only counts after 10 minutes.
var win = []; try { win = JSON.parse(get('BusStateWindow') || '[]'); } catch (e) {}
var lastSpeed = win.length ? win[win.length - 1].spd : -1;
var quietFor = (lastSpeed >= 0 && lastSpeed <= 0.8) ? 600000 : 120000;
var busnopush = (get('SCREEN') !== 'off' && Date.now() - lastPush > quietFor) ? 'yes' : 'no';

/* @include debugLog */
if (extended) debugLog('Still waiting at the stop: the countdown carries on (2 hours at most)');
if (busnopush === 'yes') debugLog('Safety net: no position pushed for ' + Math.round(quietFor / 60000) + ' min; asking again and checking here');
