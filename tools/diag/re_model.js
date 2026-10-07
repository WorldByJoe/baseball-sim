// re_model.js: the quality of the model's reaching contact (RE), fastballs, measured as tools/diag/re_league.py
// measures the league's: by distance from the zone's edge and, beyond it, by direction - bat speed, exit speed (mean,
// 90th percentile), squared-up share, exit speed over the squared-up ceiling, launch and launch minus attack (mean,
// spread), foul share; and the parts of the strike: the vertical offset |D| (in), the distance along the barrel from
// the sweet spot (dLong, in, + toward the end) and the collision efficiency q; for the balls in play alone, exit speed
// and efficiency. Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], C = [], IN = BB.units.IN, HALF = 8.5 + 1.45, R = 1.45;
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 600); i++) { var B = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (BB.PITCH_TYPES[q.pitch.type].kind !== 'FB' || !q.swing || !q.swing.contact || !q.bb) return; var s = q.swing, bs = s.batAt || s.batMph; if (bs < 50) return;
        var x = q.pitch.plate.x / IN, z = q.pitch.plate.z / IN, lo = B.zone.bot / IN - R, hi = B.zone.top / IN + R, dx = Math.abs(x) - HALF, dlo = lo - z, dhi = z - hi, out = Math.max(dx, dlo, dhi);
        var d = out <= 0 ? out : Math.hypot(Math.max(dx, 0), Math.max(dlo, dhi, 0)), inside = x * q.side > 0;
        var way = out <= 0 ? 'zone' : dlo >= Math.max(dx, dhi) ? 'below' : dhi >= dx ? 'above' : inside ? 'in' : 'away', ceil = 1.23 * bs + 0.23 * q.pitch.mph;
        C.push({ d: d, way: way, bs: bs, ev: q.bb.ev, la: q.bb.la, vm: q.bb.la - s.attackAt, sq: q.bb.ev >= 0.8 * ceil, eff: q.bb.ev / ceil, foul: !q.bb.fair || q.result === 'foul', D: Math.abs(s.D) / IN, dl: s.dLong / IN, q: q.bb.q }); }); } }
  function m(v, f) { return v.reduce(function (a, x) { return a + f(x); }, 0) / v.length; }
  function sd(v, f) { var mm = m(v, f); return Math.sqrt(m(v, function (x) { return (f(x) - mm) * (f(x) - mm); })); }
  function p(t, w) { t = String(t); while (t.length < w) t += ' '; return t; }
  function row(nm, S) { if (S.length < 30) return; var ev = S.map(function (x) { return x.ev; }).sort(function (a, b) { return a - b; });
    print('  ' + p(nm, 14) + ' n ' + S.length + '  bat ' + m(S, function (x) { return x.bs; }).toFixed(1) + '  EV ' + m(S, function (x) { return x.ev; }).toFixed(1) + ' p90 ' + ev[Math.floor(0.9 * ev.length)].toFixed(1) + '  squared ' + m(S, function (x) { return x.sq ? 1 : 0; }).toFixed(3) + '  eff ' + m(S, function (x) { return x.eff; }).toFixed(3) +
          '  LA ' + m(S, function (x) { return x.la; }).toFixed(1) + ' sd ' + sd(S, function (x) { return x.la; }).toFixed(1) + '  vm ' + m(S, function (x) { return x.vm; }).toFixed(1) + ' sd ' + sd(S, function (x) { return x.vm; }).toFixed(1) + '  foul ' + m(S, function (x) { return x.foul ? 1 : 0; }).toFixed(3) +
          '  | |D| ' + m(S, function (x) { return x.D; }).toFixed(2) + ' dLong ' + m(S, function (x) { return x.dl; }).toFixed(2) + ' sd ' + sd(S, function (x) { return x.dl; }).toFixed(2) + ' q ' + m(S, function (x) { return x.q; }).toFixed(3));
    var Bp = S.filter(function (x) { return !x.foul; }); if (Bp.length) print('                 in play EV ' + m(Bp, function (x) { return x.ev; }).toFixed(1) + ' eff ' + m(Bp, function (x) { return x.eff; }).toFixed(3)); }
  print('MODEL fastball contact (bat 50+ mph): by distance from the zone edge (in)');
  [[-99, -4, 'heart (4+ in)'], [-4, 0, 'edge in 0-4'], [0, 4, 'edge out 0-4'], [4, 8, 'out 4-8'], [8, 99, 'out 8+']].forEach(function (b) { row(b[2], C.filter(function (x) { return x.d >= b[0] && x.d < b[1]; })); });
  print('  beyond the edge, by direction:');
  ['below', 'away', 'in', 'above'].forEach(function (w) { [[0, 4], [4, 99]].forEach(function (b) { row(w + ' ' + b[0] + '-' + (b[1] === 99 ? '' : b[1]), C.filter(function (x) { return x.way === w && x.d >= b[0] && x.d < b[1]; })); }); });
})(arguments);
