/* ============================================================================
   contact_check.js · v0.3 · 2026-10-03

   Measures the model's contact the way the league's was measured pitch by
   pitch (STATCAST_TARGETS_2025.md, "What a foul is", and the height tables
   in statcast/fouls.py v0.3, tables 9-11), and prints each table with
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
     v0.3  familiarity as in games: 40 x u x u pitches of this pitcher seen at the start of each PA (games: median 9 at a swing, mean 12.6; was uniform to 60-80)
     v0.2  the height tables (statcast/fouls.py v0.3, 9-11): height, kind at a height, the
           flat-fastball fifths; whiffs split by read (expected pitch, read, late, fooled); 120 pitchers;
           bat speed by pitch kind at a depth and by count (statcast/swing_geometry.py v0.2 table 7)
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 400, NPA = +A[1] || 40, SEED = +A[2] || 3, U = BB.units, MPH = U.MPH, IN = U.IN, DEG = U.DEG;
  var rng = BB.makeRng(SEED + 101), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [];
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));   // 120 pitchers: with pitch shapes as varied as the league's, a small staff skews the tables
  function kindOf(t) { return BB.PITCH_TYPES[t].kind; }
  var sw = [];   // one record per swing
  for (i = 0; i < N; i++) {
    var B = BB.makeBatter(rng, {});
    for (var k = 0; k < NPA; k++) {
      var Pi = P[(i * NPA + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      var res = BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      res.pitches.forEach(function (q) {
        if (!q.swing) return;
        var pz = q.pitch.plate.z, px = q.pitch.plate.x, h = (pz - B.zone.bot) / (B.zone.top - B.zone.bot);
        var vv = q.pitch.plate.v, vaa = -Math.atan(vv[2] / vv[1]) / DEG;   // vertical approach angle at the front of the plate, negative = descending
        var r = { type: q.pitch.type, vaa: vaa, kind: kindOf(q.pitch.type), strikes: +q.count.split('-')[1], balls: +q.count.split('-')[0], h: h, inZone: BB.inZone(B, px, pz), contact: !!q.swing.contact,
                  bat: q.swing.batAt || q.swing.batMph, mph: q.pitch.mph, away: -px * BB.batterSide(B, Pi), depth: 29 + (q.swing.depth !== undefined ? q.swing.depth : (q.swing.sFwd || 0)) / IN, attack: q.swing.attackAt !== undefined ? q.swing.attackAt : q.swing.attack };
        r.facePull = q.swing.theta * BB.batterSide(B, Pi) / DEG; r.why = q.swing.why; r.read = q.expect.guessType === q.pitch.type ? 'expected' : q.read.detected ? 'read' : q.read.late ? 'late' : 'fooled';
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
  print('contact_check v0.2 · seed ' + SEED + ' · ' + N + ' hitters x ' + NPA + ' PA · ' + sw.length + ' swings, ' + contact.length + ' contacts');

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
  ['FB', 'BR', 'OS'].forEach(function (kd) {
    var s3 = sw.filter(function (r) { return r.kind === kd; }), w3 = {};
    s3.filter(function (r) { return !r.contact; }).forEach(function (r) { var k = (r.why || '?') + '/' + r.read; w3[k] = (w3[k] || 0) + 1; });
    print('   ' + kd + ' whiffs by cause/read (share of ' + kd + ' swings): ' + Object.keys(w3).sort(function (a, b) { return w3[b] - w3[a]; }).slice(0, 6).map(function (k) { return k + ' ' + f(w3[k] / s3.length); }).join('  '));
    print('      read shares: ' + ['expected', 'read', 'late', 'fooled'].map(function (k) { var q = s3.filter(function (r) { return r.read === k; }); return k + ' ' + f(q.length / s3.length, 2) + ' (whiff ' + f(q.filter(function (r) { return !r.contact; }).length / Math.max(1, q.length)) + ')'; }).join('  '));
  });
  ['expected', 'read', 'late', 'fooled'].forEach(function (k) { var s2 = sw.filter(function (r) { return r.read === k; }); print('   ' + k + ': ' + f(s2.length / sw.length, 2) + ' of swings, whiff ' + f(s2.filter(function (r) { return !r.contact; }).length / s2.length)); });
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
  var HB = [[-9, -0.25, '.766 .627 .286  -0.1  76.0  -9.2'], [-0.25, 0.15, '.349 .498 .424   5.4  87.4  -3.3'], [0.15, 0.5, '.139 .464 .468  11.1  91.0  16.8'],
            [0.5, 0.85, '.138 .533 .415  18.5  89.5  34.2'], [0.85, 1.25, '.268 .658 .408  24.1  87.9  39.3'], [1.25, 9, '.499 .731 .549  22.5  87.1  38.1']];
  HB.forEach(function (b) {
    var s = sw.filter(function (r) { return r.h >= b[0] && r.h < b[1]; }), c = s.filter(function (r) { return r.contact; }), t = c.filter(function (r) { return r.ev !== undefined; });
    var ib = t.filter(function (r) { return r.fair; }), fb = t.filter(function (r) { return !r.fair; });
    row([f(b[0], 2) + '..' + f(b[1], 2), s.length, f(1 - c.length / s.length), f(c.filter(function (r) { return !r.fair; }).length / c.length), f(t.filter(function (r) { return r.sq; }).length / t.length),
         f(mean(ib.map(function (r) { return r.la; })), 1), f(mean(ib.map(function (r) { return r.ev; })), 1), f(mean(fb.map(function (r) { return r.la; })), 1), '|        ' + b[2]], [12, 8, 8, 14, 9, 8, 8, 9, 52]);
  });
  function grp(s) { var c = s.filter(function (r) { return r.contact; }), t = c.filter(function (r) { return r.ev !== undefined; }), ib = t.filter(function (r) { return r.fair; }), fb = t.filter(function (r) { return !r.fair; });
    return { n: s.length, whiff: 1 - c.length / Math.max(1, s.length), foul: c.filter(function (r) { return !r.fair; }).length / Math.max(1, c.length), sq: t.filter(function (r) { return r.sq; }).length / Math.max(1, t.length),
             bipLA: mean(ib.map(function (r) { return r.la; })), foulLA: mean(fb.map(function (r) { return r.la; })), nt: t.length }; }
  print('\n7a. CONTACT DEPTH BY PITCH KIND (in in front of the batter)   |  league (one week of July 2025): FB 27-28, BR 35-36, OS 34-35');
  ['FB', 'BR', 'OS'].forEach(function (k) { var c = contact.filter(function (r) { return r.kind === k; }); print('   ' + k + ' ' + f(mean(c.map(function (r) { return r.depth; })), 1) + ' (n ' + c.length + ')'); });
  print('\n7b. BY PITCH KIND AT A HEIGHT: launch angle of balls in play and of fouls   |  league (statcast/fouls.py v0.3, 42 days)');
  [['low edge', -0.25, 0.15, 'BIP FB 2.0 / BR 8.0   fouls FB +4.4 / BR -5.5'], ['lower zone', 0.15, 0.5, 'BIP FB 9.8 / BR 14.0'], ['high edge', 0.85, 1.25, 'FB foul share .672, foul LA 39.7']].forEach(function (b) {
    var a = grp(sw.filter(function (r) { return r.kind === 'FB' && r.h >= b[1] && r.h < b[2]; })), c = grp(sw.filter(function (r) { return r.kind === 'BR' && r.h >= b[1] && r.h < b[2]; }));
    print('   ' + pad(b[0], 10) + '  BIP FB ' + f(a.bipLA, 1) + ' / BR ' + f(c.bipLA, 1) + '   fouls FB ' + f(a.foulLA, 1) + ' / BR ' + f(c.foulLA, 1) + '   FB foul share ' + f(a.foul) + '   |  ' + b[3]);
  });
  function vaaTable(title, pick, league) {
    var s = sw.filter(pick); if (s.length < 50) return;
    var xs = s.map(function (r) { return r.h; }), ys = s.map(function (r) { return r.vaa; }), mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0;
    for (var j = 0; j < s.length; j++) { sxy += (xs[j] - mx) * (ys[j] - my); sxx += (xs[j] - mx) * (xs[j] - mx); }
    var b = sxy / sxx; s.forEach(function (r) { r.vres = r.vaa - (my + b * (r.h - mx)); });
    s.sort(function (p, q) { return p.vres - q.vres; });
    print('\n' + title + ' (swings ' + s.length + '; VAA mean ' + f(my, 2) + ', ' + f(b, 2) + ' deg per zone height)');
    row(['VAA residual', 'mean', 'swings', 'whiff', 'foul/contact', 'squared', 'BIP LA', 'foul LA', '| league: whiff foul sq BIP LA foul LA'], [14, 7, 8, 7, 14, 9, 8, 8, 40]);
    var names = ['steepest', '2', '3', '4', 'flattest'];
    for (var k = 0; k < 5; k++) {
      var part = s.slice(Math.floor(k * s.length / 5), Math.floor((k + 1) * s.length / 5)), gq = grp(part);
      row([names[k], f(mean(part.map(function (r) { return r.vres; })), 2), part.length, f(gq.whiff), f(gq.foul), f(gq.sq), f(gq.bipLA, 1), f(gq.foulLA, 1), '|  ' + (league[k] || '')], [14, 7, 8, 7, 14, 9, 8, 8, 40]);
    }
  }
  vaaTable('7c. FOUR-SEAMERS IN THE UPPER ZONE AND HIGH EDGE (0.5-1.25), BY HOW FLAT THEY ARRIVE FOR THEIR HEIGHT', function (r) { return r.type === 'FF' && r.h >= 0.5 && r.h < 1.25; },
    ['.142 .555 .452 20.7 38.4', '.182 .613 .410 23.0 40.1', '.205 .634 .413 22.3 40.1', '.226 .668 .379 26.9 40.9', '.285 .688 .340 27.4 41.6']);
  vaaTable('7d. LOW FOUR-SEAMERS (0-0.5)', function (r) { return r.type === 'FF' && r.h >= 0 && r.h < 0.5; }, ['whiff .08, squared .49, BIP LA 11.2', '', '', '', 'whiff .15, squared .36, BIP LA 19.0']);
  vaaTable('7e. LOW BREAKING BALLS (-0.25-0.5)', function (r) { return r.kind === 'BR' && r.h >= -0.25 && r.h < 0.5; }, ['whiff .22, squared .50, foul LA -7.6', '', '', '', 'whiff .33, squared .42, foul LA +10.0']);
  print('\n8. ZONE              swings   whiff  foul/contact  squared   |  league whiff foul/contact squared');
  [['in zone', true, '.150 .500 .459'], ['out of zone', false, '.430 .599 .343']].forEach(function (g) {
    var s = sw.filter(function (r) { return r.inZone === g[1]; }), c = s.filter(function (r) { return r.contact; }), t = c.filter(function (r) { return r.ev !== undefined; });
    row([g[0], s.length, f(1 - c.length / s.length), f(c.filter(function (r) { return !r.fair; }).length / c.length), f(t.filter(function (r) { return r.sq; }).length / t.length), '   |  ' + g[2]], [16, 9, 8, 14, 9, 30]);
  });
  print('\n9. BAT SPEED (mph) BY PITCH KIND AT A CONTACT DEPTH (contact swings), AND BY COUNT (all swings)   |  league: statcast/swing_geometry.py v0.2 table 7');
  var BL = { '10..20': [67.0, 63.8, 64.3], '20..25': [70.0, 67.9, 68.3], '25..30': [71.7, 69.8, 70.3], '30..35': [73.1, 71.2, 71.8], '35..40': [74.3, 72.1, 72.5], '40..50': [74.7, 72.7, 73.0],
             ahead: [71.9, 70.9, 72.4], even: [70.2, 69.6, 71.4], two: [68.9, 68.3, 69.7] };
  function batOf(s) { return f(s.reduce(function (a, r) { return a + r.bat; }, 0) / Math.max(1, s.length), 1); }
  [[10, 20], [20, 25], [25, 30], [30, 35], [35, 40], [40, 50]].forEach(function (b) {
    var key = b[0] + '..' + b[1];
    print(pad('depth ' + key, 16) + ['FB', 'BR', 'OS'].map(function (k) { return pad(k + ' ' + batOf(sw.filter(function (r) { return r.kind === k && r.contact && r.depth >= b[0] && r.depth < b[1]; })), 10); }).join('') +
          '   |  ' + BL[key].map(function (v) { return v.toFixed(1); }).join(' / '));
  });
  [['ahead', function (r) { return r.strikes < 2 && r.balls > r.strikes; }], ['even', function (r) { return r.strikes < 2 && r.balls <= r.strikes; }], ['two', function (r) { return r.strikes === 2; }]].forEach(function (g) {
    print(pad(g[0] === 'two' ? 'two strikes' : g[0] === 'even' ? 'even or behind' : 'ahead', 16) + ['FB', 'BR', 'OS'].map(function (k) { return pad(k + ' ' + batOf(sw.filter(function (r) { return r.kind === k && g[1](r); })), 10); }).join('') +
          '   |  ' + BL[g[0]].map(function (v) { return v.toFixed(1); }).join(' / '));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
