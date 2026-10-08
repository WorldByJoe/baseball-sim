/* ============================================================================
   replay_game.js · v0.2 · 2026-10-07

   A postseason game played again as it was played: the real batting order with
   its substitutions (each man takes his spot at the turn he took it, at the
   position of the man he replaced), the real pitchers in their real order, each
   facing as many batters as he faced, in the real park under postseason rules
   (the designated hitter, no runner on second in extra innings). A replay that
   runs longer than the game did goes back to the manager and the rest of the
   playoff pen (bb_game v1.7's plan). Each replay takes a fresh draw of every
   hitter's hidden traits (review/fit_hitters.py), so the spread holds what we
   do not know about the players as well as the dice. Prints one JSON line a
   replay: the score and the innings.

   A planned pitcher's stamina is at least the pitches he threw that day over 0.85, so the plan's workload leaves him
   only lightly tired, as the real one did; a reliever's usual 35 would wear down a long man past what he showed.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- PK [games] [seed] [part] [parts] [pitched]

   'pitched': each pitcher at his game-day speeds and mix (review/as_pitched.py); without it, his regular season.

   CHANGED
     v0.2  mode 'pitched': the pitchers as they pitched that day (Joe, 2026-10-07); no tie at the 18th
     v0.1  first build (the division series score grids, 2026-10-07)
============================================================================ */
(function (A) {
  var PK = A[0], N = +A[1] || 200, SEED = +A[2] || 1, PART = +A[3] || 0, PARTS = +A[4] || 1, PITCHED = A[5] === 'pitched';
  // AS PITCHED (mode 'pitched'): each man in the plan throws his game-day speed for every type he threw 3+ times
  // (his season speed plus that day's change, review/as_pitched.py) and his game-day mix; the batter's scouting report
  // keeps his season mix (scoutUsage), since nobody knew that day's mix before it was thrown
  var ASP = PITCHED ? JSON.parse(read('review/as_pitched/' + PK + '.json')) : null, TMAP = { CS: 'CU', KC: 'CU', SV: 'SL', FO: 'FS', SC: 'CH' };
  function asPitched(id, P) {
    var a = ASP && ASP[id]; if (!a || P.asPitched) return; P.asPitched = true;
    var share = {}, dv = {};
    Object.keys(a.types).forEach(function (t0) { var t = TMAP[t0] || t0, r = a.types[t0]; share[t] = (share[t] || 0) + r.share; if (r.dv !== undefined && dv[t] === undefined) dv[t] = r.dv; });
    var tot = 0; P.pitches.forEach(function (q) { tot += share[q.type] || 0; });
    P.pitches.forEach(function (q) {
      if (dv[q.type] !== undefined) { q.velo += dv[q.type]; q.aimCache = { ok: false }; }
      q.scoutUsage = q.usage;
      if (tot > 0) q.usage = (share[q.type] || 0) / tot;
    });
  }
  var G = JSON.parse(read('review/games/' + PK + '.json')), D = REVIEW.load(), rng = BB.makeRng(SEED * 977 + PART);
  var venues = JSON.parse(read('playoffs/venues.json')); venues = venues.venues || venues;
  var vlist = Array.isArray(venues) ? venues : Object.keys(venues).map(function (k) { return venues[k]; });
  var V = vlist.filter(function (v) { return v.name === G.venue; })[0];
  var dome = V && /dome|retract/i.test(V.roof || '');
  var env = BB.makeEnv({ tempF: dome ? 72 : (G.weather && +G.weather.temp) || 70, elevFt: V ? V.elevFt : 0, fence: V ? V.fence : undefined });
  var R = JSON.parse(read('playoffs/rosters.json')), abbrev = {};
  (Array.isArray(R.teams) ? R.teams : Object.keys(R.teams).map(function (k) { return R.teams[k]; })).forEach(function (t) { abbrev[t.id] = t.abbrev; });
  // who batted in each spot, in order, and the turn at which each man took it; how many batters each pitcher faced
  var defOf = { away: 'home', home: 'away' }, faced = { away: {}, home: {} };
  var thrown = {};   // pitches each man threw that day: his stamina is at least what carried him through them
  G.pas.forEach(function (pa) { var s = defOf[pa.bat]; faced[s][pa.pitcher] = (faced[s][pa.pitcher] || 0) + 1; thrown[pa.pitcher] = (thrown[pa.pitcher] || 0) + (pa.pitches || []).length; });
  function slots(s) {
    var L = G.lineups[s], out = [];
    for (var k = 1; k <= 9; k++) {
      var men = L.filter(function (p) { return Math.floor(p.order / 100) === k; }).sort(function (a, b) { return a.order - b.order; });
      var turns = 0, list = [];
      men.forEach(function (p, j) {
        list.push({ id: p.id, pos: p.pos, from: turns + 1 });   // he takes the spot at its next turn after the men before him
        turns += G.pas.filter(function (pa) { return pa.batter === p.id; }).length;
      });
      out.push(list);
    }
    return out;
  }
  var SLOTS = { away: slots('away'), home: slots('home') };
  var built = {};
  function pitcher(id, asReliever) {
    if (!built[id]) built[id] = REVIEW.pitcher(D.recs[id], rng, env);
    var P = built[id];
    if (asReliever && P.role === 'SP') { P.role = 'RP'; P.stamina = 35; }
    return P;
  }
  function fresh(P) { P.load = 0; P.used = false; P.pitchesToday = 0; P.warm = 0; return P; }
  function team(s, draw) {
    var T = G.teams[s], ab = T.abbrev || abbrev[T.id];
    var lineup = [], lineupPlan = [];
    SLOTS[s].forEach(function (list, k) {
      var plan = {};
      list.forEach(function (m, j) {
        var h = REVIEW.hitter(D.fits[m.id], rng, draw, m.pos === 'DH' ? 'DH' : m.pos); h.pos = m.pos; h.homePos = m.pos;
        if (j === 0) lineup.push(h); else plan[m.from] = h;
      });
      lineupPlan.push(plan);
    });
    var used = G.pitchers[s];
    // each faces the batters he faced; a reliever's 35-pitch stamina would leave a long man (a bullpen game's 50 pitches) far past
    // his limit by the plan's own doing, so his stamina is at least the pitches he threw that day over 0.85 (fatigue just begun)
    var plan = used.map(function (id, k) { var P = fresh(pitcher(id, k > 0)); asPitched(id, P); P.stamina = Math.max(P.stamina, (thrown[id] || 0) / 0.85); return { P: P, bf: faced[s][id] || 0 }; })
      .filter(function (q, k) { return k === 0 || q.bf > 0; });
    var pen = Object.keys(D.recs).map(function (k) { return D.recs[k]; }).filter(function (r) {
      if (r.team !== ab || r.kind === 'position' || used.indexOf(r.id) >= 0) return false;
      return ((r.summaries.pitching && r.summaries.pitching.role || {}).role) === 'RP';
    }).map(function (r) { return fresh(pitcher(r.id, true)); });
    if (!pen.length) pen = plan.slice(1).map(function (q) { return q.P; });
    var saves = function (P) { var ss = (D.recs[P.mlbId].seasonStats || {}).pitching_2026 || {}; return ss.SV || 0; };
    var closer = pen.slice().sort(function (a, b) { return saves(b) - saves(a); })[0];
    return { city: T.name, nick: '', name: T.name, lineup: lineup, bench: [], starter: plan[0].P, bullpen: pen, closer: closer,
             plan: plan, lineupPlan: lineupPlan, manager: { hook: 0.42, warmAt: 0.2, ibb: 0.075, glove: 0.012 } };
  }
  for (var g = 0; g < N; g++) {
    if (g % PARTS !== PART) continue;
    var ta = team('away', g % 40), th = team('home', (g * 7 + 3) % 40);
    var GM = BBGame.simGame(ta, th, { rng: rng, env: env, rules: 'AL', ghost: false, maxInnings: 60 });   // no tie: the postseason plays on
    print(JSON.stringify({ g: g, score: GM.score, innings: GM.finalInning, hits: GM.hits }));
  }
})(typeof arguments !== 'undefined' ? arguments : []);
