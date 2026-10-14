// foldscore.js: a one-line scorer for the last look's fold and where it lands (FL). Fastballs: whiffs, swings missing
// by 3+ in, fouls per swing, and the grazes (fouls at 10-70 deg leaving at .70-.95 of the release speed) as a share of
// contact, and their mean exit speed over release speed; every kind: whiffs and fouls per swing, the grazes' share of contact, pop-ups in play (50+ deg) per contact,
// the in-play mix by launch angle (ground < 10, liner 10-25, fly 25-50, pop 50+), strikeouts and walks per plate
// appearance. League values (42 days of 2025; tracked contact for the graze and pop-up shares) on the line below.
// Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, BALL_R = BB.geometry.BALL_R;
  var S = { FB: [0, 0, 0, 0, 0, 0, 0], ALL: [0, 0, 0, 0, 0, 0, 0] }, MIX = [0, 0, 0, 0], pa = [0, 0, 0], pop = 0;   // swings, whiffs, 3+ in, fouls, contact, grazes
  function gap(s) { var r = BB.batRadius(s.bat, BB.SWEET_IN - s.dLong / IN), half = s.bat.lenIn / 2 - BB.SWEET_IN;
    var a = Math.max(0, s.dLong - BB.SWEET_IN * IN, -half * IN - s.dLong), gp = Math.max(0, Math.abs(s.D) - r); return Math.max(0, Math.sqrt(gp * gp + a * a) - BALL_R) / IN; }
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 400); i++) { var Bt = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      var res = BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      pa[0]++; if (res.result === 'K') pa[1]++; if (res.result === 'BB') pa[2]++;
      res.pitches.forEach(function (q) {
        var s = q.swing; if (!s) return; var fb = BB.PITCH_TYPES[q.pitch.type].kind === 'FB';
        [fb ? S.FB : null, S.ALL].forEach(function (t) { if (!t) return; t[0]++;
          if (!s.contact || !q.bb) { t[1]++; if (gap(s) >= 3) t[2]++; return; }
          var foul = !q.bb.fair || q.result === 'foul'; if (foul) t[3]++;
          if ((s.batAt || s.batMph) < 50) return; t[4]++;
          if (foul && q.bb.la >= 10 && q.bb.la < 70 && q.bb.ev / q.pitch.mph >= 0.7 && q.bb.ev / q.pitch.mph < 0.95) { t[5]++; t[6] += q.bb.ev / q.pitch.mph; } });
        if (s.contact && q.bb && q.bb.fair && q.result !== 'foul') { var la = q.bb.la; MIX[la < 10 ? 0 : la < 25 ? 1 : la < 50 ? 2 : 3]++; if (la >= 50 && (s.batAt || s.batMph) >= 50) pop++; }
      }); } }
  function f3(x) { return x.toFixed(3); }
  var F = S.FB, L = S.ALL, nm = MIX[0] + MIX[1] + MIX[2] + MIX[3];
  print('FB whiff ' + f3(F[1] / F[0]) + ' 3+in ' + f3(F[2] / F[0]) + ' foul ' + f3(F[3] / F[0]) + ' grazes ' + f3(F[5] / F[4]) + ' at ' + f3(F[6] / F[5]) + ' | ALL whiff ' + f3(L[1] / L[0]) + ' foul ' + f3(L[3] / L[0]) + ' grazes ' + f3(L[5] / L[4]) +
        ' pop/contact ' + f3(pop / L[4]) + ' mix ' + MIX.map(function (n) { return Math.round(100 * n / nm); }).join('/') + ' | K ' + f3(pa[1] / pa[0]) + ' BB ' + f3(pa[2] / pa[0]));
  print('   league: FB whiff .174 3+in .014 foul .451 grazes .327 at .817 | ALL whiff .232 foul .40 grazes .245 pop/contact .055 mix 43/22/24/10 | K .222 BB .084');
})(arguments);
