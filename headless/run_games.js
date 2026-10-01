/* ============================================================================
   run_games.js · v0.1 · 2026-09-29

   Headless games. Draws fresh teams for each game, plays N of them, and
   prints the league line beside MLB (2024 unless noted): runs, the slash
   line, batted-ball outcomes, errors, double plays, game length. Then the
   play-by-play of the first game's opening innings, so a human can read
   whether the baseball makes sense.

   Run:  jsc ../bb_engine.js ../bb_names.js ../bb_field.js ../bb_game.js run_games.js -- N SEED [innings-of-pbp]

   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 50, SEED = +A[1] || 3, PBP = A[2] === undefined ? 3 : +A[2];
  var rng = BB.makeRng(SEED), t0 = Date.now();
  var S = BBGame.newStats(), games = 0, runs = [], pitches = 0, pitchers = 0, innings = 0, first = null, extra = 0, lob = 0;
  var bbe = { GB: [0, 0], LD: [0, 0], FB: [0, 0], PU: [0, 0] };   // [hits, balls]
  var hitBy = {};
  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng);
    var away = BBGame.makeTeam(rng, T[0]), home = BBGame.makeTeam(rng, T[1]);
    var G = BBGame.simGame(away, home, { rng: rng });
    if (!first) first = G;
    games++; pitches += G.pitches; pitchers += G.pitchersUsed[0] + G.pitchersUsed[1]; innings += G.finalInning; if (G.finalInning > 9) extra++;
    lob += G.lob[0] + G.lob[1];
    [0, 1].forEach(function (i) {
      var s = G.stats[i]; runs.push(G.score[i]);
      Object.keys(S).forEach(function (k) { S[k] += s[k]; });
    });
    G.plays.forEach(function (p) {
      if (!p.play) return;
      var r = p.play, isHit = r.hit === '1B' || r.hit === '2B' || r.hit === '3B' || r.hit === 'HR';
      if (r.hit !== 'HR') { bbe[r.type][1]++; if (isHit) bbe[r.type][0]++; }
      hitBy[r.hit] = (hitBy[r.hit] || 0) + 1;
    });
  }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function row(l, m, mlb) { print(pad(l, 24) + pad(m, 9) + pad(mlb, 9)); }
  function f3(v) { return v.toFixed(3).replace(/^0/, ''); }
  var tg = 2 * games, ab = S.ab, h = S.h, obpDen = S.ab + S.bb + S.hbp + S.sf;
  print('run_games  N=' + games + ' games  seed=' + SEED + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  print(pad('metric', 24) + pad('model', 9) + pad('MLB', 9));
  print('-- per team-game');
  row('runs', (S.r / tg).toFixed(2), '4.39');
  row('hits', (S.h / tg).toFixed(2), '8.15');
  row('doubles', (S.d / tg).toFixed(2), '1.60');
  row('triples', (S.t / tg).toFixed(2), '0.14');
  row('home runs', (S.hr / tg).toFixed(2), '1.12');
  row('walks', (S.bb / tg).toFixed(2), '3.10');
  row('strikeouts', (S.k / tg).toFixed(2), '8.40');
  row('errors', (S.e / tg).toFixed(2), '0.55');
  row('double plays', (S.dp / tg).toFixed(2), '0.72');
  row('stolen bases', (S.sb / tg).toFixed(2), '0.47');
  row('caught stealing', (S.cs / tg).toFixed(2), '0.19');
  row('wild pitches', (S.wp / tg).toFixed(2), '0.36');
  row('passed balls', (S.pb / tg).toFixed(2), '0.08');
  row('left on base', (lob / tg).toFixed(2), '~6.8');
  row('pitches', (pitches / tg).toFixed(0), '146');
  row('pitchers used', (pitchers / tg).toFixed(2), '4.2');
  row('innings per game', (innings / games).toFixed(2), '9.1');
  row('extra-inning games %', (100 * extra / games).toFixed(1), '~8');
  print('-- batting');
  row('AVG', f3(h / ab), '.243');
  row('OBP', f3((h + S.bb + S.hbp) / obpDen), '.312');
  row('SLG', f3((S.h + S.d + 2 * S.t + 3 * S.hr) / ab), '.399');
  row('BABIP', f3((h - S.hr) / (ab - S.k - S.hr + S.sf)), '.291');
  row('K%', (100 * S.k / S.pa).toFixed(1), '22.6');
  row('BB%', (100 * S.bb / S.pa).toFixed(1), '8.2');
  row('HR%', (100 * S.hr / S.pa).toFixed(1), '3.0');
  print('-- BABIP by batted-ball type (MLB: GB .24, LD .68, FB .12, PU .02)');
  ['GB', 'LD', 'FB', 'PU'].forEach(function (k) { row(k + ' (n=' + bbe[k][1] + ')', bbe[k][1] ? f3(bbe[k][0] / bbe[k][1]) : '-', ''); });
  row('GB / LD / FB / PU %', [S.GB, S.LD, S.FB, S.PU].map(function (v) { return Math.round(100 * v / (S.GB + S.LD + S.FB + S.PU)); }).join('/'), '43/24/24/9');
  print('-- outcomes of balls in play: ' + JSON.stringify(hitBy));
  var rs = runs.slice().sort(function (a, b) { return a - b; });
  print('-- team runs: min ' + rs[0] + ' median ' + rs[rs.length >> 1] + ' max ' + rs[rs.length - 1] + '   shutouts ' + rs.filter(function (r) { return r === 0; }).length + '/' + rs.length);
  if (PBP > 0) {
    print('');
    print('=== ' + BBGame.line(first));
    print(BBGame.playByPlay(first, PBP));
  }
})(typeof arguments !== 'undefined' ? arguments : []);
