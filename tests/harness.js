// Test harness: runs the project's JavaScriptlets (in ../scripts) the way Tasker does.
//   Tasker gives a JavaScriptlet global(name) and setGlobal(name, value) for global variables, and
//   the task's local variables as plain JavaScript variables. Every top-level "var" the script
//   declares comes back as a task local. Here each script runs in its own Node vm context with the
//   same shape, a fake clock, and a plain object standing in for Tasker's global variables.
'use strict';
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
  return ctx;
}

// Metres to degrees of latitude, for building positions along a north-south road
const m = (metres) => metres / 111320;

module.exports = { run, clockAt, m, SCRIPTS, compose, files };
