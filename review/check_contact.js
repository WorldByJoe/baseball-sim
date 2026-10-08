/* ============================================================================
   check_contact.js · v0.1 · 2026-10-08

   The pitchers' contact check: each built pitcher (review/players.js) faces the league's hitters, fresh, and the
   contact he allows is measured as Statcast measures it: the share of balls in play hit 95 mph or harder, the
   share on the ground (launch under 10 degrees), the mean exit speed and launch angle, and home runs a plate
   appearance; with his strikeout and walk rates (the two his traits are fitted to) for reference. Set beside the
   same measures from his own Statcast pitches (review/contact_check.py), it asks whether the model tells a
   pitcher who allows weak contact from one who allows hard contact, which nothing in his fit asks of it.

   Run:  tools/diag/run.sh bb_engine.js review/players.js review/check_contact.js -- [PA each] [seed] [teams, comma-separated]
============================================================================ */
(function (A) {
  var NPA = +A[0] || 2000, SEED = +A[1] || 3, TEAMS = (A[2] || 'NYY,TB').split(',');
  var D = REVIEW.load(), rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), H = [];
  for (var i = 0; i < 200; i++) H.push(BB.makeBatter(rng, {}));
  Object.keys(D.recs).forEach(function (id) {
    var r = D.recs[id];
    if (TEAMS.indexOf(r.team) < 0 || r.kind === 'position' || !r.summaries.pitching) return;
    var P = REVIEW.pitcher(r, rng, env), m = { pa: 0, k: 0, bb: 0, hr: 0, bip: 0, hard: 0, gb: 0, ev: 0, la: 0 };
    for (var k = 0; k < NPA; k++) {
      var B = H[Math.floor(rng.u() * H.length)]; P.load = rng.u() * 0.8 * P.stamina;
      var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      if (res.result === 'END') continue;
      m.pa++; if (res.result === 'K') m.k++; else if (res.result === 'BB') m.bb++; else if (res.result === 'HR') m.hr++;
      if ((res.result === 'BIP' || res.result === 'HR') && res.bb && !res.foulCaught) {
        m.bip++; m.ev += res.bb.ev; m.la += res.bb.la; if (res.bb.ev >= 95) m.hard++; if (res.bb.la < 10) m.gb++;
      }
    }
    print(JSON.stringify({ id: +id, name: r.name, team: r.team, role: P.role, pa: m.pa, K: m.k / m.pa, BB: m.bb / m.pa, HR: m.hr / m.pa, bip: m.bip,
                           hard: m.hard / m.bip, gb: m.gb / m.bip, ev: m.ev / m.bip, la: m.la / m.bip }));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
