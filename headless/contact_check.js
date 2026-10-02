/* ============================================================================
   contact_check.js · v0.1 · 2026-10-02

   Measures the model's contact the way the league's was measured pitch by
   pitch (STATCAST_TARGETS_2025.md, "What a foul is", and the height tables
   in docs/briefs/2026-10-02_perception_error.md), and prints each table with
   the league's numbers beside it: what a swing becomes, squared-up contact,
   exit velocity and launch angle of balls in play and fouls, exit velocity by
   launch angle, contact by depth (how far in front of the plan the ball was
   met), by attack angle at contact, and by pitch height in the zone.

   Squared up is Statcast's rule: exit velocity >= 0.8 x (1.23 x bat speed +
   0.23 x pitch speed), with the release speed standing in for Statcast's
   effective speed. Depth is the plan's 29 in plus how far out front the
   contact was (sFwd); the league's depth is from the batter's position.

   Run:  jsc ../bb_engine.js ../bb_names.js ../bb_field.js ../bb_game.js contact_check.js -- [hitters] [PA each] [seed]

   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 400, NPA = +A[1] || 40, SEED = +A[2] || 3, U = BB.units, MPH = U.MPH, IN = U.IN, DEG = U.DEG;
  var rng = BB.makeRng(SEED + 101), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [];
  for (var i = 0; i < 24; i++) P.push(BB.makePitcher(rng, { role: i < 14 ? 'SP' : 'RP' }));
  function kindOf(t) { return BB.PITCH_TYPES[t].kind; }
  var sw = [];   // one record per swing
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {});
    for (var k = 0; k < NPA; k++) {
      var Pi = P[k % P.length]; Pi.load = rng.u() * Pi.stamina;
      var res = BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: rng.u() * 80, rec: false }, rng);
      res.pitches.forEach(function (q) {
        if (!q.swing) return;
        var pz = q.pitch.plate.z, px = q.pitch.plate.x, h = (pz - B.zone.bot) / (B.zone.top - B.zone.bot);
        var r = { kind: kindOf(q.pitch.type), strikes: +q.count.split('-')[1], h: h, inZone: BB.inZone(B, px, pz), contact: !!q.swing.contact,
                  bat: q.swing.batAt || q.swing.batMph, mph: q.pitch.mph, away: -px * BB.batterSide(B, Pi), depth: 29 + (q.swing.depth !== undefined ? q.swing.depth : (q.swing.sFwd || 0)) / IN, attack: q.swing.attackAt !== undefined ? q.swing.attackAt : q.swing.attack };
        r.facePull = q.swing.theta * BB.batterSide(B, Pi) / DEG; r.why = q.swing.why; r.read = q.read.detected ? 'read' : q.read.late ? 'late' : 'fooled';
        // spray + = pulled: a right-handed batter, on the -x side, pulls toward -x
        if (q.bb) { r.ev = q.bb.ev; r.la = q.bb.la; r.fair = !!q.bb.fair; r.spray = q.bb.spray * BB.batterSide(B, Pi); r.sq = q.bb.ev >= 0.8 * (1.23 * r.bat + 0.23 * r.mph); }
        else if (r.contact) { r.fair = false; r.tip = true; }   // contact with no batted ball: a foul tip into the mitt
        sw.push(r);
      });
    }
  }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function f(x, d) { return isFinite(x) ? x.toFixed(d === undefined ? 3 : d) : '-'; }
  function q(v, p) { return v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))]; }
  function mean(v) { return v.reduce(function (s, x) { return s + x; }, 0) / Math.max(1, v.length); }
  function sd(v) { var m = mean(v); return Math.sqrt(v.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / Math.max(1, v.length - 1)); }
  function row(cells, w) { print(cells.map(function (c, j) { return pad(c, w[j] || 9); }).join('')); }
  var contact = sw.filter(function (r) { return r.contact; }), tracked = contact.filter(function (r) { return r.ev !== undefined; });
  var bip = tracked.filter(function (r) { return r.fair; }), fouls = tracked.filter(function (r) { return !r.fair; });
  print('contact_check v0.1 · seed ' + SEED + ' · ' + N + ' hitters x ' + NPA + ' PA · ' + sw.length + ' swings, ' + contact.length + ' contacts');

  print('\n1. WHAT A SWING BECOMES            whiff    foul  in play  foul/contact   |  league whiff foul/contact');
  var L1 = { all: [.232, .521], FB: [.172, .548], BR: [.308, .489], OS: [.299, .472], 0: [.237, .522], 1: [.237, .516], 2: [.223, .525] };
  [['all', function () { return true; }], ['FB', function (r) { return r.kind === 'FB'; }], ['BR', function (r) { return r.kind === 'BR'; }], ['OS', function (r) { return r.kind === 'OS'; }],
   [0, function (r) { return r.strikes === 0; }], [1, function (r) { return r.strikes === 1; }], [2, function (r) { return r.strikes === 2; }]].forEach(function (g) {
    var s = sw.filter(g[1]), c = s.filter(function (r) { return r.contact; }), fl = c.filter(function (r) { return !r.fair; }), l = L1[g[0]];
    row([typeof g[0] === 'number' ? g[0] + ' strikes' : g[0], f(1 - c.length / s.length), f(fl.length / s.length), f((c.length - fl.length) / s.length), f(fl.length / c.length), '   |  ' + f(l[0]) + '  ' + f(l[1])], [30, 8, 8, 9, 14, 22]);
  });

  var wh = sw.filter(function (r) { return !r.contact; }), why = {};
  wh.forEach(function (r) { var k = r.why || '?'; why[k] = (why[k] || 0) + 1; });
  print('   whiffs by cause (share of swings): ' + Object.keys(why).sort().map(function (k) { return k + ' ' + f(why[k] / sw.length); }).join('  '));
  ['read', 'late', 'fooled'].forEach(function (k) { var s2 = sw.filter(function (r) { return r.read === k; }); print('   ' + k + ': ' + f(s2.length / sw.length, 2) + ' of swings, whiff ' + f(s2.filter(function (r) { return !r.contact; }).length / s2.length)); });
  var spv = bip.map(function (r) { return r.spray; });
  function slope(xs, ys) { var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0, syy = 0; for (var j = 0; j < xs.length; j++) { sxy += (xs[j] - mx) * (ys[j] - my); sxx += (xs[j] - mx) * (xs[j] - mx); syy += (ys[j] - my) * (ys[j] - my); } return [sxy / sxx, sxy / Math.sqrt(sxx * syy)]; }
  var s1 = slope(bip.map(function (r) { return r.depth; }), bip.map(function (r) { return r.facePull; })), s2 = slope(bip.map(function (r) { return r.facePull; }), spv), s3 = slope(bip.map(function (r) { return r.depth; }), spv);
  print('   fair balls: face pull per inch of depth ' + f(s1[0], 2) + ' (r ' + f(s1[1], 2) + '); spray per deg of face ' + f(s2[0], 2) + ' (r ' + f(s2[1], 2) + '); spray per inch of depth ' + f(s3[0], 2) + ' (r ' + f(s3[1], 2) + ')   |  league spray per inch 1.59 (r .40)');
  print('   fair-ball spray (+ = pulled): mean ' + f(mean(spv), 1) + ' sd ' + f(sd(spv), 1) + '   |  league 6.1 sd 24.9 (hit coordinates, fair balls, one week of July 2025)');
  [[-99, 22, '-13.7 21.4'], [22, 28, ' -2.5 22.6'], [28, 34, '+10.3 22.3'], [34, 40, '+19.9 20.2'], [40, 199, '+21.2 21.4']].forEach(function (b) {
    var v = bip.filter(function (r) { return r.depth >= b[0] && r.depth < b[1]; }).map(function (r) { return r.spray; });
    print('     depth ' + pad(b[0] + '..' + b[1], 9) + ' n ' + pad(v.length, 5) + '  spray ' + pad(f(mean(v), 1), 6) + ' sd ' + pad(f(sd(v), 1), 5) + '   |  ' + b[2]);
  });
  print('\n2. SQUARED UP                     per contact  per BIP  per foul   |  league .435 (floor .392) / .627 / .225 (floor .184)');
  [['all', null], ['FB', 'FB'], ['BR', 'BR'], ['OS', 'OS']].forEach(function (g) {
    var t = tracked.filter(function (r) { return !g[1] || r.kind === g[1]; }), b = t.filter(function (r) { return r.fair; }), fo = t.filter(function (r) { return !r.fair; });
    var sq = function (v) { return v.filter(function (r) { return r.sq; }).length / v.length; };
    row([g[0], f(sq(t)), f(sq(b)), f(sq(fo))], [30, 12, 9, 10]);
  });

  print('\n3. EXIT VELOCITY (mph)          n   mean    sd   p10   p25   p50   p75   p90   <60   <70   <80   <90');
  [['in play', bip, '28914  88.9  15.2  68.8  80.4  92.0 100.3 105.2  .048  .111  .243  .447'], ['fouls', fouls, '25798  76.7  13.1  62.5  70.3  76.6  83.7  93.0  .076  .240  .640  .862']].forEach(function (g) {
    var v = g[1].map(function (r) { return r.ev; }).sort(function (a, b) { return a - b; }), lt = function (x) { return v.filter(function (e) { return e < x; }).length / v.length; };
    row([g[0] + ' model', v.length, f(mean(v), 1), f(sd(v), 1), f(q(v, .1), 1), f(q(v, .25), 1), f(q(v, .5), 1), f(q(v, .75), 1), f(q(v, .9), 1), f(lt(60)), f(lt(70)), f(lt(80)), f(lt(90))], [16, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]);
    print(pad(g[0] + ' league', 16) + ' ' + g[2]);
  });
  print('   launch angle (deg)            n   mean    sd   p10   p25   p50   p75   p90');
  [['in play', bip, '28936  13.1  28.7 -22.0  -5.0  14.0  31.0  50.0'], ['fouls', fouls, '25858  23.2  35.8 -33.0   0.0  31.0  51.0  64.0']].forEach(function (g) {
    var v = g[1].map(function (r) { return r.la; }).sort(function (a, b) { return a - b; });
    row([g[0] + ' model', v.length, f(mean(v), 1), f(sd(v), 1), f(q(v, .1), 1), f(q(v, .25), 1), f(q(v, .5), 1), f(q(v, .75), 1), f(q(v, .9), 1)], [16, 7, 7, 6, 6, 6, 6, 6, 6]);
    print(pad(g[0] + ' league', 16) + ' ' + g[2]);
  });

  print('\n4. EXIT VELOCITY BY LAUNCH ANGLE   in play: model (share)  league     fouls: model (share)  league');
  var bands = [[-90, -30, 66.8, 67.6], [-30, -10, 86.3, 78.6], [-10, 10, 92.6, 84.5], [10, 30, 93.7, 80.0], [30, 50, 89.4, 76.0], [50, 91, 82.3, 75.9]];
  bands.forEach(function (b) {
    var ib = bip.filter(function (r) { return r.la >= b[0] && r.la < b[1]; }), fb = fouls.filter(function (r) { return r.la >= b[0] && r.la < b[1]; });
    row([b[0] + '..' + b[1], f(mean(ib.map(function (r) { return r.ev; })), 1) + ' (' + f(ib.length / bip.length, 2) + ')', f(b[2], 1), f(mean(fb.map(function (r) { return r.ev; })), 1) + ' (' + f(fb.length / fouls.length, 2) + ')', f(b[3], 1)], [30, 16, 8, 24, 8]);
  });

  function bandTable(title, key, edges, league) {
    print('\n' + title);
    row(['band', 'contact', 'foul/contact', 'squared/contact', 'mean EV', 'league foul', 'league sq'], [12, 9, 14, 17, 9, 13, 11]);
    for (var j = 0; j < edges.length - 1; j++) {
      var c = contact.filter(function (r) { return r[key] >= edges[j] && r[key] < edges[j + 1]; }), t = c.filter(function (r) { return r.ev !== undefined; });
      row([edges[j] + '..' + edges[j + 1], c.length, f(c.filter(function (r) { return !r.fair; }).length / c.length), f(t.filter(function (r) { return r.sq; }).length / t.length), f(mean(t.map(function (r) { return r.ev; })), 1), league[j] ? f(league[j][0]) : '-', league[j] ? f(league[j][1]) : '-'], [12, 9, 14, 17, 9, 13, 11]);
    }
  }
  var dv = contact.map(function (r) { return r.depth; });
  print('\n   contact depth: mean ' + f(mean(dv), 1) + ' sd ' + f(sd(dv), 1) + ' in   |  league 29.1 sd 9.7 (one week of July 2025)');
  var av = contact.map(function (r) { return r.attack; }), bv = tracked.map(function (r) { return r.bat; });
  print('   attack angle at contact: mean ' + f(mean(av), 1) + ' sd ' + f(sd(av), 1) + ' deg  |  league 8.2 sd 10.4;   bat speed at contact: mean ' + f(mean(bv), 1) + ' sd ' + f(sd(bv), 1) + '  |  league 70.6 sd 7.4');
  bandTable('5. BY CONTACT DEPTH (in in front of the batter)', 'depth', [-99, 0, 10, 20, 30, 40, 50, 199], [[1.0, .795], [.892, .617], [.706, .403], [.489, .409], [.425, .490], [.607, .393], [.780, .215]]);
  bandTable('6. BY ATTACK ANGLE AT CONTACT (deg)', 'attack', [-90, 0, 5, 10, 15, 20, 90], [[.646, .410], [.523, .400], [.439, .448], [.425, .479], [.499, .465], [.677, .391]]);

  print('\n6b. BY VERTICAL MISS (launch angle minus attack angle at contact, deg)');
  var dm = tracked.map(function (r) { return r.la - r.attack; });
  print('   mean ' + f(mean(dm), 1) + ' sd ' + f(sd(dm), 1) + '   |  league 10.0 sd 34.7');
  row(['band', 'n', 'share', 'squared', 'EV/max', 'foul', '| league share sq EV/max foul'], [12, 7, 8, 9, 8, 8, 34]);
  var VM = [[-90, -60, '.029 .098 .595 .657'], [-60, -40, '.072 .190 .681 .743'], [-40, -25, '.067 .426 .759 .445'], [-25, -15, '.061 .614 .807 .213'], [-15, -5, '.080 .663 .831 .190'],
            [-5, 5, '.093 .695 .845 .211'], [5, 15, '.116 .626 .832 .292'], [15, 25, '.108 .594 .806 .334'], [25, 40, '.144 .425 .767 .520'], [40, 60, '.182 .169 .721 .780'], [60, 99, '.045 .067 .692 .777']];
  VM.forEach(function (b) {
    var t = tracked.filter(function (r) { var d = r.la - r.attack; return d >= b[0] && d < b[1]; });
    row([b[0] + '..' + b[1], t.length, f(t.length / tracked.length), f(t.filter(function (r) { return r.sq; }).length / t.length), f(mean(t.map(function (r) { return r.ev / (1.23 * r.bat + 0.23 * 92); })), 3), f(t.filter(function (r) { return !r.fair; }).length / t.length), '|   ' + b[2]], [12, 7, 8, 9, 8, 8, 34]);
  });
  print('\n6d. VERTICAL MISS BY CONTACT DEPTH   model: miss mean  sd   LA    attack   |  league miss  sd    LA   attack');
  [[-20, 15, '+20.0 27.1 +12.4  -7.6'], [15, 22, '+20.7 29.1 +20.5  -0.2'], [22, 28, '+18.1 31.6 +23.0  +4.9'], [28, 34, '+10.1 34.7 +20.4 +10.3'], [34, 40, ' +1.2 35.2 +15.8 +14.7'], [40, 90, '-12.2 36.6  +6.9 +19.2']].forEach(function (b) {
    var t = tracked.filter(function (r) { return r.depth >= b[0] && r.depth < b[1]; }), m = t.map(function (r) { return r.la - r.attack; });
    row([b[0] + '..' + b[1], f(mean(m), 1), f(sd(m), 1), f(mean(t.map(function (r) { return r.la; })), 1), f(mean(t.map(function (r) { return r.attack; })), 1), '|  ' + b[2]], [32, 7, 6, 7, 8, 30]);
  });
  print('\n6c. BY PITCH LOCATION, contact struck square vertically (vertical miss within 15 deg of +10)');
  row(['away (ft)', 'n', 'EV/max', 'squared', '| league EV/max squared'], [14, 7, 9, 9, 26]);
  [[-9, -1.0, '.725 .273'], [-1.0, -0.5, '.796 .523'], [-0.5, 0, '.843 .684'], [0, 0.5, '.848 .693'], [0.5, 1.0, '.827 .616'], [1.0, 9, '.761 .444']].forEach(function (b) {
    var t = tracked.filter(function (r) { var a = r.away / U.FT; return a >= b[0] && a < b[1] && Math.abs(r.la - r.attack - 10) < 15; });
    row([f(b[0], 1) + '..' + f(b[1], 1), t.length, f(mean(t.map(function (r) { return r.ev / (1.23 * r.bat + 0.23 * 92); })), 3), f(t.filter(function (r) { return r.sq; }).length / t.length), '|   ' + b[2]], [14, 7, 9, 9, 26]);
  });
  print('\n7. BY PITCH HEIGHT (0 = bottom of his zone, 1 = top)');
  row(['height', 'swings', 'whiff', 'foul/contact', 'squared', 'BIP LA', 'BIP EV', 'foul LA', '| league: whiff  foul  sq   BIP LA  BIP EV  foul LA'], [12, 8, 8, 14, 9, 8, 8, 9, 52]);
  var HB = [[-9, -0.25, '.765 .626 .286  -0.4  75.7  -9.3'], [-0.25, 0.15, '.349 .497 .423   5.1  87.2  -3.3'], [0.15, 0.5, '.139 .462 .468  10.7  90.5  16.8'],
            [0.5, 0.85, '.138 .531 .416  18.0  88.9  34.1'], [0.85, 1.25, '.268 .653 .409  23.2  86.5  39.3'], [1.25, 9, '.503 .740 .544  23.4  83.5  38.1']];
  HB.forEach(function (b) {
    var s = sw.filter(function (r) { return r.h >= b[0] && r.h < b[1]; }), c = s.filter(function (r) { return r.contact; }), t = c.filter(function (r) { return r.ev !== undefined; });
    var ib = t.filter(function (r) { return r.fair; }), fb = t.filter(function (r) { return !r.fair; });
    row([f(b[0], 2) + '..' + f(b[1], 2), s.length, f(1 - c.length / s.length), f(c.filter(function (r) { return !r.fair; }).length / c.length), f(t.filter(function (r) { return r.sq; }).length / t.length),
         f(mean(ib.map(function (r) { return r.la; })), 1), f(mean(ib.map(function (r) { return r.ev; })), 1), f(mean(fb.map(function (r) { return r.la; })), 1), '|        ' + b[2]], [12, 8, 8, 14, 9, 8, 8, 9, 52]);
  });
  print('\n8. ZONE              swings   whiff  foul/contact  squared   |  league whiff foul/contact squared');
  [['in zone', true, '.150 .500 .459'], ['out of zone', false, '.430 .599 .343']].forEach(function (g) {
    var s = sw.filter(function (r) { return r.inZone === g[1]; }), c = s.filter(function (r) { return r.contact; }), t = c.filter(function (r) { return r.ev !== undefined; });
    row([g[0], s.length, f(1 - c.length / s.length), f(c.filter(function (r) { return !r.fair; }).length / c.length), f(t.filter(function (r) { return r.sq; }).length / t.length), '   |  ' + g[2]], [16, 9, 8, 14, 9, 30]);
  });
})(typeof arguments !== 'undefined' ? arguments : []);
