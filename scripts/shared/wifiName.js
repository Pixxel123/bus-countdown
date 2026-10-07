// The Wi-Fi network you're on, from Android's answer (busssid, read by the task's Java steps just
// before), without the quotes Android adds; '' when not connected (Android says "<unknown ssid>")
function wifiName() {
  var raw = (typeof busssid === 'undefined' || String(busssid).charAt(0) === '%') ? '' : String(busssid);
  var name = raw.replace(/^"|"$/g, '').trim();
  return /^<unknown ssid>$|^0x$/i.test(name) ? '' : name;
}
