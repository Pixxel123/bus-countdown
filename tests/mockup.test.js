// The island mockup (docs/mockup.html, also published as an artifact): its Now tab draws the island
// with the project's own island_show.js, and its Timeline tab has an entry for every version that
// changed how the island looks, and only those (a version that changes what happens underneath
// leaves the page alone).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { compose } = require('./harness');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'docs', 'mockup.html'), 'utf8');

test('the mockup is built from the current island_show.js (run npm run build after changing it)', () => {
  const island = compose(fs.readFileSync(path.join(ROOT, 'scripts', 'island_show.js'), 'utf8'))
    .replaceAll('<!--', "${'<'}!--").replaceAll('<script', "${'<'}script").trim();
  assert.ok(page.includes(island));
});

test('the timeline lists only changes to the island, newest first, and the Now tab names the newest', () => {
  const entries = [...page.matchAll(/^ {4}\['([^']+)', '([^']+)', '(v\w+)', '(.{40,}?)'\],?$/gm)];
  assert.ok(entries.length >= 10);
  assert.doesNotMatch(page, /Same island/);
  const looks = entries.map((e) => e[3]);
  assert.strictEqual(new Set(looks).size, looks.length, 'two entries draw the same island');
  assert.ok(page.includes('Version ' + entries[0][1]));
  const project = /VERSION = '([\d.]+)'/.exec(fs.readFileSync(path.join(ROOT, 'build', 'assemble.py'), 'utf8'))[1];
  assert.ok(+entries[0][1] <= +project, 'the newest island is no newer than the project');
});

test('no script in the page holds text that would end or confuse its script tag', () => {
  for (const [, body] of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotMatch(body, /<!--|<script/i);
  }
});
