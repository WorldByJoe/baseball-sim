/* ============================================================================
   hitter_value.js · v0.3 · 2026-10-03

   What makes a hitter valuable in the model, and what selecting the best of
   them does. Draws N hitters (makeBatter), lets each face K plate appearances
   against a pool of the engine's pitchers, and values him the way Statcast's
   expected wOBA does: walks .69, hit batsmen .72, every ball in play the
   league's expected wOBA on contact for its exit velocity and launch angle
   (statcast/bip.py table 6, loaded from statcast/bip_2025.js). Prints each
   trait's correlation with that value and its standardized weight in a
   multiple regression, then keeps the top share Q by value - selection on
   noisy performance, as a farm system does - and prints how the survivors'
   traits and outcomes correlate, beside the 2025 Statcast correlations among
   qualified hitters (statcast/targets_2025.json).

   Run:  jsc bb_engine.js statcast/bip_2025.js tools/hitter_value.js -- [N] [K] [Q] [seed]

   CHANGED
     v0.3  familiarity as in games: 40 x u x u pitches of this pitcher seen at the start of each PA (games: median 9 at a swing, mean 12.6; was uniform to 60-80)
     v0.2  draws from the population (BB.drawBatter) when the engine has one; the
           regression uses bat speed rather than its ingredients, and prints the
           HITTER_VALUE literal (the scouts' estimate) for bb_engine.js
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 3000, K = +A[1] || 300, Q = +A[2] || 0.25, SEED = +A[3] || 3;
  var X = BIP.xwoba, rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], H = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  function band(v, E) { for (var i = 0; i < E.length - 1; i++) if (v >= E[i] && v < E[i + 1]) return i; return -1; }
  function xw(bb) { var i = band(bb.ev, X.ev_edges), j = band(bb.la, X.la_edges); var v = i >= 0 && j >= 0 ? X.grid[i][j] : null; return v === null ? (bb.ev < 40 ? 0.05 : X.mean) : v; }
  var TR = ['batSpeed', 'heightIn', 'motorIn', 'timingSD', 'longSD', 'faceSD', 'undercut', 'attack', 'swingTilt', 'pullBias', 'coverage', 'spotIn', 'eyeSD', 'aggr', 'commit', 'fbLean', 'learn'];
  var draw = BB.drawBatter || BB.makeBatter;   // the population, before any selection
  for (i = 0; i < N; i++) {
    var B = draw(rng, {}), pa = 0, w = 0, k = 0, bb = 0, sw = 0, wh = 0, con = 0, sq = 0, evs = [];
    for (var j = 0; j < K; j++) {
      var Pi = P[(i * 7 + j) % P.length]; Pi.load = rng.u() * 0.7 * Pi.stamina;
      var res = BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      if (res.result === 'END') continue;
      pa++;
      if (res.result === 'K') k++; else if (res.result === 'BB') { bb++; w += 0.69; } else if (res.result === 'HBP') w += 0.72;
      else if (res.bb) { w += xw(res.bb); evs.push(res.bb.ev); }
      res.pitches.forEach(function (q) {
        if (!q.swing) return; sw++;
        if (!q.swing.contact) { wh++; return; }
        if (!q.bb) return; con++;
        var v = q.pitch.plate.v, vp = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) / BB.units.MPH, batC = q.swing.batAt || q.swing.batMph;
        if (q.bb.ev >= 0.8 * (1.23 * batC + 0.23 * vp)) sq++;   // squared up, by Statcast's own proxy
      });
    }
    evs.sort(function (a, b) { return b - a; });
    var h = { v: w / pa, k: k / pa, bbp: bb / pa, whiff: wh / sw, sqc: con ? sq / con : 0, ev50: evs.length ? evs.slice(0, Math.max(1, evs.length >> 1)).reduce(function (a, b) { return a + b; }, 0) / Math.max(1, evs.length >> 1) : 0 };
    TR.forEach(function (t) { h[t] = B[t]; });
    H.push(h);
  }
  function col(S, k) { return S.map(function (h) { return h[k]; }); }
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function sd(v) { var m = mean(v); return Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length); }
  function r(x, y) { var mx = mean(x), my = mean(y), a = 0, b = 0, c = 0; for (var i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) * (x[i] - mx); c += (y[i] - my) * (y[i] - my); } return a / Math.sqrt(b * c); }
  function f2(v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }
  // multiple regression of value on the standardized traits (normal equations, Gauss-Jordan)
  var Z = H.map(function (h) { return TR.map(function (t) { return h[t]; }); }), mu = TR.map(function (t, j) { return mean(Z.map(function (z) { return z[j]; })); }), sg = TR.map(function (t, j) { return sd(Z.map(function (z) { return z[j]; })) || 1; });
  var p = TR.length + 1, M = [], yv = col(H, 'v'), ym = mean(yv);
  for (var a = 0; a < p; a++) { M.push([]); for (var b = 0; b <= p; b++) M[a].push(0); }
  H.forEach(function (h, n) {
    var x = [1].concat(TR.map(function (t, j) { return (Z[n][j] - mu[j]) / sg[j]; }));
    for (var a = 0; a < p; a++) { for (var b = 0; b < p; b++) M[a][b] += x[a] * x[b]; M[a][p] += x[a] * yv[n]; }
  });
  for (a = 0; a < p; a++) { var piv = M[a][a]; for (b = a; b <= p; b++) M[a][b] /= piv; for (var c = 0; c < p; c++) if (c !== a) { var f = M[c][a]; for (b = a; b <= p; b++) M[c][b] -= f * M[a][b]; } }
  var beta = M.map(function (row) { return row[p]; }), pred = H.map(function (h, n) { var s = beta[0]; TR.forEach(function (t, j) { s += beta[j + 1] * (Z[n][j] - mu[j]) / sg[j]; }); return s; });
  var R2 = Math.pow(r(pred, yv), 2), noise = Math.sqrt(0.30 * 0.70 / K) * 0.5;
  print('hitter_value v0.1 · ' + N + ' hitters x ' + K + ' PA · seed ' + SEED + ' · expected wOBA (Statcast weights)');
  print('value: mean ' + ym.toFixed(3) + ' sd ' + sd(yv).toFixed(3) + '; the traits explain R2 ' + R2.toFixed(2) + ' of it (the rest is ' + K + '-PA luck and what the traits do together)');
  print('');
  print('1. WHAT MAKES A HITTER VALUABLE   correlation with value   weight in the regression (wOBA points per sd)');
  var order = TR.map(function (t, j) { return j; }).sort(function (x, y) { return Math.abs(beta[y + 1]) - Math.abs(beta[x + 1]); });
  order.forEach(function (j) { print('   ' + (TR[j] + '              ').slice(0, 14) + '       ' + f2(r(col(H, TR[j]), yv)) + '                  ' + (beta[j + 1] >= 0 ? '+' : '') + (1000 * beta[j + 1]).toFixed(1)); });
  // the scouts' estimate in raw trait units, for bb_engine.js HITTER_VALUE
  var raw = {}, c0 = beta[0];
  TR.forEach(function (t, j) { raw[t] = beta[j + 1] / sg[j]; c0 -= raw[t] * mu[j]; });
  print('');
  print('  var HITTER_VALUE = { c0: ' + c0.toFixed(4) + ', w: { ' + TR.map(function (t) { return t + ': ' + raw[t].toPrecision(4); }).join(', ') + ' } };');
  // selection: the top Q by value; the correlations at several strengths of selection
  var sorted = H.slice().sort(function (x, y) { return y.v - x.v; });
  print('');
  print('2a. SELECTION STRENGTH: bat speed ~ whiff / K% / squared-up, and the K% and whiff spreads, among the top share by value');
  [1, 0.5, 0.25, 0.1, 0.05].forEach(function (q) {
    var T = sorted.slice(0, Math.max(20, Math.round(q * N)));
    print('   top ' + (100 * q).toFixed(0) + '%' + '   n ' + T.length + '   whiff ' + f2(r(col(T, 'batSpeed'), col(T, 'whiff'))) + '   K% ' + f2(r(col(T, 'batSpeed'), col(T, 'k'))) + '   sq ' + f2(r(col(T, 'batSpeed'), col(T, 'sqc'))) +
          '   | K% sd ' + sd(col(T, 'k')).toFixed(3) + '  whiff sd ' + sd(col(T, 'whiff')).toFixed(3) + '  value mean ' + mean(col(T, 'v')).toFixed(3));
  });
  print('   league (qualified): whiff +.69  K% +.58  sq -.52  | K% sd .057  whiff sd .060  xwOBA mean ~.320');
  var S = sorted.slice(0, Math.round(Q * N));
  print('');
  print('2. AFTER SELECTION: the top ' + (100 * Q).toFixed(0) + '% by value (' + S.length + ' hitters)          all drawn   selected   2025 Statcast (qualified)');
  [['batSpeed', 'whiff', '+.69'], ['batSpeed', 'k', '+.58'], ['batSpeed', 'sqc', '-.52'], ['batSpeed', 'bbp', '+.17'], ['batSpeed', 'ev50', '+.86'], ['whiff', 'k', '+.85?'], ['k', 'bbp', '?']].forEach(function (q) {
    print('   ' + (q[0] + ' ~ ' + q[1] + '                    ').slice(0, 24) + '      ' + f2(r(col(H, q[0]), col(H, q[1]))) + '      ' + f2(r(col(S, q[0]), col(S, q[1]))) + '      ' + q[2]);
  });
  print('');
  print('3. HOW SELECTION MOVES THE TRAITS      all: mean (sd)        selected: mean (sd)');
  ['batSpeed', 'spotIn', 'eyeSD', 'timingSD', 'motorIn', 'k', 'whiff', 'bbp', 'v'].forEach(function (t) {
    var a = col(H, t), s2 = col(S, t);
    print('   ' + (t + '            ').slice(0, 12) + '   ' + mean(a).toFixed(3) + ' (' + sd(a).toFixed(3) + ')       ' + mean(s2).toFixed(3) + ' (' + sd(s2).toFixed(3) + ')');
  });
})(typeof arguments !== 'undefined' ? arguments : []);
