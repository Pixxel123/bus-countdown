/* ==================================================================
   Bus Refresh · Build the island (only when it first appears)
   The island is a small web page inside a Scene V2 WebView. The page
   does its own rotating, countdown border, swipes and presses; Tasker
   only feeds it data through the global BusStateIslandData.
   Output: buslayout (the Scene V2 layout), busx / busy (its left edge
           and top), busww / bush (its width and height), all used by the
           Show Scene V2 action that follows; and, except for Bus Settings'
           preview, busnewscene / busoldscene (which scene name to show it
           under, and which to remove afterwards)
   ================================================================== */
// Bus Settings' preview passes unsaved slider values as busprevgap / busprevy,
// and its own sample departures in the global named by busdatavar
/* @include get */
/* @include loc */
/* @include routesHere */
/* @include islandFit */
/* @include boardRows */
var DATA_VAR = loc('busdatavar') || 'BusStateIslandData';
var PREVIEW = DATA_VAR !== 'BusStateIslandData';
// Show as Status bar (BusStyle = chip): the same page and gestures, drawn as a small chip in the
// status bar to the right of the clock (BusChipX dp from the left), with the route and minutes only
var CHIP = global('BusStyle') === 'chip';
var H = CHIP ? 24 : (parseInt(global('BusIslandH'), 10) || 30);                   // island height (30 unless BusIslandH is set)
var GAP = CHIP ? 13 : (parseInt(loc('busprevgap') || global('BusIslandGap'), 10) || 42);   // space over the camera
var PAD = Math.round(H * 0.3);                          // inner padding at each end
// The stop board (4.42): a tap on the island opens it below the island, as wide or a little wider (4.47), with every
// bus at the stop by route: yours first, in Settings order, then the stop's other routes, soonest
// first (Bus Refresh's data.a), up to 8 lines. Bus Island keeps whether it's open in BusStateBoard and
// shows the island again; Bus Settings' preview asks for it with busboard = yes. Not for the status
// bar chip. BusBoardRoutes = mine leaves the other routes out; BusBoardSecs is how long it stays open
// (10 s unless set; 0 = until you tap it again).
var BOARD = !CHIP && (PREVIEW ? loc('busboard') === 'yes' : global('BusStateBoard') === '1');
var BOARD_MINE = global('BusBoardRoutes') === 'mine';
var BOARD_SECS = parseInt(global('BusBoardSecs'), 10); if (!(BOARD_SECS >= 0)) BOARD_SECS = 10;
var LINE = 26;                                          // each line of the board, dp
var BOARD_ROWS = 0;
// Settings' preview shows the island and then its board, drawn as a new window over it: the island is
// drawn at the board's width, so the board appears over it without a step at its ends (4.48)
var AS_BOARD = BOARD || (PREVIEW && !CHIP);
var boardData = {};
var sizeRows = 0;
if (AS_BOARD) {
  try { boardData = JSON.parse(global(DATA_VAR)) || {}; } catch (e) {}
  sizeRows = boardRows((boardData.b || []).length, (boardData.a || []).length, BOARD_MINE);
}
if (BOARD) BOARD_ROWS = sizeRows;
var WINH = BOARD ? H + BOARD_ROWS * LINE + 8 : H;       // the window's height: the island, or the island and its board
// How many lines it was drawn with, so a refresh that changes that draws it again (refresh.js, 4.43)
if (BOARD && !PREVIEW) setGlobal('BusStateBoardRows', String(BOARD_ROWS));
var ROUTE_ORDER = JSON.stringify((global('BusRoutes') || '').split(',').map(function (r) { return r.trim(); }).filter(String));
var LEFT = 40;                                          // left half: set below, once the data is read

/* ---- Right half: fitted to the times (4.46) ---------------------------
   Just wide enough for the widest of the times showing ("5 · 17 min",
   "~12 min", "Due"), plus the route dots with 10 dp of space before
   them, all measured with the phone's own font (islandFit). Bus Refresh
   decides the width (BusStateIslandRight, and data.fit for a page
   already showing): it grows the island as soon as the times need more
   room, so nothing is ever cut short, and shrinks it only after two
   refreshes in a row with 8 dp or more to spare, so it doesn't keep
   changing size. The preview, and anything drawn before Bus Refresh has
   decided, is fitted to its own data. */
var showingNow = 1;
var fitData = [];
try { fitData = JSON.parse(global(DATA_VAR)).b || []; showingNow = fitData.length; } catch (e) {}
var routes = PREVIEW ? Math.max(1, showingNow) : routesHere(showingNow);
var fitted = rightNeeded(fitData, Date.now());
var RIGHT = PREVIEW ? fitted : (parseInt(global('BusStateIslandRight'), 10) || fitted);
if (!PREVIEW) setGlobal('BusStateIslandRight', String(RIGHT));      // the width it's drawn at
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
var camX = parseInt(global('BusCameraX'), 10) || screenW / 2;            // camera centre (Bus Find Camera finds it)
// The island's own halves, for the page to go back to when its board tucks back in (4.47)
var ISLAND_LEFT = LEFT;
var ISLAND_RIGHT = RIGHT;
// The stop board (4.47): a little wider than the island when its lines need it (boardWidths). This is
// for a board drawn as a new window; one the page grows out of the island works it out the same way.
// (And for the preview's island, 4.48: see AS_BOARD.)
if (AS_BOARD) {
  var bw = boardWidths({ left: LEFT, right: RIGHT },
    (boardData.b || []).map(function (b) {
      return { t: [b.t].concat(b.t2 !== undefined ? [b.t2] : [], b.t3 !== undefined ? [b.t3] : []), st: b.st, sts: [b.st, b.st2, b.st3] };
    }).concat(BOARD_MINE ? [] : (boardData.a || []).map(function (o) { return { t: (o.t || []).slice(0, 3), st: 'live' }; })).slice(0, sizeRows),
    (boardData.b || []).concat(BOARD_MINE ? [] : (boardData.a || [])).slice(0, sizeRows).map(function (x) { return x.k; }),
    { cam: camX, screen: screenW, gap: GAP, pad: PAD, letters: letters, now: Date.now() });
  LEFT = bw.left;
  RIGHT = bw.right;
}
var busww = String(PAD + LEFT + GAP + RIGHT + PAD);                          // window width, dp
var busx = String(Math.round(camX - GAP / 2 - LEFT - PAD));               // window's left edge, dp: gap over the camera
if (CHIP) busx = String(parseInt(global('BusChipX'), 10) >= 0 ? parseInt(global('BusChipX'), 10) : 76);   // right of the clock
// Where the window goes (read by the Show Scene V2 action that follows)
var yWanted = loc('busprevy') || global('BusIslandY');
var busy = String(parseInt(yWanted, 10) >= 0 ? parseInt(yWanted, 10) : 9);  // dp from the top
if (CHIP) busy = String(parseInt(busy, 10) + 3);                            // centred on the same line as the island
var bush = String(WINH);

/* ---- The island's web page ----------------------------------------
   {{TOKENS}} are filled in below. The page must never contain a
   percent sign followed by letters except the data placeholder, or
   Tasker would treat it as a variable. */
var PAGE = String.raw`<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no">
<style>
  /* Transparent page: the black island is the only thing drawn */
  /* (Heights in px. Viewport units come out as 0 in this web view, which hid the whole island: test build 13.
     A board the page grows sets them itself, setHeight.) */
  /* The widths as variables, so the page can fit itself to its times (4.46) */
  :root { --left: {{LEFT}}px; --right: {{RIGHT}}px; --total: {{TOTAL}}px; }
  html, body { margin: 0; height: {{WINH}}px; width: var(--total); background: transparent; overflow: hidden;
               -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
  body { font-family: system-ui, Roboto, sans-serif; }

  /* The island: left half | camera gap | right half */
  /* The stop board (4.42): the same black shape, taller. Its first line is still left half | camera gap
     | right half (now the stop and how old the times are), and every line below keeps the same three
     columns, so the camera gap runs the whole way down: routes to its left, times to its right */
  /* (As tall as the page: when the board grows out of the island, its window reveals it as it grows, 4.43) */
  body.board #p { height: 100%; flex-wrap: wrap; align-content: flex-start; border-radius: 20px; }
  body.board #L, body.board #g, body.board #R { height: {{H}}px; }
  #board { display: none; flex: 0 0 100%; }
  body.board #board { display: block; }
  .bl { display: flex; align-items: center; height: {{LINE}}px; }
  /* Growing out of the island (4.43): the rows fade and drop in one after another; closing, they fade
     first and the board tucks back up into the island. Material 3's emphasized decelerate. */
  .bl { transition: opacity .22s linear, transform .32s cubic-bezier(0.05, 0.7, 0.1, 1); }
  .bl:nth-child(2) { transition-delay: 40ms; } .bl:nth-child(3) { transition-delay: 80ms; }
  .bl:nth-child(4) { transition-delay: 120ms; } .bl:nth-child(5) { transition-delay: 160ms; }
  .bl:nth-child(6) { transition-delay: 200ms; } .bl:nth-child(7) { transition-delay: 240ms; }
  .bl:nth-child(8) { transition-delay: 280ms; }
  body.entering .bl { opacity: 0; transform: translateY(-8px); transition: none; }
  body.leaving .bl { opacity: 0; transition: opacity 90ms linear; transition-delay: 0ms; }
  #p.swap .h { opacity: 0; }
  .bl .h { height: {{LINE}}px; }
  .bl .bl-l { width: var(--left); } .bl .bl-g { flex: none; width: {{GAP}}px; } .bl .bl-r { width: var(--right); }
  .bl .d { font-size: 12.5px; }
  .bl .m2 { font-size: 12px; }
  .b.other { background: transparent; box-shadow: inset 0 0 0 1.5px #5A6376; color: #D5DAE3; }   /* not one of your routes */
  .age { margin-left: auto; font-size: 12px; font-weight: 600; color: #9AA3B5; }
  .age.old { color: #D5DAE3; }
  /* Old times on the board fade less than on the island (0.7: still 4.4:1 for the quieter times), and
     the first line says how old they are */
  #board.old .m, #board.old .m2 { opacity: .7; }
  /* Status bar chip: route badge and minutes only, a little smaller */
  body.chip .d { display: none; }
  body.chip .b { font-size: 12px; padding: 0 6px; }
  body.chip .m { font-size: 13px; }
  /* A fixed width, the same as the window's: as a plain flex box it stretched to the web page's
     width, which can be wider than the window, so its rounded right end was cut off */
  #p { position: relative; display: flex; align-items: center; height: {{H}}px; width: var(--total); box-sizing: border-box;
       padding: 0 {{PAD}}px; border-radius: {{RADIUS}}px; background: #000; color: #fff;
       font-size: 14px; white-space: nowrap; touch-action: none; }
  .h { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden;
       transition: opacity .18s, transform .18s; }
  #L { flex: none; width: var(--left); }   /* route + destination: fixed width */
  #g { flex: none; width: {{GAP}}px; }    /* empty, sits over the camera */
  /* Status bar chip: a thin pipe between the route and the minutes */
  body.chip #g { display: flex; justify-content: center; }
  body.chip #g::before { content: ''; width: 1px; height: 12px; background: rgba(255,255,255,.45); }
  #R { flex: none; width: var(--right); }  /* minutes + dots: fitted to the times (see RIGHT above) */
  #p.out .h  { opacity: 0; transform: translateX(-6px); }   /* slide to next route */
  /* A tap, a hold or a swipe up has gone to Tasker (4.43): the words dim straight away, so the touch is
     seen to have counted, until the island is drawn again (the board opening or closing) or the new
     stop's times arrive. Dismissing fades the whole island out at once, before Bus End removes it. */
  #p.wait .h, #p.wait #board { opacity: .45; transition: opacity .1s; }
  /* Swiped far enough that letting go will dismiss it (4.43; the window itself follows the finger) */
  #p.armed .h, #p.armed #board { opacity: .45; }
  #p.gone { opacity: 0 !important; transition: opacity .12s !important; }
  #p.back .h { opacity: 0; transform: translateX(6px); }    /* slide to previous */

  /* Countdown border: an SVG outline laid over the island */
  #ring { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
  #ring.off { display: none; }                  /* BusBorder is off (the default) */

  .b { background: #DC241F; border-radius: 99px; padding: 1px 7px; font-weight: 700; font-size: 13px; flex: none; } /* route badge */
  .b.idle { background: #5A6376; }              /* a later bus on the route you're riding: the idle dots' grey */
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
  .dots { display: flex; gap: 3px; flex: none; margin-left: auto; padding-left: 4px; }   /* always 10 dp clear of the times (4.46) */
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
  <div id="board" role="list"></div>
</div>
<script>
  // Fixed when the island first appears
  var LEFT = {{LEFT}}, GAP = {{GAP}}, PAD = {{PAD}};
  var H = {{H}}, LINE = {{LINE}};  // the island's height and each board line's, dp (the board grows to H + lines * LINE + 8)
  // ms held = long press (4.48: 450, from 550, so a switch comes 0.1 s sooner; not Android's own 400,
  // as a tap on the island can last half a second)
  var HOLD = 450;
  var NAME_MS = 600;          // a stop just switched to, with its times: how long its name shows (4.48)
  var DEFAULT_ROTATE = 6000;  // ms per route if the data doesn't say

  var data = null, raw = '', idx = 0, start = Date.now(), lastStop = null, flashUntil = 0;
  function $(id) { return document.getElementById(id); }
  var dataEl = $('d'), p = $('p'), L = $('L'), R = $('R'), ring = $('ring'), track = $('track'), prog = $('prog');
  var BORDER = {{BORDER}};                        // countdown border on or off (setting BusBorder)
  if (!BORDER) ring.classList.add('off');
  var BOARD = {{BOARD}};                          // the stop board is open (BusStateBoard; see above)
  var BOARD_ROWS = {{BOARD_ROWS}}, BOARD_MINE = {{BOARD_MINE}}, BOARD_SECS = {{BOARD_SECS}};
  var ROUTE_ORDER = {{ROUTE_ORDER}};              // your routes, in Settings order (BusRoutes)
  var board = $('board'), boardOrder = null, boardHtmlNow = '', closeAt = 0;
  if (BOARD) { document.body.classList.add('board'); ring.classList.add('off'); }

  function buses() { return data && data.b ? data.b : []; }
  function rotateMs() { return (data && data.rot) || DEFAULT_ROTATE; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function mins(ms) { var m = Math.round((ms - Date.now()) / 60000); return m < 1 ? 'Due' : m + ' min'; }
  var IS_PREVIEW = {{PREVIEW}};  // Bus Settings' preview: gestures do nothing
  // Tasks started from the island get busfrom=island, so they give a short vibration
  // (Android's web view ignores navigator.vibrate, so Tasker's Vibrate action does it)
  function runTask(name, vars) {
    if (IS_PREVIEW || !window.Tasker || !Tasker.runTask) return null;
    return Tasker.runTask({ name: name, variables: vars || { busfrom: 'island' } });
  }
  // The island's own window (4.43): Tasker's bridge can move it and remove it straight from here
  var CAN_MOVE = !IS_PREVIEW && !!window.Tasker && typeof Tasker.moveOverlayBy === 'function';
  var BUSX = {{BUSX}};             // its left edge, dp (where a swipe that isn't far enough puts it back)

  /* Waiting on Tasker (4.43): dim the words, or (gone) hide the island, until it's drawn again; if
     nothing has happened after 4 s (the task didn't run), put it back */
  var waitTimer = null, waitingFor = '';
  function waitFor(what, cls) {
    waitingFor = what;
    (cls || 'wait').split(' ').forEach(function (c) { p.classList.add(c); });
    clearTimeout(waitTimer);
    waitTimer = setTimeout(function () { waitingFor = ''; p.classList.remove('wait', 'gone', 'armed'); settle(); windowBack(); }, 4000);
  }
  /* The stop board grows out of the island's own window, and tucks back into it (4.43): the page
     resizes its window through Tasker's bridge and fills it, so the black shape is the window itself,
     and the rows fade and drop in. Tasker is only told afterwards, to note it and fetch fresh times if
     they're due: no new window is drawn. Without the bridge (or in Settings' preview), the board is
     drawn as a new window by Bus Refresh, as before. */
  var CAN_GROW = !IS_PREVIEW && !!window.Tasker && typeof Tasker.updateOverlayConfig === 'function' &&
    !document.body.classList.contains('chip');
  function lines() { return Math.max(1, Math.min(8, buses().length + (BOARD_MINE ? 0 : ((data && data.a) || []).length))); }
  // The page's own height, px (= dp here): the board's when it grows, so its window uncovers it as it
  // grows; the island's once it has tucked back
  function setHeight(h) { document.documentElement.style.height = document.body.style.height = h + 'px'; }
  // The window's new height (dp), animated by Tasker over ms with one of its easing curves (Linear,
  // EaseIn, EaseOut, EaseInOut, Overshoot, Bounce). The bridge reads these keys (from Tasker 6.7.6's
  // own code: the manual doesn't name them) and drops any error, so this can't tell if it worked.
  function resizeWindow(h, ms, easing, w, x) {
    var c = { height: String(h), configTransitionMs: ms, configTransitionEasing: easing };
    if (w) { c.width = String(w); c.x = String(x); }        // a wider board, and back (4.47)
    try { Tasker.updateOverlayConfig(c); return true; } catch (e) { return false; }
  }
  // The board's halves for these lines (4.47): the island's, or a little wider when they need it
  function boardFit() {
    var rows = boardRows();
    return boardWidths({ left: ISLAND_LEFT, right: ISLAND_RIGHT }, rows, rows.map(function (r) { return r.k; }),
      { cam: CAMX, screen: SCREENW, gap: GAP, pad: PAD, letters: LETTERS, now: Date.now() });
  }
  function growBoard() {
    var rows = lines();
    BOARD_ROWS = rows; boardOrder = null;
    var bw = boardFit(), wider = bw.left !== LEFT || bw.right !== RIGHT_NOW;
    setHeight(H + rows * LINE + 8);
    if (!resizeWindow(H + rows * LINE + 8, 400, 'EaseOut', wider && PAD + bw.left + GAP + bw.right + PAD, islandX(bw.left))) { setHeight(H); return false; }
    if (wider) { X_NOW = islandX(bw.left); setWidths(bw.left, bw.right); setTimeout(unzoom, 450); }   // (4.50)
    BOARD = true; boardHtmlNow = '';
    document.body.classList.add('board', 'entering'); ring.classList.add('off'); p.classList.add('swap');
    setTimeout(function () {               // the stop's name fades in, then the rows drop in one by one
      draw(); p.classList.remove('swap');
      requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.remove('entering'); }); });
    }, 110);
    if (BOARD_SECS > 0) closeAt = Date.now() + BOARD_SECS * 1000;
    runTask('Bus Island', { busfrom: 'island', busisland: 'open', busgrow: 'yes' });
    return true;
  }
  function shrinkBoard() {
    closeAt = 0;
    document.body.classList.add('leaving'); p.classList.add('swap');      // the rows and the name fade first
    setTimeout(function () {
      var wider = LEFT !== ISLAND_LEFT || RIGHT_NOW !== ISLAND_RIGHT;     // back to the island's own width too (4.47)
      if (!resizeWindow(H, 260, 'EaseIn', wider && PAD + ISLAND_LEFT + GAP + ISLAND_RIGHT + PAD, islandX(ISLAND_LEFT))) {   // couldn't: drawn as a new window instead
        document.body.classList.remove('leaving'); p.classList.remove('swap');
        waitFor('board'); runTask('Bus Island', { busfrom: 'island', busisland: 'close' });
        return;
      }
      setTimeout(function () {                                             // an island again
        BOARD = false; setHeight(H); document.body.classList.remove('board', 'leaving'); if (BORDER) ring.classList.remove('off');
        if (wider) { X_NOW = islandX(ISLAND_LEFT); setWidths(ISLAND_LEFT, ISLAND_RIGHT); unzoom(); }   // (4.50)
        idx = 0; start = Date.now(); draw(); p.classList.remove('swap');
      }, 260);
      runTask('Bus Island', { busfrom: 'island', busisland: 'close', busgrow: 'yes' });
    }, 80);
  }
  /* Fitted to its times (4.46): Bus Refresh says how wide the right half should be (data.fit), and
     the page widens or narrows its own window to match through the same bridge, the left edge and
     the camera gap staying where they are. Growing, the times widen at once and the window opens to
     show them; shrinking, the window closes in first. The window's width is checked afterwards (the
     page is as wide as its window): if it didn't change, or there's no bridge, Bus Island has it
     drawn again at the new width instead, the new one on top before the old one goes. */
  var RIGHT_NOW = {{RIGHT}}, fitTimer = null;
  // The island's own halves (a board drawn as a new window may be wider, 4.47), and where the window's
  // left edge is now (a wider board's is further left); the camera's middle and the screen's width
  var ISLAND_LEFT = {{ISLAND_LEFT}}, ISLAND_RIGHT = {{ISLAND_RIGHT}}, X_NOW = {{BUSX}};
  var CAMX = {{CAMX}}, SCREENW = {{SCREENW}}, LETTERS = {{LETTERS}};
  /* @include islandFit */
  // The web view zooms the page when its window widens through the bridge (4.50): by the widths'
  // ratio, so the text grew and moved right and its end was cut short (4.46's fitting, 4.47's wider
  // board). The viewport is pinned at scale 1 so it shouldn't; if it still has, the island is drawn
  // again, as for a width the bridge couldn't set.
  function zoomed() { return !!(window.visualViewport && visualViewport.scale > 1.01); }
  function unzoom() {
    if (!zoomed()) return false;
    CAN_FIT = false; runTask('Bus Island', { busisland: 'fit' });
    return true;
  }
  function islandX(left) { return Math.round(CAMX - GAP / 2 - left - PAD); }
  function setWidths(left, right) {
    LEFT = left; RIGHT_NOW = right;
    document.documentElement.style.setProperty('--left', left + 'px');
    document.documentElement.style.setProperty('--right', right + 'px');
    document.documentElement.style.setProperty('--total', totalFor(right) + 'px');
    if (BORDER && !BOARD) drawRing();
  }
  var CAN_FIT = !IS_PREVIEW && !!window.Tasker && typeof Tasker.updateOverlayConfig === 'function';
  function totalFor(r) { return PAD + LEFT + GAP + r + PAD; }
  function setRight(r) { setWidths(LEFT, r); }
  function fitTo(r) {
    // The board open: the island's width for when it closes; the board itself only ever grows for it
    if (BOARD) { ISLAND_RIGHT = r; if (r <= RIGHT_NOW) return; }
    else ISLAND_RIGHT = r;
    if (!(r > 0) || r === RIGHT_NOW) return;
    var was = RIGHT_NOW, tracks = Math.abs(window.innerWidth - totalFor(was)) <= 2;
    clearTimeout(fitTimer);
    if (!CAN_FIT || !tracks) { setRight(r); runTask('Bus Island', { busisland: 'fit' }); return; }
    try { Tasker.updateOverlayConfig({ width: String(totalFor(r)), configTransitionMs: 200, configTransitionEasing: 'EaseOut' }); }
    catch (e) { setRight(r); runTask('Bus Island', { busisland: 'fit' }); return; }
    if (r > was) setRight(r);
    fitTimer = setTimeout(function () {
      if (r < was) setRight(r);
      // Didn't take: drawn again at the new width instead
      if (Math.abs(window.innerWidth - totalFor(r)) > 2) { CAN_FIT = false; setRight(r); runTask('Bus Island', { busisland: 'fit' }); }
      else unzoom();                       // took, but zoomed the page (4.50)
    }, 420);
  }

  // Closing the board (a tap, a swipe up, or its time running out)
  function closeBoard() {
    if (CAN_GROW) { shrinkBoard(); return; }
    waitFor('board'); runTask('Bus Island', { busfrom: 'island', busisland: 'close' });
  }

  /* New data from Tasker */
  function read() {
    var t = dataEl.textContent.trim();
    if (t === raw) return;
    raw = t;
    try { data = JSON.parse(t); } catch (e) { return; }
    if (data.s !== lastStop) {        // stop changed: flash its name, restart at the first route
      if (waitingFor === 'switch') { waitingFor = ''; clearTimeout(waitTimer); p.classList.remove('wait'); }
      // With its times here already, the name shows in the left half for 0.6 s and the times at once
      // (4.48: the whole island showed the name for 1.2 s, two thirds of a switch's wait)
      var nameMs = buses().length ? NAME_MS : 1200;
      if (lastStop !== null) { flashUntil = Date.now() + nameMs; setTimeout(draw, nameMs + 50); }
      lastStop = data.s;
      idx = 0;
    }
    if (idx >= buses().length) idx = 0;
    start = Date.now();
    if (data.fit) fitTo(data.fit);    // a new width for the right half (4.46)
    // A board this page grew: new times with a route more or fewer resize its window to fit (4.43)
    if (BOARD && CAN_GROW && lines() !== BOARD_ROWS) {
      BOARD_ROWS = lines(); boardHtmlNow = '';
      setHeight(H + BOARD_ROWS * LINE + 8);
      resizeWindow(H + BOARD_ROWS * LINE + 8, 200, 'EaseOut');
    }
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

  /* The stop board: the first line is the stop and how old its times are; then one line per route,
     yours first in Settings order, then the stop's other routes soonest first. The order is fixed the
     first time it's drawn (each opening is a new page), so lines never swap while you read them. A
     line shows as many times as fit: "2 · 8 · 19 min". It's only rewritten when something on it
     changes, so TalkBack isn't read the same thing again and again. */
  function timesHtml(r, n) {
    var st = r.st || 'live', first = mins(r.t[0]);
    if (st === 'sched' && first === 'Due') first = '1 min';
    var cls = st === 'live' ? (first === 'Due' ? ' due' : '') : ' ' + st, pre = st === 'sched' ? '~' : '';
    var rest = r.t.slice(1, n).map(function (t, i) { var m = mins(t).replace(/ min$/, ''); return ((r.sts && r.sts[i + 1] === 'sched') ? '~' : '') + (m === 'Due' ? '1' : m); });
    if (!rest.length) return '<span class="m' + cls + '">' + pre + first + '</span>';
    return '<span class="m' + cls + '">' + pre + first.replace(/ min$/, '') + '</span><span class="m2">\u00b7 ' + rest.join(' \u00b7 ') + ' min</span>';
  }
  function spoken(r, n) {
    var ms = r.t.slice(0, n).map(function (t) { var m = mins(t); return m === 'Due' ? 'due now' : m.replace(/ min$/, ''); });
    var said = ms.length > 1 ? ms.slice(0, -1).join(', ') + ' and ' + ms[ms.length - 1] : ms[0];
    return r.k + ' to ' + r.d + (r.st === 'sched' ? ', timetable, about ' : ', ') + said + (/due now$/.test(said) ? '' : ' minutes') +
      (r.other ? ', another route' : r.idle ? ', a later bus on the route you are riding' : '');
  }
  function boardRows() {
    var rows = buses().map(function (b) {
      return { key: 'y' + b.k, k: b.k, d: b.d, st: b.st || 'live', idle: !!b.idle, sts: [b.st || 'live', b.st2 || 'live', b.st3 || 'live'],
               t: [b.t].concat(b.t2 !== undefined ? [b.t2] : [], b.t3 !== undefined ? [b.t3] : []) };
    });
    if (!BOARD_MINE) ((data && data.a) || []).forEach(function (o) { rows.push({ key: 'o' + o.k, k: o.k, d: o.d, st: 'live', other: true, t: o.t.slice(0, 3) }); });
    if (!boardOrder) {
      var yours = rows.filter(function (r) { return !r.other; }).sort(function (a, c) {
        var ia = ROUTE_ORDER.indexOf(a.k), ic = ROUTE_ORDER.indexOf(c.k);
        return (ia < 0 ? 99 : ia) - (ic < 0 ? 99 : ic);
      });
      boardOrder = yours.concat(rows.filter(function (r) { return r.other; })).map(function (r) { return r.key; });
    }
    var at = function (r) { var i = boardOrder.indexOf(r.key); return i < 0 ? 999 : i; };
    return rows.sort(function (a, c) { return at(a) - at(c); }).slice(0, BOARD_ROWS);
  }
  function drawBoard() {
    var name = (data && data.n) || '', parts = name.match(/^(.*) \((.*)\)$/);
    var age = data && data.u ? Date.now() - data.u : 0, old = age > 2 * ((data && data.r) || 45000);
    L.innerHTML = (data && data.l ? '<span class="sl" aria-label="Stop ' + esc(data.l) + '">' + esc(data.l) + '</span>' : '') + '<span class="s">' + esc(parts ? parts[1] : name) + '</span>';
    R.innerHTML = '<span class="age' + (old ? ' old' : '') + '">' + (data && data.w ? '\u2026' : age < 30000 ? 'now' : age < 60000 ? '&lt;1 min' : Math.floor(age / 60000) + ' min' + (old ? ' old' : '')) + '</span>';
    var rows = boardRows(), html = '';
    rows.forEach(function (r) {
      html += '<div class="bl" role="listitem"><span class="h bl-l"><span class="b' + (r.other ? ' other' : r.idle ? ' idle' : '') + '">' + esc(r.k) + '</span>' +
        '<span class="d' + (r.st === 'sched' ? ' sched' : '') + '">' + esc(r.d) + '</span></span><span class="bl-g"></span><span class="h bl-r">' + timesHtml(r, 3) + '</span></div>';
    });
    if (!rows.length) html = '<div class="bl" role="listitem"><span class="h bl-l"><span class="d">' + (data && data.w ? 'Getting times\u2026' : 'No buses due') + '</span></span></div>';
    if (html + old !== boardHtmlNow) {
      boardHtmlNow = html + old;
      board.innerHTML = html;
      board.classList.toggle('old', old);
      // As many times as fit beside the camera: three, then two, then one
      Array.prototype.forEach.call(board.querySelectorAll('.bl-r'), function (cell, i) {
        for (var n = 2; n >= 1 && cell.scrollWidth > cell.clientWidth + 1; n--) cell.innerHTML = timesHtml(rows[i], n);
        board.children[i].setAttribute('aria-label', spoken(rows[i], cell.textContent.split('\u00b7').length));
      });
    }
    p.setAttribute('aria-label', 'Buses at ' + (parts ? parts[1] : name) + (data && data.l ? ', stop ' + data.l : '') + (old ? ', times from ' + Math.floor(age / 60000) + ' minutes ago' : '') + '. Tap to close.');
  }

  function draw() {
    if (BOARD) { drawBoard(); return; }
    // (and while a stop just switched to waits for its times, 4.43: w)
    var naming = Date.now() < flashUntil;
    var name = (data && data.n) || '', parts = name.match(/^(.*) \((.*)\)$/);
    if ((data && data.w) || (naming && !buses().length)) {    // "Stop B" | "High Street"
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
                    '<span class="b' + (b.idle ? ' idle' : '') + '">' + esc(b.k) + '</span><span class="d' + (b.st === 'sched' ? ' sched' : '') + '">' + esc(b.d) + '</span>';
      R.innerHTML = rightHtml(b, idx);
      if (R.scrollWidth > R.clientWidth + 1) R.innerHTML = rightHtml(b, idx, true);   // too wide: just the first time
      // A stop just switched to (4.48): its name on the left ("Stop B · High Street"), its times already on the right
      if (naming) L.innerHTML = '<span class="s">' + esc(parts ? parts[2] + ' · ' + parts[1] : name) + '</span>';
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
    if (BOARD) return;                                      // the board shows every route at once
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
    if (down && !held && Date.now() - movedAt > 2000) letGo();
    // The board closes itself after BusBoardSecs (not while a finger is on it)
    if (BOARD && closeAt && !down && Date.now() >= closeAt) { closeAt = 0; closeBoard(); }
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
       long press             = the next nearby stop (Bus Island); the board, if
                                open, stays open for it
       tap                    = open the stop board, or close it (Bus Island)
       swipe up (board open)  = close it
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
  var sx = 0, sy = 0, lx = 0, ly = 0, t0 = 0, down = false, held = false, armed = false, holdTimer = null, movedAt = 0;
  /* A sideways swipe moves the island's whole window with your finger (4.43). Before, only what's
     drawn inside it moved, uncovering the window's own near-black fill: the "blank island". Where the
     finger is on the screen comes from screenX, if Android's web view reports it that way: checked
     on the first swipe (WIN: '' not yet known, 'yes', or 'no', and then the old way is used). */
  var WIN = '', ssx = 0, lsx = 0, winMoved = 0, off0 = 0, firstMoveAt = 0;
  function swipeDx() { return WIN !== 'no' && CAN_MOVE ? lsx - ssx : lx - sx; }
  function moveWindow(to) {        // to: where the window should be, CSS px from its place
    var by = to - winMoved;
    if (!by) return;
    try { Tasker.moveOverlayBy(Math.round(by * (window.devicePixelRatio || 1)), 0); if (!winMoved) firstMoveAt = Date.now(); winMoved = to; } catch (e) { WIN = 'no'; }
  }
  /* The whole window fades as it nears the dismissal point: fully there up to 24 dp, a quarter at 90 dp
     (4.43). Through the scene variable busalpha (the layout's Alpha modifier), at most 30 times a
     second, and only when it changes enough to see. */
  var fadeNow = -1, fadeAt = 0;   // not yet set: the first call always sets it
  function fadeWindow(a, now) {
    if (!CAN_MOVE || typeof Tasker.setVariable !== 'function') return;
    a = Math.round(a * 20) / 20;
    if (a === fadeNow || (!now && Date.now() - fadeAt < 33)) return;
    try { Tasker.setVariable('busalpha', String(a)); fadeNow = a; fadeAt = Date.now(); } catch (e) {}
  }
  // Several routes to swipe through (not on the board, which shows them all): dismissing takes a long,
  // deliberate drag, and the fade only starts once past where a route change ends (4.43)
  function several() { return !BOARD && buses().length > 1; }
  function fadeFor(dx) {
    var from = several() ? SWIPE_DISMISS : 24, to = several() ? SWIPE_DISMISS_SEVERAL : SWIPE_DISMISS;
    return 1 - 0.75 * Math.max(0, Math.min(1, (Math.abs(dx) - from) / (to - from)));
  }
  function windowBack() {          // a swipe that wasn't far enough: back to its place, quickly
    fadeWindow(1, true);
    if (!winMoved) return;
    try {
      if (X_NOW >= 0 && typeof Tasker.updateOverlayConfig === 'function') Tasker.updateOverlayConfig({ x: String(X_NOW), configTransitionMs: 150, configTransitionEasing: 'EaseOut' });
      else Tasker.moveOverlayBy(Math.round(-winMoved * (window.devicePixelRatio || 1)), 0);
    } catch (e) {}
    winMoved = 0;
  }
  function follow(dx) {                  // past 24 dp what's in the island follows your finger, fading as the window would (fadeFor)
    var past = Math.max(0, Math.abs(dx) - 24) * (dx < 0 ? -1 : 1);
    p.style.transition = 'none';
    p.style.transform = 'translateX(' + Math.max(-120, Math.min(120, past)) + 'px)';
    p.style.opacity = String(fadeFor(dx));
  }
  function settle() { p.style.transition = 'transform .15s, opacity .15s'; p.style.transform = ''; p.style.opacity = '1'; }
  // A finger that has neither moved nor lifted for 2 s (tick): let go of the gesture without acting on
  // it, the island back in its place. Judging it from where it was last seen dismissed a countdown
  // when you only paused past the dismissal point to think (4.43).
  function letGo() {
    clearTimeout(holdTimer);
    if (!down) return;
    down = false; armed = false;
    p.classList.remove('armed');
    windowBack();
    settle();
  }
  function judge() {
    clearTimeout(holdTimer);
    if (!down) return;
    down = false;
    var dx = swipeDx(), dy = ly - sy, wasArmed = armed;
    armed = false;
    p.classList.remove('armed');
    // Swiped away (4.43): the island's window goes at once, from here, and Bus End does the rest. Before,
    // it stayed up, blank, until Bus End had started and removed it.
    if (!held && Math.abs(dx) > Math.abs(dy) && decideSwipe(dx, Date.now() - t0, several()) === 'dismiss') {
      // (Its window moved with the finger: it stays as it is until the window goes, as hiding what's
      // in it would show the window's blank fill. Otherwise what's in it slides out and fades.)
      if (!winMoved) { p.style.transition = 'transform .15s ease-in, opacity .15s'; p.style.transform = 'translateX(' + (dx < 0 ? -160 : 160) + 'px)'; }
      waitFor('end', winMoved ? 'armed' : 'gone');
      var ended = runTask('Bus End'), gone = false;
      // The window goes only once Tasker has taken Bus End: removed without it, the countdown would
      // carry on with no island, and nothing would draw one again. Meanwhile, and if Tasker never
      // takes it, the window is only made invisible, and waitFor puts it back after 4 s.
      var dismiss = function () {
        if (gone || IS_PREVIEW || !window.Tasker || typeof Tasker.dismissLayout !== 'function') return;
        gone = true;
        try { Tasker.dismissLayout(Tasker.getCurrentScreenId()); } catch (e) {}
      };
      if (ended && ended.then) ended.then(dismiss, function () {});
      setTimeout(function () { if (!gone) fadeWindow(0, true); }, 250);
      return;
    }
    windowBack();
    settle();
    if (BOARD && BOARD_SECS > 0) closeAt = Date.now() + BOARD_SECS * 1000;   // touched: the board's time starts again
    if (held) return;
    // A tap opens the stop board, or closes it; a swipe up closes it (4.42). Not on the status bar chip.
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (BOARD) closeBoard();
      else if (!document.body.classList.contains('chip') && !(CAN_GROW && growBoard())) { waitFor('board'); runTask('Bus Island', { busfrom: 'island', busisland: 'open' }); }
      return;
    }
    if (BOARD && dy <= -30 && Math.abs(dy) > Math.abs(dx)) { closeBoard(); return; }
    if (Math.abs(dx) <= Math.abs(dy)) return;                  // mostly up or down: not a swipe
    var what = decideSwipe(dx, Date.now() - t0, several());
    if (what === 'next') go(1);
    else if (what === 'previous') go(-1);
  }
  p.addEventListener('pointerdown', function (e) {
    sx = lx = e.clientX; sy = ly = e.clientY; t0 = movedAt = Date.now(); down = true; held = false; armed = false;
    ssx = lsx = e.screenX; off0 = e.screenX - e.clientX; winMoved = 0; firstMoveAt = 0;
    try { p.setPointerCapture(e.pointerId); } catch (err) {}
    holdTimer = setTimeout(function () {
      held = true;
      waitFor('switch');
      runTask('Bus Island', { busfrom: 'island', busisland: 'switch' });
    }, HOLD);
  });
  p.addEventListener('pointermove', function (e) {
    if (!down) return;
    lx = e.clientX; ly = e.clientY; lsx = e.screenX; movedAt = Date.now();
    // Is screenX really on the screen (Tasker's own drag handles take it to be)? Once the window has
    // had time to move (200 ms: touches come every 8 ms, and a move takes a frame or two), screenX must
    // differ from clientX by more than it did at the start. If it doesn't, put the window back and move
    // what's inside instead. (Checking after 3 touches, 25 ms, was too soon: the first test said no.)
    if (WIN === '' && Math.abs(winMoved) >= 20 && Date.now() - firstMoveAt >= 200) {
      if (Math.abs(e.screenX - e.clientX - off0) >= Math.abs(winMoved) / 2) WIN = 'yes';
      else { WIN = 'no'; windowBack(); }
    }
    var dx = swipeDx();
    if (Math.abs(dx) > 10 || Math.abs(ly - sy) > 10) clearTimeout(holdTimer);
    if (held) return;
    var nowArmed = decideSwipe(dx, 1e9, several()) === 'dismiss';  // far enough to dismiss even slowly (90 dp; 130 with several routes)
    if (nowArmed && !armed) runTask('Bus Island', { busfrom: 'island', busisland: 'buzz' });                // a tick when letting go will dismiss
    armed = nowArmed;
    p.classList.toggle('armed', armed);
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(ly - sy)) {
      if (CAN_MOVE && WIN !== 'no') { moveWindow(dx); fadeWindow(fadeFor(dx)); } else follow(dx);
    }
  });
  p.addEventListener('pointerup', function (e) { lx = e.clientX; ly = e.clientY; lsx = e.screenX; judge(); });
  p.addEventListener('pointercancel', judge);
  // Sometimes neither comes: on Thursday 8 Oct a swipe away was left hanging half-way out, the page
  // still taking the finger to be down, and the countdown never ended. So losing the pointer, and the
  // touch itself ending, count as letting go too, and tick() lets go of a finger that has neither
  // moved nor lifted for 2 s, putting the island back (letGo, 4.43). judge() runs once per gesture,
  // however many of these arrive.
  p.addEventListener('lostpointercapture', judge);
  document.addEventListener('touchend', judge);
  document.addEventListener('touchcancel', judge);
  p.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Start: watch for new data, keep minutes current, animate the border
  new MutationObserver(read).observe(dataEl, { childList: true, characterData: true, subtree: true });
  window.addEventListener('resize', drawRing);
  setInterval(read, 1000);
  setInterval(draw, 15000);
  read();
  if (BOARD && BOARD_SECS > 0) closeAt = Date.now() + BOARD_SECS * 1000;
  // Fully there, whatever a swipe left the fade at in an earlier island (4.43); a moment after the
  // page has started, so nothing here can hold it up
  setTimeout(function () { try { fadeWindow(1, true); } catch (e) {} }, 1000);
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
  BUSX: busx, ISLAND_LEFT: ISLAND_LEFT, ISLAND_RIGHT: ISLAND_RIGHT, CAMX: camX, SCREENW: screenW, LETTERS: CHIP ? 3 : letters,
  BOARD: BOARD ? 'true' : 'false', BOARD_ROWS: BOARD_ROWS, BOARD_MINE: BOARD_MINE ? 'true' : 'false', BOARD_SECS: BOARD_SECS,
  ROUTE_ORDER: ROUTE_ORDER, WINH: WINH, LINE: LINE,
  DATA: '%' + DATA_VAR,                      // split so Tasker doesn't fill it in here
  END_SCRIPT: '</' + 'script>'        // split for the same reason as above, for the HTML parser
});

/* ---- Scene V2 layout ----------------------------------------------
   A rounded clip at both ends of the modifier list keeps the WebView's
   corners see-through whichever way Tasker stacks modifiers. The
   WebView must not be darkened, or it paints a dark rectangle. */
// The board's corners are 20 dp, as its page draws them. The same for the island (4.43, so the board
// can grow out of it in the same window): its corners can't be rounder than half its height, so it's
// still a pill
var CLIP = '20';
var buslayout = JSON.stringify({
  name: 'Bus Pill',
  defaultDisplayMode: 'Overlay',
  root: {
    type: 'Box', id: 'root',
    modifiers: [
      { type: 'FillSize' },
      // Fading as a swipe nears the point where letting go dismisses it (4.43): the whole window, its
      // near-black fill included, from the scene variable busalpha that the page sets as it moves.
      // Only applied once the page has set it below 1, so a Tasker without it shows the island as before.
      // ('%' and the name are joined here, or Tasker would fill in the variable in this script.)
      { type: 'Alpha', value: '%' + 'busalpha', applyWhen: '%' + 'busalpha < 1' },
      { type: 'Clip', shape: 'Rounded', radius: CLIP },
      { type: 'Clip', shape: 'Rounded', radius: CLIP }
    ],
    children: [{
      type: 'WebView', id: 'pillweb', content: html,
      backgroundColor: 'transparent', darkMode: 'ForceLight', supportZoom: 'false',
      modifiers: [{ type: 'FillSize' }]
    }]
  }
});

/* ---- Which scene name (not for Bus Settings' preview, which has its own) ---- */
if (!PREVIEW) {
  /* @include sceneSwap */
}
// How long the new island fades in over the old one before that's removed (ms): not at all when the
// stop board closes (4.43), so the board goes the moment the island is drawn on top of it
var busfadems = loc('busrefpar') === 'close' ? '0' : '300';
// Fade in only when the island first appears; a redraw (the board opening or closing, a new size)
// shows at once over the old one (4.43)
var busanim = /^[12]$/.test(get('BusStateIslandShown')) ? 'None' : 'FadeIn';
