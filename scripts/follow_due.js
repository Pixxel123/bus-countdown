/* ==================================================================
   Bus Watch · Ask TfL where your bus is? (4.58)
   While you ride a bus Bus Watch has named (BusStateBoarded, the one
   you were seen getting on), TfL is asked which stops it calls at next,
   just before each check, so a slow spell in traffic can be told from
   getting off (shared/followBus.js). Only while riding: on a bus, or on
   one heading for a saved stop. At most every 45 s, or every 20 s while
   you're moving slowly (the times it matters). The last reply is kept
   for 2 minutes, so a missed one changes nothing. Every attempt counts,
   not only answered ones (BusStateFollowTry): after a failed request
   (no signal, TfL down) it waits 90 s, then 180, then 300 at most, as
   Bus Loop does, so it never asks on every position.
   Output: busfollow = yes / no, busfollowv (the bus's registration)
   ================================================================== */
/* @include get */
var now = Date.now();
var trip = getJSON('BusStateTrip', {});
var boarded = getJSON('BusStateBoarded', null);
var last = getJSON('BusStateFollow', null);
var win = getJSON('BusStateWindow', []);
var riding = trip.s === 'onbus' || (trip.s === 'heading' && !!trip.bus);
var named = !!boarded && !!boarded.v && boarded.sure !== false && now - (boarded.at || 0) < 2 * 3600000;
var tried = getJSON('BusStateFollowTry', null);
var lastSpd = win.length ? win[win.length - 1].spd : -1;
var fails = tried && tried.v === (boarded && boarded.v) ? tried.fails || 0 : 0;
var lastAsk = Math.max(last && last.v === (boarded && boarded.v) ? last.at : 0, tried && tried.v === (boarded && boarded.v) ? tried.at : 0);
var wait = fails ? Math.min(300000, 90000 * Math.pow(2, fails - 1)) : (lastSpd >= 0 && lastSpd <= 2.5 ? 20000 : 45000);
var busfollow = riding && named && now - lastAsk >= wait ? 'yes' : 'no';
var busfollowv = busfollow === 'yes' ? boarded.v : '';
// Counted as tried now; follow_store.js marks it answered, or failed once more
if (busfollow === 'yes') setGlobal('BusStateFollowTry', JSON.stringify({ v: boarded.v, at: now, fails: fails }));
