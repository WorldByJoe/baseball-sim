/* ============================================================================
   fit_pitch_spread.js · v0.1 · 2026-10-02

   Fits the seam-break spreads in bb_engine.js's PITCH_TYPES (seamSD between
   pitchers, seamW pitch to pitch; [arm side, up] in inches) so that the
   model's pitches of each type spread in movement as the league's do
   (statcast/pitch_spread.py, 42 days of 2025). The spin spreads (rpmSD,
   effSD, tiltSD, rpmW and the engine's fixed eff and tilt scatter) are taken
   as they stand; the seam break makes up the rest, independently, so
     seam spread = sqrt(league spread^2 - spin-only spread^2) / k
   where k is the movement one inch of seam break gives on this flight. Where
   the spin spread alone already exceeds the league's, the seam spread is 0.
   Movement is induced break against a spinless ball on the same release,
   thrown by a league-typical right-hander at the middle of the zone.

   Run:  jsc bb_engine.js tools/fit_pitch_spread.js
   Paste the printed seamSD and seamW into PITCH_TYPES.

   CHANGED
     v0.1  first build (bb_engine v1.0)
============================================================================ */
(function () {
  var U = BB.units, IN = U.IN, env = BB.makeEnv({});
  // statcast/pitch_spread.py, 2025-05-05:2025-09-21: [IVB between, HB between, IVB within-game, HB within-game]
  var LEAGUE = { FF: [2.44, 3.55, 1.36, 1.75], SI: [4.34, 2.33, 1.80, 1.65], FC: [3.11, 2.27, 1.87, 1.86], SL: [3.34, 2.79, 2.03, 1.80],
                 ST: [3.26, 2.53, 2.40, 2.53], CU: [4.18, 3.82, 1.89, 1.89], CH: [3.88, 2.17, 2.34, 1.90], FS: [3.49, 2.80, 2.68, 2.45] };
  var P = { armSide: -1, rel: { ht: 5.85, side: 1.9, ext: 6.4 } }, rel0 = BB.releasePoint(P), rng = BB.makeRng(5), N = 1500;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sd(v) { var m = 0; v.forEach(function (x) { m += x; }); m /= v.length; var s = 0; v.forEach(function (x) { s += (x - m) * (x - m); }); return Math.sqrt(s / v.length); }
  var Z = []; for (var i = 0; i < N; i++) { var z = []; for (var j = 0; j < 12; j++) z.push(rng.n(0, 1)); Z.push(z); }
  // movement [IVB, HB] of N draws: between pitchers (their usual pitch) or pitch to pitch (around the typical pitcher)
  function spread(t, within, seamSD) {
    var d = BB.PITCH_TYPES[t], mph = 94 + d.dv, sp = mph * U.MPH;
    var a = BB.aim(rel0, sp, d.rpm, d.tilt, d.eff, -1, [0, 0.75], env, null), iv = [], hb = [];
    Z.forEach(function (z) {
      var rpm, eff, tilt, v = sp, rel = rel0, seam;
      if (!within) { rpm = clamp(d.rpm + d.rpmSD * z[0], d.rpm - 3 * d.rpmSD, d.rpm + 3 * d.rpmSD); eff = clamp(d.eff + d.effSD * z[1], 0.03, 0.99); tilt = d.tilt + d.tiltSD * z[2]; }
      else { rpm = d.rpm * (1 + d.rpmW * z[0]); eff = clamp(d.eff + 0.03 * z[1], 0.05, 1); tilt = d.tilt + 5 * z[2]; v = (mph + d.veloW * z[5]) * U.MPH;
             rel = [rel0[0] + 0.02 * z[6], rel0[1] + 0.02 * z[7], rel0[2] + 0.02 * z[8]]; }
      seam = [seamSD[0] * z[3], seamSD[1] * z[4]];
      var dir = BB.dirOf(a.yaw, a.pit), v0 = [dir[0] * v, dir[1] * v, dir[2] * v];
      var fl = BB.flyPitch(rel, v0, BB.spinVector(dir, rpm, tilt, eff, -1), env, false, seam, -1), none = BB.flyPitch(rel, v0, [0, 0, 0], env, false);
      iv.push((fl.z - none.z) / IN); hb.push(-(fl.x - none.x) / IN);
    });
    return [sd(iv), sd(hb)];
  }
  function fit(t, within) {
    var L = LEAGUE[t].slice(within ? 2 : 0, within ? 4 : 2), spin = spread(t, within, [0, 0]);
    var unit = spread(t, within, [1, 1]), k = [Math.sqrt(Math.max(1e-9, unit[1] * unit[1] - spin[1] * spin[1])), Math.sqrt(Math.max(1e-9, unit[0] * unit[0] - spin[0] * spin[0]))];
    var seam = [Math.sqrt(Math.max(0, L[1] * L[1] - spin[1] * spin[1])) / k[0], Math.sqrt(Math.max(0, L[0] * L[0] - spin[0] * spin[0])) / k[1]];   // [arm side, up]
    seam = seam.map(function (x) { return Math.round(x * 10) / 10; });
    return { L: L, spin: spin, seam: seam, got: spread(t, within, seam) };
  }
  function f2(v) { return v.map(function (x) { return x.toFixed(2); }).join(' / '); }
  print('fit_pitch_spread v0.1: movement spread [IVB / HB] in inches; seam [arm side, up]');
  print('type  BETWEEN PITCHERS: league | spin only | seamSD -> model   ||   PITCH TO PITCH: league | spin only | seamW -> model');
  Object.keys(LEAGUE).forEach(function (t) {
    var b = fit(t, false), w = fit(t, true);
    print(t + '    ' + f2(b.L) + ' | ' + f2(b.spin) + ' | [' + b.seam.join(', ') + '] -> ' + f2(b.got) + '   ||   ' + f2(w.L) + ' | ' + f2(w.spin) + ' | [' + w.seam.join(', ') + '] -> ' + f2(w.got));
  });
})();
