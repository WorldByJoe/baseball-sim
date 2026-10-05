/* ============================================================================
   plays_check.js · v0.6 · 2026-10-05

   Constructed plays through BBField.resolve, each a regression test for a
   bug the audit found (docs/briefs/2026-10-05_bug_audit.md): a fixed
   defence, a batted ball built from exit speed, launch angle and spray, the
   runners placed by hand, and a stand-in for the dice where a case needs
   one (a throw that must go wild). Prints each case and PASS or FAIL.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js headless/plays_check.js

   CHANGED
     v0.6  a force tried and thrown away is an error, not a fielder's choice (bb_field v1.7)
     v0.5  a batter thrown out past first keeps the hit that got him there (bb_field v1.6)
     v0.4  a force tried and missed is a fielder's choice when the batter would have been out at first (bb_field v1.5)
     v0.3  a throw that gets away moves every runner up, the men who held included (bb_field v1.4)
     v0.2  a runner tags up only to a base the man ahead leaves (bb_field v1.3)
     v0.1  the runner behind a man who scores may score too (bb_field v1.2)
============================================================================ */
(function () {
  var U = BB.units, MPH = U.MPH, DEG = U.DEG, env = BB.makeEnv({}), fails = 0, cases = 0;
  var rng = BB.makeRng(7), POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  var fielders = POS.map(function (pos) { return BB.makeBatter(rng, { pos: pos }); });
  var P = BB.makePitcher(rng, { role: 'SP' }); P.pos = 'P';
  var D = BBField.makeDefense(fielders.concat([P]));
  function runner(aggr, speed) { var b = BB.makeBatter(rng, { pos: 'LF' }); b.runAggr = aggr || 0; b.speed = speed || 27; b.jump = 0.22; return b; }
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
  var bb = batted(103, 12, 40), out = resolve(bb, [null, runner(0), runner(0), runner(0)], 2);
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
  var wildDice = { u: function () { return 0.5; }, n: function (mu, sd) { return sd > 0.26 ? 5 : 0; } };
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

  print(fails ? 'FAIL: ' + fails + ' of ' + cases + ' cases' : 'PASS: ' + cases + ' cases');
})();
