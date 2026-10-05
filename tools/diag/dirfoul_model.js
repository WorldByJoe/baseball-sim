(function (A) {
  var rng = BB.makeRng(106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], DEG = Math.PI / 180, R = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < 500; i++) { var Bt = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['FF', 'SI', 'FC'].indexOf(q.pitch.type) < 0 || !q.swing || !q.swing.contact || !q.bb) return;
        var sb = q.side || q.swing.side; R.push([q.swing.theta * sb / DEG, q.bb.la - q.swing.attackAt, !q.bb.fair || q.result === 'foul', q.bb.spray * sb]); }); } }
  var n = R.length; print('MODEL fastball contact by bat direction (deg, + pull): share / foul rate, and foul rate for contact 5-40 deg under; mean ball spray (+ pull)');
  [[-90, -30], [-30, -15], [-15, 0], [0, 15], [15, 30], [30, 90]].forEach(function (b) { var S = R.filter(function (r) { return r[0] >= b[0] && r[0] < b[1]; }), S2 = S.filter(function (r) { return r[1] >= 5 && r[1] < 40; });
    print('  ' + (b[0] + '..' + b[1] + '      ').slice(0, 10) + '  ' + (S.length / n).toFixed(3) + ' / ' + (S.filter(function (r) { return r[2]; }).length / Math.max(1, S.length)).toFixed(3) + '    5-40 under: ' + (S2.filter(function (r) { return r[2]; }).length / Math.max(1, S2.length)).toFixed(3) + '   spray ' + (S.reduce(function (a, r) { return a + r[3]; }, 0) / Math.max(1, S.length)).toFixed(1)); });
})(arguments);
