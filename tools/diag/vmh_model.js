// vmh_model.js: the model's launch minus attack and exit-speed efficiency by pitch height in fine bands, beyond the zone
// too, measured as tools/diag/vmh_league.py measures the league's (fastballs and all kinds). Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], R = { FB: [], ALL: [] };
  var HB = [[-9, -.5], [-.5, -.25], [-.25, 0], [0, .25], [.25, .5], [.5, .75], [.75, 1], [1, 1.25], [1.25, 1.5], [1.5, 9]];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 600); i++) { var B = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing || !q.swing.contact || !q.bb) return; var s = q.swing, bs = s.batAt || s.batMph; if (bs < 50) return;
        var x = [(q.pitch.plate.z - B.zone.bot) / (B.zone.top - B.zone.bot), q.bb.la - s.attackAt, q.bb.ev / (1.23 * bs + 0.23 * q.pitch.mph), !q.bb.fair || q.result === 'foul'];
        R.ALL.push(x); if (BB.PITCH_TYPES[q.pitch.type].kind === 'FB') R.FB.push(x); }); } }
  function m(v, j) { return v.reduce(function (a, x) { return a + x[j]; }, 0) / v.length; }
  ['FB', 'ALL'].forEach(function (kd) { print('MODEL ' + kd + ': by height band - n, vm mean, vm sd, efficiency (all contact), efficiency in play, foul share');
    HB.forEach(function (b) { var S = R[kd].filter(function (x) { return x[0] >= b[0] && x[0] < b[1]; }), Bp = S.filter(function (x) { return !x[3]; }); if (S.length < 30) return;
      var mv = m(S, 1), sdv = Math.sqrt(m(S.map(function (x) { return [0, (x[1] - mv) * (x[1] - mv)]; }), 1));
      print('  ' + b[0].toFixed(2) + '..' + b[1].toFixed(2) + ' n ' + S.length + '  vm ' + mv.toFixed(1) + ' sd ' + sdv.toFixed(1) + '  eff ' + m(S, 2).toFixed(3) + '  in play ' + (Bp.length ? m(Bp, 2) : 0).toFixed(3) + '  foul ' + (S.length - Bp.length) / S.length); }); });
})(arguments);
