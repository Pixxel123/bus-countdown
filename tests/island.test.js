// The island never flashes when it updates: times changing never change its size (so it's never
// redrawn for them), and when it is redrawn the new one is shown before the old one goes.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { run } = require('./harness');

// Stop S has both your routes; stop P only the 517
const base = () => ({ BusStyle: 'pill', BusDestLetters: '3', BusIslandGap: '45', BusIslandY: '9', BusScreenW: '448', BusCameraX: '224',
  BusRefresh: '45', BusRoutes: '517,566', BusStateStopId: 'S', BusStateStopName: 'Ashenhurst (Stop B)',
  BusCacheStops: JSON.stringify({ S: { n: 'Ashenhurst (Stop B)', r: ['517', '566', '119'] }, P: { n: 'Wexley (Stop P)', r: ['517'] } }) });
const at = Date.UTC(2026, 9, 5, 8, 0, 0);
function refresh(g, arrivals) {
  run('refresh.js', { globals: g, now: at, locals: { http_response_code: '200', http_data: JSON.stringify(arrivals) } });
}
// Show the island once (as Bus Refresh does), then refresh with new data: was a redraw asked for?
function redrawnAfter(first, next) {
  const g = base();
  refresh(g, first);
  run('island_show.js', { globals: g, now: at });             // records the shape it was shown at
  g.BusStateIslandShown = '1';
  refresh(g, next);
  return g.BusStateIslandShown !== '1';
}
const bus = (route, min) => ({ lineName: route, destinationName: route === '517' ? 'Holbry' : 'Fernleigh', timeToStation: min * 60 });

test('times changing never redraw the island', () => {
  assert.strictEqual(redrawnAfter([bus('517', 5), bus('566', 9)], [bus('517', 4), bus('566', 12)]), false);
});
test('a second time appearing or going never redraws it', () => {
  assert.strictEqual(redrawnAfter([bus('517', 5), bus('566', 9)], [bus('517', 5), bus('517', 12), bus('566', 9)]), false);
  assert.strictEqual(redrawnAfter([bus('517', 5), bus('517', 12), bus('566', 9)], [bus('517', 5), bus('566', 9)]), false);
});
test('a route switching to timetable times never redraws it', () => {
  const g = base(); g.BusCacheTimetable = JSON.stringify({ S: { r: { '566': { t: [[480 + 7, 0], [480 + 27, 0]], n: ['Fernleigh'] } } } });
  refresh(g, [bus('517', 5), bus('566', 9)]);
  run('island_show.js', { globals: g, now: at }); g.BusStateIslandShown = '1';
  refresh(g, [bus('517', 4)]);                                 // 566 now from the timetable ("~")
  assert.strictEqual(g.BusStateIslandShown, '1');
});
test('a route dropping out of the predictions, or coming back, never redraws it', () => {
  assert.strictEqual(redrawnAfter([bus('517', 5), bus('566', 9)], [bus('517', 5)]), false);
  assert.strictEqual(redrawnAfter([bus('517', 5)], [bus('517', 5), bus('566', 9)]), false);
});

test('switching to a stop with a different number of your routes does redraw it', () => {
  const g = base();
  refresh(g, [bus('517', 5), bus('566', 9)]);
  run('island_show.js', { globals: g, now: at }); g.BusStateIslandShown = '1';
  g.BusStateStopId = 'P'; g.BusStateStopName = 'Wexley (Stop P)';      // a long press: the other stop
  refresh(g, [bus('517', 6)]);
  assert.strictEqual(g.BusStateIslandShown, '2', 'drawn again, and the old one removed (4.42; 0 left it up)');
});

test('the island is sized for every one of your routes at the stop, not just the ones showing', () => {
  const g = base();
  refresh(g, [bus('517', 5)]);                                   // only the 517 has a time
  const one = +run('island_show.js', { globals: g, now: at }).busww;
  refresh(g, [bus('517', 5), bus('566', 9)]);
  const two = +run('island_show.js', { globals: g, now: at }).busww;
  assert.strictEqual(one, two);
});

test('redraws take turns between two scene names; the first show has nothing to remove', () => {
  const g = {};
  const first = run('island_show.js', { globals: g });
  assert.deepStrictEqual([first.busnewscene, first.busoldscene], ['buspill', 'none']);
  g.BusStateIslandShown = '1';
  const second = run('island_show.js', { globals: g });
  assert.deepStrictEqual([second.busnewscene, second.busoldscene], ['buspill2', 'buspill']);
  const third = run('island_show.js', { globals: g });
  assert.deepStrictEqual([third.busnewscene, third.busoldscene], ['buspill', 'buspill2']);
});

// ---- In the project: the order of steps in Bus Refresh, and clearing both names everywhere ----
const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const taskBody = (name) => [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes(`<nme>${name}</nme>`));
const steps = (body) => [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => ({
  code: +a[1].match(/<code>(\d+)<\/code>/)[1], args: [...a[1].matchAll(/<Str sr="arg(\d+)" ve="3">([^<]*)<\/Str>/g)].reduce((o, x) => Object.assign(o, { [x[1]]: x[2] }), {}),
}));

test('Bus Refresh shows the new island before it removes the old one', () => {
  const s = steps(taskBody('Bus Refresh'));
  const show = s.findIndex((x) => x.code === 479 && x.args[2] === '%busnewscene');
  const removeOld = s.findIndex((x) => x.code === 480 && x.args[0] === '%busoldscene');
  assert.ok(show > -1 && removeOld > -1, 'both steps exist');
  assert.ok(show < removeOld, 'shown first, then the old one removed');
  const islandShows = s.filter((x) => x.code === 479);
  assert.ok(islandShows.every((x) => x.args[2] === '%busnewscene'), 'never shown under a fixed name');
  const between = s.slice(s.findIndex((x) => x.code === 129 && /island_show/.test(JSON.stringify(x))) + 1, show);
  assert.ok(!between.some((x) => x.code === 480), 'nothing is removed between building the island and showing it');
});

test('everywhere the island is cleared, both scene names are', () => {
  const dismisses = [...xml.matchAll(/<code>480<\/code>[\s\S]*?<Str sr="arg0" ve="3">([^<]*)<\/Str>/g)].map((m) => m[1]);
  const fixed = dismisses.filter((n) => n === 'buspill' || n === 'buspill2');
  assert.strictEqual(fixed.filter((n) => n === 'buspill').length, fixed.filter((n) => n === 'buspill2').length);
  assert.ok(fixed.length > 0);
});

test('room for a second time costs little width (4.14 reserved far too much)', () => {
  // The right half is compared with what one timetable time ("~88 min") needs. With real fonts the
  // difference is about 9 dp; the harness's rough text measure makes it larger, hence 40 here
  // (4.14 and 4.15 came to 51 on this measure).
  const g = base();
  refresh(g, [bus('517', 5), bus('566', 9)]);
  const r = run('island_show.js', { globals: g, now: at });
  const dots = 6 + 2 * 4 + 3;
  const oneTime = Math.ceil('~88 min'.length * 8.4) + 4 + dots;
  assert.ok(r.RIGHT - oneTime <= 40, `right half ${r.RIGHT} dp, one time needs ${oneTime} dp`);
});

test('TfL listing the same bus twice does not show "24 · 24 min"', () => {
  const g = base();
  refresh(g, [bus('517', 24), Object.assign(bus('517', 24), { timeToStation: 24 * 60 + 20 }), bus('517', 41)]);
  const r517 = JSON.parse(g.BusStateIslandData).b.find((b) => b.k === '517');
  assert.strictEqual(Math.round((r517.t2 - r517.t) / 60000), 17, 'the second time is the next bus, not the same one');
});
