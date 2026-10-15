// Replay recorded days through an earlier version and through the code as it is now, and list every
// place they differ (4.63). A release meant only to tidy the code should show none; one that changes
// a rule shows exactly which pop-ups, endings and buzzes it changes, before it goes on the phone.
//   npm run compare -- v4.62 bus-trip-2026-10-13-Tue.jsonl [more recordings]
//   npm run compare -- v4.62 --wifi bus-trip-2026-10-13-Tue.jsonl    (Bus Watch's Wi-Fi rules too)
// The earlier version comes from git (a tag, branch or commit) into a temporary folder. Every script
// run is compared, with every global variable after it, as well as what was decided. With --wifi,
// watch_due.js runs before each position, with the network you were on from the recording's wifi
// lines (without the position on screen-on checks, which get theirs after it), and when you got to
// home or work Wi-Fi, so a change there is compared too: countdowns started on leaving, or ended on
// getting to home or work Wi-Fi, are then decided by the rules rather than played as they happened,
// and a position on home or work Wi-Fi isn't checked further. Approximate: the phone also runs the
// rules on checks that left no line.
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
    // replay-core takes run() when it's loaded, so it's wrapped once, before that (loading it afresh if
    // something loaded it already), and logs to whichever replay is going on
    delete require.cache[require.resolve(path.join(dir, 'build', 'replay-core'))];
    const real = harness.run;
    harness.__compare = { real, log: null, lines: [], setup: {}, wifi: false };
    harness.run = function (name, opts) {
      const c = harness.__compare;
      const nameOf = (role) => role === 'home' ? c.setup.BusHomeWifi : role === 'work' ? c.setup.BusWorkWifi : role === 'other' ? 'Another network' : '';
      if (c.wifi && name === 'watch.js') {
        // Getting to home or work Wi-Fi: the check that noticed left no line (nothing more to do there),
        // but its Wi-Fi rules ran, so they're run here, at that moment, as a screen-on check
        for (const l of c.lines) {
          if (l.t > opts.now) break;
          if (l.k !== 'wifi' || l.t <= c.lastT || (l.to !== 'home' && l.to !== 'work')) continue;
          const rj = real('watch_due.js', { globals: opts.globals, now: l.t, locals: { buscaller: 'profile=wake', busssid: '"' + nameOf(l.to) + '"' } });
          c.log.push(entry('watch_due.js', rj, opts.globals, l.t));
        }
        c.lastT = opts.now;
        let last = null;
        for (const l of c.lines) { if (l.t > opts.now) break; if (l.k === 'wifi') last = l; }
        const ssid = nameOf(last ? last.to : 'none');
        // A screen-on check has no position yet when the Wi-Fi rules run (the fix comes after)
        const locals = Object.assign({}, opts.locals, { busssid: ssid ? '"' + ssid + '"' : '<unknown ssid>' });
        if (/^profile=(wake|loop)$/.test(locals.buscaller)) { delete locals.gl_latitude; delete locals.gl_longitude; }
        const r0 = real('watch_due.js', { globals: opts.globals, now: opts.now, locals });
        c.log.push(entry('watch_due.js', r0, opts.globals, opts.now));
        const g = opts.globals;
        // What the task does next: end the countdown, or start one for the stop the phone showed when
        // it did the same (else your nearest), and check no further on home or work Wi-Fi
        if (r0.busend === 'yes' && g.BusStateRunning === '1') {
          g.BusStateRunning = '0'; g.TRUN = '';
          c.wifiDecisions.push({ t: opts.now, k: 'wifi rules', d: 'home or work Wi-Fi: the countdown ends' });
        }
        if (r0.busleave === 'yes') {
          const was = c.leaving.find((l) => Math.abs(l.t - opts.now) <= 60000);
          const rows = (g.BusPlaces || '').split('\n').map((x) => x.split('|')).filter((p) => p[0] === 'bus');
          const near = rows.map((p) => ({ id: p[1], n: p[2], d: Math.hypot(parseFloat(p[3]) - parseFloat(opts.locals.gl_latitude), (parseFloat(p[4]) - parseFloat(opts.locals.gl_longitude)) * 0.62) }))
            .sort((x, y) => x.d - y.d)[0];
          g.BusStateRunning = '1'; g.TRUN = 'Bus Loop';
          g.BusStateStopId = was ? was.stop : near ? near.id : g.BusStateStopId; g.BusStateStopName = was ? was.name : near ? near.n : g.BusStateStopName;
          c.wifiDecisions.push({ t: opts.now, k: 'wifi rules', d: 'left ' + (r0.leftWhich || 'home or work') + ' Wi-Fi: a countdown for ' + g.BusStateStopName });
        }
        if (r0.busdue === 'no' && /^profile/.test(locals.buscaller || '')) {
          c.log.push({ name: 'watch.js', now: opts.now, text: JSON.stringify(['watch.js', 'not run: ' + r0.why]) });
          const trip = g.BusStateTrip;
          return { busaction: '', why: 'not checked: ' + r0.why, trip };
        }
      }
      const r = real(name, opts);
      c.log.push(entry(name, r, opts.globals, opts.now));
      return r;
    };
  }
  const c = harness.__compare;
  // With the Wi-Fi rules played, countdowns they start or end on the phone are theirs to decide here
  c.leaving = wifi ? lines.filter((l) => l.k === 'start' && l.mode === 'leaving') : [];
  if (wifi) lines = lines.filter((l) => !(l.k === 'start' && l.mode === 'leaving') && !(l.k === 'end' && l.from === 'wifi'));
  c.log = []; c.wifiDecisions = []; c.lastT = 0; c.lines = lines; c.setup = ((lines.find((l) => l.k === 'setup') || {}).vars) || {}; c.wifi = !!wifi;
  const { replay } = require(path.join(dir, 'build', 'replay-core'));
  const out = replay(lines).out;
  return { runs: c.log, out, wifi: c.wifiDecisions };
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

// Compare two folders' replays of one day. Returns { runs, same, firstRun, decisions, onlyBefore, onlyNow }:
// firstRun, the first script run that differs (with the globals that differ after it), among the
// scripts both run; decisions, every position, TfL reply or (with wifi) Wi-Fi decision whose outcome
// differs: { t, k, before, now }; onlyBefore and onlyNow, scripts only one side's replay runs, with
// how many times
function compareDirs(dirA, dirB, lines, opts) {
  const wifi = !!(opts && opts.wifi);
  const a = replayLogged(dirA, lines, wifi); const b = replayLogged(dirB, lines, wifi);
  // Scripts only one version's replay runs (a newer replay may play more kinds of line) are counted,
  // and left out of the run-by-run comparison
  const namesA = new Set(a.runs.map((r) => r.name)); const namesB = new Set(b.runs.map((r) => r.name));
  const only = (runs, other) => { const c = {}; runs.filter((r) => !other.has(r.name)).forEach((r) => { c[r.name] = (c[r.name] || 0) + 1; }); return c; };
  const onlyBefore = only(a.runs, namesB); const onlyNow = only(b.runs, namesA);
  const ra = a.runs.filter((r) => namesB.has(r.name)); const rb = b.runs.filter((r) => namesA.has(r.name));
  let firstRun = null;
  const n = Math.max(ra.length, rb.length);
  for (let i = 0; i < n && !firstRun; i++) {
    if (ra[i] && rb[i] && ra[i].text === rb[i].text) continue;
    const x = ra[i] && unpack(ra[i]); const y = rb[i] && unpack(rb[i]);
    const keys = x && y ? Array.from(new Set(Object.keys(x.g).concat(Object.keys(y.g)))).filter((k) => x.g[k] !== y.g[k]) : [];
    const outs = x && y ? Array.from(new Set(x.outs.map((o) => o[0]).concat(y.outs.map((o) => o[0]))))
      .filter((k) => JSON.stringify((x.outs.find((o) => o[0] === k) || [])[1]) !== JSON.stringify((y.outs.find((o) => o[0] === k) || [])[1])) : [];
    firstRun = { i, t: (x || y).now, script: (x || y).name, other: x && y && x.name !== y.name ? y.name : '', globals: keys, outputs: outs,
      before: x ? Object.fromEntries(keys.map((k) => [k, x.g[k]])) : null, now: y ? Object.fromEntries(keys.map((k) => [k, y.g[k]])) : null };
  }
  const decisions = [];
  // Matched by time and kind (an earlier version may not have played every kind of line), leaving out
  // the Wi-Fi changes themselves, which are what happened rather than anything decided
  const keyed = (out) => { const m = new Map(); const n = {}; out.filter((o) => o.k !== 'wifi').forEach((o) => { const k = o.t + '|' + o.k; n[k] = (n[k] || 0) + 1; m.set(k + '|' + n[k], o); }); return m; };
  const ka = keyed(a.out.concat(a.wifi)); const kb = keyed(b.out.concat(b.wifi));
  const keys = Array.from(new Set(Array.from(ka.keys()).concat(Array.from(kb.keys())))).sort((x, y) => parseInt(x, 10) - parseInt(y, 10));
  for (const k of keys) {
    const o = ka.get(k); const p = kb.get(k);
    const x = o ? (o.d || decision(o)) : '(nothing)'; const y = p ? (p.d || decision(p)) : '(nothing)';
    if (x !== y) decisions.push({ t: (o || p).t, k: (o || p).k, before: x, now: y });
  }
  const extra = Object.keys(onlyBefore).length + Object.keys(onlyNow).length;
  return { runs: Math.max(a.runs.length, b.runs.length), same: !firstRun && !decisions.length && !extra, firstRun, decisions, onlyBefore, onlyNow };
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
  let before;
  try { before = checkout(ref); } catch (e) { console.error(`Couldn't get ${ref} from git (a tag such as v4.62, a branch or a commit): ${String(e.stderr || e.message).trim()}`); process.exit(1); }
  const now = path.join(__dirname, '..');
  const time = (t) => new Date(t).toTimeString().slice(0, 8);
  let differ = 0;
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const r = compareDirs(before, now, lines, { wifi });
    console.log(`\n${path.basename(f)}: ${r.runs} script runs, ` + (r.same ? 'identical to ' + ref : 'different from ' + ref));
    for (const [k, v] of Object.entries(r.onlyNow)) console.log(`  only now: ${k} (${v} runs)`);
    for (const [k, v] of Object.entries(r.onlyBefore)) console.log(`  only in ${ref}: ${k} (${v} runs)`);
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
