// kbcurve.js: the swing curves by strikes x pitch kind, model against league (statcast/swing_count_kind_2025.js pooled
// over the counts in each group): swing rate by distance from the zone's edge (in, the ball's edge counted, the same
// ten bands as fit_swing_policy), for no strikes, one strike and two strikes; then the rms by group. Load after
// statcast/swing_count_kind_2025.js. Arguments: seed, hitters.
(function (A) {
  var IN = BB.units.IN, EDGES = [-99, -6, -4, -2, 0, 2, 4, 6, 9, 12, 99], HALF = (8.5 + 1.45) * IN, R = 1.45 * IN;
  function edgeIn(B, x, z) { var lo = B.zone.bot - R, hi = B.zone.top + R, dx = Math.abs(x) - HALF, dz = Math.max(lo - z, z - hi);
    if (dx <= 0 && dz <= 0) return Math.max(dx, dz) / IN; return Math.sqrt(Math.pow(Math.max(dx, 0), 2) + Math.pow(Math.max(dz, 0), 2)) / IN; }
  function binOf(d) { for (var j = 0; j < EDGES.length - 1; j++) if (d >= EDGES[j] && d < EDGES[j + 1]) return j; return 9; }
  var rng = BB.makeRng(+A[0] || 7), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], M = {};
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 600); i++) { var B = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.decide) return; var key = q.count.split('-')[1] + '|' + BB.PITCH_TYPES[q.pitch.type].kind, b = binOf(edgeIn(B, q.pitch.plate.x, q.pitch.plate.z));
        var t = M[key] = M[key] || EDGES.slice(1).map(function () { return [0, 0]; }); t[b][0]++; if (q.swing) t[b][1]++; }); } }
  print('swing rate by distance from the zone edge (in: ..-6 -6..-4 -4..-2 -2..0 0..2 2..4 4..6 6..9 9..12 12..), model / league');
  ['0', '1', '2'].forEach(function (s) { var e = 0, w = 0;
    ['FB', 'BR', 'OS'].forEach(function (kd) { var t = M[s + '|' + kd], L = EDGES.slice(1).map(function () { return [0, 0]; });
      Object.keys(SWING_CK).forEach(function (ck) { var p = ck.split('|'); if (p[1] !== kd || p[0].split('-')[1] !== s) return; SWING_CK[ck].forEach(function (x, b) { if (x[0] !== null) { L[b][0] += x[0] * x[1]; L[b][1] += x[1]; } }); });
      var mm = t.map(function (x) { return x[0] ? x[1] / x[0] : NaN; }), ll = L.map(function (x) { return x[1] ? x[0] / x[1] : NaN; });
      mm.forEach(function (v, b) { if (!isNaN(v) && !isNaN(ll[b])) { e += L[b][1] * (v - ll[b]) * (v - ll[b]); w += L[b][1]; } });
      print('  ' + s + ' strikes ' + kd + '  model  ' + mm.map(function (v) { return v.toFixed(2); }).join(' ') + '\n' + '                league ' + ll.map(function (v) { return v.toFixed(2); }).join(' ')); });
    print('    rms ' + Math.sqrt(e / w).toFixed(4)); });
})(arguments);
