// the model's swings at pitches outside the zone, as tools/diag/chase_dir_league.py counts the league's: by pitch
// kind, distance from the zone's edge (the ball's edge counted) and direction out of the zone (below / away / in /
// above): swing rate and whiff per swing, overall and with two strikes. Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, G = BB.geometry, T = {};
  var KIND = { FF: 'FB', SI: 'FB', FC: 'FB', SL: 'BR', CU: 'BR', ST: 'BR', CH: 'OS', FS: 'OS' }, HALF = (8.5 + 1.45), R = 1.45;
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 500); i++) { var B = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.decide) return; var kd = KIND[q.pitch.type], x = q.pitch.plate.x / IN, z = q.pitch.plate.z / IN, bot = B.zone.bot / IN, top = B.zone.top / IN, sb = q.side;
        var dx = Math.abs(x) - HALF, dlo = bot - z - R, dhi = z - top - R, out = Math.max(dx, dlo, dhi); if (out <= 0) return;
        var dist = Math.hypot(Math.max(dx, 0), Math.max(dlo, dhi, 0)), way = dlo >= dx && dlo >= dhi ? 'below' : dhi >= dx ? 'above' : (x * sb < 0 ? 'away' : 'in');   // the batter stands on the sb side: x * sb > 0 is toward him
        var band = dist < 3 ? '0-3' : dist < 6 ? '3-6' : dist < 9 ? '6-9' : dist < 12 ? '9-12' : '12+', two = q.count.split('-')[1] === '2';
        var sw = !!q.swing, wh = sw && !q.swing.contact;
        [['all'], two ? ['two'] : []].forEach(function (c) { if (!c.length) return; var key = kd + '|' + band + '|' + way + '|' + c[0], t = T[key] = T[key] || [0, 0, 0]; t[0]++; if (sw) t[1]++; if (wh) t[2]++; }); }); } }
  print('MODEL: swing rate at pitches outside the zone by kind x distance x direction (n in brackets; whiff per swing after the slash)');
  ['FB', 'BR', 'OS'].forEach(function (kd) { ['all', 'two'].forEach(function (c) { var s = ' ' + kd + ' ' + (c + '    ').slice(0, 4);
    ['0-3', '3-6', '6-9', '9-12', '12+'].forEach(function (band) { s += '  | ' + (band + '    ').slice(0, 4);
      ['below', 'away', 'in', 'above'].forEach(function (way) { var t = T[kd + '|' + band + '|' + way + '|' + c] || [0, 0, 0]; s += ' ' + way.slice(0, 2) + ' ' + (t[0] ? t[1] / t[0] : 0).toFixed(2) + '/' + (t[1] ? t[2] / t[1] : 0).toFixed(2) + '(' + t[0] + ')'; }); });
    print(s); }); });
})(arguments);
