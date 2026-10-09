// The island's right half, fitted to its times (4.46). Used by Bus Refresh, to decide when the island
// needs to grow or may shrink, and by the island's builder, to size it.
//   textWidth(text, font): measured with the phone's own font (a rough guess if it can't measure)
//   dotsWidth(n): the route dots, with 10 dp of space before them so they never touch the times
//   rightNeeded(buses, now): the widest any route's times are right now ("5 · 17 min", "Due",
//     "~6 min"), as the island shows them (see rightHtml in island_show.js), plus 4 dp and the dots:
//     the room the right half needs
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
