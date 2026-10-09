/* ==================================================================
   Bus Refresh · Get the stop a long press goes to ready (4.45)
   A long press switches to the next nearby stop (usually across the
   road). Since 4.43 it shows that stop at once, with its times if they
   were fetched in the last 3 minutes, and otherwise waits 1 to 2 s for
   TfL. So after each refresh, while a countdown runs with the screen
   on, the next stop's times are fetched as well (unless they're under
   40 s old already): a long press then shows them straight away, and
   Bus Refresh builds the island from them without waiting for TfL.
   Output: busprefetch = yes / no, busprestop (the stop to get ready),
           busttstop (the same, for the timetable steps)
   ================================================================== */
/* @include get */
var stops = []; try { stops = JSON.parse(get('BusStateNearbyStops') || '[]'); } catch (e) { stops = []; }
var next = stops.length > 1 ? stops[((parseInt(get('BusStateStopIndex'), 10) || 0) + 1) % stops.length] : null;   // as opposite.js picks it
if (next && next.id === get('BusStateStopId')) next = null;
var ready = {}; try { ready = JSON.parse(get('BusStatePrefetch') || '{}') || {}; } catch (e) { ready = {}; }
var now = Date.now();
var fresh = !!next && ready.s === next.id && now - ready.at >= 0 && now - ready.at < 40000;
var busprefetch = next && get('BusStateRunning') === '1' && get('SCREEN') !== 'off' && !fresh ? 'yes' : 'no';
var busprestop = next ? next.id : '';
var busttstop = busprestop;
