// The stop's letter, from its TfL indicator ("Stop B" -> B, "Stop BK" -> BK). Stops without one
// (indicators like "opp" or "->N", or none at all) get no letter, and the island shows none. Shared
// by refresh.js and, for the stop a long press switches to, opposite.js (4.43).
function stopLetter(name) {
  var m = /\(([^)]*)\)\s*$/.exec(name || ''); var ind = m ? m[1].trim() : '';
  var l = /^stop\s+([a-z][a-z0-9]?)$/i.exec(ind);
  return l ? l[1].toUpperCase() : '';
}
