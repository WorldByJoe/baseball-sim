/* foul_mix.js · v0.1 · 2026-10-14: the engine's fastball fouls at 10-70 deg, split by where they go (back: spray beyond 90 deg; side:
   45-90) and by how near the edge of the ball the bat met it (|D| over ball + barrel radius): each group's share, exit speed over
   the pitch's (median) and slope on bat speed. For the swing refit: the league's fouls leave at .813 of the pitch's speed and follow
   the bat 0.28 mph per mph; the engine's .89 and 0.6.  Run: tools/diag/run.sh bb_engine.js review/foul_mix.js -- [PA] [seed] ['{tune}'] */
(function (A) {
  var NPA = +A[0] || 20000, SEED = +A[1] || 1, IN = BB.units.IN, DEG = BB.units.DEG; if (A[2]) BB.tuneContact(JSON.parse(A[2]));
  var rng = BB.makeRng(SEED * 13 + 1), H = [], P = [], ump = BB.makeUmp(rng), G = {};
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 100; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var n = 0;
  for (var k = 0; k < NPA; k++) {
    var B = H[k % H.length], Pk = P[Math.floor(rng.u() * P.length)], env = BB.mlbEnv(rng); Pk.load = rng.u() * 0.8 * Pk.stamina;
    BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
      if (!q.bb || BB.PITCH_TYPES[q.pitch.type].kind !== 'FB' || q.result !== 'foul' || q.bb.la < 10 || q.bb.la > 70) return; n++;
      var dir = Math.abs(q.bb.spray) > 90 ? 'back' : 'side', edge = 1.45 * IN + BB.batRadius(q.swing.bat || BB.BAT_DEFAULT, BB.SWEET_IN - q.swing.dLong / IN);
      var f = Math.abs(q.swing.D) / edge, band = f < 0.5 ? '<.5' : f < 0.75 ? '.5-.75' : f < 0.9 ? '.75-.9' : '.9+';
      [dir, dir + ' ' + band].forEach(function (g) { (G[g] = G[g] || []).push([q.bb.ev, q.pitch.mph, q.swing.batAt, q.bb.dist]); });
      (G.all = G.all || []).push([q.bb.ev, q.pitch.mph, q.swing.batAt, q.bb.dist]);
    });
  }
  function ols(R) { var n2 = R.length, m = [0, 0, 0]; R.forEach(function (x) { m[0] += x[0] / n2; m[1] += x[1] / n2; m[2] += x[2] / n2; });
    var a = 0, b = 0, c = 0, d = 0, e = 0; R.forEach(function (x) { var y = x[0] - m[0], p = x[1] - m[1], q2 = x[2] - m[2]; a += p * p; b += p * q2; c += q2 * q2; d += p * y; e += q2 * y; });
    var det = a * c - b * b; return det > 0 ? +((a * e - b * d) / det).toFixed(2) : null; }
  Object.keys(G).sort().forEach(function (g) { var r = G[g].map(function (x) { return x[0] / x[1]; }).sort(function (x, y) { return x - y; });
    var d = G[g].map(function (x) { return x[3]; }).sort(function (x, y) { return x - y; });
    print(JSON.stringify({ group: g, share: +(G[g].length / n).toFixed(3), ratio: +r[Math.floor(r.length / 2)].toFixed(3), batSlope: ols(G[g]), distFt: [d[Math.floor(d.length * 0.1)], d[Math.floor(d.length * 0.5)], d[Math.floor(d.length * 0.9)]].map(Math.round) })); });
})(typeof arguments !== 'undefined' ? arguments : []);
