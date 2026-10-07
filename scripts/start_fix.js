/* ==================================================================
   Bus Start · Can we use the position Android just pushed?
   When Bus Moved starts a countdown (you've arrived, or just left home
   or work), the position it used is seconds old (BusStateLastFix), so
   there's no need to fetch another. Started any other way, or with a
   position over a minute old, Bus Start fetches one as usual.
   Output: busfixok (yes: use it), gl_latitude, gl_longitude,
           gl_time_seconds, busstale
   ================================================================== */
/* @include loc */
// Why Bus Start is running: par1 (arrived / approach / leaving / glance), or, if that didn't come
// through, the note Bus Watch or Bus Moved left just before starting it (BusStateStartMode, "mode|time",
// used if under a minute old). Started any other way, it's a manual start.
var mode = loc('par1');
if (!mode) {
  var note = String(global('BusStateStartMode') || '').split('|');
  if (note[0] && Date.now() - (parseInt(note[1], 10) || 0) < 60000) mode = note[0];
}
var fix = {}; try { fix = JSON.parse(global('BusStateLastFix') || '{}'); } catch (e) {}
var fresh = fix.t && Date.now() - fix.t < 60000;
var busfixok = ((mode === 'arrived' || mode === 'leaving') && fresh) ? 'yes' : 'no';
var gl_latitude = busfixok === 'yes' ? String(fix.lat) : '';
var gl_longitude = busfixok === 'yes' ? String(fix.lon) : '';
var gl_time_seconds = busfixok === 'yes' ? String(fix.t / 1000) : '';
var busstale = 'no';
