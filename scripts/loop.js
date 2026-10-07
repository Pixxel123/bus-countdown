/* ==================================================================
   Bus Loop · Start: when the countdown ends by itself
   Output: buscycles (an upper bound on refreshes: the tick below ends
   the loop on time, since waits can be longer than BusRefresh)
   ================================================================== */
var refresh = parseInt(global('BusRefresh'), 10) || 45;
var timeout = parseFloat(global('BusTimeout')) || 30;
// A heads-up at work (BusStateGlance, set by Bus Start) lasts a minute; any other countdown BusTimeout
var glance = Date.now() - (parseInt(global('BusStateGlance'), 10) || 0) < 30000;
setGlobal('BusStateEndAt', String(Date.now() + (glance ? 60000 : timeout * 60000)));
setGlobal('BusStateStartedAt', String(Date.now()));        // for the 2-hour limit while waiting (loop_tick.js)
setGlobal('BusStateNextWait', String(refresh));
var buscycles = String(Math.max(1, Math.ceil(timeout * 60 / Math.min(refresh, 15))));
