// Debugging: keep the last 20 decisions in BusDebugLog (copied by the Bus Debugging task).
// A repeat of the previous entry, apart from numbers, is skipped.
function debugLog(msg) {
  var a = []; try { a = JSON.parse(global('BusDebugLog') || '[]'); } catch (e) {}
  var plain = function (t) { return String(t).replace(/^\S+ /, '').replace(/[\d.]+/g, '#'); };
  if (a.length && plain(a[a.length - 1]) === plain('x ' + msg)) return;
  a.push(new Date().toTimeString().slice(0, 8) + ' ' + msg);
  setGlobal('BusDebugLog', JSON.stringify(a.slice(-20)));
}
