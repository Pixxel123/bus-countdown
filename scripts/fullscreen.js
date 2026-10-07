/* ==================================================================
   Orientation · Is the phone sideways?
   Reads Android's own configuration (busconfig, from the Java steps
   just before this), which says "port" or "land".
   Used by Bus Hide When Sideways (run by the profile of the same name when the
   screen turns sideways and back) and by Bus Refresh before it shows
   the island.
   Output: busfullnow = yes (sideways) / no (upright)
   ================================================================== */
/* @include loc */
var conf = loc('busconfig');
var land = /\bland\b/.test(conf); var port = /\bport\b/.test(conf);
var busfullnow = land ? 'yes' : 'no';
setGlobal('BusStateFullscreen', busfullnow);
setGlobal('BusStateFullscreenInfo', (busfullnow === 'yes' ? 'sideways' : 'upright') +
  (land || port ? '' : ' (Android gave no answer, so assumed upright)') + ' at ' + new Date().toTimeString().slice(0, 5));
