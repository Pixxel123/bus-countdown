/* ==================================================================
   The island · What a sideways swipe means
   Shared, word for word, by the island's page (island_show.js) and the
   tests. dx: sideways movement in dp (negative = left); ms: how long it
   took; several: the island has more than one route to swipe through.
   Route change: from 24 dp. Dismiss: from 90 dp, or from 60 dp if it's a
   fast fling (0.6 dp per ms or more). With several routes (4.43), only a
   long, deliberate drag dismisses: from 130 dp, however fast, since a
   quick flick is how you move to the next route. Anything shorter:
   nothing. Returns 'next', 'previous', 'dismiss' or 'none'.
   ================================================================== */
var SWIPE_DISMISS = 90;
var SWIPE_DISMISS_SEVERAL = 130;
function decideSwipe(dx, ms, several) {
  var dist = Math.abs(dx); var speed = dist / Math.max(1, ms);
  if (dist < 24) return 'none';
  if (several ? dist >= SWIPE_DISMISS_SEVERAL : (dist >= SWIPE_DISMISS || (dist >= 60 && speed >= 0.6))) return 'dismiss';
  return dx < 0 ? 'next' : 'previous';
}
