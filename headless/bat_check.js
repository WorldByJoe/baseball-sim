/* ============================================================================
   bat_check.js · v0.1 · 2026-10-01

   Prints what the bat model (bb_engine v0.8) makes of the professional
   profile: balance point, radius of gyration, the bending modes (frequency,
   pulse factor, nodes), and along the barrel the radius a ball meets, the
   mass it feels, the collision efficiency at game speed, and the exit speed
   of a head-on strike by a bat moving 72 mph at the sweet spot on an 85 mph
   pitch, as a share of the best point. Hold these against Nathan 2000 and
   Cross 1998: a 34 in wood bat balances about 11 in from the end, rings near
   170 and 550 Hz with the first node 6-7 in from the end, and a ball off the
   end or 12 in in leaves well below the sweet-spot speed.
   Run:  jsc ../bb_engine.js bat_check.js [oz] [length in]
   CHANGED
     v0.1  first build
============================================================================ */
(function (A) {
  var U = BB.units, oz = +A[0] || 31.8, len = +A[1] || 34, bat = BB.batOf(oz, len), MD = BB.BAT_MODES, sc = len / MD.L;
  function f(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function pad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
  print(oz + ' oz, ' + len + ' in: balance ' + f(MD.xc * sc, 1) + ' in from the end, radius of gyration ' + f(Math.sqrt(MD.k2) * sc, 1) + ' in');
  print('rigid effective mass at the sweet spot ' + f(bat.mEff / bat.m, 3) + ' of the bat; q there at 140 mph ' + f(bat.q, 3));
  MD.modes.forEach(function (m, n) {
    var nodes = [], i;
    for (i = 1; i < MD.x.length; i++) { var a = m.phi[i - 1], b = m.phi[i]; if (a * b < 0) nodes.push(f((MD.x[i - 1] - a * MD.h / (b - a)) * sc, 1)); }
    print('mode ' + (n + 1) + ': ' + f(m.f / sc, 0) + ' Hz, pulse factor ' + f(bat.g[n], 2) + ', nodes at ' + nodes.join(', ') + ' in from the end');
  });
  print('');
  print('in from end   radius-in   mass-felt/bat   q(game)   bat-mph   EV-mph   of best');
  var best = 0, rows = [];
  for (var x = 0; x <= 20; x += 1) {
    var vb = 72 * (1 + (BB.SWEET_IN - x) / 30), q = BB.qAt(bat, x, (vb + 85) * U.MPH), ev = q * 85 + (1 + q) * vb;
    rows.push([x, BB.batRadius(bat, x) / U.IN, BB.batMass(bat, x) / bat.m, q, vb, ev]); if (ev > best) best = ev;
  }
  rows.forEach(function (r) { print(pad(r[0], 11) + pad(f(r[1], 2), 12) + pad(f(r[2], 3), 16) + pad(f(r[3], 3), 10) + pad(f(r[4], 1), 10) + pad(f(r[5], 1), 9) + pad(f(r[5] / best, 2), 10)); });
})(typeof arguments !== 'undefined' ? arguments : []);
