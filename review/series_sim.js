/* ============================================================================
   series_sim.js · v0.1 · 2026-10-08

   A best-of-seven series played many times before its first pitch (review/series_spec.py): each team's
   latest division series lineup, its four-man rotation in order (game k's starter is rotation[k mod 4]), its
   playoff bullpen run by the model's manager, games 1, 2, 6 and 7 in the park of the team with home field,
   postseason rules (the designated hitter, no runner on second in extra innings, no limit on innings). Each
   series draws every hitter's hidden traits once (one of the 40 posterior draws of review/fit_hitters.py,
   fixed for all its games, since a player is the same man all week), and each game rolls its own dice. With a
   league factor G (the sixth argument), every fielder makes errors at his own rate (review/err_mult.py).
   Prints one JSON line a series: the winner, the games it took, each game's score.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/series_sim.js -- SPEC [series] [seed] [part] [parts] [G]

   CHANGED
     v0.1  first build (Joe, 2026-10-08: the LCS and the World Series before Game 1)
============================================================================ */
(function (A) {
  var SPEC = A[0], N = +A[1] || 100, SEED = +A[2] || 1, PART = +A[3] || 0, PARTS = +A[4] || 1, GERR = A[5] ? +A[5] : 0;
  var S = JSON.parse(read(SPEC)), D = REVIEW.load(), rng = BB.makeRng(SEED * 7919 + PART * 31 + 17);
  var ERR = GERR ? JSON.parse(read('review/err_mult.json')).players : null;
  function errOf(id) { var e = ERR && ERR[id]; return ERR ? GERR * (e ? e.rel : 1) : undefined; }
  var envs = {};
  function envOf(t) {   // October nights: 60 F in an open park, 72 under a roof
    var V = S.teams[t].venue;
    if (!envs[t]) envs[t] = BB.makeEnv({ tempF: /dome|retract/i.test(V.roof || '') ? 72 : 60, elevFt: V.elevFt, fence: V.fence });
    return envs[t];
  }
  var built = {};
  function pitcher(id, park, asReliever) {   // built once a park (the aim depends on the air)
    var k = id + '@' + park;
    if (!built[k]) { built[k] = REVIEW.pitcher(D.recs[id], rng, envOf(park)); if (ERR) built[k].errMult = errOf(id); }
    var P = built[k];
    if (asReliever && P.role === 'SP') { P.role = 'RP'; P.stamina = 35; }
    return P;
  }
  function fresh(P) { P.load = 0; P.used = false; P.pitchesToday = 0; P.warm = 0; return P; }
  function team(t, park, draw, gameNo) {
    var T = S.teams[t];
    var lineup = T.lineup.map(function (m) { var h = REVIEW.hitter(D.fits[m.id], rng, draw, m.pos === 'DH' ? 'DH' : m.pos); h.pos = m.pos; h.homePos = m.pos; if (ERR) h.errMult = errOf(m.id); return h; });
    var spId = T.rotation[gameNo % T.rotation.length];
    var pen = Object.keys(D.recs).map(function (k) { return D.recs[k]; }).filter(function (r) {
      if (r.team !== t || r.kind === 'position' || r.id === spId || T.rotation.indexOf(r.id) >= 0) return false;
      return ((r.summaries.pitching && r.summaries.pitching.role || {}).role) === 'RP';
    }).map(function (r) { return fresh(pitcher(r.id, park, true)); });
    var saves = function (P) { var ss = (D.recs[P.mlbId].seasonStats || {}).pitching_2026 || {}; return ss.SV || 0; };
    var closer = pen.slice().sort(function (a, b) { return saves(b) - saves(a); })[0];
    return { city: t, nick: '', name: t, lineup: lineup, bench: [], starter: fresh(pitcher(spId, park, false)), bullpen: pen, closer: closer,
             manager: { hook: 0.42, warmAt: 0.2, ibb: 0.075, glove: 0.012 } };
  }
  for (var s = 0; s < N; s++) {
    if (s % PARTS !== PART) continue;
    var draw = {}; draw[S.hi] = Math.floor(rng.u() * 40); draw[S.lo] = Math.floor(rng.u() * 40);   // one man all week
    var wins = {}; wins[S.hi] = 0; wins[S.lo] = 0; var games = [];
    for (var g = 0; g < 7 && wins[S.hi] < 4 && wins[S.lo] < 4; g++) {
      var home = S.homeOf[g] === 'hi' ? S.hi : S.lo, away = home === S.hi ? S.lo : S.hi;
      var GM = BBGame.simGame(team(away, home, draw[away], g), team(home, home, draw[home], g), { rng: rng, env: envOf(home), rules: 'AL', ghost: false, maxInnings: 60 });
      var w = GM.score[1] > GM.score[0] ? home : away; wins[w]++;
      games.push([away, GM.score[0], home, GM.score[1], GM.finalInning]);
    }
    print(JSON.stringify({ s: s, winner: wins[S.hi] === 4 ? S.hi : S.lo, games: games.length, wins: wins, played: games }));
  }
})(typeof arguments !== 'undefined' ? arguments : []);
