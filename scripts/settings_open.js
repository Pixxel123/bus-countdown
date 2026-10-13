/* ==================================================================
   Bus Settings · Build the settings screen
   A native Scene V2 layout (cards, text inputs, checkboxes, segmented
   buttons, sliders, buttons). Each control writes its value to a screen
   variable while you use it; Save changes sets bus_save=yes and closes
   the screen, and the next step of this task saves what changed.
   Input : http_data (TfL stops within 400 m of you, with their routes),
           bp_* (permission checks from the Java steps above)
   Output: buslayout (the layout), BusTempSettings (what was shown)
   ================================================================== */
/* @include get */
/* @include loc */
/* @include metres */
/* @include wifiName */
/* @include stopLetter */
// Screen variable names spell numbers with letters (0-9 become a-j: stop 1, route 566 ->
// sr_b_eggx_on). That turned out not to be why taps were lost (see BusTempTicks), but it keeps
// names clear of Tasker's array naming (a name ending in digits reads as an array item).
function letters(x) { return String(x).toLowerCase().replace(/[0-9]/g, function (d) { return 'abcdefghij'.charAt(+d); }).replace(/[^a-z]/g, 'z'); }
function tickVar(k, route) { return 'sr_' + letters(k) + '_' + letters(route) + 'x_on'; }
function boxVar(k) { return 'stop_c_' + letters(k) + '_m'; }
function distVar(k) { return 'stop_r_' + letters(k); }

// ---- Current values -------------------------------------------------
// busrebuild=yes: redrawing the open screen after Reset position; reuse the first run's findings
var rebuild = loc('busrebuild') === 'yes';
var before = rebuild ? JSON.parse(get('BusTempSettings') || '{}') : {};
var mine = get('BusRoutes').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
// Stops near you, each with the bus routes that call there (from TfL's stops-near-a-point search)
var near = before.near || [];
var hereLat = parseFloat(loc('gl_latitude')); var hereLon = parseFloat(loc('gl_longitude'));
if (!rebuild && loc('http_response_code') === '200') {
  try {
    JSON.parse(http_data).stopPoints.forEach(function (st) {
      var bus = [];
      (st.lineModeGroups || []).forEach(function (g) { if (g.modeName === 'bus') bus = bus.concat(g.lineIdentifier || []); });
      if (!bus.length) (st.lines || []).forEach(function (l) { bus.push(l.id); });
      bus = bus.map(function (r) { return String(r).toUpperCase(); }).filter(function (r, k, all) { return all.indexOf(r) === k; });
      var towards = '';
      (st.additionalProperties || []).forEach(function (p) { if (p.key === 'Towards' && p.value) towards = String(p.value); });
      if (bus.length) near.push({ id: st.naptanId, name: String(st.commonName + (st.indicator ? ' (' + st.indicator + ')' : '')).replace(/\s*[|,]\s*/g, ' '),
                                  lat: st.lat, lon: st.lon, d: Math.round(st.distance || 0), routes: bus, towards: towards });
    });
  } catch (e) {}
}

var wifiNow = before.wifiNow || '';
if (!rebuild) {
  // Asked of Android just before this (busssid)
  wifiNow = wifiName();
}

// Presets for the segmented buttons: [label, value]
var P = {
  refresh: [['30 s', 30], ['45 s', 45], ['60 s', 60], ['90 s', 90]],
  timeout: [['15 min', 15], ['30 min', 30], ['45 min', 45], ['60 min', 60]],
  rotate:  [['4 s', 4], ['6 s', 6], ['8 s', 8], ['10 s', 10]],
  radius:  [['200 m', 200], ['300 m', 300], ['500 m', 500], ['800 m', 800]],
  style:   [['Island', 'pill'], ['Status bar', 'chip']],
  border:  [['Off', 'off'], ['On', 'on']],
  near:    [['40 m', 40], ['60 m', 60], ['100 m', 100], ['150 m', 150]]
};
function closest(list, current) {
  var best = 0;
  list.forEach(function (p, k) {
    if (p[1] === current) { best = k; return; }
    if (typeof p[1] === 'number' && typeof list[best][1] === 'number' && list[best][1] !== current &&
        Math.abs(p[1] - parseFloat(current)) < Math.abs(list[best][1] - parseFloat(current))) best = k;
  });
  return best;
}

// ---- Component helpers ----------------------------------------------
var n = 0;
function id(p) { n += 1; return p + '_' + n; }
function text(t, size, color, extra) { var c = { type: 'Text', id: id('t'), text: t, textSize: String(size || 14) }; if (color) c.color = color; for (var k in extra || {}) c[k] = extra[k]; return c; }
function out(event, key, variable) { return { events: [{ type: event }], actions: [{ type: 'OutputToVariable', bindings: (function () { var b = {}; b[key] = [variable]; return b; })() }] }; }
function card(title, children) {
  return { type: 'Card', id: id('card'), style: 'Filled', modifiers: [{ type: 'FillWidth' }], children: [
    { type: 'Column', id: id('col'), verticalArrangement: 'SpacedBy', spacing: '10',
      modifiers: [{ type: 'FillWidth' }, { type: 'Padding', all: '16' }],
      children: [text(title, 17)].concat(children) }] };
}
function row(children) { return { type: 'Row', id: id('row'), verticalAlignment: 'Center', horizontalArrangement: 'SpaceBetween', modifiers: [{ type: 'FillWidth' }], children: children }; }
function input(label, value, variable) {
  return { type: 'TextInput', id: id('in'), label: label, text: value, modifiers: [{ type: 'FillWidth' }],
           eventHandlers: { handlers: [out('text_changed', 'text', variable)] } };
}
// Each segment writes its own value when tapped, so saving never depends on how
// the row numbers its segments. The row's index is kept too, as a fallback.
function segs(label, list, current, variable) {
  return [text(label, 13, 'onSurfaceVariant'),
    // selectedIndices counts from 1 on this Tasker, like the index it reports back (tested: with
    // 17:00 saved, "3" ticked 16:30, the second segment... so the index here is closest + 1)
    { type: 'SegmentedButtonRow', id: id('seg'), selectionMode: 'Single', selectedIndices: String(closest(list, current) + 1),
      modifiers: [{ type: 'FillWidth' }],
      content: list.map(function (p) {
        return { type: 'SegmentedButtonItem', id: id('segi'), label: p[0],
                 eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(variable, String(p[1]))] }] } };
      }),
      eventHandlers: { handlers: [out('selection_changed', 'selected_index', variable + '_i')] } }];
}
// Choices (4.62): rows that open, as Android's own Settings does it. Closed, a row says the setting and
// what it's set to; a tap opens its options underneath, one to a line with a radio mark, and picking one
// saves it straight away (Bus Settings Button, as before) and closes the list. Tapping the row again
// closes it unchanged. Hidden parts of the screen still take up their spacing on the phone, so each
// choice is a Column with no spacing, and the two radio marks share one Box.
//   rowsOf(label, ov, options, extra): options are [{ label, summary, on, actions }]; ov is the screen
//   variable that opens the list; extra goes under the list (Start within's box for a distance)
function rowsOf(label, ov, options, extra) {
  var open = '%' + ov + ' == "yes"';
  var header = function (when, to, withSummary) {
    return { type: 'Row', id: id('chh'), showWhen: when, verticalAlignment: 'Center', modifiers: [{ type: 'FillWidth' }, { type: 'Padding', vertical: '8' }],
      eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(ov, to)] }] },
      children: [{ type: 'Column', id: id('chc'), verticalArrangement: 'SpacedBy', spacing: '2', children: [text(label, 16)].concat(withSummary
        ? [{ type: 'Box', id: id('chs'), children: options.map(function (o) { return text(o.summary || o.label, 14, 'primary', { showWhen: o.on }); }) }] : []) }] };
  };
  var rows = options.map(function (o) {
    return { type: 'Row', id: id('cho'), verticalAlignment: 'Center', horizontalArrangement: 'SpacedBy', spacing: '16',
      modifiers: [{ type: 'FillWidth' }, { type: 'Padding', vertical: '10' }],
      eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: o.actions.concat([setVar(ov, 'no')]) }] },
      children: [{ type: 'Box', id: id('rad'), children: [
        { type: 'Image', id: id('radon'), url: 'icon:RadioButtonChecked', tint: 'primary', showWhen: o.on, modifiers: [{ type: 'Size', width: '24', height: '24' }] },
        { type: 'Image', id: id('radoff'), url: 'icon:RadioButtonUnchecked', tint: 'onSurfaceVariant', showWhen: '!(' + o.on + ')', modifiers: [{ type: 'Size', width: '24', height: '24' }] }] },
        text(o.label, 16)] };
  });
  return [{ type: 'Column', id: id('ch'), modifiers: [{ type: 'FillWidth' }], children: [header('!(' + open + ')', 'yes', true), header(open, 'no', false),
    { type: 'Column', id: id('chl'), showWhen: open, modifiers: [{ type: 'FillWidth' }], children: rows }].concat(extra || []) }];
}
// One setting's choices. The one in use is marked until another is picked (the screen variable ch_..._x
// starts empty), and picking one saves it at once.
function choices(label, list, current, setting) {
  var key = setting.toLowerCase().replace(/[^a-z]/g, '');
  var cv = '%ch_' + key + '_x';
  var values = list.map(function (p) { return String(p[1]); });
  var cur = values[closest(list, current)];
  var untouched = '(' + values.map(function (v) { return cv + ' != "' + v + '"'; }).join(' & ') + ')';
  return rowsOf(label, 'op_' + key + '_x', list.map(function (p) {
    var v = String(p[1]);
    return { label: p[0], on: cv + ' == "' + v + '"' + (v === cur ? ' | ' + untouched : ''),
             actions: [setVar(cv.slice(1), v), runTask('Bus Settings Button', { busaction: 'set', bussetting: setting, busvalue: v })] };
  }));
}
// A small title over a group of settings (4.62), and a line under a setting saying what it does
function groupTitle(t) { return text(t, 15, 'primary', { fontWeight: 'Bold' }); }
function help(t) { return text(t, 13, 'onSurfaceVariant'); }
// A line of text you can tap (4.62): the side switch and Remove stop. A Button has padding of its own,
// which set its text in from the stop's name; a Row's text lines up with it.
function textAction(label, color, actions, top) {
  return { type: 'Row', id: id('act'), verticalAlignment: 'Center', modifiers: [{ type: 'Padding', top: top || '10', bottom: '10' }],
           eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: actions }] },
           children: [text(label, 15, color, { fontWeight: 'Bold' })] };
}

// Sliders have fixed ids (sl_w, sl_gap, sl_y) so Bus Find Camera can move them after Reset position
function slider(label, min, max, step, value, variable) {
  return [text(label + ' (was ' + value + ' dp)', 14),
    { type: 'Slider', id: 'sl_' + variable.replace(/^set_/, ''), min: String(min), max: String(max), steps: String(Math.round((max - min) / step) - 1), value: String(value),
      modifiers: [{ type: 'FillWidth' }], eventHandlers: { handlers: [out('slider_value_changed', 'value', variable)] } }];
}
// Option buttons sit in a FlowRow, which wraps onto a new line instead of squeezing the
// last button (a squeezed "800 m" stacked its letters one per line)
function flow(children) {
  return { type: 'FlowRow', id: id('flow'), horizontalArrangement: 'SpacedBy', spacingHorizontal: '8',
           verticalArrangement: 'SpacedBy', spacingVertical: '4', itemVerticalAlignment: 'Center',
           modifiers: [{ type: 'FillWidth' }], children: children };
}
// Unselected options: the theme name "surfaceVariant" wasn't applied (they showed as bare text),
// so plain colours are used
var OFF_FILL = '#343B48'; var OFF_TEXT = '#D5DBE6';
var ERROR = '#FFB4AB';                       // Material 3's dark error colour (4.62: Remove stop)
function button(label, actions) { return { type: 'Button', id: id('btn'), text: label, eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: actions }] } }; }
function runTask(task, vars) { return { type: 'RunTask', task: task, variables: vars || {} }; }
function setVar(v, value) { return { type: 'SetVariable', variable: v, value: value }; }

// ---- Sections, most used first ------------------------------------------
// Stops and routes, Countdown, When to watch, Island, then Setup and troubleshooting.
// Choices apply straight away; text boxes, sliders, routes and distances are saved when the
// screen closes (Done, or the back gesture).
var setup = !get('TflKey') || !get('BusRoutes');   // first run: show the note at the top

// ---- Pages (4.44) -------------------------------------------------------
// Laid out like Android's own Settings: a main page of entries, each opening a page of its own,
// with the top bar's back arrow going back up (and, from the main page, saving and closing). The
// page showing is the screen variable bus_page; every page is in the layout, shown or hidden.
var PAGE_VAR = 'bus_page';
var PAGES = ['stops', 'countdown', 'wifi', 'island', 'position', 'setup'];
// Opening on a page of its own (busstartpage, 4.52: back from the live position editor, on Position):
// that page also shows while bus_page is still empty, and the main page doesn't. If the screen gives
// an unset variable as its name rather than empty, neither applies, and it opens on the main page.
var START = PAGES.indexOf(loc('busstartpage')) > -1 ? loc('busstartpage') : '';
function onPage(pg) { return pg === START ? '(%' + PAGE_VAR + ' == "' + pg + '" | %' + PAGE_VAR + ' == "")' : '%' + PAGE_VAR + ' == "' + pg + '"'; }
var ON_MAIN = PAGES.map(function (pg) { return '%' + PAGE_VAR + ' != "' + pg + '"'; }).join(' & ') + (START ? ' & %' + PAGE_VAR + ' != ""' : '');
function page(pg, children) {
  return { type: 'Column', id: 'page_' + pg, showWhen: pg === 'main' ? ON_MAIN : onPage(pg), verticalArrangement: 'SpacedBy', spacing: '12',
           modifiers: [{ type: 'FillWidth' }], children: children };
}
// A group of rows, as Settings draws them: one rounded block
// (spacing '0': a list whose items are hidden and shown, which give themselves room above instead)
function group(children, spacing) {
  return { type: 'Card', id: id('grp'), style: 'Filled', modifiers: [{ type: 'FillWidth' }], children: [
    { type: 'Column', id: id('col'), verticalArrangement: 'SpacedBy', spacing: spacing || '10',
      modifiers: [{ type: 'FillWidth' }, { type: 'Padding', all: '16' }], children: children }] };
}
// An entry on the main page: its icon, its name and what it's set to now; a tap opens its page
function entry(icon, title, summary, to) {
  return { type: 'Row', id: id('ent'), verticalAlignment: 'Center', horizontalArrangement: 'SpacedBy', spacing: '16',
    modifiers: [{ type: 'FillWidth' }, { type: 'Padding', horizontal: '16', vertical: '14' }],
    eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(PAGE_VAR, to)] }] },
    children: [{ type: 'Image', id: id('ico'), url: 'icon:' + icon, tint: 'primary', modifiers: [{ type: 'Size', width: '24', height: '24' }] },
      { type: 'Column', id: id('ec'), verticalArrangement: 'SpacedBy', spacing: '2', modifiers: [{ type: 'FillWidth' }],
        children: [text(title, 17), text(summary, 14, 'onSurfaceVariant')] }] };
}

function wifiBlock(label, current, inVar, setting, clearable) {
  var parts = [input(label, current, inVar)];
  var buttons = [];
  var usedVar = 'wf_' + setting.toLowerCase().replace(/[^a-z]/g, '') + '_x';
  if (wifiNow && wifiNow !== current)
    buttons.push(button('Use ' + wifiNow, [setVar(usedVar, 'used'), runTask('Bus Settings Button', { busaction: 'set', bussetting: setting, busvalue: wifiNow })]));
  if (clearable && current)
    buttons.push(button('Clear', [setVar(usedVar, 'cleared'), runTask('Bus Settings Button', { busaction: 'set', bussetting: setting, busvalue: '' })]));
  if (buttons.length) parts.push(flow(buttons));
  // ("Set to" and "Cleared" share one place, as a hidden line still takes up its spacing, 4.62)
  var said = [];
  if (wifiNow) said.push(text('Set to ' + wifiNow, 13, 'primary', { showWhen: '%' + usedVar + ' == "used"' }));
  if (clearable) said.push(text('Cleared', 13, 'primary', { showWhen: '%' + usedVar + ' == "cleared"' }));
  if (said.length) parts.push({ type: 'Box', id: id('said'), children: said });
  return parts;
}

// ---- Stops and routes ---------------------------------------------
// Your saved stops first, then other stops near you. Tick the routes you want at each stop:
// a stop with a ticked route is saved, and your routes are all the routes ticked anywhere.
// Saved stops also get their arrival distance: 50 m, 100 m, 200 m or Custom.
var defaultNear = parseFloat(get('BusNearRadius')) || 50;
var stopPool = JSON.parse(get('BusCacheStops') || '{}');
var PRESETS = [50, 100, 200];
var stopsShown = [];
function metresFromHere(lat, lon) {
  if (isNaN(hereLat) || isNaN(hereLon)) return null;
  return Math.round(metres(hereLat, hereLon, lat, lon));
}
get('BusPlaces').split('\n').forEach(function (line, i) {
  var p = line.split('|');                                   // type|id|name|lat|lon|radius
  if (p[0] !== 'bus' || p.length < 5) return;
  var nearby = near.filter(function (x) { return x.id === p[1]; })[0];
  var known = stopPool[p[1]] ? stopPool[p[1]].r : [];
  var here = (nearby ? nearby.routes : []).concat(known).filter(function (r, k, all) { return all.indexOf(r) === k; });
  mine.forEach(function (r) { if (known.indexOf(r) > -1 && here.indexOf(r) < 0) here.push(r); });
  stopsShown.push({ id: p[1], name: p[2], lat: +p[3], lon: +p[4], saved: true, line: i,
                    towards: (nearby && nearby.towards) || (stopPool[p[1]] && stopPool[p[1]].t) || '',
                    own: parseFloat(p[5]) > 0 ? Math.round(parseFloat(p[5])) : 0,
                    routes: here.length ? here : mine.slice(), ticked: (here.length ? here : mine).filter(function (r) { return mine.indexOf(r) > -1; }) });
});
// The nearest 6 not saved (10 before 4.58): each stop adds 10 to 20 KB to the screen's layout, and with
// 10 it came to about 280 KB, which Tasker has to hand to the screen in one go (on Monday 12 October,
// Settings opened during a countdown restarted Tasker; this takes up to about 75 KB off the layout)
near.filter(function (x) { return !stopsShown.some(function (s) { return s.id === x.id; }); })
    .sort(function (a, b) { return a.d - b.d; }).slice(0, 6)
    .forEach(function (x) { stopsShown.push({ id: x.id, name: x.name, lat: x.lat, lon: x.lon, saved: false, towards: x.towards || '', line: -1, own: 0, routes: x.routes, ticked: [] }); });

// Taps are also recorded by the Bus Settings Button task in BusTempTicks, because a screen
// variable set by a button that then hides itself may not come back to this task.
if (!rebuild) { setGlobal('BusTempTicks', '{}'); setGlobal('BusTempDists', '{}'); setGlobal('BusTempRemoved', '{}'); }

// Each route is a pair of buttons ("566" and "✓ 566"); tapping one sets the route's screen variable
// to y or n and swaps which button shows. (Checkboxes' ticks didn't reach the task on this phone;
// button actions do.) Every stop is drawn twice: under "Your stops" while any route is ticked,
// and under "Stops near you" otherwise, so ticking a route moves the stop up straight away.
function tickedExpr(k, st, r) { var v = '%' + tickVar(k, r); return st.ticked.indexOf(r) > -1 ? v + ' != "n"' : v + ' == "y"'; }
function onExpr(k, st) { return st.routes.map(function (r) { return '(' + tickedExpr(k, st, r) + ')'; }).join(' | ') || 'false'; }
function routeButtons(k, st) {
  return [flow(st.routes.reduce(function (acc, r) {
    var on = tickedExpr(k, st, r);
    return acc.concat([
      { type: 'Button', id: id('ron'), text: '\u2713 ' + r, showWhen: on,
        eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(tickVar(k, r), 'n'),
          runTask('Bus Settings Button', { busaction: 'tick', busstop: letters(k), busroute: r, busvalue: 'n' })] }] } },
      { type: 'Button', id: id('roff'), text: r, buttonColor: OFF_FILL, textColor: OFF_TEXT, showWhen: '!(' + on + ')',
        eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(tickVar(k, r), 'y'),
          runTask('Bus Settings Button', { busaction: 'tick', busstop: letters(k), busroute: r, busvalue: 'y' })] }] } }]);
  }, []))];
}

// The arrival-distance controls for one stop (k)
function distanceParts(st, k) {
  var effective = st.own || defaultNear;
  var isCustom = PRESETS.indexOf(effective) < 0;
  var dv = '%' + 'stop_d_' + letters(k) + '_x';                 // "50", "100", "200" or "custom" once chosen
  var chosen = function (v) { return dv + ' == "' + v + '"'; };
  var untouched = '(' + [50, 100, 200].map(function (m) { return dv + ' != "' + m + '"'; }).join(' & ') + ' & ' + dv + ' != "custom")';
  var record = function (value) { return runTask('Bus Settings Button', { busaction: 'dist', busstop: letters(k), busvalue: value }); };
  var editVar = 'stop_e_' + letters(k) + '_x';
  var customOn = chosen('custom') + (isCustom ? ' | ' + untouched : '');
  var options = PRESETS.map(function (m) {
    return { label: m + ' m', on: chosen(m) + (effective === m && !isCustom ? ' | ' + untouched : ''),
             actions: [setVar('stop_d_' + letters(k) + '_x', String(m)), setVar(editVar, 'no'), record(String(m))] };
  }).concat([{ label: 'Custom', summary: isCustom ? 'Custom, ' + effective + ' m' : 'Custom', on: customOn, actions: [setVar(editVar, 'yes')] }]);
  // Custom shows a box to type the distance, and Use custom applies it; picking a preset hides it again
  var box = input('Distance in metres (up to 200)', isCustom ? String(effective) : '', boxVar(k));
  box.showWhen = '%' + editVar + ' == "yes"';
  var use = button('Use custom', [setVar('stop_d_' + letters(k) + '_x', 'custom'), setVar(editVar, 'no'), record('%' + boxVar(k))]);
  var distParts = rowsOf('Start within', 'op_d' + letters(k) + '_x', options, [{ type: 'Column', id: id('cust'), verticalArrangement: 'SpacedBy', spacing: '8',
    showWhen: '%' + editVar + ' == "yes"', modifiers: [{ type: 'FillWidth' }], children: [box, use] }]);
  st.effective = effective;
  return distParts;
}

// Stops across the road from each other share a name (apart from the part in brackets) and are
// close together. They're shown as one entry, one side at a time, with a ⇄ button to switch,
// instead of repeating the name, routes and distance controls on two separate entries.
function baseName(name) { return String(name).replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase(); }
function metresApart(a, b) { return metres(a.lat, a.lon, b.lat, b.lon); }
var units = []; var used = {};
stopsShown.forEach(function (st, k) {
  if (used[k]) return;
  used[k] = true;
  var best = -1; var bestD = 251;
  stopsShown.forEach(function (o, j) {
    if (used[j] || baseName(o.name) !== baseName(st.name)) return;
    var d = metresApart(st, o);
    if (d < bestD) { best = j; bestD = d; }
  });
  if (best < 0) { units.push([k]); return; }
  used[best] = true;
  // Side shown first: the one you use (has a ticked route), otherwise the nearer
  var a = k; var b = best;
  if (!stopsShown[a].ticked.length && stopsShown[b].ticked.length) { a = best; b = k; }
  units.push([a, b]);
});

// One side's details: which way it goes and how far you are, its routes, and (under "Your stops",
// while one of its routes is ticked) its arrival distance
function sideLine(st) {
  var d = metresFromHere(st.lat, st.lon); var m = String(st.name).match(/\(([^)]*)\)\s*$/); var bits = [];
  if (m) bits.push(m[1]);
  if (st.towards) bits.push('towards ' + st.towards);
  if (d !== null) bits.push(d + ' m from you');
  var t = bits.join(', ');
  return t ? [text(t.charAt(0).toUpperCase() + t.slice(1), 12, 'onSurfaceVariant')] : [];
}
// Saved stops get a Remove button. Tapping it hides the stop's details and shows "Removed" with
// Undo; the stop is taken off your list when the screen closes (recorded by Bus Settings Button in
// BusTempRemoved, like route taps, since values set inside the stop list don't reliably come back).
function removedVar(k) { return 'rm_' + letters(k) + '_x'; }
function sideParts(k, withDistance) {
  var st = stopsShown[k];
  var parts = sideLine(st).concat(routeButtons(k, st));
  if (withDistance) parts.push({ type: 'Column', id: id('dist'), showWhen: onExpr(k, st), verticalArrangement: 'SpacedBy', spacing: '6',
                                 modifiers: [{ type: 'FillWidth' }], children: distanceParts(st, k) });
  if (!(withDistance && st.saved)) return parts;
  var rv = removedVar(k); var gone = '%' + rv + ' == "yes"';
  // (4.62: red text on a line of its own, with room above it, so it can't be taken for an unticked route)
  var removeBtn = textAction('Remove stop', ERROR, [setVar(rv, 'yes'),
    runTask('Bus Settings Button', { busaction: 'remove', busstop: letters(k), busvalue: 'yes' })], '18');
  var undoBtn = { type: 'Button', id: id('rmu'), text: 'Undo',
    eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(rv, 'no'),
      runTask('Bus Settings Button', { busaction: 'remove', busstop: letters(k), busvalue: 'no' })] }] } };
  return [{ type: 'Box', id: id('rmx'), modifiers: [{ type: 'FillWidth' }], children: [
    { type: 'Column', id: id('keep'), showWhen: '!(' + gone + ')', verticalArrangement: 'SpacedBy', spacing: '6',
      modifiers: [{ type: 'FillWidth' }], children: parts.concat([removeBtn]) },
    { type: 'Row', id: id('gone'), showWhen: gone, verticalAlignment: 'Center', horizontalArrangement: 'SpaceBetween',
      modifiers: [{ type: 'FillWidth' }], children: [text('Removed when you close Settings', 13, 'onSurfaceVariant'), undoBtn] }] }];
}
function unitBlock(unit, ui, withDistance, showWhen) {
  var col = function (parts, when, top) {
    var c = { type: 'Column', id: id('col'), verticalArrangement: 'SpacedBy', spacing: '6', modifiers: [{ type: 'FillWidth' }], children: parts };
    if (top) c.modifiers.push({ type: 'Padding', top: top });
    if (when) c.showWhen = when;
    return c;
  };
  showWhen = showWhen || '';
  if (unit.length === 1) {
    var st = stopsShown[unit[0]];
    return col([text(st.name, 16, '', { fontWeight: 'Bold' })].concat(sideParts(unit[0], withDistance)), showWhen, '16');
  }
  var side = '%pr_' + letters(ui) + '_x'; var sideB = side + ' == "b"';
  // (4.62) The switch says where it goes ("Switch to Stop KJ \u21c4"; "other side" when that side has no
  // letter), on a line of its own under the name, so a long name never squeezes it. (A bare "Stop KJ"
  // there read as the name of the side showing.)
  var flip = function (to, when) {
    var l = stopLetter(stopsShown[unit[to === 'b' ? 1 : 0]].name);
    var f = textAction('Switch to ' + (l ? 'Stop ' + l : 'other side') + ' \u21c4', 'primary', [setVar(side.slice(1), to)], '2');
    f.showWhen = when;
    return f;
  };
  var title = String(stopsShown[unit[0]].name).replace(/\s*\([^)]*\)\s*$/, '');
  var both = function (parts) { return { type: 'Box', id: id('sides'), modifiers: [{ type: 'FillWidth' }], children: parts }; };
  return col([
    text(title, 16, '', { fontWeight: 'Bold' }),
    both([flip('b', '!(' + sideB + ')'), flip('a', sideB)]),
    both([col(sideParts(unit[0], withDistance), '!(' + sideB + ')'), col(sideParts(unit[1], withDistance), sideB)])
  ], showWhen, '16');
}

var yours = []; var others = [];
units.forEach(function (unit, ui) {
  var on = unit.map(function (k) { return '(' + onExpr(k, stopsShown[k]) + ')'; }).join(' | ');
  yours.push(unitBlock(unit, ui, true, on));
  others.push(unitBlock(unit, ui, false, '!(' + on + ')'));
});

// (4.62: no hint line above them; each switch says what it does)
var stopBlocks = [text('Your stops', 15, 'primary', { fontWeight: 'Bold' })].concat(yours,
                 [text('Stops near you', 15, 'primary', { fontWeight: 'Bold', modifiers: [{ type: 'Padding', top: '24' }] })], others);
if (stopsShown.length === 0) stopBlocks.push(text('No stops found near you. Open Settings again near a stop you use.', 14, 'onSurfaceVariant', { modifiers: [{ type: 'Padding', top: '14' }] }));
var stopsPage = [group(stopBlocks, '0')];

// (4.62: in three groups, each a title over a card)
var countdownPage = [
  groupTitle('While it runs'),
  group(choices('Update every', P.refresh, get('BusRefresh') || 45, 'BusRefresh')
    .concat(choices('Stop after', P.timeout, get('BusTimeout') || 30, 'BusTimeout'))
    .concat(choices('Rotate routes every', P.rotate, get('BusRotate') || 6, 'BusRotate'))),
  groupTitle('Starting one'),
  group(choices('Manual start searches within', P.radius, get('BusRadius') || 300, 'BusRadius')
    .concat(choices('Heading to a stop', [['Off', 'off'], ['Walking', 'walk'], ['Walking + bus', 'both']], get('BusApproach') || 'both', 'BusApproach'))
    .concat(choices('Minutes ahead', [['2', '2'], ['3', '3'], ['5', '5']], get('BusApproachMin') || '3', 'BusApproachMin'))
    .concat([help('How early the island comes up when you\u2019re heading for a stop.')])),
  groupTitle('Recording'),
  group(choices('Record trips', [['Off', 'off'], ['On', 'on']], get('BusRecord') || 'off', 'BusRecord')
    .concat([help('One file a day in Download/Tasker-bus-trip-data, kept until you delete it.')]))];

var wifiPage = [group(
  wifiBlock('Home Wi-Fi', get('BusHomeWifi'), 'home_wifi', 'BusHomeWifi', false)
  .concat(wifiBlock('Work Wi-Fi', get('BusWorkWifi'), 'work_wifi', 'BusWorkWifi', true))
  .concat([text('No countdowns on these networks.', 13, 'onSurfaceVariant')])
  .concat(choices('On leaving, show the nearest stop\u2019s next buses', [['Work', 'work'], ['Home', 'home'], ['Both', 'both'], ['Off', 'off']],
                  get('BusLeaveShow') || 'work', 'BusLeaveShow'))
  .concat(choices('Work heads-up from',
                  [['Off', 'off'], ['16:30', '16:30'], ['17:00', '17:00'], ['17:30', '17:30']], get('BusGlanceFrom') || '17:00', 'BusGlanceFrom'))
  .concat(choices('Work heads-up until', [['17:30', '17:30'], ['18:00', '18:00'], ['18:30', '18:30'], ['19:00', '19:00']], get('BusGlanceTo') || '18:00', 'BusGlanceTo'))
  .concat([help('Shows the next buses for a minute when the screen turns on at work.')]))];

// Island
var gap = parseInt(get('BusIslandGap'), 10) || 42;
var y = parseInt(get('BusIslandY'), 10); if (!(y >= 0)) y = 9;
var islandPage = [group(
  choices('Show as', P.style, get('BusStyle') || 'pill', 'BusStyle')
  .concat(choices('Countdown border', P.border, get('BusBorder') || 'off', 'BusBorder'))
  // The buzz when a bus is under 5 minutes away (4.49)
  .concat(choices('Buzz when a bus is under 5 min away', [['On', 'on'], ['Off', 'off']], get('BusBuzz') || 'on', 'BusBuzz'))
  .concat(choices('Destination length', [['3 letters', '3'], ['6 letters', '6'], ['10 letters', '10']], get('BusDestLetters') || '3', 'BusDestLetters'))
  // The stop board (4.42): tap the island to see every bus at the stop
  .concat(choices('Stop board shows', [['All routes', 'all'], ['Your routes', 'mine']], get('BusBoardRoutes') || 'all', 'BusBoardRoutes'))
  .concat(choices('Stop board closes', [['After 10 s', '10'], ['After 30 s', '30'], ['When tapped', '0']], get('BusBoardSecs') || '10', 'BusBoardSecs'))),
  // Where the island sits is a page of its own, one level down
  group([entry('CropFree', 'Position', 'Camera gap ' + gap + ' dp, ' + y + ' dp from the top', 'position')])];
var positionPage = [group(
  slider('Camera gap', 26, 80, 1, Math.min(80, Math.max(26, gap)), 'set_gap')
  .concat(slider('Top offset', 0, 24, 1, Math.min(24, y), 'set_y'))
  .concat(slider('Chip offset from left', 0, 200, 2, Math.min(200, parseInt(get('BusChipX'), 10) >= 0 ? parseInt(get('BusChipX'), 10) : 76), 'set_cx'))
  // Adjust live (4.52, in place of Preview) closes this screen (saving) and shows the island where it
  // goes, with sliders at the bottom of the screen that move it as they slide (Bus Position); Done
  // there saves and reopens Settings on this page. Showing it on top of the open screen did nothing,
  // and left the screen unable to report that it had closed.
  .concat([row([button('Adjust live', [setVar('bus_live', 'yes'), { type: 'DismissLayout' }]),
                // Reset position: measure the camera again and put the gap and height back to fit it.
                // Clearing the two slider variables means closing the screen won't overwrite the reset.
                button('Reset', [setVar('set_gap', ''), setVar('set_y', ''), runTask('Bus Find Camera', { busrebuild: 'yes' })])]),
           text(get('BusCameraX') ? 'Reset re-measures the camera.' : 'Camera not measured yet. Tap Reset.', 13, 'onSurfaceVariant')]))];

// Setup and troubleshooting: the TfL key, and permissions (one line when they're all on)
var tasker = 'net.dinglisch.android.taskerm';
var PERMS = rebuild && before.perms ? before.perms : [
  ['Location', loc('bp_fine') === '0', 'app'],
  ['Location all the time', loc('bp_bg') === '0', 'app'],
  ['Display over other apps', loc('bp_overlay') === 'true', 'overlay'],
  ['Accessibility service', loc('bp_access').indexOf(tasker) > -1, 'access'],
  ['Battery unrestricted', loc('bp_battery') === 'true', 'app']
];
var missing = PERMS.filter(function (p) { return !p[1]; });
// The TfL key (4.62): hidden, as its last four characters and Change, which shows the box to type a new
// one; with no key yet, the box straight away. The two share one place (a hidden part keeps its spacing).
var KEY = get('TflKey'); var KEY_EDIT = '%key_edit_x == "yes"';
var keyBox = input('TfL key', KEY, 'tfl_key');
var keyParts = [keyBox];
if (KEY) {
  keyBox.showWhen = KEY_EDIT;
  var masked = row([text('TfL key: \u2022\u2022\u2022\u2022' + KEY.slice(-4), 15), button('Change', [setVar('key_edit_x', 'yes')])]);
  masked.showWhen = '!(' + KEY_EDIT + ')';
  keyParts = [{ type: 'Box', id: id('key'), modifiers: [{ type: 'FillWidth' }], children: [masked, keyBox] }];
}
var setupPage = [group(keyParts.concat(
  missing.length
    ? [text('Needed:', 13, 'onSurfaceVariant')].concat(missing.map(function (p) {
        return row([text(p[0], 15), button('Turn on', [runTask('Bus Settings Button', { busaction: p[2] })])]);
      }))
    : [text('All permissions are on.', 14, 'primary')]))];

// ---- The main page: an entry for each page, saying what it's set to now ----
// (4.62) One line per road, as the Stops page shows them: with both sides saved, the routes ticked on
// either side. Listed by stop, the two sides read as the same stop twice, as the name leaves the side off.
var myStops = [];
units.forEach(function (unit) {
  var used = unit.filter(function (k) { return stopsShown[k].saved && stopsShown[k].ticked.length; });
  if (!used.length) return;
  var routes = [];
  used.forEach(function (k) { stopsShown[k].ticked.forEach(function (r) { if (routes.indexOf(r) < 0) routes.push(r); }); });
  myStops.push(String(stopsShown[used[0]].name).replace(/\s*\([^)]*\)\s*$/, '') + ': ' + routes.join(', '));
});
var label = function (list, current) { return list[closest(list, current)][0]; };
var mainPage = (setup ? [text('Add your TfL key under Setup, then pick routes at your stops.', 14, 'onSurfaceVariant')] : []).concat([
  group([entry('DirectionsBus', 'Stops and routes', myStops.length ? myStops.join('; ') : 'Pick the routes you use at your stops', 'stops')]),
  group([entry('Timer', 'Countdown', 'Every ' + label(P.refresh, get('BusRefresh') || 45) + ', ends after ' + label(P.timeout, get('BusTimeout') || 30), 'countdown'),
         entry('Wifi', 'Home and work', (get('BusHomeWifi') || 'No home Wi-Fi') + ' and ' + (get('BusWorkWifi') || 'no work Wi-Fi'), 'wifi'),
         entry('Smartphone', 'Island', label(P.style, get('BusStyle') || 'pill') + ', the stop board closes ' +
               ({ '10': 'after 10 s', '30': 'after 30 s', '0': 'when tapped' }[get('BusBoardSecs') || '10'] || 'after 10 s') +
               (get('BusBuzz') === 'off' ? ', no buzz' : ''), 'island')]),
  group([entry('Key', 'Setup', !get('TflKey') ? 'Add your TfL key' : missing.length ? missing.length + ' permission' + (missing.length > 1 ? 's' : '') + ' needed' : 'TfL key added, all permissions on', 'setup')])]);

// ---- The top bar: each page's title, and a back arrow that goes up a level ----
var TITLES = { main: 'Bus Countdown', stops: 'Stops and routes', countdown: 'Countdown', wifi: 'Home and work', island: 'Island', position: 'Position', setup: 'Setup' };
function back(when, actions) { return { type: 'IconButton', id: id('back'), icon: 'icon:ArrowBack', showWhen: when, eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: actions }] } }; }
var topBar = { type: 'TopAppBar', id: 'top_bar',
  title: [{ type: 'Box', id: 'titles', children: Object.keys(TITLES).map(function (pg) {
    return text(TITLES[pg], 22, '', { showWhen: pg === 'main' ? ON_MAIN : onPage(pg) }); }) }],
  // From the main page: save and close (as Done did). From Position: back to Island. Else: the main page.
  navigationIcon: [{ type: 'Box', id: 'backs', children: [
    back(ON_MAIN, [setVar('bus_save', 'yes'), { type: 'DismissLayout' }]),
    back(onPage('position'), [setVar(PAGE_VAR, 'island')]),
    back('!(' + ON_MAIN + ') & !(' + onPage('position') + ')', [setVar(PAGE_VAR, 'main')])] }] };

var buslayout = JSON.stringify({
  name: 'Bus Settings', defaultDisplayMode: 'FullscreenWithResult',
  root: { type: 'Scaffold', id: 'root', topBar: [topBar],
    content: [{ type: 'Column', id: 'body',
      modifiers: [{ type: 'FillSize' }, { type: 'VerticalScroll' }, { type: 'Padding', horizontal: '16', top: '4', bottom: '24' }],
      children: [page('main', mainPage), page('stops', stopsPage), page('countdown', countdownPage), page('wifi', wifiPage),
                 page('island', islandPage), page('position', positionPage), page('setup', setupPage)] }] }
});

// What was shown, so the save step knows the starting values
setGlobal('BusTempSettings', JSON.stringify({ mine: mine, near: near, wifiNow: wifiNow, perms: PERMS, P: P, stops: stopsShown }));
