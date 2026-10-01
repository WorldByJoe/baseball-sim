/* ============================================================================
   physics_check.js · v0.1 · 2026-09-29

   Checks the engine's flight physics against published numbers before any
   plate appearance is judged: (1) each pitch type, thrown by a league-typical
   right-hander, is compared with Baseball Savant's average speed at the
   plate, flight time and movement (induced vertical break and horizontal
   break vs a spinless ball on the same release); (2) batted balls at set
   exit speeds and launch angles are compared with Statcast carry distances.
   Run:  jsc ../bb_engine.js physics_check.js

   CHANGED
     v0.1  first build
============================================================================ */
(function () {
  var U = BB.units, env = BB.makeEnv({}), G = BB.geometry;
  var open = BB.makeEnv({ fence: [9999, 9999, 9999, 9999, 9999] });   // carry with no fence in the way
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function pad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

  // Savant 2023-25 averages for a RHP: [IVB in, HB in (+ = arm side)]
  var SAVANT = { FF: [16, 7.5], SI: [7.5, 15.5], FC: [8.5, -2.5], SL: [1.5, -5.5], ST: [0.5, -14.5],
                 CU: [-9.5, -9], CH: [6.5, 14.5], FS: [2.5, 10.5] };
  print('PITCHES  (RHP, release 5.85 ft high, 1.9 ft arm side, 6.4 ft extension; aimed at the middle)');
  print('type   mph  plate-mph  time-s   IVB-in (Savant)   HB-in (Savant)');
  var P = { armSide: -1, rel: { ht: 5.85, side: 1.9, ext: 6.4 } };
  var rel = BB.releasePoint(P);
  Object.keys(BB.PITCH_TYPES).forEach(function (k) {
    var d = BB.PITCH_TYPES[k], mph = 94 + d.dv, sp = mph * U.MPH;
    var a = BB.aim(rel, sp, d.rpm, d.tilt, d.eff, -1, [0, 0.76], env, null);
    var dir = BB.dirOf(a.yaw, a.pit), v0 = [dir[0] * sp, dir[1] * sp, dir[2] * sp];
    var real = BB.flyPitch(rel, v0, BB.spinVector(dir, d.rpm, d.tilt, d.eff, -1), env, false);
    var none = BB.flyPitch(rel, v0, [0, 0, 0], env, false);
    var ivb = (real.z - none.z) / U.IN, hb = (real.x - none.x) / U.IN * -1;   // RHP arm side is -x
    var vp = Math.sqrt(real.v[0] * real.v[0] + real.v[1] * real.v[1] + real.v[2] * real.v[2]) / U.MPH;
    print(k + '   ' + pad(f1(mph), 5) + pad(f1(vp), 10) + pad(real.t.toFixed(3), 9) +
          pad(f1(ivb), 9) + pad('(' + SAVANT[k][0] + ')', 9) + pad(f1(hb), 11) + pad('(' + SAVANT[k][1] + ')', 9));
  });

  // Statcast carry, sea level ~70 F, typical backspin for the launch angle
  print('');
  print('BATTED BALLS  (spray 0, from 3 ft high; Statcast expectation in brackets)');
  print(' EV-mph  LA-deg  backspin-rpm   distance-ft  hang-s   apex-ft');
  [[100, 28, 2200, '~395'], [105, 28, 2200, '~420'], [110, 28, 2300, '~445'], [95, 30, 2400, '~360'],
   [90, 15, 1500, '~250'], [100, 10, 1100, 'line drive'], [85, 45, 3000, '~290 lazy fly'], [95, -5, -1200, 'grounder']]
  .forEach(function (c) {
    var sp = c[0] * U.MPH, la = c[1] * U.DEG;
    var v0 = [0, sp * Math.cos(la), sp * Math.sin(la)];
    var w0 = [c[2] * U.RPM, 0, 0];               // +x is backspin for a ball heading to centre field
    var fl = BB.flyBatted([0, G.Y_PLATE + 0.45, 0.9], v0, w0, open, false);
    var dist = Math.sqrt(fl.x * fl.x + fl.y * fl.y) / U.FT;
    print(pad(c[0], 6) + pad(c[1], 8) + pad(c[2], 12) + pad(Math.round(dist) + (fl.kind === 'over' ? ' HR' : fl.kind === 'wall' ? ' wall' : ''), 14) +
          pad(fl.t.toFixed(2), 9) + pad(Math.round(fl.apex / U.FT), 9) + '   ' + c[3]);
  });

  // The collision alone: a squared-up hit should give q*pitch + (1+q)*bat
  print('');
  print('COLLISION  (head-on, sweet spot, 72 mph bat vs 94 mph four-seamer)');
  var P2 = BB.makePitcher(BB.makeRng(3), { role: 'SP', throws: 'R' });
  var pitch = { plate: { v: [0, -38.7, -2.5], w: [0, 0, 0] } };
  var sw = { attack: 0, theta: 0, D: 0, dLong: 0, batMph: 72 };
  var col = BB.collide(pitch, sw), ev = Math.sqrt(col.v[0] * col.v[0] + col.v[1] * col.v[1] + col.v[2] * col.v[2]) / U.MPH;
  print('exit speed ' + f1(ev) + ' mph   (q*86.6 + 1.21*72 = ' + f1(0.21 * 86.6 + 1.21 * 72) + ')');
  [0.5, 1.0, 1.5, 2.0].forEach(function (D) {
    sw.D = D * U.IN; sw.attack = 10;
    pitch.plate.w = [-2200 * U.RPM * 0.9, 0, 0];     // a four-seamer's backspin (axis -x for a ball heading to the plate)
    var c = BB.collide(pitch, sw), s = Math.sqrt(c.v[0] * c.v[0] + c.v[1] * c.v[1] + c.v[2] * c.v[2]);
    print('undercut ' + D.toFixed(1) + ' in, 10 deg attack:  EV ' + f1(s / U.MPH) + ' mph, LA ' + f1(Math.asin(c.v[2] / s) / U.DEG) +
          ' deg, spin ' + Math.round(Math.sqrt(c.w[0] * c.w[0] + c.w[1] * c.w[1] + c.w[2] * c.w[2]) / U.RPM) + ' rpm');
  });
})();
