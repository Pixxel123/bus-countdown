// Lint the scripts as Tasker runs them: fill in each script's shared pieces (the same way the build
// and the tests do), write the results to .lint/, then run ESLint on them (see eslint.config.js).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { compose } = require('../tests/harness');

const root = path.join(__dirname, '..');
const scripts = path.join(root, 'scripts');
const out = path.join(root, '.lint');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of fs.readdirSync(scripts).filter((n) => n.endsWith('.js'))) {
  fs.writeFileSync(path.join(out, f), compose(fs.readFileSync(path.join(scripts, f), 'utf8')));
}
try {
  execFileSync(path.join(root, 'node_modules', '.bin', 'eslint'), ['.lint', 'scripts/shared', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
} catch (e) { process.exitCode = 1; }
