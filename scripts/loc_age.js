/* ==================================================================
   Location · Is the fix fresh?
   Android can hand back an old, saved position (for example indoors,
   or in the background). Older than 3 minutes (1 minute during a
   countdown), or none at all, counts as stale, and the next step tries
   again with GPS forced on.
   Output: busstale = yes / no
   ================================================================== */
var t = (typeof gl_time_seconds !== 'undefined') ? parseFloat(gl_time_seconds) : NaN;
var hasFix = typeof gl_latitude !== 'undefined' && !isNaN(parseFloat(gl_latitude));
// During a countdown a position must be under a minute old, so walking away is noticed promptly;
// otherwise 3 minutes will do
var countdownOn = global('BusStateRunning') === '1';
var maxAge = countdownOn ? 60 : 180;
var busstale = (!hasFix || !(t > 0) || Date.now() / 1000 - t > maxAge) ? 'yes' : 'no';
