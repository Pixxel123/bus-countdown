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

test('the changelog starts with Unreleased, then this version', () => {
  assert.strictEqual(releases[0].v, 'Unreleased');
  assert.strictEqual(releases[1].v, VERSION, 'add a "## [' + VERSION + '] - YYYY-MM-DD" entry to CHANGELOG.md');
});

test('every release has a date, newest first, and appears once', () => {
  const rest = releases.slice(1);
  for (const r of rest) assert.ok(r.date, r.v + ' needs a date');
  for (let i = 1; i < rest.length; i++) assert.ok(rest[i - 1].date >= rest[i].date, rest[i - 1].v + ' is older than ' + rest[i].v);
  assert.strictEqual(new Set(rest.map((r) => r.v)).size, rest.length);
});

test('every entry is under one of Keep a Changelog\'s headings', () => {
  for (const [, h] of log.matchAll(/^### (.+)$/gm)) assert.ok(['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'].includes(h), h);
});
