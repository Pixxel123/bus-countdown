// V4.51: Settings' preview flashes less as its stop board appears: the board is built while the island
// shows, appears on top of it at once, and only then does the island go. (A new window is still empty
// for about 0.2 s before its page draws.)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// The island closed itself after 3 s, fading, while the board was still being built, and the board
// then faded in: a moment with nothing, then a fade (the flash still seen with 4.48's widths matched)
test('preview: the board is built while the island shows, appears on top of it at once, and then the island goes', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'Bus_Countdown.prj.xml'), 'utf8');
  for (const task of ['Bus Settings', 'Bus Settings Button']) {
    const body = [...xml.matchAll(/<Task sr="task\d+">([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes(`<nme>${task}</nme>`));
    const s = [...body.matchAll(/<Action sr="act\d+" ve="7">([\s\S]*?)<\/Action>/g)].map((a) => a[1]);
    const at = (re, from) => s.findIndex((x, i) => i >= (from || 0) && re.test(x));
    const island = at(/<code>479<\/code>[\s\S]*<Str sr="arg11" ve="3"\/>[\s\S]*<Str sr="arg2" ve="3">buspreview<\/Str>/);
    const build = at(/Build the island with its stop board/), wait3 = at(/Wait 3 seconds/);
    const board = at(/<Str sr="arg2" ve="3">buspreview2<\/Str>/), gone = at(/<code>\d+<\/code>[\s\S]*Then remove the island, under it/), wait4 = at(/Wait 4 seconds/);
    assert.ok(island > -1 && island < build && build < wait3 && wait3 < board && board < gone && gone < wait4, task + ': in that order');
    assert.match(s[board], /<Str sr="arg9" ve="3">None<\/Str>/, task + ': the board appears at once, not fading in');
    assert.match(s[gone], /<Str sr="arg0" ve="3">buspreview<\/Str>/);
  }
});
