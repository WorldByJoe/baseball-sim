/* ============================================================================
   check_contact.js · v0.3 · 2026-10-08

   The pitchers' contact check: each built pitcher (review/players.js) faces the league's hitters, fresh, and the
   contact he allows is measured as Statcast measures it: the share of balls in play hit 95 mph or harder, the
   share on the ground (launch under 10 degrees), the mean exit speed and launch angle, and home runs a plate
   appearance; with his strikeout and walk rates (the two his traits are fitted to) for reference. Set beside the
   same measures from his own Statcast pitches (review/contact_check.py), it asks whether the model tells a
   pitcher who allows weak contact from one who allows hard contact, which nothing in his fit asks of it.

   v0.2: each ball in play also split as review/weak_contact.py splits the real ones: bat speed at contact, squareness
   (exit speed over 1.23 bat speed + 0.23 pitch speed), the vertical miss of the ball's centre (D) and the miss along
   the barrel (dLong), in inches.

   v0.3: [mishit x] [deception x] multiply each pitcher's (the fit's slopes); teams 'LEAGUE' plays the league's own
   generated pitchers instead (the model's league reference, as review/fit_pitchers.js takes it).

   Run:  tools/diag/run.sh bb_engine.js review/players.js review/check_contact.js -- [PA each] [seed] [teams, comma-separated] [mishit x] [deception x]
============================================================================ */
(function (A) {
  var NPA = +A[0] || 2000, SEED = +A[1] || 3, TEAMS = (A[2] || 'NYY,TB').split(','), MX = +A[3] || 1, DX = +A[4] || 1;
  var D = REVIEW.load(), rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), H = [];
  for (var i = 0; i < 200; i++) H.push(BB.makeBatter(rng, {}));
  var list = TEAMS[0] === 'LEAGUE' ? Array.apply(null, Array(120)).map(function (_, i) { return { id: -1 - i, gen: i } }) : Object.keys(D.recs).filter(function (id) {
    var r = D.recs[id]; return TEAMS.indexOf(r.team) >= 0 && r.kind !== 'position' && r.summaries.pitching; }).map(function (id) { return { id: id }; });
  list.forEach(function (L) {
    var id = L.id, r = L.gen !== undefined ? { name: 'league ' + L.gen, team: 'LEAGUE' } : D.recs[id];
    var P = L.gen !== undefined ? BB.makePitcher(rng, { role: L.gen % 12 < 7 ? 'SP' : 'RP' }) : REVIEW.pitcher(r, rng, env), m = { pa: 0, k: 0, bb: 0, hr: 0, bip: 0, hard: 0, gb: 0, ev: 0, la: 0, bs: 0, sq: 0, sqd: 0, D: 0, dL: 0, Dabs: 0, dLabs: 0 };
    P.mishit = (P.mishit || 1) * MX; P.deception = (P.deception || 1) * DX;
    for (var k = 0; k < NPA; k++) {
      var B = H[Math.floor(rng.u() * H.length)]; P.load = rng.u() * 0.8 * P.stamina;
      var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      if (res.result === 'END') continue;
      m.pa++; if (res.result === 'K') m.k++; else if (res.result === 'BB') m.bb++; else if (res.result === 'HR') m.hr++;
      if ((res.result === 'BIP' || res.result === 'HR') && res.bb && !res.foulCaught) {
        m.bip++; m.ev += res.bb.ev; m.la += res.bb.la; if (res.bb.ev >= 95) m.hard++; if (res.bb.la < 10) m.gb++;
        var q = res.pitches[res.pitches.length - 1], sw = q.swing, v = q.pitch.plate.v, ps = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) / BB.units.MPH;
        var bs = (sw.batAt || sw.batMph), sq = res.bb.ev / (1.23 * bs + 0.23 * ps);
        m.bs += bs; m.sq += sq; if (sq >= 0.8) m.sqd++; m.D += sw.D / BB.units.IN; m.Dabs += Math.abs(sw.D) / BB.units.IN; m.dL += sw.dLong / BB.units.IN; m.dLabs += Math.abs(sw.dLong) / BB.units.IN;
      }
    }
    print(JSON.stringify({ id: +id, name: r.name, team: r.team, role: P.role, pa: m.pa, K: m.k / m.pa, BB: m.bb / m.pa, HR: m.hr / m.pa, bip: m.bip,
                           hard: m.hard / m.bip, gb: m.gb / m.bip, ev: m.ev / m.bip, la: m.la / m.bip,
                           bs: m.bs / m.bip, sq: m.sq / m.bip, sqd: m.sqd / m.bip, D: m.D / m.bip, Dabs: m.Dabs / m.bip, dL: m.dL / m.bip, dLabs: m.dLabs / m.bip }));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
