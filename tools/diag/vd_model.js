// vd_model.js: the model's barrel height against the ball by contact depth (VD), measured as tools/diag/vd_league.py
// measures the league's: tracked contact (bat 50+ mph at contact), depth about each hitter's mean, launch minus attack
// by depth (by kind and height band), its slope and curvature with height held, the descent interaction, and pop-ups
// and fouls by depth for the slow pitches. Arguments: seed, hitters (40 PA each).
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], C = [], IN = BB.units.IN, DEG = BB.units.DEG;
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 600); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.bb || (q.swing.batAt || q.swing.batMph) < 50) return; var v = q.pitch.plate.v, foul = !q.bb.fair || q.result === 'foul';
        mine.push({ k: BB.PITCH_TYPES[q.pitch.type].kind, dep: q.swing.depth / IN, vm: q.bb.la - q.swing.attackAt, la: q.bb.la, aa: q.swing.attackAt, vaa: -Math.atan2(-v[2], -v[1]) / DEG,
                    h: (q.pitch.plate.z - Bt.zone.bot) / (Bt.zone.top - Bt.zone.bot), foul: foul, pu: !foul && q.bb.la >= 50, look: q.swing.look || 0 }); }); }
    var md = mine.reduce(function (a, x) { return a + x.dep; }, 0) / (mine.length || 1); mine.forEach(function (x) { x.dd = x.dep - md; C.push(x); }); }
  function m(v, f) { return v.length ? v.reduce(function (a, x) { return a + f(x); }, 0) / v.length : NaN; }
  function ls(X, y) { var n = X[0].length, M = [], r = [], a, b, c;
    for (a = 0; a < n; a++) { M.push([]); r.push(0); for (b = 0; b < n; b++) M[a].push(0); }
    X.forEach(function (row, j) { for (a = 0; a < n; a++) { r[a] += row[a] * y[j]; for (b = 0; b < n; b++) M[a][b] += row[a] * row[b]; } });
    for (a = 0; a < n; a++) for (b = a + 1; b < n; b++) { var f = M[b][a] / M[a][a]; for (c = a; c < n; c++) M[b][c] -= f * M[a][c]; r[b] -= f * r[a]; }
    var be = []; for (a = n - 1; a >= 0; a--) { var s = r[a]; for (b = a + 1; b < n; b++) s -= M[a][b] * be[b]; be[a] = s / M[a][a]; } return be; }
  function p(x, w, d) { var t = isNaN(x) ? '-' : ((x >= 0 && d < 0 ? '+' : '') + x.toFixed(Math.abs(d))); while (t.length < w) t = ' ' + t; return t; }
  var DB = [[-99, -4], [-4, 0], [0, 4], [4, 8], [8, 12], [12, 99]];
  print('MODEL ' + BB.version + ' tracked contact n ' + C.length);
  print('1. descent at the plate (deg): ' + ['FB', 'BR', 'OS'].map(function (k) { return k + ' ' + m(C.filter(function (x) { return x.k === k; }), function (x) { return x.vaa; }).toFixed(1); }).join('  '));
  print('2. launch minus attack by depth (in): -99..-4  -4..0  0..4  4..8  8..12  12..99');
  ['FB', 'SLOW'].forEach(function (k) { [['low', -9, 0.33], ['mid', 0.33, 0.67], ['high', 0.67, 9], ['all', -9, 9]].forEach(function (hb) {
    var v = C.filter(function (x) { return (x.k === 'FB') === (k === 'FB') && x.h >= hb[1] && x.h < hb[2]; });
    print('   ' + (k + '   ').slice(0, 4) + ' ' + (hb[0] + '   ').slice(0, 4) + ' n ' + p(v.length, 5, 0) + '  ' + DB.map(function (b) { var w = v.filter(function (x) { return x.dd >= b[0] && x.dd < b[1]; }); return w.length > 40 ? p(m(w, function (x) { return x.vm; }), 6, -1) : '     -'; }).join(' ')); }); });
  print('3. vm = a + b depth + b2 depth^2 + c height, and with the descent interaction g (per inch, per deg)');
  ['FB', 'BR', 'OS'].forEach(function (k) { var v = C.filter(function (x) { return x.k === k; }), mv = m(v, function (x) { return x.vaa; });
    var q = ls(v.map(function (x) { return [1, x.dd, x.dd * x.dd, x.h]; }), v.map(function (x) { return x.vm; }));
    var g = ls(v.map(function (x) { return [1, x.dd, x.dd * (x.vaa - mv), x.h, x.vaa - mv]; }), v.map(function (x) { return x.vm; }));
    print('   ' + k + '  quadratic: ' + p(q[1], 6, -3) + ' depth ' + p(q[2], 7, -4) + ' depth^2 ' + p(q[3], 6, -2) + ' height   | b ' + p(g[1], 6, -3) + '  g ' + p(g[2], 7, -4)); });
  print('3b. the depth slope of vm among balls in play / fouls (height held)   [league FB +0.690 / -0.869, slow +0.047 / -1.588]');
  ['FB', 'SLOW'].forEach(function (k) { var v = C.filter(function (x) { return (x.k === 'FB') === (k === 'FB'); });
    var bi = ls(v.filter(function (x) { return !x.foul; }).map(function (x) { return [1, x.dd, x.h]; }), v.filter(function (x) { return !x.foul; }).map(function (x) { return x.vm; }));
    var bf = ls(v.filter(function (x) { return x.foul; }).map(function (x) { return [1, x.dd, x.h]; }), v.filter(function (x) { return x.foul; }).map(function (x) { return x.vm; }));
    print('   ' + (k + '   ').slice(0, 4) + ' in play ' + p(bi[1], 6, -3) + '  fouls ' + p(bf[1], 6, -3)); });
  print('4. slow pitches by depth: share, foul, pop-up per contact, last-look share');
  var S = C.filter(function (x) { return x.k !== 'FB'; });
  DB.forEach(function (b) { var v = S.filter(function (x) { return x.dd >= b[0] && x.dd < b[1]; });
    print('   ' + b[0] + '..' + b[1] + '  ' + (v.length / S.length).toFixed(3) + '  ' + m(v, function (x) { return x.foul ? 1 : 0; }).toFixed(3) + '  ' + m(v, function (x) { return x.pu ? 1 : 0; }).toFixed(3) + '  ' + m(v, function (x) { return x.look ? 1 : 0; }).toFixed(3)); });
})(arguments);
