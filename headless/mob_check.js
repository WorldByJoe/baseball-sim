/* ============================================================================
   mob_check.js · v0.2 · 2026-10-05

   Play with men on base in the model, measured the way statcast/men_on_base.py
   measures the league's (loaded first as MOB, statcast/men_on_base_2025.js), on
   whole games:
     A. hitting by base state (bases empty, a man on first only, a man in scoring
        position): BABIP, on the ground and in the air, K%, BB+HBP%; with 'csv' as
        the third argument every ball in play is printed as a CSV row (batter,
        pitcher, state, hit, ground ball) - but these games draw fresh teams, so
        a fixed-effects fit on them means nothing (each player has a handful of
        plate appearances): it needs a season (bb_league);
     B. the ground-ball hit rate by the positioning the base-out state implies, by
        direction (the angle of the spot the ball was fielded, + toward right
        field, and in the batter's frame, + toward his pull side);
     C. which out the infielders take: ground balls fielded by an infielder with a
        man on first and fewer than two out, by the fielder, the exit speed, and
        the runner's and the batter's speed (the league's tertile cuts);
     D. the tag-up: a man on third (and a man on second with third open) on a ball
        caught with fewer than two out - scored, held, out - by the fielder, outs,
        the catch's distance from the plate, the runner's speed and the arm;
     E. throwing errors on ground balls an infielder fielded, by the batter's
        speed, the fielder, the exit speed and whether men were on.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js statcast/men_on_base_2025.js headless/mob_check.js -- [games] [seed] [csv]

   CHANGED
     v0.2  E: throwing errors on infield ground balls
     v0.1  first build (the men-on-base brief, docs/briefs/2026-10-05_men_on_base.md)
============================================================================ */
(function (A) {
  var N = +A[0] || 600, SEED = +A[1] || 3, CSV = A[2] === 'csv', rng = BB.makeRng(SEED), L = typeof MOB !== 'undefined' ? MOB : null;
  var SECT = [-90, -30, -15, 0, 15, 30, 90], SECT_N = ['<-30', '-30..-15', '-15..0', '0..15', '15..30', '>30'];
  var CLS_B = ['empty', 'hold 2 out', 'hold+DP', 'DP', 'R3 <2 out', 'R2', 'other'];
  var SPD = L ? L.C['speed tertiles (ft/s)'] : [26.6, 27.8];
  var HA = {}, HB = { field: {}, pull: {} }, HC = {}, HD = {}, HE = {};
  function inc(o, k, f) { var c = o[k] = o[k] || { n: 0 }; c.n++; Object.keys(f).forEach(function (q) { c[q] = (c[q] || 0) + f[q]; }); }
  function sect(a) { for (var i = 0; i < SECT_N.length; i++) if (a < SECT[i + 1]) return SECT_N[i]; return SECT_N[SECT_N.length - 1]; }
  function posClass(b, o) {
    var r1 = !!b[1], r2 = !!b[2], r3 = !!b[3];
    if (!r1 && !r2 && !r3) return 'empty';
    if (r1 && !r2 && o === 2) return 'hold 2 out';
    if (r1 && !r2 && !r3 && o < 2) return 'hold+DP';
    if (r1 && r2 && !r3 && o < 2) return 'DP';
    if (r3 && o < 2) return 'R3 <2 out';
    if (!r1 && r2 && !r3) return 'R2';
    return 'other';
  }
  function tert(s) { return s < SPD[0] ? 'slow' : s < SPD[1] ? 'mid' : 'fast'; }
  function distBand(d) { var B = [200, 250, 280, 300, 320, 340, 360], N2 = ['<200', '200-250', '250-280', '280-300', '300-320', '320-340', '340-360', '360+']; for (var i = 0; i < B.length; i++) if (d < B[i]) return N2[i]; return N2[N2.length - 1]; }
  if (CSV) print('CSV,batter,pitcher,cls,hit,gb');
  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, T[0]), BBGame.makeTeam(rng, T[1]), { rng: rng });
    G.plays.forEach(function (p) {
      var res = p.pa && p.pa.result; if (!res || res === 'END') return;
      var n = p.pa.pitches.length, last = n ? p.pa.pitches[n - 1] : null;
      var b = last ? (last.basesAfter || last.bases) : p.bases, outs = last ? (last.outsAfter !== undefined ? last.outsAfter : last.outsAt) : p.outs;   // as runs_check reads the state
      var cls = b[2] || b[3] ? 'RISP' : b[1] ? 'on1' : 'empty', r = p.play;
      var sb = BB.batterSide(p.batter, p.pitcher);
      // A. the batter's line by base state
      var isK = res === 'K', isBB = res === 'BB' || res === 'HBP';
      if (res !== 'IBB') inc(HA, cls, { pa: 1, k: isK ? 1 : 0, bb: isBB ? 1 : 0 });
      if (!r || r.hit === 'HR') return;
      var hit = r.hit === '1B' || r.hit === '2B' || r.hit === '3B' ? 1 : 0, gb = r.type === 'GB';
      inc(HA, cls + (gb ? ' gb' : ' air'), { bip: 1, h: hit });
      inc(HA, cls + ' all', { bip: 1, h: hit });
      if (CSV) print('CSV,' + p.batter.id + ',' + p.pitcher.id + ',' + cls + ',' + hit + ',' + (gb ? 1 : 0));
      var fd = r.fielded;
      // B. ground balls by the positioning class and direction
      if (gb && fd) {
        var pc = posClass(b, outs), ang = Math.atan2(fd.at[0], fd.at[1]) / BB.units.DEG;
        [['field', ang], ['pull', ang * sb]].forEach(function (q) { inc(HB[q[0]], pc + '|' + sect(q[1]), { h: hit }); inc(HB[q[0]], pc + '|all', { h: hit }); });
      }
      // C. which out
      if (gb && b[1] && outs < 2 && fd && /^(P|1B|2B|3B|SS)$/.test(fd.who)) {
        var runnerOut = r.runners.some(function (x) { return x.out && x.from > 0; }), bat = r.runners.filter(function (x) { return x.from === 0; })[0];
        var oc = r.dp ? 'DP' : r.hit === 'E' ? 'error' : hit ? 'hit' : runnerOut && !bat.out ? 'lead out' : bat.out ? 'batter out' : r.hit === 'FC' ? 'FC no out' : 'other';
        var f = {}; f[oc] = 1;
        var ev = p.pa.bb.ev, evb = ev < 80 ? '<80' : ev < 90 ? '80-90' : ev < 100 ? '90-100' : '100+';
        inc(HC, 'all|all', f); inc(HC, 'outs|' + outs, f); inc(HC, 'fielder|' + fd.who, f); inc(HC, 'ev|' + evb, f);
        inc(HC, 'runner speed|' + tert(b[1].speed), f); inc(HC, 'batter speed|' + tert(p.batter.speed), f);
        if (!b[2] && !b[3]) inc(HC, 'R1 only|all', f);
      }
      // E. throwing errors on infield ground balls
      if (gb && fd && /^(P|1B|2B|3B|SS)$/.test(fd.who)) {
        var te = (r.events || []).some(function (e) { return e.kind === 'throw' && e.wild; }) ? 1 : 0, evE = p.pa.bb.ev, fe = { te: te };
        inc(HE, 'all|all', fe); inc(HE, 'batter speed|' + tert(p.batter.speed), fe); inc(HE, 'fielder|' + fd.who, fe);
        inc(HE, 'ev|' + (evE < 80 ? '<80' : evE < 90 ? '80-90' : evE < 100 ? '90-100' : '100+'), fe); inc(HE, 'men|' + (b[1] || b[2] || b[3] ? 'on' : 'empty'), fe);
      }
      // D. the tag-up
      var caught = (r.events || []).some(function (e) { return e.kind === 'catch'; });
      if (caught && outs < 2 && (b[3] || b[2])) {
        var cw = (r.events || []).filter(function (e) { return e.kind === 'catch'; })[0].who, of = /^(LF|CF|RF)$/.test(cw);
        var dist = p.pa.bb.dist;
        if (b[3]) {
          var q3 = r.runners.filter(function (x) { return x.from === 3; })[0], o3 = q3.out ? 'out' : q3.to >= 4 ? 'scored' : 'held', f3 = {}; f3[o3] = 1;
          inc(HD, 'R3|all|all', f3); inc(HD, 'R3|fielder|' + (of ? cw : 'IF'), f3); inc(HD, 'R3|outs|' + outs, f3);
          if (of) { inc(HD, 'R3|OF dist|' + distBand(dist), f3); inc(HD, 'R3|OF dist, ' + outs + ' out|' + distBand(dist), f3); inc(HD, 'R3|OF runner speed|' + tert(b[3].speed), f3); f3.hang = p.pa.bb.hang; inc(HD, 'R3|OF hang (s)|' + (p.pa.bb.hang < 4 ? '<4' : p.pa.bb.hang < 4.5 ? '4-4.5' : p.pa.bb.hang < 5 ? '4.5-5' : p.pa.bb.hang < 5.5 ? '5-5.5' : '5.5+'), f3); }
        } else {
          var q2 = r.runners.filter(function (x) { return x.from === 2; })[0], o2 = q2.out ? 'out' : q2.to >= 3 ? 'scored' : 'held', f2 = {}; f2[o2] = 1;
          inc(HD, 'R2 to third|all|all', f2); if (of) { inc(HD, 'R2 to third|OF dist|' + distBand(dist), f2); inc(HD, 'R2 to third|OF fielder|' + cw, f2); }
        }
      }
    });
  }
  function f3(v) { return (v === undefined || v === null || isNaN(v)) ? '  -  ' : v.toFixed(3); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function rpad(s, w) { s = String(s); while (s.length < w) s = s + ' '; return s; }
  print('mob_check v0.2 · ' + N + ' games · seed ' + SEED + (L ? '   (league: ' + L.games + ' games of 2025, statcast/men_on_base.py)' : ''));
  print('');
  print('A. HITTING BY BASE STATE (model | league raw level): empty / on1 / RISP');
  [['BABIP', ' all', 'BABIP'], ['BABIP on the ground', ' gb', 'BABIP on the ground'], ['BABIP in the air', ' air', 'BABIP in the air']].forEach(function (q) {
    var m = ['empty', 'on1', 'RISP'].map(function (c) { var x = HA[c + q[1]]; return x ? x.h / x.bip : NaN; });
    var l = L ? ['empty', 'on1', 'RISP'].map(function (c) { return L.A[q[2]].level[c]; }) : null;
    print('  ' + rpad(q[0], 20) + m.map(f3).join(' / ') + '   gain on1 ' + f3(m[1] - m[0]) + ' RISP ' + f3(m[2] - m[0]) + (l ? '   | ' + l.map(f3).join(' / ') + '   raw gain ' + f3(l[1] - l[0]) + ' ' + f3(l[2] - l[0]) + '; batter+pitcher fixed ' + f3(L.A[q[2]].fe.on1[0]) + ' ' + f3(L.A[q[2]].fe.RISP[0]) : ''));
  });
  print('  ' + rpad('K% / BB+HBP%', 20) + ['empty', 'on1', 'RISP'].map(function (c) { var x = HA[c]; return f3(x.k / x.pa) + ' ' + f3(x.bb / x.pa); }).join(' / ') +
        (L ? '   | ' + ['empty', 'on1', 'RISP'].map(function (c) { return f3(L.A['K%'].level[c]) + ' ' + f3(L.A['BB+HBP% (no IBB)'].level[c]); }).join(' / ') : ''));
  print('');
  print('B. GROUND-BALL HIT RATE by the positioning the state implies, by direction (model | league; n model)');
  ['field', 'pull'].forEach(function (fr) {
    print('  frame: ' + rpad(fr, 10) + SECT_N.concat(['all']).map(function (s) { return pad(s, 19); }).join(''));
    CLS_B.forEach(function (c) {
      var line = '  ' + rpad(c, 17), any = false;
      SECT_N.concat(['all']).forEach(function (s) {
        var m = HB[fr][c + '|' + s], l = L && L.B[fr][c] ? L.B[fr][c][s] : null; if (m) any = true;
        line += pad((m ? f3(m.h / m.n) : '  -  ') + '|' + (l && l[0] !== null ? f3(l[0]) : '  -  ') + ' ' + pad(m ? m.n : 0, 5), 19);
      });
      if (any) print(line);
    });
  });
  print('');
  print('C. WHICH OUT: ground balls fielded by an infielder, a man on first, fewer than two out (model | league shares)');
  var OC = ['DP', 'lead out', 'batter out', 'FC no out', 'hit', 'error'];
  Object.keys(HC).sort().forEach(function (k) {
    var m = HC[k], parts = k.split('|'), l = null;
    if (L) l = parts[0] === 'all' ? L.C.all.all : parts[0] === 'R1 only' ? L.C['R1 only'] : (L.C[parts[0]] || {})[parts[1]];
    print('  ' + rpad(parts[0], 13) + rpad(parts[1], 7) + ' n ' + pad(m.n, 5) + '  ' + OC.map(function (o) { return o + ' ' + f3((m[o] || 0) / m.n) + '|' + (l ? f3(l[o]) : '  -  '); }).join('  '));
  });
  var a = HC['all|all']; if (a) print('  outs on the lead runner among single outs: ' + f3((a['lead out'] || 0) / ((a['lead out'] || 0) + (a['batter out'] || 0))) + (L ? ' | ' + f3(L.C['lead share'].all) : ''));
  print('');
  print('D. THE TAG-UP (caught balls, fewer than two out; model | league)');
  Object.keys(HD).sort().forEach(function (k) {
    var m = HD[k], parts = k.split('|'), l = L && L.D[parts[0]] && L.D[parts[0]][parts[1]] ? L.D[parts[0]][parts[1]][parts[2]] : null;
    print('  ' + rpad(parts[0], 12) + rpad(parts[1], 18) + rpad(parts[2], 9) + ' n ' + pad(m.n, 5) + '  ' + ['scored', 'held', 'out'].map(function (o) { return o + ' ' + f3((m[o] || 0) / m.n) + '|' + (l ? f3(l[o]) : '  -  '); }).join('  ') + (l ? '   (league n ' + l.n + ')' : ''));
  });
  print('');
  print('E. THROWING ERRORS per ground ball an infielder fielded (model | league)');
  ['all', 'batter speed', 'fielder', 'ev', 'men'].forEach(function (by) {
    print('  ' + rpad(by, 13) + Object.keys(HE).filter(function (k) { return k.split('|')[0] === by; }).sort().map(function (k) {
      var x = HE[k], key = k.split('|')[1], l = L && L.E && L.E[by] ? L.E[by][key] : null;
      return key + ' ' + (x.te / x.n).toFixed(4) + '|' + (l ? l[0].toFixed(4) : '  -   ') + ' (' + x.n + ')';
    }).join('   '));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
