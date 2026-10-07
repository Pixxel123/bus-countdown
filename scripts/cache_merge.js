/* ==================================================================
   Route stops cache · Add this route's stops to BusTempFetchStops
   BusTempFetchStops: { naptanId: { n: name, a: lat, o: lon, r: [routes], t: towards } }
   ("towards" tells stops with the same name on either side of a road apart)
   ================================================================== */
/* @include loc */
var code = loc('http_response_code');
if (code !== '200') {
  setGlobal('BusTempFetchFailed', '1');
} else {
  var pool = JSON.parse(global('BusTempFetchStops') || '{}');
  JSON.parse(http_data).forEach(function (s) {
    if (s.stopType && s.stopType !== 'NaptanPublicBusCoachTram') return;    // skip stands and other types
    var name = String(s.commonName + (s.indicator ? ' (' + s.indicator + ')' : '')).replace(/\s*,\s*/g, ' ');
    var towards = '';
    (s.additionalProperties || []).forEach(function (p) { if (p.key === 'Towards' && p.value) towards = String(p.value); });
    var e = pool[s.naptanId] || { n: name, a: s.lat, o: s.lon, r: [], t: towards };
    if (!e.t && towards) e.t = towards;
    if (e.r.indexOf(busroute) < 0) e.r.push(busroute);
    pool[s.naptanId] = e;
  });
  setGlobal('BusTempFetchStops', JSON.stringify(pool));
}
