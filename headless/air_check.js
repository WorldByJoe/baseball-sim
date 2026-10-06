/* ============================================================================
   air_check.js · v0.1 · 2026-10-06

   The model's liners and fly balls (launch angle 10 to 50 deg, home runs left
   out) and the hits its outfield picked up, in the shape statcast/air_balls.py
   measures the league's, with the league's numbers beside them when
   statcast/air_balls_2025.js is loaded first: caught in the air by hang time,
   and by hang time and the distance from the nearest fielder's AVERAGE spot
   (the league's spots, by the batter's side and the runners, as the league is
   measured); the distance at which half are caught; and where the outfield
   picked up the hits that got through or fell in. Plays whole games.

   Hang time: with statcast/hang_time.js loaded first, solved from the exit
   speed, launch angle and distance exactly as the league's is (and the
   solve's error against the ball's true hang printed); without it, the
   ball's own hang. A ball off the wall is measured where it would have come
   down had the wall not been there (its flight carried on at field level),
   as Statcast's projected distance is.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js statcast/hang_time.js statcast/air_balls_2025.js headless/air_check.js -- [games] [seed]

   CHANGED
     v0.1  first build (the field follow-up brief)
============================================================================ */
(function (A) {
  var N = +A[0] || 300, SEED = +A[1] || 3, L = typeof AIRL !== 'undefined' ? AIRL : null, HS = typeof HangTime !== 'undefined' ? HangTime : null;
  var U = BB.units, FT = U.FT, DEG = U.DEG;
  var HANG_E = L ? L.hang_edges : [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 8.0];
  var DIST_E = L ? L.dist_edges : [0, 10, 20, 30, 45, 60, 75, 90, 110, 140, 400];
  var EV_E = [0, 80, 90, 95, 100, 105, 130], LA3_E = [10, 20, 30, 50], DIR_E = [-50, -30, -12, 12, 30, 50];
  var FIELD7 = ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'], OF = { LF: 1, CF: 1, RF: 1 }, INF = { P: 1, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1 };
  function band(v, E) { if (v === null || v === undefined) return -1; for (var i = 0; i < E.length - 1; i++) if (v >= E[i] && v < E[i + 1]) return i; return -1; }
  function lab(E) { return E.slice(0, -1).map(function (a, i) { return a + '..' + E[i + 1]; }); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function f3(v) { return v === null || v === undefined || isNaN(v) ? '' : v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-'); }
  function q(xs, f) { if (!xs.length) return null; var s = xs.slice().sort(function (a, b) { return a - b; }); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; }
  function logitD50(pts) {   // caught (1/0) against distance: p = 1 / (1 + exp(a + b d)) by Newton with step halving; [d50 = -a/b, scale 1/b, n]
    if (pts.length < 40) return null;
    var any = pts.some(function (p) { return p[1]; }), all = pts.every(function (p) { return p[1]; });
    if (!any || all) return null;
    function ll(a, b) { var t = 0; pts.forEach(function (pt) { var z = Math.max(-30, Math.min(30, a + b * pt[0])); t += pt[1] ? -Math.log1p(Math.exp(z)) : z - Math.log1p(Math.exp(z)); }); return t; }
    var b = 0.1, a = -b * q(pts.map(function (p) { return p[0]; }), 0.5), cur = ll(a, b);
    for (var it = 0; it < 100; it++) {
      var g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
      pts.forEach(function (pt) { var d = pt[0], y = pt[1], z = Math.max(-30, Math.min(30, a + b * d)), p = 1 / (1 + Math.exp(z)), w = p * (1 - p); g0 += p - y; g1 += (p - y) * d; h00 += w; h01 += w * d; h11 += w * d * d; });
      var det = h00 * h11 - h01 * h01; if (det <= 0) return null;
      var da = (h11 * g0 - h01 * g1) / det, db = (-h01 * g0 + h00 * g1) / det, step = 1, na, nb, nw;
      while (step > 1e-4) { na = a + step * da; nb = b + step * db; nw = ll(na, nb); if (nw >= cur) break; step /= 2; }
      if (step <= 1e-4) break;
      a = na; b = nb; cur = nw;
      if (Math.abs(step * da) < 1e-6 && Math.abs(step * db) < 1e-8) break;
    }
    return b > 0 ? [-a / b, 1 / b, pts.length] : null;
  }
  var NOWALL = BB.makeEnv({ fence: [9999, 9999, 9999, 9999, 9999] });
  var SP = {};   // the league's average spots, field frame (x, y) ft
  if (L) Object.keys(L.spots).forEach(function (k) { var s = L.spots[k]; SP[k] = [s[0] * Math.sin(s[1] * DEG), s[0] * Math.cos(s[1] * DEG)]; });
  var rng = BB.makeRng(SEED), Aa = [], C = [], spinBy = {}, ALL = DIR_E.slice(1).map(function () { return [0, 0, 0]; });
  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, T[0]), BBGame.makeTeam(rng, T[1]), { rng: rng });
    G.plays.forEach(function (p) {
      if (!p.play || !p.pa || !p.pa.bb) return;
      var bb = p.pa.bb, r = p.play, sb = p.pa.pitches[p.pa.pitches.length - 1].side, side = sb < 0 ? 'R' : 'L';
      if (bb.hr) return;
      var h = r.hit === '1B' || r.hit === '2B' || r.hit === '3B' ? r.hit : null;
      var fld = r.fielded;
      if (bb.la >= 10 && bb.la < 50) {
        var k2 = Math.floor(bb.la / 2) * 2; (spinBy[k2] = spinBy[k2] || []).push(bb.backspin);
        // where it would have come down: off the wall, the flight carried on through it at field level, as Statcast's projected distance is
        var land = bb.landing, hangT = bb.hang;
        if (bb.kind === 'wall') { var fw = BB.flyBatted([bb.landing[0], bb.landing[1], bb.landZ], bb.landV, bb.landW, NOWALL, false); land = [fw.x, fw.y]; hangT = bb.hang + fw.t; }
        var lx = land[0] / FT, ly = land[1] / FT, run = !p.bases[1] && !p.bases[2] && !p.bases[3] ? 'none' : p.bases[1] && !p.bases[2] && !p.bases[3] ? 'first only' : 'other';
        var near = null, nd = 1e9, ndAct = 1e9, way = null;
        if (L) FIELD7.forEach(function (pos) {
          var s = SP[pos + '|' + side + '|' + run], d = Math.hypot(lx - s[0], ly - s[1]);
          if (d < nd) { nd = d; near = pos; var c = -((lx - s[0]) * s[0] + (ly - s[1]) * s[1]) / (Math.max(d, 1e-6) * Math.hypot(s[0], s[1])); way = c > 0.5 ? 'in' : c < -0.5 ? 'back' : 'side'; }   // his run against the line to home
        });
        if (p.defense) p.defense.forEach(function (F) { if (F.pos === 'P' || F.pos === 'C') return; var d = Math.hypot(lx - F.at[0] / FT, ly - F.at[1] / FT); if (d < ndAct) ndAct = d; });
        var cEv = r.events.filter(function (e) { return e.kind === 'catch'; })[0];
        var hs = HS ? HS.solve(bb.ev, bb.la, Math.hypot(land[0], land[1]) / FT) : null;
        Aa.push({ ev: bb.ev, la: bb.la, hang: hs ? hs[0] : hangT, hangT: hangT, near: near, nd: nd, way: way, ndAct: ndAct, caught: !!cEv, catcher: cEv ? cEv.who : null,
                  hit: h, err: r.hit === 'E', wall: bb.kind === 'wall' });
      }
      var cAt = (r.events.filter(function (e) { return e.kind === 'catch'; })[0] || {}).at || (fld ? fld.at : null);   // where it was caught or fielded
      if (cAt) { var kd = band(Math.atan2(cAt[0], cAt[1]) / DEG, DIR_E); if (kd >= 0) { ALL[kd][0]++; if (h) ALL[kd][1]++; if (bb.la < 10) ALL[kd][2]++; } }
      if (h && fld && OF[fld.who]) {
        var ang = Math.atan2(fld.at[0], fld.at[1]) / DEG;
        C.push({ ev: bb.ev, la: bb.la, ang: ang, fdist: Math.hypot(fld.at[0], fld.at[1]) / FT, land: bb.dist, hit: h, tF: fld.t });
      }
    });
  }
  print('air_check v0.1 · ' + N + ' games · seed ' + SEED + ' · ' + Aa.length + ' liners and flies (10-50 deg, no HR), ' + C.length + ' outfield-fielded hits' + (L ? '   (league below or beside: statcast/air_balls.py, n ' + L.n_air + ' / ' + L.n_cut + ')' : ''));
  if (HS) {
    var e = Aa.map(function (b) { return b.hang - b.hangT; });
    print('hang solve on the model\'s own balls (solved less true, s): median ' + q(e, 0.5).toFixed(2) + ', p10 ' + q(e, 0.1).toFixed(2) + ', p90 ' + q(e, 0.9).toFixed(2));
  }
  print('');
  print('0. THE MODEL\'S BACKSPIN BY LAUNCH ANGLE (rpm, median; 2-deg bands from 10): ' + Object.keys(spinBy).sort(function (a, b) { return a - b; }).map(function (k) { return k + ':' + Math.round(q(spinBy[k], 0.5)); }).join(' '));
  print('');
  function f(a, n) { return n >= 20 ? f3(a / n) : ''; }
  print('1. BY HANG TIME: n, caught in the air, hits per ball, errors; liners (10-25) and flies (25-50) caught; infield share of catches; league row below');
  print(pad('hang', 10) + pad('n', 7) + pad('caught', 8) + pad('hits', 8) + pad('err', 7) + pad('ld.cgt', 9) + pad('fb.cgt', 9) + pad('IF.sh', 8));
  lab(HANG_E).forEach(function (l, i) {
    var s = Aa.filter(function (b) { return band(b.hang, HANG_E) === i; }), ld = s.filter(function (b) { return b.la < 25; }), fb = s.filter(function (b) { return b.la >= 25; }), cg = s.filter(function (b) { return b.caught; });
    print(pad(l, 10) + pad(s.length, 7) + pad(f(cg.length, s.length), 8) + pad(f(s.filter(function (b) { return b.hit; }).length, s.length), 8) + pad(f(s.filter(function (b) { return b.err; }).length, s.length), 7) +
          pad(f(ld.filter(function (b) { return b.caught; }).length, ld.length), 9) + pad(f(fb.filter(function (b) { return b.caught; }).length, fb.length), 9) + pad(f(cg.filter(function (b) { return INF[b.catcher]; }).length, cg.length), 8));
    if (L) { var w = L.by_hang[i]; print(pad('league', 10) + pad(w.n, 7) + pad(f(w.caught, w.n), 8) + pad(f(w.hits, w.n), 8) + pad(f(w.err, w.n), 7) + pad(f(w.ld[0], w.ld[1]), 9) + pad(f(w.fb[0], w.fb[1]), 9) + pad(f(w.if_catch, w.caught), 8)); }
  });
  print('');
  if (L) {
    print('2. CAUGHT BY HANG TIME (rows) AND DISTANCE FROM THE NEAREST FIELDER\'S AVERAGE SPOT (the league\'s spots; ft, columns); n in brackets; blank under 15; league row below');
    print(pad('hang', 10) + ' ' + lab(DIST_E).map(function (l) { return pad(l, 12); }).join(' '));
    lab(HANG_E).forEach(function (l, i) {
      var s = Aa.filter(function (b) { return band(b.hang, HANG_E) === i; });
      print(pad(l, 10) + ' ' + DIST_E.slice(1).map(function (_, j) { var t = s.filter(function (b) { return band(b.nd, DIST_E) === j; }), c = t.filter(function (b) { return b.caught; }).length; return pad((t.length >= 15 ? f3(c / t.length) : '') + ' (' + pad(t.length, 5) + ')', 12); }).join(' '));
      print(pad('league', 10) + ' ' + L.grid[i].map(function (c) { return pad((c[1] >= 15 ? f3(c[0] / c[1]) : '') + ' (' + pad(c[1], 5) + ')', 12); }).join(' '));
    });
    print('');
    print('3. THE DISTANCE (ft) AT WHICH HALF ARE CAUGHT, BY HANG TIME (logistic in distance within the band): d50 / scale (n); nearest an outfielder | an infielder; league beside;');
    print('   last column: the model\'s outfield d50 from where its fielders actually stood');
    print(pad('hang', 10) + pad('model OF', 22) + pad('league OF', 22) + '   |' + pad('model IF', 22) + pad('league IF', 22) + '   |' + pad('model OF, actual spot', 24));
    lab(HANG_E).forEach(function (l, i) {
      var s = Aa.filter(function (b) { return band(b.hang, HANG_E) === i; });
      var o = logitD50(s.filter(function (b) { return OF[b.near]; }).map(function (b) { return [b.nd, b.caught ? 1 : 0]; }));
      var n = logitD50(s.filter(function (b) { return !OF[b.near]; }).map(function (b) { return [b.nd, b.caught ? 1 : 0]; }));
      var oa = logitD50(s.filter(function (b) { return OF[b.near]; }).map(function (b) { return [b.ndAct, b.caught ? 1 : 0]; }));
      var fm = function (v) { return v ? pad(v[0].toFixed(1) + ' / ' + v[1].toFixed(1) + ' (' + v[2] + ')', 22) : pad('', 22); };
      print(pad(l, 10) + fm(o) + fm(L.d50[i].of) + '   |' + fm(n) + fm(L.d50[i]['if']) + '   |' + pad(oa ? oa[0].toFixed(1) + ' / ' + oa[1].toFixed(1) : '', 24));
    });
    print('');
    print('3b. THE SAME FOR BALLS NEAREST AN OUTFIELDER, BY THE WAY HE RUNS: in (toward home), to the side, back; model | league, d50 / s (n)');
    print(pad('hang', 10) + ['in', 'side', 'back'].map(function (w) { return pad('model ' + w, 22) + pad('league ' + w, 22); }).join('   |'));
    lab(HANG_E).forEach(function (l, i) {
      var s = Aa.filter(function (b) { return band(b.hang, HANG_E) === i && OF[b.near]; });
      var fm = function (v) { return v ? pad(v[0].toFixed(1) + ' / ' + v[1].toFixed(1) + ' (' + v[2] + ')', 22) : pad('', 22); };
      print(pad(l, 10) + ['in', 'side', 'back'].map(function (w, k) { return fm(logitD50(s.filter(function (b) { return b.way === w; }).map(function (b) { return [b.nd, b.caught ? 1 : 0]; }))) + fm(L.d50_way ? L.d50_way[i][k] : null); }).join('   |'));
    });
    print('');
  }
  var ld = Aa.filter(function (b) { return b.la < 25; }), fb = Aa.filter(function (b) { return b.la >= 25; });
  function tot(s) { return 'n ' + s.length + ', caught ' + f3(s.filter(function (b) { return b.caught; }).length / s.length) + ', hits ' + f3(s.filter(function (b) { return b.hit; }).length / s.length); }
  print('4. TOTALS: liners (10-25) ' + tot(ld) + '; flies (25-50) ' + tot(fb) + (L ? '   | league liners caught ' + f3(L.totals.ld[1] / L.totals.ld[0]) + ', hits ' + f3(L.totals.ld[2] / L.totals.ld[0]) + '; flies caught ' + f3(L.totals.fb[1] / L.totals.fb[0]) + ', hits ' + f3(L.totals.fb[2] / L.totals.fb[0]) : ''));
  print('');
  print('5. WHERE THE OUTFIELD PICKED UP THE HITS (ft from home): ground balls through (LA < 10) by exit speed and direction (field frame, + toward right field): median / p25 / p75 (n), share doubles + triples; league below');
  print(pad('EV', 10) + ' ' + lab(DIR_E).map(function (l) { return pad(l, 24); }).join(' '));
  lab(EV_E).forEach(function (l, i) {
    print(pad(l, 10) + ' ' + DIR_E.slice(1).map(function (_, k) {
      var s = C.filter(function (b) { return b.la < 10 && band(b.ev, EV_E) === i && band(b.ang, DIR_E) === k; }), fd = s.map(function (b) { return b.fdist; }), xb = s.filter(function (b) { return b.hit !== '1B'; }).length;
      return s.length >= 15 ? pad(q(fd, .5).toFixed(0) + ' /' + pad(q(fd, .25).toFixed(0), 4) + ' /' + pad(q(fd, .75).toFixed(0), 4) + ' (' + pad(s.length, 4) + ') ' + pad(f3(xb / s.length).slice(0, 3), 4), 24) : pad('', 24);
    }).join(' '));
    if (L) print(pad('league', 10) + ' ' + L.cut_gb[i].map(function (c) { return c[3] >= 15 ? pad(c[0].toFixed(0) + ' /' + pad(c[1].toFixed(0), 4) + ' /' + pad(c[2].toFixed(0), 4) + ' (' + pad(c[3], 4) + ') ' + pad(f3(c[4] / c[3]).slice(0, 3), 4), 24) : pad('', 24); }).join(' '));
  });
  print('');
  print('6. LINERS AND FLIES THAT FELL FOR HITS (10-50 deg), fielded by an outfielder: by launch angle (rows) and exit speed (columns): median distance picked up less where it came down (ft) (n), share doubles + triples; league below');
  print(pad('LA', 10) + ' ' + lab(EV_E).map(function (l) { return pad(l, 18); }).join(' '));
  lab(LA3_E).forEach(function (l, j) {
    print(pad(l, 10) + ' ' + EV_E.slice(1).map(function (_, i) {
      var s = C.filter(function (b) { return band(b.la, LA3_E) === j && band(b.ev, EV_E) === i; }), dd = s.map(function (b) { return b.fdist - b.land; }), xb = s.filter(function (b) { return b.hit !== '1B'; }).length;
      return s.length >= 15 ? pad(q(dd, .5).toFixed(0) + ' (' + pad(s.length, 4) + ') ' + pad(f3(xb / s.length).slice(0, 3), 4), 18) : pad('', 18);
    }).join(' '));
    if (L) print(pad('league', 10) + ' ' + L.cut_air[j].map(function (c) { return c[1] >= 15 ? pad(c[0].toFixed(0) + ' (' + pad(c[1], 4) + ') ' + pad(f3(c[2] / c[1]).slice(0, 3), 4), 18) : pad('', 18); }).join(' '));
  });
  print('');
  print('7. DOUBLES AND TRIPLES BY WHERE THEY WERE PICKED UP: share of the outfield-fielded hits in each direction, and median distance picked up (ft); league below');
  print(pad('', 10) + ' ' + lab(DIR_E).map(function (l) { return pad(l, 22); }).join(' '));
  ['1B', '2B', '3B'].forEach(function (h, hi) {
    print(pad(h, 10) + ' ' + DIR_E.slice(1).map(function (_, k) { var s = C.filter(function (b) { return band(b.ang, DIR_E) === k; }), t = s.filter(function (b) { return b.hit === h; }); return s.length ? pad(f3(t.length / s.length) + ' of ' + pad(s.length, 5) + ', ' + pad((q(t.map(function (b) { return b.fdist; }), .5) || 0).toFixed(0), 4) + ' ft', 22) : pad('', 22); }).join(' '));
    if (L) print(pad('league', 10) + ' ' + L.xb_dir[hi].map(function (c) { return c[1] ? pad(f3(c[0] / c[1]) + ' of ' + pad(c[1], 5) + ', ' + pad((c[2] || 0).toFixed(0), 4) + ' ft', 22) : pad('', 22); }).join(' '));
  });
  print('');
  print('8. EVERY BALL IN PLAY (home runs out) BY DIRECTION (where it was fielded or caught, field frame): share of balls, hits per ball, ground-ball share; league below');
  var nAll = ALL.reduce(function (a, c) { return a + c[0]; }, 0);
  print(pad('', 10) + ' ' + lab(DIR_E).map(function (l) { return pad(l, 22); }).join(' '));
  print(pad('model', 10) + ' ' + ALL.map(function (c) { return pad(f3(c[0] / nAll) + ' ' + f3(c[1] / c[0]) + ' ' + f3(c[2] / c[0]), 22); }).join(' '));
  if (L && L.dir_all) { var nL = L.dir_all.reduce(function (a, c) { return a + c[0]; }, 0); print(pad('league', 10) + ' ' + L.dir_all.map(function (c) { return pad(f3(c[0] / nL) + ' ' + f3(c[1] / c[0]) + ' ' + f3(c[2] / c[0]), 22); }).join(' ')); }
})(typeof arguments !== 'undefined' ? arguments : []);
