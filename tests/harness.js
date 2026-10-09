// Test harness: runs the project's JavaScriptlets (in ../scripts) the way Tasker does.
//   Tasker gives a JavaScriptlet global(name) and setGlobal(name, value) for global variables, and
//   the task's local variables as plain JavaScript variables. Every top-level "var" the script
//   declares comes back as a task local. Here each script runs in its own Node vm context with the
//   same shape, a fake clock, and a plain object standing in for Tasker's global variables.
'use strict';
// The scripts tell the time as the phone does, in UK time, and the tests expect UK times. GitHub's
// runners (and any computer set to another time zone) use something else, so the tests always run
// on UK time, whatever the computer's clock is set to
process.env.TZ = 'Europe/London';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SCRIPTS = path.join(__dirname, '..', 'scripts');

// Scripts can include shared pieces from scripts/shared: a line that is only "/* @include NAME */"
// is replaced by scripts/shared/NAME.js, indented to match (build/helpers.py does the same).
function compose(text) {
  return text.replace(/^([ \t]*)\/\* @include (\w+) \*\/[ \t]*$/gm, (all, ind, name) =>
    fs.readFileSync(path.join(SCRIPTS, 'shared', name + '.js'), 'utf8').trim().split('\n').map((l) => (l ? ind + l : l)).join('\n'));
}

// A Date whose "now" is fixed (ms), so trips can be replayed at any time of day
function clockAt(nowMs) {
  const Real = Date;
  class FakeDate extends Real {
    constructor(...a) { if (a.length) super(...a); else super(nowMs); }
    static now() { return nowMs; }
  }
  return FakeDate;
}

// Run one script. globals: the Tasker global variables (changed in place). locals: task locals in.
// Returns every top-level variable the script declared (its outputs), as Tasker would see them.
// Files the scripts write (Tasker's writeFile), kept here for tests to read: path -> text
const files = {};
function run(name, { globals = {}, locals = {}, now = Date.now() } = {}) {
  const src = compose(fs.readFileSync(path.join(SCRIPTS, name), 'utf8'));
  const ctx = Object.assign({
    global: (k) => (k in globals ? globals[k] : undefined),
    setGlobal: (k, v) => { globals[k] = String(v); },
    Date: clockAt(now), Math, JSON, parseInt, parseFloat, isNaN, String, Number, Object, Array, RegExp,
    writeFile: (p, text, append) => { files[p] = (append ? (files[p] || '') : '') + text; },
    readFile: (p) => { if (!(p in files)) throw new Error('No such file: ' + p); return files[p]; },
  }, locals);
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: name });
  // What the steps after a recording script do on the phone (4.43, record_steps in build/assemble.py):
  // write the lines it collected, starting the file afresh on a new day, then mark the day started,
  // or keep why the write failed
  if (typeof ctx.busrecfile === 'string' && ctx.busrecfile) {
    try {
      ctx.writeFile(ctx.busrecfile, ctx.busrecline + '\n', ctx.busrecappend !== 'false');
      globals.BusRecordErr = '';
      if (ctx.busrecappend === 'false') globals.BusRecordDay = ctx.busrecday;
    } catch (e) {
      const d = new (clockAt(now))();
      globals.BusRecordErr = String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0') + ' ' + e.message;
    }
  }
  return ctx;
}

// Metres to degrees of latitude, for building positions along a north-south road
const m = (metres) => metres / 111320;

// The island's page, run against a stand-in document and Tasker bridge (from tests/v4.43.test.js, 4.47).
// opts.scale (4.50): the web view's page zoom (visualViewport.scale); a test can change it later.
// opts.locals (4.52): the building task's locals (busdatavar, buslive for the live position editor).
function runPage(globals, now, opts = {}) {
  const vm = require('vm');
  const r = run('island_show.js', { globals, now, locals: opts.locals || {} });
  const script = r.html.slice(r.html.indexOf('<script>') + 8, r.html.lastIndexOf('</script>'));
  const classes = () => { const set = new Set(); return { set, add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)),
    toggle: (c, on) => { const v = on === undefined ? !set.has(c) : on; if (v) set.add(c); else set.delete(c); return v; }, contains: (c) => set.has(c) }; };
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, style: { setProperty(k, v) { this[k] = v; } }, innerHTML: '', textContent: '', children: [], classList: classes(), attrs: {}, listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, querySelectorAll: () => [],
    setPointerCapture() {}, releasePointerCapture() {}, offsetWidth: 200, offsetHeight: 36, scrollWidth: 0, clientWidth: 100 });
  el('d').textContent = globals.BusStateIslandData;
  const calls = [], timers = [], observed = [];
  // The page's clock: fixed, unless a test moves it on (advance, 4.48)
  let clock = now || Date.now();
  const PageDate = class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock); } static now() { return clock; } };
  const plain = (x) => JSON.parse(JSON.stringify(x));   // (objects made in the page's own context)
  const Tasker = {
    runTask: (o) => { calls.push(['runTask', plain(o)]); return Promise.resolve({}); },
    updateOverlayConfig: (c) => calls.push(['updateOverlayConfig', plain(c)]),
    moveOverlayBy: (x, y) => calls.push(['moveOverlayBy', x, y]),
    setVariable: (k, v) => calls.push(['setVariable', k, v]),
    dismissLayout: () => calls.push(['dismissLayout']), getCurrentScreenId: () => 'buspill', flash: () => {},
  };
  const ctx = {
    Tasker, document: { getElementById: el, body: el('body'), documentElement: el('html'), hidden: false, addEventListener() {} },
    visualViewport: opts.scale ? { scale: opts.scale } : undefined,
    devicePixelRatio: 3, addEventListener() {}, requestAnimationFrame: (f) => timers.push([0, f]),
    setTimeout: (f, ms) => { timers.push([ms || 0, f]); return timers.length; }, clearTimeout() {}, setInterval() {},
    MutationObserver: class { constructor(f) { observed.push(f); } observe() {} }, JSON, Math, Date: PageDate, String, Number, Array, Object, parseInt, parseFloat, Promise,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(script, ctx, { filename: 'island page' });
  const flush = (upTo) => { for (let i = 0; i < 20; i++) { const due = timers.filter((t) => t[0] <= upTo); if (!due.length) return; due.forEach((t) => timers.splice(timers.indexOf(t), 1)); due.forEach((t) => t[1]()); } };
  const tap = () => {
    const p = el('p');
    p.listeners.pointerdown.forEach((f) => f({ clientX: 100, clientY: 18, screenX: 100, screenY: 18, pointerId: 1 }));
    p.listeners.pointerup.forEach((f) => f({ clientX: 100, clientY: 18, screenX: 100, screenY: 18, pointerId: 1 }));
  };
  // Time passing: the clock moves on ms, and what was due by then runs (4.48)
  const advance = (ms) => { clock += ms; flush(ms); };
  // New data from Tasker, as when Bus Island or Bus Refresh sets it (4.48)
  const push = (d) => { el('d').textContent = typeof d === 'string' ? d : JSON.stringify(d); observed.forEach((f) => f()); };
  // Text Tasker fills in elsewhere in the page (4.52: #pos, the live editor's sliders)
  const setText = (id, t) => { el(id).textContent = t; observed.forEach((f) => f()); };
  // A finger held on the island for ms (4.48)
  const hold = (ms) => { el('p').listeners.pointerdown.forEach((f) => f({ clientX: 100, clientY: 18, screenX: 100, screenY: 18, pointerId: 1 })); flush(ms); };
  return { calls, flush, tap, push, setText, hold, advance, body: el('body'), html: el('html'), dataEl: el('d'), L: el('L'), R: el('R'), ctx };
}

module.exports = { run, runPage, clockAt, m, SCRIPTS, compose, files };
