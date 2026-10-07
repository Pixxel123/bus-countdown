/* ==================================================================
   Bus Refresh · Fetched these times only a moment ago?
   Bus Loop and Bus Wake (the screen coming on) can both ask for fresh
   times within seconds of each other: on Tuesday and Wednesday, 11
   fetches a day came less than 20 s after the one before. TfL only
   updates its times about every 30 s, so the second fetch brings
   nothing new; it just wakes the radio again (4.34).
   Output: busfresh = yes (skip fetching; the island stays as it is)
            / no (fetch)
   ================================================================== */
/* @include get */
/* @include loc */
var now = Date.now();
var lastAt = parseInt(get('BusStateFetchAt'), 10) || 0;
// Only the two automatic callers are held back: switching stop, a preview in Settings, or running
// Bus Refresh by hand always fetches. (%caller1 isn't visible to scripts: Bus Refresh copies it into
// %busrefby first.)
var auto = /^task=Bus (Loop|Wake)$/.test(loc('busrefby'));
var busfresh = auto && get('BusStateFetchStop') === get('BusStateStopId') && now - lastAt >= 0 && now - lastAt < 20000 ? 'yes' : 'no';
