// The island mockup (docs/mockup.html, also published as an artifact): its Now tab draws the island
// with the project's own island_show.js, and its Timeline tab has an entry for every version.
// Every change to the island gets recorded there: a build that bumps the version without adding its
// timeline entry fails here.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { compose } = require('./harness');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'docs', 'mockup.html'), 'utf8');
const VERSION = /VERSION = '([\d.]+)'/.exec(fs.readFileSync(path.join(ROOT, 'build', 'assemble.py'), 'utf8'))[1];

test('the mockup is built from the current island_show.js (run npm run build after changing it)', () => {
  const island = compose(fs.readFileSync(path.join(ROOT, 'scripts', 'island_show.js'), 'utf8'))
    .replaceAll('<!--', "${'<'}!--").replaceAll('<script', "${'<'}script").trim();
  assert.ok(page.includes(island));
  assert.ok(page.includes('Version ' + VERSION));
});

test('the timeline has an entry for this version, with a sentence on it', () => {
  const m = new RegExp("\\['" + VERSION.replace('.', '\\.') + "', '[^']+', 'v\\w+', (true|false), '(.{40,}?)'\\]").exec(page);
  assert.ok(m, 'add a line for ' + VERSION + ' to VERSIONS in docs/mockup.src.html');
});

test('no script in the page holds text that would end or confuse its script tag', () => {
  for (const [, body] of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotMatch(body, /<!--|<script/i);
  }
});
