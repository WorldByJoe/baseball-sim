/* ============================================================================
   league_run.js · v0.1 · 2026-10-03

   Builds the professional world (bb_league.js), plays SEASONS seasons of
   GAMES games a club, promoting between them, prints each season's levels
   and the promotion drop, and writes the stable the screen can load
   (stable/bb_stable.js) when OUT is given.

   Run: jsc bb_engine.js bb_names.js bb_field.js bb_game.js bb_league.js headless/league_run.js -- SEED SEASONS GAMES [ORGS] [OUT]
============================================================================ */
(function (A) {
  var seed = +A[0] || 1, seasons = +A[1] || 2, games = +A[2] || 60, orgs = +A[3] || 30, outFile = A[4];
  var t0 = Date.now(), U = BBLeague.create(seed, { orgs: orgs });
  print('league_run · seed ' + seed + ' · ' + orgs + ' organisations · ' + seasons + ' seasons of ' + games + ' games · world built in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  for (var s = 1; s <= seasons; s++) {
    BBLeague.playSeason(U, { games: games, log: function (m) { print('  ' + m + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)'); } });
    print(BBLeague.report(U));
    if (s < seasons) { var mv = BBLeague.promote(U); print('  promotions after season ' + s + ': ' + mv.length + ' (' + mv.filter(function (m) { return m.to === 1; }).length + ' to the majors)'); }
    print('');
  }
  if (outFile) { var S = BBLeague.stable(U); print('STABLE ' + JSON.stringify(S).length + ' bytes'); print('@@STABLE@@' + JSON.stringify(S)); }
})(arguments);
