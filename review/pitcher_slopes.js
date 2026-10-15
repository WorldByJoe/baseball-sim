/* pitcher_slopes.js · v0.1 · 2026-10-14: how a pitcher's strikeout and walk log-odds move with log deception and log command
   scale in the engine (finite differences over model pitchers), for the uncertainty of review/fit_pitchers.js's point fits
   (review/pitcher_sd.py; the model review). */
(function (A) {
  var NP = +A[0] || 30, NPA = +A[1] || 3000, rng = BB.makeRng(+A[2] || 11), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), H = [];
  for (var i = 0; i < 200; i++) H.push(BB.makeBatter(rng, {}));
  function lg(p) { p = Math.min(0.999, Math.max(0.001, p)); return Math.log(p / (1 - p)); }
  function rates(P) { var k = 0, b = 0; for (var j = 0; j < NPA; j++) { var B = H[Math.floor(rng.u() * H.length)]; P.load = rng.u() * 0.8 * P.stamina;
      var r = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng); if (r.result === 'K') k++; else if (r.result === 'BB') b++; } return [k / NPA, b / NPA]; }
  var sK = 0, sB = 0, sKc = 0, sBd = 0, F = 1.25;
  for (i = 0; i < NP; i++) {
    var P = BB.makePitcher(rng, { role: i % 2 ? 'SP' : 'RP' }), c0 = P.cmd.slice();
    P.deception = 1 / F; var a = rates(P); P.deception = F; var b = rates(P); P.deception = 1;
    sK += (lg(b[0]) - lg(a[0])) / (2 * Math.log(F)) / NP; sBd += (lg(b[1]) - lg(a[1])) / (2 * Math.log(F)) / NP;
    P.cmd = [c0[0] / F, c0[1] / F]; a = rates(P); P.cmd = [c0[0] * F, c0[1] * F]; b = rates(P);
    sB += (lg(b[1]) - lg(a[1])) / (2 * Math.log(F)) / NP; sKc += (lg(b[0]) - lg(a[0])) / (2 * Math.log(F)) / NP;
  }
  print(JSON.stringify({ dK_dLogDec: +sK.toFixed(3), dBB_dLogDec: +sBd.toFixed(3), dBB_dLogCmd: +sB.toFixed(3), dK_dLogCmd: +sKc.toFixed(3), pitchers: NP, pa: NPA }));
})(typeof arguments !== 'undefined' ? arguments : []);
