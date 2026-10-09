// ESLint for the project's JavaScriptlets. Scripts are linted as Tasker runs them: with their shared
// pieces filled in (build/lint.js writes those to .lint/ first), in plain "script" mode, with Tasker's
// global() and setGlobal() and the task's local variables available as globals.
'use strict';
const globals = require('globals');

// Local variables Tasker passes into the scripts (task locals, Perform Task parameters, results of
// earlier steps). Listing them means a misspelt variable is still reported as undefined.
const taskerLocals = [
  'par1', 'par2', 'caller1', 'busssid', 'buscaller', 'busfrom', 'busreason', 'busaction', 'busstop', 'busvalue', 'bussetting',
  'http_data', 'http_response_code', 'gl_latitude', 'gl_longitude', 'gl_time_seconds', 'gl_coordinates_accuracy',
  'bus_lastloc', 'bus_fixtime', 'bus_hasspeed', 'bus_speed', 'bus_hasbearing', 'bus_bearing', 'bus_acc',
  'busacc', 'busspeed', 'busbearing', 'busnearedge', 'busdwell', 'busstatus', 'busbuild', 'busroute', 'busprevgap', 'busprevy',
  'bp_fine', 'errmsg', 'ld_selected', 'busres', 'buscfg', 'busmetrics', 'busrects', 'businsets', 'busproblem',
  'i', 'busttroute', 'busfetch', 'busrects2', 'buscuterr', 'busconfig', 'busisland', 'busstart', 'writeFile', 'readFile', 'shell',
];

module.exports = [
  {
    files: ['.lint/**/*.js', 'scripts/shared/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'script',
      globals: Object.assign({ global: 'readonly', setGlobal: 'readonly' }, globals.browser,
        Object.fromEntries(taskerLocals.map((n) => [n, 'readonly']))),
    },
    rules: {
      'no-undef': 'error',
      // Top-level variables are the script's outputs (Tasker reads them back), so only local
      // variables inside functions are checked for being unused
      'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }],
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'eqeqeq': ['error', 'always'],
      'no-eval': 'off',                          // loc() reads a local variable by name
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'no-shadow': ['warn', { builtinGlobals: false }],
      // One variable per "var": Tasker only passes back a script's results declared as "var name", so
      // one declared after a comma is silently lost (4.25's buzz never ran because of it)
      'one-var': ['error', 'never'],
    },
  },
  {
    // Shared pieces are used by the scripts that include them, and can use each other's helpers
    files: ['scripts/shared/*.js'],
    languageOptions: { globals: { get: 'readonly', loc: 'readonly', metres: 'readonly', bearingTo: 'readonly', stopLetter: 'readonly' } },
    rules: { 'no-unused-vars': 'off' },
  },
];
