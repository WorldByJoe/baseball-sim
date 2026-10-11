/* ============================================================================
   game_predict.js · v0.1 · 2026-10-10

   One game of a series, played many times before its first pitch: the series' teams as review/series_spec.py sets
   them (each team's latest lineup, every man at the position he started; its bullpen run by the model's manager,
   rested), the game's park from the series' home pattern, and the two starters named on the command line (MLB's
   probables, or the rotation's next man; review/predict_next.py chooses). Each game draws every hitter's traits
   afresh (one of the 40 posterior draws), so the spread holds what is not known about the players. With a league
   factor G, every fielder makes errors at his own rate (review/err_mult.py), as in the replays' errors set.
   Prints one line a game, as review/pregame.js does: the score, the innings, the errors.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/game_predict.js -- SPEC GAME_INDEX AWAY_SP HOME_SP [games] [seed] [part] [parts] [G]

   CHANGED
     v0.1  first build (Joe, 2026-10-10: pregame prediction cards for the championship series)
============================================================================ */
(function (A) {
  var SPEC = A[0], K = +A[1] || 0, ASP = +A[2], HSP = +A[3], N = +A[4] || 1000, SEED = +A[5] || 1, PART = +A[6] || 0, PARTS = +A[7] || 1, GERR = A[8] ? +A[8] : 0;
  var S = JSON.parse(read(SPEC)), D = REVIEW.load(), rng = BB.makeRng(SEED * 7919 + PART * 31 + 23 + K);
  var ERR = GERR ? JSON.parse(read('review/err_mult.json')).players : null;
  function errOf(id) { var e = ERR && ERR[id]; return GERR * (e ? e.rel : 1); }
  var home = S.homeOf[K] === 'hi' ? S.hi : S.lo, away = home === S.hi ? S.lo : S.hi, SP = {}; SP[away] = ASP; SP[home] = HSP;
  var V = S.teams[home].venue;
  var env = BB.makeEnv({ tempF: /dome|retract/i.test(V.roof || '') ? 72 : 60, elevFt: V.elevFt, fence: V.fence });   // October nights: 60 F open, 72 under a roof
  var built = {};
  function pitcher(id, asReliever) {
    if (!built[id]) { built[id] = REVIEW.pitcher(D.recs[id], rng, env); if (ERR) built[id].errMult = errOf(id); }
    var P = built[id];
    if (asReliever && P.role === 'SP') { P.role = 'RP'; P.stamina = 35; }
    return P;
  }
  function fresh(P) { P.load = 0; P.used = false; P.pitchesToday = 0; P.warm = 0; return P; }
  function team(t, draw) {
    var T = S.teams[t], spId = SP[t];
    var lineup = T.lineup.map(function (m) { var h = REVIEW.hitter(D.fits[m.id], rng, draw, m.pos === 'DH' ? 'DH' : m.pos); h.pos = m.pos; h.homePos = m.pos; if (ERR) h.errMult = errOf(m.id); return h; });
    var pen = Object.keys(D.recs).map(function (k) { return D.recs[k]; }).filter(function (r) {
      if (r.team !== t || r.kind === 'position' || r.id === spId || T.rotation.indexOf(r.id) >= 0) return false;
      return ((r.summaries.pitching && r.summaries.pitching.role || {}).role) === 'RP';
    }).map(function (r) { return fresh(pitcher(r.id, true)); });
    var saves = function (P) { var ss = (D.recs[P.mlbId].seasonStats || {}).pitching_2026 || {}; return ss.SV || 0; };
    var closer = pen.slice().sort(function (a, b) { return saves(b) - saves(a); })[0];
    return { city: t, nick: '', name: t, lineup: lineup, bench: [], starter: fresh(pitcher(spId, false)), bullpen: pen, closer: closer,
             manager: { hook: 0.42, warmAt: 0.2, ibb: 0.075, glove: 0.012 } };
  }
  for (var g = 0; g < N; g++) {
    if (g % PARTS !== PART) continue;
    Object.keys(built).forEach(function (k) { fresh(built[k]); });
    var GM = BBGame.simGame(team(away, g % 40), team(home, (g * 7 + 3) % 40), { rng: rng, env: env, rules: 'AL', ghost: false, maxInnings: 60 });
    print(JSON.stringify({ g: g, away: away, home: home, score: GM.score, innings: GM.finalInning, errors: GM.errors }));
  }
})(typeof arguments !== 'undefined' ? arguments : []);
