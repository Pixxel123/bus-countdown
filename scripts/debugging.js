/* ==================================================================
   Bus Status (Debugging) · Everything useful for tracking down a problem
   Status (from status.js, run just before) and the last 20 decisions,
   ready to paste. Bus Status copies it to the clipboard every time.
   Output: busdebug, busshown (the status, saying it's been copied)
   ================================================================== */
/* @include loc */
var a = []; try { a = JSON.parse(global('BusDebugLog') || '[]'); } catch (e) {}
var status = loc('busstatus');
var busdebug = 'BUS COUNTDOWN ' + (global('BusStateVersion') || '?') + ' DEBUGGING, ' + new Date().toString().slice(0, 24) +
  '\n\nSTATUS\n' + status + '\n\nLAST DECISIONS (newest last)\n' + (a.length ? a.join('\n') : 'none yet');
var busshown = status + '\n\nCopied to the clipboard, with the last 20 decisions.';
