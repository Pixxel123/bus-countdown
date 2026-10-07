// How many of your routes the current stop has (BusRoutes that call at BusStateStopId, from the
// route stop lists in BusCacheStops), or at least as many as are showing. The island is sized for
// this, so a route dropping out of TfL's predictions, or coming back, never changes its size.
function routesHere(showing) {
  var mine = get('BusRoutes').split(',').map(function (s) { return s.trim(); });
  var stop = null; try { stop = JSON.parse(get('BusCacheStops') || '{}')[get('BusStateStopId')]; } catch (e) {}
  var here = stop && stop.r ? stop.r.filter(function (r) { return mine.indexOf(r) > -1; }).length : 0;
  return Math.max(1, here, showing || 0);
}
