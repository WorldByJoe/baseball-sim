/* ============================================================================
   fit_swing_policy.js · v0.4 · 2026-10-04

   Fits bb_engine.js's SWING_THR, the batter's swing threshold for each count
   and read ([on, off]: the pitch he sat on or has not told apart from it, and
   one he recognised as something else), to the league's swing probability by
   distance from the zone edge in each count (statcast/discipline.py table 2b,
   loaded from statcast/discipline_2025.js). It plays plate appearances with
   the engine as it stands, records every decision (count, read, his judged
   chance of a strike, his aggression, and the pitch's true distance from the
   edge), then for each count searches both thresholds for the least squared
   error over the ten distance bands, each band weighted by the league's
   pitches in it. The search keeps off >= on: he is never readier to swing at
   a pitch he recognised as something else than at the one he sat on (left
   free, the fit turned that round in four counts to bend the curve's tails
   with where breaking balls go). It also prints the error with one threshold
   for both reads, for comparison. The decisions change which counts are reached, so paste the
   printed table into SWING_THR and rerun until it stops moving. It also reads
   the fitted thresholds by pitch kind against the league's swing curves by
   kind, which the policy cannot shape: they test the perception behind it.

   Run:  jsc bb_engine.js bb_names.js bb_field.js bb_game.js statcast/discipline_2025.js tools/fit_swing_policy.js -- [hitters] [PA each] [seed]

   CHANGED
     v0.4  the check is the engine's: only a pitch he had not picked up (engine v2.7)
     v0.3  a swing counts by its chance of surviving his check at the last look (engine v2.4)
     v0.2  familiarity as in games: 40 x u x u pitches of this pitcher seen at the start of each PA (games: median 9 at a swing, mean 12.6; was uniform to 60-80)
     v0.1  first build (bb_engine v1.2)
============================================================================ */
(function (A) {
  var N = +A[0] || 600, NPA = +A[1] || 40, SEED = +A[2] || 7, IN = BB.units.IN;
  var EDGES = [-99, -6, -4, -2, 0, 2, 4, 6, 9, 12, 99], HALF = (8.5 + 1.45) * IN, R = 1.45 * IN;
  function edgeIn(B, x, z) {
    var lo = B.zone.bot - R, hi = B.zone.top + R, dx = Math.abs(x) - HALF, dz = Math.max(lo - z, z - hi);
    if (dx <= 0 && dz <= 0) return Math.max(dx, dz) / IN;
    return Math.sqrt(Math.pow(Math.max(dx, 0), 2) + Math.pow(Math.max(dz, 0), 2)) / IN;
  }
  function binOf(d) { for (var j = 0; j < EDGES.length - 1; j++) if (d >= EDGES[j] && d < EDGES[j + 1]) return j; return EDGES.length - 2; }
  var rng = BB.makeRng(SEED + 606), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], rec = {};
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {});
    for (var k = 0; k < NPA; k++) {
      var Pi = P[(i * NPA + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (!q.decide) return;
        var c = rec[q.count] = rec[q.count] || [[], []], b = binOf(edgeIn(B, q.pitch.plate.x, q.pitch.plate.z));
        // he swings when pin + aggr > threshold - unless his last look puts it well off the plate and he holds up (engine v2.4;
        // from v2.7 only on a pitch he had not picked up, which checkChance knows)
        var w = BB.checkChance ? 1 - BB.CHECK.hold * BB.checkChance(B, q.read, q.pitch) : 1;   // the chance the swing survives his check
        c[q.decide.state === 'on' ? 0 : 1].push([b, q.decide.pin + B.aggr, BB.PITCH_TYPES[q.pitch.type].kind, w]);
      });
    }
  }
  var COUNTS = ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2'], out = {};
  print('fit_swing_policy v0.1 · seed ' + SEED + ' · ' + N + ' hitters x ' + NPA + ' PA · 120 pitchers');
  COUNTS.forEach(function (cnt) {
    var L = DISCIPLINE.swing_by_edge_count[cnt], c = rec[cnt] || [[], []];
    // per state and band: the sorted values, so the share above a threshold is one binary search
    // per state and band: the values sorted, with the weight (the chance the swing survives his check) summed from the top
    var sorted = [0, 1].map(function (s) { var by = EDGES.slice(1).map(function () { return []; }); c[s].forEach(function (r) { by[r[0]].push([r[1], r[3]]); });
      return by.map(function (v) { v.sort(function (a, b) { return a[0] - b[0]; }); var suf = new Array(v.length + 1); suf[v.length] = 0; for (var j = v.length - 1; j >= 0; j--) suf[j] = suf[j + 1] + v[j][1]; v.suf = suf; return v; }); });
    function above(v, t) { var lo = 0, hi = v.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (v[mid][0] > t) hi = mid; else lo = mid + 1; } return v.suf[lo]; }
    function err(tOn, tOff) {
      var e = 0;
      for (var b = 0; b < 10; b++) {
        var n = sorted[0][b].length + sorted[1][b].length; if (n < 20 || L[b][1] < 30) continue;
        var sw = (above(sorted[0][b], tOn) + above(sorted[1][b], tOff)) / n;
        e += L[b][1] * (sw - L[b][0]) * (sw - L[b][0]);
      }
      return e;
    }
    var best = [0, 0, 1e18], one = [0, 1e18];
    for (var a = -0.2; a <= 1.201; a += 0.01) {
      var e1 = err(a, a); if (e1 < one[1]) one = [a, e1];
      for (var b = a; b <= 1.201; b += 0.01) { var e = err(a, b); if (e < best[2]) best = [a, b, e]; }
    }
    out[cnt] = [Math.round(best[0] * 100) / 100, Math.round(best[1] * 100) / 100]; out[cnt].err = best[2];
    var curve = [];
    for (var bb = 0; bb < 10; bb++) { var n = sorted[0][bb].length + sorted[1][bb].length; curve.push(n ? ((above(sorted[0][bb], best[0]) + above(sorted[1][bb], best[1])) / n).toFixed(2) : ' -  '); }
    var tot = L.reduce(function (s0, x) { return s0 + x[1]; }, 0);
    print('  ' + cnt + '  on ' + out[cnt][0].toFixed(2) + '  off ' + out[cnt][1].toFixed(2) + '  rms ' + Math.sqrt(best[2] / tot).toFixed(3) + '  (one threshold ' + one[0].toFixed(2) + ': rms ' + Math.sqrt(one[1] / tot).toFixed(3) + '; on share ' + (c[0].length / Math.max(1, c[0].length + c[1].length)).toFixed(2) + ')   model ' + curve.join(' ') + '\n' +
          '                                          league ' + L.map(function (x) { return x[0].toFixed(2); }).join(' '));
  });
  // the same thresholds, read by pitch kind (statcast/discipline.py table 2): perception sets these, not the policy
  var KN = { FB: 'fastball', BR: 'breaking', OS: 'offspeed' }, kindErr = 0, kindTot = 0;
  ['FB', 'BR', 'OS'].forEach(function (kd) {
    var sw = EDGES.slice(1).map(function () { return 0; }), n = sw.slice();
    COUNTS.forEach(function (cnt) { var c = rec[cnt]; if (!c) return; [0, 1].forEach(function (st) { c[st].forEach(function (r) { if (r[2] !== kd) return; n[r[0]]++; if (r[1] > out[cnt][st]) sw[r[0]] += r[3]; }); }); });
    var L = DISCIPLINE.swing_by_edge[KN[kd]];
    for (var b = 0; b < 10; b++) if (n[b] >= 20) { kindErr += L[b][1] * Math.pow(sw[b] / n[b] - L[b][0], 2); kindTot += L[b][1]; }
    print('  ' + KN[kd] + ' (all counts)   model ' + sw.map(function (x, b) { return n[b] ? (x / n[b]).toFixed(2) : ' -  '; }).join(' ') + '\n' + '                          league ' + L.map(function (x) { return x[0].toFixed(2); }).join(' '));
  });
  var cntErr = 0, cntTot = 0;
  COUNTS.forEach(function (cnt) { var L = DISCIPLINE.swing_by_edge_count[cnt]; cntErr += out[cnt].err; cntTot += L.reduce(function (s0, x) { return s0 + x[1]; }, 0); });
  print('  rms error: by count ' + Math.sqrt(cntErr / cntTot).toFixed(4) + ', by pitch kind ' + Math.sqrt(kindErr / kindTot).toFixed(4));
  var keys = COUNTS, lines = [];
  for (var j = 0; j < keys.length; j += 6) lines.push('    ' + keys.slice(j, j + 6).map(function (k) { return "'" + k + "': [" + out[k][0].toFixed(2) + ', ' + out[k][1].toFixed(2) + ']'; }).join(', '));
  print('  var SWING_THR = {\n' + lines.join(',\n') + '\n  };');
})(typeof arguments !== 'undefined' ? arguments : []);   // jsc keeps its command-line arguments at top level only
