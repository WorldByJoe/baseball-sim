/* ============================================================================
   bip_check.js · v0.1 · 2026-10-02

   What happens to the model's balls in play, in the shape statcast/bip.py
   measures the league's, with the league's numbers beside them when
   statcast/bip_2025.js is loaded first: hits per ball in play by exit
   velocity and launch angle, the kind of hit by launch angle, fly balls and
   liners caught by distance and field, ground balls through by exit velocity
   and field, and how far balls in the air carried. Plays whole games, so parks, weather and fielders are real.
   Spray is + toward the batter's pull side; bunts do not exist in the model.

   Run:  jsc bb_engine.js bb_names.js bb_field.js bb_game.js statcast/bip_2025.js headless/bip_check.js -- [games] [seed]

   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 300, SEED = +A[1] || 3, L = typeof BIP !== 'undefined' ? BIP : null;
  var EV_E = [0, 70, 80, 90, 95, 100, 105, 130], LA_E = [-90, -10, 0, 10, 20, 30, 40, 50, 90];
  var DIST_E = [0, 150, 200, 250, 300, 350, 400, 600], SPRAY_E = [-60, -30, -15, 0, 15, 30, 60], GB_EV_E = [0, 70, 80, 90, 100, 130];
  function band(v, E) { for (var i = 0; i < E.length - 1; i++) if (v >= E[i] && v < E[i + 1]) return i; return -1; }
  function lab(E) { return E.slice(0, -1).map(function (a, i) { return a + '..' + E[i + 1]; }); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function f3(v) { return v === null || v === undefined || isNaN(v) ? '' : v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-'); }
  var rng = BB.makeRng(SEED), B = [];
  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, T[0]), BBGame.makeTeam(rng, T[1]), { rng: rng });
    G.plays.forEach(function (p) {
      if (!p.play || !p.pa || !p.pa.bb) return;
      var bb = p.pa.bb, sb = p.pa.pitches[p.pa.pitches.length - 1].side, h = p.play.hit;
      B.push({ ev: bb.ev, la: bb.la, spray: bb.spray * sb, dist: bb.dist, proj: bb.projDist, hit: h === '1B' || h === '2B' || h === '3B' || h === 'HR' ? h : null });
    });
  }
  print('bip_check v0.1 · ' + N + ' games · seed ' + SEED + ' · ' + B.length + ' balls in play' + (L ? '   (league below each row, statcast/bip.py)' : ''));
  print('');
  print('1. HITS PER BALL IN PLAY BY EXIT VELOCITY (rows) AND LAUNCH ANGLE (columns), home runs included; (share of balls in play)');
  print(pad('EV \\ LA', 10) + ' ' + lab(LA_E).map(function (l) { return pad(l, 13); }).join(' '));
  var grid = EV_E.slice(1).map(function () { return LA_E.slice(1).map(function () { return [0, 0]; }); });
  B.forEach(function (b) { var i = band(b.ev, EV_E), j = band(b.la, LA_E); if (i < 0 || j < 0) return; grid[i][j][1]++; if (b.hit) grid[i][j][0]++; });
  lab(EV_E).forEach(function (l, i) {
    print(pad(l, 10) + ' ' + grid[i].map(function (c) { return pad((c[1] >= 20 ? f3(c[0] / c[1]) : '') + ' (' + (c[1] / B.length).toFixed(3) + ')', 13); }).join(' '));
    if (L) { var nl = L.n; print(pad('league', 10) + ' ' + L.hit_by_ev_la[i].map(function (c) { return pad((c[1] >= 20 ? f3(c[0] / c[1]) : '') + ' (' + (c[1] / nl).toFixed(3) + ')', 13); }).join(' ')); }
  });
  print('');
  print('2. BY LAUNCH ANGLE: share of balls in play that became each hit   | league 1B 2B 3B HR BABIP');
  lab(LA_E).forEach(function (l, j) {
    var s = B.filter(function (b) { return band(b.la, LA_E) === j; }), c = { '1B': 0, '2B': 0, '3B': 0, HR: 0 };
    s.forEach(function (b) { if (b.hit) c[b.hit]++; });
    var n = s.length, nhr = n - c.HR, row = pad(l, 10) + pad(n, 7) + ['1B', '2B', '3B', 'HR'].map(function (k) { return pad((c[k] / n).toFixed(3), 7); }).join('') + pad(f3((c['1B'] + c['2B'] + c['3B']) / nhr), 7);
    if (L) { var q = L.by_la[j]; row += '   | ' + ['1B', '2B', '3B', 'HR'].map(function (k) { return q[k].toFixed(3); }).join(' ') + ' ' + f3(q.babip); }
    print(row);
  });
  print('');
  print('3. FLY BALLS AND LINERS (LA 10-50, home runs out): hits per ball by distance (ft) and spray (+ pulled); league below');
  print(pad('dist', 10) + pad('n', 7) + pad('all', 7) + ' ' + lab(SPRAY_E).map(function (l) { return pad(l, 9); }).join(' ') + pad('2B', 8) + pad('3B', 7));
  var air = B.filter(function (b) { return b.la >= 10 && b.la < 50 && b.hit !== 'HR'; });
  lab(DIST_E).forEach(function (l, k) {
    var s = air.filter(function (b) { return band(b.dist, DIST_E) === k; });
    if (!s.length) return;
    var row = SPRAY_E.slice(1).map(function (_, m) {
      var t = s.filter(function (b) { return band(b.spray, SPRAY_E) === m; }), h = t.filter(function (b) { return b.hit; }).length;
      return pad(t.length >= 20 ? f3(h / t.length) : '', 9);
    });
    var hh = s.filter(function (b) { return b.hit; }).length, d2 = s.filter(function (b) { return b.hit === '2B'; }).length, d3 = s.filter(function (b) { return b.hit === '3B'; }).length;
    print(pad(l, 10) + pad(s.length, 7) + pad(f3(hh / s.length), 7) + ' ' + row.join(' ') + pad((d2 / s.length).toFixed(3), 8) + pad((d3 / s.length).toFixed(3), 7));
    var q = L && L.air_by_dist[k];
    if (q) print(pad('league', 10) + pad(q.n, 7) + pad(f3(q.hit), 7) + ' ' + q.spray.map(function (c) { return pad(c[1] >= 20 ? f3(c[0] / c[1]) : '', 9); }).join(' ') + pad(q['2B'].toFixed(3), 8) + pad(q['3B'].toFixed(3), 7));
  });
  print('');
  print('4. GROUND BALLS (LA < 10): hits per ball by exit velocity and spray (+ pulled); league below');
  print(pad('EV', 10) + pad('n', 7) + pad('all', 7) + ' ' + lab(SPRAY_E).map(function (l) { return pad(l, 9); }).join(' '));
  var gb = B.filter(function (b) { return b.la < 10; });
  lab(GB_EV_E).forEach(function (l, k) {
    var s = gb.filter(function (b) { return band(b.ev, GB_EV_E) === k; }), hh = s.filter(function (b) { return b.hit; }).length;
    var row = SPRAY_E.slice(1).map(function (_, m) {
      var t = s.filter(function (b) { return band(b.spray, SPRAY_E) === m; }), h = t.filter(function (b) { return b.hit; }).length;
      return pad(t.length >= 20 ? f3(h / t.length) : '', 9);
    });
    print(pad(l, 10) + pad(s.length, 7) + pad(f3(hh / s.length), 7) + ' ' + row.join(' '));
    var q = L && L.gb[k];
    if (q) print(pad('league', 10) + pad(q.n, 7) + pad(f3(q.hit), 7) + ' ' + q.spray.map(function (c) { return pad(c[1] >= 20 ? f3(c[0] / c[1]) : '', 9); }).join(' '));
  });
  print('');
  print('5. CARRY: mean distance (ft) of balls in the air by exit velocity (rows) and launch angle (columns), projected past any fence as Statcast does for home runs; league below');
  var CEV = [90, 95, 100, 105, 110, 120], CLA = [15, 20, 25, 30, 35, 40, 45];
  print(pad('EV \\ LA', 10) + ' ' + lab(CLA).map(function (l) { return pad(l, 11); }).join(' '));
  lab(CEV).forEach(function (l, i) {
    var row = CLA.slice(1).map(function (_, j) {
      var s = B.filter(function (b) { return band(b.ev, CEV) === i && band(b.la, CLA) === j; });
      return pad(s.length >= 10 ? (s.reduce(function (a, b) { return a + b.proj; }, 0) / s.length).toFixed(0) + ' (' + s.length + ')' : '', 11);
    });
    print(pad(l, 10) + ' ' + row.join(' '));
    if (L && L.carry) print(pad('league', 10) + ' ' + L.carry.grid[i].map(function (c) { return pad(c && c[1] >= 10 ? c[0].toFixed(0) + ' (' + c[1] + ')' : '', 11); }).join(' '));
  });
  var c = { '1B': 0, '2B': 0, '3B': 0, HR: 0 }; B.forEach(function (b) { if (b.hit) c[b.hit]++; });
  print('');
  print('All balls in play: 1B ' + (c['1B'] / B.length).toFixed(3) + '  2B ' + (c['2B'] / B.length).toFixed(3) + '  3B ' + (c['3B'] / B.length).toFixed(3) + '  HR ' + (c.HR / B.length).toFixed(3) +
        '  BABIP ' + f3((c['1B'] + c['2B'] + c['3B']) / (B.length - c.HR)) + (L ? '   | league 1B ' + (L.totals['1B'] / L.n).toFixed(3) + '  2B ' + (L.totals['2B'] / L.n).toFixed(3) + '  3B ' + (L.totals['3B'] / L.n).toFixed(3) + '  HR ' + (L.totals.HR / L.n).toFixed(3) : ''));
})(typeof arguments !== 'undefined' ? arguments : []);
