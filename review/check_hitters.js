/* ============================================================================
   check_hitters.js · v0.2 · 2026-10-06

   The posterior predictive check of review/fit_hitters.py, and the simulator
   its refinement steps call: every fitted hitter (the refined mean when there
   is one, else the posterior mean) plays the league's pitchers and is
   measured exactly as review/emulate_hitters.js measures (the same code).

   Run:  tools/diag/run.sh bb_engine.js review/players.js review/check_hitters.js -- [PA each] [seed] [part] [parts]

   CHANGED
     v0.2  the emulator's whole measure set, so fit_hitters.py can refine on it
     v0.1  first build (K, BB, HR, chase, whiff, exit speed)
============================================================================ */
(function (A) {
  var NPA = +A[0] || 1000, SEED = +A[1] || 3, PART = +A[2] || 0, PARTS = +A[3] || 1, IN = BB.units.IN;
  var D = REVIEW.load(), rng = BB.makeRng(SEED * 31 + PART), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [];
  for (var i = 0; i < 150; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var ids = Object.keys(D.fits).sort();
  var HALF = (8.5 + 1.45) * IN, R = 1.45 * IN;
  function zoneD(B, x, z) {
    var dx = HALF - Math.abs(x), dlo = z - (B.zone.bot - R), dhi = (B.zone.top + R) - z;
    if (dx >= 0 && dlo >= 0 && dhi >= 0) return Math.min(dx, dlo, dhi) / IN;
    return -Math.sqrt(Math.pow(Math.max(0, -dx), 2) + Math.pow(Math.max(0, -dlo, -dhi), 2)) / IN;
  }
  ids.forEach(function (id, n) {
    if (n % PARTS !== PART) return;
    var B = REVIEW.hitter(D.fits[id], rng, null);
    var m = { zin: 0, zsw: 0, zout: 0, osw: 0, sw: { FB: 0, BR: 0, OS: 0 }, wh: { FB: 0, BR: 0, OS: 0 }, foul: 0, pa: 0, k: 0, bb: 0, hr: 0,
              bip: 0, ev: 0, hh: 0, la: { GB: 0, LD: 0, FB: 0, PU: 0 }, pull: 0 };
    for (var k = 0; k < NPA; k++) {
      var Pi = P[Math.floor(rng.u() * P.length)]; Pi.load = rng.u() * Pi.stamina;
      var sb = BB.batterSide(B, Pi);
      var res = BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      m.pa++; if (res.result === 'K') m.k++; else if (res.result === 'BB') m.bb++; else if (res.result === 'HR') m.hr++;
      res.pitches.forEach(function (q) {
        if (!q.decide) return;
        var d = zoneD(B, q.pitch.plate.x, q.pitch.plate.z), kind = BB.PITCH_TYPES[q.pitch.type].kind, s = !!q.decide.swing;
        if (d >= 0) { m.zin++; if (s) m.zsw++; } else { m.zout++; if (s) m.osw++; }
        if (!s) return;
        m.sw[kind]++;
        if (!(q.swing && q.swing.contact)) m.wh[kind]++;
        if (q.result === 'foul') m.foul++;
        if (q.bb && (q.result === 'in_play' || q.result === 'hr')) {
          var bb = q.bb; m.bip++; m.ev += bb.ev; if (bb.ev >= 95) m.hh++;
          m.la[bb.la < 10 ? 'GB' : bb.la < 25 ? 'LD' : bb.la < 50 ? 'FB' : 'PU']++;
          m.pull += bb.spray * sb;
        }
      });
    }
    var sw = m.sw.FB + m.sw.BR + m.sw.OS;
    var y = { zoneSwing: m.zsw / m.zin, chase: m.osw / m.zout, whiffFB: m.wh.FB / m.sw.FB, whiffBR: m.wh.BR / m.sw.BR, whiffOS: m.wh.OS / m.sw.OS,
              foul: m.foul / sw, K: m.k / m.pa, BB: m.bb / m.pa, HR: m.hr / m.pa, ev: m.ev / m.bip, hardHit: m.hh / m.bip,
              GB: m.la.GB / m.bip, LD: m.la.LD / m.bip, FBs: m.la.FB / m.bip, PU: m.la.PU / m.bip, pull: m.pull / m.bip };
    for (var q in y) y[q] = +y[q].toFixed(5);
    print(JSON.stringify({ id: id, name: B.name, y: y }));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
