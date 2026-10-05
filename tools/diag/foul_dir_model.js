(function (A) {
  var rng = BB.makeRng(106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, DEG = Math.PI / 180, R = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < 500; i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['FF', 'SI', 'FC'].indexOf(q.pitch.type) < 0 || !q.swing || !q.swing.contact || !q.bb) return;
        var sb = q.side || q.swing.side; mine.push([!q.bb.fair || q.result === 'foul', q.bb.ev, q.bb.la, q.swing.theta * sb / DEG, q.bb.la - q.swing.attackAt, q.swing.depth / IN, q.bb.spray * sb]); }); }
    var m = mine.reduce(function (a, r) { return a + r[5]; }, 0) / (mine.length || 1); mine.forEach(function (r) { r[5] -= m; R.push(r); }); }
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; } function sd(v) { var mm = mean(v); return Math.sqrt(mean(v.map(function (x) { return (x - mm) * (x - mm); }))); }
  [[10, 30], [30, 50], [50, 70]].forEach(function (b) { [true, false].forEach(function (foul) { var S = R.filter(function (r) { return r[2] >= b[0] && r[2] < b[1] && r[0] === foul; }), d = S.map(function (r) { return r[3]; });
    print('MODEL  LA ' + b[0] + '-' + b[1] + ' ' + (foul ? 'foul ' : 'BIP  ') + ' n ' + S.length + '  bat dir mean ' + mean(d).toFixed(1) + ' sd ' + sd(d).toFixed(1) + ' (|dir|>15: ' + (d.filter(function (v) { return Math.abs(v) > 15; }).length / d.length).toFixed(2) + ')  depth ' + mean(S.map(function (r) { return r[5]; })).toFixed(1) + '  vm ' + mean(S.map(function (r) { return r[4]; })).toFixed(1) + '  EV ' + mean(S.map(function (r) { return r[1]; })).toFixed(1) + '  spray ' + mean(S.map(function (r) { return r[6]; })).toFixed(1) + ' sd ' + sd(S.map(function (r) { return r[6]; })).toFixed(1)); }); });
})(arguments);
