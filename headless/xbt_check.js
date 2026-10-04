/* ============================================================================
   xbt_check.js · v0.1 · 2026-10-04
   How far runners go on a single or a double, the shape statcast/baserunning.py
   measures the league's (loaded first as BASERUN, statcast/baserunning_2025.js):
   a runner on second alone on a single (scored, held at third, out), a runner on
   first alone on a single (to third or home, held at second, out) and on a
   double (scored, held at third, out), by outs. Plays whole games.
   Run:  jsc bb_engine.js bb_names.js bb_field.js bb_game.js statcast/baserunning_2025.js headless/xbt_check.js -- [games] [seed]
   CHANGED
     v0.1  first build (the base-running targets had been checked by hand)
============================================================================ */
(function (A) {
  var N = +A[0] || 400, SEED = +A[1] || 3, rng = BB.makeRng(SEED), L = typeof BASERUN !== 'undefined' ? BASERUN : null;
  var T = {};
  function add(k, outs, where) { [outs, 'all'].forEach(function (o) { var c = T[k + '|' + o] = T[k + '|' + o] || { n: 0 }; c.n++; c[where] = (c[where] || 0) + 1; }); }
  for (var g = 0; g < N; g++) {
    var tm = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, tm[0]), BBGame.makeTeam(rng, tm[1]), { rng: rng });
    G.plays.forEach(function (p) {
      if (!p.play || !p.pa || (p.play.hit !== '1B' && p.play.hit !== '2B')) return;
      var last = p.pa.pitches[p.pa.pitches.length - 1], b = (last && last.bases) || p.bases, outs = last && last.outsAt !== undefined ? last.outsAt : p.outs;
      var r2 = b[2] && !b[1] && !b[3], r1 = b[1] && !b[2] && !b[3];
      if (!r1 && !r2) return;
      var r = r2 ? b[2] : b[1], after = p.play.bases, k = -1;
      for (var i = 1; i <= 3; i++) if (after[i] === r) k = i;
      var where = k === 2 ? 'second' : k === 3 ? 'third' : k === 1 ? 'other' : p.play.runs > 0 ? 'scored' : 'out';
      if (r2 && p.play.hit === '1B') add('R2 on a single', outs, where);
      else if (r1 && p.play.hit === '1B') add('R1 on a single', outs, where === 'scored' ? 'third' : where);
      else if (r1) add('R1 on a double', outs, where);
    });
  }
  function f(c, w) { return c ? ((c[w] || 0) / c.n).toFixed(2) : '  - '; }
  function fl(l, w) { return l ? (l[w] || 0).toFixed(2) : '  - '; }   // the league's are shares already
  print('xbt_check v0.1 · ' + N + ' games · seed ' + SEED + '   (model | league, share of chances)');
  [['R2 on a single', 'scored', 'third'], ['R1 on a single', 'third', 'second'], ['R1 on a double', 'scored', 'third']].forEach(function (q) {
    [0, 1, 2, 'all'].forEach(function (o) {
      var c = T[q[0] + '|' + o], l = L && L[q[0] + '|' + o];
      print('  ' + q[0] + ', ' + o + ' out' + (o === 1 ? '' : 's') + ': n ' + (c ? c.n : 0) + '   ' + q[1] + ' ' + f(c, q[1]) + ' | ' + fl(l, q[1]) + '   ' + q[2] + ' ' + f(c, q[2]) + ' | ' + fl(l, q[2]) + '   out ' + f(c, 'out') + ' | ' + fl(l, 'out'));
    });
  });
})(arguments);
