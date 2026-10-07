/* ==================================================================
   Bus Settings · Save the stops across the road you ticked
   Reads the List Dialog's answer (ld_selected; ld_selected1, 2... when
   Tasker gives it as a list). Ticked stops are saved; the others go on
   BusPlacesSkip, so you aren't asked about them again (choosing a route
   at one in Settings later brings it back).
   Output: busoppmsg
   ================================================================== */
/* @include get */
/* @include loc */

var candidates = JSON.parse(get('BusTempOppCandidates') || '[]');
var answer = [loc('ld_selected')];
for (var i = 1; i <= 20; i++) answer.push(loc('ld_selected' + i));
answer = answer.join('\n');

var places = get('BusPlaces') ? get('BusPlaces').split('\n') : [];
var skip = get('BusPlacesSkip') ? get('BusPlacesSkip').split(',') : [];
var saved = []; var declined = [];
candidates.forEach(function (c) {
  if (answer.indexOf(c.label) > -1) {
    places.push(['bus', c.id, c.n, c.a, c.o].join('|'));
    saved.push(c.n);
  } else {
    if (skip.indexOf(c.id) < 0) skip.push(c.id);
    declined.push(c.n);
  }
});
if (saved.length) setGlobal('BusPlaces', places.join('\n'));
setGlobal('BusPlacesSkip', skip.join(','));
setGlobal('BusTempOppCandidates', '');
var busoppmsg = saved.length ? 'Also saved: ' + saved.join(', ') : 'Not saved: ' + declined.join(', ');
