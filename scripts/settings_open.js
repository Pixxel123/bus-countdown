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
      children: [text(title, 17, '', { maxLines: '1' })].concat(children) }] };
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
// Choices: one pattern everywhere (the same as routes and distances). Each option is a pair
// of buttons ("✓ 45 s" and "45 s"); a tap swaps the tick and runs Bus Settings Button, which
// saves the setting straight away. No Save button is needed.
function choices(label, list, current, setting) {
  var cv = '%ch_' + setting.toLowerCase().replace(/[^a-z]/g, '') + '_x';
  var values = list.map(function (p) { return String(p[1]); });
  var cur = values[closest(list, current)];
  var untouched = '(' + values.map(function (v) { return cv + ' != "' + v + '"'; }).join(' & ') + ')';
  var buttons = list.reduce(function (acc, p) {
    var v = String(p[1]); var on = cv + ' == "' + v + '"' + (v === cur ? ' | ' + untouched : '');
    var act = [setVar(cv.slice(1), v), runTask('Bus Settings Button', { busaction: 'set', bussetting: setting, busvalue: v })];
    return acc.concat([
      { type: 'Button', id: id('con'), text: '\u2713 ' + p[0], showWhen: on, eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: act }] } },
      { type: 'Button', id: id('coff'), text: p[0], buttonColor: OFF_FILL, textColor: OFF_TEXT, showWhen: '!(' + on + ')',
        eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: act }] } }]);
  }, []);
  var rows = [flow(buttons)];
  return [text(label, 13, 'onSurfaceVariant')].concat(rows);
}

// Sliders have fixed ids (sl_w, sl_gap, sl_y) so Bus Find Camera can move them after Reset position
function slider(label, min, max, step, value, variable) {
  return [text(label, 14),
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
function onPage(pg) { return '%' + PAGE_VAR + ' == "' + pg + '"'; }
var ON_MAIN = PAGES.map(function (pg) { return '%' + PAGE_VAR + ' != "' + pg + '"'; }).join(' & ');
function page(pg, children) {
  return { type: 'Column', id: 'page_' + pg, showWhen: pg === 'main' ? ON_MAIN : onPage(pg), verticalArrangement: 'SpacedBy', spacing: '12',
           modifiers: [{ type: 'FillWidth' }], children: children };
}
// A group of rows, as Settings draws them: one rounded block
function group(children) {
  return { type: 'Card', id: id('grp'), style: 'Filled', modifiers: [{ type: 'FillWidth' }], children: [
    { type: 'Column', id: id('col'), verticalArrangement: 'SpacedBy', spacing: '10',
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
  if (wifiNow) parts.push(text('Set to ' + wifiNow, 13, 'primary', { showWhen: '%' + usedVar + ' == "used"' }));
  if (clearable) parts.push(text('Cleared', 13, 'primary', { showWhen: '%' + usedVar + ' == "cleared"' }));
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
near.filter(function (x) { return !stopsShown.some(function (s) { return s.id === x.id; }); })
    .sort(function (a, b) { return a.d - b.d; }).slice(0, 10)
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
  var distParts = [text('Start within', 13, 'onSurfaceVariant')];
  distParts.push(flow(PRESETS.reduce(function (acc, m) {
      var on = chosen(m) + (effective === m && !isCustom ? ' | ' + untouched : '');
      return acc.concat([
        { type: 'Button', id: id('don'), text: '\u2713 ' + m + ' m', showWhen: on,
          eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar('stop_d_' + letters(k) + '_x', String(m)), setVar('stop_e_' + letters(k) + '_x', 'no'), record(String(m))] }] } },
        { type: 'Button', id: id('doff'), text: m + ' m', buttonColor: OFF_FILL, textColor: OFF_TEXT, showWhen: '!(' + on + ')',
          eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar('stop_d_' + letters(k) + '_x', String(m)), setVar('stop_e_' + letters(k) + '_x', 'no'), record(String(m))] }] } }]);
    }, [])));
  // Custom: always the fourth button in the row, filled ("\u2713 Custom 70 m") only while a custom
  // distance is in use. Tapping it shows a box to type the distance, and Use custom applies it.
  // Tapping a preset hides the box again.
  var editVar = 'stop_e_' + letters(k) + '_x';
  var customOn = chosen('custom') + (isCustom ? ' | ' + untouched : '');
  var openBox = [setVar(editVar, 'yes')];
  distParts[1].children = distParts[1].children.concat([
    { type: 'Button', id: id('cuon'), text: '\u2713 Custom' + (isCustom ? ' ' + effective + ' m' : ''), showWhen: customOn,
      eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: openBox }] } },
    { type: 'Button', id: id('cuoff'), text: 'Custom', buttonColor: OFF_FILL, textColor: OFF_TEXT, showWhen: '!(' + customOn + ')',
      eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: openBox }] } }]);
  var box = input('Distance in metres (up to 200)', isCustom ? String(effective) : '', boxVar(k));
  box.showWhen = '%' + editVar + ' == "yes"';
  distParts.push(box);
  var use = button('Use custom', [setVar('stop_d_' + letters(k) + '_x', 'custom'), record('%' + boxVar(k))]);
  use.showWhen = '%' + editVar + ' == "yes"';
  distParts.push(use);
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
  var removeBtn = { type: 'Button', id: id('rmb'), text: 'Remove stop', buttonColor: OFF_FILL, textColor: OFF_TEXT,
    eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(rv, 'yes'),
      runTask('Bus Settings Button', { busaction: 'remove', busstop: letters(k), busvalue: 'yes' })] }] } };
  var undoBtn = { type: 'Button', id: id('rmu'), text: 'Undo',
    eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(rv, 'no'),
      runTask('Bus Settings Button', { busaction: 'remove', busstop: letters(k), busvalue: 'no' })] }] } };
  return [
    { type: 'Column', id: id('keep'), showWhen: '!(' + gone + ')', verticalArrangement: 'SpacedBy', spacing: '6',
      modifiers: [{ type: 'FillWidth' }], children: parts.concat([removeBtn]) },
    { type: 'Row', id: id('gone'), showWhen: gone, verticalAlignment: 'Center', horizontalArrangement: 'SpaceBetween',
      modifiers: [{ type: 'FillWidth' }], children: [text('Removed when you close Settings', 13, 'onSurfaceVariant'), undoBtn] }];
}
function unitBlock(unit, ui, withDistance, showWhen) {
  var col = function (parts, when) {
    var c = { type: 'Column', id: id('col'), verticalArrangement: 'SpacedBy', spacing: '6', modifiers: [{ type: 'FillWidth' }], children: parts };
    if (when) c.showWhen = when;
    return c;
  };
  if (unit.length === 1) {
    var st = stopsShown[unit[0]];
    return col([text(st.name, 16, '', { fontWeight: 'Bold' })].concat(sideParts(unit[0], withDistance)), showWhen);
  }
  var side = '%pr_' + letters(ui) + '_x'; var sideB = side + ' == "b"';
  var flip = function (to, when) {
    return { type: 'IconButton', id: id('flip'), icon: 'icon:SwapHoriz', showWhen: when,
             eventHandlers: { handlers: [{ events: [{ type: 'click' }], actions: [setVar(side.slice(1), to)] }] } };
  };
  var title = String(stopsShown[unit[0]].name).replace(/\s*\([^)]*\)\s*$/, '');
  return col([
    { type: 'Row', id: id('prow'), verticalAlignment: 'Center', horizontalArrangement: 'SpaceBetween', modifiers: [{ type: 'FillWidth' }],
      children: [text(title, 16, '', { fontWeight: 'Bold' }), flip('b', '!(' + sideB + ')'), flip('a', sideB)] },
    col(sideParts(unit[0], withDistance), '!(' + sideB + ')'),
    col(sideParts(unit[1], withDistance), sideB)
  ], showWhen);
}

var yours = []; var others = [];
units.forEach(function (unit, ui) {
  var on = unit.map(function (k) { return '(' + onExpr(k, stopsShown[k]) + ')'; }).join(' | ');
  yours.push(unitBlock(unit, ui, true, on));
  others.push(unitBlock(unit, ui, false, '!(' + on + ')'));
});

var stopBlocks = [text('Tap the routes you use at each stop. \u21c4 switches to the other side of the road.', 13, 'onSurfaceVariant'),
                  text('Your stops', 15, 'primary', { fontWeight: 'Bold' })].concat(yours,
                 [text('Stops near you', 15, 'primary', { fontWeight: 'Bold' })], others);
if (stopsShown.length === 0) stopBlocks.push(text('No stops found near you. Open Settings again near a stop you use.', 14, 'onSurfaceVariant'));
var stopsPage = [group(stopBlocks)];

var countdownPage = [group(
  choices('Update every', P.refresh, get('BusRefresh') || 45, 'BusRefresh')
  .concat(choices('Stop after', P.timeout, get('BusTimeout') || 30, 'BusTimeout'))
  .concat(choices('Rotate routes every', P.rotate, get('BusRotate') || 6, 'BusRotate'))
  .concat(choices('Manual start searches within', P.radius, get('BusRadius') || 300, 'BusRadius'))
  .concat(choices('Heading to a stop', [['Off', 'off'], ['Walking', 'walk'], ['Walking + bus', 'both']], get('BusApproach') || 'both', 'BusApproach'))
  .concat(choices('Minutes ahead', [['2', '2'], ['3', '3'], ['5', '5']], get('BusApproachMin') || '3', 'BusApproachMin'))
  .concat(choices('Record trips (to Download, kept a week)', [['Off', 'off'], ['On', 'on']], get('BusRecord') || 'off', 'BusRecord')))];

var wifiPage = [group(
  wifiBlock('Home Wi-Fi', get('BusHomeWifi'), 'home_wifi', 'BusHomeWifi', false)
  .concat(wifiBlock('Work Wi-Fi', get('BusWorkWifi'), 'work_wifi', 'BusWorkWifi', true))
  .concat([text('No countdowns on these networks.', 13, 'onSurfaceVariant')])
  .concat(choices('On leaving, show the nearest stop\u2019s next buses', [['Work', 'work'], ['Home', 'home'], ['Both', 'both'], ['Off', 'off']],
                  get('BusLeaveShow') || 'work', 'BusLeaveShow'))
  .concat(choices('Work heads-up (1 min when the screen turns on), from',
                  [['Off', 'off'], ['16:30', '16:30'], ['17:00', '17:00'], ['17:30', '17:30']], get('BusGlanceFrom') || '17:00', 'BusGlanceFrom'))
  .concat(choices('until', [['17:30', '17:30'], ['18:00', '18:00'], ['18:30', '18:30'], ['19:00', '19:00']], get('BusGlanceTo') || '18:00', 'BusGlanceTo')))];

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
  .concat(choices('Tap for the stop board: show', [['All routes', 'all'], ['Your routes', 'mine']], get('BusBoardRoutes') || 'all', 'BusBoardRoutes'))
  .concat(choices('Stop board closes', [['After 10 s', '10'], ['After 30 s', '30'], ['When tapped', '0']], get('BusBoardSecs') || '10', 'BusBoardSecs'))),
  // Where the island sits is a page of its own, one level down
  group([entry('CropFree', 'Position', 'Camera gap ' + gap + ' dp, ' + y + ' dp from the top', 'position')])];
var positionPage = [group(
  slider('Camera gap', 26, 80, 1, Math.min(80, Math.max(26, gap)), 'set_gap')
  .concat(slider('Top offset', 0, 24, 1, Math.min(24, y), 'set_y'))
  .concat(slider('Chip offset from left', 0, 200, 2, Math.min(200, parseInt(get('BusChipX'), 10) >= 0 ? parseInt(get('BusChipX'), 10) : 76), 'set_cx'))
  // Preview closes this screen (saving) and shows the real island for 3 seconds, then its stop board
  // for 4 (the status bar chip, which has no board, for 3), then reopens
  // Settings. Showing it on top of the open screen did nothing, and left the screen unable to report
  // that it had closed.
  .concat([row([button('Preview', [setVar('bus_preview', 'yes'), { type: 'DismissLayout' }]),
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
var setupPage = [group([input('TfL key', get('TflKey'), 'tfl_key')].concat(
  missing.length
    ? [text('Needed:', 13, 'onSurfaceVariant')].concat(missing.map(function (p) {
        return row([text(p[0], 15), button('Turn on', [runTask('Bus Settings Button', { busaction: p[2] })])]);
      }))
    : [text('All permissions are on.', 14, 'primary')]))];

// ---- The main page: an entry for each page, saying what it's set to now ----
var myStops = stopsShown.filter(function (st) { return st.saved && st.ticked.length; })
  .map(function (st) { return String(st.name).replace(/\s*\([^)]*\)\s*$/, '') + ': ' + st.ticked.join(', '); });
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
    content: [{ type: 'Column', id: 'body', verticalArrangement: 'SpacedBy', spacing: '12',
      modifiers: [{ type: 'FillSize' }, { type: 'VerticalScroll' }, { type: 'Padding', horizontal: '16', top: '4', bottom: '24' }],
      children: [page('main', mainPage), page('stops', stopsPage), page('countdown', countdownPage), page('wifi', wifiPage),
                 page('island', islandPage), page('position', positionPage), page('setup', setupPage)] }] }
});

// What was shown, so the save step knows the starting values
setGlobal('BusTempSettings', JSON.stringify({ mine: mine, near: near, wifiNow: wifiNow, perms: PERMS, P: P, stops: stopsShown }));
