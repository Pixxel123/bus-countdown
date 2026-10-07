// A Tasker global variable, trimmed, or '' if it isn't set (Tasker leaves an unset variable as its own
// name, starting with %)
function get(n) { var v = global(n); return (v === undefined || v === null || String(v).charAt(0) === '%') ? '' : String(v).trim(); }
