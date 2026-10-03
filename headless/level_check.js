/* ============================================================================
   level_check.js · v0.1 · 2026-10-03

   The pro pool, level by level (bb_engine v2.0: the candidate the scouts rank
   k-th of six plays at level k). Part 1: the traits at each level beside the
   pool's, mean ± sd - the frequency distribution the model holds and how the
   farm filters it. Part 2: N games with both teams drawn from one level, and
   the league line measured as statcast/levels.py measures the league's
   (pooled over all plate appearances and pitches), beside the majors for
   level 1 and Triple-A for level 2. Triple-A is not fitted to: it tests
   whether the pool below the majors has the right shape. Level 2 plays under
   Triple-A's zone: the automated system's zone top, lower than the majors'
   by the measured difference in recorded sz_top (statcast/levels.py), is
   given to the umpire ('mlbzone' turns it off). Zone rates are measured on
   the majors' zone at both levels, as levels.py measures them.

   Run:  jsc bb_engine.js bb_names.js bb_field.js bb_game.js statcast/levels_2025.js headless/level_check.js -- N SEED LEVEL [traits] [mlbzone]
         (LEVEL 1-6; 'traits' adds part 1)

   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 100, SEED = +A[1] || 3, LV = +A[2] || 1, opt = Array.prototype.slice.call(A, 3), TR = opt.indexOf('traits') >= 0;
  var AAA_TOP = LV === 2 && opt.indexOf('mlbzone') < 0 ? (LEVELS.MLB.sz.top - LEVELS.AAA.sz.top) * 12 : 0;   // in: how much lower the zone tops out
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function sd(v) { var m = mean(v); return Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function ms(v, d) { return (mean(v).toFixed(d) + ' ± ' + sd(v).toFixed(d)); }
  if (TR) {
    var rng0 = BB.makeRng(SEED + 1000), M = 3000;
    var HT = [['bat speed (mph)', function (b) { return b.batSpeed; }, 2], ['height (in)', function (b) { return b.heightIn; }, 1], ['weight (lb)', function (b) { return b.weightLb; }, 0],
              ['recognition eyeSD', function (b) { return b.eyeSD; }, 2], ['pitch spotting (in)', function (b) { return b.spotIn; }, 2], ['timing sd (ms)', function (b) { return b.timingSD; }, 1],
              ['along-barrel sd', function (b) { return b.longSD; }, 2], ['swing aggression', function (b) { return b.aggr; }, 3], ['attack angle', function (b) { return b.attack; }, 1]];
    var PT = [['four-seam SP (mph)', function (p) { return p.fbVelo; }, 2, 'SP'], ['four-seam RP (mph)', function (p) { return p.fbVelo; }, 2, 'RP'],
              ['command x SP (in)', function (p) { return p.cmd[0]; }, 2, 'SP'], ['command z SP (in)', function (p) { return p.cmd[1]; }, 2, 'SP'], ['arm angle', function (p) { return p.armAngle; }, 1, 'SP']];
    var cols = ['pool'].concat([1, 2, 3, 4, 5, 6].map(function (k) { return 'level ' + k; }));
    print('PART 1 - the traits by level (' + M + ' draws each; level 1 the majors, 2 Triple-A ... 6 rookie ball)');
    print(pad('', 22) + cols.map(function (c) { return pad(c, 15); }).join(''));
    var Hs = [null, 1, 2, 3, 4, 5, 6].map(function (k) { var S = []; for (var i = 0; i < M; i++) S.push(k ? BB.makeBatter(rng0, { level: k }) : BB.drawBatter(rng0, {})); return S; });
    HT.forEach(function (t) { print(pad(t[0], 22) + Hs.map(function (S) { return pad(ms(S.map(t[1]), t[2]), 15); }).join('')); });
    var Ps = {};
    ['SP', 'RP'].forEach(function (rl) { Ps[rl] = [null, 1, 2, 3, 4, 5, 6].map(function (k) { var S = []; for (var i = 0; i < M / 2; i++) S.push(k ? BB.makePitcher(rng0, { role: rl, level: k }) : BB.drawPitcher(rng0, { role: rl })); return S; }); });
    PT.forEach(function (t) { print(pad(t[0], 22) + Ps[t[3]].map(function (S) { return pad(ms(S.map(t[1]), t[2]), 15); }).join('')); });
    print('');
  }
  var rng = BB.makeRng(SEED), S = BBGame.newStats(), t0 = Date.now();
  var n = 0, zn = 0, sw = 0, wh = 0, zsw = 0, osw = 0, on = 0, zcon = 0, E = [], T = { GB: 0, LD: 0, FB: 0, PU: 0 }, runs = 0, tg = 0;
  for (var g = 0; g < N; g++) {
    var TM = BBNames.teams(rng);
    var away = BBGame.makeTeam(rng, { city: TM[0].city, nick: TM[0].nick, level: LV }), home = BBGame.makeTeam(rng, { city: TM[1].city, nick: TM[1].nick, level: LV });
    var U = null;
    if (AAA_TOP) { U = BB.makeUmp(rng); U.edge.high -= AAA_TOP; }
    var G = BBGame.simGame(away, home, { rng: rng, ump: U });
    [0, 1].forEach(function (i) { var s = G.stats[i]; Object.keys(S).forEach(function (k) { S[k] += s[k]; }); runs += G.score[i]; tg++; });
    G.plays.forEach(function (p) {
      var ps = p.pa.pitches;
      ps.forEach(function (q, j) {
        if (q.result === 'hbp') return;
        var s = !!q.swing, w = q.result === 'swinging_strike';
        n++; if (q.inZone) zn++; if (s) sw++; if (w) wh++;
        if (q.inZone) { if (s) zsw++; if (s && !w) zcon++; } else { on++; if (s) osw++; }
        var bbe = q.result === 'in_play' || q.result === 'hr' || (j === ps.length - 1 && p.pa.foulCaught);
        if (bbe && q.bb) { E.push(q.bb.ev); T[q.bb.la < 10 ? 'GB' : q.bb.la < 25 ? 'LD' : q.bb.la < 50 ? 'FB' : 'PU']++; }
      });
    });
  }
  E.sort(function (a, b) { return b - a; });
  var ab = S.ab, L = LV === 1 ? LEVELS.MLB : LV === 2 ? LEVELS.AAA : null, nt = T.GB + T.LD + T.FB + T.PU;
  function f3(v) { return v.toFixed(3).replace(/^0/, ''); }
  var rows = [
    ['K%', 100 * S.k / S.pa, L && 100 * L.pa.k, 1], ['BB%', 100 * S.bb / S.pa, L && 100 * L.pa.bb, 1], ['HBP%', 100 * S.hbp / S.pa, L && 100 * L.pa.hbp, 2],
    ['HR%', 100 * S.hr / S.pa, L && 100 * L.pa.hr, 2], ['2B%', 100 * S.d / S.pa, L && 100 * L.pa.d2, 2], ['3B%', 100 * S.t / S.pa, L && 100 * L.pa.d3, 2],
    ['AVG', S.h / ab, L && L.pa.avg, 3], ['OBP', (S.h + S.bb + S.hbp) / (ab + S.bb + S.hbp + S.sf), L && L.pa.obp, 3],
    ['SLG', (S.h + S.d + 2 * S.t + 3 * S.hr) / ab, L && L.pa.slg, 3], ['BABIP', (S.h - S.hr) / (ab - S.k - S.hr + S.sf), L && L.pa.babip, 3],
    ['zone rate', zn / n, L && L.swing.zone, 3], ['swing rate', sw / n, L && L.swing.swing, 3], ['z-swing', zsw / zn, L && L.swing.z_swing, 3],
    ['chase', osw / on, L && L.swing.chase, 3], ['whiff per swing', wh / sw, L && L.swing.whiff_per_swing, 3], ['z-contact', zcon / zsw, L && L.swing.z_contact, 3],
    ['exit velo (mph)', mean(E), L && L.bbe.ev, 1], ['hard-hit 95+', E.filter(function (e) { return e >= 95; }).length / E.length, L && L.bbe.hard95, 3],
    ['hardest half (mph)', mean(E.slice(0, E.length >> 1)), L && L.bbe.top_half, 1], ['EV 90th pct', E[Math.floor(E.length / 10)], L && L.bbe.p90, 1],
    ['ground balls', T.GB / nt, L && L.bbe.types.ground_ball, 3], ['line drives', T.LD / nt, L && L.bbe.types.line_drive, 3],
    ['fly balls', T.FB / nt, L && L.bbe.types.fly_ball, 3], ['popups', T.PU / nt, L && L.bbe.types.popup, 3],
    ['runs per team-game', runs / tg, null, 2]];
  print('PART 2 - level ' + LV + ': ' + N + ' games, seed ' + SEED + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s), ' + S.pa + ' PA, ' + n + ' pitches' +
        (AAA_TOP ? '; the umpire\'s zone tops out ' + AAA_TOP.toFixed(1) + ' in lower (Triple-A\'s)' : ''));
  print(pad('', 22) + pad('model', 10) + pad(LV === 1 ? 'MLB' : LV === 2 ? 'AAA' : '', 10));
  rows.forEach(function (r) { print(pad(r[0], 22) + pad(r[1].toFixed(r[3]), 10) + pad(r[2] == null ? '' : r[2].toFixed(r[3]), 10)); });
})(typeof arguments !== 'undefined' ? arguments : []);
