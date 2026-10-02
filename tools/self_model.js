/* ============================================================================
   self_model.js · v0.1 · 2026-10-02

   Measures, from the model itself, what a batter's swings produce: for each
   read at the commit point ('on' = the pitch he expected, or one he has not
   told apart from it; 'off' = one he recognised as something else) and each
   band of where he saw the pitch (inches from the zone's edge, + outside),
   the whiff rate, the foul share of contact, and the run value of a ball in
   play, valued by the league's run value for its exit speed and launch angle
   with the count's average removed (statcast/discipline.py table 5). These
   are bb_engine.js's SELF table: his knowledge of his own swing, which his
   swing-or-take bet uses. Paste the printed table into SELF, then rerun until
   it stops moving (each run's decisions change which swings are measured).
   Where he takes nearly every pitch there are too few swings to measure, and
   the cell keeps the league's figures (statcast/discipline.py table 4).

   Run:  jsc bb_engine.js bb_names.js bb_field.js bb_game.js statcast/discipline_2025.js tools/self_model.js -- [hitters] [PA each] [seed]

   CHANGED
     v0.1  first build (bb_engine v1.1)
============================================================================ */
(function (A) {
  var N = +A[0] || 600, NPA = +A[1] || 40, SEED = +A[2] || 5, IN = BB.units.IN;
  var V = DISCIPLINE.bip_value, CM = DISCIPLINE.bip_value.mean;
  function bipValue(ev, la) {   // league run value of a ball in play, count's average removed
    var i = 0, j = 0;
    while (i < V.la_edges.length - 2 && la >= V.la_edges[i + 1]) i++;
    while (j < V.ev_edges.length - 2 && ev >= V.ev_edges[j + 1]) j++;
    var c = V.grid[i][j];
    return c[1] >= 20 ? c[0] : CM;
  }
  var rng = BB.makeRng(SEED + 303), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var AT = BB.SELF_AT, cells = { on: AT.map(function () { return { sw: 0, wh: 0, con: 0, foul: 0, v: 0, nb: 0 }; }), off: AT.map(function () { return { sw: 0, wh: 0, con: 0, foul: 0, v: 0, nb: 0 }; }) };
  function binOf(e) { var b = 0, d = 1e9; AT.forEach(function (a, k) { if (Math.abs(e - a) < d) { d = Math.abs(e - a); b = k; } }); return b; }
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {});
    for (var k = 0; k < NPA; k++) {
      var Pi = P[(i * NPA + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: rng.u() * 80, rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing || !q.decide) return;
        var c = cells[q.decide.state][binOf(BB.edgeIn(B, q.decide.perceived[0], q.decide.perceived[1]) / IN)];
        c.sw++;
        if (!q.swing.contact || !q.bb) { c.wh++; return; }
        c.con++;
        if (!q.bb.fair && !q.bb.hr) { c.foul++; return; }
        c.v += bipValue(q.bb.ev, q.bb.la); c.nb++;
      });
    }
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  print('self_model v0.1 · seed ' + SEED + ' · ' + N + ' hitters x ' + NPA + ' PA · 120 pitchers');
  ['on', 'off'].forEach(function (s) {
    print('  ' + s + ':  swings by band ' + cells[s].map(function (c) { return c.sw; }).join(' '));
  });
  print('  var SELF = {');
  ['on', 'off'].forEach(function (s, si) {
    var rows = cells[s].map(function (c, k) {
      if (c.sw < 150) {   // too few swings to measure (he lays off there): the league's figures, his prior knowledge
        var L = DISCIPLINE.outcome_by_edge[k];
        return '[' + [r3(L.whiff), r3(L.foul_of_contact), r3(k === AT.length - 1 ? DISCIPLINE.outcome_by_edge[k - 1].rv_in_play : L.rv_in_play)].join(', ') + ']';
      }
      return '[' + [r3(c.wh / c.sw), r3(c.con ? c.foul / c.con : 0.5), r3(c.nb ? c.v / c.nb : CM)].join(', ') + ']';
    });
    print('    ' + s + (s === 'on' ? ':  ' : ': ') + '[' + rows.slice(0, 5).join(', ') + ',\n          ' + rows.slice(5).join(', ') + ']' + (si === 0 ? ',' : ''));
  });
  print('  };');
})(arguments);
