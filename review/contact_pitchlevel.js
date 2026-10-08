/* ============================================================================
   contact_pitchlevel.js · v0.1 · 2026-10-08

   The model's balls in play, one line each, for the same pitch-level regression review/weak_contact_why.py runs
   on the real ones: each playoff pitcher (review/players.js) against the league's hitters; the pitch's kind,
   its place against the batter's zone (xn: out over the plate's half-width plus a ball, positive away from him;
   zn: from the zone's middle over its half-height), the count, the hands, and the contact's squareness (exit speed
   over 1.23 bat speed + 0.23 pitch speed), with the batter's index for a batter control.

   Run:  tools/diag/run.sh bb_engine.js review/players.js review/contact_pitchlevel.js -- [PA each] [seed] [teams]
============================================================================ */
(function (A) {
  var NPA = +A[0] || 600, SEED = +A[1] || 3, TEAMS = (A[2] || 'NYY,TB').split(','), IN = BB.units.IN, MPH = BB.units.MPH;
  var D = REVIEW.load(), rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), H = [];
  for (var i = 0; i < 200; i++) H.push(BB.makeBatter(rng, {}));
  Object.keys(D.recs).forEach(function (id) {
    var r = D.recs[id];
    if (TEAMS.indexOf(r.team) < 0 || r.kind === 'position' || !r.summaries.pitching) return;
    var P = REVIEW.pitcher(r, rng, env);
    for (var k = 0; k < NPA; k++) {
      var bi = Math.floor(rng.u() * H.length), B = H[bi]; P.load = rng.u() * 0.8 * P.stamina;
      var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      if (!((res.result === 'BIP' || res.result === 'HR') && res.bb && !res.foulCaught)) continue;
      var q = res.pitches[res.pitches.length - 1], sw = q.swing, pl = q.pitch.plate, v = pl.v, ps = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) / MPH;
      var bs = sw.batAt || sw.batMph, mid = (B.zone.top + B.zone.bot) / 2, half = (B.zone.top - B.zone.bot) / 2;
      print(JSON.stringify({ pid: +id, b: bi, kind: BB.PITCH_TYPES[q.pitch.type].kind, xn: +(-pl.x * q.side / (9.96 * IN)).toFixed(3), zn: +((pl.z - mid) / half).toFixed(3),
        balls: +q.count[0], strikes: +q.count[2], same: (B.hand || B.bats) === (P.hand || P.throws) ? 1 : 0, sq: +(res.bb.ev / (1.23 * bs + 0.23 * ps)).toFixed(4),
        ev: +res.bb.ev.toFixed(1), bs: +bs.toFixed(1), D: +(sw.D / IN).toFixed(2), dL: +(sw.dLong / IN).toFixed(2) }));
    }
  });
})(typeof arguments !== 'undefined' ? arguments : []);
