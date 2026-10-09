/* ==================================================================
   Orientation · Is the phone sideways?
   Reads Android's own configuration (busconfig, from the Java steps
   just before this), which says "port" or "land".
   Used by Bus Hide When Sideways (run by the profile of the same name when the
   screen turns sideways and back) and by Bus Refresh before it shows
   the island.
   While Settings' live position editor is open (4.52: BusStateEditing,
   when it opened, for up to 10 minutes, as long as it can stay open),
   the island is kept hidden as if sideways, so a countdown's own island
   doesn't sit under the one being moved, and refreshes don't draw it.
   Output: busfullnow = yes (sideways, or editing) / no (upright)
   ================================================================== */
/* @include loc */
/* @include get */
var conf = loc('busconfig');
var land = /\bland\b/.test(conf); var port = /\bport\b/.test(conf);
var editingAt = parseInt(get('BusStateEditing'), 10) || 0;
var editing = Date.now() - editingAt >= 0 && Date.now() - editingAt < 600000;
var busfullnow = land || editing ? 'yes' : 'no';
setGlobal('BusStateFullscreen', land ? 'yes' : 'no');
setGlobal('BusStateFullscreenInfo', (land ? 'sideways' : 'upright') + (editing ? ', island position being edited' : '') +
  (land || port ? '' : ' (Android gave no answer, so assumed upright)') + ' at ' + new Date().toTimeString().slice(0, 5));
