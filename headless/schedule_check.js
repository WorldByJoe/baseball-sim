/* ============================================================================
   schedule_check.js · v0.1 · 2026-10-02

   Checks the screen's schedule (bb_schedule.js) headless. For each seed:
   the number of segments and the game's length; that every event id is
   unique; where the seventh-inning stretch falls; and that, the stretch
   taken out, the run of segment kinds and the game's length match what
   page v2.1 laid down before the schedule left it (recorded in headless
   Chromium for seeds 7, 48 and 59). In Chromium the move was exact to the
   last bit; Node's V8 rounds a few physics results differently in the last
   digits, which once moved a play's length by 0.025 s (seed 59), so the
   length is checked to a tenth of a second here.

   Usage:
     node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js bb_schedule.js headless/schedule_check.js -- 7 48 59
     jsc bb_engine.js bb_names.js bb_field.js bb_game.js bb_schedule.js headless/schedule_check.js -- 7 48 59

   CHANGED
     v0.1  first build
============================================================================ */
(function (argv) {
  var V21 = {   // page v2.1 in Chromium: segments, total seconds, fingerprint of the kinds in order
    7: [1299, 4120.76, 'f5fcc54c'], 48: [883, 2887.97, '702dfe17'], 59: [821, 2716.91, '6c73e79c'] };
  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  var seeds = (argv.length ? argv : [7, 48, 59]).map(Number), bad = 0;
  seeds.forEach(function (seed) {
    var g = BBSchedule.game(seed), S = BBSchedule.build(g.G, g.PLAYER), SEG = S.SEG, ids = {}, dup = 0, st = null;
    SEG.forEach(function (s) { if (ids[s.id]) dup++; ids[s.id] = 1; if (s.kind === 'stretch') st = s; });
    var plain = SEG.filter(function (s) { return s.kind !== 'stretch'; }), shift = st ? st.dur : 0;
    var print_ = 'seed ' + seed + ': ' + SEG.length + ' segments, ' + (S.total / 60).toFixed(1) + ' min, ' + dup + ' duplicate ids, stretch ' + (st ? 'at ' + st.t0.toFixed(1) + ' s for ' + st.dur + ' s' : 'none');
    var fp = fnv(plain.map(function (s) { return s.kind; }).join(';'));
    var ref = V21[seed], tot = S.total - shift;
    if (ref) {
      var ok = ref[0] === plain.length && Math.abs(ref[1] - tot) < 0.1 && ref[2] === fp;
      print_ += ' | without it ' + plain.length + ' segments, ' + tot.toFixed(2) + ' s, fingerprint ' + fp + (ok ? ' = v2.1' : ' != v2.1 (' + ref.join(', ') + ')');
      if (!ok) bad++;
    } else print_ += ' | fingerprint ' + fp;
    if (dup) bad++;
    print(print_);
  });
  print(bad ? 'FAILED: ' + bad : 'all checks passed');
})(typeof arguments !== 'undefined' ? Array.prototype.slice.call(arguments) : []);
