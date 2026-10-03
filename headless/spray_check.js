/* ============================================================================
   spray_check.js · v0.1 · 2026-10-03

   The bat's direction at contact and where the ball goes, beside
   statcast/bat_direction.py. The bat's pull direction is the horizontal
   direction of its path at contact (+ toward the pull side), over all swings,
   contact and balls in play; hitters' own means and the scatter within a
   hitter; and for fair balls by type (ground balls under 10 deg, liners
   10-25, flies 25-50) the bat's direction and the ball's spray as the league
   measures it, from where the ball was fielded: the launch direction for a
   ground ball, where it came down for a ball in the air. Then the foul share of
   contact struck square vertically (launch minus attack angle within 5 deg).

   Run:  jsc bb_engine.js statcast/bat_direction_2025.js headless/spray_check.js -- [hitters] [PA each] [seed]

   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 600, NPA = +A[1] || 60, SEED = +A[2] || 5, DEG = BB.units.DEG;
  var rng = BB.makeRng(SEED + 101), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], all = [], con = [], bip = [], H = [], T = { GB: [[], []], LD: [[], []], FB: [[], []] }, sq = [0, 0];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function sd(v) { var m = mean(v); return Math.sqrt(mean(v.map(function (x) { return (x - m) * (x - m); }))); }
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < NPA; k++) {
      var Pi = P[(i * NPA + k) % P.length], sb = BB.batterSide(B, Pi); Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing) return;
        var th = q.swing.theta * sb / DEG; all.push(th); mine.push(th);
        if (!q.swing.contact) return;
        con.push(th);
        var bb = q.bb; if (!bb) return;
        if (Math.abs(bb.la - q.swing.attackAt) < 5) { sq[0]++; if (!bb.fair) sq[1]++; }
        if (!bb.fair) return;
        bip.push(th);
        var spray = (bb.la < 10 ? bb.spray : Math.atan2(bb.landing[0], bb.landing[1]) / DEG) * sb, t = bb.la < 10 ? 'GB' : bb.la < 25 ? 'LD' : bb.la < 50 ? 'FB' : null;
        if (t) { T[t][0].push(th); T[t][1].push(spray); }
      });
    }
    H.push(mine);
  }
  function f(v) { return mean(v).toFixed(1) + ' ± ' + sd(v).toFixed(1); }
  function g(o) { return o.mean.toFixed(1) + ' ± ' + o.sd.toFixed(1); }
  print('spray_check v0.1 · ' + N + ' hitters x ' + NPA + ' PA · seed ' + SEED + '   (model | league; deg, + toward the pull side)');
  print('  bat direction, all swings     ' + f(all) + '  |  ' + g(BATDIR.all_swings));
  print('  bat direction, contact        ' + f(con) + '  |  ' + g(BATDIR.contact));
  print('  bat direction, balls in play  ' + f(bip) + '  |  ' + g(BATDIR.bip));
  var hm = H.map(mean), wi = H.map(sd);
  print('  hitters\' own means            ' + f(hm) + '  |  ' + g(BATDIR.hitter_means) + ';  within a hitter sd ' + mean(wi).toFixed(1) + '  |  ' + BATDIR.within_hitter_sd.toFixed(1));
  ['GB', 'LD', 'FB'].forEach(function (t) {
    print('  ' + t + ': bat ' + f(T[t][0]) + '  |  ' + g(BATDIR.by_type[t].bat) + '      ball spray ' + f(T[t][1]) + '  |  ' + g(BATDIR.by_type[t].spray));
  });
  print('  foul share of contact struck square vertically  ' + (sq[1] / sq[0]).toFixed(3) + '  |  .211 (statcast/fouls.py)');
})(typeof arguments !== 'undefined' ? arguments : []);
