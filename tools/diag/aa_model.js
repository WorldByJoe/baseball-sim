// aa_model.js: the model's attack angle on contact by pitch kind and height, against contact depth, measured as
// tools/diag/aa_league.py measures the league's (depth about each hitter's own mean). Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], R = [], IN = BB.units.IN;
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 500); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing || !q.swing.contact || !q.bb) return; var s = q.swing; if ((s.batAt || s.batMph) < 50) return;
        mine.push({ k: BB.PITCH_TYPES[q.pitch.type].kind, aa: s.attackAt, la: q.bb.la, dep: s.depth / IN, h: (q.pitch.plate.z - Bt.zone.bot) / (Bt.zone.top - Bt.zone.bot), foul: !q.bb.fair || q.result === 'foul' }); }); }
    var md = mine.reduce(function (a, x) { return a + x.dep; }, 0) / (mine.length || 1); mine.forEach(function (x) { x.dd = x.dep - md; R.push(x); }); }
  function m(v, f) { return v.reduce(function (a, x) { return a + f(x); }, 0) / (v.length || 1); }
  function f1(x) { var t = (x >= 0 ? ' ' : '') + x.toFixed(1); while (t.length < 5) t = ' ' + t; return t; }
  print('MODEL contact (bat 50+ mph): by kind - n, attack, LA, vm, depth about his mean, in-play LA; then attack / depth by height (below, 0-.25 ... above); attack per inch of depth');
  ['FB', 'BR', 'OS'].forEach(function (k) { var v = R.filter(function (x) { return x.k === k; });
    var mx = m(v, function (x) { return x.dd; }), my = m(v, function (x) { return x.aa; }), sxy = m(v, function (x) { return (x.dd - mx) * (x.aa - my); }), sxx = m(v, function (x) { return (x.dd - mx) * (x.dd - mx); });
    print('  ' + k + ' n ' + v.length + '  attack ' + f1(my) + '  LA ' + f1(m(v, function (x) { return x.la; })) + '  vm ' + f1(m(v, function (x) { return x.la - x.aa; })) + '  depth ' + f1(mx) + '  in-play LA ' + f1(m(v.filter(function (x) { return !x.foul; }), function (x) { return x.la; })) + '  | attack/in ' + (sxy / sxx).toFixed(2));
    print('     by height: ' + [[-9, 0], [0, .25], [.25, .5], [.5, .75], [.75, 1], [1, 9]].map(function (b) { var w = v.filter(function (x) { return x.h >= b[0] && x.h < b[1]; }); return f1(m(w, function (x) { return x.aa; })) + '/' + f1(m(w, function (x) { return x.dd; })); }).join('  ')); });
})(arguments);
