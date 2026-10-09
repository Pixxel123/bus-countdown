/* ==================================================================
   Bus Settings · Save what changed
   Runs after the screen closes. Screen variables come back as locals;
   a control you didn't touch has no variable, so its setting is kept.
   Output: busmsg (confirmation), busstopschanged (yes: stops or routes
           changed, so the next steps refresh the stop lists and add the stops
           across the road), BusTempOpposite (saved stops and their routes),
           buslive (yes: Adjust live was tapped, so the live position
           editor opens next, 4.52)
   ================================================================== */
/* @include get */
/* @include loc */
// Screen variable names spell numbers with letters (0-9 become a-j: stop 1, route 566 ->
// sr_b_eggx_on). That turned out not to be why taps were lost (see BusTempTicks), but it keeps
// names clear of Tasker's array naming (a name ending in digits reads as an array item).
function letters(x) { return String(x).toLowerCase().replace(/[0-9]/g, function (d) { return 'abcdefghij'.charAt(+d); }).replace(/[^a-z]/g, 'z'); }
function tickVar(k, route) { return 'sr_' + letters(k) + '_' + letters(route) + 'x_on'; }
function boxVar(k) { return 'stop_c_' + letters(k) + '_m'; }
function distVar(k) { return 'stop_r_' + letters(k); }

var shown = JSON.parse(get('BusTempSettings') || '{}');
var taps = JSON.parse(get('BusTempTicks') || '{}');
var tapCount = Object.keys(taps).reduce(function (n, k) { return n + Object.keys(taps[k]).length; }, 0);
var dists = JSON.parse(get('BusTempDists') || '{}');
var removedStops = JSON.parse(get('BusTempRemoved') || '{}');
var P = shown.P || {};
var busmsg = 'none';
var changed = [];

// Runs however the screen was closed (Done or the back gesture): choices were saved as they
// were tapped, and routes and distances were recorded by Bus Settings Button.
if (true) {
  // TfL key
  var key = loc('tfl_key');
  if (key && key !== get('TflKey')) { setGlobal('TflKey', key); changed.push('TfL key'); }

  // Stops and routes: a stop with any ticked route is saved; your routes are every ticked route.
  // Untouched checkboxes keep their starting state.
  var places = get('BusPlaces') ? get('BusPlaces').split('\n') : [];
  var skip = get('BusPlacesSkip') ? get('BusPlacesSkip').split(',') : [];
  var routesNow = []; var added = []; var removed = []; var opposite = [];
  (shown.stops || []).forEach(function (st, k) {
    // y = tapped on, n = tapped off, nothing = as it was. The taps recorded by Bus Settings Button
    // come first; the screen's own variable is the fallback.
    var ticks = st.routes.filter(function (r) {
      var v = (taps[letters(k)] || {})[r] || loc(tickVar(k, r));
      return v === 'y' ? true : v === 'n' ? false : st.ticked.indexOf(r) > -1;
    });
    // Remove stop: as if every route there were unticked (its routes stay if used at another stop)
    if (removedStops[letters(k)] === true || loc('rm_' + letters(k) + '_x') === 'yes' && removedStops[letters(k)] !== false) ticks = [];
    ticks.forEach(function (r) { if (routesNow.indexOf(r) < 0) routesNow.push(r); });
    var at = places.map(function (l) { return l.split('|')[1]; }).indexOf(st.id);
    if (ticks.length && at < 0) {
      places.push(['bus', st.id, st.name, st.lat, st.lon].join('|'));
      added.push(st.name);
      skip = skip.filter(function (x) { return x !== st.id; });           // chosen again: auto-add allowed
    } else if (!ticks.length && at > -1) {
      places.splice(at, 1);
      removed.push(st.name);
      if (skip.indexOf(st.id) < 0) skip.push(st.id);                     // don't add it back automatically
    }
    if (ticks.length && at < 0) opposite.push({ id: st.id, lat: st.lat, lon: st.lon, routes: ticks });   // newly added stops only
  });
  // Keep the order you already had, then any new routes
  var mineBefore = shown.mine || [];
  routesNow = mineBefore.filter(function (r) { return routesNow.indexOf(r) > -1; })
    .concat(routesNow.filter(function (r) { return mineBefore.indexOf(r) < 0; }));
  var busstopschanged = 'no';
  if (added.length || removed.length) {
    setGlobal('BusPlaces', places.join('\n'));
    setGlobal('BusPlacesSkip', skip.join(','));
    if (added.length) changed.push('added ' + added.join(', '));
    if (removed.length) changed.push('removed ' + removed.join(', '));
    busstopschanged = 'yes';
  }
  if (routesNow.length && routesNow.join(',') !== get('BusRoutes')) {
    setGlobal('BusRoutes', routesNow.join(','));
    changed.push('routes ' + routesNow.join(', '));
    busstopschanged = 'yes';
  }
  setGlobal('BusTempOpposite', JSON.stringify(opposite));



  // Each saved stop's arrival distance: 50, 100, 200 or a custom number of metres
  var placesChanged = false;
  (shown.stops || []).forEach(function (st, k) {
    // The last distance chosen for this stop, as recorded by Bus Settings Button
    var value = dists[letters(k)] ? Math.min(200, +dists[letters(k)]) : null;   // at most 200 m
    if (!value) {                                   // fallback: the screen's own variables, if they came back
      var d = loc('stop_d_' + letters(k) + '_x'); var typed = Math.round(parseFloat(loc(boxVar(k))));
      if (/^(50|100|200)$/.test(d)) value = +d;
      else if (d === 'custom' && typed >= 10) value = Math.min(200, typed);     // at most 200 m
    }
    if (value === null || value === st.effective) return;
    var at = places.map(function (l) { return l.split('|')[1]; }).indexOf(st.id);
    if (at < 0) return;                                               // unticked, so removed above
    var p = places[at].split('|');
    places[at] = p.slice(0, 5).concat([String(value)]).join('|');
    placesChanged = true;
    changed.push(p[2] + ' ' + value + ' m');
  });
  if (placesChanged) setGlobal('BusPlaces', places.join('\n'));

  // Wi-Fi names typed in the boxes (the "Use" and "Clear" buttons were applied straight away)
  function typedWifi(setting, v, what) {
    var t = loc(v);
    if (t && t !== get(setting)) { setGlobal(setting, t); changed.push(what + ' ' + t); }
  }
  typedWifi('BusHomeWifi', 'home_wifi', 'home Wi-Fi');
  typedWifi('BusWorkWifi', 'work_wifi', 'work Wi-Fi');

  // Sliders come back as decimals
  function slide(setting, v, what) {
    var x = loc(v);
    if (x === '' || isNaN(parseFloat(x))) return;
    var value = String(Math.round(parseFloat(x)));
    if (value !== get(setting)) { setGlobal(setting, value); changed.push(what + ' ' + value + ' dp'); }
  }
  slide('BusIslandGap', 'set_gap', 'camera space');
  slide('BusIslandY', 'set_y', 'island height');
  slide('BusChipX', 'set_cx', 'status bar position');

  changed = changed.filter(function (c, k) { return changed.indexOf(c) === k; });
  var already = JSON.parse(get('BusTempChanged') || '{}');
  changed = Object.keys(already).map(function (k) { return already[k]; }).concat(changed);
  var notes = [];
  if (changed.length) notes.push('Saved: ' + changed.join(', '));
  if (!get('TflKey') || !get('BusRoutes')) notes.push('A TfL key and at least one route at a stop are needed');
  busmsg = notes.length ? notes.join('. ') : 'none';               // "none": nothing to say, no message
}
var buslive = loc('bus_live') === 'yes' ? 'yes' : 'no';          // Adjust live was tapped (4.52)
setGlobal('BusTempSettings', '');
setGlobal('BusTempTicks', '');
setGlobal('BusTempChanged', '');
setGlobal('BusTempDists', '');
setGlobal('BusTempRemoved', '');
