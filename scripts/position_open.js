/* ==================================================================
   Bus Position · Build the live position editor's sliders (4.52)
   Settings › Island › Position › Adjust live closes Settings and shows
   the island (with sample times) where it goes, and this panel at the
   bottom of the screen. Moving a slider runs Bus Position Set, which
   puts the sliders' values in BusStatePrevPos; the island's page sees
   them at once and moves and resizes its own window to match. Done
   saves them (Bus Position Done); Cancel leaves them as they were.
   Sliders: the camera gap and top offset for the island; the offset
   from the left and top offset for the status bar chip.
   Output: buslayout (the panel), busx / busy / busww / bush (where it
           goes: the screen's width, at the bottom, clear of the
           gesture bar)
   ================================================================== */
/* @include get */
var chip = get('BusStyle') === 'chip';
var gap = Math.min(80, Math.max(26, parseInt(get('BusIslandGap'), 10) || 42));
var topY = parseInt(get('BusIslandY'), 10); if (!(topY >= 0)) topY = 9; topY = Math.min(24, topY);   // (not "top": the web page's own)
var cx = parseInt(get('BusChipX'), 10); if (!(cx >= 0)) cx = 76; cx = Math.min(200, cx);
// Where the island is now, so it starts where it goes (the page only moves on a change)
setGlobal('BusStatePrevPos', gap + ',' + topY + ',' + cx);
// Started now: a countdown's own island stays hidden while this is open (fullscreen.js), up to 10 minutes
setGlobal('BusStateEditing', String(Date.now()));

var n = 0;
function id(p) { n++; return p + n; }
function text(t, size, color, extra) { var c = { type: 'Text', id: id('t'), text: t, textSize: String(size || 14) }; if (color) c.color = color; for (var k in extra || {}) c[k] = extra[k]; return c; }
function runTask(task, vars) { return { type: 'RunTask', task: task, variables: vars || {} }; }
// A slider: its value goes to a screen variable, then Bus Position Set passes it on (screen variables
// come across to the task as locals)
function slider(label, min, max, value, variable) {
  return [text(label, 14), { type: 'Slider', id: 'sl_' + variable.replace(/^set_/, ''), min: String(min), max: String(max), steps: String(max - min - 1), value: String(value),
    modifiers: [{ type: 'FillWidth' }], eventHandlers: { handlers: [{ events: [{ type: 'slider_value_changed' }],
      actions: [{ type: 'OutputToVariable', bindings: (function () { var b = {}; b.value = [variable]; return b; })() }, runTask('Bus Position Set', { busaction: 'move' })] }] } }];
}
function button(label, action, filled) {
  var b = { type: 'Button', id: id('btn'), text: label, eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [runTask('Bus Position Done', { busaction: action })] }] } };
  if (!filled) { b.buttonColor = 'surfaceVariant'; b.textColor = 'onSurfaceVariant'; }
  return b;
}
var sliders = chip
  ? slider('From the left (was ' + cx + ' dp)', 0, 200, cx, 'set_cx').concat(slider('Top offset (was ' + topY + ' dp)', 0, 24, topY, 'set_y'))
  : slider('Camera gap (was ' + gap + ' dp)', 26, 80, gap, 'set_gap').concat(slider('Top offset (was ' + topY + ' dp)', 0, 24, topY, 'set_y'));
var buslayout = JSON.stringify({
  name: 'Bus Position', defaultDisplayMode: 'Overlay',
  root: { type: 'Card', id: 'panel', style: 'Elevated', modifiers: [{ type: 'FillSize' }], children: [
    // Scrolls if it's ever taller than the panel (4.53: at Android's 115% font size, Done and Cancel were cut off)
    { type: 'Column', id: 'body', verticalArrangement: 'SpacedBy', spacing: '6', modifiers: [{ type: 'FillSize' }, { type: 'VerticalScroll' }, { type: 'Padding', all: '16' }],
      children: [text(chip ? 'Status bar position' : 'Island position', 18, '', { fontWeight: 'Bold' })].concat(sliders, [
        { type: 'Row', id: 'buttons', verticalAlignment: 'Center', horizontalArrangement: 'End', spacing: '8', modifiers: [{ type: 'FillWidth' }],
          children: [button('Cancel', 'cancel', false), button('Done', 'done', true)] }]) }] }
});

// At the bottom of the screen, its full width less 8 dp each side, clear of the gesture bar
var screenW = parseInt(get('BusScreenW'), 10) || (typeof screen !== 'undefined' && Math.round(screen.width)) || 412;
var screenH = (typeof screen !== 'undefined' && Math.round(screen.height)) || 900;
// 380 dp tall: room for the title, two sliders and the buttons at Android's larger font sizes (4.53: 300 cut them off)
var PANEL_H = 380;
var bush = String(PANEL_H);
var busww = String(screenW - 16);
var busx = '8';
var busy = String(Math.max(120, screenH - PANEL_H - 48));
