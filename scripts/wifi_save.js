/* ==================================================================
   Bus Wake and Bus Moved · Remember which Wi-Fi network you're on
   These two tasks read it from Android (the Java steps just before
   this). Everything else uses this saved copy, BusStateWifi, instead
   of asking again. A change goes in the trip recorder, so a recording
   shows when you left the office or got home (for timing the walk to
   the stop). Coming off home or work Wi-Fi is kept with its time
   (BusStateWifiLeftAt: { place, at }, 4.64; until 4.65 { p, t }).
   ================================================================== */
/* @include wifiName */
/* @include record */
// What a network is to you: home, work, another, or none
function wifiRole(name) { return !name ? 'none' : name === global('BusHomeWifi') ? 'home' : name === global('BusWorkWifi') ? 'work' : 'other'; }
var wifiBefore = global('BusStateWifi') || '';
var wifiNow = wifiName();
setGlobal('BusStateWifi', wifiNow);
if (wifiNow !== wifiBefore) {
  var roles = { from: wifiRole(wifiBefore), to: wifiRole(wifiNow) };
  record('wifi', roles);
  // Just came off home or work Wi-Fi (4.64): which, and when, so Bus Watch can tell a drop while you're
  // still there from leaving (BusStateWifiLeftAt)
  if (roles.from === 'home' || roles.from === 'work') setGlobal('BusStateWifiLeftAt', JSON.stringify({ place: roles.from, at: Date.now() }));
}
