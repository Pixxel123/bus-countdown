// The island's right half, fitted to its times (4.46). Used by Bus Refresh, to decide when the island
// needs to grow or may shrink, and by the island's builder, to size it.
//   textWidth(text, font): measured with the phone's own font (a rough guess if it can't measure)
//   dotsWidth(n): the route dots, with 10 dp of space before them so they never touch the times
//   rightNeeded(buses, now): the widest any route's times are right now ("5 · 17 min", "Due",
//     "~6 min"), as the island shows them (see rightHtml in island_show.js), plus 4 dp and the dots:
//     the room the right half needs
//   boardWidths(island, rows, keys, at): the stop board's halves (4.47): the island's, or a little
//     wider when its lines need it: room for three times on a route ("12 · 24 · 37 min") and for a
//     route badge wider than the island's, but never closer than 8 dp to the screen's edges.
//     island: { left, right }; rows: [{ t: [times], st, sts }]; keys: the routes; at: { cam (the
//     camera's middle), screen (its width), gap, pad, letters, now }
function textWidth(t, font) {
  try {
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font || '700 14px system-ui, Roboto, sans-serif';   // default: the island's minutes
    return Math.ceil(ctx.measureText(t).width);
  } catch (e) { return Math.ceil(t.length * 8.4); }                // rough fallback
}
function dotsWidth(n) { return n > 1 ? 10 + n * 4 + (n - 1) * 3 : 0; }
function rightNeeded(buses, now) {
  var SMALL = '600 11px system-ui, Roboto, sans-serif';
  var fitMins = function (t) { var m = Math.round((t - now) / 60000); return m < 1 ? 'Due' : String(m); };
  var widest = textWidth('Due');
  (buses || []).forEach(function (b) {
    var st = b.st || 'live';
    var first = fitMins(b.t);
    var pre = st === 'sched' ? '~' : '';
    var w;
    if (st === 'sched' && first === 'Due') first = '1';
    if (st === 'cancel') w = textWidth('Cancelled');
    else if (b.t2 !== undefined) {
      var m2 = fitMins(b.t2); if (m2 === 'Due') m2 = '1';
      w = textWidth(pre + first) + textWidth(' \u00b7 ' + (b.st2 === 'sched' ? '~' : '') + m2 + ' min', SMALL);
    } else w = textWidth(pre + (first === 'Due' ? 'Due' : first + ' min'));
    if (w > widest) widest = w;
  });
  return widest + 4 + dotsWidth((buses || []).length);
}
function boardWidths(island, rows, keys, at) {
  var SMALL = '600 12px system-ui, Roboto, sans-serif';      // the board's quieter times (.bl .m2)
  var right = textWidth('Due');
  (rows || []).forEach(function (r) {
    if (!r.t || !r.t.length) return;
    var st = r.st || 'live';
    var pre = st === 'sched' ? '~' : '';
    var first = Math.round((r.t[0] - at.now) / 60000);
    first = first < 1 ? (st === 'sched' ? '1' : 'Due') : String(first);
    var rest = r.t.slice(1, 3).map(function (t, i) {
      var m = Math.round((t - at.now) / 60000);
      return ((r.sts && r.sts[i + 1] === 'sched') ? '~' : '') + (m < 1 ? '1' : String(m));
    });
    var w = rest.length ? textWidth(pre + first) + textWidth(' \u00b7 ' + rest.join(' \u00b7 ') + ' min', SMALL)
      : textWidth(pre + (first === 'Due' ? 'Due' : first + ' min'));
    if (w > right) right = w;
  });
  // A line's left half: its badge, then enough of its destination (BusDestLetters letters)
  var dest = textWidth('Sutton Road Station'.slice(0, at.letters || 3) + '\u2026', '400 12.5px system-ui, Roboto, sans-serif');
  var left = 0;
  (keys || []).forEach(function (k) { left = Math.max(left, textWidth(String(k), '700 13px system-ui, Roboto, sans-serif') + 14 + 6 + dest + 2); });
  var roomLeft = Math.floor(at.cam - at.gap / 2 - at.pad - 8);
  var roomRight = Math.floor(at.screen - at.cam - at.gap / 2 - at.pad - 8);
  return { left: Math.max(island.left, Math.min(left, roomLeft)), right: Math.max(island.right, Math.min(right + 4, roomRight)) };
}
