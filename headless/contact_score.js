/* ============================================================================
   contact_score.js · v0.3 · 2026-10-03

   The contact scorecard: every measured target of what a swing becomes, in
   one table with one score, for rebuilding the swing's contact (scatter
   along the barrel and up and down, contact quality, the read). Model swings
   (picked hitters against 120 picked pitchers) measured as the league's were:
     A  per swing by pitch kind: whiff, foul; and how far whiffs miss
        (Statcast's miss distance: ball to the barrel half of the bat), as
        shares of swings missing by 0-1, 1-3, 3-6, 6+ in (statcast/misses.py)
     B  squared-up per contact, per ball in play, per foul (statcast/fouls.py;
        Statcast's rule with the release speed)
     D  by reach - how far outside the zone the pitch crossed (0 inside it):
        for each kind, the share of swings, whiffs, and misses beyond 3 in
        (statcast/misses.py v0.2)
     C  the vertical miss of tracked contact - launch angle minus attack angle
        at contact - as shares by band, and the foul share and squared-up rate
        in each band (statcast/fouls.py, as in contact_check.js table 6b)
   The score is the root mean square of model minus league over all of them
   (fractions). Four-seam whiffs by speed are printed as an unfitted check.

   Run:  jsc bb_engine.js statcast/misses_2025.js headless/contact_score.js -- [hitters] [PA each] [seed]

   CHANGED
     v0.3  check: each swing's bat speed against the hitter's own mean (statcast/misses.py v0.3)
     v0.2  familiarity as in games: 40 x u x u pitches of this pitcher seen at the start of each PA (games: median 9 at a swing, mean 12.6; was uniform to 60-80)
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 800, NPA = +A[1] || 40, SEED = +A[2] || 5, U = BB.units, IN = U.IN, BALL_R = BB.geometry.BALL_R;
  var rng = BB.makeRng(SEED + 101), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], sw = [];
  var KIND = { FF: 'FB', SI: 'FB', FC: 'FB', SL: 'BR', CU: 'BR', ST: 'BR', KC: 'BR', SV: 'BR', CH: 'OS', FS: 'OS', FO: 'OS' };
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  function gap(s) {
    var r = BB.batRadius(s.bat, BB.SWEET_IN - s.dLong / IN), half = s.bat.lenIn / 2 - BB.SWEET_IN;
    var a = Math.max(0, s.dLong - BB.SWEET_IN * IN, -half * IN - s.dLong), gp = Math.max(0, Math.abs(s.D) - r);
    return Math.max(0, Math.sqrt(gp * gp + a * a) - BALL_R) / IN;
  }
  var DEV = [];
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < NPA; k++) {
      var Pi = P[(i * NPA + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing) return;
        mine.push(q.swing.batAt || q.swing.batMph);
        var s = q.swing, r = { kind: KIND[q.pitch.type], type: q.pitch.type, mph: q.pitch.mph, contact: !!s.contact, reach: s.reach / IN };
        if (!s.contact) r.miss = gap(s);
        else if (q.bb) { var bat = s.batAt || s.batMph; r.ev = q.bb.ev; r.vm = q.bb.la - (s.attackAt !== undefined ? s.attackAt : s.attack); r.fair = !!q.bb.fair; r.sq = q.bb.ev >= 0.8 * (1.23 * bat + 0.23 * q.pitch.mph); }
        else r.fair = false;   // a foul tip into the mitt
        sw.push(r);
      });
    }
    var mb = mine.reduce(function (a, b) { return a + b; }, 0) / mine.length; mine.forEach(function (b) { DEV.push(b - mb); });
  }
  var D = [];   // [label, model, league]
  function f3(v) { return isFinite(v) ? v.toFixed(3) : '  -  '; }
  var E = MISSES.edges_in.concat([999]);
  ['FB', 'BR', 'OS'].forEach(function (kd) {
    var s = sw.filter(function (r) { return r.kind === kd; }), n = s.length, L = MISSES.by_kind[kd];
    D.push([kd + ' whiff', s.filter(function (r) { return !r.contact; }).length / n, L.whiff]);
    D.push([kd + ' foul', s.filter(function (r) { return r.contact && !r.fair; }).length / n, L.foul]);
    E.slice(0, -1).forEach(function (a, j) { D.push([kd + ' miss ' + a + '-' + (E[j + 1] < 999 ? E[j + 1] : '') + ' in', s.filter(function (r) { return r.miss !== undefined && r.miss >= a && r.miss < E[j + 1]; }).length / n, L.miss_share[j]]); });
  });
  var t = sw.filter(function (r) { return r.ev !== undefined; }), tb = t.filter(function (r) { return r.fair; }), tf = t.filter(function (r) { return !r.fair; });
  function sqr(v) { return v.filter(function (r) { return r.sq; }).length / v.length; }
  D.push(['squared-up / contact', sqr(t), .435], ['squared-up / BIP', sqr(tb), .627], ['squared-up / foul', sqr(tf), .225]);
  var VM = [[-90, -60, .029, .098, .657], [-60, -40, .072, .190, .743], [-40, -25, .067, .426, .445], [-25, -15, .061, .614, .213], [-15, -5, .080, .663, .190],
            [-5, 5, .093, .695, .211], [5, 15, .116, .626, .292], [15, 25, .108, .594, .334], [25, 40, .144, .425, .520], [40, 60, .182, .169, .780], [60, 99, .045, .067, .777]];
  VM.forEach(function (b) {
    var v = t.filter(function (r) { return r.vm >= b[0] && r.vm < b[1]; });
    D.push(['vm ' + b[0] + '..' + b[1] + ' share', v.length / t.length, b[2]]);
    D.push(['vm ' + b[0] + '..' + b[1] + ' squared', sqr(v), b[3]]);
    D.push(['vm ' + b[0] + '..' + b[1] + ' foul', v.filter(function (r) { return !r.fair; }).length / v.length, b[4]]);
  });
  var nC = D.length;
  var RB = [['in zone', 0, 1e-9], ['0-3 in out', 1e-9, 3], ['3-6 in out', 3, 6], ['6+ in out', 6, 999]];
  ['FB', 'BR', 'OS'].forEach(function (kd) {
    var s = sw.filter(function (r) { return r.kind === kd; });
    RB.forEach(function (b) {
      var v = s.filter(function (r) { return b[1] === 0 ? r.reach === 0 : r.reach >= b[1] && r.reach < b[2]; }), L = MISSES.by_reach[kd][b[0]];
      D.push([kd + ' ' + b[0] + ' share', v.length / s.length, L.share]);
      D.push([kd + ' ' + b[0] + ' whiff', v.filter(function (r) { return !r.contact; }).length / v.length, L.whiff]);
      D.push([kd + ' ' + b[0] + ' 3+ in', v.filter(function (r) { return r.miss !== undefined && r.miss >= 3; }).length / v.length, L.miss_share[2] + L.miss_share[3]]);
    });
  });
  var ss = 0; D.forEach(function (d) { ss += (d[1] - d[2]) * (d[1] - d[2]); });
  var groups = { 'A misses by kind': D.slice(0, 18), 'B squared-up': D.slice(18, 21), 'C vertical miss': D.slice(21, nC), 'D by reach': D.slice(nC) };
  print('contact_score v0.3 · ' + N + ' hitters x ' + NPA + ' PA · seed ' + SEED + ' · ' + sw.length + ' swings');
  Object.keys(groups).forEach(function (g) {
    var G = groups[g], e = 0; G.forEach(function (d) { e += (d[1] - d[2]) * (d[1] - d[2]); });
    print('  ' + g + ': rms ' + Math.sqrt(e / G.length).toFixed(4));
    for (var j = 0; j < G.length; j += 3) print('    ' + G.slice(j, j + 3).map(function (d) { return (d[0] + '                        ').slice(0, 22) + f3(d[1]) + ' / ' + f3(d[2]); }).join('    '));
  });
  var ff = ['<92', '92-94', '94-96', '96-98', '98+'].map(function (b, j) {
    var lo = [0, 92, 94, 96, 98][j], hi = [92, 94, 96, 98, 999][j], s = sw.filter(function (r) { return r.type === 'FF' && r.mph >= lo && r.mph < hi; });
    return b + ' ' + f3(s.filter(function (r) { return !r.contact; }).length / s.length) + '/' + f3(MISSES.ff_by_speed[b].whiff);
  });
  print('  check (unfitted), four-seam whiff by speed, model/league: ' + ff.join('  '));
  DEV.sort(function (a, b) { return a - b; });
  var BD = MISSES.bat_dev, qs = [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99];
  print('  check, bat speed against the hitter\'s own mean (mph), model/league: ' + qs.map(function (p) { return 'p' + Math.round(100 * p) + ' ' + DEV[Math.floor(p * (DEV.length - 1))].toFixed(1) + '/' + BD.q[String(p)].toFixed(1); }).join('  ') +
        '   >10 below ' + f3(DEV.filter(function (x) { return x < -10; }).length / DEV.length) + '/' + f3(BD.below10));
  print('  SCORE (rms over all ' + D.length + ') ' + Math.sqrt(ss / D.length).toFixed(4));
})(typeof arguments !== 'undefined' ? arguments : []);
