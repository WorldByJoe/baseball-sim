/* ============================================================================
   run_pa.js · v0.4 · 2026-09-29

   Headless calibration harness for the plate-appearance layer. Draws a
   league (pitchers, hitters, umpires, catchers) from the TRAITS
   distributions, plays N random plate appearances, and prints the metric
   SUITE beside MLB league values: per-PA outcomes, per-pitch outcomes,
   plate discipline, and batted-ball quality. Every row is judged together -
   one metric passing is not a pass.

   Each PA finds its pitcher at a random point in his outing (so fatigue is
   represented), its batter with a random amount of this pitcher already
   seen (so in-game learning is represented), and a park and day drawn from
   MLB's own mix of elevations, roofs, temperatures and humidity - league
   statistics were gathered in that air, not at sea level (Joe, 2026-09-29).

   Run:  jsc ../bb_engine.js run_pa.js -- N SEED
   MLB targets: 2024 league (FanGraphs / Baseball Savant).

   CHANGED
     v0.4  command-line N and SEED actually read (inside the wrapper, `arguments` was its own, empty)
     v0.3  parks and weather drawn from MLB's mix; home-run distance, speed, angle
     v0.2  whiff rate and exit velocity by pitch type
     v0.1  first build
============================================================================ */
(function (A) {
  var N = +A[0] || 20000, SEED = +A[1] || 7;
  var U = BB.units, rng = BB.makeRng(SEED);
  var i, pit = [], bat = [], ump = [];
  for (i = 0; i < 90; i++) pit.push(BB.makePitcher(rng, { role: 'SP' }));
  for (i = 0; i < 90; i++) pit.push(BB.makePitcher(rng, { role: 'RP' }));
  for (i = 0; i < 270; i++) bat.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 20; i++) ump.push(BB.makeUmp(rng));

  var pa = { K: 0, BB: 0, HBP: 0, HR: 0, BIP: 0 }, npa = 0, npit = 0;
  var res = { ball: 0, called_strike: 0, swinging_strike: 0, foul: 0, in_play: 0, hr: 0, hbp: 0 };
  var z = { n: 0, sw: 0, ct: 0 }, o = { n: 0, sw: 0, ct: 0 }, fps = 0;
  var whyMiss = {}, byType = {};
  var bbe = [], t0 = Date.now();

  for (var n = 0; n < N; n++) {
    var P = pit[rng.u() < 0.6 ? Math.floor(rng.u() * 90) : 90 + Math.floor(rng.u() * 90)];
    var B = bat[Math.floor(rng.u() * bat.length)];
    P.load = rng.u() * P.stamina * 1.05;
    var r = BB.simPA(P, B, { env: BB.mlbEnv(rng), ump: ump[Math.floor(rng.u() * ump.length)],
                             framing: rng.n(0, 0.35), seen: rng.u() * 80 }, rng);
    npa++; pa[r.result]++;
    r.pitches.forEach(function (p, k) {
      npit++; res[p.result]++;
      var g = p.inZone ? z : o;
      g.n++;
      var ty = byType[p.pitch.type] || (byType[p.pitch.type] = { n: 0, sw: 0, wh: 0, ev: [] });
      ty.n++;
      if (p.swing) { ty.sw++; if (!p.swing.contact) ty.wh++; }
      if (p.bb && p.bb.fair) ty.ev.push(p.bb.ev);
      if (p.swing) { g.sw++; if (p.swing.contact) g.ct++; else whyMiss[p.swing.why] = (whyMiss[p.swing.why] || 0) + 1; }
      if (k === 0 && p.result !== 'ball' && p.result !== 'hbp') fps++;
    });
    if (r.bb) bbe.push({ ev: r.bb.ev, la: r.bb.la, spray: r.bb.spray, side: r.pitches[r.pitches.length - 1].side, hr: r.result === 'HR', dist: r.bb.projDist, back: r.bb.backspin });
  }

  function pct(a, b) { return (100 * a / b).toFixed(1); }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function row(label, model, mlb) { print(pad(label, 26) + pad(model, 9) + pad(mlb, 9)); }
  function mean(a) { var s = 0; a.forEach(function (x) { s += x; }); return s / a.length; }
  function sd(a) { var m = mean(a), s = 0; a.forEach(function (x) { s += (x - m) * (x - m); }); return Math.sqrt(s / a.length); }

  print('run_pa  N=' + npa + '  seed=' + SEED + '  pitches=' + npit + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  print(pad('metric', 26) + pad('model', 9) + pad('MLB', 9));
  print('-- per plate appearance');
  row('K%', pct(pa.K, npa), '22.6');
  row('BB%', pct(pa.BB, npa), '8.2');
  row('HBP%', pct(pa.HBP, npa), '1.1');
  row('HR%', pct(pa.HR, npa), '3.0');
  row('balls in play %', pct(pa.BIP, npa), '65.1');
  row('pitches per PA', (npit / npa).toFixed(2), '3.90');
  print('-- per pitch');
  row('ball', pct(res.ball, npit), '36.3');
  row('called strike', pct(res.called_strike, npit), '16.4');
  row('swinging strike', pct(res.swinging_strike, npit), '11.1');
  row('foul', pct(res.foul, npit), '17.9');
  row('in play (incl HR)', pct(res.in_play + res.hr, npit), '17.3');
  row('first-pitch strike', pct(fps, npa), '61.0');
  print('-- plate discipline');
  row('zone %', pct(z.n, z.n + o.n), '49.0');
  row('swing %', pct(z.sw + o.sw, z.n + o.n), '47.2');
  row('zone swing %', pct(z.sw, z.n), '67.2');
  row('chase %', pct(o.sw, o.n), '28.5');
  row('zone contact %', pct(z.ct, z.sw), '85.2');
  row('chase contact %', pct(o.ct, o.sw), '56.5');
  row('contact %', pct(z.ct + o.ct, z.sw + o.sw), '76.3');
  print('-- batted balls in fair territory (n=' + bbe.length + ')');
  var ev = bbe.map(function (b) { return b.ev; }), la = bbe.map(function (b) { return b.la; });
  row('exit velo mean', mean(ev).toFixed(1), '88.5');
  row('exit velo sd', sd(ev).toFixed(1), '~14');
  row('launch angle mean', mean(la).toFixed(1), '12.5');
  row('launch angle sd', sd(la).toFixed(1), '~26');
  row('hard hit % (95+)', pct(ev.filter(function (v) { return v >= 95; }).length, ev.length), '38.5');
  var barrel = bbe.filter(function (b) {
    if (b.ev < 98) return false;
    var lo = Math.max(8, 26 - (b.ev - 98)), hi = Math.min(50, 30 + (b.ev - 98) * 20 / 18);
    return b.la >= lo && b.la <= hi;
  }).length;
  row('barrel %', pct(barrel, bbe.length), '7.8');
  row('ground ball % (<10)', pct(la.filter(function (a) { return a < 10; }).length, la.length), '43');
  row('line drive % (10-25)', pct(la.filter(function (a) { return a >= 10 && a < 25; }).length, la.length), '24');
  var fb = bbe.filter(function (b) { return b.la >= 25 && b.la <= 50; });
  row('fly ball % (25-50)', pct(fb.length, la.length), '24');
  row('popup % (>50)', pct(la.filter(function (a) { return a > 50; }).length, la.length), '9');
  row('HR / fly ball', pct(fb.filter(function (b) { return b.hr; }).length, fb.length), '~17');
  var hrs = bbe.filter(function (b) { return b.hr; });
  row('HR projected distance', mean(hrs.map(function (b) { return b.dist; })).toFixed(0), '~400');
  row('HR exit velo', mean(hrs.map(function (b) { return b.ev; })).toFixed(1), '~103.5');
  row('HR launch angle', mean(hrs.map(function (b) { return b.la; })).toFixed(1), '~28');
  var pull = 0, cent = 0, opp = 0;
  bbe.forEach(function (b) { var a = b.spray * b.side; if (a > 15) pull++; else if (a < -15) opp++; else cent++; });
  row('pull %', pct(pull, bbe.length), '40');
  row('centre %', pct(cent, bbe.length), '34');
  row('opposite %', pct(opp, bbe.length), '26');
  print('-- by pitch type: usage / whiff per swing / mean EV   (MLB whiff: FF 21, SI 13, FC 23, SL 34, ST 33, CU 31, CH 31, FS 34)');
  Object.keys(byType).forEach(function (k) {
    var t = byType[k];
    print(pad(k, 26) + pad(pct(t.n, npit), 9) + pad(pct(t.wh, t.sw), 9) + pad(t.ev.length ? mean(t.ev).toFixed(1) : '-', 9));
  });
  print('-- why swings missed (share of misses)');
  var tm = 0; Object.keys(whyMiss).forEach(function (k) { tm += whyMiss[k]; });
  Object.keys(whyMiss).forEach(function (k) { row(k, pct(whyMiss[k], tm), ''); });
})(typeof arguments !== 'undefined' ? arguments : []);   // jsc's command-line arguments live at TOP level only
