// Trip recorder (Settings: Record trips, BusRecord on). Each call adds one line of JSON to a file in
// Download: bus-trip-Mon.jsonl to bus-trip-Sun.jsonl, so a week is kept and each day's file is
// started afresh when that weekday comes round again. Everything stays on the phone until you upload
// it. kind: what happened (pos, decision, tfl, start, end, buzz); data: its details.
function record(kind, data) {
  if (global('BusRecord') !== 'on' || typeof writeFile !== 'function') return;
  var d = new Date(); var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  var file = 'Download/bus-trip-' + day + '.jsonl';
  var today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  var fresh = global('BusRecordDay') !== today;            // first line today: start the file afresh
  if (fresh) setGlobal('BusRecordDay', today);
  var line = JSON.stringify(Object.assign({ t: d.getTime(), k: kind }, data || {}));
  // Each day's file starts with your setup (saved stops, routes, the route lists, home and work, the
  // settings that shape decisions), so a recorded day can be replayed later (npm run replay)
  if (fresh) {
    var keep = ['BusPlaces', 'BusRoutes', 'BusNearRadius', 'BusRadius', 'BusApproach', 'BusApproachMin', 'BusLeaveShow', 'BusHomeWifi', 'BusWorkWifi',
      'BusHomeAt', 'BusWorkAt', 'BusTimeout', 'BusRefresh', 'BusCacheStops', 'BusCacheSeq'];
    var setup = {}; keep.forEach(function (n) { var v = global(n); if (v !== undefined && v !== null && String(v).charAt(0) !== '%') setup[n] = String(v); });
    line = JSON.stringify({ t: d.getTime(), k: 'setup', vars: setup }) + '\n' + line;
  }
  try { writeFile(file, line + '\n', !fresh); } catch (e) {}
}
