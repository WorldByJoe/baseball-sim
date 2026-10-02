/* ============================================================================
   power_chain.js · v0.4 · 2026-10-02

   Checks the hitter's power chain (bb_engine v0.7) against the 2025 Statcast
   targets (STATCAST_TARGETS_2025.md). Part 1: draw a league of hitters and
   print the marginals of body, swing and bat speed beside the targets, the
   correlations the chain was NOT fitted to, and the tail test (the best of
   226 drawn hitters, in sd units, against the real best of 226). Part 2: play
   each of N hitters through plate appearances against a league of pitchers
   and measure what Statcast measures - squared-up rate, whiff, K%, exit
   velocity - and their correlation with bat speed - plus the league's
   pooled foul rate, launch-angle and exit-velocity spread, exit velocity by
   batted-ball type, and how often fouls are squared up. Statcast's squared-up
   per contact counts fouls; pitch by pitch in 2025 it was .435 per contact,
   .627 per ball in play and .225 per foul (STATCAST_TARGETS_2025.md).

   Run:  jsc ../bb_engine.js ../bb_names.js ../bb_field.js ../bb_game.js power_chain.js -- [N hitters] [PA each] [seed]

   CHANGED
     v0.4  squared-up uses the bat speed at contact (bb_engine v0.9); league references for
           squared-up per ball in play and per foul are the pitch-level 2025 figures
     v0.3  exit velocity by launch-angle band, pop-up spin, and contact along the
           barrel (share, squared-up, exit velocity by distance from the sweet spot)
     v0.2  squared-up also by Statcast's own proxy (80% of 1.23 x bat speed + 0.23 x
           pitch speed at the plate), per ball in play and per foul; pooled foul rate,
           launch-angle and EV spread, EV by batted-ball type
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
  var R = { bs: [], sq: [], sqS: [], sqBip: [], whiff: [], k: [], bb: [], ev: [], ev50: [], hard: [], bsd: [] };
  var L = { pitches: 0, fouls: 0, foulSq: 0, la: [], ev: [], puSpin: [], bar: {}, wk: {} };   // the league, pooled over every pitch
  function tally(key, whiff) { var w = L.wk[key] || (L.wk[key] = { n: 0, wh: 0 }); w.n++; if (whiff) w.wh++; }
  function barBin(d) { return d < -6 ? '<-6' : d < -3 ? '-6..-3' : d < 0 ? '-3..0' : d < 3 ? '0..3' : '3..6'; }
  for (i = 0; i < N; i++) {
    var B = H[i], sw = 0, wh = 0, pa = 0, ks = 0, bbs = 0, evs = [], squ = 0, squS = 0, sqBip = 0, con = 0;
    for (var p = 0; p < NPA; p++) {
      var P = lp[p % lp.length]; P.load = rng2.u() * P.stamina;
      var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: rng2.u() * 80, rec: false }, rng2);
      pa++; if (res.result === 'K') ks++; if (res.result === 'BB') bbs++;
      res.pitches.forEach(function (q) {
        L.pitches++;
        if (!q.swing) return; sw++;
        var miss = !q.swing.contact;
        tally(BB.PITCH_TYPES[q.pitch.type].kind, miss); tally(q.read.detected ? 'read' : q.read.late ? 'late' : 'fooled', miss); tally('all', miss);
        if (miss) { wh++; return; }
        if (!q.bb) return;
        con++;
        var vp = Math.sqrt(q.pitch.plate.v[0] * q.pitch.plate.v[0] + q.pitch.plate.v[1] * q.pitch.plate.v[1] + q.pitch.plate.v[2] * q.pitch.plate.v[2]) / MPH;
        var batC = q.swing.batAt || q.swing.batMph, evMax = q.swing.qSweet * vp + (1 + q.swing.qSweet) * batC;   // the most this bat and pitch could give
        if (q.bb.ev >= 0.8 * evMax) squ++;
        var sqd = q.bb.ev >= 0.8 * (1.23 * batC + 0.23 * vp);      // Statcast's own proxy for that maximum
        if (sqd) squS++;
        if (q.bb.fair) { evs.push(q.bb.ev); L.ev.push(q.bb.ev); L.la.push(q.bb.la); if (sqd) sqBip++; if (q.bb.la > 50) L.puSpin.push(q.bb.spin); }
        else { L.fouls++; if (sqd) L.foulSq++; }
        var bb = barBin(q.swing.dLong / BB.units.IN), B2 = L.bar[bb] || (L.bar[bb] = { n: 0, sq: 0, ev: 0, fair: 0 });
        B2.n++; if (sqd) B2.sq++; if (q.bb.fair) { B2.fair++; B2.ev += q.bb.ev; }
      });
    }
    if (con < 8 || evs.length < 6) continue;
    evs.sort(function (a, b) { return b - a; });
    R.bs.push(B.batSpeed); R.bsd.push(B.barrelSD); R.sq.push(squ / con); R.sqS.push(squS / con); R.sqBip.push(sqBip / evs.length); R.whiff.push(wh / sw); R.k.push(ks / pa); R.bb.push(bbs / pa);
    R.ev.push(evs.reduce(function (s, x) { return s + x; }, 0) / evs.length); R.ev50.push(evs.slice(0, Math.ceil(evs.length / 2)).reduce(function (s, x) { return s + x; }, 0) / Math.ceil(evs.length / 2));
    R.hard.push(evs.filter(function (x) { return x >= 95; }).length / evs.length);
  }
  print('');
  print(N + ' hitters x ' + NPA + ' PA each, measured as Statcast would (' + R.bs.length + ' with enough contact)');
  print('measurable                 model mean    sd   |  2025 mean    sd');
  // targets: 2025 per-player Statcast, except squared-up per ball in play (pitch-level 2025, pooled; no per-player spread)
  [['squared-up per contact', 'sq', 0.337, 0.041], ['squared-up (Statcast)', 'sqS', 0.337, 0.041], ['sq-up per BIP (Statcast)', 'sqBip', 0.627, NaN], ['whiff per swing', 'whiff', 0.238, 0.060], ['K%', 'k', 0.204, 0.057], ['BB%', 'bb', 0.089, 0.031], ['exit velo avg', 'ev', 89.7, 2.2], ['EV50 (top half)', 'ev50', 100.6, 2.5], ['hard-hit (95+) share', 'hard', 0.421, 0.078]].forEach(function (m) {
    var s = stats(R[m[1]]); print(pad(m[0], 24) + pad(f(s.mean, 3), 12) + pad(f(s.sd, 3), 6) + '  |  ' + pad(f(m[2], 3), 8) + pad(isNaN(m[3]) ? '-' : f(m[3], 3), 6)); });
  var la = stats(L.la), ev = stats(L.ev);
  print('league, pooled              model         |  MLB');
  print(pad('foul per pitch', 24) + pad(f(L.fouls / L.pitches, 3), 12) + '        |  ' + pad('0.179', 8));
  print(pad('fair LA mean', 24) + pad(f(la.mean, 1), 12) + '        |  ' + pad('12.5', 8));
  print(pad('fair LA sd', 24) + pad(f(la.sd, 1), 12) + '        |  ' + pad('~26', 8));
  print(pad('fair EV sd', 24) + pad(f(ev.sd, 1), 12) + '        |  ' + pad('~14', 8));
  print(pad('sq-up per foul (Statcast)', 24) + pad(f(L.foulSq / L.fouls, 3), 12) + '        |  ' + pad('0.225', 8));
  var bt = { GB: [], LD: [], FB: [], PU: [] };
  L.ev.forEach(function (x, j) { var a = L.la[j]; bt[a < 10 ? 'GB' : a < 25 ? 'LD' : a < 50 ? 'FB' : 'PU'].push(x); });
  print(pad('fair EV GB/LD/FB/PU', 24) + '  ' + ['GB', 'LD', 'FB', 'PU'].map(function (k) { return f(stats(bt[k]).mean, 1); }).join(' / ') + '  |  86 / 93 / 93 / - (2022)');
  var lb = [[-90, -30], [-30, -10], [-10, 10], [10, 30], [30, 50], [50, 90]], lbs = lb.map(function () { return []; });
  L.ev.forEach(function (x, j) { var a = L.la[j]; lb.forEach(function (b, k) { if (a >= b[0] && a < b[1]) lbs[k].push(x); }); });
  print(pad('fair EV by LA band', 24) + '  ' + lb.map(function (b, k) { return b[0] + '..' + b[1] + ': ' + f(stats(lbs[k]).mean, 1) + ' (' + f(100 * lbs[k].length / L.ev.length, 0) + '%)'; }).join('  '));
  L.puSpin.sort(function (a, b) { return a - b; });
  print(pad('pop-up (LA>50) spin rpm', 24) + pad(L.puSpin.length ? f(L.puSpin[Math.floor(L.puSpin.length / 2)], 0) : '-', 12) + '        |  ' + pad('~3000', 8) + '  (median; Nathan: real pop-ups a few thousand)');
  print(pad('whiff by kind FB/BR/OS', 24) + '  ' + ['FB', 'BR', 'OS'].map(function (k) { var w = L.wk[k] || { n: 1, wh: 0 }; return f(w.wh / w.n, 2) + ' (' + f(100 * w.n / L.wk.all.n, 0) + '% of swings)'; }).join('  ') + '  |  MLB ~.20 / .33 / .32');
  print(pad('whiff by read', 24) + '  ' + ['read', 'late', 'fooled'].map(function (k) { var w = L.wk[k] || { n: 1, wh: 0 }; return k + ' ' + f(w.wh / w.n, 2) + ' (' + f(100 * w.n / L.wk.all.n, 0) + '%)'; }).join('  '));
  print('contact along the barrel (in from the sweet spot, + toward the end): share of contact / squared-up (Statcast) / fair EV');
  print('  ' + ['<-6', '-6..-3', '-3..0', '0..3', '3..6'].map(function (k) { var b = L.bar[k] || { n: 0, sq: 0, ev: 0, fair: 0 }; return k + ': ' + f(b.n / Math.max(1, L.fouls + L.ev.length), 2) + ' / ' + f(b.sq / Math.max(1, b.n), 2) + ' / ' + f(b.ev / Math.max(1, b.fair), 1); }).join('   '));
  print('');
  print('bat speed against ...                     model   2025');
  [['squared-up', 'sq', -0.52], ['squared-up (Statcast proxy)', 'sqS', -0.52], ['whiff', 'whiff', 0.69], ['K%', 'k', 0.58], ['exit velo avg', 'ev', 0.71], ['EV50', 'ev50', 0.86], ['hard-hit', 'hard', 0.77], ['BB%', 'bb', 0.17]].forEach(function (m) {
    print(pad(m[0], 36) + pad(f(corr(R.bs, R[m[1]]), 2), 8) + pad(f(m[2], 2), 7)); });
})(typeof arguments !== 'undefined' ? arguments : []);
