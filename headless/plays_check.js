/* ============================================================================
   plays_check.js · v0.9 · 2026-10-05

   Constructed plays through BBField.resolve, each a regression test for a
   bug the audit found (docs/briefs/2026-10-05_bug_audit.md): a fixed
   defence, a batted ball built from exit speed, launch angle and spray, the
   runners placed by hand, and a stand-in for the dice where a case needs
   one (a throw that must go wild). Prints each case and PASS or FAIL.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js headless/plays_check.js

   CHANGED
     v0.9  a fly the fielder was under and dropped is an error, not a hit; the tag-up is a read, as a send home on a
           hit is (bb_field v1.9)
     v0.8  the defence sets up on the pool's average bat speed and pull, and case 1 throws true, so a case does not
           move when the chain refits the pool (cases 1 and 5 had stopped testing what they were written for)
     v0.7  the second baseman covers second on a ball to third; a double play's relay waits for the man covering first;
           the throw goes for the out worth the most runs (bb_field v1.8)
     v0.6  a force tried and thrown away is an error, not a fielder's choice (bb_field v1.7)
     v0.5  a batter thrown out past first keeps the hit that got him there (bb_field v1.6)
============================================================================ */
(function () {
  var U = BB.units, MPH = U.MPH, DEG = U.DEG, env = BB.makeEnv({}), fails = 0, cases = 0;
  var rng = BB.makeRng(7), POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  var fielders = POS.map(function (pos) { return BB.makeBatter(rng, { pos: pos }); });
  var P = BB.makePitcher(rng, { role: 'SP' }); P.pos = 'P';
  var D = BBField.makeDefense(fielders.concat([P]));
  function runner(aggr, speed) {   // the defence sets up on his bat speed and pull: the pool's average, so a case does not move with the pool's refits
    var b = BB.makeBatter(rng, { pos: 'LF' }); b.runAggr = aggr || 0; b.speed = speed || 27; b.jump = 0.22;
    b.batSpeed = BB.TRAITS.batSpeed[0]; b.pullBias = BB.TRAITS.pullBias[0]; return b;
  }
  function batted(ev, la, spray) {   // a batted ball from the engine's own flight, as simPA builds one
    var v = ev * MPH, col = { v: [v * Math.cos(la * DEG) * Math.sin(spray * DEG), v * Math.cos(la * DEG) * Math.cos(spray * DEG), v * Math.sin(la * DEG)], w: [0, 0, 0], q: 1 };
    return BB.battedBall({ plate: { x: 0, z: 0.8 } }, col, env, true);
  }
  function where(out) { return out.runners.map(function (r) { return r.from + '->' + (r.out ? 'out' : r.to >= 4 ? 'home' : r.to); }).join(' ') + ' | ' + out.hit + ', runs ' + out.runs + ', outs ' + out.outsMade + ': ' + out.desc; }
  function check(name, ok, detail) { cases++; if (!ok) fails++; print((ok ? 'PASS ' : 'FAIL ') + name + '\n       ' + detail); }
  function resolve(bb, bases, outs, dice, side, batter) {
    var B = batter || runner(0); BBField.positionDefense(D, B, side || -1);
    return BBField.resolve(bb, B, bases, outs, D, env, dice || BB.makeRng(1), { side: side || -1, going: 0 });
  }
  function distinct(out) { var seen = {}; for (var i = 1; i <= 3; i++) if (out.bases[i]) { if (seen[out.bases[i].id]) return false; seen[out.bases[i].id] = 1; } return true; }
  function conserved(out, n) { var on = 0; for (var i = 1; i <= 3; i++) if (out.bases[i]) on++; return on + out.outsMade + out.runs === n; }

  // 1. The runner behind a man who scores may score too (bb_field v1.2). Bases loaded, two out, a ball driven into the
  //    right-field corner: the men from third and second both score ahead of the throw. Until v1.2 the second man was
  //    held to the base below the man ahead even when the man ahead had crossed the plate: no single, double or triple
  //    ever scored two runs.
  var bb = batted(103, 12, 40), out = resolve(bb, [null, runner(0), runner(0), runner(0)], 2, { u: function () { return 0.5; }, n: function () { return 0; } });   // true throws: the case is the runners' bookkeeping
  check('bases loaded, two out, a drive into the right-field corner scores at least two', out.runs >= 2 && !out.error, where(out));
  bb = batted(98, 14, -8); out = resolve(bb, [null, null, runner(-0.2), runner(0)], 2);
  check('second and third, two out, a single up the middle scores both', out.runs === 2 && out.hit === '1B', where(out));

  // 2. A runner may tag up only to a base the man ahead leaves (bb_field v1.3). Second and third, none out, a timid,
  //    slow man on third (runAggr +0.4, 25.3 ft/s) and a bolder one on second (-0.2, 26.5), a fly to centre caught
  //    about 330 ft out: the man on third holds, so the man on second must hold too. Until v1.3 he tagged to third
  //    on top of him, and the man on third vanished from the bases (21 times in 2,000 games).
  var R3 = runner(0.4, 25.3), R2 = runner(-0.2, 26.5), bad = 0, tried = 0, held = 0, eg = '';
  [94, 96, 99, 102, 105].forEach(function (ev) { [30, 34, 38, 42].forEach(function (la) { [0, 10, 20, 30].forEach(function (sp) {
    var fb = batted(ev, la, sp), o = resolve(fb, [null, null, R2, R3], 0);
    if (!o.events.some(function (e) { return e.kind === 'catch'; })) return;
    tried++;
    var r3 = o.runners.filter(function (r) { return r.from === 3; })[0]; if (r3.to === 3) held++;
    if (!distinct(o) || !conserved(o, 3)) { bad++; if (!eg) eg = where(o); }
  }); }); });
  check('second and third, none out, flies to the outfield of every depth: nobody tags up onto the man ahead (' + tried + ' catches, the man on third held on ' + held + ')', tried > 0 && bad === 0, bad ? bad + ' collisions, e.g. ' + eg : 'no collisions');

  // 3. A throw that gets away moves every runner up a base, the men who held included (bb_field v1.4). The dice here
  //    make the infielder's throw wild (a 5-sigma miss) and nothing else. A man on second alone, none out, a ground
  //    ball to the second baseman: he held; the throw to first goes wild. Until v1.4 only the men who were moving
  //    took an extra base, so the batter took second on top of the man who held there, who vanished. The same with
  //    men on first and third and a grounder to short: the man on third held, the man from first took third on top
  //    of him.
  var wildDice = { u: function () { return 0.5; }, n: function (mu, sd) { return sd > 0.1 && sd !== 0.25 && sd !== 0.15 ? 5 : 0; } };   // the throw's scatter (armAcc x distance / 40) and nothing else: the reads (READ_SD 0.25) and the race (0.15) stay true
  bb = batted(82, -4, 12); out = resolve(bb, [null, null, runner(0.3), null], 0, wildDice);
  check('man on second, a grounder to the second baseman thrown away: nobody lands on him', out.error && distinct(out) && conserved(out, 2), where(out));
  bb = batted(84, -3, -14); out = resolve(bb, [null, runner(0), null, runner(0.3)], 0, wildDice);
  check('first and third, a grounder to short thrown away: nobody lands on the man who held', out.error && distinct(out) && conserved(out, 3), where(out));

  // 4. A failed force play is a fielder's choice when the batter would have been out at first (bb_field v1.5; the
  //    rulebook's 9.05). A slow man on first, none out, a soft grounder to short; the dice make every throw late
  //    (nobody is put out) and nothing else. The shortstop tries the force at second and the runner beats it; the
  //    batter, who would have been out at first by two seconds, reaches. Until v1.5 that was scored a single.
  var lateDice = { u: function () { return 0.9; }, n: function () { return 0; } }, slowB = runner(0, 22), R1m = runner(0, 26.5), tried4 = 0, wrong4 = 0, eg4 = '';
  [70, 74, 78, 82, 86, 90].forEach(function (ev) { [-14, -10, -6, -2, 2, 6].forEach(function (la) { [-25, -15, -5, 5, 15, 25].forEach(function (sp) {
    var o = resolve(batted(ev, la, sp), [null, R1m, null, null], 0, lateDice, -1, slowB);
    if (!/safe at second ahead of the throw/.test(o.desc)) return;
    tried4++; if (o.hit !== 'FC' || o.error || !conserved(o, 2)) { wrong4++; if (!eg4) eg4 = where(o); }
  }); }); });
  check('a slow batter and a man on first, soft grounders to the infield: every force tried and missed at second is a fielder\'s choice (' + tried4 + ' such plays)', tried4 > 0 && wrong4 === 0, wrong4 ? wrong4 + ' scored as hits, e.g. ' + eg4 : 'all fielder\'s choices');

  // 5. A batter thrown out past first base keeps the hit that got him there (bb_field v1.6; the scorer's rule 9.05):
  //    a bold batter (runAggr -0.4), a ground ball down the right-field line, the dice make the throw beat him at
  //    second. Until v1.6 the play was scored a plain out, and the single was lost.
  var beatDice = { u: function () { return 0.03; }, n: function () { return 0; } };
  bb = batted(92, 5, 42); out = resolve(bb, [null, null, null, null], 0, beatDice, -1, runner(-0.4, 26.5));
  var bq = out.runners[out.runners.length - 1];
  check('a bold batter thrown out at second on a ball down the line: a single and an out on the bases', bq.out && bq.to === 2 && out.hit === '1B' && out.outsMade === 1, where(out));

  // 6. A force tried and thrown away is an error, not a fielder's choice (bb_field v1.7): the grid of case 4 again,
  //    with dice that make the infielder's throw wild. The batter reaches on the error (or keeps a hit he had
  //    earned); v1.5 had scored the play a fielder's choice with nobody out.
  var tried6 = 0, wrong6 = 0, eg6 = '';
  [70, 74, 78, 82, 86, 90].forEach(function (ev) { [-14, -10, -6, -2, 2, 6].forEach(function (la) { [-25, -15, -5, 5, 15, 25].forEach(function (sp) {
    var o = resolve(batted(ev, la, sp), [null, R1m, null, null], 0, wildDice, -1, slowB);
    if (!/throwing error/.test(o.desc) && !/error/.test(o.desc)) return;
    if (!(o.runners.some(function (r) { return r.from === 1 && r.to >= 3; }))) return;   // the throw went to second: the man from first took third on it
    tried6++; if (o.hit === 'FC' || !o.error || !conserved(o, 2)) { wrong6++; if (!eg6) eg6 = where(o); }
  }); }); });
  check('a slow batter and a man on first, soft grounders, the force at second thrown away: an error, never a fielder\'s choice (' + tried6 + ' such plays)', tried6 > 0 && wrong6 === 0, wrong6 ? wrong6 + ' wrong, e.g. ' + eg6 : 'all errors');

  // The cases below stand the infield where the base-out state puts it (bb_field v1.8).
  function resolveAt(bb, bases, outs, dice, side, batter) {
    var B = batter || runner(0); BBField.positionDefense(D, B, side || -1, { bases: bases, outs: outs });
    return BBField.resolve(bb, B, bases, outs, D, env, dice || BB.makeRng(1), { side: side || -1, going: 0 });
  }
  var trueDice = { u: function () { return 0.5; }, n: function () { return 0; } };

  // 7. The second baseman covers second on a ball to the third baseman (bb_field v1.8; the league's forces at second
  //    from third went to the second baseman 239 times in 267). A slow batter and a man on first, none out,
  //    grounders to third: every throw to second goes to the second baseman. Until v1.8 the shortstop covered.
  var t7 = 0, w7 = 0, eg7 = '', slow7 = runner(0, 22.5);
  [72, 80, 88, 96].forEach(function (ev) { [-10, -5, -1].forEach(function (la) { [-38, -34, -30, -26].forEach(function (sp) {
    var o = resolveAt(batted(ev, la, sp), [null, R1m, null, null], 0, trueDice, -1, slow7);
    if (!o.fielded || o.fielded.who !== '3B') return;
    o.events.forEach(function (e) { if (e.kind === 'throw' && e.who === '3B' && e.to === 2) { t7++; if (e.rcv !== '2B') { w7++; if (!eg7) eg7 = where(o) + ' (received by ' + e.rcv + ')'; } } });
  }); }); });
  check('a man on first, grounders to third: the second baseman takes the throw at second (' + t7 + ' throws)', t7 > 0 && w7 === 0, w7 ? w7 + ' taken by someone else, e.g. ' + eg7 : 'all to the second baseman');

  // 8. A double play's relay needs a man at first (bb_field v1.8). A slow left-handed batter and a man on first,
  //    none out, grounders to the first baseman, who throws to second: the relay goes to the pitcher covering first
  //    and arrives no sooner than he (or the first baseman back at the bag) is there. Until v1.8 the relay went to
  //    the first baseman - the man who had just thrown to second (in time, as it happened: the pitcher covering is
  //    there long before a relay can be).
  var t8 = 0, w8 = 0, eg8 = '', Pf8 = D.filter(function (F) { return F.pos === 'P'; })[0], F1 = D.filter(function (F) { return F.pos === '1B'; })[0];
  [72, 80, 88, 96].forEach(function (ev) { [-10, -5, -1].forEach(function (la) { [22, 26, 30, 34, 38].forEach(function (sp) {
    var o = resolveAt(batted(ev, la, sp), [null, R1m, null, null], 0, trueDice, 1, slow7);   // a left-handed batter
    if (!o.fielded || o.fielded.who !== '1B') return;
    var rel = o.events.filter(function (e) { return e.who === 'relay'; })[0]; if (!rel) return;
    var tP = BBField.moveTime(Pf8.pl, Math.hypot(Pf8.at[0] - BBField.BASES[1][0], Pf8.at[1] - BBField.BASES[1][1])) + 0.2;
    var tBack = o.fielded.t + F1.pl.transfer + BBField.moveTime(F1.pl, Math.hypot(o.fielded.at[0] - BBField.BASES[1][0], o.fielded.at[1] - BBField.BASES[1][1])) - F1.pl.react + 0.1;
    t8++; if (rel.arrive < Math.min(tP, tBack) - 1e-9 || rel.rcv === '1B') { w8++; if (!eg8) eg8 = where(o) + ' (relay at ' + rel.arrive.toFixed(2) + ' s, first covered at ' + Math.min(tP, tBack).toFixed(2) + ' s)'; }
  }); }); });
  check('a man on first, grounders to the first baseman turned two: the relay waits for the man covering first (' + t8 + ' relays)', t8 > 0 && w8 === 0, w8 ? w8 + ' to an empty bag, e.g. ' + eg8 : 'every relay to a covered bag');

  // 9. The fielder throws for the out worth the most runs (bb_field v1.8). A slow man on first (25.5 ft/s), a fast
  //    batter (29.5), none out, routine grounders to short and third: the force at second is all but sure and the
  //    relay hopeless, and with the league's run expectancy the lead runner is worth more (a man on first and one
  //    out, .515, against a man on second and one out, .671). Until v1.8 the fielder counted expected outs and
  //    took the surer out at first.
  var t9 = 0, w9 = 0, eg9 = '', R1s = runner(0, 25.5), Bf = runner(0, 29.5);
  [[70, -6, -30], [70, -2, -30], [76, -6, -14], [70, -6, -20], [82, -6, -14]].forEach(function (q) {
    var o = resolveAt(batted(q[0], q[1], q[2]), [null, R1s, null, null], 0, trueDice, -1, Bf);
    var th = o.events.filter(function (e) { return e.kind === 'throw' || e.kind === 'carry'; })[0];
    if (!o.fielded || !/^(SS|3B)$/.test(o.fielded.who) || !th) return;
    t9++; if (th.to !== 2) { w9++; if (!eg9) eg9 = q.join(' ') + ': ' + where(o); }
  });
  check('a slow man on first and a fast batter, routine grounders to short and third: the throw goes to second (' + t9 + ' plays)', t9 > 0 && w9 === 0, w9 ? w9 + ' to first, e.g. ' + eg9 : 'all to second');

  // 10. A fly the fielder was under and dropped is an error, not a hit (bb_field v1.9; rule 9.12): routine flies to
  //     the outfield, the dice make every catch fail (and every pick-up after it). Until v1.9 the batter was scored
  //     a hit while the fielder was charged an error on the same play.
  var dropDice = { u: function () { return 0.999; }, n: function () { return 0; } }, t10 = 0, w10 = 0, eg10 = '';
  [[88, 28, -20], [90, 30, 0], [92, 32, 18], [86, 26, 25], [94, 34, -10]].forEach(function (q) {
    var o = resolve(batted(q[0], q[1], q[2]), [null, null, null, null], 0, dropDice);
    if (!o.events.some(function (e) { return e.kind === 'drop'; })) return;
    t10++; if (o.hit !== 'E' || !o.error) { w10++; if (!eg10) eg10 = q.join(' ') + ': ' + where(o); }
  });
  check('routine flies dropped: the batter reaches on the error (' + t10 + ' drops)', t10 > 0 && w10 === 0, w10 ? w10 + ' scored as hits, e.g. ' + eg10 : 'all errors');

  // 11. The tag-up is a read, as a send home on a hit is (bb_field v1.9). A man on third, one out, flies caught in
  //     the outfield from 220 to 380 ft, one seeded die per play: on the close ones he is sometimes sent and thrown
  //     out at the plate, and on the deep ones he always scores. Until v1.9 he went only when no throw could get
  //     him: never thrown out (the league's runners were, on .02 of their chances).
  var thrown11 = 0, deep11 = 0, deepScored11 = 0, caught11 = 0, R3t = runner(0, 27);
  [84, 87, 90, 93, 96, 100, 104].forEach(function (ev) { [28, 31, 34, 37].forEach(function (la) { [-25, -10, 0, 10, 25].forEach(function (sp, k) {
    var bb11 = batted(ev, la, sp), o = resolve(bb11, [null, null, null, R3t], 1, BB.makeRng(100 + ev + la + k));
    if (!o.events.some(function (e) { return e.kind === 'catch'; }) || bb11.dist < 220 || bb11.dist > 380) return;
    caught11++;
    var q = o.runners.filter(function (r) { return r.from === 3; })[0];
    if (q.out) thrown11++;
    if (bb11.dist >= 340) { deep11++; if (!q.out && q.to >= 4) deepScored11++; }
  }); }); });
  check('a man on third, one out, flies caught 220-380 ft out: some sent and thrown out, every deep one scores (' + caught11 + ' catches)', thrown11 > 0 && deep11 > 0 && deepScored11 === deep11,
        thrown11 + ' thrown out at the plate; ' + deepScored11 + ' of ' + deep11 + ' caught 340+ ft out scored');

  print(fails ? 'FAIL: ' + fails + ' of ' + cases + ' cases' : 'PASS: ' + cases + ' cases');
})();
