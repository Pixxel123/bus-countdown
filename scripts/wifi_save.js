/* ==================================================================
   Bus Wake and Bus Moved · Remember which Wi-Fi network you're on
   These two tasks read it from Android (the Java steps just before
   this). Everything else uses this saved copy, BusStateWifi, instead
   of asking again. A change goes in the trip recorder, so a recording
   shows when you left the office or got home (for timing the walk to
   the stop).
   ================================================================== */
/* @include wifiName */
/* @include record */
var wifiBefore = global('BusStateWifi') || '';
var wifiNow = wifiName();
setGlobal('BusStateWifi', wifiNow);
if (wifiNow !== wifiBefore) {
  var wifiRole = function (n) { return !n ? 'none' : n === global('BusHomeWifi') ? 'home' : n === global('BusWorkWifi') ? 'work' : 'other'; };
  record('wifi', { from: wifiRole(wifiBefore), to: wifiRole(wifiNow) });
}
