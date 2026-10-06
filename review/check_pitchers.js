/* ============================================================================
   check_pitchers.js · v0.1 · 2026-10-06

   The pitchers' check: each built pitcher (review/players.js) faces the
   league's hitters, fresh, and his strikeout, walk and home-run rates and
   chase are set beside his measured ones.

   Run:  tools/diag/run.sh bb_engine.js review/players.js review/check_pitchers.js -- [PA each] [seed] [teams, comma-separated]
============================================================================ */
(function (A) {
  var NPA = +A[0] || 2000, SEED = +A[1] || 3, TEAMS = (A[2] || 'NYY,TB').split(','), IN = BB.units.IN;
  var D = REVIEW.load(), rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), H = [];
  for (var i = 0; i < 200; i++) H.push(BB.makeBatter(rng, {}));
  Object.keys(D.recs).forEach(function (id) {
    var r = D.recs[id];
    if (TEAMS.indexOf(r.team) < 0 || r.kind === 'position' || !r.summaries.pitching) return;
    var P = REVIEW.pitcher(r, rng, env), m = { pa: 0, k: 0, bb: 0, hr: 0, out: 0, osw: 0 };
    for (var k = 0; k < NPA; k++) {
      var B = H[Math.floor(rng.u() * H.length)]; P.load = rng.u() * 0.8 * P.stamina;
      var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      m.pa++; if (res.result === 'K') m.k++; else if (res.result === 'BB') m.bb++; else if (res.result === 'HR') m.hr++;
      res.pitches.forEach(function (q) { if (!q.decide) return; var x = Math.abs(q.pitch.plate.x), z = q.pitch.plate.z;
        if (x > (8.5 + 1.45) * IN || z < B.zone.bot - 1.45 * IN || z > B.zone.top + 1.45 * IN) { m.out++; if (q.decide.swing) m.osw++; } });
    }
    var S = r.summaries.pitching, pm = function (o) { return o && o.pooled ? o.pooled.mean : null; };
    print(JSON.stringify({ name: r.name, team: r.team, role: P.role, K: m.k / m.pa, Km: pm(S.K_pct), BB: m.bb / m.pa, BBm: pm(S.BB_pct), HR: m.hr / m.pa, chase: m.osw / m.out, chasem: pm(S.chaseRate) }));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
