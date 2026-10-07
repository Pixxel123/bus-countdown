/* ==================================================================
   Route stops cache · Keep this route's stops in order (one direction)
   From TfL's /Line/{route}/Route/Sequence/{direction}: each sequence is
   the stops in the order the bus calls at them, as [id, lat, lon]. Used
   to tell which side of a road heads towards home or work.
   ================================================================== */
/* @include loc */
var code = loc('http_response_code');
if (code === '200') {
  var all = JSON.parse(global('BusTempFetchSeq') || '[]');
  (JSON.parse(http_data).stopPointSequences || []).forEach(function (sq) {
    var list = (sq.stopPoint || []).map(function (p) { return [p.id || p.stationId, +(+p.lat).toFixed(5), +(+p.lon).toFixed(5)]; });
    if (list.length > 1) all.push(list);
  });
  setGlobal('BusTempFetchSeq', JSON.stringify(all));
}
