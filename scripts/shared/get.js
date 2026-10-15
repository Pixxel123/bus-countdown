// A Tasker global variable, trimmed, or '' if it isn't set (Tasker leaves an unset variable as its own
// name, starting with %)
function get(n) { var v = global(n); return (v === undefined || v === null || String(v).charAt(0) === '%') ? '' : String(v).trim(); }
// A global variable holding JSON, read (4.63): fallback when it's empty, isn't JSON, or is JSON's null
function getJSON(n, fallback) {
  var raw = get(n); var v = null;
  if (!raw) return fallback;
  try { v = JSON.parse(raw); } catch (e) { return fallback; }
  return v === null || v === undefined ? fallback : v;
}
