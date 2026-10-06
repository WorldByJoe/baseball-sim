/* ============================================================================
   emulate_hitters.js · v0.1 · 2026-10-06

   The emulator behind the playoff hitters' hidden traits. Draws major-league
   hitters (the farm's picks), plays each against the league's pitchers, and
   measures them the way playoffs/measure_traits.py measured the real ones:
   zone swing and chase rates (edge distance with the ball's radius, as
   measure_traits' zone_d), whiffs per swing by pitch kind, fouls per swing,
   K%, BB% and HR%, exit speed and the hard-hit share on balls in play, the
   launch-angle mix (Statcast's bands: GB under 10 deg, LD 10-25, FB 25-50, PU
   over 50) and the pulled spray of balls in play. One JSON line a hitter:
   his traits and his measures, for review/fit_hitters.py to regress.

   Run:  tools/diag/run.sh bb_engine.js review/emulate_hitters.js -- [hitters] [PA each] [seed] > out.jsonl

   CHANGED
     v0.1  first build (the Yankees-Rays review, 2026-10-06)
============================================================================ */
(function (A) {
  var N = +A[0] || 200, NPA = +A[1] || 250, SEED = +A[2] || 1, IN = BB.units.IN;
  var rng = BB.makeRng(SEED * 7919 + 11), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [];
  for (var i = 0; i < 150; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var HALF = (8.5 + 1.45) * IN, R = 1.45 * IN;
  // inches from the zone's edge, + inside (measure_traits.zone_d)
  function zoneD(B, x, z) {
    var dx = HALF - Math.abs(x), dlo = z - (B.zone.bot - R), dhi = (B.zone.top + R) - z;
    if (dx >= 0 && dlo >= 0 && dhi >= 0) return Math.min(dx, dlo, dhi) / IN;
    return -Math.sqrt(Math.pow(Math.max(0, -dx), 2) + Math.pow(Math.max(0, -dlo, -dhi), 2)) / IN;
  }
  var KEYS = ['heightIn', 'weightLb', 'swingLenFt', 'batSpeed', 'motorIn', 'attack', 'swingTilt', 'faceSD', 'undercut', 'timingSD',
              'longSD', 'spotIn', 'eyeSD', 'aggr', 'commit', 'fbLean', 'pullBias', 'learn', 'coverage', 'armIdx'];
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {});
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
    var sw = m.sw.FB + m.sw.BR + m.sw.OS, t = {};
    KEYS.forEach(function (key) { t[key] = +(+B[key]).toFixed(5); });
    t.bats = B.bats;
    var y = { zoneSwing: m.zsw / m.zin, chase: m.osw / m.zout, whiffFB: m.wh.FB / m.sw.FB, whiffBR: m.wh.BR / m.sw.BR, whiffOS: m.wh.OS / m.sw.OS,
              foul: m.foul / sw, K: m.k / m.pa, BB: m.bb / m.pa, HR: m.hr / m.pa, ev: m.ev / m.bip, hardHit: m.hh / m.bip,
              GB: m.la.GB / m.bip, LD: m.la.LD / m.bip, FBs: m.la.FB / m.bip, PU: m.la.PU / m.bip, pull: m.pull / m.bip };
    var n = { zin: m.zin, zout: m.zout, swFB: m.sw.FB, swBR: m.sw.BR, swOS: m.sw.OS, sw: sw, pa: m.pa, bip: m.bip };
    for (var q in y) y[q] = +y[q].toFixed(5);
    print(JSON.stringify({ t: t, y: y, n: n }));
  }
})(typeof arguments !== 'undefined' ? arguments : []);
