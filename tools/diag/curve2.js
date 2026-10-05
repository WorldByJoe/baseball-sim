// the collision alone, as curve.js, with the swing's bat speed, attack angle and tilt given: -- batMph attack tilt
// prints launch minus attack, exit speed, the share going backward and the spray (+ pull) by D
(function (A) {
  var IN = BB.units.IN, MPH = BB.units.MPH, vb = +A[0] || 72, att = A[1] !== undefined ? +A[1] : 10, tilt = +A[2] || 30;
  var rng = BB.makeRng(5), env = BB.mlbEnv(rng), P = BB.makePitcher(rng, { role: 'SP' }), B = BB.makeBatter(rng, {});
  var pitch = null; for (var k = 0; k < 50 && !pitch; k++) { var r = BB.simPA(P, B, { env: env, ump: BB.makeUmp(rng), framing: 0, seen: 20, rec: false }, rng); r.pitches.forEach(function (q) { if (!pitch && q.pitch.type === 'FF') pitch = q.pitch; }); }
  print('bat ' + vb + ' mph, attack ' + att + ', tilt ' + tilt + '; pitch ' + pitch.mph.toFixed(1) + ' mph, descent ' + (Math.atan2(-pitch.plate.v[2], -pitch.plate.v[1]) * 180 / Math.PI).toFixed(1) + ' deg');
  var s = '';
  for (var d = 0; d <= 2.71; d += 0.3) {
    var sw = { D: d * IN, dLong: 0, theta: 0, faceTh: 0, attack: att, attackAt: att, tilt: tilt, side: -1, batMph: vb, batAt: vb, bat: B.bat };
    var col = BB.collide(pitch, sw); if (!col) { s += ' D ' + d.toFixed(1) + ': no contact'; break; }
    var v = col.v, sp = Math.hypot(v[0], v[1], v[2]), la = Math.asin(v[2] / sp) * 180 / Math.PI, spray = Math.atan2(v[0], v[1]) * 180 / Math.PI;
    s += '  D ' + d.toFixed(1) + ': vm ' + (la - att).toFixed(0) + ' EV ' + (sp / MPH).toFixed(0) + (v[1] < 0 ? ' BACK' : '') + ' spray ' + (-spray).toFixed(0);
  }
  print(s);
})(arguments);
