/* ============================================================================
   shape_check.js · v0.1 · 2026-09-29

   Every play the game loop records must carry what baseball.html reads:
   a runner list, an event list, a ground track unless it is a home run,
   the batted ball's flight path, and a nine-man defence snapshot. Two
   branches of the fielding layer (home runs, third-out catches) once
   returned early without them and blanked the screen. Plays 20 games and
   reports any play missing a piece.
   Run:  jsc ../bb_engine.js ../bb_names.js ../bb_field.js ../bb_game.js shape_check.js

   CHANGED
     v0.1  first build
============================================================================ */
(function () {
  var rng = BB.makeRng(77), bad = 0, n = 0;
  for (var g = 0; g < 20; g++) {
    var T = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, T[0]), BBGame.makeTeam(rng, T[1]), { rng: rng });
    G.plays.forEach(function (p) {
      if (!p.play) return; n++;
      var r = p.play, ok = Array.isArray(r.runners) && Array.isArray(r.events) && (r.hit === 'HR' || r.track) && p.pa.bb && p.pa.bb.path && p.defense && p.defense.length === 9;
      if (!ok) { bad++; if (bad <= 5) print('BAD: ' + p.desc + '  runners=' + !!r.runners + ' events=' + !!r.events + ' track=' + !!r.track); }
    });
  }
  print('plays checked ' + n + ', bad ' + bad);
})();
