/* advance_check.js · v0.1 · 2026-10-15: model teams' hits and base running as season/runs_audit.py defines them (singles, doubles,
   triples per PA; first to third on a single with only first occupied; scoring from second on a single with only second
   occupied; scoring from first on a double with only first occupied; a run on an air out with third occupied and under two out),
   for refitting the running margins (the model review, item 5).  Run: run.sh bb_engine.js bb_names.js FIELD bb_game.js
   review/advance_check.js -- [games] [seed] ['{tuneField}'] */
(function (A) {
  var N = +A[0] || 400, rng = BB.makeRng(+A[1] || 3); if (A[2] && BBField.tuneField) BBField.tuneField(JSON.parse(A[2]));
  var c = { pa: 0, h1: 0, h2: 0, h3: 0, s1: 0, s1y: 0, s2: 0, s2y: 0, d1: 0, d1y: 0, sf: 0, sfy: 0, bip: 0, hits: 0, runs: 0, games: 0 };
  function occ(b) { return (b[1] ? 1 : 0) + (b[2] ? 2 : 0) + (b[3] ? 4 : 0); }
  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, T[0]), BBGame.makeTeam(rng, T[1]), { rng: rng });
    c.games++; c.runs += G.score[0] + G.score[1];
    G.plays.forEach(function (p) {
      if (!p.pa || p.pa.result === 'END') return; c.pa++;
      var r = p.play || {}, h = r.hit, b = p.bases ? occ(p.bases) : 0, ba = p.basesAfter ? occ(p.basesAfter) : 0;
      if (h === '1B') c.h1++; else if (h === '2B') c.h2++; else if (h === '3B') c.h3++;
      if (p.pa.result === 'BIP') { c.bip++; if (h === '1B' || h === '2B' || h === '3B') c.hits++; }
      if (h === '1B' && b === 1) { c.s1++; if (ba & 4) c.s1y++; }
      if (h === '1B' && b === 2) { c.s2++; if (p.runs >= 1) c.s2y++; }
      if (h === '2B' && b === 1) { c.d1++; if (p.runs >= 1) c.d1y++; }
      if ((b & 4) && p.outs < 2 && p.pa.result === 'BIP' && (h === 'OUT' || h === 'SF') && r.type !== 'GB' && (r.outsMade || 0) === 1) { c.sf++; if (p.runs >= 1) c.sfy++; }
    });
  }
  var f = function (a, b) { return +(a / Math.max(1, b)).toFixed(4); };
  print(JSON.stringify({ games: c.games, runsPerTeam: f(c.runs, 2 * c.games), '1B': f(c.h1, c.pa), '2B': f(c.h2, c.pa), '3B': f(c.h3, c.pa), babip: f(c.hits, c.bip),
    firstToThird: f(c.s1y, c.s1), scoresFromSecond: f(c.s2y, c.s2), scoresFromFirstOnDouble: f(c.d1y, c.d1), sacFly: f(c.sfy, c.sf), n: [c.s1, c.s2, c.d1, c.sf] }));
})(typeof arguments !== 'undefined' ? arguments : []);
