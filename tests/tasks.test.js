// How the tasks run together: collision handling (what happens when a task is started while it's
// already running) and the priorities Perform Task uses. Read straight from Bus_Countdown.prj.xml,
// so a change to the build that alters either has to be made here too, with its reason.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const COLLISION_NAMES = { 0: 'abort new', 1: 'abort existing', 2: 'run both' };

const tasks = [...xml.matchAll(/<Task sr="task(\d+)">([\s\S]*?)<\/Task>/g)].map(([, id, body]) => {
  const actions = [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => a[1]);
  return {
    id, name: body.match(/<nme>(.*?)<\/nme>/)[1],
    collision: COLLISION_NAMES[(body.match(/<rty>(\d+)<\/rty>/) || [0, '0'])[1]],
    performs: actions.map((a, i) => {
      if (!/<code>130<\/code>/.test(a)) return null;
      // "Last" means nothing but other Perform Task or Stop steps come after it
      const last = actions.slice(i + 1).every((x) => /<code>(130|137)<\/code>/.test(x));
      return { target: unescape(a.match(/<Str sr="arg0" ve="3">(.*?)<\/Str>/)[1]), priority: +a.match(/<Int sr="arg1" val="(-?\d+)"\/>/)[1], last };
    }).filter(Boolean),
  };
});
const byName = Object.fromEntries(tasks.map((t) => [t.name, t]));
const allPerforms = tasks.flatMap((t) => t.performs.map((p) => Object.assign({ caller: t.name }, p)));

// ---- Collision handling: every task, deliberately ---------------------------------------------
const EXPECTED_COLLISION = {
  'Bus': ['abort new', 'the menu: a second tap while it is open does nothing'],
  'Bus Settings': ['abort existing', 'opening Settings again (or reopening after a preview) replaces the open screen'],
  'Bus Settings Button': ['abort new', 'one tap at a time'],
  'Bus Find Camera': ['abort new', 'one measurement at a time'],
  'Bus Start': ['abort new', 'a countdown already starting wins; the second start is not needed'],
  'Bus Loop': ['abort new', 'there must only ever be one refresh loop'],
  'Bus Refresh': ['abort existing', 'turning the phone (Bus Hide When Sideways) or a new refresh replaces one under way, so hiding the island is never lost'],
  'Bus End': ['abort new', 'ending twice achieves nothing'],
  'Bus Watch': ['abort new', 'a position pushed during a check is dropped: the next one is checked'],
  'Bus Wake': ['abort new', 'screen on twice in quick succession needs one check; switching profiles once is enough'],
  'Bus Status': ['abort new', 'one report at a time (Status, or Debugging with par1 copy)'],
  'Bus Island': ['abort new', 'one tick, or one stop switch, per gesture'],
};

test('every task has a deliberate collision setting', () => {
  const unknown = tasks.map((t) => t.name).filter((n) => !(n in EXPECTED_COLLISION));
  assert.deepStrictEqual(unknown, [], 'new tasks need an entry in EXPECTED_COLLISION, with the reason');
  const wrong = tasks.filter((t) => t.collision !== EXPECTED_COLLISION[t.name][0]).map((t) => `${t.name}: ${t.collision}, expected ${EXPECTED_COLLISION[t.name][0]}`);
  assert.deepStrictEqual(wrong, []);
});

// ---- Priorities ---------------------------------------------------------------------------------
// Tasker runs the higher-priority task first, and a task that's waiting still holds back anything
// of lower priority (seen on the phone in 4.16: Bus Settings, started at priority 1, wouldn't open
// until a countdown's Bus Loop, at 5, had ended). So:
//   - Bus Loop, which waits between refreshes for up to 30 minutes, is started below everything;
//   - Bus Settings, which waits while its screen is open, is started above Bus Loop (so it opens
//     during a countdown) but below everything else (so pushed positions and refreshes go on).
const priorityOf = (target) => allPerforms.filter((p) => p.target === target).map((p) => p.priority);

test('Bus Loop is always started below every other task', () => {
  const loopPri = Math.max(...priorityOf('Bus Loop'));
  const tooLow = allPerforms.filter((p) => p.target !== 'Bus Loop' && p.priority <= loopPri).map((p) => `${p.caller} -> ${p.target} at ${p.priority}`);
  assert.deepStrictEqual(tooLow, [], `everything else must be started above ${loopPri}`);
});

test('Bus Settings is started above Bus Loop (so it opens during a countdown), and below everything else', () => {
  const settings = priorityOf('Bus Settings'), loopPri = Math.max(...priorityOf('Bus Loop'));
  assert.ok(settings.every((p) => p > loopPri), `Bus Settings at ${settings}, Bus Loop at ${loopPri}`);
  const settingsPri = Math.max(...settings);
  const tooLow = allPerforms.filter((p) => !['Bus Loop', 'Bus Settings'].includes(p.target) && p.priority <= settingsPri)
    .map((p) => `${p.caller} -> ${p.target} at ${p.priority}`);
  assert.deepStrictEqual(tooLow, [], `everything else must be started above ${settingsPri}`);
});

test('what Bus Loop starts runs straight away, ahead of the loop itself', () => {
  const loopPri = Math.min(...allPerforms.filter((p) => p.target === 'Bus Loop').map((p) => p.priority));
  const slow = byName['Bus Loop'].performs.filter((p) => p.priority <= loopPri).map((p) => `${p.target} at ${p.priority}`);
  assert.deepStrictEqual(slow, []);
});

// A Perform Task with more steps after it runs alongside the rest of the caller (or after it, if
// lower priority). Each of those is listed here with why that's fine, so a new one can't slip in
// without thinking about the order things happen in.
const MID_TASK_PERFORMS = {
  'Bus Settings -> Bus Wake': 'only to switch the profiles after an import: nothing in Settings depends on it',
  'Bus Settings -> Bus Refresh': 'after a preview: puts real times back while the screen reopens',
  'Bus Start -> Bus Wake': 'only to switch the profiles after an import: independent of starting the countdown',
  'Bus Loop -> Bus End': 'time is up: the loop stops on its next step anyway',
  'Bus Loop -> Bus Watch': 'safety net: the check runs while the loop goes on to refresh',
  'Bus Loop -> Bus Refresh': 'the refresh runs while the loop waits for the next one',
  'Bus Watch -> Bus End': 'home or work Wi-Fi: Bus Watch stops itself on the next step',
  'Bus Watch -> Bus Start': 'just left work: Bus Watch stops on the next steps (no location needed)',
};

test('every Perform Task with steps after it is listed, with why that is safe', () => {
  const mid = [...new Set(allPerforms.filter((p) => !p.last).map((p) => `${p.caller} -> ${p.target}`))];
  assert.deepStrictEqual(mid.filter((k) => !(k in MID_TASK_PERFORMS)), [], 'new ones need an entry in MID_TASK_PERFORMS');
  assert.deepStrictEqual(Object.keys(MID_TASK_PERFORMS).filter((k) => !mid.includes(k)), [], 'entries that no longer apply should be removed');
});

test('no task is performed with a priority outside Tasker\'s range', () => {
  assert.deepStrictEqual(allPerforms.filter((p) => p.priority < 0 || p.priority > 50).map((p) => `${p.caller} -> ${p.target}`), []);
});

test('only Bus Settings starts itself, and only because it replaces itself', () => {
  const selfStarts = allPerforms.filter((p) => p.caller === p.target).map((p) => p.caller);
  assert.deepStrictEqual([...new Set(selfStarts)], ['Bus Settings']);
  assert.strictEqual(byName['Bus Settings'].collision, 'abort existing');
});

// ---- The wiring the scripts rely on (4.32: these steps could be deleted with every test passing) ------
const rawActions = (name) => {
  const body = [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((x) => x[1]).find((b) => b.includes('<nme>' + name + '</nme>'));
  return [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => a[1]);
};
const labelOf = (a) => unescape((a.match(/<label>(.*?)<\/label>/) || [0, ''])[1]);

test('every Perform Task of Bus End passes why it ended, as Bus End expects', () => {
  const calls = tasks.flatMap((t) => rawActions(t.name).filter((a) => /<code>130<\/code>/.test(a) && a.includes('<Str sr="arg0" ve="3">Bus End</Str>'))
    .map((a) => t.name + ': ' + (a.match(/<Str sr="arg2" ve="3">(.*?)<\/Str>/) || [0, ''])[1]));
  assert.deepStrictEqual(calls.sort(), ['Bus Loop: timeout', 'Bus Loop: timeout', 'Bus Watch: watch', 'Bus Watch: wifi', 'Bus: menu']);
});

test('Bus End copies %par1 into %busreason before its script runs', () => {
  // (4.43: after the island has gone, so the step just before the script)
  const acts = rawActions('Bus End');
  const at = acts.findIndex((a) => /^Note it in the debugging log/.test(labelOf(a)));
  const [first, second] = [acts[at - 1], acts[at]];
  assert.match(first, /<code>547<\/code>/);
  assert.match(first, /<Str sr="arg0" ve="3">%busreason<\/Str>/);
  assert.match(first, /<Str sr="arg1" ve="3">%par1<\/Str>/);
  assert.match(labelOf(second), /^Note it in the debugging log/);
});

test('Bus Watch stops before getting a fix when staying put far away, and only then', () => {
  const acts = rawActions('Bus Watch');
  const quiet = acts.findIndex((a) => a.includes('<lhs>%busquiet</lhs>'));
  const getloc = acts.findIndex((a) => /^Otherwise: get my location/.test(labelOf(a)));
  assert.ok(quiet > -1 && getloc > -1 && quiet < getloc, 'the stop comes before the first location step');
  assert.match(acts[quiet], /<code>137<\/code>/);
  assert.match(acts[quiet], /<rhs>yes<\/rhs>/);
});

test('Bus Start and Bus Settings create the recordings folder when Record trips is on', () => {
  for (const name of ['Bus Start', 'Bus Settings']) {
    // (Others, after each script that records, make sure of it on a new day: record_steps, 4.43)
    const mk = rawActions(name).filter((a) => /<code>409<\/code>/.test(a) && !/%busrecappend/.test(a));
    assert.strictEqual(mk.length, 1, name);
    assert.match(mk[0], /<Str sr="arg0" ve="3">Download\/Tasker-bus-trip-data<\/Str>/);
    assert.match(mk[0], /<lhs>%BusRecord<\/lhs><op>2<\/op><rhs>on<\/rhs>/);
    assert.match(mk[0], /<se>false<\/se>/, 'carries on if the folder is already there');
  }
});
