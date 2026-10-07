// Distance in metres between two points (flat-earth approximation: accurate to well under 1% over a
// few kilometres, which is all this ever measures)
function metres(aLat, aLon, bLat, bLon) {
  var r = Math.PI / 180; var x = (bLon - aLon) * r * Math.cos((aLat + bLat) / 2 * r); var y = (bLat - aLat) * r;
  return Math.sqrt(x * x + y * y) * 6371000;
}
// Compass bearing from the first point to the second, in degrees (0 = north, 90 = east)
function bearingTo(aLat, aLon, bLat, bLon) {
  var r = Math.PI / 180;
  return Math.atan2(Math.sin((bLon - aLon) * r) * Math.cos(bLat * r),
    Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos((bLon - aLon) * r)) / r;
}
