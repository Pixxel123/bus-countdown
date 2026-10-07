// One of this task's local variables (Tasker passes them in as plain variables), trimmed, or '' if it
// isn't set
function loc(n) { try { var v = eval('typeof ' + n + ' === "undefined" ? "" : ' + n); return (v === null || String(v).charAt(0) === '%') ? '' : String(v).trim(); } catch (e) { return ''; } }
