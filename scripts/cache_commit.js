/* ==================================================================
   Route stops cache · Keep what was fetched
   All routes fetched: it becomes the cache for today.
   Something failed: keep yesterday's cache if there is one, otherwise
   use what did arrive (and try again next time).
   ================================================================== */
/* @include get */

if (busfetch === 'yes') {
  var pool = get('BusTempFetchStops') || '{}';
  if (get('BusTempFetchFailed') === '0') {
    setGlobal('BusCacheStops', pool);
    setGlobal('BusCacheStopsRoutes', get('BusTempFetchRoutes'));
    setGlobal('BusCacheStopsDate', new Date().toDateString());
  } else if (get('BusCacheStops') === '' && pool !== '{}') {
    setGlobal('BusCacheStops', pool);      // partial, not dated, so it's fetched again next time
  }
  var seq = get('BusTempFetchSeq');
  if (seq && seq !== '[]') setGlobal('BusCacheSeq', seq);
  setGlobal('BusTempFetchStops', '');
  setGlobal('BusTempFetchSeq', '');
}
