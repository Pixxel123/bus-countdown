// Trip recorder (Settings: Record trips, BusRecord on). Each call adds one line of JSON to a file in
// Download/Tasker-bus-trip-data (Downloads in the Files app): bus-trip-Mon.jsonl to
// bus-trip-Sun.jsonl, so a week is kept and each day's file is
// started afresh when that weekday comes round again. Everything stays on the phone until you upload
// it. kind: what happened (pos, decision, tfl, start, end, buzz); data: its details.
function record(kind, data) {
  if (global('BusRecord') !== 'on' || typeof writeFile !== 'function') return;
  var d = new Date(); var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  var file = 'Download/Tasker-bus-trip-data/bus-trip-' + day + '.jsonl';
  var today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  var fresh = global('BusRecordDay') !== today;            // first line today: start the file afresh
  // The folder: Bus Start and Bus Settings create it with Tasker's Create Directory when recording is
  // on; the first line of each day also makes sure of it, in case it was deleted since
  if (fresh && typeof shell === 'function') { try { shell('mkdir -p /sdcard/Download/Tasker-bus-trip-data', false, 5); } catch (e) {} }
  var line = JSON.stringify(Object.assign({ t: d.getTime(), k: kind }, data || {}));
  // Each day's file starts with your setup (saved stops, routes, the route lists, home and work, the
  // settings that shape decisions), so a recorded day can be replayed later (npm run replay)
  if (fresh) {
    var keep = ['BusPlaces', 'BusRoutes', 'BusNearRadius', 'BusRadius', 'BusApproach', 'BusApproachMin', 'BusLeaveShow', 'BusHomeWifi', 'BusWorkWifi',
      'BusHomeAt', 'BusWorkAt', 'BusTimeout', 'BusRefresh', 'BusCacheStops', 'BusCacheSeq'];
    var setup = {}; keep.forEach(function (n) { var v = global(n); if (v !== undefined && v !== null && String(v).charAt(0) !== '%') setup[n] = String(v); });
    line = JSON.stringify({ t: d.getTime(), k: 'setup', vars: setup }) + '\n' + line;
  }
  // The day only counts as started once its first line is really written: if that fails, the next
  // line tries again from scratch (with the setup), and Bus Status says what went wrong (4.38). A new
  // file is then announced to Android's media index, or the Files app may not list it.
  try {
    writeFile(file, line + '\n', !fresh);
    setGlobal('BusRecordErr', '');
    if (fresh) {
      setGlobal('BusRecordDay', today);
      if (typeof shell === 'function') { try { shell('am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/' + file, false, 5); } catch (e) {} }
    }
  } catch (e) { setGlobal('BusRecordErr', d.toTimeString().slice(0, 5) + ' ' + String((e && e.message) || e).slice(0, 120)); }
}
