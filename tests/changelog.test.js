// CHANGELOG.md (Keep a Changelog format): the newest release in it is the version the build makes, so
// a version bump without its notes fails here, and the release workflow can take its notes from it.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const VERSION = /VERSION = '([\d.]+)'/.exec(fs.readFileSync(path.join(ROOT, 'build', 'assemble.py'), 'utf8'))[1];
const releases = [...log.matchAll(/^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?$/gm)].map((m) => ({ v: m[1], date: m[2] }));

test('the changelog starts with this version', () => {
  assert.strictEqual(releases[0].v, VERSION, 'add a "## [' + VERSION + '] - YYYY-MM-DD" entry to CHANGELOG.md');
});

test('every release has a date, newest first, and appears once', () => {
  for (const r of releases) assert.ok(r.date, r.v + ' needs a date');
  for (let i = 1; i < releases.length; i++) assert.ok(releases[i - 1].date >= releases[i].date, releases[i - 1].v + ' is older than ' + releases[i].v);
  assert.strictEqual(new Set(releases.map((r) => r.v)).size, releases.length);
});

test('every entry is under one of Keep a Changelog\'s headings', () => {
  for (const [, h] of log.matchAll(/^### (.+)$/gm)) assert.ok(['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'].includes(h), h);
});

// Every version up to this one has a heading of its own (4.62). 4.59, 4.60 and 4.61 each replaced the
// version before's heading instead of adding one, and 4.58 to 4.60 went missing until it was noticed.
// There was no 4.1 to 4.4: the numbering went from 4 straight to 4.5.
test('no version is missing its heading', () => {
  const have = new Set(releases.map((r) => r.v));
  const want = ['1', '2', '3', '4'];
  for (let i = 5; i <= +VERSION.split('.')[1]; i++) want.push('4.' + i);
  assert.deepStrictEqual(want.filter((v) => !have.has(v)), []);
});
