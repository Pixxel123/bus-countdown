/* ==================================================================
   Bus Refresh · Build the island (only when it first appears)
   The island is a small web page inside a Scene V2 WebView. The page
   does its own rotating, countdown border, swipes and presses; Tasker
   only feeds it data through the global BusStateIslandData.
   Output: buslayout (the Scene V2 layout), busx / busy (its left edge
           and top), busww / bush (its width and height), all used by the
           Show Scene V2 action that follows
   ================================================================== */
// Bus Settings' preview passes unsaved slider values as busprevgap / busprevy,
// and its own sample departures in the global named by busdatavar
/* @include get */
/* @include loc */
/* @include routesHere */
var DATA_VAR = loc('busdatavar') || 'BusStateIslandData';
var PREVIEW = DATA_VAR !== 'BusStateIslandData';
// Show as Status bar (BusStyle = chip): the same page and gestures, drawn as a small chip in the
// status bar to the right of the clock (BusChipX dp from the left), with the route and minutes only
var CHIP = global('BusStyle') === 'chip';
var H = CHIP ? 24 : (parseInt(global('BusIslandH'), 10) || 30);                   // island height (30 unless BusIslandH is set)
var GAP = CHIP ? 13 : (parseInt(loc('busprevgap') || global('BusIslandGap'), 10) || 42);   // space over the camera
var PAD = Math.round(H * 0.3);                          // inner padding at each end
var LEFT = 40;                                          // left half: set below, once the data is read

/* ---- Right half: always the same width -------------------------------
   Measured with the phone's own font: room for the widest the times can
   be ("~88 · ~88 min"), plus a dot for each of your routes at this stop
   (routesHere), whether or not TfL has a time for it right now. So during
   a countdown the size never changes: only switching to a stop with a
   different number of your routes does (Bus Refresh then shows it again). */
var showingNow = 1;
try { showingNow = JSON.parse(global(DATA_VAR)).b.length; } catch (e) {}
var routes = PREVIEW ? Math.max(1, showingNow) : routesHere(showingNow);
function textWidth(t, font) {
  try {
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font || '700 14px system-ui, Roboto, sans-serif';   // default: the island's minutes
    return Math.ceil(ctx.measureText(t).width);
  } catch (e) { return Math.ceil(t.length * 8.4); }                // rough fallback
}
// Room for two two-digit times ("88 · 88 min", the second smaller), so the size never changes for
// times. Rarer, wider combinations (timetable "~" on both) show just the first time instead: the page
// drops the second time whenever it wouldn't fit, so nothing is ever cut off. (4.14 reserved room for
// "~88 · ~88 min", which made the island far wider than it usually needs to be.)
var RIGHT = Math.max(textWidth('~88 min'), textWidth('88') + textWidth(' \u00b7 88 min', '600 11px system-ui, Roboto, sans-serif')) + 4 +
  (routes > 1 ? 6 + routes * 4 + (routes - 1) * 3 : 0);
// The stop letter's ring: on the island it takes room from the destination; the chip grows to fit it
var letter = '';
try { letter = String(JSON.parse(global(DATA_VAR)).l || ''); } catch (e) {}
var ringW = letter ? Math.max(16, Math.ceil(textWidth(letter) * 10 / 14) + 9) + 6 : 0;   // ring + its gap
var longest = '';
try { JSON.parse(global(DATA_VAR)).b.forEach(function (x) { if (String(x.k).length > longest.length) longest = String(x.k); }); } catch (e) {}
if (CHIP) {
  // Left part: stop letter (if any) and the route badge, as wide as the longest route name
  LEFT = Math.ceil(textWidth(longest || '888') * 12 / 14) + 16 + ringW;
} else {
  // Left half: stop letter, route badge, and enough of the destination to recognise it at a glance:
  // BusDestLetters letters (3 by default; 6 or 10 in Settings), measured in the destination's font
  var letters = parseInt(global('BusDestLetters'), 10) || 3;
  var badgeW = Math.ceil(textWidth(longest || '888', '700 13px system-ui, Roboto, sans-serif')) + 14;
  var destW = Math.ceil(textWidth('Sutton Road Station'.slice(0, letters) + '\u2026', '400 12px system-ui, Roboto, sans-serif'));
  LEFT = Math.max(40, ringW + badgeW + 6 + destW + 2);
}
if (!PREVIEW) setGlobal('BusStateIslandShape', (CHIP ? 'c' : 'i') + routes + (letter ? 'L' + letter.length : ''));

/* ---- Where the window goes ------------------------------------------
   The window is only as wide as the island, so it isn't symmetrical and
   can't simply be centred. Its left edge is placed so the gap sits in the
   middle of the camera: BusCameraX, found by Bus Find Camera, or the middle of
   the screen if it hasn't been found. BusScreenW (also from Bus Find Camera)
   overrides the screen width this script's web view measures. */
var screenW = parseInt(global('BusScreenW'), 10) || (typeof screen !== 'undefined' && Math.round(screen.width)) || 448;
if (!PREVIEW) setGlobal('BusStateScreenW', String(screenW));
var busww = String(PAD + LEFT + GAP + RIGHT + PAD);                          // window width, dp
var camX = parseInt(global('BusCameraX'), 10) || screenW / 2;            // camera centre (Bus Find Camera finds it)
var busx = String(Math.round(camX - GAP / 2 - LEFT - PAD));               // window's left edge, dp: gap over the camera
if (CHIP) busx = String(parseInt(global('BusChipX'), 10) >= 0 ? parseInt(global('BusChipX'), 10) : 76);   // right of the clock
// Where the window goes (read by the Show Scene V2 action that follows)
var yWanted = loc('busprevy') || global('BusIslandY');
var busy = String(parseInt(yWanted, 10) >= 0 ? parseInt(yWanted, 10) : 9);  // dp from the top
if (CHIP) busy = String(parseInt(busy, 10) + 3);                            // centred on the same line as the island
var bush = String(H);

/* ---- The island's web page ----------------------------------------
   {{TOKENS}} are filled in below. The page must never contain a
   percent sign followed by letters except the data placeholder, or
   Tasker would treat it as a variable. */
var PAGE = String.raw`<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  /* Transparent page: the black island is the only thing drawn */
  html, body { margin: 0; height: {{H}}px; width: {{TOTAL}}px; background: transparent; overflow: hidden;
               -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
  body { font-family: system-ui, Roboto, sans-serif; }

  /* The island: left half | camera gap | right half */
  /* Status bar chip: route badge and minutes only, a little smaller */
  body.chip .d { display: none; }
  body.chip .b { font-size: 12px; padding: 0 6px; }
  body.chip .m { font-size: 13px; }
  /* A fixed width, the same as the window's: as a plain flex box it stretched to the web page's
     width, which can be wider than the window, so its rounded right end was cut off */
  #p { position: relative; display: flex; align-items: center; height: {{H}}px; width: {{TOTAL}}px; box-sizing: border-box;
       padding: 0 {{PAD}}px; border-radius: {{RADIUS}}px; background: #000; color: #fff;
       font-size: 14px; white-space: nowrap; touch-action: none; }
  .h { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden;
       transition: opacity .18s, transform .18s; }
  #L { flex: none; width: {{LEFT}}px; }   /* route + destination: fixed width */
  #g { flex: none; width: {{GAP}}px; }    /* empty, sits over the camera */
  /* Status bar chip: a thin pipe between the route and the minutes */
  body.chip #g { display: flex; justify-content: center; }
  body.chip #g::before { content: ''; width: 1px; height: 12px; background: rgba(255,255,255,.45); }
  #R { flex: none; width: {{RIGHT}}px; }  /* minutes + dots: just wide enough (see RIGHT above) */
  #p.out .h  { opacity: 0; transform: translateX(-6px); }   /* slide to next route */
  #p.back .h { opacity: 0; transform: translateX(6px); }    /* slide to previous */

  /* Countdown border: an SVG outline laid over the island */
  #ring { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
  #ring.off { display: none; }                  /* BusBorder is off (the default) */

  .b { background: #DC241F; border-radius: 99px; padding: 1px 7px; font-weight: 700; font-size: 13px; flex: none; } /* route badge */
  /* Stop letter: a white ring like the circle on TfL's stop flags; wider for two letters */
  .sl { flex: none; box-sizing: border-box; min-width: 18px; height: 18px; padding: 0 4px; border: 1.5px solid #fff;
        border-radius: 9px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  body.chip .sl { min-width: 16px; height: 16px; font-size: 10px; padding: 0 3px; border-radius: 8px; }
  .d { color: #B7BFCD; font-size: 12px; overflow: hidden; text-overflow: ellipsis; min-width: 0; }             /* destination */
  .m { font-weight: 700; flex: none; }          /* minutes */
  .m.due { color: #7FD6A4; }
  .m.old { opacity: .45; }                                  /* no fresh times for 2 refreshes */
  .m.sched { color: #9AA3B5; font-weight: 600; }            /* timetable, not live */
  .m2 { flex: none; margin-left: -2px; font-size: 11px; font-weight: 600; color: #9AA3B5; white-space: pre; }   /* "· 12 min": the bus after */
  .m.late { color: #F2C66B; }  .m.cancel { color: #FF8A80; }  /* ready for trains (V5) */
  .d.sched { font-style: italic; }
  .s { font-weight: 700; overflow: hidden; text-overflow: ellipsis; min-width: 0; }  /* stop name flash, "No buses" */
  /* Minutes start at a fixed spot just past the camera, and the dots sit at the far right: as
     routes rotate, "5 min" and "12 min" start in the same place and the dots don't jump */
  .dots { display: flex; gap: 3px; flex: none; margin-left: auto; }
  .dots i { width: 4px; height: 4px; border-radius: 2px; background: #5A6376; }
  .dots i.on { background: #fff; }

</style>
</head>
<body class="{{SHAPE}}">
<!-- Tasker replaces this with the live bus data, and again on every refresh -->
<div id="d" hidden>{{DATA}}</div>
<div id="p">
  <svg id="ring"><rect id="track"/><rect id="prog"/></svg>
  <div class="h" id="L"></div><div id="g"></div><div class="h" id="R"></div>
</div>
<script>
  // Fixed when the island first appears
  var LEFT = {{LEFT}}, GAP = {{GAP}}, PAD = {{PAD}};
  var HOLD = 550;             // ms held = long press
  var DEFAULT_ROTATE = 6000;  // ms per route if the data doesn't say

  var data = null, raw = '', idx = 0, start = Date.now(), lastStop = null, flashUntil = 0;
  function $(id) { return document.getElementById(id); }
  var dataEl = $('d'), p = $('p'), L = $('L'), R = $('R'), ring = $('ring'), track = $('track'), prog = $('prog');
  var BORDER = {{BORDER}};                        // countdown border on or off (setting BusBorder)
  if (!BORDER) ring.classList.add('off');

  function buses() { return data && data.b ? data.b : []; }
  function rotateMs() { return (data && data.rot) || DEFAULT_ROTATE; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function mins(ms) { var m = Math.round((ms - Date.now()) / 60000); return m < 1 ? 'Due' : m + ' min'; }
  var IS_PREVIEW = {{PREVIEW}};  // Bus Settings' preview: gestures do nothing
  // Tasks started from the island get busfrom=island, so they give a short vibration
  // (Android's web view ignores navigator.vibrate, so Tasker's Vibrate action does it)
  function runTask(name, vars) {
    if (IS_PREVIEW || !window.Tasker || !Tasker.runTask) return;
    Tasker.runTask({ name: name, variables: vars || { busfrom: 'island' } });
  }

  /* New data from Tasker */
  function read() {
    var t = dataEl.textContent.trim();
    if (t === raw) return;
    raw = t;
    try { data = JSON.parse(t); } catch (e) { return; }
    if (data.s !== lastStop) {        // stop changed: flash its name, restart at the first route
      if (lastStop !== null) { flashUntil = Date.now() + 1200; setTimeout(draw, 1250); }
      lastStop = data.s;
      idx = 0;
    }
    if (idx >= buses().length) idx = 0;
    start = Date.now();
    draw();
  }

  /* Right half: minutes, plus one dot per route when there are several */
  function rightHtml(b, active, oneTime) {
    var n = buses().length, m = mins(b.t), dots = '', st = b.st || 'live';
    if (st === 'sched' && m === 'Due') m = '1 min';           // a timetable can't say "due"
    if (st === 'cancel') m = 'Cancelled';
    var cls = st === 'live' ? (m === 'Due' ? ' due' : '') : ' ' + st;
    // Times more than two refreshes old: dimmed, so stale times don't look live
    if (data && data.u && Date.now() - data.u > 2 * (data.r || 45000)) cls += ' old';
    if (st === 'sched') m = '~' + m;
    if (n > 1) {
      dots = '<span class="dots">';
      for (var i = 0; i < n; i++) dots += '<i' + (i === active ? ' class="on"' : '') + '></i>';
      dots += '</span>';
    }
    // The bus after this one on the same route, quieter: "5 · 12 min"
    if (b.t2 !== undefined && st !== 'cancel' && !oneTime) {
      var first = m.replace(/ min$/, ''), m2 = mins(b.t2).replace(/ min$/, '');
      if (m2 === 'Due') m2 = '1';
      return '<span class="m' + cls + '">' + first + '</span><span class="m2">\u00b7 ' + (b.st2 === 'sched' ? '~' : '') + m2 + ' min</span>' + dots;
    }
    return '<span class="m' + cls + '">' + m + '</span>' + dots;
  }

  /* The island fills its whole window (PAD + LEFT | GAP | RIGHT + PAD).
     The window is placed so the gap sits over the camera; see busx above.
     (Leaving part of a wider window uncovered showed as black on the phone.) */

  function draw() {
    if (Date.now() < flashUntil) {    // "Stop B" | "High Street"
      var name = (data && data.n) || '', parts = name.match(/^(.*) \((.*)\)$/);
      L.innerHTML = '<span class="s">' + esc(parts ? parts[2] : name) + '</span>';
      R.innerHTML = '<span class="s">' + esc(parts ? parts[1] : '') + '</span>';
      drawRing();
      return;
    }
    var list = buses();
    if (!list.length) {
      L.innerHTML = '<span class="s">No buses</span>';
      R.innerHTML = '';
    } else {
      var b = list[idx];
      L.innerHTML = (data && data.l ? '<span class="sl">' + esc(data.l) + '</span>' : '') +
                    '<span class="b">' + esc(b.k) + '</span><span class="d' + (b.st === 'sched' ? ' sched' : '') + '">' + esc(b.d) + '</span>';
      R.innerHTML = rightHtml(b, idx);
      if (R.scrollWidth > R.clientWidth + 1) R.innerHTML = rightHtml(b, idx, true);   // too wide: just the first time
    }
    drawRing();
  }

  /* Outline the island; the progress line is shortened in tick() */
  function drawRing() {
    var w = p.offsetWidth, h = p.offsetHeight;
    ring.setAttribute('width', w); ring.setAttribute('height', h);
    ring.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    [track, prog].forEach(function (r) {
      r.setAttribute('x', 1); r.setAttribute('y', 1);
      r.setAttribute('width', w - 2); r.setAttribute('height', h - 2); r.setAttribute('rx', (h - 2) / 2);
      r.setAttribute('fill', 'none'); r.setAttribute('stroke-width', 1.5); r.setAttribute('pathLength', 100);
    });
    track.setAttribute('stroke', 'rgba(255,255,255,0.10)');
    prog.setAttribute('stroke', 'rgba(255,255,255,0.8)');
    prog.setAttribute('stroke-dasharray', '100 100');
  }

  /* Move to the next (1) or previous (-1) route */
  function go(step) {
    var n = buses().length;
    if (n < 2) return;
    idx = (idx + step + n) % n;
    var cls = step > 0 ? 'out' : 'back';
    p.classList.add(cls);
    setTimeout(function () { draw(); p.classList.remove(cls); }, 180);
    start = Date.now();
  }

  /* Drain the border. Several routes: time until the next route. One route:
     time until the next refresh. To save battery this runs 4 times a second
     (several routes) or once a second (one route) rather than every frame,
     with a matching CSS transition so it still looks smooth, and not at all
     while the screen is off. */
  function tick() {
    var several = buses().length > 1;
    var step = several ? 250 : 1000;
    if (!document.hidden) {
      var total = several ? rotateMs() : ((data && data.r) || 45000);
      if (!BORDER) { if (several && Date.now() - start >= total) go(1); setTimeout(tick, step); return; }
      var from = several ? start : ((data && data.u) || start);
      var left = Math.max(0, Math.min(1, 1 - (Date.now() - from + step) / total));
      prog.style.transition = 'stroke-dashoffset ' + step + 'ms linear';
      prog.setAttribute('stroke-dashoffset', String(100 - 100 * left));
      if (several && Date.now() - start >= total) go(1);
    }
    setTimeout(tick, step);
  }

  /* Gestures (only on the island itself):
       short swipe left/right = next/previous route
       long swipe left/right  = Bus End (dismiss): 90 dp, or 60 dp if fast
                                (decideSwipe, shared with scripts/swipe.js); the
                                island follows your finger and fades, and gives a
                                small buzz once the swipe is long enough
       long press             = the next nearby stop (Bus Island)
     Pointer capture keeps following the finger after it leaves the 30 dp
     island, and a gesture is judged on release OR cancel (Android can cancel
     a touch near the top of the screen). */
  /* ==================================================================
     The island · What a sideways swipe means
     Shared, word for word, by the island's page (island_show.js) and the
     tests. dx: sideways movement in dp (negative = left); ms: how long it
     took. Route change: from 24 dp. Dismiss: from 90 dp, or from 60 dp if
     it's a fast fling (0.6 dp per ms or more). Anything shorter: nothing.
     Returns 'next', 'previous', 'dismiss' or 'none'.
     ================================================================== */
  /* @include swipe */
  var sx = 0, sy = 0, lx = 0, ly = 0, t0 = 0, down = false, held = false, armed = false, holdTimer = null;
  function follow(dx) {                  // past 24 dp the island follows your finger, fading towards 90 dp
    var past = Math.max(0, Math.abs(dx) - 24) * (dx < 0 ? -1 : 1);
    p.style.transition = 'none';
    p.style.transform = 'translateX(' + Math.max(-120, Math.min(120, past)) + 'px)';
    p.style.opacity = String(Math.max(0.35, 1 - Math.max(0, Math.abs(dx) - 24) / 110));
  }
  function settle() { p.style.transition = 'transform .15s, opacity .15s'; p.style.transform = ''; p.style.opacity = '1'; }
  function judge() {
    clearTimeout(holdTimer);
    if (!down) return;
    down = false;
    var dx = lx - sx, dy = ly - sy, wasArmed = armed;
    armed = false;
    settle();
    if (held) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;                  // mostly up or down: not a swipe
    var what = decideSwipe(dx, Date.now() - t0);
    if (what === 'dismiss') runTask('Bus End');
    else if (what === 'next') go(1);
    else if (what === 'previous') go(-1);
  }
  p.addEventListener('pointerdown', function (e) {
    sx = lx = e.clientX; sy = ly = e.clientY; t0 = Date.now(); down = true; held = false; armed = false;
    try { p.setPointerCapture(e.pointerId); } catch (err) {}
    holdTimer = setTimeout(function () {
      held = true;
      runTask('Bus Island', { busfrom: 'island', busisland: 'switch' });
    }, HOLD);
  });
  p.addEventListener('pointermove', function (e) {
    if (!down) return;
    lx = e.clientX; ly = e.clientY;
    var dx = lx - sx;
    if (Math.abs(dx) > 10 || Math.abs(ly - sy) > 10) clearTimeout(holdTimer);
    if (held) return;
    var nowArmed = decideSwipe(dx, 1e9) === 'dismiss';            // far enough to dismiss even slowly (90 dp)
    if (nowArmed && !armed) runTask('Bus Island', { busfrom: 'island', busisland: 'buzz' });                // a tick when letting go will dismiss
    armed = nowArmed;
    if (Math.abs(dx) > 10) follow(dx);
  });
  p.addEventListener('pointerup', function (e) { lx = e.clientX; ly = e.clientY; judge(); });
  p.addEventListener('pointercancel', judge);
  p.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Start: watch for new data, keep minutes current, animate the border
  new MutationObserver(read).observe(dataEl, { childList: true, characterData: true, subtree: true });
  window.addEventListener('resize', drawRing);
  setInterval(read, 1000);
  setInterval(draw, 15000);
  read();
  tick();
{{END_SCRIPT}}
</body>
</html>`;

function fill(page, values) {
  Object.keys(values).forEach(function (k) { page = page.split('{{' + k + '}}').join(String(values[k])); });
  return page;
}
var html = fill(PAGE, {
  H: H, PAD: PAD, RADIUS: H / 2, LEFT: LEFT, GAP: GAP, RIGHT: RIGHT, TOTAL: PAD + LEFT + GAP + RIGHT + PAD,
  SHAPE: CHIP ? 'chip' : 'island',
  PREVIEW: PREVIEW ? 'true' : 'false',
  BORDER: global('BusBorder') === 'on' ? 'true' : 'false',
  DATA: '%' + DATA_VAR,                      // split so Tasker doesn't fill it in here
  END_SCRIPT: '</' + 'script>'        // split for the same reason as above, for the HTML parser
});

/* ---- Scene V2 layout ----------------------------------------------
   A rounded clip at both ends of the modifier list keeps the WebView's
   corners see-through whichever way Tasker stacks modifiers. The
   WebView must not be darkened, or it paints a dark rectangle. */
var buslayout = JSON.stringify({
  name: 'Bus Pill',
  defaultDisplayMode: 'Overlay',
  root: {
    type: 'Box', id: 'root',
    modifiers: [
      { type: 'FillSize' },
      { type: 'Clip', shape: 'Rounded', radius: '50' },
      { type: 'Clip', shape: 'Rounded', radius: '50' }
    ],
    children: [{
      type: 'WebView', id: 'pillweb', content: html,
      backgroundColor: 'transparent', darkMode: 'ForceLight', supportZoom: 'false',
      modifiers: [{ type: 'FillSize' }]
    }]
  }
});
