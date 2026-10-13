/* ============================================================================
   carry_check.js · v0.1 · 2026-10-13

   How the engine's balls in the air carry, by exit speed and launch angle: the model's hitters against its pitchers in
   MLB's parks and weather (BB.mlbEnv), every ball in play's speed, angle, total spin, backspin, distance (projected for a
   home run, as Statcast's hit distance is) and whether it left the park. For season/runs_audit.py's finding (2026-10-13):
   at 100-105 mph and 30-35 deg the engine's balls landed 380 ft out against the real 393 and left the park .38 of the
   time against .64, while liners at 15-20 deg carried 20 ft too far.

   Run:  tools/diag/run.sh bb_engine.js review/carry_check.js -- [PA] [seed] > out.jsonl
   CHANGED
     v0.1  first build (Joe, 2026-10-13: work on where the runs go missing, flight first)
============================================================================ */
(function (A) {
  var NPA = +A[0] || 20000, SEED = +A[1] || 1;
  var rng = BB.makeRng(SEED), H = [], P = [];
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 80; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var ump = BB.makeUmp(rng), out = [];
  for (var k = 0; k < NPA; k++) {
    var B = H[k % H.length], Pk = P[(k * 7) % P.length], env = BB.mlbEnv(rng);
    Pk.load = rng.u() * 0.8 * Pk.stamina;
    var res = BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
    var bb = res.bb;
    if (bb && bb.fair !== false) out.push([+bb.ev.toFixed(1), +bb.la.toFixed(1), Math.round(bb.spin), Math.round(bb.backspin), Math.round(bb.projDist), bb.hr ? 1 : 0, Math.round(env.elevFt), Math.round(env.tempF)]);
  }
  out.forEach(function (r) { print(JSON.stringify(r)); });
})(typeof arguments !== 'undefined' ? arguments : []);
