/* ==================================================================
   Bus Moved · Read the position Android just pushed
   Android pushes a position as you move: every 30 m normally, every
   20 m during a countdown (requested by Bus Start, Bus End and Bus
   Wake). The position in its message reaches Tasker as "file:///", so
   the steps before this read the fused last known location instead (the
   fix just pushed). It's handed to watch.js as gl_latitude /
   gl_longitude / gl_time_seconds, so the usual rules decide: arriving
   at a saved stop starts a countdown, walking away ends one.
   Output: busmovedok (yes: a position was read), gl_latitude,
   gl_longitude, gl_time_seconds
   ================================================================== */
/* @include loc */
var m = /([-\d.]+),\s*([-\d.]+)/.exec(loc('bus_lastloc'));
var busmovedok = m ? 'yes' : 'no';
var gl_latitude = m ? m[1] : '';
var gl_longitude = m ? m[2] : '';
// Android's speed for this position in m/s ("" when it doesn't know)
var busspeed = loc('bus_hasspeed') === 'true' ? loc('bus_speed') : '';
// ...and your direction of travel, in degrees from north ("" when it doesn't know)
var busbearing = loc('bus_hasbearing') === 'true' ? loc('bus_bearing') : '';
// ...and how accurate the position is, in metres (poor fixes are averaged with the previous one)
var busacc = loc('bus_acc');
var gl_time_seconds = loc('bus_fixtime') ? String(parseFloat(loc('bus_fixtime')) / 1000) : String(Date.now() / 1000);
if (m) setGlobal('BusStateLastFix', JSON.stringify({ lat: +m[1], lon: +m[2], t: Math.round(parseFloat(gl_time_seconds) * 1000) }));
setGlobal('BusStateLastPush', String(Date.now()));
if (!m) setGlobal('BusStateWatchInfo', (global('BusStateWatchInfo') || '') + ' \u2192 no position could be read');

/* @include debugLog */
debugLog('Position pushed' + (m ? '' : ', but unreadable') + (busspeed !== '' ? ', ' + Math.round(parseFloat(busspeed) * 3.6) + ' km/h' : '') +
  (busbearing !== '' ? ', heading ' + Math.round(parseFloat(busbearing)) + '\u00b0' : ''));
