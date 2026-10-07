/* ==================================================================
   Bus End · Note in the debugging log that a countdown ended, and why
   Input : busfrom = island (swiped away, from the island's page), or
           busreason = Bus End's %par1 from the task that ended it:
           menu, timeout, wifi (got home or to work) or watch (Bus
           Watch saw you leave; BusStateEndWhy says how)
   ================================================================== */
var given = function (v) { return typeof v !== 'undefined' && String(v) !== '' && String(v).charAt(0) !== '%' ? String(v) : ''; };
var from = given(typeof busfrom !== 'undefined' ? busfrom : '') || given(typeof busreason !== 'undefined' ? busreason : '') || 'unknown';
// Swiped away: snooze (Bus Watch holds everything back until you've been to that stop and left it,
// or for 30 minutes). Kept in its own variable, so a check running at the same moment can't undo it.
if (from === 'island') {
  setGlobal('BusStateSnooze', JSON.stringify({ stop: global('BusStateStopId') || '', at: Date.now() }));
  setGlobal('BusStateTrip', JSON.stringify({ s: 'left', stop: global('BusStateStopId') || '', since: Date.now() }));
}
var how = { island: 'you swiped it away', menu: 'ended from the Bus menu', timeout: 'time’s up', wifi: 'on home or work Wi-Fi',
  watch: global('BusStateEndWhy') || 'you left', unknown: 'reason not known' }[from] || from;
/* @include debugLog */
/* @include record */
debugLog('Countdown ended: ' + how);
record('end', { stop: global('BusStateStopId') || '', from: from, why: how, battery: global('BATT') || '' });
setGlobal('BusStateEndWhy', '');
