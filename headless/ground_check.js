/* ============================================================================
   ground_check.js · v0.1 · 2026-10-05

   What happens to the model's ground balls and low liners (launch angle -30
   to 15 deg), in the shape statcast/ground_balls.py measures the league's,
   with the league's numbers beside them when statcast/ground_balls_2025.js
   is loaded first: hits per ball by launch angle (2-deg bands) and exit
   speed (5-mph bands), by direction and by the fielder who handled it, the
   infield hits and errors, how the outs were made (in the air or off the
   ground); then the model's own internals by launch angle band: where the
   ball landed, its first hop, when and how fast it reached the fielder, how
   far he moved, and the throw's margin at first base. Plays whole games, so
   parks, weather and fielders are real.

   Direction: the league's is the angle of the hit coordinates (where the
   fielder touched the ball); the model's is the angle of the spot where it
   was fielded, + toward the batter's pull side.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js statcast/ground_balls_2025.js headless/ground_check.js -- [games] [seed]

   CHANGED
     v0.1  first build (the ground-balls brief)
============================================================================ */
(function (A) {
  var N = +A[0] || 300, SEED = +A[1] || 3, L = typeof GBL !== 'undefined' ? GBL : null;
  var U = BB.units, FT = U.FT, MPH = U.MPH, DEG = U.DEG, BASE = 90 * FT;
  var LA_E = [], LA5_E = [-30, -20, -10, -5, 0, 5, 10, 15], EV_E = [0, 70, 75, 80, 85, 90, 95, 100, 105, 110, 130], DIR_E = [-60, -15, 15, 60];
  for (var a = -30; a <= 16; a += 2) LA_E.push(a);
  var POS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'], INF = { P: 1, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1 };
  function band(v, E) { for (var i = 0; i < E.length - 1; i++) if (v >= E[i] && v < E[i + 1]) return i; return -1; }
  function lab(E) { return E.slice(0, -1).map(function (a, i) { return a + '..' + E[i + 1]; }); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function f3(v) { return v === null || v === undefined || isNaN(v) ? '' : v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-'); }
  function med(xs) { if (!xs.length) return null; var s = xs.slice().sort(function (a, b) { return a - b; }); return s[s.length >> 1]; }
  function rate(a, n) { return n ? a / n : null; }
  var rng = BB.makeRng(SEED), B = [], SPOT = {};   // SPOT: the model's average starting spot by position and batter side, bases empty
  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, T[0]), BBGame.makeTeam(rng, T[1]), { rng: rng });
    G.plays.forEach(function (p) {
      if (!p.play || !p.pa || !p.pa.bb) return;
      var bb = p.pa.bb, r = p.play, sb = p.pa.pitches[p.pa.pitches.length - 1].side;
      if (bb.la < -30 || bb.la >= 15 || bb.hr) return;
      var h = r.hit === '1B' || r.hit === '2B' || r.hit === '3B' || r.hit === 'HR' ? r.hit : null;
      var caught = r.events.some(function (e) { return e.kind === 'catch'; });
      var fld = r.fielded, at = fld ? fld.at : null, who = fld ? fld.who : null;
      var dir = at ? Math.atan2(at[0], at[1]) / DEG * sb : null;
      // the ball's hops and speed on the way to the fielder, from the track
      var Tr = r.track, hop1 = null, vAt = null, moved = null;
      if (Tr && Tr.ground && Tr.ground.length) {
        var Gd = Tr.ground, zmax = 0;
        for (var i = 1; i < Gd.length; i++) { if (Gd[i][3] > zmax) zmax = Gd[i][3]; if (Gd[i][3] <= 0.001 && zmax > 0) break; }
        hop1 = zmax;
        if (at) { var best = 1e9; for (var k = 0; k < Gd.length; k++) { var d = Math.hypot(Gd[k][1] - at[0], Gd[k][2] - at[1]); if (d < best) { best = d; vAt = Gd[k][4]; } } }
      }
      var rangeKey = null;   // a ground out by an infielder with the bases empty: ranged is set after the loop, from the model's own average spot for his position and the batter's side
      if (fld && p.defense) { var F = p.defense.filter(function (q) { return q.pos === who; })[0]; if (F) { moved = Math.hypot(F.at[0] - at[0], F.at[1] - at[1]); if (!h && !caught && INF[who] && who !== 'P' && who !== 'C' && !p.bases[1] && !p.bases[2] && !p.bases[3]) rangeKey = who + '|' + sb; } }
      // the throw's margin at first on an out at first: the ball's arrival less the batter's
      var thr = r.events.filter(function (e) { return (e.kind === 'throw' || e.kind === 'carry' || e.kind === 'cover') && e.to === 1; })[0];
      var batRun = 0.05 + BBField.runTime(p.batter, BASE, true), margin = thr ? thr.arrive - batRun : null;
      B.push({ ev: bb.ev, la: bb.la, dir: dir, pos: who, hit: h, err: r.hit === 'E', air: caught && !h, infHit: !!h && !!INF[who],
               land: bb.dist, landT: bb.landT, hop1: hop1, tF: fld ? fld.t : null, vAt: vAt, moved: moved, through: !!who && !INF[who],
               clean: r.events.some(function (e) { return e.kind === 'field'; }), muff: r.events.some(function (e) { return e.kind === 'muff'; }),
               margin: margin, fieldD: at ? Math.hypot(at[0], at[1]) / FT : null, back: bb.backspin, ranged: null, rangeKey: rangeKey, fAt: rangeKey ? fld.at : null });
      if (p.defense && !p.bases[1] && !p.bases[2] && !p.bases[3]) p.defense.forEach(function (F) { if (INF[F.pos] && F.pos !== 'P' && F.pos !== 'C') { var k = F.pos + '|' + sb, s = SPOT[k] || (SPOT[k] = [0, 0, 0]); s[0] += F.at[0]; s[1] += F.at[1]; s[2]++; } });
    });
  }
  B.forEach(function (b) { if (b.rangeKey && SPOT[b.rangeKey]) { var s = SPOT[b.rangeKey]; b.ranged = Math.hypot(b.fAt[0] - s[0] / s[2], b.fAt[1] - s[1] / s[2]) / FT; } });
  print('ground_check v0.1 · ' + N + ' games · seed ' + SEED + ' · ' + B.length + ' balls in play at -30..15 deg' + (L ? '   (league beside or below, statcast/ground_balls.py, n ' + L.n + ')' : ''));
  print('');
  print('1. HITS PER BALL BY LAUNCH ANGLE (2-deg bands, rows) AND EXIT SPEED (columns); n in brackets; blank under 20; league row below each');
  print(pad('LA', 8) + ' ' + pad('all', 12) + ' ' + lab(EV_E).map(function (l) { return pad(l, 11); }).join(' '));
  lab(LA_E).forEach(function (l, j) {
    var s = B.filter(function (b) { return band(b.la, LA_E) === j; }), hh = s.filter(function (b) { return b.hit; }).length;
    var cells = EV_E.slice(1).map(function (_, i) { var t = s.filter(function (b) { return band(b.ev, EV_E) === i; }); return [t.filter(function (b) { return b.hit; }).length, t.length]; });
    print(pad(l, 8) + ' ' + pad((s.length >= 20 ? f3(hh / s.length) : '') + ' (' + pad(s.length, 5) + ')', 12) + ' ' + cells.map(function (c) { return pad((c[1] >= 20 ? f3(c[0] / c[1]) : '') + ' (' + pad(c[1], 4) + ')', 11); }).join(' '));
    if (L) { var q = L.by_la[j]; print(pad('league', 8) + ' ' + pad((q.n >= 20 ? f3(q.hits / q.n) : '') + ' (' + pad(q.n, 5) + ')', 12) + ' ' + q.cells.map(function (c) { return pad((c[1] >= 20 ? f3(c[0] / c[1]) : '') + ' (' + pad(c[1], 4) + ')', 11); }).join(' ')); }
  });
  print('');
  print('2. BY EXIT SPEED: hits per ball, the share of balls that were infield hits (fielded by an infielder), and errors per ball; ground balls (LA < 10) | low liners (0..15); league in the second block');
  function evRow(l, g, q) {
    var f = function (c) { return c[0] ? pad(c[0], 7) + pad(f3(c[1] / c[0]), 7) + pad(f3(c[2] / c[0]), 7) + pad(f3(c[3] / c[0]), 7) : pad(0, 7) + pad('', 21); };
    return pad(l, 10) + f(g) + '   |' + f(q);
  }
  function evCells(s) { return [s.length, s.filter(function (b) { return b.hit; }).length, s.filter(function (b) { return b.infHit; }).length, s.filter(function (b) { return b.err; }).length]; }
  print(pad('EV', 10) + pad('n(<10)', 7) + pad('hit', 7) + pad('infhit', 7) + pad('err', 7) + '   |' + pad('n(0-15)', 7) + pad('hit', 7) + pad('infhit', 7) + pad('err', 7));
  lab(EV_E).forEach(function (l, i) {
    print(evRow(l, evCells(B.filter(function (b) { return band(b.ev, EV_E) === i && b.la < 10; })), evCells(B.filter(function (b) { return band(b.ev, EV_E) === i && b.la >= 0; }))));
  });
  if (L) { print(pad('league', 10)); lab(EV_E).forEach(function (l, i) { print(evRow(l, L.by_ev[i].gb, L.by_ev[i].ll)); }); }
  print('');
  print('3. HITS PER BALL BY DIRECTION (where it was fielded, + pulled: opposite / middle / pull) AND LAUNCH ANGLE; n in brackets; league below');
  print(pad('LA', 10) + ' ' + lab(DIR_E).map(function (l) { return pad(l, 14); }).join(' '));
  lab(LA5_E).forEach(function (l, j) {
    var s = B.filter(function (b) { return band(b.la, LA5_E) === j; });
    var cells = DIR_E.slice(1).map(function (_, m) { var t = s.filter(function (b) { return b.dir !== null && band(b.dir, DIR_E) === m; }); return [t.filter(function (b) { return b.hit; }).length, t.length]; });
    print(pad(l, 10) + ' ' + cells.map(function (c) { return pad((c[1] >= 20 ? f3(c[0] / c[1]) : '') + ' (' + pad(c[1], 6) + ')', 14); }).join(' '));
    if (L) print(pad('league', 10) + ' ' + L.by_dir[j].cells.map(function (c) { return pad((c[1] >= 20 ? f3(c[0] / c[1]) : '') + ' (' + pad(c[1], 6) + ')', 14); }).join(' '));
  });
  print('');
  print('4. BY THE FIELDER WHO HANDLED IT: share of balls in the band, and hits per ball when he did; league below');
  print(pad('LA', 10) + pad('n', 6) + ' ' + POS.map(function (p) { return pad(p, 11); }).join(' '));
  lab(LA5_E).forEach(function (l, j) {
    var s = B.filter(function (b) { return band(b.la, LA5_E) === j; });
    print(pad(l, 10) + pad(s.length, 6) + ' ' + POS.map(function (p) { var t = s.filter(function (b) { return b.pos === p; }), h = t.filter(function (b) { return b.hit; }).length; return pad(s.length ? (t.length / s.length).toFixed(2).replace(/^0/, '') : '', 4) + ' ' + pad(t.length >= 20 ? f3(h / t.length) : '', 6); }).join(' '));
    if (L) { var q = L.by_pos[j]; print(pad('league', 10) + pad(q.n, 6) + ' ' + POS.map(function (p) { var c = q.cells[p]; return pad(q.n ? (c[1] / q.n).toFixed(2).replace(/^0/, '') : '', 4) + ' ' + pad(c[1] >= 20 ? f3(c[0] / c[1]) : '', 6); }).join(' ')); }
  });
  print('');
  print('5. HOW THE OUTS WERE MADE, share of balls in the band: caught in the air / off the ground; league beside');
  print(pad('LA', 10) + pad('n', 7) + pad('air', 7) + pad('ground', 8) + '   |' + pad('n', 7) + pad('air', 7) + pad('ground', 8) + pad('other', 7));
  lab(LA5_E).forEach(function (l, j) {
    var s = B.filter(function (b) { return band(b.la, LA5_E) === j; }), o = s.filter(function (b) { return !b.hit; });
    var air = o.filter(function (b) { return b.air; }).length, row = pad(l, 10) + pad(s.length, 7) + pad(f3(rate(air, s.length)), 7) + pad(f3(rate(o.length - air, s.length)), 8);
    if (L) { var q = L.how[j]; row += '   |' + pad(q.n, 7) + pad(f3(rate(q.air, q.n)), 7) + pad(f3(rate(q.ground, q.n)), 8) + pad(f3(rate(q.other, q.n)), 7); }
    print(row);
  });
  print('');
  print('6. THE MODEL\'S INTERNALS BY LAUNCH ANGLE BAND (medians): where the ball landed (ft) and when (s), its first hop (m), when the fielder had it (s), its speed then (mph),');
  print('   how far he moved (m), the share that got through to the outfield, fielded clean / muffed, infield hits per ball on clean plays / on muffs, the throw\'s margin at first on plays to first (s, + = ball first), backspin (rpm, - = topspin)');
  print(pad('LA', 10) + pad('n', 6) + pad('land', 7) + pad('landT', 7) + pad('hop1', 6) + pad('tField', 7) + pad('vAt', 6) + pad('moved', 7) + pad('through', 8) + pad('clean', 7) + pad('muff', 6) + pad('ih.cln', 7) + pad('ih.muf', 7) + pad('margin', 8) + pad('p(out|<0.3)', 12) + pad('spin', 7));
  lab(LA5_E).forEach(function (l, j) {
    var s = B.filter(function (b) { return band(b.la, LA5_E) === j; }), inf = s.filter(function (b) { return b.pos && INF[b.pos]; });
    var mg = inf.filter(function (b) { return b.margin !== null; }), close = mg.filter(function (b) { return Math.abs(b.margin) < 0.3; });
    var ihc = s.filter(function (b) { return b.infHit && b.clean; }).length, ihm = s.filter(function (b) { return b.infHit && b.muff; }).length;
    print(pad(l, 10) + pad(s.length, 6) + pad(med(s.map(function (b) { return b.land; })).toFixed(0), 7) + pad(med(s.map(function (b) { return b.landT; })).toFixed(2), 7) +
          pad((med(s.map(function (b) { return b.hop1; }).filter(function (v) { return v !== null; })) || 0).toFixed(2), 6) +
          pad((med(inf.map(function (b) { return b.tF; })) || 0).toFixed(2), 7) + pad(((med(inf.map(function (b) { return b.vAt; }).filter(function (v) { return v !== null; })) || 0) / MPH).toFixed(0), 6) +
          pad((med(inf.map(function (b) { return b.moved; }).filter(function (v) { return v !== null; })) || 0).toFixed(1), 7) +
          pad(f3(rate(s.filter(function (b) { return b.through; }).length, s.length)), 8) + pad(f3(rate(s.filter(function (b) { return b.clean; }).length, s.length)), 7) + pad(f3(rate(s.filter(function (b) { return b.muff; }).length, s.length)), 6) +
          pad(f3(rate(ihc, s.length)), 7) + pad(f3(rate(ihm, s.length)), 7) +
          pad(mg.length ? med(mg.map(function (b) { return b.margin; })).toFixed(2) : '', 8) + pad(close.length >= 20 ? f3(rate(close.filter(function (b) { return !b.hit; }).length, close.length)) : '', 12) +
          pad((med(s.map(function (b) { return b.back; })) || 0).toFixed(0), 7));
  });
  print('');
  print('7. WHERE GROUND-BALL OUTS FIRST LANDED: median distance from the plate (ft) of the first bounce, outs made off the ground, by launch angle (rows) and exit speed (columns); n in brackets;');
  print('   league below (Statcast hit_distance_sc, which for a ground ball is where it first came down)');
  print(pad('LA \\ EV', 10) + ' ' + lab(EV_E).map(function (l) { return pad(l, 11); }).join(' '));
  lab(LA5_E).forEach(function (l, j) {
    var row = EV_E.slice(1).map(function (_, i) { var t = B.filter(function (b) { return band(b.la, LA5_E) === j && band(b.ev, EV_E) === i && !b.hit && !b.air; }).map(function (b) { return b.land; }); return t.length >= 10 ? pad(med(t).toFixed(0) + ' (' + pad(t.length, 4) + ')', 11) : pad('', 11); });
    print(pad(l, 10) + ' ' + row.join(' '));
    if (L) print(pad('league', 10) + ' ' + L.field_dist[j].map(function (c) { return c && c[1] >= 10 ? pad(c[0].toFixed(0) + ' (' + pad(c[1], 4) + ')', 11) : pad('', 11); }).join(' '));
  });
  print('');
  print('8. HOW FAR THE INFIELDERS RANGED ON GROUND OUTS (bases empty): distance (ft) from the model\'s average starting spot for the position and batter side to the fielding spot, by exit speed; median / p75 / p90 (n); league below');
  print(pad('EV', 10) + ' ' + ['1B', '2B', '3B', 'SS', 'all four'].map(function (p) { return pad(p, 22); }).join(' '));
  function q3(t) { t = t.slice().sort(function (a, b) { return a - b; }); return [t[t.length >> 1], t[(3 * t.length) >> 2], t[(9 * t.length) / 10 | 0], t.length]; }
  lab(EV_E).forEach(function (l, i) {
    var row = ['1B', '2B', '3B', 'SS', 'all'].map(function (p) { var t = B.filter(function (b) { return band(b.ev, EV_E) === i && b.la < 10 && b.ranged !== null && (p === 'all' || b.pos === p); }).map(function (b) { return b.ranged; }); if (t.length < 10) return pad('', 22); var q = q3(t); return pad(q[0].toFixed(0) + ' /' + pad(q[1].toFixed(0), 4) + ' /' + pad(q[2].toFixed(0), 4) + ' (' + pad(q[3], 4) + ')', 22); });
    print(pad(l, 10) + ' ' + row.join(' '));
    if (L && L.ranged) print(pad('league', 10) + ' ' + ['1B', '2B', '3B', 'SS', 'all'].map(function (p) { var c = L.ranged[i][p]; return c && c[3] >= 10 ? pad(c[0].toFixed(0) + ' /' + pad(c[1].toFixed(0), 4) + ' /' + pad(c[2].toFixed(0), 4) + ' (' + pad(c[3], 4) + ')', 22) : pad('', 22); }).join(' '));
  });
  print('');
  var gb = B.filter(function (b) { return b.la < 10; });
  print('All -30..15: hits per ball ' + f3(rate(B.filter(function (b) { return b.hit; }).length, B.length)) + ' (n ' + B.length + '); ground balls (<10): ' + f3(rate(gb.filter(function (b) { return b.hit; }).length, gb.length)) +
        ' (n ' + gb.length + '), infield hits ' + f3(rate(gb.filter(function (b) { return b.infHit; }).length, gb.length)) + ' of balls, errors ' + f3(rate(gb.filter(function (b) { return b.err; }).length, gb.length)) +
        (L ? '   | league ' + f3(L.totals.all[0] / L.totals.all[1]) + '; ground balls ' + f3(L.totals.gb[0] / L.totals.gb[1]) + ', infield hits ' + f3(L.totals.gb_inf_hits / L.totals.gb[1]) + ', errors ' + f3(L.totals.gb_err / L.totals.gb[1]) : ''));
})(typeof arguments !== 'undefined' ? arguments : []);
