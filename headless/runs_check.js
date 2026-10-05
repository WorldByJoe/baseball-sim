/* ============================================================================
   runs_check.js · v0.1 · 2026-10-05

   Where the runs leak between the game's events and its scoreboard, measured
   on whole games the way statcast/runs_league.py measures the league's
   (loaded first as RUNSL, statcast/runs_league_2025.js): BaseRuns against
   actual runs per team-game; the RE24 table (runs to the end of the inning
   from each of the 24 base-out states); the transitions by event and state
   (where a runner on second went on a single, a runner on first on a double,
   a runner on third on an air out, double plays per ground-ball chance,
   runners out on the bases, the running game per chance); and every event
   per team-game. Each transition's cost in runs a team-game is the chances
   times the difference in shares, each outcome valued by the model's own
   plays (the runs on the play plus the run expectancy of the state it left).

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js statcast/runs_league_2025.js headless/runs_check.js -- [games] [seed]

   CHANGED
     v0.1  first build (the bug audit, docs/briefs/2026-10-05_bug_audit.md)
============================================================================ */
(function (A) {
  var N = +A[0] || 300, SEED = +A[1] || 3, rng = BB.makeRng(SEED), L = typeof RUNSL !== 'undefined' ? RUNSL : null;
  var E = {}, RE = {}, TR = {}, VAL = {}, games = 0, S = BBGame.newStats(), lob = 0, lisp = 0;
  var HS = {}; ['empty', 'on', 'RISP'].forEach(function (c) { HS[c] = { pa: 0, k: 0, bb: 0, ab: 0, h: 0, hr: 0, bip: 0, gb: 0, gbh: 0, gbfc: 0, air: 0, airh: 0, airfc: 0, fc: 0, roe: 0, ev: 0, la: 0, aheadOfThrow: 0, stretchOut: 0, aircaught: 0 }; });
  function inc(k, n) { E[k] = (E[k] || 0) + (n === undefined ? 1 : n); }
  function stKey(outs, b) { return outs + ':' + [1, 2, 3].map(function (i) { return b[i] ? i : '-'; }).join(''); }
  function tr(cat, outcome, value) {
    var t = TR[cat] = TR[cat] || { n: 0 }; t.n++; t[outcome] = (t[outcome] || 0) + 1;
    var v = VAL[cat + '|' + outcome] = VAL[cat + '|' + outcome] || [0, 0]; v[0] += value; v[1]++;
  }
  var plays = [];   // every transition play, valued after the RE table is known
  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng), G = BBGame.simGame(BBGame.makeTeam(rng, T[0]), BBGame.makeTeam(rng, T[1]), { rng: rng });
    games++;
    [0, 1].forEach(function (i) { var s = G.stats[i]; Object.keys(S).forEach(function (k) { S[k] += s[k]; }); });
    G.innings.forEach(function (inn) {
      var cum = 0;
      inn.plays.forEach(function (p) {
        var toEnd = inn.runs - cum; cum += p.runs;
        if (p.pa.result !== 'END') { var k = stKey(p.outs, p.bases); var re = RE[k] = RE[k] || [0, 0]; re[0] += toEnd; re[1]++; }
        var res = p.pa.result, r = p.play, nP = p.pa.pitches.length, lastRec = nP ? p.pa.pitches[nP - 1] : null;
        var s0 = lastRec ? (lastRec.basesAfter || lastRec.bases) : p.bases, outs0 = lastRec ? (lastRec.outsAfter !== undefined ? lastRec.outsAfter : lastRec.outsAt) : p.outs;
        p.pa.pitches.forEach(function (rec) {
          var b = rec.bases;
          if (b[1] || b[2] || b[3]) inc('pitches with runners on');
          if (b[1] && !b[2]) inc('steal chances (pitches with R1, 2nd open)');
          if (rec.steal && !rec.steal.back) { inc(rec.steal.safe ? 'SB' : 'CS'); if (rec.steal.safe && rec.steal.wild) inc('E on a steal throw'); }
          if (rec.wild) inc(rec.wild.kind);
          (rec.pickoffs || []).forEach(function (ev) { inc('pickoff throws'); if (ev.out) inc('picked off'); if (ev.error) inc('E on a pickoff'); });
          // the running game as the league's pitch data shows it: between two pitches of an at-bat a runner moved up (a steal, a
          // wild pitch, a passed ball, a balk) or vanished (thrown out, picked off, or scored on a wild pitch)
          if (rec.basesAfter) { var moved = 0, gone = 0; [1, 2, 3].forEach(function (i) { var pl = b[i]; if (!pl) return; var at = [1, 2, 3].filter(function (j) { return rec.basesAfter[j] === pl; })[0]; if (!at) gone++; else if (at > i) moved++; }); inc('runners moved up between pitches', moved); inc('runners gone between pitches', gone); }
          (rec.pickoffs || []).forEach(function (ev) { if (ev.out) inc('runners gone between pitches'); });
        });
        (p.pa.pickoffsEnd || []).forEach(function (ev) { inc('pickoff throws'); if (ev.out) { inc('picked off'); inc('runners gone between pitches'); } });
        // hitting by base state: the batter's own line with the bases empty, men on, a man in scoring position
        var cls = s0[2] || s0[3] ? 'RISP' : s0[1] ? 'on' : 'empty', hs = HS[cls];
        if (res !== 'END') { hs.pa++; if (res === 'K') hs.k++; else if (res === 'BB' || res === 'IBB' || res === 'HBP') hs.bb++; else if (r) { hs.ab++; if (r.hit === 'SF') hs.ab--; if (r.hit === '1B' || r.hit === '2B' || r.hit === '3B') { hs.h++; hs.bip++; } else if (r.hit === 'HR') { hs.h++; hs.hr++; } else hs.bip++;
          if (r.hit !== 'HR') { var gbk = r.type === 'GB' ? 'gb' : 'air', isH = r.hit === '1B' || r.hit === '2B' || r.hit === '3B'; hs[gbk]++; if (isH) hs[gbk + 'h']++; if (r.hit === 'FC') { hs.fc++; hs[gbk + 'fc']++; } if (r.hit === 'E') hs.roe++; hs.ev += p.pa.bb.ev; hs.la += p.pa.bb.la; if (isH && /ahead of the throw/.test(r.desc)) hs.aheadOfThrow++;
            var bq = r.runners.filter(function (x) { return x.from === 0; })[0]; if (bq && bq.out && bq.to >= 2) hs.stretchOut++; if (gbk === 'air' && (r.events || []).some(function (e) { return e.kind === 'catch'; })) hs.aircaught++; } } }
        if (res === 'K') inc('K'); else if (res === 'BB') inc('BB'); else if (res === 'IBB') { inc('BB'); inc('IBB'); } else if (res === 'HBP') inc('HBP');
        else if (r) {
          var bat = r.runners.filter(function (q) { return q.from === 0; })[0], batterOut = bat && bat.out;
          var isHit = r.hit === '1B' || r.hit === '2B' || r.hit === '3B' || r.hit === 'HR';
          inc('balls in play');
          inc(r.hit === 'E' ? 'ROE' : r.hit === 'OUT' ? 'outs in play' : r.hit);
          if (r.dp) inc('DP');
          if (r.error) inc((r.events || []).some(function (e) { return e.kind === 'throw' && e.wild; }) ? 'E throwing' : (r.events || []).some(function (e) { return e.kind === 'drop'; }) ? 'E dropped fly' : 'E fumbled grounder');
          var runnerOuts = r.runners.filter(function (q) { return q.out && q.from > 0; }).length;
          if (runnerOuts) inc(/force out|double play/.test(r.desc) ? 'runners forced out' : 'runners out on the bases (tag)', runnerOuts);
          if (isHit && (s0[1] || s0[2] || s0[3])) { inc('hits with runners on'); if (runnerOuts) inc('runner out on a hit'); }
          var caught = (r.events || []).some(function (e) { return e.kind === 'catch'; });
          var after = p.outsAfter >= 3 ? null : stKey(p.outsAfter, p.basesAfter);
          // where a runner went; a man who crossed the plate on a third-out force did not score: 'left', as the league's table has it
          var crossed = r.runners.filter(function (x) { return !x.out && x.to >= 4 && x.from > 0; }).sort(function (a, b) { return b.from - a.from; }), credited = r.runs - (bat && !bat.out && bat.to >= 4 ? 1 : 0);
          function went(pl) { var q = r.runners.filter(function (x) { return x.id === pl.id; })[0]; return !q ? 'missing' : q.out ? 'out' : q.to >= 4 ? (crossed.indexOf(q) < credited ? 'scored' : 'left') : 'base' + q.to; }
          var oo = ', ' + outs0 + ' out';
          function rec(cat, who) { plays.push({ cat: cat + oo, out: went(who), runs: r.runs, after: after }); }
          if (r.hit === '1B') { if (s0[2]) rec('single, R2', s0[2]); if (s0[1]) rec('single, R1', s0[1]); if (s0[3]) rec('single, R3', s0[3]); }
          if (r.hit === '2B') { if (s0[1]) rec('double, R1', s0[1]); if (s0[2]) rec('double, R2', s0[2]); if (s0[3]) rec('double, R3', s0[3]); }
          if (caught && outs0 < 2) { if (s0[3]) rec('air out, R3', s0[3]); if (s0[2] && !s0[3]) rec('air out, R2 (3rd open)', s0[2]); if (s0[1] && !s0[2]) rec('air out, R1 (2nd open)', s0[1]); }
          if (r.type === 'GB' && outs0 < 2 && s0[1]) plays.push({ cat: 'ground ball, R1' + oo, out: r.dp ? 'DP' : r.hit === 'FC' ? 'FC' : batterOut ? 'batter out' : r.hit === 'E' ? 'error' : 'hit', runs: r.runs, after: after });
          var gbOut = r.type === 'GB' && !r.error && (r.hit === 'OUT' || r.hit === 'FC');
          if (gbOut && outs0 < 2) { if (s0[3]) rec('ground out, R3', s0[3]); if (s0[2] && !s0[3]) rec('ground out, R2 (3rd open)', s0[2]); }
        }
      });
      var lastP = inn.plays[inn.plays.length - 1];
      if (lastP && lastP.outsAfter === 3) { var b = lastP.basesAfter; lob += (b[1] ? 1 : 0) + (b[2] ? 1 : 0) + (b[3] ? 1 : 0); lisp += (b[2] ? 1 : 0) + (b[3] ? 1 : 0); }
    });
  }
  var tg = 2 * games;
  // An outcome's value, in runs: the runner's own run if he scored, plus the run expectancy of the state his outcome
  // leaves in the category's bare case (the runner alone, the batter where the event puts him), from the league's RE24
  // where it is loaded (what the league goes on to score from there), else the model's own. The bare case keeps the
  // other runners out of the valuation: a man held at third on a single is not worth more because the man ahead of
  // him scored on the same play.
  function reOf(o, s) { if (o >= 3) return 0; var k = o + ':' + s; if (L && L.re[k]) return L.re[k][0]; return RE[k] && RE[k][1] ? RE[k][0] / RE[k][1] : 0; }
  function valueOf(cat, o, outc) {
    var kind = cat.replace(/, \d out$/, ''), batterOn = /^single/.test(kind) ? '1' : /^double/.test(kind) ? '2' : null, o1 = o + 1;
    function st(r, b) { return (b === '1' || r === 1 ? '1' : '-') + (b === '2' || r === 2 ? '2' : '-') + (r === 3 ? '3' : '-'); }
    if (batterOn) {   // a hit: the runner scored, is on a base, or was put out (the batter on his base)
      if (outc === 'scored') return 1 + reOf(o, st(0, batterOn));
      if (outc === 'out') return reOf(o1, st(0, batterOn));
      if (/^base/.test(outc)) return reOf(o, st(+outc.slice(4), batterOn));
      return reOf(o, st(0, batterOn));
    }
    if (/^ground ball/.test(kind)) {   // a man on first and a ground ball: what the batter's ball did
      if (outc === 'DP') return reOf(o + 2, '---');
      if (outc === 'FC') return reOf(o1, '1--');
      if (outc === 'batter out') return reOf(o1, '-2-');
      if (outc === 'sac_bunt') return reOf(o1, '-2-');
      return reOf(o, '12-');   // a hit or an error: the bare case, both on
    }
    // an out in the air or on the ground: the batter is out; the runner scored, held, advanced or was put out (on a
    // ground out a runner put out means the batter reached: a fielder's choice)
    var fc = /^ground out/.test(kind);
    if (outc === 'scored') return 1 + reOf(o1, '---');
    if (outc === 'out') return fc ? reOf(o1, '1--') : reOf(o + 2, '---');
    if (outc === 'left') return 0;
    if (/^base/.test(outc)) return reOf(o1, st(+outc.slice(4), null));
    return reOf(o1, '---');
  }
  plays.forEach(function (q) { tr(q.cat, q.out, 0); });
  Object.keys(VAL).forEach(function (k) { var parts = k.split('|'), o = +parts[0].match(/(\d) out$/)[1]; VAL[k] = [valueOf(parts[0], o, parts[1]), 1]; });
  function f(v, d) { return (v === undefined || v === null || isNaN(v)) ? '   -' : v.toFixed(d === undefined ? 2 : d); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function rpad(s, w) { s = String(s); while (s.length < w) s = s + ' '; return s; }
  print('runs_check v0.1 · ' + games + ' games · seed ' + SEED + (L ? '   (league: ' + L.games + ' games of 2025, statcast/runs_league.py)' : '   (no league table loaded)'));
  // 1. BaseRuns
  var H = S.h, BBn = S.bb, HBP = S.hbp, HR = S.hr, TB = S.h + S.d + 2 * S.t + 3 * S.hr, AB = S.ab;
  var Ab = H + BBn + HBP - HR, Bb = 1.02 * (1.4 * TB - 0.6 * H - 3 * HR + 0.1 * (BBn + HBP)), Cb = AB - H, BsR = Ab * Bb / (Bb + Cb) + HR;
  print('');
  print('1. BASERUNS against actual runs, per team-game: runs ' + f(S.r / tg) + '  BaseRuns ' + f(BsR / tg) + '  ratio ' + f(S.r / BsR, 3) + (L ? '   | league runs ' + f(L.runs) + ' BaseRuns ' + f(L.baseruns) + ' ratio ' + f(L.runs / L.baseruns, 3) : ''));
  // 2. RE24
  print('');
  print('2. RE24: runs to the end of the inning from each base-out state (model | league; n in brackets)');
  var STATES = ['---', '1--', '-2-', '--3', '12-', '1-3', '-23', '123'];
  print(pad('bases', 7) + [0, 1, 2].map(function (o) { return pad(o + ' out', 24); }).join(''));
  STATES.forEach(function (s) {
    print(pad(s, 7) + [0, 1, 2].map(function (o) { var k = o + ':' + s, m = RE[k], l = L && L.re[k]; return pad(f(m ? m[0] / m[1] : NaN, 3) + ' (' + (m ? m[1] : 0) + ')', 13) + pad(l ? '| ' + f(l[0], 3) : '|    -', 11); }).join(''));
  });
  // 3. transitions
  print('');
  print('3. TRANSITIONS by event and state: share of chances by outcome (model | league), chances per team-game, and the runs a team-game the difference costs (+ = the model loses runs)');
  var CATS = [];
  ['single, R2', 'single, R1', 'single, R3', 'double, R1', 'double, R2', 'double, R3', 'air out, R3', 'air out, R2 (3rd open)', 'air out, R1 (2nd open)', 'ground ball, R1', 'ground out, R3', 'ground out, R2 (3rd open)'].forEach(function (c) { [0, 1, 2].forEach(function (o) { CATS.push(c + ', ' + o + ' out'); }); });
  var OUTS = ['scored', 'base3', 'base2', 'base1', 'out', 'DP', 'FC', 'batter out', 'error', 'hit', 'left'];
  var totalCost = 0;
  CATS.forEach(function (c) {
    var m = TR[c], l = L && L.tr[c]; if (!m) return;
    var line = rpad(c, 34) + pad(m.n, 6) + ' (' + f(m.n / tg) + '/tg)', cost = 0;
    OUTS.forEach(function (o) {
      var ms = (m[o] || 0) / m.n, ls = l ? (l[o] || 0) : null;
      if (!(m[o] || (l && l[o]))) return;
      line += '   ' + o + ' ' + f(ms) + '|' + (ls === null ? ' -  ' : f(ls));
      if (ls !== null) { var v = VAL[c + '|' + o]; var mv = v && v[1] ? v[0] / v[1] : 0; cost += (ls - ms) * mv; }
    });
    cost *= m.n / tg; totalCost += cost;
    print(line + (l ? '   cost ' + (cost >= 0 ? '+' : '') + f(cost, 3) : ''));
  });
  if (L) print('   sum of the transition costs: ' + (totalCost >= 0 ? '+' : '') + f(totalCost, 3) + ' runs a team-game');
  // the running game per chance
  print('');
  var pr = E['pitches with runners on'] || 1;
  print('4. THE RUNNING GAME per 1000 pitches with runners on (model | league; the league\'s pitch data shows only the state between pitches, so steals, wild pitches, passed balls and balks are one count, and runners thrown out, picked off or scored on a wild pitch another):' +
        '  moved up ' + f(1000 * (E['runners moved up between pitches'] || 0) / pr, 1) + (L ? ' | ' + f(1000 * L.events['runners moved up between pitches'] / L.events['pitches with runners on'], 1) : '') +
        ';  gone ' + f(1000 * (E['runners gone between pitches'] || 0) / pr, 1) + (L ? ' | ' + f(1000 * L.events['runners gone between pitches'] / L.events['pitches with runners on'], 1) : '') +
        ';  the model\'s parts: SB ' + f(1000 * (E.SB || 0) / pr, 1) + ' CS ' + f(1000 * (E.CS || 0) / pr, 1) + ' WP ' + f(1000 * (E.WP || 0) / pr, 1) + ' PB ' + f(1000 * (E.PB || 0) / pr, 1) + ' picked off ' + f(1000 * (E['picked off'] || 0) / pr, 1) +
        ';  runner out on a hit ' + f(100 * (E['runner out on a hit'] || 0) / (E['hits with runners on'] || 1), 1) + '% of hits with runners on' + (L ? ' | ' + f(100 * L.events['runner out on a hit'] / L.events['hits with runners on'], 1) + '%' : ''));
  // 5. hitting by base state
  print('');
  print('5. HITTING BY BASE STATE (model | league): K%, BB+HBP%, AVG, BABIP, HR% - the batter\'s own line, so a gap here is the hitting, not the running');
  ['empty', 'on', 'RISP'].forEach(function (c) {
    var h = HS[c], l = L && L.hit && L.hit[c];
    function line(q) { return pad(q.pa, 7) + '  K ' + f(100 * q.k / q.pa, 1) + '  BB ' + f(100 * q.bb / q.pa, 1) + '  AVG ' + f(q.h / q.ab, 3).replace(/^0/, '') + '  BABIP ' + f((q.h - q.hr) / q.bip, 3).replace(/^0/, '') + '  HR ' + f(100 * q.hr / q.pa, 1); }
    function line2(q) { return 'BABIP on the ground ' + f(q.gbh / (q.gb || 1), 3).replace(/^0/, '') + ' in the air ' + f(q.airh / (q.air || 1), 3).replace(/^0/, '') + '  FC per ground ball ' + f(q.gbfc / (q.gb || 1), 3).replace(/^0/, '') + ' per air ball ' + f(q.airfc / (q.air || 1), 3).replace(/^0/, '') + '  ROE/BIP ' + f(q.roe / (q.bip || 1), 3).replace(/^0/, '') + '  EV ' + f(q.ev / (q.nq || q.bip || 1), 1) + '  LA ' + f(q.la / (q.nq || q.bip || 1), 1) + (q.aheadOfThrow !== undefined ? '  hits with the lead runner played on and safe ' + f(q.aheadOfThrow / (q.bip || 1), 3).replace(/^0/, '') + '  batter out past first ' + f(q.stretchOut / (q.bip || 1), 3).replace(/^0/, '') + '  air balls caught ' + f(q.aircaught / (q.air || 1), 3).replace(/^0/, '') : ''); }
    print('   ' + rpad(c === 'on' ? 'man on first only' : c === 'RISP' ? 'scoring position' : 'bases empty', 20) + line(h) + (l ? '   | ' + line(l) : ''));
    print('   ' + rpad('', 20) + line2(h) + (l ? '   | ' + line2(l) : ''));
  });
  // 6. events per team-game
  print('');
  print('6. EVENTS per team-game (model | league)');
  E.LOB = lob; E.LISP = lisp;
  var KEYS = ['1B', '2B', '3B', 'HR', 'BB', 'IBB', 'HBP', 'K', 'SF', 'outs in play', 'DP', 'FC', 'ROE', 'E throwing', 'E fumbled grounder', 'E dropped fly', 'E on a steal throw', 'E on a pickoff', 'SB', 'CS', 'picked off', 'pickoff throws', 'WP', 'PB', 'runners forced out', 'runners out on the bases (tag)', 'runner out on a hit', 'hits with runners on', 'balls in play', 'LOB', 'LISP'];
  KEYS.forEach(function (k) { var m = (E[k] || 0) / tg, l = L && L.events[k] !== undefined ? L.events[k] : null; print('  ' + rpad(k, 32) + pad(f(m), 7) + (l !== null ? pad('| ' + f(l), 9) : '') ); });
})(typeof arguments !== 'undefined' ? arguments : []);
