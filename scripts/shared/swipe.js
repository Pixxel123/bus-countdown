/* ==================================================================
   The island · What a sideways swipe means
   Shared, word for word, by the island's page (island_show.js) and the
   tests. dx: sideways movement in dp (negative = left); ms: how long it
   took. Route change: from 24 dp. Dismiss: from 90 dp, or from 60 dp if
   it's a fast fling (0.6 dp per ms or more). Anything shorter: nothing.
   Returns 'next', 'previous', 'dismiss' or 'none'.
   ================================================================== */
function decideSwipe(dx, ms) {
  var dist = Math.abs(dx); var speed = dist / Math.max(1, ms);
  if (dist < 24) return 'none';
  if (dist >= 90 || (dist >= 60 && speed >= 0.6)) return 'dismiss';
  return dx < 0 ? 'next' : 'previous';
}
