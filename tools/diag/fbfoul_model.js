(function (A) {
  var rng = BB.makeRng(106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, R = [], tips = 0, sw = 0;
  var B = [[-90, -40], [-40, -15], [-15, 5], [5, 25], [25, 40], [40, 60], [60, 99]];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < 500; i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['FF', 'SI', 'FC'].indexOf(q.pitch.type) < 0 || !q.swing) return; sw++;
        if (!q.swing.contact || !q.bb) return;
        mine.push([q.bb.la - q.swing.attackAt, !q.bb.fair || q.result === 'foul', q.swing.depth / IN, q.bb.spray, q.bb.la]); }); }
    var m = mine.reduce(function (a, r) { return a + r[2]; }, 0) / (mine.length || 1); mine.forEach(function (r) { R.push([r[0], r[1], r[2] - m, r[3], r[4]]); }); }
  var n = R.length; print('MODEL fastball contact n ' + n + ', foul share ' + (R.filter(function (r) { return r[1]; }).length / n).toFixed(3) + ' (per swing ' + (R.filter(function (r) { return r[1]; }).length / sw).toFixed(3) + ')');
  print('  vm band   share  foul');
  B.forEach(function (b) { var S = R.filter(function (r) { return r[0] >= b[0] && r[0] < b[1]; }); print('  ' + (b[0] + '..' + b[1] + '       ').slice(0, 10) + (S.length / n).toFixed(3) + '  ' + (S.filter(function (r) { return r[1]; }).length / S.length).toFixed(3)); });
  var D = R.map(function (r) { return r[2]; }).sort(function (a, b) { return a - b; }), t1 = D[Math.floor(n / 3)], t2 = D[Math.floor(2 * n / 3)];
  [['deep', -99, t1], ['middle', t1, t2], ['out front', t2, 99]].forEach(function (b) { var S = R.filter(function (r) { return r[2] >= b[1] && r[2] < b[2]; }); print('  depth ' + (b[0] + '         ').slice(0, 9) + ' foul ' + (S.filter(function (r) { return r[1]; }).length / S.length).toFixed(3)); });
})(arguments);
