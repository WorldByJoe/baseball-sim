// df_model.js: the model's swings and takes for tools/diag/df_fit.py, one CSV row per pitch: kind, plate x and z (ft,
// the catcher's view as Statcast's), zone top and bottom (ft), swing, balls, strikes, and the remaining break as
// df_league.py defines it (variant A: (a_fb - a) tau^2 / 2, ft), with each pitch's acceleration the constant one that
// fits its flight and the pitcher's fastball's the mean of his four-seamers (else sinkers). Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], FT = BB.units.FT, TAU = 0.175, rows = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  function acc(pt) { var T = pt.plate.t, out = []; [0, 2].forEach(function (j) { var p1 = j === 0 ? pt.plate.x : pt.plate.z; out.push(2 * (p1 - pt.rel[j] - pt.v0[j] * T) / (T * T)); }); return out; }   // m/s^2, x and z
  P.forEach(function (Pi) { Pi.fbA = [0, 0]; Pi.fbN = 0; Pi.id = P.indexOf(Pi); });
  var recs = [];
  for (i = 0; i < (+A[1] || 600); i++) { var Bt = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (q.result === 'hbp') return; var a = acc(q.pitch), t = q.pitch.type;
        var fbT = Pi.pitches.filter(function (o) { return o.type === 'FF'; }).length ? 'FF' : 'SI';
        if (t === fbT) { Pi.fbA[0] += a[0]; Pi.fbA[1] += a[1]; Pi.fbN++; }
        var c = q.count.split('-');
        recs.push({ P: Pi, k: BB.PITCH_TYPES[t].kind, x: q.pitch.plate.x / FT, z: q.pitch.plate.z / FT, top: Bt.zone.top / FT, bot: Bt.zone.bot / FT, sw: q.swing ? 1 : (q.decide && q.decide.swing ? 1 : 0), b: c[0], s: c[1], a: a }); }); } }
  recs.forEach(function (r) { if (!r.P.fbN) return; var fa = [r.P.fbA[0] / r.P.fbN, r.P.fbA[1] / r.P.fbN];
    print([r.k, r.x.toFixed(3), r.z.toFixed(3), r.top.toFixed(3), r.bot.toFixed(3), r.sw, r.b, r.s, ((fa[0] - r.a[0]) * TAU * TAU / 2 / FT).toFixed(4), ((fa[1] - r.a[1]) * TAU * TAU / 2 / FT).toFixed(4)].join(',')); });
})(arguments);
