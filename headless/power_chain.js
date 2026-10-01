/* ============================================================================
   power_chain.js · v0.1 · 2026-09-30

   Checks the hitter's power chain (bb_engine v0.7) against the 2025 Statcast
   targets (STATCAST_TARGETS_2025.md). Part 1: draw a league of hitters and
   print the marginals of body, swing and bat speed beside the targets, the
   correlations the chain was NOT fitted to, and the tail test (the best of
   226 drawn hitters, in sd units, against the real best of 226). Part 2: play
   each of N hitters through plate appearances against a league of pitchers
   and measure what Statcast measures - squared-up rate, whiff, K%, exit
   velocity - and their correlation with bat speed.

   Run:  jsc ../bb_engine.js ../bb_names.js ../bb_field.js ../bb_game.js power_chain.js -- [N hitters] [PA each] [seed]

   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 500, NPA = +A[1] || 40, SEED = +A[2] || 3, rng = BB.makeRng(SEED), MPH = BB.units.MPH;
  function stats(v) { v = v.slice().sort(function (a, b) { return a - b; }); var n = v.length, m = v.reduce(function (s, x) { return s + x; }, 0) / n;
    var sd = Math.sqrt(v.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (n - 1)), sk = v.reduce(function (s, x) { return s + Math.pow((x - m) / sd, 3); }, 0) / n;
    var q = function (p) { return v[Math.min(n - 1, Math.floor(p * (n - 1)))]; };
    return { n: n, mean: m, sd: sd, p5: q(0.05), p95: q(0.95), max: v[n - 1], min: v[0], skew: sk }; }
  function corr(x, y) { var n = x.length, mx = 0, my = 0; for (var i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n;
    var sxx = 0, syy = 0, sxy = 0; for (i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); sxy += (x[i] - mx) * (y[i] - my); } return sxy / Math.sqrt(sxx * syy); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function f(x, d) { return x.toFixed(d === undefined ? 2 : d); }

  // ---- part 1: the league of hitters
  var H = []; for (var i = 0; i < 5000; i++) H.push(BB.makeBatter(rng, {}));
  var col = function (k) { return H.map(function (b) { return typeof k === 'function' ? k(b) : b[k]; }); };
  print('power chain v0.7: 5,000 hitters drawn            model mean   sd    p5   p95  skew  |  2025 Statcast mean   sd    p5   p95  skew');
  var TGT = { heightIn: [72.0, 2.35, 68, 76, 0.19], weightLb: [206.3, 19.9, 177.7, 240.1, 0.35], swingLenFt: [7.32, 0.39, 6.71, 7.94, -0.20], batSpeed: [72.0, 2.65, 67.5, 76.0, -0.34] };
  [['heightIn', 'height (in)'], ['weightLb', 'weight (lb)'], ['swingLenFt', 'swing length (ft)'], [function (b) { return b.bat.oz; }, 'bat (oz)'], ['swingPower', 'swing power (W/kg)'], ['batSpeed', 'bat speed (mph)'], ['barrelSD', 'barrel scatter (in)'], [function (b) { return b.bat.q; }, 'collision q']].forEach(function (r) {
    var s = stats(col(r[0])), t = TGT[r[0]];
    print(pad(r[1], 22) + pad(f(s.mean, 2), 11) + pad(f(s.sd, 2), 6) + pad(f(s.p5, 1), 6) + pad(f(s.p95, 1), 6) + pad(f(s.skew, 2), 6) + (t ? '  |  ' + pad(f(t[0], 2), 14) + pad(f(t[1], 2), 6) + pad(f(t[2], 1), 6) + pad(f(t[3], 1), 6) + pad(f(t[4], 2), 6) : ''));
  });
  print('');
  print('correlations (not fitted)                 model   2025');
  var CT = [['weight ~ bat speed', 'weightLb', 'batSpeed', 0.53], ['height ~ bat speed', 'heightIn', 'batSpeed', 0.45], ['swing length ~ bat speed', 'swingLenFt', 'batSpeed', 0.58], ['height ~ weight', 'heightIn', 'weightLb', 0.62], ['height ~ swing length', 'heightIn', 'swingLenFt', 0.27],
            ['weight ~ log power/kg', 'weightLb', function (b) { return Math.log(b.swingPower); }, -0.56], ['bat speed ~ barrel scatter', 'batSpeed', 'barrelSD', null]];
  CT.forEach(function (c) { print(pad(c[0], 36) + pad(f(corr(col(c[1]), col(c[2])), 2), 8) + pad(c[3] === null ? '-' : f(c[3], 2), 7)); });
  // the tail test: the best of 226, in sd units, over 200 leagues of 226
  var zs = [], maxes = [], bs = col('batSpeed'), all = stats(bs);
  for (var k = 0; k < 200; k++) { var mx = -1; for (var j = 0; j < 226; j++) mx = Math.max(mx, bs[Math.floor(rng.u() * bs.length)]); maxes.push(mx); zs.push((mx - all.mean) / all.sd); }
  var zst = stats(zs), mst = stats(maxes);
  print('');
  print('tail test, bat speed: best of 226 hitters = ' + f(mst.mean, 1) + ' mph (' + f(mst.p5, 1) + '-' + f(mst.p95, 1) + '), z = ' + f(zst.mean, 2) + '   |  2025 real best of 226: 78.8 mph (Cruz), z = +2.55; slowest 62.5 (Arraez), z = -3.57');
  var mins = []; for (k = 0; k < 200; k++) { var mn = 999; for (j = 0; j < 226; j++) mn = Math.min(mn, bs[Math.floor(rng.u() * bs.length)]); mins.push((mn - all.mean) / all.sd); }
  print('                      slowest of 226: z = ' + f(stats(mins).mean, 2) + '  (the real league has a LEFT tail of contact hitters who swing well under their power: an effort trait, not built yet)');

  // ---- part 2: what Statcast would measure, hitter by hitter
  var rng2 = BB.makeRng(SEED + 7), env = BB.mlbEnv(rng2), ump = BB.makeUmp(rng2), lp = [];
  for (i = 0; i < 24; i++) lp.push(BB.makePitcher(rng2, { role: i < 14 ? 'SP' : 'RP' }));
  var R = { bs: [], sq: [], whiff: [], k: [], bb: [], ev: [], ev50: [], hard: [], bsd: [] };
  for (i = 0; i < N; i++) {
    var B = H[i], sw = 0, wh = 0, pa = 0, ks = 0, bbs = 0, evs = [], squ = 0, con = 0;
    for (var p = 0; p < NPA; p++) {
      var P = lp[p % lp.length]; P.load = rng2.u() * P.stamina;
      var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: rng2.u() * 80, rec: false }, rng2);
      pa++; if (res.result === 'K') ks++; if (res.result === 'BB') bbs++;
      res.pitches.forEach(function (q) {
        if (!q.swing) return; sw++;
        if (!q.swing.contact) { wh++; return; }
        if (!q.bb) return;
        con++;
        var vp = Math.sqrt(q.pitch.plate.v[0] * q.pitch.plate.v[0] + q.pitch.plate.v[1] * q.pitch.plate.v[1] + q.pitch.plate.v[2] * q.pitch.plate.v[2]) / MPH;
        var evMax = q.swing.qSweet * vp + (1 + q.swing.qSweet) * q.swing.batMph;   // the most this bat and pitch could give
        if (q.bb.ev >= 0.8 * evMax) squ++;
        if (q.bb.fair) evs.push(q.bb.ev);
      });
    }
    if (con < 8 || evs.length < 6) continue;
    evs.sort(function (a, b) { return b - a; });
    R.bs.push(B.batSpeed); R.bsd.push(B.barrelSD); R.sq.push(squ / con); R.whiff.push(wh / sw); R.k.push(ks / pa); R.bb.push(bbs / pa);
    R.ev.push(evs.reduce(function (s, x) { return s + x; }, 0) / evs.length); R.ev50.push(evs.slice(0, Math.ceil(evs.length / 2)).reduce(function (s, x) { return s + x; }, 0) / Math.ceil(evs.length / 2));
    R.hard.push(evs.filter(function (x) { return x >= 95; }).length / evs.length);
  }
  print('');
  print(N + ' hitters x ' + NPA + ' PA each, measured as Statcast would (' + R.bs.length + ' with enough contact)');
  print('measurable                 model mean    sd   |  2025 mean    sd');
  [['squared-up per contact', 'sq', 0.337, 0.041], ['whiff per swing', 'whiff', 0.238, 0.060], ['K%', 'k', 0.204, 0.057], ['BB%', 'bb', 0.089, 0.031], ['exit velo avg', 'ev', 89.7, 2.2], ['EV50 (top half)', 'ev50', 100.6, 2.5], ['hard-hit (95+) share', 'hard', 0.421, 0.078]].forEach(function (m) {
    var s = stats(R[m[1]]); print(pad(m[0], 24) + pad(f(s.mean, 3), 12) + pad(f(s.sd, 3), 6) + '  |  ' + pad(f(m[2], 3), 8) + pad(f(m[3], 3), 6)); });
  print('');
  print('bat speed against ...                     model   2025');
  [['squared-up', 'sq', -0.52], ['whiff', 'whiff', 0.69], ['K%', 'k', 0.58], ['exit velo avg', 'ev', 0.71], ['EV50', 'ev50', 0.86], ['hard-hit', 'hard', 0.77], ['BB%', 'bb', 0.17]].forEach(function (m) {
    print(pad(m[0], 36) + pad(f(corr(R.bs, R[m[1]]), 2), 8) + pad(f(m[2], 2), 7)); });
})(typeof arguments !== 'undefined' ? arguments : []);
