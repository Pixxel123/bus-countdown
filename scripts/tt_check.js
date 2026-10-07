/* ==================================================================
   Bus Refresh · Timetable needed for this stop?
   Scheduled times are the fallback when TfL has no live prediction for
   one of my routes (it only predicts about 30 minutes ahead) or can't be
   reached. Each stop's timetable is fetched once a day, one request per
   route, and kept in BusCacheTimetable.
   Output: busttfetch = yes / no, busttcount (routes to fetch)
   ================================================================== */
/* @include get */

var stopId = get('BusStateStopId');
var mine = get('BusRoutes').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var pool = JSON.parse(get('BusCacheStops') || '{}');
var here = pool[stopId] ? pool[stopId].r.filter(function (r) { return mine.indexOf(r) > -1; }) : mine;

var tt = JSON.parse(get('BusCacheTimetable') || '{}');
var today = new Date().toDateString();
var have = (tt[stopId] && tt[stopId].date === today) ? tt[stopId].r : {};
var missing = here.filter(function (r) { return !(r in have); });

var busttfetch = missing.length ? 'yes' : 'no';
var busttcount = String(missing.length);
setGlobal('BusTempTimetableRoutes', missing.join(','));
