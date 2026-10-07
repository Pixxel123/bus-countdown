// The scripts folder must match the JavaScriptlets inside Bus_Countdown.prj.xml, so the tests
// below are testing what's actually on the phone.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { SCRIPTS, compose } = require('./harness');

const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const embedded = [...xml.matchAll(/<code>129<\/code>[\s\S]*?<Str sr="arg0" ve="3">([\s\S]*?)<\/Str>/g)].map((x) => unescape(x[1]).trim());
const files = fs.readdirSync(SCRIPTS).filter((f) => f.endsWith('.js'));

test('every JavaScriptlet in the project is a script in the scripts folder (with its shared pieces)', () => {
  const contents = new Set(files.map((f) => compose(fs.readFileSync(path.join(SCRIPTS, f), 'utf8')).trim()));
  const missing = embedded.filter((src) => !contents.has(src)).map((src) => src.split('\n').slice(0, 2).join(' '));
  assert.deepStrictEqual(missing, []);
});

test('every script in the scripts folder is used by the project', () => {
  const used = new Set(embedded);
  const unused = files.filter((f) => !used.has(compose(fs.readFileSync(path.join(SCRIPTS, f), 'utf8')).trim()));
  assert.deepStrictEqual(unused, []);
});

test('every shared piece is included somewhere, and nothing defines its own copy', () => {
  const shared = fs.readdirSync(path.join(SCRIPTS, 'shared')).map((f) => f.replace(/\.js$/, ''));
  const raw = files.map((f) => fs.readFileSync(path.join(SCRIPTS, f), 'utf8')).join('\n');
  assert.deepStrictEqual(shared.filter((n) => !raw.includes('/* @include ' + n + ' */')), [], 'unused shared pieces');
  const ownCopies = files.filter((f) => /^function (get|loc|debugLog|decideSwipe|metres|bearingTo|wifiName|sideTarget|headsTowards|dirTable|hash|record)\(/m.test(fs.readFileSync(path.join(SCRIPTS, f), 'utf8')));
  assert.deepStrictEqual(ownCopies, [], 'scripts with their own copy of a shared helper');
});

test('every step has an explanation ("Title · explanation")', () => {
  const labels = [...xml.matchAll(/<label>([^<]*)<\/label>/g)].map((x) => unescape(x[1]));
  assert.deepStrictEqual([...new Set(labels.filter((l) => !l.includes(' \u00b7 ')))], []);
});

test('every Perform Task points at a task that exists', () => {
  const tasks = new Set([...xml.matchAll(/<Task sr="task\d+">[\s\S]*?<nme>(.*?)<\/nme>/g)].map((x) => x[1]));
  const targets = new Set([...xml.matchAll(/<code>130<\/code>[\s\S]*?<Str sr="arg0" ve="3">(.*?)<\/Str>/g)].map((x) => x[1]));
  assert.deepStrictEqual([...targets].filter((t) => !tasks.has(t)), []);
});

test('no script contains a literal closing script tag (Tasker runs JavaScriptlets inside a web page, so it would end the script there)', () => {
  const bad = files.filter((f) => /<\/script/i.test(compose(fs.readFileSync(path.join(SCRIPTS, f), 'utf8'))));
  assert.deepStrictEqual(bad, []);
});

test('every result a task reads is declared with its own "var" (Tasker misses one declared after a comma)', () => {
  // Found in 4.25: "var stillHere = {}, busbuzz = 'no';" never passed busbuzz back, so the buzz never ran
  const bad = [];
  files.forEach((f) => compose(fs.readFileSync(path.join(SCRIPTS, f), 'utf8')).split('\n').forEach((l, i) => {
    if (/^var [^;]*,\s*[a-z][a-z0-9_]*\s*=/.test(l)) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
  }));
  assert.deepStrictEqual(bad, []);
});
