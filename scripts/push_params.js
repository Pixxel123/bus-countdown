/* ==================================================================
   Bus Wake and Bus Loop · The current position rate, to ask for again
   Bus Watch keeps the rate it last asked for (BusStatePushMs,
   BusStatePushM). Asking again with the same PendingIntent just
   replaces the old request, so this is safe to repeat (after a restart,
   Android forgets it). First run: every 30 m, at most every 20 s.
   Output: buspushms, buspushm
   ================================================================== */
/* @include get */
var buspushms = get('BusStatePushMs') || '20000';
var buspushm = get('BusStatePushM') || '30';
