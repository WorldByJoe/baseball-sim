/* ============================================================================
   pitcher_value.js · v0.3 · 2026-10-04

   What makes a pitcher valuable in the model: draws N pitchers from the
   population (BB.drawPitcher), half starters and half relievers, lets each
   face K hitters the farm picked (makeBatter), and values him by the expected
   wOBA he allows, as Statcast weights it (walks .69, hit batsmen .72, every
   ball in play the league's expected wOBA on contact for its exit velocity
   and launch angle, statcast/bip_2025.js). Prints each feature's correlation
   with that value, its standardized weight in a multiple regression, and the
   PITCHER_VALUE literal (the scouts' estimate) for bb_engine.js. Lower is
   better.

   Run:  jsc bb_engine.js statcast/bip_2025.js tools/pitcher_value.js -- [N] [K] [seed]

   CHANGED
     v0.3  the features are the engine's (BB.PITCHER_FEATURES, engine v2.8: what each pitch does against its type)
     v0.2  familiarity as in games: 40 x u x u pitches of this pitcher seen at the start of each PA (games: median 9 at a swing, mean 12.6; was uniform to 60-80)
     v0.1  first build (bb_engine v1.8)
============================================================================ */
(function (A) {
  var N = +A[0] || 1200, K = +A[1] || 300, SEED = +A[2] || 3;
  var X = BIP.xwoba, rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), H = [], B = [];
  for (var i = 0; i < 300; i++) B.push(BB.makeBatter(rng, {}));
  function band(v, E) { for (var i = 0; i < E.length - 1; i++) if (v >= E[i] && v < E[i + 1]) return i; return -1; }
  function xw(bb) { var i = band(bb.ev, X.ev_edges), j = band(bb.la, X.la_edges); var v = i >= 0 && j >= 0 ? X.grid[i][j] : null; return v === null ? (bb.ev < 40 ? 0.05 : X.mean) : v; }
  var FE = BB.PITCHER_FEATURES;
  for (i = 0; i < N; i++) {
    var P = BB.drawPitcher(rng, { role: i % 2 ? 'RP' : 'SP' }), pa = 0, w = 0, k = 0, bb = 0;
    for (var j = 0; j < K; j++) {
      P.load = rng.u() * 0.7 * P.stamina;
      var res = BB.simPA(P, B[(i * 13 + j) % B.length], { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      if (res.result === 'END') continue;
      pa++;
      if (res.result === 'K') k++; else if (res.result === 'BB') { bb++; w += 0.69; } else if (res.result === 'HBP') w += 0.72; else if (res.bb) w += xw(res.bb);
    }
    var h = { v: w / pa, k: k / pa, bbp: bb / pa }, f = BB.pitcherFeatures(P);
    FE.forEach(function (t) { h[t] = f[t]; });
    H.push(h);
  }
  function col(S, k) { return S.map(function (h) { return h[k]; }); }
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function sd(v) { var m = mean(v); return Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length); }
  function r(x, y) { var mx = mean(x), my = mean(y), a = 0, b = 0, c = 0; for (var i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) * (x[i] - mx); c += (y[i] - my) * (y[i] - my); } return a / Math.sqrt(b * c); }
  var mu = FE.map(function (t) { return mean(col(H, t)); }), sg = FE.map(function (t) { return sd(col(H, t)) || 1; });
  var p = FE.length + 1, M = [], yv = col(H, 'v');
  for (var a = 0; a < p; a++) { M.push([]); for (var b = 0; b <= p; b++) M[a].push(0); }
  H.forEach(function (h, n) {
    var x = [1].concat(FE.map(function (t, j) { return (h[t] - mu[j]) / sg[j]; }));
    for (var a = 0; a < p; a++) { for (var b = 0; b < p; b++) M[a][b] += x[a] * x[b]; M[a][p] += x[a] * yv[n]; }
  });
  for (a = 0; a < p; a++) { var piv = M[a][a]; for (b = a; b <= p; b++) M[a][b] /= piv; for (var c = 0; c < p; c++) if (c !== a) { var f2 = M[c][a]; for (b = a; b <= p; b++) M[c][b] -= f2 * M[a][b]; } }
  var beta = M.map(function (row) { return row[p]; }), pred = H.map(function (h) { var s = beta[0]; FE.forEach(function (t, j) { s += beta[j + 1] * (h[t] - mu[j]) / sg[j]; }); return s; });
  print('pitcher_value v0.3 · ' + N + ' pitchers x ' + K + ' PA · seed ' + SEED + ' · expected wOBA allowed (lower is better)');
  print('value: mean ' + mean(yv).toFixed(3) + ' sd ' + sd(yv).toFixed(3) + '; the features explain R2 ' + Math.pow(r(pred, yv), 2).toFixed(2));
  print('');
  print('   feature        correlation with value   weight (wOBA points per sd)');
  FE.map(function (t, j) { return j; }).sort(function (x, y) { return Math.abs(beta[y + 1]) - Math.abs(beta[x + 1]); }).forEach(function (j) {
    print('   ' + (FE[j] + '            ').slice(0, 12) + '        ' + (r(col(H, FE[j]), yv) >= 0 ? '+' : '') + r(col(H, FE[j]), yv).toFixed(2) + '                ' + (beta[j + 1] >= 0 ? '+' : '') + (1000 * beta[j + 1]).toFixed(1));
  });
  var raw = {}, c0 = beta[0];
  FE.forEach(function (t, j) { raw[t] = beta[j + 1] / sg[j]; c0 -= raw[t] * mu[j]; });
  print('');
  print('  var PITCHER_VALUE = { c0: ' + c0.toFixed(4) + ', w: { ' + FE.map(function (t) { return t + ': ' + raw[t].toPrecision(4); }).join(', ') + ' } };');
})(typeof arguments !== 'undefined' ? arguments : []);
