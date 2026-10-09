/* ==================================================================
   Bus Position Done · Save the island's position, or leave it (4.52)
   Done (busaction done) saves the sliders that were moved (their screen
   variables come across as locals: set_gap, set_y, set_cx; one not
   moved isn't set), each kept within its slider's range; Cancel saves
   nothing. Either way the editor is over (BusStateEditing), so a
   countdown's own island is shown again.
   Output: busmsg (what was saved, or "none")
   ================================================================== */
/* @include loc */
/* @include get */
var changed = [];
function slid(setting, v, lo, hi, what) {
  var x = loc(v);
  if (x === '' || isNaN(parseFloat(x))) return;
  var value = String(Math.min(hi, Math.max(lo, Math.round(parseFloat(x)))));
  if (value !== get(setting)) { setGlobal(setting, value); changed.push(what + ' ' + value + ' dp'); }
}
if (loc('busaction') === 'done') {
  slid('BusIslandGap', 'set_gap', 26, 80, 'camera gap');
  slid('BusIslandY', 'set_y', 0, 24, 'top offset');
  slid('BusChipX', 'set_cx', 0, 200, 'status bar position');
}
setGlobal('BusStateEditing', '0');
var busmsg = changed.length ? 'Saved: ' + changed.join(', ') : 'none';
