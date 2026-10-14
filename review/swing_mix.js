/* ============================================================================
   swing_mix.js · v0.3 · 2026-10-14

   What each swing comes to in the model, set beside the league's (season/swing_mix_real.py): per swing the share
   missed, fouled and put in play (overall and by pitch kind), the launch angles of the balls in play, and, by the
   vertical offset of contact (D, in: + = the ball above the barrel's centre), the share of contact, how much of it
   went foul and the launch angle of what stayed fair, with the share the last look had corrected. For step 2 of the
   run audit (2026-10-13): the model's balls in play run too high (30-50 deg 0.207 against the league's 0.172, 0-30
   deg 0.378 against 0.426). Is the fault where contact lands on the ball (D), or what a given D makes of it?

   Run:  tools/diag/run.sh bb_engine.js review/swing_mix.js -- [PA] [seed] [aim shift, in] ['{"lookGain":x}' or ''] [barrel scatter x] [timing scatter x] > out.json
   CHANGED
     v0.3  the fastball fouls at 10-70 deg (share of contact, exit speed over the pitch's, slopes on pitch and bat speed: the
           league's .386, .813, .277, .281) and the spray of the balls in play (his pull side +), all and by launch class; a timing
           scatter scale (sixth argument) (Joe, 2026-10-14: the swing refit)
     v0.2  launch-angle shares by pitch height in his zone and kind; aim shift, last-look and barrel-scatter arguments
     v0.1  first build (Joe, 2026-10-13: step 2)
============================================================================ */
(function (A) {
  var NPA = +A[0] || 40000, SEED = +A[1] || 1, IN = BB.units.IN, DU = +A[2] || 0, BS = +A[4] || 1, TS = +A[5] || 1;   // DU: every hitter's aim under the ball moved by this (in); BS: his barrel scatter scaled
  if (A[3]) BB.tuneContact(JSON.parse(A[3]));   // {lookGain, lookSd, vertMiss}
  var rng = BB.makeRng(SEED * 7919 + 3), H = [], P = [], ump = BB.makeUmp(rng);
  for (var i = 0; i < 300; i++) { H.push(BB.makeBatter(rng, {})); H[i].undercut += DU; H[i].barrelSD *= BS; H[i].timingSD *= TS; }
  for (i = 0; i < 100; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var SPRAY_SIGN = +A[6] || 1;   // which way is his pull side in the engine's spray (checked: grounders go to the pull side)
  var KIND = function (t) { return BB.PITCH_TYPES[t] ? BB.PITCH_TYPES[t].kind : 'FB'; };
  var tot = { all: { sw: 0, whiff: 0, foul: 0, play: 0 } }, la = [], dbins = {}, DB = [-9, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 9];
  var GZ = [], nFBc = 0, SPB = [-90, -30, -15, 0, 15, 30, 90], spr = { all: [0, 0, 0, 0, 0, 0], gb: [0, 0, 0, 0, 0, 0], ld: [0, 0, 0, 0, 0, 0], fb: [0, 0, 0, 0, 0, 0] };
  var LAB = [-91, -10, 0, 10, 20, 30, 40, 50, 91], laN = [0, 0, 0, 0, 0, 0, 0, 0], HZ = [-9, 0, 1 / 3, 2 / 3, 1, 9], laH = {};   // laH: shares by pitch height in his zone (0 bottom, 1 top) and kind
  for (var k = 0; k < NPA; k++) {
    var B = H[k % H.length], Pk = P[Math.floor(rng.u() * P.length)], env = BB.mlbEnv(rng); Pk.load = rng.u() * 0.8 * Pk.stamina;
    var r = BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
    r.pitches.forEach(function (q) {
      if (!q.swing) return;
      var kd = KIND(q.pitch.type), res = q.result, c = res === 'swinging_strike' ? 'whiff' : res === 'foul' ? 'foul' : 'play';
      [tot.all, tot[kd] = tot[kd] || { sw: 0, whiff: 0, foul: 0, play: 0 }].forEach(function (t) { t.sw++; t[c]++; });
      if (c === 'whiff') return;
      if (kd === 'FB' && q.bb) { nFBc++; if (c === 'foul' && q.bb.la >= 10 && q.bb.la <= 70) GZ.push([q.bb.ev, q.pitch.mph, q.swing.batAt]); }
      var d = q.swing.D / IN, j = 0; while (j < DB.length - 2 && d >= DB[j + 1]) j++;
      var key = DB[j] + '..' + DB[j + 1], b = dbins[key] = dbins[key] || { n: 0, foul: 0, look: 0, laFair: 0, nFair: 0, evFair: 0 };
      b.n++; if (c === 'foul') b.foul++; if (q.swing.look) b.look++;
      if (c === 'play' && q.bb) { b.nFair++; b.laFair += q.bb.la; b.evFair += q.bb.ev;
        var m = 0; while (m < LAB.length - 2 && q.bb.la >= LAB[m + 1]) m++; laN[m]++;
        var pa = q.bb.spray * (q.swing.side || -1) * SPRAY_SIGN, sb2 = 0; while (sb2 < SPB.length - 2 && pa >= SPB[sb2 + 1]) sb2++;
        spr.all[sb2]++; spr[q.bb.la < 10 ? 'gb' : q.bb.la < 25 ? 'ld' : q.bb.la < 50 ? 'fb' : 'pu'] && spr[q.bb.la < 10 ? 'gb' : q.bb.la < 25 ? 'ld' : 'fb'][sb2]++;
        var hz = (q.pitch.plate.z - B.zone.bot) / (B.zone.top - B.zone.bot), h = 0; while (h < HZ.length - 2 && hz >= HZ[h + 1]) h++;
        var hk = kd + ' h' + h, a = laH[hk] = laH[hk] || [0, 0, 0, 0, 0, 0, 0, 0]; a[m]++; }
    });
  }
  var rate = function (t) { return { swings: t.sw, whiff: +(t.whiff / t.sw).toFixed(4), foul: +(t.foul / t.sw).toFixed(4), play: +(t.play / t.sw).toFixed(4) }; };
  var out = { perSwing: {}, laShares: {}, byD: {} }, nb = laN.reduce(function (a, b) { return a + b; }, 0), nc = 0;
  Object.keys(tot).forEach(function (k2) { out.perSwing[k2] = rate(tot[k2]); });
  laN.forEach(function (n, m) { out.laShares[LAB[m] + '..' + LAB[m + 1]] = +(n / nb).toFixed(4); });
  Object.keys(dbins).forEach(function (k2) { nc += dbins[k2].n; });
  DB.slice(0, -1).forEach(function (lo, j) { var key = lo + '..' + DB[j + 1], b = dbins[key]; if (!b) return;
    out.byD[key] = { contactShare: +(b.n / nc).toFixed(4), foulShare: +(b.foul / b.n).toFixed(3), lookShare: +(b.look / b.n).toFixed(3),
                     laFair: b.nFair ? +(b.laFair / b.nFair).toFixed(1) : null, evFair: b.nFair ? +(b.evFair / b.nFair).toFixed(1) : null }; });
  out.laByHeight = {}; Object.keys(laH).sort().forEach(function (k2) { var a = laH[k2], n = a.reduce(function (x, y) { return x + y; }, 0); out.laByHeight[k2] = { n: n, shares: a.map(function (x) { return +(x / n).toFixed(4); }) }; });
  var med = function (a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; };
  var rr = GZ.map(function (x) { return x[0] / x[1]; }).sort(function (x, y) { return x - y; });
  var ols = function (R) { var n = R.length, m = [0, 0, 0]; R.forEach(function (x) { m[0] += x[0] / n; m[1] += x[1] / n; m[2] += x[2] / n; });
    var a = 0, b = 0, c = 0, d = 0, e = 0; R.forEach(function (x) { var y = x[0] - m[0], p = x[1] - m[1], q2 = x[2] - m[2]; a += p * p; b += p * q2; c += q2 * q2; d += p * y; e += q2 * y; });
    var det = a * c - b * b; return [+((c * d - b * e) / det).toFixed(3), +((a * e - b * d) / det).toFixed(3)]; };
  out.grazes = { share: +(GZ.length / nFBc).toFixed(4), ratio: +rr[Math.floor(rr.length / 2)].toFixed(3), p10p90: [+rr[Math.floor(rr.length * 0.1)].toFixed(3), +rr[Math.floor(rr.length * 0.9)].toFixed(3)], slopes: ols(GZ) };
  out.spray = {}; Object.keys(spr).forEach(function (k2) { var n = spr[k2].reduce(function (x, y) { return x + y; }, 0); out.spray[k2] = spr[k2].map(function (x) { return +(x / n).toFixed(4); }); });
  print(JSON.stringify(out, null, 1));
})(typeof arguments !== 'undefined' ? arguments : []);
