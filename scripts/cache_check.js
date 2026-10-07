/* ==================================================================
   Route stops cache · Is it up to date?
   (Same steps in Bus Start and Bus Settings.)
   BusCacheStops holds every stop each of my routes calls at, from TfL's
   /Line/{route}/StopPoints. It's refreshed once a day, or straight away
   if BusRoutes changes, so finding nearby stops needs no TfL request.
   Output: busfetch = yes / no, busroutecount (routes to fetch)
   ================================================================== */
/* @include get */

var routes = get('BusRoutes').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var key = routes.join(','); var today = new Date().toDateString();
var fresh = get('BusCacheStops') !== '' && get('BusCacheSeq') !== '' && get('BusCacheStopsRoutes') === key && get('BusCacheStopsDate') === today;

var busfetch = fresh ? 'no' : 'yes';
var busroutecount = fresh ? '0' : String(routes.length);
if (!fresh) {
  setGlobal('BusTempFetchRoutes', key);   // the routes the loop will fetch, in order
  setGlobal('BusTempFetchStops', '{}');    // their stops are merged in here
  setGlobal('BusTempFetchFailed', '0');
  setGlobal('BusTempFetchSeq', '[]');      // each route's stops in order, both directions
}
