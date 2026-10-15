// Replay recorded days through an earlier version and through the code as it is now, and list every
// place they differ (4.63). A release meant only to tidy the code should show none; one that changes
// a rule shows exactly which pop-ups, endings and buzzes it changes, before it goes on the phone.
//   npm run compare -- v4.62 bus-trip-2026-10-13-Tue.jsonl [more recordings]
//   npm run compare -- v4.62 --wifi bus-trip-2026-10-13-Tue.jsonl    (Bus Watch's Wi-Fi rules too)
// The earlier version comes from git (a tag, branch or commit) into a temporary folder. Every script
// run is compared, with every global variable after it, as well as what was decided. With --wifi,
// watch_due.js runs before each position, with the network you were on from the recording's wifi
// lines, so a change there is compared too (an approximation: the phone also runs it on checks that
// left no line, on home or work Wi-Fi).
// The work is done by compareDirs, which the tests use with two folders.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// One version's replay of one day, logging every script run: [script, its outputs, every global]
function replayLogged(dir, lines, wifi) {
  dir = path.resolve(dir);
  const harness = require(path.join(dir, 'tests', 'harness'));
  if (!harness.__compare) {
    // replay-core takes run() when it's loaded, so it's wrapped once, before that, and logs to
    // whichever replay is going on
    const real = harness.run;
    harness.__compare = { real, log: null, lines: [], setup: {}, wifi: false };
    harness.run = function (name, opts) {
      const c = harness.__compare;
      if (c.wifi && name === 'watch.js') {
        let last = null;
        for (const l of c.lines) { if (l.t > opts.now) break; if (l.k === 'wifi') last = l; }
        const role = last ? last.to : 'none';
        const ssid = role === 'home' ? c.setup.BusHomeWifi : role === 'work' ? c.setup.BusWorkWifi : role === 'other' ? 'Another network' : '';
        const r0 = real('watch_due.js', { globals: opts.globals, now: opts.now, locals: Object.assign({}, opts.locals, { busssid: ssid ? '"' + ssid + '"' : '<unknown ssid>' }) });
        c.log.push(entry('watch_due.js', r0, opts.globals, opts.now));
      }
      const r = real(name, opts);
      c.log.push(entry(name, r, opts.globals, opts.now));
      return r;
    };
  }
  const c = harness.__compare;
  c.log = []; c.lines = lines; c.setup = ((lines.find((l) => l.k === 'setup') || {}).vars) || {}; c.wifi = !!wifi;
  const { replay } = require(path.join(dir, 'build', 'replay-core'));
  const out = replay(lines).out;
  return { runs: c.log, out };
}

// A script's outputs as Tasker sees them (its top-level variables that are text, numbers or true/false)
// and every global variable after it
function entry(name, r, g, now) {
  const outs = Object.keys(r).filter((k) => ['string', 'number', 'boolean'].includes(typeof r[k])).sort().map((k) => [k, r[k]]);
  return { name, now, text: JSON.stringify([name, outs, Object.keys(g).sort().map((k) => [k, g[k]])]) };
}
const unpack = (e) => { const [, outs, gs] = JSON.parse(e.text); return { name: e.name, now: e.now, outs, g: Object.fromEntries(gs) }; };

// What each position and each TfL reply led to, in a form to compare and to show
function decision(o) {
  if (o.k === 'check') return `[${o.state}] ${o.action} · ${o.why}`;
  if (o.k === 'tfl') return `buzz ${o.buzz || 'no'}` + (o.soonest ? ` · first ${o.soonest.k} in ${o.soonest.min.toFixed(1)} min` : '') + (o.yours ? ` · yours ${o.yours}` : '');
  return o.note || '';
}

// Compare two folders' replays of one day. Returns { runs, same, firstRun, decisions }:
// firstRun, the first script run that differs (with the globals that differ after it);
// decisions, every position or TfL reply whose outcome differs: { t, k, before, now }
function compareDirs(dirA, dirB, lines, opts) {
  const wifi = !!(opts && opts.wifi);
  const a = replayLogged(dirA, lines, wifi); const b = replayLogged(dirB, lines, wifi);
  let firstRun = null;
  const n = Math.max(a.runs.length, b.runs.length);
  for (let i = 0; i < n && !firstRun; i++) {
    if (a.runs[i] && b.runs[i] && a.runs[i].text === b.runs[i].text) continue;
    const x = a.runs[i] && unpack(a.runs[i]); const y = b.runs[i] && unpack(b.runs[i]);
    const keys = x && y ? Array.from(new Set(Object.keys(x.g).concat(Object.keys(y.g)))).filter((k) => x.g[k] !== y.g[k]) : [];
    const outs = x && y ? Array.from(new Set(x.outs.map((o) => o[0]).concat(y.outs.map((o) => o[0]))))
      .filter((k) => JSON.stringify((x.outs.find((o) => o[0] === k) || [])[1]) !== JSON.stringify((y.outs.find((o) => o[0] === k) || [])[1])) : [];
    firstRun = { i, t: (x || y).now, script: (x || y).name, other: x && y && x.name !== y.name ? y.name : '', globals: keys, outputs: outs,
      before: x ? Object.fromEntries(keys.map((k) => [k, x.g[k]])) : null, now: y ? Object.fromEntries(keys.map((k) => [k, y.g[k]])) : null };
  }
  const decisions = [];
  if (a.out.length === b.out.length) {
    a.out.forEach((o, i) => { const x = decision(o); const y = decision(b.out[i]); if (x !== y) decisions.push({ t: o.t, k: o.k, before: x, now: y }); });
  } else decisions.push({ t: 0, k: 'lines', before: `${a.out.length} lines played`, now: `${b.out.length} lines played` });
  return { runs: Math.max(a.runs.length, b.runs.length), same: !firstRun && !decisions.length, firstRun, decisions };
}

// The earlier version's scripts, build tools and test harness, from git, in a temporary folder
function checkout(ref) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-compare-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref, 'scripts', 'build', 'tests/harness.js'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return dir;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const wifi = args.includes('--wifi');
  const [ref, ...files] = args.filter((x) => x !== '--wifi');
  if (!ref || !files.length) { console.error('Usage: npm run compare -- v4.62 [--wifi] bus-trip-2026-10-13-Tue.jsonl [more]'); process.exit(1); }
  const before = checkout(ref);
  const now = path.join(__dirname, '..');
  const time = (t) => new Date(t).toTimeString().slice(0, 8);
  let differ = 0;
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const r = compareDirs(before, now, lines, { wifi });
    console.log(`\n${path.basename(f)}: ${r.runs} script runs, ` + (r.same ? 'identical to ' + ref : 'different from ' + ref));
    if (r.firstRun) {
      console.log(`  first difference: ${r.firstRun.script}${r.firstRun.other ? ' (now ' + r.firstRun.other + ')' : ''} at ${time(r.firstRun.t)}` +
        (r.firstRun.outputs.length ? `, outputs ${r.firstRun.outputs.join(', ')}` : '') + (r.firstRun.globals.length ? `, globals ${r.firstRun.globals.join(', ')}` : ''));
      for (const k of r.firstRun.globals.slice(0, 5)) console.log(`    ${k}\n      ${ref}: ${String(r.firstRun.before[k]).slice(0, 300)}\n      now: ${String(r.firstRun.now[k]).slice(0, 300)}`);
    }
    for (const d of r.decisions) console.log(`  ${d.t ? time(d.t) : ''} ${d.k}\n    ${ref}: ${d.before}\n    now: ${d.now}`);
    if (!r.same) differ++;
  }
  fs.rmSync(before, { recursive: true, force: true });
  console.log(`\n${files.length - differ} of ${files.length} recordings identical to ${ref}.`);
  process.exitCode = differ ? 1 : 0;
}

module.exports = { compareDirs };
