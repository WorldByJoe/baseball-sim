/* ============================================================================
   field_value.js · v0.2 · 2026-10-05

   What a fielder's traits are worth, measured by the engine itself, so the
   farm's scouts can judge a position player by his glove as well as his bat.
   A library of the engine's own balls in play (picked hitters against picked
   pitchers; home runs and caught fouls left out) is played through a defence
   of league-average fielders with one TEST fielder at the position, drawn
   from the pool. Every trial plays the same balls with the same random
   numbers, so only the test fielder differs. The run value of each outcome
   above an out (single .74, double 1.05, triple 1.32, reached on an error
   .74) is averaged per ball, and regressed on the test fielder's traits.

   Prints FIELD_VALUE for bb_engine.js: per position, runs per ball in play
   against each trait (raw units) - positive weights cost runs.

   Run:  jsc bb_engine.js bb_field.js tools/field_value.js -- [balls] [trials] [seed] [positions, comma]

   CHANGED
     v0.2  a ball on which the fielder put the batter out past first is worth an out, not the hit the scorer now credits (bb_field v1.6)
     v0.1  first build (bb_engine v2.1)
============================================================================ */
(function (A) {
  var NB = +A[0] || 1500, K = +A[1] || 250, SEED = +A[2] || 5, POS = (A[3] || '1B,2B,SS,3B,LF,CF,RF').split(',');
  var FT = ['speed', 'react', 'route', 'glove', 'armMph', 'armAcc', 'transfer'], T = BB.TRAITS, M = BB.FIELD_MEANS;
  var RV = { OUT: 0, SF: 0, FC: 0, '1B': 0.74, '2B': 1.05, '3B': 1.32, E: 0.74 };
  var rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], L = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 2 ? 'RP' : 'SP' }));
  while (L.length < NB) {
    var B = BB.makeBatter(rng, {}), Pi = P[L.length % P.length];
    var pa = BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 20, rec: false }, rng);
    if (pa.result === 'BIP' && !pa.foulCaught) L.push({ bb: pa.bb, B: B, side: BB.batterSide(B, Pi) });
  }
  function average(pos) {   // a league-average fielder at this position
    var o = { pos: pos, id: 'avg-' + pos, name: pos };
    FT.concat(['runAggr', 'jump', 'popTime', 'block']).forEach(function (k) { o[k] = T[k][0] + ((M[pos] || {})[k] || 0); });
    return o;
  }
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function play(test) {     // mean run value per ball with this defence
    var D = BBField.makeDefense(['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'P'].map(function (p) { return p === test.pos ? test : average(p); })), s = 0;
    for (var j = 0; j < L.length; j++) {
      BBField.positionDefense(D, L[j].B, L[j].side);
      var r = BBField.resolve(L[j].bb, L[j].B, [null, null, null, null], 0, D, env, BB.makeRng(1e6 + j), { side: L[j].side });
      s += r.outsMade ? 0 : (RV[r.hit] || 0);   // a batter thrown out past first keeps his hit (bb_field v1.6) but the fielder made the out: worth an out here
    }
    return s / L.length;
  }
  // ordinary least squares with an intercept
  function ols(X, y) {
    var n = X.length, p = X[0].length + 1, XtX = [], Xty = [];
    for (var a = 0; a < p; a++) { XtX.push(new Array(p).fill(0)); Xty.push(0); }
    X.forEach(function (row, i) { var r = [1].concat(row); for (var a = 0; a < p; a++) { Xty[a] += r[a] * y[i]; for (var b = 0; b < p; b++) XtX[a][b] += r[a] * r[b]; } });
    for (var c = 0; c < p; c++) { var piv = XtX[c][c]; for (var d = c; d < p; d++) XtX[c][d] /= piv; Xty[c] /= piv; for (var e = 0; e < p; e++) if (e !== c) { var f = XtX[e][c]; for (d = c; d < p; d++) XtX[e][d] -= f * XtX[c][d]; Xty[e] -= f * Xty[c]; } }
    return Xty;
  }
  print('field_value v0.1 · ' + L.length + ' balls in play x ' + K + ' test fielders per position · seed ' + SEED);
  var out = {};
  POS.forEach(function (pos) {
    var X = [], y = [], t0 = Date.now(), base = play(average(pos));
    for (var k = 0; k < K; k++) { var f = BB.drawBatter(rng, { pos: pos }); X.push(FT.map(function (t) { return f[t]; })); y.push(play(f)); }
    var b = ols(X, y), my = mean(y), ss = 0, sr = 0;
    y.forEach(function (v, i) { var pr = b[0]; FT.forEach(function (t, j) { pr += b[j + 1] * X[i][j]; }); ss += (v - my) * (v - my); sr += (v - pr) * (v - pr); });
    out[pos] = { c0: b[0], w: {} }; FT.forEach(function (t, j) { out[pos].w[t] = b[j + 1]; });
    print('  ' + (pos + '   ').slice(0, 3) + ' average fielder ' + base.toFixed(4) + ' runs per ball; test fielders ' + my.toFixed(4) + ' ± ' + Math.sqrt(ss / y.length).toFixed(4) + '; R2 ' + (1 - sr / ss).toFixed(2) +
          '; runs per ball per sd: ' + FT.map(function (t, j) { return t + ' ' + (1000 * b[j + 1] * T[t][1]).toFixed(2); }).join(', ') + ' (x 1000)   ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  });
  print('  var FIELD_VALUE = ' + JSON.stringify(out, function (k, v) { return typeof v === 'number' ? +v.toPrecision(4) : v; }) + ';');
})(typeof arguments !== 'undefined' ? arguments : []);
