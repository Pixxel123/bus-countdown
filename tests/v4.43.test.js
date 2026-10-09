// V4.43: the island responds sooner. Each JavaScriptlet costs about 0.3 s on the phone (Tasker starts
// a web view for each), and the stop board opening or closing ran four in a row, about 1 s in all.
// Now the scene name is picked inside island_show.js, and the orientation check is skipped for the
// board (a tap on the island means it's showing and the phone is upright). The page also dims its
// words the moment a tap, hold or swipe up goes to Tasker, and fades out at once when dismissed.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runPage, run } = require('./harness');

const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const taskBody = (name) => [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes(`<nme>${name}</nme>`));
const actions = (body) => [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => ({
  text: a[1], code: +a[1].match(/<code>(\d+)<\/code>/)[1],
  cond: (a[1].match(/<lhs>([^<]*)<\/lhs><op>(\d)<\/op><rhs>([^<]*)<\/rhs>/) || []).slice(1).join(' '),
}));

test('Bus Refresh: the stop board opening or closing skips the orientation check before drawing the island', () => {
  const s = actions(taskBody('Bus Refresh'));
  const check = s.filter((a) => a.text.includes('getResources {Resources}') || a.text.includes('getConfiguration {Object}') || a.text.includes('Is the phone sideways?'));
  // When the phone turns (always); before drawing the island, and before drawing an open board again
  // at a new height (neither for the board opening or closing)
  assert.strictEqual(check.length, 9);
  assert.deepStrictEqual(check.slice(0, 3).map((a) => a.cond), ['', '', '']);
  assert.deepStrictEqual(check.slice(3).map((a) => a.cond), Array(6).fill('%busrefpar 3 open/close'));
});

test('the scene name is picked inside island_show.js: no separate script, and the preview leaves it alone', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'scripts', 'island_swap.js')));
  assert.ok(!xml.includes('Which scene name to show the island under this time\n   The island takes turns'), 'no island_swap.js step');
  const g = { BusStateIslandShown: '1', BusStateIslandScene: 'buspill2' };
  const r = run('island_show.js', { globals: g });
  assert.deepStrictEqual([r.busnewscene, r.busoldscene, g.BusStateIslandScene], ['buspill', 'buspill2', 'buspill']);
  const pg = { BusStateIslandShown: '1', BusStateIslandScene: 'buspill2', BusPreviewData: '{"b":[]}' };
  const p = run('island_show.js', { globals: pg, locals: { busdatavar: 'BusPreviewData' } });
  assert.strictEqual(pg.BusStateIslandScene, 'buspill2', 'the preview has its own scene names');
  assert.strictEqual(p.busnewscene, undefined);
});

test('the page shows a touch has counted straight away, and puts itself back if nothing happens', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  // Every task the page starts, apart from the small buzz while swiping, dims or hides the island first
  const calls = [...src.matchAll(/(waitFor\([^;]*\);\s*(var ended = )?)?runTask\('Bus (Island|End)'(, \{[^}]*\})?\)/g)];
  // (A board the page grows or shrinks itself needs no dimming: it moves at once; nor does drawing it
  // again at a new width, 4.46, which nobody asked for)
  const quiet = calls.filter((c) => !c[1] && !/busisland: 'buzz'|busgrow: 'yes'|busisland: 'fit'/.test(c[0]));
  assert.deepStrictEqual(quiet.map((c) => c[0]), []);
  assert.match(src, /waitFor\('end', winMoved \? 'armed' : 'gone'\);\s*var ended = runTask\('Bus End'\)/, 'dismissing hides it at once');
  assert.match(src, /waitTimer = setTimeout\(function \(\) \{ waitingFor = ''; p\.classList\.remove\('wait', 'gone', 'armed'\); settle\(\); windowBack\(\); \}, 4000\)/);
  assert.match(src, /if \(waitingFor === 'switch'\)/, 'a new stop\'s times end the wait for a hold');
});

test('closing the stop board: no fetch, and the board goes as soon as the island is drawn on top of it', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  // Folding the board back in the page showed the rest of its window as a blank dark board (Tasker's
  // web view fills its whole window), so it only dims
  assert.doesNotMatch(src, /\.closing/);
  assert.strictEqual((src.match(/closeBoard\(\);/g) || []).length, 3, 'a tap, a swipe up, and its time running out');
  const g = { BusStateIslandShown: '1', BusStateIslandScene: 'buspill', BusStateBoard: '0' };
  assert.strictEqual(run('island_show.js', { globals: g, locals: { busrefpar: 'close' } }).busfadems, '0');
  assert.strictEqual(run('island_show.js', { globals: Object.assign({}, g, { BusStateBoard: '1' }), locals: { busrefpar: 'open' } }).busfadems, '300');
  const s = actions(taskBody('Bus Refresh'));
  const due = s.findIndex((a) => /Fetched these times under 20 s ago/.test(a.text));
  assert.strictEqual(s[due].cond, '%busrefpar 3 close/fit');   // (or drawing it at a new width, 4.46)
  assert.match(s[due - 1].text, /<Str sr="arg0" ve="3">%busfresh<\/Str>\s*<Str sr="arg1" ve="3">yes<\/Str>/);
  assert.strictEqual(s[due - 1].cond, '%busrefpar 2 close/fit');
  assert.match(s.find((a) => /Let it fade in over the old one/.test(a.text)).text, /<Int sr="arg0"><var>%busfadems<\/var><\/Int>/);
});

// ---- Switching stop (a long press) -------------------------------------------------------------
// It took 4 to 5 s: the new stop's timetable was fetched first (about 2 s, once a day per stop), and
// the island kept the old stop until the new times came. Now the live times come first, and the
// island shows the new stop at once.
const AT = Date.UTC(2026, 9, 8, 13, 26, 0);
const KH = { id: 'KH', name: 'Kiln Street (Stop KH)', dist: 40 }, KJ = { id: 'KJ', name: 'Kiln Street (Stop KJ)', dist: 60 };

test('Bus Refresh asks for live arrivals first, and checks for the timetable only after the island is shown', () => {
  const s = actions(taskBody('Bus Refresh'));
  const at = (re) => s.findIndex((a) => re.test(a.text));
  const arrivals = at(/Arrivals\?app_key/), build = at(/Build the departures/), show = at(/Show it around the camera/);
  const check = at(/Timetable needed for this stop\?/), timetable = at(/Timetable\/%BusStateStopId/);
  assert.ok(arrivals > 0 && arrivals < build && build < show && show < check && check < timetable, [arrivals, build, show, check, timetable].join(' '));
  assert.strictEqual(s[check - 1].cond, '%busfresh 3 yes', 'only when times were just fetched');
});

test('the timetable is fetched only for your routes TfL has no live time for', () => {
  const g = { BusStateStopId: 'KH', BusRoutes: '517,566', BusCacheStops: JSON.stringify({ KH: { r: ['517', '566'] } }) };
  const r = run('tt_check.js', { globals: g, now: AT, locals: { busliveroutes: '517' } });
  assert.deepStrictEqual([r.busttfetch, r.busttcount, g.BusTempTimetableRoutes], ['yes', '1', '566']);
  assert.strictEqual(run('tt_check.js', { globals: g, now: AT, locals: { busliveroutes: '566,517' } }).busttfetch, 'no');
  assert.strictEqual(run('tt_check.js', { globals: g, now: AT, locals: { busliveroutes: '' } }).busttcount, '2', 'no live times: both');
});

test('refresh.js says which routes had live times, and keeps each stop\'s island data (the 4 latest)', () => {
  const g = { BusRefresh: '45', BusRoutes: '517,566', BusStyle: 'pill', BusStateStopId: 'KH', BusStateStopName: KH.name,
    BusStateIslandByStop: JSON.stringify({ A: { u: AT - 4000 }, B: { u: AT - 3000 }, C: { u: AT - 2000 }, D: { u: AT - 1000 } }) };
  const r = run('refresh.js', { globals: g, now: AT, locals: { http_response_code: '200',
    http_data: JSON.stringify([{ lineName: '517', destinationName: 'Holbry', timeToStation: 300, vehicleId: 'BX1' }]) } });
  assert.strictEqual(r.busliveroutes, '517');
  const byStop = JSON.parse(g.BusStateIslandByStop);
  assert.deepStrictEqual(Object.keys(byStop).sort(), ['B', 'C', 'D', 'KH']);
  const shown = JSON.parse(g.BusStateIslandData); delete shown.fit;   // (the width it's fitted to, 4.46, is the page's alone)
  assert.deepStrictEqual(byStop.KH, shown);
});

test('a long press shows the new stop at once: its times from under 3 minutes ago, or its name while they come', () => {
  const base = () => ({ BusStateNearbyStops: JSON.stringify([KH, KJ]), BusStateStopIndex: '0', BusStateStopId: 'KH',
    BusStateIslandData: JSON.stringify({ u: AT, r: 45000, rot: 6000, s: 'KH', n: KH.name, l: 'KH', b: [{ k: '517' }] }) });
  const recent = { u: AT - 120000, r: 45000, s: 'KJ', n: KJ.name, l: 'KJ', b: [{ k: '566', t: AT + 300000 }] };
  let g = Object.assign(base(), { BusStateIslandByStop: JSON.stringify({ KJ: recent }) });
  run('opposite.js', { globals: g, now: AT });
  assert.strictEqual(g.BusStateStopId, 'KJ');
  assert.deepStrictEqual(JSON.parse(g.BusStateIslandData), recent);
  g = Object.assign(base(), { BusStateIslandByStop: JSON.stringify({ KJ: Object.assign({}, recent, { u: AT - 200000 }) }) });
  run('opposite.js', { globals: g, now: AT });
  const shown = JSON.parse(g.BusStateIslandData);
  assert.deepStrictEqual([shown.s, shown.n, shown.l, shown.b, shown.w, shown.r], ['KJ', KJ.name, 'KJ', [], 1, 45000], 'too old: the name, waiting for times');
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  // (4.48: and, with no times yet, through the name's flash; with times, the name is on the left only)
  assert.match(src, /if \(\(data && data\.w\) \|\| \(naming && !buses\(\)\.length\)\)/, 'the island keeps the stop\'s name up while it waits');
  assert.match(src, /data && data\.w \? 'Getting times\\u2026' : 'No buses due'/, 'and the board says it\'s getting them');
});

// ---- The trip recorder no longer writes from inside a script ---------------------------------------
// A script's writeFile runs as a Tasker task of its own; a script waiting on it while another ran
// (a long press as the screen came on, 14:27 on Thursday) hung both for 45 s, and both failed.
test('no script writes a file itself; Tasker writes what each recorded straight after it', () => {
  const dir = path.join(__dirname, '..', 'scripts');
  const writers = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).filter((f) => /\bwriteFile\(|\bshell\(/.test(require('./harness').compose(fs.readFileSync(path.join(dir, f), 'utf8'))));
  assert.deepStrictEqual(writers, []);
  for (const task of ['Bus Start', 'Bus Refresh', 'Bus Wake', 'Bus End', 'Bus Watch']) {
    const s = actions(taskBody(task));
    s.forEach((a, i) => {
      if (a.code === 129 && /@include record|function record\(kind, data\)/.test(a.text)) {
        assert.match(s[i + 1].text, /Trip recorder on: write what was just recorded/, `${task}: straight after step ${i + 1}`);
      }
    });
  }
});

test('the write: append, or start afresh on a new day; the day counts as started, or the error is kept', () => {
  const s = actions(taskBody('Bus End'));
  const from = s.findIndex((a) => /Trip recorder on: write what was just recorded/.test(a.text));
  const steps = s.slice(from, from + 18).map((a) => a.text);
  assert.ok(steps.some((t) => /new \{java\.io\.FileWriter\} \(String, boolean\)<\/Str><Str sr="arg3" ve="3">\/sdcard\/%busrecfile<\/Str><Str sr="arg4" ve="3">%busrecappend/.test(t)));
  assert.ok(steps.some((t) => /write \{\} \(String\)<\/Str><Str sr="arg3" ve="3">%busrecline/.test(t)));
  assert.ok(steps.some((t) => /<code>547<\/code>[\s\S]*%BusRecordDay[\s\S]*%busrecday/.test(t)));
  assert.ok(steps.some((t) => /%BusRecordErr<\/Str>\s*<Str sr="arg1" ve="3">%TIME %errmsg/.test(t)));
});

// ---- Opening the stop board never waits for TfL -------------------------------------------------
// Opens with times older than 20 s (the usual case: Bus Loop refreshes every 45 to 90 s) waited
// 0.7 to 2.3 s for TfL before the board appeared. Now it's drawn first, and fetched after.
test('Bus Refresh: opening the board draws it first, then fetches if the times are due', () => {
  const s = actions(taskBody('Bus Refresh'));
  const at = (re, from) => s.findIndex((a, i) => i > (from || 0) && re.test(a.text));
  const after = at(/Opening the stop board: fetch after drawing it/);
  assert.match(s[after].text, /<Str sr="arg0" ve="3">%busafter<\/Str>\s*<Str sr="arg1" ve="3">%busfresh<\/Str>/);
  assert.strictEqual(s[after].cond, '%busrefpar 2 open');
  assert.match(s[after + 1].text, /<Str sr="arg0" ve="3">%busfresh<\/Str>\s*<Str sr="arg1" ve="3">yes<\/Str>/);
  assert.strictEqual(s[after + 1].cond, '%busrefpar 2 open');
  const show = at(/Show it around the camera/), later = at(/The stop board is open: now fetch its times/);
  assert.ok(after < show && show < later);
  assert.strictEqual(s[later].cond, '%busafter 2 no');
  assert.ok(at(/Arrivals\?app_key/, later) > later && at(/Build the departures/, later) > later, 'the fetch, after the board is up');
  assert.ok(at(/The board needs more or fewer lines: draw it again/, later) > later);
});

test('an open board is drawn again when the new times bring a route more or fewer', () => {
  const g = { BusRefresh: '45', BusRoutes: '517', BusStyle: 'pill', BusStateStopId: 'KH', BusStateStopName: KH.name,
    BusStateBoard: '1', BusStateIslandShown: '1', BusStateIslandShape: 'i1L2', BusStateBoardRows: '2' };
  const fetch = (others) => run('refresh.js', { globals: g, now: AT, locals: { http_response_code: '200', http_data: JSON.stringify(
    [{ lineName: '517', destinationName: 'Holbry', timeToStation: 300, vehicleId: 'BX1' }].concat(others.map((k, i) => ({ lineName: k, destinationName: 'Elsewhere', timeToStation: 400 + i, vehicleId: 'O' + i })))) } });
  fetch(['289']);
  assert.strictEqual(g.BusStateIslandShown, '1', 'still 2 lines');
  fetch(['289', '64']);
  assert.strictEqual(g.BusStateIslandShown, '2', '3 lines now');
  g.BusStateIslandShown = '1'; g.BusStateBoard = '0';
  fetch(['289']);
  assert.strictEqual(g.BusStateIslandShown, '1', 'not while the board is closed');
  // island_show.js keeps how many lines it drew the board with
  const drawn = { BusStateBoard: '1', BusRoutes: '517', BusStateIslandData: JSON.stringify({ b: [{ k: '517' }], a: [{ k: '289' }, { k: '64' }] }) };
  run('island_show.js', { globals: drawn });
  assert.strictEqual(drawn.BusStateBoardRows, '3');
});

// ---- Swiping the island away ------------------------------------------------------------------
test('Bus End: the buzz, stopping the loop and removing the island come first, then the notes', () => {
  const s = actions(taskBody('Bus End'));
  const at = (re) => s.findIndex((a) => re.test(a.text));
  const buzz = at(/Dismissed from the island: confirm/), running = at(/<Str sr="arg0" ve="3">%BusStateRunning<\/Str>/),
    loop = at(/End the refresh loop/), clear = at(/Clear the island/), note = at(/Note it in the debugging log/);
  assert.deepStrictEqual([buzz, running, loop, clear].map((i) => i >= 0 && i < note), [true, true, true, true]);
  assert.ok(running < clear && loop < clear, 'the loop is stopped first, so a refresh can\'t draw the island again');
});

test('a swipe moves the island\'s whole window with the finger, and a swipe away removes the window from the page at once', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  const judge = src.slice(src.indexOf('function judge()'), src.indexOf("p.addEventListener('pointerdown'"));
  // Decided before it goes back to its place
  assert.ok(judge.indexOf("=== 'dismiss'") > 0 && judge.indexOf("=== 'dismiss'") < judge.indexOf('windowBack();'));
  // The window goes only once Tasker has taken Bus End; until then (and if it never does) it is only
  // made invisible after 250 ms, and put back after 4 s (code review: a countdown left with no island)
  assert.match(judge, /var ended = runTask\('Bus End'\)[\s\S]*Tasker\.dismissLayout\(Tasker\.getCurrentScreenId\(\)\)[\s\S]*ended\.then\(dismiss, function \(\) \{\}\);\s*setTimeout\(function \(\) \{ if \(!gone\) fadeWindow\(0, true\); \}, 250\);/);
  assert.doesNotMatch(judge, /setTimeout\(dismiss/);
  // The window follows the finger by the bridge's moveOverlayBy, in device pixels; the old way only if
  // screenX turns out not to be on the screen, or in Settings' preview
  assert.match(src, /Tasker\.moveOverlayBy\(Math\.round\(by \* \(window\.devicePixelRatio \|\| 1\)\), 0\)/);
  assert.match(src, /if \(CAN_MOVE && WIN !== 'no'\) \{ moveWindow\(dx\); fadeWindow\(fadeFor\(dx\)\); \} else follow\(dx\);/);
  assert.match(src, /var CAN_MOVE = !IS_PREVIEW && !!window\.Tasker && typeof Tasker\.moveOverlayBy === 'function';/);
  assert.match(src, /else \{ WIN = 'no'; windowBack\(\); \}/);
  // Not far enough: back to its place (its left edge, dp)
  // (X_NOW: further left for a wider board; growing, a width and place too: 4.47)
  assert.match(src, /Tasker\.updateOverlayConfig\(\{ x: String\(X_NOW\), configTransitionMs: 150, configTransitionEasing: 'EaseOut' \}\)/);
  const g = { BusRoutes: '517', BusScreenW: '448', BusCameraX: '224', BusStateIslandData: JSON.stringify({ b: [{ k: '517' }] }) };
  const r = run('island_show.js', { globals: g });
  assert.match(r.html, new RegExp('var BUSX = ' + r.busx + ';'));
});

test('the island fades in only when it first appears, and never fades out', () => {
  const s = actions(taskBody('Bus Refresh'));
  const show = s.find((a) => /Show it around the camera/.test(a.text)).text;
  assert.match(show, /<Str sr="arg9" ve="3">%busanim<\/Str>/);
  assert.match(show, /<Str sr="arg10" ve="3">None<\/Str>/);
  assert.strictEqual(run('island_show.js', { globals: { BusStateIslandShown: '0' } }).busanim, 'FadeIn');
  assert.strictEqual(run('island_show.js', { globals: { BusStateIslandShown: '2', BusStateIslandScene: 'buspill' } }).busanim, 'None');
});

test('a gesture always ends: losing the pointer or the touch ending count as letting go; 2 s with no news lets go without acting', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  // A swipe away on Thursday was left hanging half-way out: no pointerup or pointercancel ever came
  for (const ev of ["p.addEventListener('pointerup'", "p.addEventListener('pointercancel', judge)", "p.addEventListener('lostpointercapture', judge)",
    "document.addEventListener('touchend', judge)", "document.addEventListener('touchcancel', judge)"]) assert.ok(src.includes(ev), ev);
  // A finger paused past the dismissal point is not a dismissal: the watchdog only puts it back
  assert.match(src, /if \(down && !held && Date\.now\(\) - movedAt > 2000\) letGo\(\);/);
  const letGo = src.slice(src.indexOf('function letGo()'), src.indexOf('function judge()'));
  assert.match(letGo, /windowBack\(\);\s*settle\(\);/);
  assert.doesNotMatch(letGo, /runTask|decideSwipe|go\(/);
  assert.match(src, /function judge\(\) \{\s*clearTimeout\(holdTimer\);\s*if \(!down\) return;\s*down = false;/, 'once per gesture');
});

test('the whole island fades as a swipe nears the dismissal point, through the layout\'s Alpha modifier', () => {
  const r = run('island_show.js', { globals: { BusRoutes: '517', BusStateIslandData: JSON.stringify({ b: [{ k: '517' }] }) } });
  const mods = JSON.parse(r.buslayout).root.modifiers;
  // Applied only once the page has set busalpha below 1, so without it the island shows as before
  assert.deepStrictEqual(mods.find((m) => m.type === 'Alpha'), { type: 'Alpha', value: '%busalpha', applyWhen: '%busalpha < 1' });
  assert.ok(mods.findIndex((m) => m.type === 'Alpha') < mods.findIndex((m) => m.type === 'Clip'), 'outside the clips: the fill fades too');
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  const body = src.match(/function fadeFor\(dx\) \{[\s\S]*?\n  \}/)[0];
  const fadeFor = (manyRoutes) => new Function('SWIPE_DISMISS', 'SWIPE_DISMISS_SEVERAL', 'several', 'return ' + body)(90, 130, () => manyRoutes);
  // One route: fading from 24 dp, a quarter at the 90 dp dismissal point
  assert.deepStrictEqual([0, 24, 57, 90, 150].map((d) => Math.round(fadeFor(false)(d) * 100) / 100), [1, 1, 0.63, 0.25, 0.25]);
  // Several routes: not at all through the route-change zone, then a quarter at 130 dp (4.43)
  assert.deepStrictEqual([0, 60, 90, 110, 130, 200].map((d) => Math.round(fadeFor(true)(d) * 100) / 100), [1, 1, 1, 0.63, 0.25, 0.25]);
  assert.match(src, /Tasker\.setVariable\('busalpha', String\(a\)\)/);
  assert.match(src, /function windowBack\(\) \{[^\n]*\n\s*fadeWindow\(1, true\);/, 'back to full when it goes back to its place');
});

// ---- Several routes: a flick changes route, only a long drag dismisses -----------------------------
test('with several routes, a quick flick changes route and only a long, deliberate drag (130 dp) dismisses', () => {
  const { decideSwipe } = run('shared/swipe.js');
  // One route: as before
  assert.deepStrictEqual([[-30, 500], [-65, 60], [-90, 1000], [95, 1000]].map(([dx, ms]) => decideSwipe(dx, ms, false)), ['next', 'dismiss', 'dismiss', 'dismiss']);
  // Several: no flick dismiss, and 90 to 129 dp is still a route change
  assert.deepStrictEqual([[-30, 500], [-65, 60], [-120, 80], [110, 1000], [-129, 1000], [-130, 1000], [140, 100]].map(([dx, ms]) => decideSwipe(dx, ms, true)),
    ['next', 'next', 'next', 'previous', 'next', 'dismiss', 'dismiss']);
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  assert.match(src, /function several\(\) \{ return !BOARD && buses\(\)\.length > 1; \}/, 'not on the board, which shows every route');
  // Every decision on the page passes it
  const calls = src.split('\n').filter((l) => /decideSwipe\(dx/.test(l));
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(calls.filter((l) => !/decideSwipe\(dx, [^;]*, several\(\)\)/.test(l)), []);
});

// ---- Code review fixes ------------------------------------------------------------------------------
test('after writing, the recorder forgets its lines, so a second recording script in the task does not write them again', () => {
  // Tasker hands a task's variables to every script in it (Bus Watch: wifi_save.js, then watch.js)
  for (const task of ['Bus Watch', 'Bus End', 'Bus Refresh']) {
    const s = actions(taskBody(task));
    const starts = s.map((a, i) => (/Trip recorder on: write what was just recorded/.test(a.text) ? i : -1)).filter((i) => i >= 0);
    for (const at of starts) {
      const block = s.slice(at, at + 30).map((a) => a.text).join('\n');
      for (const v of ['%busrecline', '%busrecfile', '%busrecappend', '%busrecday']) {
        assert.match(block, new RegExp('<code>549</code>[\\s\\S]*?<Str sr="arg0" ve="3">' + v + '</Str>'), `${task}: ${v} cleared`);
      }
      const close = s.slice(at).find((a) => /close \{\} \(\)/.test(a.text));
      assert.strictEqual(close.cond, '', 'closed whether or not the write worked');
    }
  }
});

test('sideways, only the drawing is skipped: the timetable check after it still runs', () => {
  const s = actions(taskBody('Bus Refresh'));
  assert.ok(!s.some((a) => /Phone is sideways: keep the island hidden/.test(a.text) && a.code === 137), 'no Stop for sideways');
  const upright = s.findIndex((a) => /Upright: show the island/.test(a.text));
  assert.strictEqual(s[upright].cond, '%busfullnow 3 yes');
  assert.ok(upright < s.findIndex((a) => /Show it around the camera/.test(a.text)));
});

test('Bus End: the snooze before the countdown ends, and a refresh under way stopped too', () => {
  const s = actions(taskBody('Bus End'));
  const at = (re) => s.findIndex((a) => re.test(a.text));
  const snooze = at(/<Str sr="arg0" ve="3">%BusStateSnooze<\/Str>/), left = at(/<Str sr="arg0" ve="3">%BusStateTrip<\/Str>/);
  const running = at(/<Str sr="arg0" ve="3">%BusStateRunning<\/Str>/), refresh = at(/<Str sr="arg1" ve="3">Bus Refresh<\/Str>|any refresh under way/);
  assert.ok(snooze >= 0 && snooze < running && left < running);
  assert.strictEqual(s[snooze].cond, '%busfrom 2 island');
  assert.match(s[snooze].text, /\{&quot;stop&quot;:&quot;%BusStateStopId&quot;,&quot;at&quot;:%TIMEMS\}|\{"stop":"%BusStateStopId","at":%TIMEMS\}/);
  assert.ok(refresh > running && refresh < at(/Clear the island/), 'stopped before the island goes');
});

test('the page sets the fade to full when it loads, and the board\'s line count is shared', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  assert.match(src, /var fadeNow = -1/);
  assert.match(src, /setTimeout\(function \(\) \{ try \{ fadeWindow\(1, true\); \} catch \(e\) \{\} \}, 1000\);\s*tick\(\);/);
  assert.match(src, /p\.style\.opacity = String\(fadeFor\(dx\)\);/, 'the fallback fades by the same rule');
  for (const f of ['island_show.js', 'refresh.js']) assert.match(fs.readFileSync(path.join(__dirname, '..', 'scripts', f), 'utf8'), /\/\* @include boardRows \*\//);
  const { boardRows } = run('shared/boardRows.js');
  assert.deepStrictEqual([boardRows(0, 0, false), boardRows(2, 3, false), boardRows(2, 3, true), boardRows(5, 9, false)], [1, 5, 2, 8]);
});

// ---- The stop board grows out of the island (design A) ---------------------------------------------
test('the board grows out of the island\'s own window and tucks back into it, through the bridge', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'island_show.js'), 'utf8');
  const grow = src.slice(src.indexOf('function growBoard()'), src.indexOf('function shrinkBoard()'));
  const shrink = src.slice(src.indexOf('function shrinkBoard()'), src.indexOf('function closeBoard()'));
  // Opening: the window to the board's height over 400 ms, then Tasker told (no new window)
  assert.match(grow, /resizeWindow\(H \+ rows \* LINE \+ 8, 400, 'EaseOut'[,)]/);
  assert.match(grow, /runTask\('Bus Island', \{ busfrom: 'island', busisland: 'open', busgrow: 'yes' \}\)/);
  assert.match(grow, /document\.body\.classList\.add\('board', 'entering'\)/);
  // Closing: the rows fade first, then the window back to the island's height over 260 ms
  assert.match(shrink, /classList\.add\('leaving'\)[\s\S]*resizeWindow\(H, 260, 'EaseIn'[,)]/);
  assert.match(shrink, /busisland: 'close', busgrow: 'yes'/);
  // Couldn't resize: drawn as a new window instead
  assert.match(shrink, /waitFor\('board'\); runTask\('Bus Island', \{ busfrom: 'island', busisland: 'close' \}\);/);
  assert.match(src, /var CAN_GROW = !IS_PREVIEW && !!window\.Tasker && typeof Tasker\.updateOverlayConfig === 'function'/);
  // The page is the board's height as it grows, so the window uncovers it; in px, as 100vh came out
  // as 0 in Tasker's web view and hid the whole island (test build 13)
  assert.doesNotMatch(src, /:\s*\d+vh/);
  assert.match(src, /html, body \{ margin: 0; height: \{\{WINH\}\}px;/);
  assert.match(src, /body\.board #p \{ height: 100%;/);
  assert.match(grow, /setHeight\(H \+ rows \* LINE \+ 8\);\s*if \(!resizeWindow/);
  assert.match(shrink, /BOARD = false; setHeight\(H\);/);
  assert.match(src, /body\.entering \.bl \{ opacity: 0; transform: translateY\(-8px\); transition: none; \}/);
  // The window's corners: 20 dp for both (the island stays a pill), so one window can be both
  const r = run('island_show.js', { globals: { BusRoutes: '517', BusStateIslandData: JSON.stringify({ b: [{ k: '517' }] }) } });
  assert.deepStrictEqual(JSON.parse(r.buslayout).root.modifiers.filter((m) => m.type === 'Clip').map((m) => m.radius), ['20', '20']);
  // New times with a route more or fewer: the page resizes its board's window itself
  assert.match(src, /if \(BOARD && CAN_GROW && lines\(\) !== BOARD_ROWS\) \{\s*BOARD_ROWS = lines\(\); boardHtmlNow = '';\s*setHeight\(H \+ BOARD_ROWS \* LINE \+ 8\);\s*resizeWindow\(H \+ BOARD_ROWS \* LINE \+ 8, 200, 'EaseOut'\);/);
});

test('refresh.js leaves resizing a grown board to its page', () => {
  const g = { BusRefresh: '45', BusRoutes: '517', BusStyle: 'pill', BusStateStopId: 'KH', BusStateStopName: 'Kiln Street (Stop KH)',
    BusStateBoard: '1', BusStateBoardSelf: '1', BusStateIslandShown: '1', BusStateIslandShape: 'i1L2', BusStateBoardRows: '1' };
  run('refresh.js', { globals: g, now: AT, locals: { http_response_code: '200', http_data: JSON.stringify([
    { lineName: '517', destinationName: 'Holbry', timeToStation: 300, vehicleId: 'BX1' }, { lineName: '289', destinationName: 'Fernleigh', timeToStation: 400, vehicleId: 'O1' }]) } });
  assert.strictEqual(g.BusStateIslandShown, '1', '2 lines now, but the page resizes it');
});

// ---- The page's own script, run ----------------------------------------------------------------------
// The tests above read the page's source; runPage (in the harness, 4.47) runs its script against a
// stand-in document and Tasker bridge, so a name the page uses but never declares fails here, not on
// the phone (test build 14: "ReferenceError: H is not defined" on every tap, so the board never opened).
test('the page, run: a tap grows the board out of the island and a second tap tucks it back', () => {
  const data = { u: Date.now(), r: 45000, rot: 6000, s: 'KH', n: 'Kiln Street (Stop KH)', l: 'KH',
    b: [{ k: '517', d: 'Holbry', t: Date.now() + 5 * 60000, st: 'live' }], a: [{ k: '289', d: 'Fernleigh', t: [Date.now() + 7 * 60000] }] };
  const page = runPage({ BusRoutes: '517', BusIslandH: '36', BusStateIslandData: JSON.stringify(data) });
  page.tap();
  // 2 lines (yours, then the other route): 36 + 2 * 26 + 8
  assert.deepStrictEqual(page.calls.find((c) => c[0] === 'updateOverlayConfig')[1], { height: '96', configTransitionMs: 400, configTransitionEasing: 'EaseOut' });
  assert.deepStrictEqual(page.calls.find((c) => c[0] === 'runTask')[1].variables, { busfrom: 'island', busisland: 'open', busgrow: 'yes' });
  page.flush(1000);
  assert.ok(page.body.classList.contains('board') && !page.body.classList.contains('entering'));
  page.calls.length = 0;
  page.tap();
  page.flush(100);
  assert.deepStrictEqual(page.calls.filter((c) => c[0] === 'updateOverlayConfig').map((c) => c[1]), [{ height: '36', configTransitionMs: 260, configTransitionEasing: 'EaseIn' }]);
  assert.deepStrictEqual(page.calls.find((c) => c[0] === 'runTask')[1].variables, { busfrom: 'island', busisland: 'close', busgrow: 'yes' });
  page.flush(1000);
  assert.ok(!page.body.classList.contains('board'));
});
