/* ============================================================================
   fit_pitchers.js · v0.1 · 2026-10-06

   Each playoff pitcher's two hidden traits: DECEPTION (scales how noisy the
   batter's read of his pitches is, bb_engine readFactors) and a COMMAND scale
   (his measured location scatter holds his deliberate spread of targets as
   well as his misses, so it overstates the miss; the scale finds the miss).
   Fitted so that against the league's hitters his strikeout and walk rates
   stand to the model's league as his measured ones stand to the real league
   (in log-odds), not to his absolute rates: the hitters' fit already carries
   the model's league-wide shortfall of strikeouts, and fitting the pitchers to
   theirs too would count it twice in every matchup.

   Writes review/pitchers_fit.json: per pitcher, deception, cmdScale, and the
   fitted against targeted rates.

   Run:  tools/diag/run.sh bb_engine.js review/players.js review/fit_pitchers.js -- [PA an evaluation] [seed] [teams, comma-separated] [part] [parts] > out.json

   CHANGED
     v0.1  first build (the Yankees-Rays review)
============================================================================ */
(function (A) {
  var NPA = +A[0] || 1500, SEED = +A[1] || 5, TEAMS = A[2] ? A[2].split(',') : null, PART = +A[3] || 0, PARTS = +A[4] || 1, IN = BB.units.IN;
  var D = REVIEW.load(), rng = BB.makeRng(SEED), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), H = [];
  for (var i = 0; i < 200; i++) H.push(BB.makeBatter(rng, {}));
  function logit(p) { p = Math.min(0.999, Math.max(0.001, p)); return Math.log(p / (1 - p)); }
  function rates(P, n) {
    var m = { pa: 0, k: 0, bb: 0, out: 0, osw: 0 };
    for (var k = 0; k < n; k++) {
      var B = H[Math.floor(rng.u() * H.length)]; P.load = rng.u() * 0.8 * P.stamina;
      var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      m.pa++; if (res.result === 'K') m.k++; else if (res.result === 'BB') m.bb++;
      res.pitches.forEach(function (q) { if (!q.decide) return; var x = Math.abs(q.pitch.plate.x), z = q.pitch.plate.z;
        if (x > (8.5 + 1.45) * IN || z < B.zone.bot - 1.45 * IN || z > B.zone.top + 1.45 * IN) { m.out++; if (q.decide.swing) m.osw++; } });
    }
    return { K: m.k / m.pa, BB: m.bb / m.pa, chase: m.osw / m.out };
  }
  // the model's league: its own pitchers against the same hitters
  var Lk = 0, Lb = 0, Lc = 0, NL = 60;
  for (i = 0; i < NL; i++) { var r0 = rates(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }), 300); Lk += r0.K / NL; Lb += r0.BB / NL; Lc += r0.chase / NL; }
  var REAL = { K: 0.222, BB: 0.084, chase: 0.283 };   // the 2025 league (CALIBRATION's targets)
  var out = { league: { model: { K: Lk, BB: Lb, chase: Lc }, real: REAL }, pitchers: {} };
  Object.keys(D.recs).sort().forEach(function (id, n) {
    var r = D.recs[id], S = r.summaries.pitching;
    if (r.kind === 'position' || !S || (TEAMS && TEAMS.indexOf(r.team) < 0)) return;
    if (n % PARTS !== PART) return;
    var pm = function (o) { return o && o.pooled ? o.pooled.mean : null; }, km = pm(S.K_pct), bm = pm(S.BB_pct);
    if (km === null || bm === null) return;
    var tK = logit(Lk) + logit(km) - logit(REAL.K), tB = logit(Lb) + logit(bm) - logit(REAL.BB);
    var P = REVIEW.pitcher(r, rng, env), cmd0 = P.cmd.slice(), d = 1, c = 0.9, cur = null;
    function set() { P.deception = d; P.cmd = [cmd0[0] * c, cmd0[1] * c]; }
    // bisection in log space, two rounds: deception for the strikeouts (rising with it), then the command scale
    // for the walks (rising with it); each holds the other where it last landed
    for (var round = 0; round < 2; round++) {
      var lo = Math.log(0.4), hi = Math.log(3.2);
      for (var b1 = 0; b1 < 9; b1++) { d = Math.exp((lo + hi) / 2); set(); if (logit(rates(P, NPA).K) < tK) lo = Math.log(d); else hi = Math.log(d); }
      d = Math.exp((lo + hi) / 2);
      lo = Math.log(0.4); hi = Math.log(1.8);
      for (var b2 = 0; b2 < 9; b2++) { c = Math.exp((lo + hi) / 2); set(); if (logit(rates(P, NPA).BB) < tB) lo = Math.log(c); else hi = Math.log(c); }
      c = Math.exp((lo + hi) / 2);
    }
    P.deception = d; P.cmd = [cmd0[0] * c, cmd0[1] * c]; cur = rates(P, NPA * 2);
    out.pitchers[id] = { name: r.name, team: r.team, role: P.role, deception: +d.toFixed(3), cmdScale: +c.toFixed(3),
                         K: +cur.K.toFixed(3), BB: +cur.BB.toFixed(3), chase: +cur.chase.toFixed(3),
                         targetK: +(1 / (1 + Math.exp(-tK))).toFixed(3), targetBB: +(1 / (1 + Math.exp(-tB))).toFixed(3), measuredK: km, measuredBB: bm, measuredChase: pm(S.chaseRate) };
  });
  print(JSON.stringify(out, null, 1));
})(typeof arguments !== 'undefined' ? arguments : []);
