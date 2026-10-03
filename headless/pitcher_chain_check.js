/* ============================================================================
   pitcher_chain_check.js · v0.1 · 2026-10-02

   The pitcher's chain (bb_engine v1.6) against the league: the model's
   pitchers' arm slots, release points, speed and spin, the correlations among
   them (statcast/pitcher_chain.py and the 2025 leaderboards), which pitches
   they carry by arm slot, and - the unfitted test - whether harder and
   higher-spin throwers strike out more batters and get more whiffs, as the
   league's do (four-seam speed ~ K% r .52, ~ whiff% .56; spin ~ whiff .36;
   arm angle ~ BB% .20; release height ~ K% -.22, among qualified pitchers).

   Run:  jsc bb_engine.js headless/pitcher_chain_check.js -- [pitchers] [PA each] [seed]

   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var NP = +A[0] || 240, NPA = +A[1] || 250, SEED = +A[2] || 3, U = BB.units, IN = U.IN, env = BB.makeEnv({});
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function sd(v) { var m = mean(v); return Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length); }
  function r(x, y) { var mx = mean(x), my = mean(y), sxy = 0, sxx = 0, syy = 0; for (var i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); } return sxy / Math.sqrt(sxx * syy); }
  function f2(v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }
  var rng = BB.makeRng(SEED), P = [];
  for (var i = 0; i < 3000; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  // the shape of his four-seamer: induced break of his usual pitch from his release
  function move(Pp, q) {
    var rel = BB.releasePoint(Pp), sp = q.velo * U.MPH, a = BB.aim(rel, sp, q.rpm, q.tilt, q.eff, Pp.armSide, [0, 0.75], env, null, q.seam);
    var dir = BB.dirOf(a.yaw, a.pit), v0 = [dir[0] * sp, dir[1] * sp, dir[2] * sp];
    var fl = BB.flyPitch(rel, v0, BB.spinVector(dir, q.rpm, q.tilt, q.eff, Pp.armSide), env, false, q.seam, Pp.armSide), none = BB.flyPitch(rel, v0, [0, 0, 0], env, false);
    return [(fl.z - none.z) / IN, (fl.x - none.x) / IN * Pp.armSide];
  }
  var ff = P.filter(function (Pp) { return Pp.pitches.some(function (q) { return q.type === 'FF'; }); });
  var arm = ff.map(function (Pp) { return Pp.armAngle; }), ivb = [], hb = [], velo = [], spin = [];
  ff.forEach(function (Pp) { var q = Pp.pitches.filter(function (x) { return x.type === 'FF'; })[0], m = move(Pp, q); ivb.push(m[0]); hb.push(m[1]); velo.push(q.velo); spin.push(q.rpm); });
  var all = P, relH = all.map(function (Pp) { return Pp.rel.ht; }), relS = all.map(function (Pp) { return Pp.rel.side; }), ext = all.map(function (Pp) { return Pp.rel.ext; }), hts = all.map(function (Pp) { return Pp.heightIn; }), arms = all.map(function (Pp) { return Pp.armAngle; });
  print('pitcher_chain_check v0.1 · seed ' + SEED + ' · ' + P.length + ' pitchers drawn');
  print('');
  print('1. DISTRIBUTIONS                  model              league (2025)');
  print('   arm angle (deg)              ' + mean(arms).toFixed(1) + ' +- ' + sd(arms).toFixed(1) + '        37.7 +- 12.8');
  print('   release height (ft)          ' + mean(relH).toFixed(2) + ' +- ' + sd(relH).toFixed(2) + '       5.78 +- 0.44');
  print('   release side, arm side (ft)  ' + mean(relS).toFixed(2) + ' +- ' + sd(relS).toFixed(2) + '       1.9 (from the arm-angle fit)');
  print('   extension (ft)               ' + mean(ext).toFixed(2) + ' +- ' + sd(ext).toFixed(2) + '       6.41');
  print('   four-seam IVB / HB (in)      ' + mean(ivb).toFixed(1) + ' +- ' + sd(ivb).toFixed(1) + ' / ' + mean(hb).toFixed(1) + ' +- ' + sd(hb).toFixed(1) + '   15.4 +- 2.6 / 7.8 +- 3.4');
  print('   four-seam speed (mph)        ' + mean(velo).toFixed(2) + ' +- ' + sd(velo).toFixed(2) + '      94.25 +- 2.42');
  print('   four-seam spin (rpm)         ' + mean(spin).toFixed(0) + ' +- ' + sd(spin).toFixed(0) + '       2308 +- 142');
  print('');
  print('2. CORRELATIONS                   model    league');
  print('   four-seam IVB ~ arm angle    ' + f2(r(arm, ivb)) + '    +.73 (pitch level) / +.71 (leaderboard)');
  print('   release height ~ arm angle   ' + f2(r(arms, relH)) + '    +.82 / +.76');
  print('   release height ~ height      ' + f2(r(hts, relH)) + '    +.20');
  print('   extension ~ height           ' + f2(r(hts, ext)) + '    +.33');
  print('   four-seam spin ~ speed       ' + f2(r(velo, spin)) + '    +.31 / +.27');
  var sl = P.filter(function (Pp) { return Pp.pitches.some(function (q) { return q.type === 'FF'; }) && Pp.pitches.some(function (q) { return q.type === 'SL'; }); });
  var a1 = sl.map(function (Pp) { var q = Pp.pitches.filter(function (x) { return x.type === 'FF'; })[0]; return q.rpm / q.velo; }), a2 = sl.map(function (Pp) { var q = Pp.pitches.filter(function (x) { return x.type === 'SL'; })[0]; return q.rpm / q.velo; });
  print('   spin per mph, FF ~ SL        ' + f2(r(a1, a2)) + '    +.36');
  print('');
  print('3. WHICH PITCHES BY ARM SLOT: share of pitchers carrying each type   | league');
  var LG = { low: [0.81, 0.75, 0.31, 0.49, 0.44, 0.36, 0.49, 0.09], middle: [0.84, 0.56, 0.36, 0.63, 0.30, 0.38, 0.49, 0.19], high: [0.91, 0.41, 0.32, 0.67, 0.17, 0.53, 0.43, 0.15] }, TY = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS'];
  [['low', -99, 33], ['middle', 33, 43], ['high', 43, 99]].forEach(function (b) {
    var q = P.filter(function (Pp) { return Pp.armAngle >= b[1] && Pp.armAngle < b[2]; });
    print('   ' + (b[0] + '      ').slice(0, 7) + TY.map(function (t, j) { return t + ' ' + (q.filter(function (Pp) { return Pp.pitches.some(function (x) { return x.type === t; }); }).length / q.length).toFixed(2); }).join('  ') + '   | ' + LG[b[0]].map(function (v) { return v.toFixed(2); }).join(' '));
  });
  // 4. the unfitted test: does stuff turn into strikeouts?
  var env2 = BB.mlbEnv(rng), ump = BB.makeUmp(rng), rows = [];
  for (i = 0; i < NP; i++) {
    var Pp = P[i], k = 0, bb = 0, pa = 0, sw = 0, wh = 0;
    for (var j = 0; j < NPA; j++) {
      var B = BB.makeBatter(rng, {}); Pp.load = rng.u() * 0.7 * Pp.stamina;
      var res = BB.simPA(Pp, B, { env: env2, ump: ump, framing: 0, seen: rng.u() * 40, rec: false }, rng);
      pa++; if (res.result === 'K') k++; if (res.result === 'BB') bb++;
      res.pitches.forEach(function (q) { if (q.swing) { sw++; if (!q.swing.contact) wh++; } });
    }
    var f = Pp.pitches.filter(function (x) { return x.type === 'FF' || x.type === 'SI'; })[0] || Pp.pitches[0];
    rows.push({ velo: f.velo, spin: f.rpm, arm: Pp.armAngle, relH: Pp.rel.ht, k: k / pa, bb: bb / pa, whiff: wh / sw, cmd: Pp.command });
  }
  function col(k) { return rows.map(function (q) { return q[k]; }); }
  print('');
  print('4. DOES STUFF TURN INTO OUTCOMES? ' + NP + ' pitchers x ' + NPA + ' PA (sampling alone gives K% sd ~' + (Math.sqrt(0.22 * 0.78 / NPA) * 100).toFixed(1) + ' points)   | league (qualified pitchers)');
  print('   K% ~ fastball speed          ' + f2(r(col('velo'), col('k'))) + '    +.52');
  print('   whiff ~ fastball speed       ' + f2(r(col('velo'), col('whiff'))) + '    +.56');
  print('   whiff ~ fastball spin        ' + f2(r(col('spin'), col('whiff'))) + '    +.36');
  print('   BB% ~ arm angle              ' + f2(r(col('arm'), col('bb'))) + '    +.20');
  print('   K% ~ release height          ' + f2(r(col('relH'), col('k'))) + '    -.22');
  print('   BB% ~ command (scatter)      ' + f2(r(col('cmd'), col('bb'))) + '    (not measured)');
  print('   K% spread between pitchers   ' + (sd(col('k')) * 100).toFixed(1) + ' points   | league 4.5 (qualified)');
})(typeof arguments !== 'undefined' ? arguments : []);
