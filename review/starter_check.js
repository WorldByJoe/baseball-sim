/* ============================================================================
   starter_check.js · v0.1 · 2026-10-08

   The starting pitchers' check: does the model value starters as their real seasons do? Each playoff starter
   (review/pitchers_fit.json, role SP) starts N games in a neutral park (70 F, 500 ft) against lineups drawn fresh
   from the league's hitters, with a league-average defence and bullpen behind him and the model's manager deciding
   when he leaves (the series' settings: hook 0.42). From the games' plays: his outs a start, pitches a start,
   runs allowed per nine while he was on the mound (runs on his plays; inherited runners not reassigned), and his
   strikeout, walk and home-run rates. review/starter_check.py sets these beside his 2025-26 season.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/starter_check.js -- [games each] [seed] [part] [parts]
============================================================================ */
(function (A) {
  var N = +A[0] || 200, SEED = +A[1] || 5, PART = +A[2] || 0, PARTS = +A[3] || 1;
  var D = REVIEW.load(), F = JSON.parse(read('review/pitchers_fit.json')).pitchers, rng = BB.makeRng(SEED * 131 + PART);
  var env = BB.makeEnv({ tempF: 70, elevFt: 500 });
  var POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'], MGR = { hook: 0.42, warmAt: 0.2, ibb: 0.075, glove: 0.012 };
  function fresh(P) { P.load = 0; P.used = false; P.pitchesToday = 0; P.warm = 0; return P; }
  function lineup() { return POS.map(function (p) { var b = BB.makeBatter(rng, { pos: p }); b.pos = p; b.homePos = p; return b; }); }
  function pen() { var L = []; for (var i = 0; i < 7; i++) L.push(fresh(BB.makePitcher(rng, { role: 'RP' }))); return L; }
  function team(name, sp) { var p = pen(); return { city: name, nick: '', name: name, lineup: lineup(), bench: [], starter: fresh(sp), bullpen: p, closer: p[0], manager: MGR }; }
  var ids = Object.keys(F).filter(function (k) { return F[k].role === 'SP' && D.recs[k]; });
  ids.forEach(function (id, j) {
    if (j % PARTS !== PART) return;
    var P = REVIEW.pitcher(D.recs[id], rng, env), m = { g: 0, outs: 0, runs: 0, pitches: 0, bf: 0, k: 0, bb: 0, hr: 0, starts: [] };
    for (var g = 0; g < N; g++) {
      fresh(P);
      var mine = team('Mine', P), them = team('Them', fresh(BB.makePitcher(rng, { role: 'SP' })));
      var GM = BBGame.simGame(g % 2 ? mine : them, g % 2 ? them : mine, { rng: rng, env: env, rules: 'AL', ghost: false, maxInnings: 60 });
      var o = 0, r = 0, pc = 0;
      GM.plays.forEach(function (pl) {
        if (pl.pitcher !== P) return;
        o += (pl.outsAfter - pl.outs); r += pl.runs || 0; pc += (pl.pa && pl.pa.pitches ? pl.pa.pitches.length : 0); m.bf++;
        var res = pl.pa && pl.pa.result; if (res === 'K') m.k++; else if (res === 'BB' || res === 'IBB' || res === 'HBP') m.bb++; else if (res === 'HR') m.hr++;
      });
      m.g++; m.outs += o; m.runs += r; m.pitches += pc; m.starts.push(o);
    }
    var s = m.starts.slice().sort(function (a, b) { return a - b; });
    print(JSON.stringify({ id: +id, name: F[id].name, team: F[id].team, g: m.g, outsPerStart: m.outs / m.g, pitchesPerStart: m.pitches / m.g, ra9: 27 * m.runs / m.outs,
                           K: m.k / m.bf, BB: m.bb / m.bf, HR: m.hr / m.bf, medianOuts: s[Math.floor(s.length / 2)], deep6: s.filter(function (x) { return x >= 18; }).length / s.length }));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
