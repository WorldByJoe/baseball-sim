/* ============================================================================
   pregame.js · v0.2 · 2026-10-08

   Who should have won: one postseason game played many times before its
   first pitch, with the real lineups in their real order and positions, the
   real starters, and each bullpen (the relievers on the playoff roster, plus
   any starter who pitched in relief that day, as a reliever; the closer is
   the club's saves leader), in the real park, under postseason rules (the
   designated hitter, no runner on second in extra innings). Each replay
   takes a fresh draw of every hitter's hidden traits (review/fit_hitters.py),
   so the spread holds what we do not know about the players as well as the
   dice. Prints one JSON line a replay: the score and the innings.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/pregame.js -- PK [games] [seed] [part] [parts] [awaySP] [homeSP] [venue] [swap] [boost id:TYPE:mph,...] [G]

   The last three arguments set up a game not yet played (the series
   outlook): the starters' MLB ids ('-' to keep the game's) and the park,
   and 'swap' when the series changes parks; the lineups are the game PK's.

   With a league factor G (the eleventh argument), every fielder makes errors at his own rate (review/err_mult.py),
   as in the replays' and the series' errors mode.

   CHANGED
     v0.2  the errors mode (G); no 18-inning stop (the postseason has none); each game's errors printed
     v0.1  first build (the Yankees-Rays review, 2026-10-06)
============================================================================ */
(function (A) {
  var PK = A[0], N = +A[1] || 200, SEED = +A[2] || 1, PART = +A[3] || 0, PARTS = +A[4] || 1;
  var SWAP = A[8] === 'swap', SP_NEW = { away: A[5] && A[5] !== '-' ? +A[5] : null, home: A[6] && A[6] !== '-' ? +A[6] : null }, VENUE = A[7] || null;
  // the source game's sides as they stand in the game played: swapped when the series changes parks
  var SP_OVR = SWAP ? { away: SP_NEW.home, home: SP_NEW.away } : SP_NEW;
  var G = JSON.parse(read('review/games/' + PK + '.json')), D = REVIEW.load(), rng = BB.makeRng(SEED * 977 + PART);
  var venues = JSON.parse(read('playoffs/venues.json')); venues = venues.venues || venues;
  var vlist = Array.isArray(venues) ? venues : Object.keys(venues).map(function (k) { return venues[k]; });
  var V = vlist.filter(function (v) { return v.name === (VENUE || G.venue); })[0];
  var dome = V && /dome|retract/i.test(V.roof || '');
  var env = BB.makeEnv({ tempF: dome ? 72 : (VENUE ? 60 : (G.weather && +G.weather.temp) || 70), elevFt: V ? V.elevFt : 0, fence: V ? V.fence : undefined });
  var R = JSON.parse(read('playoffs/rosters.json')), abbrev = {};
  (Array.isArray(R.teams) ? R.teams : Object.keys(R.teams).map(function (k) { return R.teams[k]; })).forEach(function (t) { abbrev[t.id] = t.abbrev; });
  // BOOST: pitch speeds as a pitcher showed them that day, 'id:TYPE:mph,...' (a counterfactual: the pitcher who turned up)
  var GERR = A[10] ? +A[10] : 0, ERR = GERR ? JSON.parse(read('review/err_mult.json')).players : null;
  function errOf(id) { var e = ERR && ERR[id]; return GERR * (e ? e.rel : 1); }
  var BOOST = {};
  (A[9] || '').split(',').forEach(function (b) { var f = b.split(':'); if (f.length === 3) (BOOST[+f[0]] = BOOST[+f[0]] || {})[f[1]] = +f[2]; });
  var built = {};
  function pitcher(id, asReliever) {
    if (!built[id]) { built[id] = REVIEW.pitcher(D.recs[id], rng, env); if (ERR) built[id].errMult = errOf(id); if (BOOST[id]) built[id].pitches.forEach(function (q) { if (BOOST[id][q.type]) { q.velo = BOOST[id][q.type]; q.aimCache = { ok: false }; } }); built[id].bat = BB.makeBatter(rng, { pitcher: true, pos: 'P' }); built[id].bat.name = built[id].name; built[id].bat.id = built[id].id; }
    var P = built[id];
    if (asReliever && P.role === 'SP') { P.role = 'RP'; P.stamina = 35; }
    return P;
  }
  function fresh(P) { P.load = 0; P.used = false; P.pitchesToday = 0; P.warm = 0; return P; }
  function team(s, draw) {
    var T = G.teams[s], ab = T.abbrev || abbrev[T.id];
    var starters = G.lineups[s].filter(function (p) { return p.order % 100 === 0; });
    var lineup = starters.map(function (p) { var h = REVIEW.hitter(D.fits[p.id], rng, draw, p.pos === 'DH' ? 'DH' : p.pos); h.pos = p.pos; h.homePos = p.pos; if (ERR) h.errMult = errOf(p.id); return h; });
    var ids = {}; starters.forEach(function (p) { ids[p.id] = 1; });
    var bench = Object.keys(D.recs).map(function (k) { return D.recs[k]; }).filter(function (r) { return r.team === ab && r.kind !== 'pitcher' && !ids[r.id] && D.fits[r.id]; })
      .map(function (r) { var h = REVIEW.hitter(D.fits[r.id], rng, draw, r.position === 'DH' ? 'DH' : r.position); h.benchPos = r.position; h.pos = r.position; if (ERR) h.errMult = errOf(r.id); return h; });
    var spId = SP_OVR[s] || G.pitchers[s][0], relieved = SP_OVR[s] ? [] : G.pitchers[s].slice(1);
    var pen = Object.keys(D.recs).map(function (k) { return D.recs[k]; }).filter(function (r) {
      if (r.team !== ab || r.kind === 'position' || r.id === spId) return false;
      var role = (r.summaries.pitching && r.summaries.pitching.role || {}).role;
      return role === 'RP' || relieved.indexOf(r.id) >= 0;
    }).map(function (r) { return fresh(pitcher(r.id, true)); });
    var saves = function (P) { var ss = (D.recs[P.mlbId].seasonStats || {}).pitching_2026 || {}; return ss.SV || 0; };
    var closer = pen.slice().sort(function (a, b) { return saves(b) - saves(a); })[0];
    return { city: T.name, nick: '', name: T.name, lineup: lineup, bench: bench, starter: fresh(pitcher(spId, false)), bullpen: pen, closer: closer,
             manager: { hook: 0.42, warmAt: 0.2, ibb: 0.075, glove: 0.012 } };
  }
  for (var g = 0; g < N; g++) {
    if (g % PARTS !== PART) continue;
    var draw = g % 40, ta = team('away', draw), th = team('home', (g * 7 + 3) % 40), A0 = SWAP ? th : ta, H0 = SWAP ? ta : th;
    var GM = BBGame.simGame(A0, H0, { rng: rng, env: env, rules: 'AL', ghost: false, maxInnings: 60 });
    print(JSON.stringify({ g: g, away: A0.name, home: H0.name, score: GM.score, innings: GM.finalInning, hits: GM.hits, errors: GM.errors, pitchers: GM.pitchersUsed }));
  }
})(typeof arguments !== 'undefined' ? arguments : []);
