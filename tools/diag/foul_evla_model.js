(function (A) {
  var rng = BB.makeRng(106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], F = [], Bp = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < 500; i++) { var Bt = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['FF', 'SI', 'FC'].indexOf(q.pitch.type) < 0 || !q.swing || !q.swing.contact || !q.bb) return;
        var back = Math.abs(q.bb.spray) > 90 ? 1 : 0; ((!q.bb.fair || q.result === 'foul') ? F : Bp).push([q.bb.ev, q.bb.la, back, q.bb.spray]); }); } }
  function tab(V, name) { var n = V.length; function sh(f) { return (V.filter(f).length / n).toFixed(3); }
    print(name + ' n ' + n); print('   EV <50 ' + sh(function (v) { return v[0] < 50; }) + '  50-70 ' + sh(function (v) { return v[0] >= 50 && v[0] < 70; }) + '  70-85 ' + sh(function (v) { return v[0] >= 70 && v[0] < 85; }) + '  85-95 ' + sh(function (v) { return v[0] >= 85 && v[0] < 95; }) + '  95+ ' + sh(function (v) { return v[0] >= 95; }));
    print('   LA <-10 ' + sh(function (v) { return v[1] < -10; }) + '  -10..10 ' + sh(function (v) { return v[1] >= -10 && v[1] < 10; }) + '  10..30 ' + sh(function (v) { return v[1] >= 10 && v[1] < 30; }) + '  30..50 ' + sh(function (v) { return v[1] >= 30 && v[1] < 50; }) + '  50..70 ' + sh(function (v) { return v[1] >= 50 && v[1] < 70; }) + '  70+ ' + sh(function (v) { return v[1] >= 70; }));
    print('   going backward (|spray| > 90) ' + sh(function (v) { return v[2]; }) + ';  |spray| 45-90 ' + sh(function (v) { return Math.abs(v[3]) > 45 && Math.abs(v[3]) <= 90; })); }
  tab(F, 'MODEL fastball fouls'); tab(Bp, 'MODEL fastball balls in play');
})(arguments);
