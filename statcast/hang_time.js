/* ============================================================================
   hang_time.js · v0.1 · 2026-10-06

   Hang time for the league's balls in the air, which Statcast's pitch data do
   not carry. For each ball [exit speed mph, launch angle deg, distance ft] the
   engine's own flight (the parks' average air, 74 F at 510 ft; no wall) is flown with
   the model's median backspin for that launch angle (SPIN below, measured with
   headless/air_check.js, 100 games at seed 3), its exit speed solved by
   bisection so that it comes down at Statcast's projected distance, and the
   time to the ground is its hang. (Solving the spin at the measured exit speed
   instead is ambiguous: the distance peaks at 500-2,500 rpm and falls either
   side.) headless/air_check.js runs the same solve on the model's own balls,
   whose true hang is known, as the check of the definition.
   Called by statcast/air_balls.py with the balls in a global HANG_IN; prints
   one line, a JSON array of [hang s, flag] (flag 0 solved, -1 shorter than a
   20-mph ball, 1 longer than a 130-mph one).

   Run (by air_balls.py):  tools/diag/run.sh bb_engine.js IN.js statcast/hang_time.js

   CHANGED
     v0.1  first build (the field follow-up brief)
============================================================================ */
var HangTime = (function () {
  var U = BB.units, FT = U.FT, MPH = U.MPH, DEG = U.DEG, RPM = U.RPM;
  var ENV = BB.makeEnv({ tempF: 74, elevFt: 510, fence: [9999, 9999, 9999, 9999, 9999] });
  // the model's median backspin (rpm) by launch angle, 2-deg bands from 10 deg (air_check.js section 0, bb_engine v3.3)
  var SPIN = [456, 514, 1082, 1134, 1502, 1797, 2220, 2396, 2663, 2947, 3094, 3543, 3824, 4197, 4184, 4579, 4688, 5087, 4869, 5342];
  function spinAt(la) { var x = Math.max(0, Math.min(SPIN.length - 1, (la - 11) / 2)), i = Math.min(SPIN.length - 2, Math.floor(x)); return SPIN[i] + (x - i) * (SPIN[i + 1] - SPIN[i]); }
  function fly(ev, la, rpm) {
    var v = ev * MPH, a = la * DEG;
    var fl = BB.flyBatted([0, 0.45, 0.9], [0, v * Math.cos(a), v * Math.sin(a)], [rpm * RPM, 0, 0], ENV, false);
    return { d: Math.hypot(fl.x, fl.y) / FT, t: fl.t };
  }
  function solve(ev, la, dist) {
    var w = spinAt(la), lo = 20, hi = 130, a = fly(lo, la, w), b = fly(hi, la, w);
    if (dist <= a.d) return [a.t, -1];
    if (dist >= b.d) return [b.t, 1];
    var r = a;
    for (var i = 0; i < 16; i++) { var m = (lo + hi) / 2; r = fly(m, la, w); if (r.d < dist) lo = m; else hi = m; }
    return [r.t, 0];
  }
  return { solve: solve };
})();
if (typeof HANG_IN !== 'undefined') print(JSON.stringify(HANG_IN.map(function (b) { var s = HangTime.solve(b[0], b[1], b[2]); return [Math.round(s[0] * 1000) / 1000, s[1]]; })));
