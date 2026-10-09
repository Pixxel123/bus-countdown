/* ==================================================================
   Bus Refresh · Fetched these times only a moment ago?
   Bus Loop and Bus Wake (the screen coming on) can both ask for fresh
   times within seconds of each other: on Tuesday and Wednesday, 11
   fetches a day came less than 20 s after the one before. TfL only
   updates its times about every 30 s, so the second fetch brings
   nothing new; it just wakes the radio again (4.34).
   Output: busfresh = yes (skip fetching; the island stays as it is)
            / no (fetch) / cached (a long press to the stop got ready, 4.45:
            use the times kept for it)
   ================================================================== */
/* @include get */
/* @include loc */
var now = Date.now();
var lastAt = parseInt(get('BusStateFetchAt'), 10) || 0;
// Only the automatic callers are held back: switching stop, a preview in Settings, or running
// Bus Refresh by hand always fetches. (%caller1 isn't visible to scripts: Bus Refresh copies it into
// %busrefby first.)
// The stop board opening or closing (4.42) is held back too: it shows the times just fetched.
var auto = /^task=Bus (Loop|Wake)$/.test(loc('busrefby')) || /^(open|close)$/.test(loc('busrefpar'));
var busfresh = auto && get('BusStateFetchStop') === get('BusStateStopId') && now - lastAt >= 0 && now - lastAt < 20000 ? 'yes' : 'no';
// A long press to the stop Bus Refresh got ready (4.45): its times, fetched under 90 s ago, are used
// at once ("cached"), and nothing waits for TfL
var ready = {}; try { ready = JSON.parse(get('BusStatePrefetch') || '{}') || {}; } catch (e) { ready = {}; }
if (loc('busrefpar') === 'switch' && ready.s === get('BusStateStopId') && now - ready.at >= 0 && now - ready.at < 90000) busfresh = 'cached';
