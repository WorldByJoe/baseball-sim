/* ============================================================================
   home_calib.js · v0.2 · 2026-10-13

   The home edge's size in the engine: the model's hitters against its pitchers, each plate appearance played twice from
   the same random stream, once as he is and once with his eye scatter (eyeSD), timing scatter (timingSD) and barrel
   scatter (barrelSD) scaled down by the given factors (a hitter at home reads and times the pitch a little better;
   season/home_field.py measured home hitters 1.0 point fewer strikeouts and 0.3-0.45 more walks, home runs and exit speed
   unchanged). Prints the paired differences.

   Run:  tools/diag/run.sh bb_engine.js review/home_calib.js -- [PA] [seed] [eye factor] [timing factor] [barrel factor] [aggr shift]

   CHANGED
     v0.2  a fifth argument: a shift in his aggression (aggr, added): eye and timing alone cut strikeouts but not walks
     v0.1  first build (Joe, 2026-10-13: add home field to the model)
============================================================================ */
(function (A) {
  var NPA = +A[0] || 20000, SEED = +A[1] || 1, FE = +A[2] || 1, FT = +A[3] || 1, FB = +A[4] || 1, DA = +A[5] || 0, IN = BB.units.IN;
  var r0 = BB.makeRng(SEED), env = BB.mlbEnv(r0), ump = BB.makeUmp(r0), H = [], P = [];
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(r0, {}));
  for (i = 0; i < 80; i++) P.push(BB.makePitcher(r0, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  function arm(scale) {
    var m = { pa: 0, k: 0, bb: 0, hr: 0, bip: 0, ev: 0, out: 0, osw: 0, inz: 0, isw: 0 };
    for (var k = 0; k < NPA; k++) {
      var rng = BB.makeRng(SEED * 100003 + k), B0 = H[k % H.length], Pk = P[(k * 7) % P.length], B = B0;
      if (scale) { B = Object.create(B0); B.eyeSD = B0.eyeSD * FE; B.timingSD = B0.timingSD * FT; B.barrelSD = B0.barrelSD * FB; B.aggr = B0.aggr + DA; }
      Pk.load = rng.u() * 0.8 * Pk.stamina;
      var res = BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      m.pa++; if (res.result === 'K') m.k++; else if (res.result === 'BB') m.bb++; else if (res.result === 'HR') m.hr++;
      if (res.bb) { m.bip++; m.ev += res.bb.ev; }
      res.pitches.forEach(function (q) { if (!q.decide) return; var x = Math.abs(q.pitch.plate.x), z = q.pitch.plate.z;
        var o = x > (8.5 + 1.45) * IN || z < B.zone.bot - 1.45 * IN || z > B.zone.top + 1.45 * IN;
        if (o) { m.out++; if (q.decide.swing) m.osw++; } else { m.inz++; if (q.decide.swing) m.isw++; } });
    }
    return { K: m.k / m.pa, BB: m.bb / m.pa, HR: m.hr / m.pa, ev: m.ev / m.bip, chase: m.osw / m.out, zoneSwing: m.isw / m.inz };
  }
  var a = arm(false), b = arm(true), d = {};
  Object.keys(a).forEach(function (k) { d[k] = +(b[k] - a[k]).toFixed(5); });
  print(JSON.stringify({ factors: [FE, FT, FB, DA], base: a, diff: d }));
})(typeof arguments !== 'undefined' ? arguments : []);
