/* ============================================================================
   contact_spread.js · v0.1 · 2026-10-13

   Each of the model's hitters' launch angles on his balls in play (and exit speeds), against the league's pitchers in MLB's
   parks: per hitter, the mean and the spread (sd) of launch angle, the line-drive share (10-25 deg), the mean exit speed,
   and his traits that set the vertical contact (motorIn, undercut, attack, timingSD, eyeSD). For step 2 of the run audit
   (2026-10-13): the model's launch angles are too spread (too few at 0-30 deg, too many at 40-50). Is each hitter too
   scattered, or are the hitters too different from each other?

   Run:  tools/diag/run.sh bb_engine.js review/contact_spread.js -- [hitters] [PA each] [seed] > out.jsonl
   CHANGED
     v0.1  first build (Joe, 2026-10-13)
============================================================================ */
(function (A) {
  var N = +A[0] || 200, NPA = +A[1] || 400, SEED = +A[2] || 1;
  var rng = BB.makeRng(SEED * 31 + 7), P = [], ump = BB.makeUmp(rng);
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (var h = 0; h < N; h++) {
    var B = BB.makeBatter(rng, {}), la = [], ev = [];
    for (var k = 0; k < NPA; k++) {
      var Pk = P[Math.floor(rng.u() * P.length)], env = BB.mlbEnv(rng); Pk.load = rng.u() * 0.8 * Pk.stamina;
      var bb = BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).bb;
      if (bb) { la.push(bb.la); ev.push(bb.ev); }
    }
    var m = la.reduce(function (a, b) { return a + b; }, 0) / la.length, sd = Math.sqrt(la.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (la.length - 1));
    print(JSON.stringify({ n: la.length, laMean: +m.toFixed(2), laSd: +sd.toFixed(2), ld: +(la.filter(function (x) { return x >= 10 && x < 25; }).length / la.length).toFixed(4),
      ev: +(ev.reduce(function (a, b) { return a + b; }, 0) / ev.length).toFixed(2), motorIn: B.motorIn, barrelSD: B.barrelSD, undercut: B.undercut, attack: B.attack, timingSD: B.timingSD, eyeSD: B.eyeSD, batSpeed: B.batSpeed }));
  }
})(typeof arguments !== 'undefined' ? arguments : []);
