(function (A) {
  var rng = BB.makeRng(106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], DEG = Math.PI / 180, R = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < 500; i++) { var Bt = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing || !q.swing.contact || !q.bb || !q.bb.fair || q.result === 'foul') return; var sb = q.side || q.swing.side;
        var L = q.bb.landing, ls = Math.atan2(L[0], L[1]) / DEG; R.push([q.swing.theta * sb / DEG, (+A[1] ? ls : q.bb.spray) * sb, q.bb.la - q.swing.attackAt]); }); } }
  print('MODEL balls in play n ' + R.length + ': residual spray (pull - 1.5 x path) by launch minus attack band');
  [[-90, -15], [-15, 5], [5, 25], [25, 40], [40, 99]].forEach(function (b) { var S = R.filter(function (r) { return r[2] >= b[0] && r[2] < b[1]; }), n = S.length;
    var res = S.reduce(function (a, r) { return a + r[1] - 1.5 * r[0]; }, 0) / n, mp = S.reduce(function (a, r) { return a + r[0]; }, 0) / n, ms = S.reduce(function (a, r) { return a + r[1]; }, 0) / n;
    print('  vm ' + (b[0] + '..' + b[1] + '      ').slice(0, 9) + ' n ' + n + '  residual ' + res.toFixed(1) + '  (mean path ' + mp.toFixed(1) + ', mean spray ' + ms.toFixed(1) + ')'); });
})(arguments);
