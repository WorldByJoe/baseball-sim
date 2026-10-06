// bc_fit.js: one line per run for fitting the BC timing (TIMING.prior, TIMING.retime) to the league's contact depth by
// type (about each hitter's mean), with bat speed by type, breaking-ball fouls and attack, and whiffs per swing.
// Arguments: seed, hitters. League (bc_league.py): depth FF -4.0 SI -3.9 FC +0.4 SL +3.9 ST +5.6 CU +6.5 CH +4.8 FS +5.0.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], C = [], IN = BB.units.IN, sw = 0, wh = 0;
  var TY = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS'], L = [-4.0, -3.9, 0.4, 3.9, 5.6, 6.5, 4.8, 5.0], LB = [-0.43, 0.16, 0.66, 0.27, -0.28, -0.07, 0.43, 0.40];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 600); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing) return; sw++; if (!q.bb) { wh++; return; } var s = q.swing; if ((s.batAt || s.batMph) < 50) return;
        mine.push({ t: q.pitch.type, k: BB.PITCH_TYPES[q.pitch.type].kind, dep: s.depth / IN, bs: s.batAt || s.batMph, aa: s.attackAt, foul: !q.bb.fair || q.result === 'foul' }); }); }
    var md = 0, mb = 0; mine.forEach(function (x) { md += x.dep; mb += x.bs; }); md /= mine.length || 1; mb /= mine.length || 1;
    mine.forEach(function (x) { x.dd = x.dep - md; x.db = x.bs - mb; C.push(x); }); }
  function m(v, f) { return v.length ? v.reduce(function (a, x) { return a + f(x); }, 0) / v.length : NaN; }
  var dep = TY.map(function (t) { return m(C.filter(function (x) { return x.t === t; }), function (x) { return x.dd; }); });
  var bat = TY.map(function (t) { return m(C.filter(function (x) { return x.t === t; }), function (x) { return x.db; }); });
  var rms = Math.sqrt(m(TY, function (t) { var i = TY.indexOf(t); return (dep[i] - L[i]) * (dep[i] - L[i]); }));
  var rmb = Math.sqrt(m(TY, function (t) { var i = TY.indexOf(t); return (bat[i] - LB[i]) * (bat[i] - LB[i]); }));
  var br = C.filter(function (x) { return x.k === 'BR'; });
  print('prior ' + BB.TIMING.prior + ' retime ' + BB.TIMING.retime + ' | depth ' + dep.map(function (d) { return d.toFixed(1); }).join(' ') + ' | rms ' + rms.toFixed(2) + ' | bat ' + bat.map(function (d) { return d.toFixed(1); }).join(' ') + ' rms ' + rmb.toFixed(2) +
        ' | BR foul ' + m(br, function (x) { return x.foul ? 1 : 0; }).toFixed(3) + ' attack ' + m(br, function (x) { return x.aa; }).toFixed(1) + ' | whiff/swing ' + (wh / sw).toFixed(3));
})(arguments);
