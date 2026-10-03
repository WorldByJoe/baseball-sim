/* ============================================================================
   miss_check.js · v0.2 · 2026-10-03

   How far the model's swings miss, measured as Statcast measures miss
   distance: the gap at closest approach between the ball and the barrel half
   of the bat (label to tip), for whiffs. Beside statcast/misses.py's league
   table: per swing, whiffs, fouls and balls in play, the whiffs' miss
   distances, and the share of swings missing by 0-1, 1-3, 3-6 and 6+ in - by
   pitch kind, and for four-seamers by speed. Then the causes of the misses
   beyond 3 in. Picked hitters face the engine's pitchers.

   Run:  jsc bb_engine.js statcast/misses_2025.js headless/miss_check.js -- [hitters] [PA each] [seed]

   CHANGED
     v0.2  familiarity as in games: 40 x u x u pitches of this pitcher seen at the start of each PA (games: median 9 at a swing, mean 12.6; was uniform to 60-80)
     v0.1  first build
============================================================================ */
(function (A) {
  var NB = +A[0] || 1500, NPA = +A[1] || 40, rng = BB.makeRng(+A[2] || 5), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, BALL_R = BB.geometry.BALL_R;
  var KIND = { FF: 'FB', SI: 'FB', FC: 'FB', SL: 'BR', CU: 'BR', ST: 'BR', KC: 'BR', SV: 'BR', CH: 'OS', FS: 'OS', FO: 'OS' };
  var G = { all: [], FB: [], BR: [], OS: [] }, F = { '<92': [], '92-94': [], '94-96': [], '96-98': [], '98+': [] }, BIG = { FB: {}, other: {} }, NBIG = { FB: 0, other: 0 };
  // the gap between the ball and the barrel half of the bat: dLong is + toward the tip from the sweet spot (6 in from the end)
  function gap(s) {
    var r = BB.batRadius(s.bat, BB.SWEET_IN - s.dLong / IN), half = s.bat.lenIn / 2 - BB.SWEET_IN;
    var a = Math.max(0, s.dLong - BB.SWEET_IN * IN, -half * IN - s.dLong), gp = Math.max(0, Math.abs(s.D) - r);
    return Math.max(0, Math.sqrt(gp * gp + a * a) - BALL_R) / IN;
  }
  for (var i = 0; i < 160; i++) P.push(BB.makePitcher(rng, { role: i % 2 ? 'RP' : 'SP' }));
  for (i = 0; i < NB; i++) {
    var B = BB.makeBatter(rng, {});
    for (var j = 0; j < NPA; j++) {
      var Pi = P[(i * 7 + j) % P.length]; Pi.load = rng.u() * 0.7 * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.swing) return;
        var s = q.swing, o;
        if (!s.contact) {
          o = ['whiff', gap(s)];
          if (o[1] > 3) { var rd = q.read, k = s.why + '/' + (rd.same ? 'expected' : rd.detected ? 'read' : rd.late ? 'late' : 'fooled'), g = KIND[q.pitch.type] === 'FB' ? 'FB' : 'other'; BIG[g][k] = (BIG[g][k] || 0) + 1; NBIG[g]++; }
        } else {
          o = [q.bb && !q.bb.fair ? 'foul' : 'bip', null];
          if (q.bb) { var batC = s.batAt || s.batMph, vp = q.pitch.plate ? Math.sqrt(q.pitch.plate.v[0] * q.pitch.plate.v[0] + q.pitch.plate.v[1] * q.pitch.plate.v[1] + q.pitch.plate.v[2] * q.pitch.plate.v[2]) / BB.units.MPH : q.pitch.mph;
                      o[2] = q.bb.ev >= 0.8 * (1.23 * batC + 0.23 * vp); }   // squared up, Statcast's rule
        }
        G.all.push(o); if (KIND[q.pitch.type]) G[KIND[q.pitch.type]].push(o);
        if (q.pitch.type === 'FF') { var v = q.pitch.mph; F[v < 92 ? '<92' : v < 94 ? '92-94' : v < 96 ? '94-96' : v < 98 ? '96-98' : '98+'].push(o); }
      });
    }
  }
  var E = MISSES.edges_in.concat([999]);
  function summ(S) {
    var n = S.length, wh = S.filter(function (s) { return s[0] === 'whiff'; }), m = wh.map(function (s) { return s[1]; }).sort(function (a, b) { return a - b; });
    var con = S.filter(function (s) { return s[0] !== 'whiff' && s.length > 2; });
    return { sq: con.filter(function (s) { return s[2]; }).length / con.length, swings: n, whiff: wh.length / n, foul: S.filter(function (s) { return s[0] === 'foul'; }).length / n, bip: S.filter(function (s) { return s[0] === 'bip'; }).length / n,
             q: [0.1, 0.25, 0.5, 0.75, 0.9].map(function (p) { return m[Math.floor(p * (m.length - 1))]; }),
             sh: E.slice(0, -1).map(function (a, k) { return m.filter(function (x) { return x >= a && x < E[k + 1]; }).length / n; }) };
  }
  function f3(v) { return v.toFixed(3); }
  function line(lab, s, L) {
    print('  ' + (lab + '        ').slice(0, 8) + 'model  whiff ' + f3(s.whiff) + ' foul ' + f3(s.foul) + ' bip ' + f3(s.bip) + '   miss ' + s.q.map(function (x) { return x.toFixed(1); }).join(' ') + '   shares ' + s.sh.map(f3).join(' ') + '   squared-up ' + f3(s.sq) + ' per contact   (' + s.swings + ' swings)');
    print('          league whiff ' + f3(L.whiff) + ' foul ' + f3(L.foul) + ' bip ' + f3(L.bip) + '   miss ' + L.miss_q.map(function (x) { return x.toFixed(1); }).join(' ') + '   shares ' + L.miss_share.map(f3).join(' '));
  }
  print('league squared-up per contact .435 (statcast/fouls.py)');
  print('miss_check v0.2 · ' + NB + ' hitters x ' + NPA + ' PA · per swing: whiff, foul, in play; whiffs\' miss distance (in) p10 p25 p50 p75 p90; share of swings missing by 0-1, 1-3, 3-6, 6+ in');
  ['all', 'FB', 'BR', 'OS'].forEach(function (k) { line(k, summ(G[k]), MISSES.by_kind[k]); });
  print('  four-seamers by speed');
  Object.keys(F).forEach(function (k) { line(k, summ(F[k]), MISSES.ff_by_speed[k]); });
  ['FB', 'other'].forEach(function (g) {
    print('  misses beyond 3 in, ' + (g === 'FB' ? 'fastballs' : 'breaking and off-speed') + ', by cause / read: ' + Object.keys(BIG[g]).sort(function (a, b) { return BIG[g][b] - BIG[g][a]; }).slice(0, 8).map(function (k) { return k + ' ' + (BIG[g][k] / NBIG[g]).toFixed(2); }).join(', '));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
