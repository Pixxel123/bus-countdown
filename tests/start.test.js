// Which stop a countdown shows (start.js): only saved stops, the right one first
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { run, m } = require('./harness');

const POOL = {
  G: { n: 'Wexley (Stop G)', a: 51.33928, o: -0.31566, r: ['566'] },
  D: { n: 'Wexley (Stop D)', a: 51.33917, o: -0.31611, r: ['566'] },
  P: { n: 'Wexley Station (Stop P)', a: 51.33905, o: -0.115, r: ['566', '517'] },
};
function start(par1, globals, here = [51.339, -0.3149]) {
  const g = Object.assign({ TflKey: 'k', BusRoutes: '566,517', BusRadius: '300', BusCacheStops: JSON.stringify(POOL),
    BusPlaces: 'bus|G|Wexley (Stop G)|51.33928|-0.31566|100\nbus|D|Wexley (Stop D)|51.33917|-0.31611|100' }, globals);
  const locals = { gl_latitude: String(here[0]), gl_longitude: String(here[1]) };
  if (par1 !== null) locals.par1 = par1;
  const r = run('start.js', { globals: g, locals });
  return { ok: r.busok, name: g.BusStateStopName, list: JSON.parse(g.BusStateNearbyStops || '[]').map((s) => s.id || s.name), g, r };
}

test('only saved stops are shown, even with a nearer unsaved one', () => {
  const s = start('');
  assert.strictEqual(s.ok, 'yes');
  assert.ok(!s.list.some((x) => String(x).includes('P')), 'Stop P never appears');
});
test('arriving: the stop you arrived at comes first', () => {
  assert.strictEqual(start('arrived', { BusStateArrivedStop: 'D' }).name, 'Wexley (Stop D)');
});
test('the reason still gets through when par1 does not (the note from Bus Watch)', () => {
  const s = start(null, { BusStateArrivedStop: 'D', BusStateStartMode: 'arrived|' + Date.now() });
  assert.strictEqual(s.name, 'Wexley (Stop D)');
});
test('heading to a stop: it can be well beyond 300 m', () => {
  const s = start('approach', { BusStateArrivedStop: 'G' }, [51.33928 - m(1200), -0.31566]);
  assert.strictEqual(s.ok, 'yes');
  assert.strictEqual(s.name, 'Wexley (Stop G)');
});
test('nothing saved nearby: says so', () => {
  const s = start('', { BusPlaces: 'bus|X|Elsewhere|51.5|-0.2|100' });
  assert.strictEqual(s.ok, 'no');
  assert.match(s.r.busproblem, /saved stops/);
});
