/* ============================================================================
   collide_check.js · v0.1 · 2026-10-13

   The engine's bat-ball collision (collide) against the published physics, contact by contact, with nothing else of
   the engine in the way (no swing scatter, no flight): a pitch of given speed, descent and spin meets a level bat of
   given speed and attack angle at a given vertical offset D (+ = ball above the barrel's centre), and the exit speed,
   launch angle and backspin come out.
     Nathan, "Optimizing the Swing" (The Hardball Times, 2015), table 2: 85.8 mph fastball, 6 deg descent, 2000 rpm
       backspin, bat 70 mph: attack 18.8, D 1.09 in -> 100.6 mph, 29.6 deg, 2421 rpm; 70.7 mph curveball, 10 deg,
       2000 rpm topspin: attack 17.8, D 1.03 -> 100.4, 30.3, 2285; tee: attack 25, D 1.60 -> 88.4, 33.3, 1212.
     Kensrud, Nathan & Smith, Am. J. Phys. 85, 503 (2017): a ball on a tee struck by a bat at 77 mph, level: spin rises
       179 rpm per degree of launch angle, exit speed falls 0.65 mph per degree (baseballs, launch 0-30 deg).
   Prints one JSON line per case, and a sweep of D for the fastball with attack 10 (the league's typical swing).

   Run:  tools/diag/run.sh bb_engine.js review/collide_check.js -- ['{"geom":"level"}' tuneContact options]
   Nathan's offset is the centres' height difference at contact, so only GEOM 'level' compares with his rows like for
   like; the engine's own D is the paths' height difference (GEOM 'relative' is the consistent reading of it).
   CHANGED
     v0.1  first build (Joe, 2026-10-13: does a better collision model fix the launch angles?)
============================================================================ */
(function (A) {
  var U = BB.units, MPH = U.MPH, IN = U.IN, DEG = U.DEG, RPM = U.RPM;
  if (A[0]) BB.tuneContact(JSON.parse(A[0]));
  function hit(pitchMph, descDeg, spinRpm, batMph, attackDeg, Din) {   // spinRpm + = backspin as pitched
    var d = descDeg * DEG, v = [0, -pitchMph * MPH * Math.cos(d), -pitchMph * MPH * Math.sin(d)], w = [-spinRpm * RPM, 0, 0];
    var sw = { bat: BB.BAT_DEFAULT, dLong: 0, attack: attackDeg, attackAt: attackDeg, theta: 0, faceTh: 0, tilt: 0, side: -1, D: Din * IN, batMph: batMph, batAt: batMph };
    var c = BB.collide({ plate: { v: v, w: w } }, sw);
    if (!c) return null;
    var sp = Math.sqrt(c.v[0] * c.v[0] + c.v[1] * c.v[1] + c.v[2] * c.v[2]), vh = [c.v[0], c.v[1], 0], h = Math.sqrt(vh[0] * vh[0] + vh[1] * vh[1]);
    var side = [vh[1] / h, -vh[0] / h, 0];   // vh x z: backspin positive
    return { D: Din, attack: attackDeg, ev: +(sp / MPH).toFixed(1), la: +(Math.asin(c.v[2] / sp) / DEG).toFixed(1), back: Math.round((c.w[0] * side[0] + c.w[1] * side[1]) / RPM), q: +c.q.toFixed(3) };
  }
  print(JSON.stringify({ case: 'Nathan fastball', published: [100.6, 29.6, 2421], engine: hit(85.8, 6, 2000, 70, 18.8, 1.09) }));
  print(JSON.stringify({ case: 'Nathan curveball', published: [100.4, 30.3, 2285], engine: hit(70.7, 10, -2000, 70, 17.8, 1.03) }));
  print(JSON.stringify({ case: 'Nathan tee', published: [88.4, 33.3, 1212], engine: hit(0.001, 0, 0, 70, 25, 1.60) }));
  var tee = []; for (var D = 0; D <= 1.35; D += 0.15) tee.push(hit(0.001, 0, 0, 77, 0, D));
  var n = tee.length, mx = 0, my = 0, me = 0; tee.forEach(function (t) { mx += t.la / n; my += t.back / n; me += t.ev / n; });
  var sxx = 0, sxy = 0, sxe = 0; tee.forEach(function (t) { sxx += (t.la - mx) * (t.la - mx); sxy += (t.la - mx) * (t.back - my); sxe += (t.la - mx) * (t.ev - me); });
  print(JSON.stringify({ case: 'Kensrud tee, bat 77 mph level', published: { rpmPerDeg: 179, mphPerDeg: -0.65 }, engine: { rpmPerDeg: +(sxy / sxx).toFixed(1), mphPerDeg: +(sxe / sxx).toFixed(3) }, points: tee }));
  var sweep = []; for (D = -1.5; D <= 2.25; D += 0.25) sweep.push(hit(92, 6, 2200, 72, 10, D));
  print(JSON.stringify({ case: 'sweep: 92 mph fastball, 6 deg, 2200 rpm; bat 72 mph, attack 10', points: sweep }));
})(typeof arguments !== 'undefined' ? arguments : []);
