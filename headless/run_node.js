#!/usr/bin/env node
/* ============================================================================
   run_node.js · v0.1 · 2026-09-30

   Runs the headless scripts under Node the way jsc runs them on the Mac:
   every file on the command line is loaded into ONE shared global scope, in
   order (so bb_engine.js defines BB for the files after it), `print` writes
   a line, `readFile` reads a file, and the script's top-level `arguments`
   are whatever follows `--`. Written for a cloud machine without
   JavaScriptCore; untested on the Mac, which has no Node.

   Usage:
     node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
     node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js headless/power_chain.js -- 500 40 3

   CHANGED
     v0.1  first build
============================================================================ */
const fs = require('fs'), vm = require('vm');
const argv = process.argv.slice(2), sep = argv.indexOf('--');
const files = sep < 0 ? argv : argv.slice(0, sep), args = sep < 0 ? [] : argv.slice(sep + 1);
const ctx = vm.createContext({
  print: function () { console.log(Array.prototype.join.call(arguments, ' ')); },
  readFile: function (p) { return fs.readFileSync(p, 'utf8'); },
  arguments: args, console: console, Math: Math, Date: Date, JSON: JSON, Number: Number, String: String, Array: Array, Object: Object,
});
for (const f of files) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
