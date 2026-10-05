/* ============================================================================
   mirror_check.js · v0.1 · 2026-10-05

   Left-right mirrors and platoon splits. The same men with both hands: each
   batter is drawn twice from the same seed, once right-handed and once left,
   each pitcher likewise, so a left-handed batter against a right-handed
   pitcher is the exact mirror of the right-handed batter against the
   left-handed pitcher. Every plate appearance of a mirror pair runs from the
   same dice. Two tests: (1) the mirror pairs' outcomes - strikeouts, walks,
   swings, whiffs, chases, balls in play and their exit speed, launch angle
   and spray in the batter's own pull frame, and the hits they become on a
   symmetric field - agree within sampling noise; pitch by pitch, the two
   members of a pair are compared exactly (plate x mirrored, everything else
   the same) and the first divergence of each kind is reported; (2) the
   platoon split, same side against opposite, is about the league's (2025:
   right-handed batters 20 points of wOBA worse against right-handed pitchers,
   left-handed batters about 30 points worse against left-handers).

   Run:  tools/diag/run.sh bb_engine.js bb_field.js headless/mirror_check.js -- [batters] [PA each] [seed]

   CHANGED
     v0.1  first build (the bug audit, docs/briefs/2026-10-05_bug_audit.md)
============================================================================ */
(function (A) {
  var NB = +A[0] || 150, NPA = +A[1] || 40, SEED = +A[2] || 3, NP = 60;
  var env = BB.makeEnv({}), ump = BB.makeUmp(BB.makeRng(99)), W = { BB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };
  var rngD = BB.makeRng(5), POSN = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  var fielders = POSN.map(function (pos) { return BB.makeBatter(rngD, { pos: pos }); }), Pf = BB.makePitcher(rngD, { role: 'SP' }); Pf.pos = 'P';
  var D = BBField.makeDefense(fielders.concat([Pf]));
  function batter(i, hand) { return BB.makeBatter(BB.makeRng(100000 + SEED * 1000 + i), { bats: hand, pos: 'LF' }); }
  function pitcher(j, hand) { return BB.makePitcher(BB.makeRng(200000 + SEED * 1000 + j), { throws: hand, role: j % 3 ? 'SP' : 'RP' }); }
  var BAT = { R: [], L: [] }, PIT = { R: [], L: [] };
  for (var i = 0; i < NB; i++) { BAT.R.push(batter(i, 'R')); BAT.L.push(batter(i, 'L')); }
  for (var j = 0; j < NP; j++) { PIT.R.push(pitcher(j, 'R')); PIT.L.push(pitcher(j, 'L')); }
  var COMBOS = ['RvR', 'RvL', 'LvR', 'LvL'], S = {}, LOG = {};
  COMBOS.forEach(function (c) { S[c] = { pa: 0, k: 0, bb: 0, hbp: 0, bip: 0, hr: 0, sw: 0, wh: 0, chase: 0, out: 0, ev: 0, la: 0, spray: 0, pull: 0, gb: 0, h1: 0, h2: 0, h3: 0, woba: 0 }; LOG[c] = {}; });
  function zoneOf(B, q) { return BB.inZone(B, q.pitch.plate.x, q.pitch.plate.z); }
  function sig(res) {   // a plate appearance's signature: each pitch's result, its plate z, and its plate x in the batter's frame
    return res.pitches.map(function (q) { return q.result + ':' + q.pitch.plate.z.toFixed(4) + ':' + (q.pitch.plate.x * q.side).toFixed(4) + (q.swing ? ':sw' + (q.swing.contact ? 'c' : 'm') : ''); }).join(' ') + ' => ' + res.result;
  }
  COMBOS.forEach(function (c) {
    var bh = c[0], ph = c[2], s = S[c];
    for (var i = 0; i < NB; i++) {
      var B = BAT[bh][i], sb = BB.batterSide(B, null);
      for (var k = 0; k < NPA; k++) {
        var P = PIT[ph][(i * 7 + k) % NP], rng = BB.makeRng(300000 + SEED * 100000 + i * 100 + k);
        P.load = 0;
        var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 10, rec: true }, rng);
        if (res.result === 'END') continue;
        s.pa++;
        if (i * NPA + k < 400) LOG[c][i * NPA + k] = sig(res);
        res.pitches.forEach(function (q) { if (!q.swing) return; s.sw++; if (!q.swing.contact) s.wh++; if (!zoneOf(B, q)) s.chase++; });
        if (res.result === 'K') { s.k++; s.out++; }
        else if (res.result === 'BB') { s.bb++; s.woba += W.BB; }
        else if (res.result === 'HBP') { s.hbp++; s.woba += W.HBP; }
        else {
          var bb = res.bb; s.bip++; s.ev += bb.ev; s.la += bb.la; var sp = bb.spray * sb; s.spray += sp; if (sp > 15) s.pull++; if (bb.la < 10) s.gb++;
          if (bb.hr) { s.hr++; s.woba += W.HR; continue; }
          BBField.positionDefense(D, B, sb);
          var o = BBField.resolve(bb, B, [null, null, null, null], 0, D, env, BB.makeRng(400000 + i * 100 + k), { side: sb, going: 0, foulCaught: !!res.foulCaught });
          if (o.hit === '1B') { s.h1++; s.woba += W['1B']; } else if (o.hit === '2B') { s.h2++; s.woba += W['2B']; } else if (o.hit === '3B') { s.h3++; s.woba += W['3B']; } else if (o.hit === 'HR') { s.hr++; s.woba += W.HR; } else s.out++;
        }
      }
    }
  });
  function f(v, d) { return v.toFixed(d === undefined ? 3 : d); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function row(c) {
    var s = S[c], pa = s.pa || 1, bip = s.bip || 1;
    return pad(c, 5) + pad(s.pa, 7) + pad(f(s.k / pa), 8) + pad(f(s.bb / pa), 8) + pad(f(s.hbp / pa), 7) + pad(f(s.hr / pa), 7) + pad(f(s.sw / (s.pa * 3.9)), 8) + pad(f(s.wh / (s.sw || 1)), 8) + pad(f(s.chase / (s.sw || 1)), 8) +
           pad(f(s.ev / bip, 1), 7) + pad(f(s.la / bip, 1), 7) + pad(f(s.spray / bip, 1), 7) + pad(f(s.pull / bip), 7) + pad(f(s.gb / bip), 7) + pad(f((s.h1 + s.h2 + s.h3) / Math.max(1, s.bip - s.hr)), 8) + pad(f(s.woba / pa), 8);
  }
  print('mirror_check v0.1 · ' + NB + ' batters x ' + NPA + ' PA x 4 hand combinations · ' + NP + ' pitchers · seed ' + SEED + ' · the same men with both hands, the same dice for each mirror pair');
  print('');
  print('1. BY HANDS (batter v pitcher)' + pad('PA', 7) + pad('K', 8) + pad('BB', 8) + pad('HBP', 7) + pad('HR', 7) + pad('swing', 8) + pad('whiff', 8) + pad('chase', 8) + pad('EV', 7) + pad('LA', 7) + pad('spray', 7) + pad('pull', 7) + pad('GB', 7) + pad('BABIP', 8) + pad('wOBA', 8) + '   (spray + toward his pull side; swing per pitch at 3.9 a PA)');
  COMBOS.forEach(function (c) { print(row(c)); });
  // 2. the mirrors
  function diff(a, b, key, n, per) { var x = S[a][key] / (per ? S[a][per] : S[a].pa), y = S[b][key] / (per ? S[b][per] : S[b].pa), p = (x + y) / 2, se = Math.sqrt(2 * p * (1 - p) / n); return { d: x - y, se: se, z: se ? (x - y) / se : 0 }; }
  print('');
  print('2. MIRRORS: the difference between a pair that should be identical, and how many sampling sds it is (|z| > 3 on several lines means an asymmetry)');
  [['RvL', 'LvR'], ['RvR', 'LvL']].forEach(function (pr) {
    var a = pr[0], b = pr[1], out = pad(a + ' - ' + b, 12), nPA = Math.min(S[a].pa, S[b].pa), nBIP = Math.min(S[a].bip, S[b].bip), nSW = Math.min(S[a].sw, S[b].sw);
    [['k', nPA, null, 'K'], ['bb', nPA, null, 'BB'], ['hr', nPA, null, 'HR'], ['wh', nSW, 'sw', 'whiff'], ['chase', nSW, 'sw', 'chase'], ['pull', nBIP, 'bip', 'pull'], ['gb', nBIP, 'bip', 'GB']].forEach(function (q) {
      var d = diff(a, b, q[0], q[1], q[2]); out += '  ' + q[3] + ' ' + (d.d >= 0 ? '+' : '') + f(d.d) + ' (' + f(d.z, 1) + ')';
    });
    var dw = S[a].woba / S[a].pa - S[b].woba / S[b].pa, se = Math.sqrt(2 * 0.42 * 0.42 / nPA);
    out += '  wOBA ' + (dw >= 0 ? '+' : '') + f(dw) + ' (' + f(dw / se, 1) + ')';
    var dsp = S[a].spray / S[a].bip - S[b].spray / S[b].bip, ses = Math.sqrt(2 * 25 * 25 / nBIP);
    out += '  spray ' + (dsp >= 0 ? '+' : '') + f(dsp, 1) + ' deg (' + f(dsp / ses, 1) + ')';
    print(out);
    // pitch by pitch
    var same = 0, n = 0, firstDiff = null;
    Object.keys(LOG[a]).forEach(function (k) { if (!(k in LOG[b])) return; n++; if (LOG[a][k] === LOG[b][k]) same++; else if (!firstDiff) firstDiff = [k, LOG[a][k], LOG[b][k]]; });
    print('             pitch by pitch, the first ' + n + ' plate appearances: ' + same + ' identical in every pitch\'s result, height and mirrored plate x' + (firstDiff ? '; first difference, PA ' + firstDiff[0] + ':\n               ' + a + ' ' + firstDiff[1].slice(0, 160) + '\n               ' + b + ' ' + firstDiff[2].slice(0, 160) : ''));
  });
  // 3. the platoon split
  print('');
  print('3. PLATOON: same side minus opposite side, wOBA (league 2025: right-handed batters about -.020, left-handed about -.030) and the parts');
  [['R', 'RvR', 'RvL'], ['L', 'LvL', 'LvR']].forEach(function (q) {
    var a = S[q[1]], b = S[q[2]];
    print('   ' + q[0] + 'HB: wOBA ' + f(a.woba / a.pa - b.woba / b.pa) + '  K ' + ((a.k / a.pa - b.k / b.pa) >= 0 ? '+' : '') + f(a.k / a.pa - b.k / b.pa) + '  BB ' + ((a.bb / a.pa - b.bb / b.pa) >= 0 ? '+' : '') + f(a.bb / a.pa - b.bb / b.pa) +
          '  HR ' + ((a.hr / a.pa - b.hr / b.pa) >= 0 ? '+' : '') + f(a.hr / a.pa - b.hr / b.pa) + '  whiff ' + ((a.wh / a.sw - b.wh / b.sw) >= 0 ? '+' : '') + f(a.wh / a.sw - b.wh / b.sw) + '  EV ' + f(a.ev / a.bip - b.ev / b.bip, 1) + ' mph');
  });
})(typeof arguments !== 'undefined' ? arguments : []);
