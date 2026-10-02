/* ============================================================================
   schedule_check.js · v0.2 · 2026-10-02

   Checks the screen's schedule (bb_schedule.js) headless. For each seed:
   the number of segments and the game's length; that every event id is
   unique; where the seventh-inning stretch falls; and that, the stretch
   taken out, the run of segment kinds and the game's length match what
   page v2.4 (engine v1.0) laid down before the schedule left it (recorded
   in headless Chromium for seeds 7, 48 and 59). In Chromium the move was exact to the
   last bit; Node's V8 rounds a few physics results differently in the last
   digits, which once moved a play's length by 0.025 s (seed 59), so the
   length is checked to a tenth of a second here.

   One seed per process: the engine numbers its players from a counter that
   runs on across games, and since engine v1.0 a game depends on those
   numbers, so a second game drawn in the same process is not the one the
   page draws for that seed. Seeds after the first are checked for ids and
   the stretch only. Loop in the shell to check several against the page.

   Usage:
     for s in 7 48 59; do node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js bb_schedule.js headless/schedule_check.js -- $s; done
     for s in 7 48 59; do jsc bb_engine.js bb_names.js bb_field.js bb_game.js bb_schedule.js headless/schedule_check.js -- $s; done

   CHANGED
     v0.2  the reference is page v2.4 on engine v1.0; only a process's first game is compared
     v0.1  first build
============================================================================ */
(function (argv) {
  var V21 = {   // page v2.4 (engine v1.0) in Chromium: segments, total seconds, fingerprint of the kinds in order
    7: [1041, 3245.05, 'fd5dc899'], 48: [1069, 3361.03, 'aac6fc7f'], 59: [1023, 3250.24, 'd0afed49'] };
  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  var seeds = (argv.length ? argv : [7, 48, 59]).map(Number), bad = 0;
  seeds.forEach(function (seed, gi) {
    var g = BBSchedule.game(seed), S = BBSchedule.build(g.G, g.PLAYER), SEG = S.SEG, ids = {}, dup = 0, st = null;
    SEG.forEach(function (s) { if (ids[s.id]) dup++; ids[s.id] = 1; if (s.kind === 'stretch') st = s; });
    var plain = SEG.filter(function (s) { return s.kind !== 'stretch'; }), shift = st ? st.dur : 0;
    var print_ = 'seed ' + seed + ': ' + SEG.length + ' segments, ' + (S.total / 60).toFixed(1) + ' min, ' + dup + ' duplicate ids, stretch ' + (st ? 'at ' + st.t0.toFixed(1) + ' s for ' + st.dur + ' s' : 'none');
    var fp = fnv(plain.map(function (s) { return s.kind; }).join(';'));
    var ref = gi === 0 ? V21[seed] : null, tot = S.total - shift;   // only the first game drawn in a process is the page's
    if (ref) {
      var ok = ref[0] === plain.length && Math.abs(ref[1] - tot) < 0.1 && ref[2] === fp;
      print_ += ' | without it ' + plain.length + ' segments, ' + tot.toFixed(2) + ' s, fingerprint ' + fp + (ok ? ' = v2.4' : ' != v2.4 (' + ref.join(', ') + ')');
      if (!ok) bad++;
    } else print_ += ' | fingerprint ' + fp + (gi ? ' (drawn after another game: not compared with the page)' : '');
    if (dup) bad++;
    print(print_);
  });
  print(bad ? 'FAILED: ' + bad : 'all checks passed');
})(typeof arguments !== 'undefined' ? Array.prototype.slice.call(arguments) : []);
