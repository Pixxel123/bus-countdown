// Trip recorder (Settings: Record trips, BusRecord on). Each call adds one line of JSON for a file in
// Download/Tasker-bus-trip-data (Downloads in the Files app): bus-trip-Mon.jsonl to
// bus-trip-Sun.jsonl, so a week is kept and each day's file is
// started afresh when that weekday comes round again. Everything stays on the phone until you upload
// it. kind: what happened (pos, decision, tfl, start, end, buzz); data: its details.
// The script doesn't write the file itself (4.43). Tasker runs a script's writeFile as a task of its
// own, and a script waiting on it while another script was running hung both for 45 s (a long press
// on the island just as the screen came on, Thursday 8 Oct). So the lines are collected here, and the
// steps straight after the script write them (record_steps in build/assemble.py): busrecfile,
// busrecline (the lines), busrecappend (false: start the file afresh) and busrecday (the day the
// file starts, kept once it's written). Declared without a value, so a script that includes this
// after its first record() doesn't lose what was collected.
var busrecline;
var busrecfile;
var busrecappend;
var busrecday;
function record(kind, data) {
  if (global('BusRecord') !== 'on') return;
  var d = new Date(); var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  var line = JSON.stringify(Object.assign({ t: d.getTime(), k: kind }, data || {}));
  if (busrecline) { busrecline += '\n' + line; return; }
  busrecfile = 'Download/Tasker-bus-trip-data/bus-trip-' + day + '.jsonl';
  busrecday = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  // The day only counts as started once its first line is really written: if that fails, the next
  // line tries again from scratch, with the setup (4.38)
  var fresh = global('BusRecordDay') !== busrecday;
  busrecappend = fresh ? 'false' : 'true';
  // Each day's file starts with your setup (saved stops, routes, the route lists, home and work, the
  // settings that shape decisions), so a recorded day can be replayed later (npm run replay)
  if (fresh) {
    var keep = ['BusPlaces', 'BusRoutes', 'BusNearRadius', 'BusRadius', 'BusApproach', 'BusApproachMin', 'BusLeaveShow', 'BusHomeWifi', 'BusWorkWifi',
      'BusHomeAt', 'BusWorkAt', 'BusTimeout', 'BusRefresh', 'BusCacheStops', 'BusCacheSeq'];
    var setup = {}; keep.forEach(function (n) { var v = global(n); if (v !== undefined && v !== null && String(v).charAt(0) !== '%') setup[n] = String(v); });
    line = JSON.stringify({ t: d.getTime(), k: 'setup', vars: setup }) + '\n' + line;
  }
  busrecline = line;
}
