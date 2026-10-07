// bc_model.js: the model's breaking-ball contact (BC), measured as tools/diag/bc_league.py measures the league's:
// tracked contact (bat 50+ mph at contact), depth about each hitter's own mean (+ out front); by type, by speed gap to
// the pitcher's fastball (his four-seamer, else his sinker), attack per inch of depth within kind and across types by
// height band, and contact per swing by gap. Arguments: seed, hitters (40 PA each).
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], C = [], S = [], IN = BB.units.IN;
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  function fbOf(Pi) { var f = Pi.pitches.filter(function (q) { return q.type === 'FF'; })[0] || Pi.pitches.filter(function (q) { return q.type === 'SI'; })[0]; return f ? f.velo : null; }
  P.forEach(function (Pi) { Pi.fb = fbOf(Pi); });
  for (i = 0; i < (+A[1] || 600); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing) return; var s = q.swing, gap = Pi.fb ? q.pitch.mph - Pi.fb : null, t = q.pitch.type;
        S.push({ t: t, gap: gap, contact: !!q.bb });
        if (!q.bb || (s.batAt || s.batMph) < 50) return;
        var foul = !q.bb.fair || q.result === 'foul';
        var own = Pi.pitches.filter(function (o) { return o.type === t; })[0];
        mine.push({ t: t, k: BB.PITCH_TYPES[t].kind, gap: gap, g0: own && Pi.fb ? own.velo - Pi.fb : null, ins: q.pitch.plate.x * q.side / IN, aa: s.attackAt, tilt: s.tilt, bs: s.batAt || s.batMph, la: q.bb.la, dep: s.depth / IN, h: (q.pitch.plate.z - Bt.zone.bot) / (Bt.zone.top - Bt.zone.bot), foul: foul, pu: !foul && q.bb.la >= 50 });
      }); }
    var md = 0, mb = 0; mine.forEach(function (x) { md += x.dep; mb += x.bs; }); md /= mine.length || 1; mb /= mine.length || 1;
    mine.forEach(function (x) { x.dd = x.dep - md; x.dbs = x.bs - mb; C.push(x); }); }
  function m(v, f) { return v.length ? v.reduce(function (a, x) { return a + f(x); }, 0) / v.length : NaN; }
  function sl(v, fx, fy) { if (v.length < 30) return NaN; var mx = m(v, fx), my = m(v, fy), sxy = m(v, function (x) { return (fx(x) - mx) * (fy(x) - my); }), sxx = m(v, function (x) { return (fx(x) - mx) * (fx(x) - mx); }); return sxy / sxx; }
  function p(x, w, d) { var t = isNaN(x) ? 'nan' : ((x >= 0 && d < 0 ? '+' : '') + x.toFixed(Math.abs(d))); while (t.length < w) t = ' ' + t; return t; }
  var dd = function (x) { return x.dd; }, aa = function (x) { return x.aa; };
  print('MODEL ' + BB.version + ' tracked contact, bat 50+ mph: n ' + C.length);
  print('1. by type      n     gap    depth  attack  tilt   bat   LA    foul  PU/c   attack/in within');
  function row(lab, v) { print('   ' + (lab + '   ').slice(0, 3) + '  ' + p(v.length, 6, 0) + '  ' + p(m(v.filter(function (x) { return x.gap !== null; }), function (x) { return x.gap; }), 5, -1) + '  ' + p(m(v, dd), 5, -1) + '  ' + p(m(v, aa), 5, 1) + '  ' + p(m(v, function (x) { return x.tilt; }), 5, 1) + '  ' + p(m(v, function (x) { return x.dbs; }), 5, -2) + ' ' + p(m(v, function (x) { return x.la; }), 5, 1) + '  ' + m(v, function (x) { return x.foul ? 1 : 0; }).toFixed(3) + '  ' + m(v, function (x) { return x.pu ? 1 : 0; }).toFixed(3) + '  ' + sl(v, dd, aa).toFixed(2)); }
  ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'KC', 'CH', 'FS'].forEach(function (t) { row(t, C.filter(function (x) { return x.t === t; })); });
  ['FB', 'BR', 'OS'].forEach(function (k) { row(k, C.filter(function (x) { return x.k === k; })); });
  print('2. depth by speed gap (mph to his fastball):  all contact  |  non-fastballs  (n, depth, attack, bat)');
  [[2, 9], [-1, 2], [-3, -1], [-5, -3], [-7, -5], [-9, -7], [-11, -9], [-13, -11], [-15, -13], [-18, -15], [-30, -18]].forEach(function (b) {
    var v = C.filter(function (x) { return x.gap !== null && x.gap >= b[0] && x.gap < b[1]; }), w = v.filter(function (x) { return x.k !== 'FB'; });
    print('   ' + p(b[0], 4, -0) + '..' + p(b[1], 4, -0) + '  ' + p(v.length, 6, 0) + ' ' + p(m(v, dd), 5, -1) + ' ' + p(m(v, aa), 5, 1) + ' ' + p(m(v, function (x) { return x.dbs; }), 5, -2) + '  |  ' + p(w.length, 6, 0) + ' ' + p(m(w, dd), 5, -1) + ' ' + p(m(w, aa), 5, 1) + ' ' + p(m(w, function (x) { return x.dbs; }), 5, -2)); });
  print('3. attack per inch of depth, by height band: within FB / within BR / within OS / across the 9 types\' means (in the band)');
  [[-9, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 9], [-9, 9]].forEach(function (b) {
    var v = C.filter(function (x) { return x.h >= b[0] && x.h < b[1]; });
    var pts = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'KC', 'CH', 'FS'].map(function (t) { var w = v.filter(function (x) { return x.t === t; }); return { dd: m(w, dd), aa: m(w, aa) }; }).filter(function (q) { return !isNaN(q.dd); });
    print('   h ' + p(b[0], 5, 2) + '..' + p(b[1], 5, 2) + '  n ' + p(v.length, 6, 0) + '   ' + ['FB', 'BR', 'OS'].map(function (k) { return sl(v.filter(function (x) { return x.k === k; }), dd, aa).toFixed(2); }).join('  ') + '   across ' + sl(pts, dd, aa).toFixed(2)); });
  // joint least squares: attack on depth, height, breaking, off-speed (normal equations, 5 x 5)
  var X = C.map(function (x) { return [1, x.dd, x.h, x.k === 'BR' ? 1 : 0, x.k === 'OS' ? 1 : 0]; }), y = C.map(aa), n = 5, M = [], r = [];
  for (var a = 0; a < n; a++) { M.push([]); r.push(0); for (var b = 0; b < n; b++) M[a].push(0); }
  X.forEach(function (row, j) { for (var a = 0; a < n; a++) { r[a] += row[a] * y[j]; for (var b = 0; b < n; b++) M[a][b] += row[a] * row[b]; } });
  for (a = 0; a < n; a++) { for (b = a + 1; b < n; b++) { var f = M[b][a] / M[a][a]; for (var c = a; c < n; c++) M[b][c] -= f * M[a][c]; r[b] -= f * r[a]; } }
  var beta = []; for (a = n - 1; a >= 0; a--) { var s = r[a]; for (b = a + 1; b < n; b++) s -= M[a][b] * beta[b]; beta[a] = s / M[a][a]; }
  print('   joint: attack = ' + beta[0].toFixed(1) + ' + ' + beta[1].toFixed(2) + ' depth + ' + beta[2].toFixed(1) + ' height ' + p(beta[3], 4, -1) + ' breaking ' + p(beta[4], 4, -1) + ' off-speed');
  function ls(X, y) { var n = X[0].length, M = [], r = [], a, b, c;
    for (a = 0; a < n; a++) { M.push([]); r.push(0); for (b = 0; b < n; b++) M[a].push(0); }
    X.forEach(function (row, j) { for (a = 0; a < n; a++) { r[a] += row[a] * y[j]; for (b = 0; b < n; b++) M[a][b] += row[a] * row[b]; } });
    for (a = 0; a < n; a++) for (b = a + 1; b < n; b++) { var f = M[b][a] / M[a][a]; for (c = a; c < n; c++) M[b][c] -= f * M[a][c]; r[b] -= f * r[a]; }
    var be = []; for (a = n - 1; a >= 0; a--) { var s = r[a]; for (b = a + 1; b < n; b++) s -= M[a][b] * be[b]; be[a] = s / M[a][a]; } return be; }
  var TY = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS'], W = C.filter(function (x) { return x.g0 !== null && TY.indexOf(x.t) >= 0; });
  print('5. depth = a + b_across x usual gap + b_within x (this pitch - usual) + c x height + d x inside, by type   (as bc_within.py)');
  TY.forEach(function (t) { var v = W.filter(function (x) { return x.t === t; }); if (v.length < 200) return;
    var be = ls(v.map(function (x) { return [1, x.g0, x.gap - x.g0, x.h, x.ins]; }), v.map(dd));
    print('   ' + t + ' ' + p(v.length, 6, 0) + '   usual gap ' + p(m(v, function (x) { return x.g0; }), 5, -1) + '   ' + [be[1], be[2], be[3], be[4]].map(function (q) { return p(q, 6, -2); }).join('  ')); });
  var be = ls(W.map(function (x) { return [x.g0, x.gap - x.g0, x.h, x.ins].concat(TY.map(function (t) { return x.t === t ? 1 : 0; })); }), W.map(dd));
  print('   all types: usual gap ' + p(be[0], 5, -2) + '  within ' + p(be[1], 5, -2) + '  height ' + p(be[2], 5, -2) + '  inside ' + p(be[3], 6, -3) + '   type offsets beyond the gap slope: ' + TY.map(function (t, i) { return t + ' ' + p(be[4 + i] - be[4], 4, -1); }).join(' '));
  print('4. swings by speed gap: contact per swing, tracked contact\'s depth sd');
  [[-1, 9], [-5, -1], [-9, -5], [-13, -9], [-30, -13]].forEach(function (b) {
    var v = S.filter(function (x) { return x.gap !== null && x.gap >= b[0] && x.gap < b[1]; }), c = C.filter(function (x) { return x.gap !== null && x.gap >= b[0] && x.gap < b[1]; });
    var md = m(c, dd), sd = Math.sqrt(m(c, function (x) { return (x.dd - md) * (x.dd - md); }));
    print('   ' + p(b[0], 4, -0) + '..' + p(b[1], 4, -0) + '  swings ' + p(v.length, 6, 0) + '  contact ' + m(v, function (x) { return x.contact ? 1 : 0; }).toFixed(3) + '  depth sd ' + sd.toFixed(1)); });
})(arguments);
