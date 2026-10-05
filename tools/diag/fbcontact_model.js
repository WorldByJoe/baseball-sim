// the model's fastball swings, measured as tools/diag/fbcontact_league.py measures the league's: for contact, the
// bat's speed against the hitter's mean, contact depth about his mean, launch minus attack ("vm"), exit speed and
// squared-up by foul / in play and by vm band; the vm distribution; EV by launch band; and the parts of the barrel's
// vertical offset D (the misread, the aim and scatter, the timing term, the height pull) on contact and on whiffs.
// Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, DEG = Math.PI / 180, R = [], W = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 500); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['FF', 'SI', 'FC'].indexOf(q.pitch.type) < 0 || !q.swing) return; var s = q.swing, sb = q.side || s.side, bat = s.batAt || s.batMph;
        var rec = { bs: bat, dep: s.depth / IN, D: s.D / IN, e: s.e * 1000, dir: s.theta * sb / DEG, why: s.why, strikes: +q.count.split('-')[1], mph: q.pitch.mph, read: q.read, m: q.read.err[1] / IN };
        if (s.contact && q.bb) { rec.c = true; rec.foul = !q.bb.fair || q.result === 'foul'; rec.ev = q.bb.ev; rec.la = q.bb.la; rec.vm = q.bb.la - s.attackAt; rec.spray = q.bb.spray * sb; rec.sq = q.bb.ev >= 0.8 * (1.23 * bat + 0.23 * q.pitch.mph); }
        else if (s.contact) { rec.c = true; rec.foul = true; rec.tip = true; rec.ev = 0; rec.la = 0; rec.vm = 0; rec.spray = 0; }
        mine.push(rec); }); }
    var mb = 0, md = 0, nd = 0; mine.forEach(function (r) { mb += r.bs; if (r.c && !r.tip) { md += r.dep; nd++; } }); mb /= mine.length || 1; md /= nd || 1;
    mine.forEach(function (r) { r.dbs = r.bs - mb; r.ddep = r.dep - md; (r.c ? R : W).push(r); }); }
  function mean(v, k) { return v.reduce(function (a, r) { return a + r[k]; }, 0) / (v.length || 1); }
  function sd(v, k) { var m = mean(v, k); return Math.sqrt(v.reduce(function (a, r) { return a + (r[k] - m) * (r[k] - m); }, 0) / (v.length || 1)); }
  var n = R.length, F = R.filter(function (r) { return r.foul; }), Bp = R.filter(function (r) { return !r.foul; }), T = R.filter(function (r) { return !r.tip; });
  print('MODEL fastball swings: ' + (R.length + W.length) + '; contact ' + n + ' (tips ' + R.filter(function (r) { return r.tip; }).length + '), foul ' + (F.length / n).toFixed(3) + ', whiff per swing ' + (W.length / (R.length + W.length)).toFixed(3));
  print('                       n     bat-mean   depth-mean    vm      EV    squared');
  [['fouls', F.filter(function (r) { return !r.tip; })], ['balls in play', Bp]].forEach(function (p) { var V = p[1];
    print('  ' + (p[0] + '                  ').slice(0, 18) + ' ' + V.length + '   ' + mean(V, 'dbs').toFixed(2) + '      ' + mean(V, 'ddep').toFixed(2) + '    ' + mean(V, 'vm').toFixed(1) + '  ' + mean(V, 'ev').toFixed(1) + '   ' + (V.filter(function (r) { return r.sq; }).length / V.length).toFixed(3)); });
  print('  by vm band: share, foul rate, bat speed about his mean (foul / in play), EV (foul / in play), squared-up (foul / in play)');
  [[-90, -40], [-40, -25], [-25, -15], [-15, -5], [-5, 5], [5, 15], [15, 25], [25, 40], [40, 60], [60, 99]].forEach(function (b) {
    var S = T.filter(function (r) { return r.vm >= b[0] && r.vm < b[1]; }), f = S.filter(function (r) { return r.foul; }), g = S.filter(function (r) { return !r.foul; }); if (!f.length || !g.length) return;
    print('   ' + (b[0] + '..' + b[1] + '        ').slice(0, 10) + (S.length / T.length).toFixed(3) + '  foul ' + (f.length / S.length).toFixed(3) + '   bat ' + mean(f, 'dbs').toFixed(2) + ' / ' + mean(g, 'dbs').toFixed(2) + '   EV ' + mean(f, 'ev').toFixed(1) + ' / ' + mean(g, 'ev').toFixed(1) + '   sq ' + (f.filter(function (r) { return r.sq; }).length / f.length).toFixed(3) + ' / ' + (g.filter(function (r) { return r.sq; }).length / g.length).toFixed(3) + '   D ' + mean(S, 'D').toFixed(2) + '  dir ' + mean(f, 'dir').toFixed(1) + ' / ' + mean(g, 'dir').toFixed(1) + '  |spray|>45 ' + (f.filter(function (r) { return Math.abs(r.spray) > 45; }).length / f.length).toFixed(2)); });
  var vs = T.map(function (r) { return r.vm; }).sort(function (a, b) { return a - b; });
  print('  vm distribution of contact: mean ' + mean(T, 'vm').toFixed(1) + ' sd ' + sd(T, 'vm').toFixed(1) + '; p10 ' + vs[Math.floor(.1 * vs.length)].toFixed(0) + ' p25 ' + vs[Math.floor(.25 * vs.length)].toFixed(0) + ' p50 ' + vs[Math.floor(.5 * vs.length)].toFixed(0) + ' p75 ' + vs[Math.floor(.75 * vs.length)].toFixed(0) + ' p90 ' + vs[Math.floor(.9 * vs.length)].toFixed(0));
  print('  bat speed about his mean: whiffs ' + mean(W, 'dbs').toFixed(2) + ', fouls ' + mean(F, 'dbs').toFixed(2) + ', in play ' + mean(Bp, 'dbs').toFixed(2));
  print('  EV by launch band, fouls / balls in play (mean EV, n):');
  [[-90, -10], [-10, 10], [10, 30], [30, 50], [50, 70], [70, 99]].forEach(function (b) { var f = F.filter(function (r) { return !r.tip && r.la >= b[0] && r.la < b[1]; }), g = Bp.filter(function (r) { return r.la >= b[0] && r.la < b[1]; });
    print('   LA ' + (b[0] + '..' + b[1] + '       ').slice(0, 10) + ' foul EV ' + mean(f, 'ev').toFixed(1) + ' (n ' + f.length + ', bat ' + mean(f, 'dbs').toFixed(2) + ')   in play EV ' + mean(g, 'ev').toFixed(1) + ' (n ' + g.length + ', bat ' + mean(g, 'dbs').toFixed(2) + ')'); });
  print('  two-strike share: fouls ' + (F.filter(function (r) { return r.strikes === 2; }).length / F.length).toFixed(3) + ', in play ' + (Bp.filter(function (r) { return r.strikes === 2; }).length / Bp.length).toFixed(3) + '; foul rate by strikes 0/1/2: ' + [0, 1, 2].map(function (s) { var S = R.filter(function (r) { return r.strikes === s; }); return (S.filter(function (r) { return r.foul; }).length / S.length).toFixed(3); }).join(' '));
  print('  by vm band: bat direction (+ pull) and depth about his mean, fouls / in play');
  [[-90, -15], [-15, 5], [5, 25], [25, 40], [40, 99]].forEach(function (b) { var f = F.filter(function (r) { return !r.tip && r.vm >= b[0] && r.vm < b[1]; }), g = Bp.filter(function (r) { return r.vm >= b[0] && r.vm < b[1]; });
    print('   ' + (b[0] + '..' + b[1] + '        ').slice(0, 10) + ' dir ' + mean(f, 'dir').toFixed(1) + ' / ' + mean(g, 'dir').toFixed(1) + '   depth ' + mean(f, 'ddep').toFixed(1) + ' / ' + mean(g, 'ddep').toFixed(1) + '   n ' + f.length + ' / ' + g.length); });
  // the barrel's vertical offset: D on contact and the misread part of it; whiffs under and over
  var Ds = T.map(function (r) { return r.D; }).sort(function (a, b) { return a - b; });
  print('  D on contact (in, + ball above the barrel): mean ' + mean(T, 'D').toFixed(2) + ' sd ' + sd(T, 'D').toFixed(2) + '; p10 ' + Ds[Math.floor(.1 * Ds.length)].toFixed(2) + ' p25 ' + Ds[Math.floor(.25 * Ds.length)].toFixed(2) + ' p50 ' + Ds[Math.floor(.5 * Ds.length)].toFixed(2) + ' p75 ' + Ds[Math.floor(.75 * Ds.length)].toFixed(2) + ' p90 ' + Ds[Math.floor(.9 * Ds.length)].toFixed(2) + ';  the misread part -m[1]: mean ' + (-mean(T, 'm')).toFixed(2) + ' sd ' + sd(T, 'm').toFixed(2));
  var wu = W.filter(function (r) { return r.why === 'under'; }), wo = W.filter(function (r) { return r.why === 'over'; });
  print('  whiffs per swing: under ' + (wu.length / (R.length + W.length)).toFixed(3) + ' (D mean ' + mean(wu, 'D').toFixed(1) + ', misread ' + (-mean(wu, 'm')).toFixed(1) + ', timing ' + mean(wu, 'e').toFixed(0) + ' ms), over ' + (wo.length / (R.length + W.length)).toFixed(3) + ' (D ' + mean(wo, 'D').toFixed(1) + '), other ' + ((W.length - wu.length - wo.length) / (R.length + W.length)).toFixed(3));
  var late = T.filter(function (r) { return r.e < -8; }), early = T.filter(function (r) { return r.e > 8; });
  print('  by timing: late (bat 8+ ms late) n ' + late.length + ' foul ' + (late.filter(function (r) { return r.foul; }).length / late.length).toFixed(3) + ' vm ' + mean(late, 'vm').toFixed(1) + ' dir ' + mean(late, 'dir').toFixed(1) + ';  early n ' + early.length + ' foul ' + (early.filter(function (r) { return r.foul; }).length / early.length).toFixed(3) + ' vm ' + mean(early, 'vm').toFixed(1) + ' dir ' + mean(early, 'dir').toFixed(1));
})(arguments);
