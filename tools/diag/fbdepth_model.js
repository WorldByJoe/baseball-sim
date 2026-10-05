// the model's fastball contact as tools/diag/fbdepth_league.py measures the league's: by contact depth about each
// hitter's mean, launch minus attack, the bat's direction (+ pull), attack angle, bat speed about his mean and the
// foul rate; straight lines in depth; the bat's direction scatter; and the direction of fouls against balls in play.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, DEG = Math.PI / 180, R = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 500); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['FF', 'SI', 'FC'].indexOf(q.pitch.type) < 0 || !q.swing || !q.swing.contact || !q.bb) return; var s = q.swing, sb = q.side || s.side, bat = s.batAt || s.batMph;
        if (bat < 50) return;
        mine.push({ foul: !q.bb.fair || q.result === 'foul', bs: bat, vm: q.bb.la - s.attackAt, aa: s.attackAt, dir: s.theta * sb / DEG, dep: s.depth / IN, la: q.bb.la }); }); }
    var md = 0, mb = 0; mine.forEach(function (r) { md += r.dep; mb += r.bs; }); md /= mine.length || 1; mb /= mine.length || 1;
    mine.forEach(function (r) { r.dd = r.dep - md; r.dbs = r.bs - mb; R.push(r); }); }
  function mean(v, k) { return v.reduce(function (a, r) { return a + r[k]; }, 0) / (v.length || 1); }
  function sd(v, k) { var m = mean(v, k); return Math.sqrt(v.reduce(function (a, r) { return a + (r[k] - m) * (r[k] - m); }, 0) / (v.length || 1)); }
  var n = R.length;
  print('MODEL fastball contact n ' + n);
  print('  by depth about his mean (in; - deep):  share  vm    dir    attack  bat    foul   |  vm of fouls / in play');
  [[-99, -12], [-12, -8], [-8, -4], [-4, 0], [0, 4], [4, 8], [8, 12], [12, 99]].forEach(function (b) { var S = R.filter(function (r) { return r.dd >= b[0] && r.dd < b[1]; }); if (S.length < 30) return;
    var f = S.filter(function (r) { return r.foul; }), g = S.filter(function (r) { return !r.foul; });
    print('   ' + (b[0] + '..' + b[1] + '        ').slice(0, 10) + (S.length / n).toFixed(3) + '  ' + mean(S, 'vm').toFixed(1) + '  ' + mean(S, 'dir').toFixed(1) + '  ' + mean(S, 'aa').toFixed(1) + '  ' + mean(S, 'dbs').toFixed(2) + '  ' + (f.length / S.length).toFixed(3) + '  |  ' + mean(f, 'vm').toFixed(1) + ' / ' + mean(g, 'vm').toFixed(1)); });
  function fit(k) { var mx = mean(R, 'dd'), my = mean(R, k), sxy = 0, sxx = 0, syy = 0; R.forEach(function (r) { sxy += (r.dd - mx) * (r[k] - my); sxx += (r.dd - mx) * (r.dd - mx); syy += (r[k] - my) * (r[k] - my); });
    var sl = sxy / sxx, ss = 0; R.forEach(function (r) { var e = r[k] - my - sl * (r.dd - mx); ss += e * e; }); return [sl, Math.sqrt(ss / n), Math.sqrt(syy / n), sxy / Math.sqrt(sxx * syy)]; }
  [['vm', 'launch minus attack'], ['dir', 'bat direction'], ['aa', 'attack angle']].forEach(function (p) { var f = fit(p[0]); print('  ' + (p[1] + '                    ').slice(0, 20) + ' per inch of depth ' + f[0].toFixed(2) + ' deg (r ' + f[3].toFixed(2) + '); sd ' + f[2].toFixed(1) + ', residual sd ' + f[1].toFixed(1)); });
  var F = R.filter(function (r) { return r.foul; }), Bp = R.filter(function (r) { return !r.foul; });
  print('  bat direction (+ pull) on contact: mean ' + mean(R, 'dir').toFixed(1) + ' sd ' + sd(R, 'dir').toFixed(1) + '; fouls ' + mean(F, 'dir').toFixed(1) + ' sd ' + sd(F, 'dir').toFixed(1) + '; in play ' + mean(Bp, 'dir').toFixed(1) + ' sd ' + sd(Bp, 'dir').toFixed(1));
  var DB = [[-90, -30], [-30, -20], [-20, -10], [-10, 0], [0, 10], [10, 20], [20, 30], [30, 90]];
  print('  share of contact by bat direction:  ' + DB.map(function (b) { return b[0] + '..' + b[1] + ' ' + (R.filter(function (r) { return r.dir >= b[0] && r.dir < b[1]; }).length / n).toFixed(3); }).join('  '));
  print('  foul rate by bat direction:         ' + DB.map(function (b) { var S = R.filter(function (r) { return r.dir >= b[0] && r.dir < b[1]; }); return b[0] + '..' + b[1] + ' ' + (S.filter(function (r) { return r.foul; }).length / Math.max(1, S.length)).toFixed(3); }).join('  '));
  print('  by depth band: bat direction of fouls / in play, and the direction sd within the band');
  [[-99, -8], [-8, -4], [-4, 0], [0, 4], [4, 8], [8, 99]].forEach(function (b) { var S = R.filter(function (r) { return r.dd >= b[0] && r.dd < b[1]; }), f = S.filter(function (r) { return r.foul; }), g = S.filter(function (r) { return !r.foul; });
    print('   ' + (b[0] + '..' + b[1] + '        ').slice(0, 10) + ' dir ' + mean(f, 'dir').toFixed(1) + ' / ' + mean(g, 'dir').toFixed(1) + '   sd within band ' + sd(S, 'dir').toFixed(1) + '   n ' + S.length); });
  var S0 = R.filter(function (r) { return r.dd >= -4 && r.dd < 4; });
  print('  vm by bat direction within the middle depth band (-4..4 in):');
  print('   ' + [[-90, -20], [-20, -10], [-10, 0], [0, 10], [10, 20], [20, 90]].map(function (b) { var S = S0.filter(function (r) { return r.dir >= b[0] && r.dir < b[1]; }); return b[0] + '..' + b[1] + ' ' + mean(S, 'vm').toFixed(1) + ' (foul ' + (S.filter(function (r) { return r.foul; }).length / Math.max(1, S.length)).toFixed(2) + ', n ' + S.length + ')'; }).join('  '));
})(arguments);
