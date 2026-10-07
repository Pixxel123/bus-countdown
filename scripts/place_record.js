/* ==================================================================
   Bus Moved · On home or work Wi-Fi: remember where that is
   A running average of the positions seen there (BusHomeAt,
   BusWorkAt), so which side of a road heads home or to work can be
   worked out. Inputs: gl_latitude, gl_longitude (from moved.js)
   ================================================================== */
/* @include get */
/* @include loc */
var wifi = get('BusStateWifi');
var which = wifi && wifi === get('BusHomeWifi') ? 'BusHomeAt' : wifi && wifi === get('BusWorkWifi') ? 'BusWorkAt' : '';
var lat = parseFloat(loc('gl_latitude')); var lon = parseFloat(loc('gl_longitude'));
if (which && !isNaN(lat) && !isNaN(lon)) {
  var at = null; try { at = JSON.parse(get(which) || 'null'); } catch (e) {}
  var n = at && at.n ? Math.min(at.n, 9) : 0;
  at = n ? { lat: (at.lat * n + lat) / (n + 1), lon: (at.lon * n + lon) / (n + 1), n: n + 1 } : { lat: lat, lon: lon, n: 1 };
  setGlobal(which, JSON.stringify({ lat: +at.lat.toFixed(6), lon: +at.lon.toFixed(6), n: at.n }));
}
