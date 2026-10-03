/* ============================================================================
   discipline_check.js · v0.2 · 2026-10-03

   Measures the model's plate discipline the way statcast/discipline.py
   measures the league's, and prints each table with the league's numbers
   beside it when statcast/discipline_2025.js is loaded first: by count
   (in zone, swing, zone swing, chase), swing probability by distance from the
   zone edge for groups of counts and for pitch kinds, where pitches went, and
   what a swing produced and how often a take was called a strike by distance.

   Edge distance is in inches from the edge of the rulebook zone, + outside,
   - inside (to the nearest edge), with the zone as the engine's inZone.

   Run:  jsc bb_engine.js bb_names.js bb_field.js bb_game.js statcast/discipline_2025.js headless/discipline_check.js -- [hitters] [PA each] [seed]

   CHANGED
     v0.2  familiarity as in games: 40 x u x u pitches of this pitcher seen at the start of each PA (games: median 9 at a swing, mean 12.6; was uniform to 60-80)
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 400, NPA = +A[1] || 40, SEED = +A[2] || 3, IN = BB.units.IN, G = BB.geometry;
  var rng = BB.makeRng(SEED + 202), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], rows = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var HALF = (8.5 + 1.45) * IN, R = 1.45 * IN;
  function edgeIn(B, x, z) {
    var lo = B.zone.bot - R, hi = B.zone.top + R, dx = Math.abs(x) - HALF, dz = Math.max(lo - z, z - hi);
    if (dx <= 0 && dz <= 0) return Math.max(dx, dz) / IN;
    return Math.sqrt(Math.pow(Math.max(dx, 0), 2) + Math.pow(Math.max(dz, 0), 2)) / IN;
  }
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {});
    for (var k = 0; k < NPA; k++) {
      var Pi = P[(i * NPA + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      var res = BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      res.pitches.forEach(function (q) {
        if (q.hbp || !q.decide) return;
        var e = edgeIn(B, q.pitch.plate.x, q.pitch.plate.z);
        rows.push({ count: q.count, swing: !!q.decide.swing, edge: e, kind: BB.PITCH_TYPES[q.pitch.type].kind,
                    contact: q.swing ? !!q.swing.contact : false, fair: !!(q.bb && q.bb.fair), called: q.call ? !!q.call.strike : null });
      });
    }
  }
  var L = (typeof DISCIPLINE !== 'undefined') ? DISCIPLINE : null;   // the league's tables, when statcast/discipline_2025.js is loaded
  var EDGES = [-99, -6, -4, -2, 0, 2, 4, 6, 9, 12, 99];
  var NAMES = EDGES.slice(1).map(function (b, j) { var a = EDGES[j]; return (a > -99 ? a : '') + '..' + (b < 99 ? b : ''); });
  function binOf(d) { for (var j = 0; j < EDGES.length - 1; j++) if (d >= EDGES[j] && d < EDGES[j + 1]) return j; return EDGES.length - 2; }
  rows.forEach(function (r) { r.bin = binOf(r.edge); r.inZone = r.edge <= 0; });
  function f(x) { return x === null || x === undefined || !isFinite(x) ? '  -  ' : x.toFixed(3); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function rate(s, fn) { return s.length ? s.filter(fn).length / s.length : null; }
  var COUNTS = ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2'];
  var GROUPS = [['first pitch (0-0)', ['0-0']], ['batter ahead (1-0 2-0 2-1 3-1)', ['1-0', '2-0', '2-1', '3-1']], ['3-0', ['3-0']],
                ['even or behind, under 2 strikes (0-1 1-1)', ['0-1', '1-1']], ['two strikes', ['0-2', '1-2', '2-2', '3-2']]];
  var KINDS = [['fastball', 'FB'], ['breaking', 'BR'], ['offspeed', 'OS']];
  print('discipline_check v0.1 · seed ' + SEED + ' · ' + N + ' hitters x ' + NPA + ' PA · 120 pitchers · ' + rows.length + ' pitches');
  print('\n1. BY COUNT       pitches  in zone   swing  zone swing  chase   | league: in zone  swing  zone swing  chase');
  COUNTS.concat(['all']).forEach(function (c) {
    var s = c === 'all' ? rows : rows.filter(function (r) { return r.count === c; }), z = s.filter(function (r) { return r.inZone; }), o = s.filter(function (r) { return !r.inZone; });
    var l = L ? (c === 'all' ? L.all : L.by_count[c]) : null;
    print(pad(c, 10) + pad(s.length, 10) + pad(f(z.length / s.length), 9) + pad(f(rate(s, function (r) { return r.swing; })), 8) + pad(f(rate(z, function (r) { return r.swing; })), 11) + pad(f(rate(o, function (r) { return r.swing; })), 8) +
          (l ? '   |        ' + f(l.zone) + '  ' + f(l.swing) + '      ' + f(l.zone_swing) + '  ' + f(l.chase) : ''));
  });
  print('\n2. SWING PROBABILITY BY DISTANCE FROM THE ZONE EDGE (in, + outside); league on the line below each');
  print(pad('', 44) + NAMES.map(function (n) { return pad(n, 8); }).join(''));
  function curveRow(label, s, lc) {
    print(pad(label, 44) + NAMES.map(function (n, j) { var t = s.filter(function (r) { return r.bin === j; }); return pad(f(rate(t, function (r) { return r.swing; })), 8); }).join(''));
    if (lc) print(pad('league', 44) + lc.map(function (v) { return pad(f(v[0]), 8); }).join(''));
  }
  GROUPS.forEach(function (g) { curveRow(g[0], rows.filter(function (r) { return g[1].indexOf(r.count) >= 0; }), L && L.swing_by_edge[g[0]]); });
  KINDS.forEach(function (kd) { curveRow(kd[0] + ' (all counts)', rows.filter(function (r) { return r.kind === kd[1]; }), L && L.swing_by_edge[kd[0]]); });
  print('\n3. WHERE PITCHES WENT: share of pitches by distance from the zone edge; league below');
  print(pad('', 44) + pad('in zone', 9) + NAMES.map(function (n) { return pad(n, 8); }).join(''));
  function locRow(label, s, l) {
    print(pad(label, 44) + pad(f(rate(s, function (r) { return r.inZone; })), 9) + NAMES.map(function (n, j) { return pad(f(rate(s, function (r) { return r.bin === j; })), 8); }).join(''));
    if (l) print(pad('league', 44) + pad(f(l.zone), 9) + l.share.map(function (v) { return pad(f(v), 8); }).join(''));
  }
  GROUPS.forEach(function (g) { locRow(g[0], rows.filter(function (r) { return g[1].indexOf(r.count) >= 0; }), L && L.location_by_edge[g[0]]); });
  KINDS.forEach(function (kd) { locRow(kd[0], rows.filter(function (r) { return r.kind === kd[1]; }), L && L.location_by_edge[kd[0]]); });
  print('\n4. BY DISTANCE FROM THE ZONE EDGE   swings  whiff  foul/contact   takes  called strike   | league: whiff  foul/contact  called strike');
  NAMES.forEach(function (n, j) {
    var s = rows.filter(function (r) { return r.bin === j && r.swing; }), c = s.filter(function (r) { return r.contact; }), t = rows.filter(function (r) { return r.bin === j && !r.swing && r.called !== null; });
    var l = L ? L.outcome_by_edge[j] : null;
    print(pad(n, 30) + pad(s.length, 10) + pad(f(1 - c.length / s.length), 7) + pad(f(rate(c, function (r) { return !r.fair; })), 13) + pad(t.length, 8) + pad(f(rate(t, function (r) { return r.called; })), 14) +
          (l ? '   |        ' + f(l.whiff) + '  ' + f(l.foul_of_contact) + '        ' + f(l.called_strike) : ''));
  });
})(arguments);
