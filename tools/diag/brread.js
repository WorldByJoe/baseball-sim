// breaking balls: how the batter read them at the commit point (sat on it / picked up / late / fooled), the swing
// state that read put him in ('on' / 'off'), and swing rates by distance from the zone edge for each
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, G = BB.geometry, T = {};
  var BANDS = [['heart', 4, 99], ['edge in', 0, 4], ['edge out', -4, 0], ['out 4-8', -8, -4], ['out 8+', -99, -8]];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < 600; i++) { var B = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['SL', 'CU', 'ST'].indexOf(q.pitch.type) < 0 || !q.decide) return;
        var x = q.pitch.plate.x, z = q.pitch.plate.z, ZH = G.PLATE_HALF + G.BALL_R, dx = ZH - Math.abs(x), dlo = z - (B.zone.bot - G.BALL_R), dhi = B.zone.top + G.BALL_R - z;
        var d = (dx >= 0 && dlo >= 0 && dhi >= 0 ? Math.min(dx, dlo, dhi) : -Math.hypot(Math.max(0, -dx), Math.max(0, -dlo, -dhi))) / IN;
        var band = BANDS.filter(function (b) { return d >= b[1] && d < b[2]; })[0][0], rd = q.read;
        var read = rd.same ? 'sat on it' : rd.detectedD ? 'picked up' : rd.detected ? 'looking FB, same kind' : rd.late ? 'late' : 'fooled';
        var key = read + '|' + band, t = T[key] = T[key] || [0, 0, 0]; t[0]++; if (q.swing || q.decide.swing) t[1]++; if (q.decide.state === 'off') t[2]++;
      }); } }
  var reads = ['sat on it', 'picked up', 'late', 'fooled'], tot = 0; Object.keys(T).forEach(function (k) { tot += T[k][0]; });
  print('MODEL breaking balls (n ' + tot + '): share of pitches by read, and swing rate by band (heart, edge in, edge out, out 4-8, out 8+)');
  reads.forEach(function (r) { var n = 0, s = ''; BANDS.forEach(function (b) { var t = T[r + '|' + b[0]] || [0, 0, 0]; n += t[0]; s += (t[0] ? (t[1] / t[0]).toFixed(2) : ' -  ') + ' '; }); print('  ' + (r + '            ').slice(0, 12) + ' share ' + (n / tot).toFixed(3) + '  swing ' + s); });
  var all = ''; BANDS.forEach(function (b) { var n = 0, sw = 0; reads.forEach(function (r) { var t = T[r + '|' + b[0]] || [0, 0, 0]; n += t[0]; sw += t[1]; }); all += (sw / n).toFixed(2) + ' '; }); print('  all          swing ' + all + '   (league .69 .60 .46 .33 .15)');
})(arguments);
