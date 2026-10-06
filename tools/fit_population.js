/* ============================================================================
   fit_population.js · v0.8 · 2026-10-06

   Fits the hitters' POPULATION in bb_engine.js's TRAITS so that the ones the
   farm picks (makeBatter: the best of FARM_N candidates by the scouts'
   HITTER_VALUE) have the league's measured body and bat speed: height 72.0 ±
   2.35 in and weight 206.3 ± 19.9 lb (2025 Statcast hitters), swing length
   7.32 ± 0.39 ft (bat-tracking leaderboard), and bat speed 71.2 ± 2.70 mph
   (each hitter's mean over his tracked swings, hitters seeing 400+ pitches,
   pitch-level 2025), with weight ~ bat speed at the league's .53. It moves
   heightIn, weightLb (mean at 72 in, and the scatter about the height line),
   swingLenFt, swingPower (mean and log spread) and the chain's weight exponent
   (CHAIN.powerExp), and leaves every other trait's population as it stands, so the
   farm narrows the hand-set skills (eye, pitch spotting, timing...) as real
   selection would - except that each hand-set skill's population MEAN is
   moved so the picked hitters keep the mean it was calibrated to when every
   drawn hitter counted as a major leaguer (its spread stays the population's,
   so the farm narrows it); swingTilt (32.3 ± 3.8) and attack angle's spread
   (3.51 deg) are measured, so their spreads are held too. Prints the new
   TRAITS entries to paste.

   PITCHERS the same way: the picked starters and relievers have the league's
   four-seam speed (94.06 ± 2.16 / 95.05 ± 2.37 mph) and command (7.2 / 8.4 and
   8.4 / 8.2 in), arm angle 37.7 ± 12.8 deg, height 74.7 ± 2.1 in, and a spin
   talent averaging 0 (Savant's type means), by moving those TRAITS.

   Run:  jsc bb_engine.js tools/fit_population.js -- [rounds] [picks per round] [seed]

   FIELDERS (v0.2): the picks are drawn across the nine lineup positions, since
   the farm now judges a position player by his glove too (bb_engine v2.1);
   sprint speed is fitted so the picks run the league's 27.34 ± 1.35 ft/s
   (2025 Statcast hitters), and the other fielding traits keep their
   calibrated means among the picks (each net of its position's offset).

   ATHLETICISM (v0.5, engine v2.6): the loadings of swing power, sprint speed
   and arm strength on the shared athleticism (ATHLETIC), and sprint speed's on
   body mass, so the picks have the league's power/kg ~ sprint +.462, power/kg ~
   arm +.292, sprint ~ arm +.366 (2025 qualified hitters; power/kg is Savant's
   proxy, bat speed cubed over swing length per kg, computed the same way on the
   picks) and weight ~ sprint -.373. One shared trait implies loadings from any
   three pairwise correlations (l_s^2 = r_ps r_sa / r_pa, and so on); each round
   moves the population's loadings by the ratio of the league's implied loadings
   to the picks'.

   CHANGED
     v0.8  the picked fielders' route 0.921, Statcast's jump window (34.0 ft toward the ball of 36.9 covered; bb_field v1.12)
     v0.7  the picked fielders' first step 0.20 s (bb_engine v3.2: both windows of Statcast's jump; was 0.45)
     v0.6  timing and aim-under targets for engine v2.9 (timing scatter by flight time, VERT_MISS)
     v0.5  athleticism's loadings (engine v2.6)
     v0.4  pullBias's target 1 deg (engine v2.3: the bat's path square to centre, the face pulls)
============================================================================ */
(function (A) {
  var ROUNDS = +A[0] || 8, NPICK = +A[1] || 6000, SEED = +A[2] || 5, T = BB.TRAITS;
  var POS9 = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'];
  // the fielding traits' calibrated means (net of position) and the league's sprint speed among hitters (2025)
  var FSK = { react: 0.20, route: 0.921, glove: 0.982, armMph: 85, armAcc: 0.6, transfer: 0.68 }, SPEED = [27.34, 1.35];   // react 0.20 since bb_engine v3.2 (both windows of the jump; was 0.45); route 0.921 since bb_field v1.12 (the jump window's share toward the ball; was 0.90)
  function net(b, t) { return b[t] - ((BB.FIELD_MEANS[b.pos] || {})[t] || 0); }
  var TG = { h: [72.0, 2.35], w: [206.3, 19.9], L: [7.32, 0.39], v: [71.2, 2.70] };
  // athleticism: the league's correlations (2025 qualified hitters) and the loadings one shared trait implies from them
  // (the league's arm strength comes from throws by infielders and outfielders, so the pairs with arm are taken
  // over the picked men who are neither catchers nor designated hitters)
  function athCorr(S) {
    function pk(b) { return Math.pow(b.batSpeed, 3) / b.swingLenFt / (b.weightLb * 0.4536); }
    var F = S.filter(function (b) { return b.pos !== 'C' && b.pos !== 'DH'; });
    function col(X, f) { return X.map(f); }
    return { ps: r(col(S, pk), col(S, function (b) { return b.speed; })), pa: r(col(F, pk), col(F, function (b) { return b.armMph; })), sa: r(col(F, function (b) { return b.speed; }), col(F, function (b) { return b.armMph; })),
             ws: r(col(S, function (b) { return b.weightLb; }), col(S, function (b) { return b.speed; })), vs: r(col(S, function (b) { return b.batSpeed; }), col(S, function (b) { return b.speed; })), va: r(col(F, function (b) { return b.batSpeed; }), col(F, function (b) { return b.armMph; })) };
  }
  function implied(c) { if (c.ps <= 0 || c.pa <= 0 || c.sa <= 0) return null; return { p: Math.sqrt(c.ps * c.pa / c.sa), s: Math.sqrt(c.ps * c.sa / c.pa), a: Math.sqrt(c.pa * c.sa / c.ps) }; }
  var LT = implied({ ps: 0.462, pa: 0.292, sa: 0.366 });
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function sd(v) { var m = mean(v); return Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length); }
  function r(x, y) { var mx = mean(x), my = mean(y), a = 0, b = 0, c = 0; for (var i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) * (x[i] - mx); c += (y[i] - my) * (y[i] - my); } return a / Math.sqrt(b * c); }
  function sample(seed) {
    var rng = BB.makeRng(seed), S = [], P = [];
    for (var i = 0; i < NPICK; i++) { S.push(BB.makeBatter(rng, { pos: POS9[i % 9] })); if (i < NPICK / 2) P.push(BB.drawBatter(rng, { pos: POS9[i % 9] })); }
    return { S: S, P: P };
  }
  function moments(S) {
    return { h: [mean(S.map(function (b) { return b.heightIn; })), sd(S.map(function (b) { return b.heightIn; }))],
             w: [mean(S.map(function (b) { return b.weightLb; })), sd(S.map(function (b) { return b.weightLb; }))],
             L: [mean(S.map(function (b) { return b.swingLenFt; })), sd(S.map(function (b) { return b.swingLenFt; }))],
             v: [mean(S.map(function (b) { return b.batSpeed; })), sd(S.map(function (b) { return b.batSpeed; }))],
             rwv: r(S.map(function (b) { return b.weightLb; }), S.map(function (b) { return b.batSpeed; })) };
  }
  // The hitters' skills that were set by hand (or fitted at the league level) when every drawn hitter counted as a
  // major leaguer: their picked means are held where they were calibrated, the population's spread is left for the
  // farm to narrow. swingTilt is measured (32.3 ± 3.8), so its spread is held too.
  var SKILLS = ['motorIn', 'timingSD', 'longSD', 'faceSD', 'undercut', 'attack', 'pullBias', 'coverage', 'spotIn', 'eyeSD', 'aggr', 'commit', 'fbLean', 'learn', 'swingTilt'];
  // the means these skills were calibrated to at engine v1.7, when every drawn hitter counted as a major leaguer
  // (fixed here: TRAITS now holds the population, so reading the targets from it would shift them again on every refit)
  // (v0.3: motorIn x1.4, longSD x0.88, coverage x2.1, spotIn x1.09 and the fastball lean's excess x2.9, the engine v2.2 refit to the miss table)
  // (v0.6: timingSD x0.72 and undercut -0.15 in, engine v2.9's joint fit with the timing scatter following flight time and VERT_MISS)
  var SK0 = { motorIn: 0.87, timingSD: 9.72, longSD: 3.35, faceSD: 8, undercut: 0.40, attack: 9, pullBias: 1, coverage: 6.3, spotIn: 4.9,
              eyeSD: 5.0, aggr: 0, commit: 0.55, fbLean: 1.87, learn: 0.35, swingTilt: 32.3 };
  print('fit_population v0.6 · ' + ROUNDS + ' rounds x ' + NPICK + ' picks (best of ' + BB.FARM_N + ')');
  for (var k = 0; k < ROUNDS; k++) {
    var m = moments(sample(SEED + k).S);
    print('round ' + k + ': weight ~ bat speed ' + m.rwv.toFixed(2) + ' (exponent ' + BB.CHAIN.powerExp.toFixed(3) + '); picked height ' + m.h[0].toFixed(2) + ' ± ' + m.h[1].toFixed(2) + '  weight ' + m.w[0].toFixed(1) + ' ± ' + m.w[1].toFixed(1) + '  swing length ' + m.L[0].toFixed(3) + ' ± ' + m.L[1].toFixed(3) + '  bat speed ' + m.v[0].toFixed(2) + ' ± ' + m.v[1].toFixed(2));
    T.heightIn[0] += 0.8 * (TG.h[0] - m.h[0]); T.heightIn[1] *= Math.pow(TG.h[1] / m.h[1], 0.8);
    T.weightLb[0] += 0.8 * (TG.w[0] - m.w[0]); T.weightLb[1] *= Math.pow(TG.w[1] / m.w[1], 0.8);
    T.swingLenFt[0] += 0.8 * (TG.L[0] - m.L[0]); T.swingLenFt[1] *= Math.pow(TG.L[1] / m.L[1], 0.8);
    T.swingPower[0] *= Math.pow(TG.v[0] / m.v[0], 2.4); T.swingPower[1] *= Math.pow(TG.v[1] / m.v[1], 0.8);
    BB.CHAIN.powerExp += 0.8 * (0.53 - m.rwv);   // the weight exponent keeps weight ~ bat speed at the league's .53 among the picked
    var Sk = sample(SEED + 200 + k).S;
    SKILLS.forEach(function (t) {
      var v = Sk.map(function (b) { return t === 'coverage' ? b[t] / b.armIdx : b[t]; });   // coverage is drawn, then scaled by arm length
      T[t][0] += 0.8 * (SK0[t] - mean(v));
      if (t === 'swingTilt') T[t][1] *= Math.pow(3.8 / sd(v), 0.8);
      if (t === 'attack') T[t][1] *= Math.pow(3.51 / sd(v), 0.8);      // the leaderboard's attack angle spread, 2025 (its mean stays the calibrated one)
    });
    Object.keys(FSK).forEach(function (t) { T[t][0] += 0.8 * (FSK[t] - mean(Sk.map(function (b) { return net(b, t); }))); });
    var sp = Sk.map(function (b) { return b.speed; });
    T.speed[0] += 0.8 * (SPEED[0] - mean(sp)); T.speed[1] *= Math.pow(SPEED[1] / sd(sp), 0.8);
    var at = athCorr(Sk), AT = BB.ATHLETIC;
    print('   athleticism among the picked: power/kg ~ sprint ' + at.ps.toFixed(3) + ' (.462), power/kg ~ arm ' + at.pa.toFixed(3) + ' (.292), sprint ~ arm ' + at.sa.toFixed(3) + ' (.366), weight ~ sprint ' + at.ws.toFixed(3) + ' (-.373); loadings ' + AT.power.toFixed(3) + ' / ' + AT.speed.toFixed(3) + ' / ' + AT.arm.toFixed(3) + ', weight ' + AT.weightSpeed.toFixed(3));
    // what each pair has beyond the shared trait (positions, weight, the farm's choosing, the proxy's other parts) is
    // held as measured; the shared trait supplies the rest of the league's correlation
    var tp = { ps: 0.462 - (at.ps - AT.power * AT.speed), pa: 0.292 - (at.pa - AT.power * AT.arm), sa: 0.366 - (at.sa - AT.speed * AT.arm) }, Ln = implied(tp);
    if (Ln) { AT.power += 0.6 * (Math.min(0.95, Ln.p) - AT.power); AT.speed += 0.6 * (Math.min(0.95, Ln.s) - AT.speed); AT.arm += 0.6 * (Math.min(0.95, Ln.a) - AT.arm); }
    AT.weightSpeed += 0.8 * (-0.373 - at.ws);
  }
  var Sf = sample(SEED + 301).S;
  print('fielders, picked mean (net of position) against the calibrated mean: ' + Object.keys(FSK).map(function (t) { return t + ' ' + mean(Sf.map(function (b) { return net(b, t); })).toFixed(3) + '/' + FSK[t]; }).join(', ') +
        '; sprint speed ' + mean(Sf.map(function (b) { return b.speed; })).toFixed(2) + ' ± ' + sd(Sf.map(function (b) { return b.speed; })).toFixed(2) + ' (league 27.34 ± 1.35)');
  print('skills, picked mean against the calibrated mean: ' + SKILLS.map(function (t) { var v = sample(SEED + 300).S.map(function (b) { return t === 'coverage' ? b[t] / b.armIdx : b[t]; }); return t + ' ' + mean(v).toFixed(3) + '/' + SK0[t]; }).join(', '));
  // PITCHERS: the picked starters and relievers have the league's speed, command, slot and height, and Savant's mean spin
  var TP = { SP: { v: [94.06, 2.16], cx: [7.2, 0.52], cz: [8.4, 0.92] }, RP: { v: [95.05, 2.37], cx: [8.4, 0.60], cz: [8.2, 0.90] }, arm: [37.7, 12.8], h: [74.7, 2.1] };
  function pmom(seed) {
    var rng = BB.makeRng(seed), out = {};
    ['SP', 'RP'].forEach(function (rl) {
      var S = []; for (var i = 0; i < NPICK / 2; i++) S.push(BB.makePitcher(rng, { role: rl }));
      out[rl] = { S: S, v: [mean(S.map(function (p) { return p.fbVelo; })), sd(S.map(function (p) { return p.fbVelo; }))],
                  cx: [mean(S.map(function (p) { return p.cmd[0]; })), sd(S.map(function (p) { return p.cmd[0]; }))],
                  cz: [mean(S.map(function (p) { return p.cmd[1]; })), sd(S.map(function (p) { return p.cmd[1]; }))] };
    });
    var all = out.SP.S.concat(out.RP.S);
    out.arm = [mean(all.map(function (p) { return p.armAngle; })), sd(all.map(function (p) { return p.armAngle; }))];
    out.h = [mean(all.map(function (p) { return p.heightIn; })), sd(all.map(function (p) { return p.heightIn; }))];
    out.spin = mean(all.map(function (p) { return p.spinZ; }));
    return out;
  }
  for (k = 0; k < ROUNDS; k++) {
    var q = pmom(SEED + 50 + k);
    print('pitchers round ' + k + ': SP ' + q.SP.v[0].toFixed(2) + ' ± ' + q.SP.v[1].toFixed(2) + ' mph, command ' + q.SP.cx[0].toFixed(2) + ' / ' + q.SP.cz[0].toFixed(2) + '; RP ' + q.RP.v[0].toFixed(2) + ' ± ' + q.RP.v[1].toFixed(2) + ', ' + q.RP.cx[0].toFixed(2) + ' / ' + q.RP.cz[0].toFixed(2) + '; arm ' + q.arm[0].toFixed(1) + ' ± ' + q.arm[1].toFixed(1) + '; height ' + q.h[0].toFixed(2) + '; spin z ' + q.spin.toFixed(2));
    [['SP', 'fbVeloSP', 'cmdXSP', 'cmdZSP'], ['RP', 'fbVeloRP', 'cmdXRP', 'cmdZRP']].forEach(function (z) {
      var m = q[z[0]], t = TP[z[0]];
      T[z[1]][0] += 0.8 * (t.v[0] - m.v[0]); T[z[1]][1] *= Math.pow(t.v[1] / m.v[1], 0.8);
      T[z[2]][0] += 0.8 * (t.cx[0] - m.cx[0]); T[z[2]][1] *= Math.pow(t.cx[1] / m.cx[1], 0.8);
      T[z[3]][0] += 0.8 * (t.cz[0] - m.cz[0]); T[z[3]][1] *= Math.pow(t.cz[1] / m.cz[1], 0.8);
    });
    T.armAngle[0] += 0.8 * (TP.arm[0] - q.arm[0]); T.armAngle[1] *= Math.pow(TP.arm[1] / q.arm[1], 0.8);
    T.pHeightIn[0] += 0.8 * (TP.h[0] - q.h[0]); T.pHeightIn[1] *= Math.pow(TP.h[1] / q.h[1], 0.8);
    T.spinTalent[0] -= 0.8 * q.spin;
  }
  var fin = sample(SEED + 99), m2 = moments(fin.S), mp = moments(fin.P);
  print('');
  print('              population            picked by the farm       league');
  [['height (in)', 'h'], ['weight (lb)', 'w'], ['swing length (ft)', 'L'], ['bat speed (mph)', 'v']].forEach(function (q) {
    print('  ' + (q[0] + '                  ').slice(0, 18) + mp[q[1]][0].toFixed(2) + ' ± ' + mp[q[1]][1].toFixed(2) + '         ' + m2[q[1]][0].toFixed(2) + ' ± ' + m2[q[1]][1].toFixed(2) + '            ' + TG[q[1]][0] + ' ± ' + TG[q[1]][1]);
  });
  var S = fin.S;
  var atF = athCorr(S);
  print('  athleticism among the picked: power/kg ~ sprint ' + atF.ps.toFixed(2) + ' (league .46), power/kg ~ arm ' + atF.pa.toFixed(2) + ' (.29), sprint ~ arm ' + atF.sa.toFixed(2) + ' (.37), weight ~ sprint ' + atF.ws.toFixed(2) + ' (-.37); unfitted: bat speed ~ sprint ' + atF.vs.toFixed(2) + ' (.09), bat speed ~ arm ' + atF.va.toFixed(2) + ' (.18)');
  print('  correlations among the picked: weight ~ bat speed ' + r(S.map(function (b) { return b.weightLb; }), S.map(function (b) { return b.batSpeed; })).toFixed(2) + ' (league .53), height ~ bat speed ' + r(S.map(function (b) { return b.heightIn; }), S.map(function (b) { return b.batSpeed; })).toFixed(2) + ' (.45), swing length ~ bat speed ' + r(S.map(function (b) { return b.swingLenFt; }), S.map(function (b) { return b.batSpeed; })).toFixed(2) + ' (.58)');
  print('');
  function e(k, d) { return k + ': [' + T[k].map(function (x, i) { return i < 2 ? (+x.toFixed(d)) : x; }).join(', ') + ']'; }
  print('    ' + e('heightIn', 2));
  print('    ' + e('weightLb', 1));
  print('    ' + e('swingLenFt', 3));
  print('    ' + e('swingPower', 3));
  print('    CHAIN.powerExp = ' + BB.CHAIN.powerExp.toFixed(3));
  print('    ATHLETIC = { power: ' + BB.ATHLETIC.power.toFixed(3) + ', speed: ' + BB.ATHLETIC.speed.toFixed(3) + ', arm: ' + BB.ATHLETIC.arm.toFixed(3) + ', weightSpeed: ' + BB.ATHLETIC.weightSpeed.toFixed(3) + ' }');
  print('    ' + e('speed', 3) + '   ' + e('armMph', 3));
  ['fbVeloSP', 'fbVeloRP', 'cmdXSP', 'cmdZSP', 'cmdXRP', 'cmdZRP', 'armAngle', 'pHeightIn', 'spinTalent'].forEach(function (k2) { print('    ' + e(k2, 2)); });
  SKILLS.forEach(function (k2) { print('    ' + e(k2, 3)); });
  ['speed'].concat(Object.keys(FSK)).forEach(function (k2) { print('    ' + e(k2, 3)); });
})(typeof arguments !== 'undefined' ? arguments : []);
