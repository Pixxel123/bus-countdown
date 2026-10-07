/* ==================================================================
   Bus End · Note in the debugging log that a countdown ended, and how
   ================================================================== */
var from = (typeof busfrom !== 'undefined' && String(busfrom).charAt(0) !== '%') ? String(busfrom) : '';
// Swiped away: the trip is "left", held until you've left all your stops or for 30 minutes (see Bus Watch)
if (from === 'island') setGlobal('BusStateTrip', JSON.stringify({ s: 'left', stop: global('BusStateStopId') || '', since: Date.now(), swiped: true }));
/* @include debugLog */
/* @include record */
debugLog('Countdown ended' + (from === 'island' ? ': you swiped it away' : ''));
record('end', { stop: global('BusStateStopId') || '', from: from || '', battery: global('BATT') || '' });
