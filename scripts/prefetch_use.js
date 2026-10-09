/* ==================================================================
   Bus Refresh · A long press to the stop got ready: use its times (4.45)
   Turns BusStatePrefetch back into a TfL reply (seconds away from now),
   for refresh.js to build the island from as if it had just arrived, so
   the switch doesn't wait for TfL. Bus Loop's next refresh fetches fresh
   times as usual (buscachedat tells refresh.js when these were fetched,
   so its 20 s skip counts from then).
   Output: http_response_code, http_data, buscachedat
   ================================================================== */
/* @include get */
var ready = {}; try { ready = JSON.parse(get('BusStatePrefetch') || '{}') || {}; } catch (e) { ready = {}; }
var now = Date.now();
var http_response_code = '200';
var http_data = JSON.stringify((ready.b || []).map(function (x) {
  return { lineName: x[0], vehicleId: x[1], timeToStation: Math.round((x[2] - now) / 1000), destinationName: x[3] };
}).filter(function (a) { return a.timeToStation > -60; }));
var buscachedat = String(ready.at || now);
