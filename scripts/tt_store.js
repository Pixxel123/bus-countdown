/* ==================================================================
   Bus Refresh · Keep today's departures for this route at this stop
   From TfL /Line/{route}/Timetable/{stop}: pick today's schedule
   (weekday, Saturday or Sunday) and store each departure as
   [minutes after midnight, destination]. The destination is the last
   stop of that journey's pattern (knownJourneys[].intervalId points at
   stationIntervals), so short journeys show where they really end.
   Stored per route as { t: [[minute, nameIndex], ...], n: [names] }. A reply with no journeys today stores an
   empty list, so it isn't asked for again until tomorrow; a request with no reply, or a 429 or 5xx, stores when
   it failed (fail), and tt_check.js tries again 5 minutes later (4.58); any other error is kept as no
   departures for the day. Only the 8 most recent stops are kept.
   ================================================================== */
/* @include get */
/* @include loc */

var stopId = loc('busttstop') || get('BusStateStopId'); var today = new Date().toDateString(); var day = new Date().getDay();
var trips = []; var names = [];
var code = loc('http_response_code');

function todays(schedules) {
  var named = function (re, not) { return schedules.filter(function (s) { return re.test(s.name) && !(not && not.test(s.name)); })[0]; };
  if (day === 0) return named(/sun/i);
  if (day === 6) return named(/sat/i);
  return named(/mon/i, /school/i) || named(/mon/i);
}
if (code === '200') {
  try {
    var data = JSON.parse(http_data); var t = data.timetable || {};
    // Stop id -> name, from both lists TfL returns
    var stopName = {};
    (data.stops || []).concat(data.stations || []).forEach(function (s) { if (s && s.id) stopName[s.id] = s.name; });
    var fallbackDest = (data.stations && data.stations.length) ? data.stations[data.stations.length - 1].name : '';
    function nameIndex(n) { n = String(n || fallbackDest || 'Timetable').replace(/ (Bus Station|Interchange)$/, ''); var k = names.indexOf(n); if (k < 0) { names.push(n); k = names.length - 1; } return k; }

    (t.routes || []).forEach(function (route) {
      // Where each journey pattern ends
      var ends = {};
      (route.stationIntervals || []).forEach(function (si) {
        var list = si.intervals || [];
        if (list.length) ends[si.id] = stopName[list[list.length - 1].stopId];
      });
      var s = todays(route.schedules || []);
      (s && s.knownJourneys || []).forEach(function (j) {
        var m = parseInt(j.hour, 10) * 60 + parseInt(j.minute, 10);
        if (!isNaN(m)) trips.push([m, nameIndex(ends[j.intervalId])]);
      });
    });
  } catch (e) { trips = []; names = []; }
}
trips.sort(function (a, b) { return a[0] - b[0]; });

var tt = JSON.parse(get('BusCacheTimetable') || '{}');
if (!tt[stopId] || tt[stopId].date !== today) { delete tt[stopId]; tt[stopId] = { date: today, r: {} }; }
// Tried again later only when it may work then: no reply, TfL busy (429) or failing (5xx). Any other
// answer (a 404 for a route that doesn't call here, say) is kept for the day, as no departures
var retry = code !== '200' && (!code || code === '429' || /^5/.test(code));
tt[stopId].r[busttroute] = retry ? { t: [], n: [], fail: Date.now() } : { t: trips, n: names };
var keys = Object.keys(tt);
while (keys.length > 8) { delete tt[keys.shift()]; }
setGlobal('BusCacheTimetable', JSON.stringify(tt));
