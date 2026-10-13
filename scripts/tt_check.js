/* ==================================================================
   Bus Refresh · Timetable needed for this stop?
   Scheduled times are the fallback when TfL has no live prediction for
   one of my routes (it only predicts about 30 minutes ahead) or can't be
   reached. Each stop's timetable is fetched once a day, one request per
   route, and kept in BusCacheTimetable. Since 4.43 this runs after the
   island has been shown, so it never holds up the times: the next
   refresh shows the timetable's. Since 4.58, for every one of your
   routes at the stop, not only those TfL had no live time for just now
   (on Monday 12 October TfL stopped answering at Wexley, Stop D; the
   566, live when you got there, had no timetable to fall back on, and
   the island showed only the 517). A request that failed is tried again
   after 5 minutes, rather than tomorrow.
   Output: busttfetch = yes / no, busttcount (routes to fetch)
   ================================================================== */
/* @include get */
/* @include loc */

// The current stop, or the one a long press goes to while it's being got ready (busttstop, 4.45)
var stopId = loc('busttstop') || get('BusStateStopId');
var mine = get('BusRoutes').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var pool = JSON.parse(get('BusCacheStops') || '{}');
var here = pool[stopId] ? pool[stopId].r.filter(function (r) { return mine.indexOf(r) > -1; }) : mine;

var tt = JSON.parse(get('BusCacheTimetable') || '{}');
var today = new Date().toDateString();
var have = (tt[stopId] && tt[stopId].date === today) ? tt[stopId].r : {};
var missing = here.filter(function (r) { var got = have[r]; return !got || (got.fail && Date.now() - got.fail >= 5 * 60000); });

var busttfetch = missing.length ? 'yes' : 'no';
var busttcount = String(missing.length);
setGlobal('BusTempTimetableRoutes', missing.join(','));
