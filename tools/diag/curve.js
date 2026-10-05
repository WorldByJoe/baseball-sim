// the collision alone: a 94-mph fastball at mid-zone, a 72-mph square swing at attack 10 deg, struck D inches under
// (or over) the ball's centre at the sweet spot - launch angle, its difference from the path, exit speed, spin,
// the share of the outgoing speed going backward, and whether it lands foul by direction
(function () {
  var IN = BB.units.IN, MPH = BB.units.MPH;
  var rng = BB.makeRng(5), env = BB.mlbEnv(rng), P = BB.makePitcher(rng, { role: 'SP' }), B = BB.makeBatter(rng, {});
  var pitch = null; for (var k = 0; k < 50 && !pitch; k++) { var r = BB.simPA(P, B, { env: env, ump: BB.makeUmp(rng), framing: 0, seen: 20, rec: false }, rng); r.pitches.forEach(function (q) { if (!pitch && q.pitch.type === 'FF') pitch = q.pitch; }); }
  print('pitch ' + pitch.mph.toFixed(1) + ' mph, descent ' + (Math.atan2(-pitch.plate.v[2], -pitch.plate.v[1]) * 180 / Math.PI).toFixed(1) + ' deg');
  for (var d = -2.7; d <= 2.71; d += 0.3) {
    var sw = { D: d * IN, dLong: 0, theta: 0, faceTh: 0, attack: 10, attackAt: 10, tilt: 30, side: -1, batMph: 72, batAt: 72, bat: B.bat };
    var col = BB.collide(pitch, sw);
    if (!col) { print('D ' + d.toFixed(1) + ': no collide export'); break; }
    var v = col.v, sp = Math.hypot(v[0], v[1], v[2]), la = Math.asin(v[2] / sp) * 180 / Math.PI;
    print('D ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' in: LA ' + la.toFixed(1) + '  LA-AA ' + (la - 10).toFixed(1) + '  EV ' + (sp / MPH).toFixed(1) + '  backward share ' + (v[1] < 0 ? (-v[1] / sp).toFixed(2) : '0') + '  spin ' + (Math.hypot(col.w[0], col.w[1], col.w[2]) * 60 / (2 * Math.PI)).toFixed(0) + ' rpm');
  }
})();
