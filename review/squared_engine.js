/* squared_engine.js · v0.1 · 2026-10-15: the engine's squared-up distribution on balls in play, as review/squared_real.py measures
   the league's: q = exit speed / (1.23 x bat speed at contact + 0.23 x pitch speed at the plate). For the mishit population.
   Run: tools/diag/run.sh bb_engine.js review/squared_engine.js -- [PA] [seed] ['{tune}'] */
(function (A) {
  var NPA = +A[0] || 30000, rng = BB.makeRng((+A[1] || 1) * 7919 + 5), MPH = BB.units.MPH, H = [], P = [], ump = BB.makeUmp(rng);
  if (A[2]) BB.tuneContact(JSON.parse(A[2]));
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 100; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var Q = [], gb = [], weak = 0, nb = 0, ev = [];
  for (var k = 0; k < NPA; k++) {
    var B = H[k % H.length], Pk = P[Math.floor(rng.u() * P.length)]; Pk.load = rng.u() * 0.8 * Pk.stamina;
    var r = BB.simPA(Pk, B, { env: BB.mlbEnv(rng), ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
    r.pitches.forEach(function (q) {
      if (!q.bb || !(q.result === 'in_play' || q.result === 'hr') || !q.swing) return;
      var v = q.pitch.plate.v, ps = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) / MPH, qq = q.bb.ev / (1.23 * q.swing.batAt + 0.23 * ps);
      Q.push(qq); nb++; ev.push(q.bb.ev); if (q.bb.la < 10) gb.push(qq); if (q.bb.ev < 70 && q.bb.la < -10) weak++;
    });
  }
  Q.sort(function (a, b) { return a - b; });
  var qt = {}; [0.05, 0.1, 0.25, 0.5, 0.75, 0.9].forEach(function (p) { qt[p] = +Q[Math.floor(p * Q.length)].toFixed(3); });
  var below = {}, gbb = {}; [0.4, 0.5, 0.6, 0.7, 0.8].forEach(function (c) { below[c] = +(Q.filter(function (x) { return x < c; }).length / Q.length).toFixed(4); gbb[c] = +(gb.filter(function (x) { return x < c; }).length / gb.length).toFixed(4); });
  var e105 = ev.filter(function (x) { return x >= 105; }).length / nb;
  print(JSON.stringify({ n: nb, quantiles: qt, below: below, gb_below: gbb, weakTopped: +(weak / nb).toFixed(4), ev105: +e105.toFixed(4) }));
})(typeof arguments !== 'undefined' ? arguments : []);
