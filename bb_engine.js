/* ============================================================================
   bb_engine.js · v0.7 · 2026-09-30

   The baseball engine. Pure JavaScript, seeded randomness, no DOM and no
   clock: the same file runs headless under jsc (calibration batches of
   thousands of plate appearances) and in the browser app, and a seed replays
   a game exactly. The page must never be the only way to run the model.

   THE DESIGN DECISION (Joe, 2026-09-29): players are defined by physical
   TRAITS - mostly things Statcast actually measures (bat speed, pitch
   velocity and spin, release point) plus the skills behind them (timing
   precision, pitch recognition, command). Every statistic - K%, walk rate,
   exit velocity, home runs - is an OUTPUT of those traits meeting physics and
   noise. Nothing below sets an outcome probability directly. The calibration
   knobs are the trait DISTRIBUTIONS in TRAITS, and the test is that a league
   of league-average traits reproduces an MLB league line.

   STAGES, in the order they run on every pitch:
     PLAN    the pitcher picks an intent (attack / edge / expand), a pitch
             type and a target, from the count, the batter's side and what
             he has just thrown                                (planPitch)
     EXPECT  the batter forms his guess from the scouting report on this
             pitcher in this count, and decides how hard to sit on it
                                                               (expectPitch)
     THROW   physics flies the real pitch; command noise moves it off the
             target, fatigue takes off speed and spin          (throwPitch)
     READ    the batter's picture of the pitch is a GHOST pitch - the same
             release, flown with the speed and spin he EXPECTED. Recognition
             corrects part of the difference before he commits; the rest is
             his misread. Tunnelling falls out of this: two pitches that
             look alike early and separate late fool him        (ghostPitch)
     DECIDE  swing or take, from where he thinks the ball will cross the
             zone, the count, and whether it is the pitch he was sitting on
     CALL    a take is called by an umpire whose zone has a soft edge (his
             accuracy), per-edge systematic misses, a count lean, and the
             catcher's framing                                 (callPitch)
     SWING   timing error, vertical offset and barrel position come from the
             misread plus his execution noise; the bat-ball collision is
             solved as a rigid-body impulse with friction      (collide)
     FLY     the batted ball flies with drag and Magnus lift until it lands
             or reaches the fence                              (flyBatted)
   Fielding, base running, managers and the game loop are the NEXT layer;
   this file ends where the ball lands.

   UNITS: SI inside the physics (m, s, kg, rad/s); human units on the traits
   (mph, in, ft, ms, rpm, deg) because those are what the screen shows.
   COORDINATES: origin at the point of home plate; +x toward first base (the
   catcher's right), +y toward the pitcher, +z up. A right-handed pitcher
   releases from the -x side; a right-handed batter stands on the -x side.

   CHANGED
     v0.7  the power chain: bat speed BUILT from height, weight, swing power per kg,
           swing length and the bat (v^3 = 4pWL/mEff); the bat's mass sets the
           collision efficiency; precision worsens as bat speed squared; fitted to
           the 2025 Statcast marginals, correlations left as tests
     v0.6  the running game's traits (jump, holdTime, popTime, block) and per-pitch
           hooks in simPA (beforePitch / afterPitch; result 'END' when the bases
           end the inning mid-count)
     v0.5  fielding and running traits on every player; landing state for the fielding
           layer; foul pops can be caught (g.foulCatch)
     v0.4  ghostPitch can keep its flight path, for drawing the batter's expected pitch
     v0.3  recognition = yes/no tunnelling event; MLB park/air mix; humidity;
           batted-ball drag fitted; home runs carried to projected distance
     v0.2  plate coverage: execution errors grow with reach off the zone
     v0.1  first build - pitch physics, decisions, umpire, collision, flight
============================================================================ */

var BB = (function () {
  'use strict';

  // ------------------------------------------------------------------ units
  var MPH = 0.44704, FT = 0.3048, IN = 0.0254, RPM = 2 * Math.PI / 60, DEG = Math.PI / 180;
  var G = 9.80665;

  // --------------------------------------------------------- random numbers
  // mulberry32: small and fast; a seed replays a game exactly.
  function makeRng(seed) {
    var s = (seed >>> 0) || 1, spare = null;
    function u() {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function n(mu, sd) {                       // normal deviate (polar Box-Muller)
      var z;
      if (spare !== null) { z = spare; spare = null; }
      else {
        var a, b, r;
        do { a = 2 * u() - 1; b = 2 * u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0);
        var f = Math.sqrt(-2 * Math.log(r) / r);
        z = a * f; spare = b * f;
      }
      return (mu || 0) + (sd === undefined ? 1 : sd) * z;
    }
    function pickW(w) {                        // index drawn in proportion to weights
      var tot = 0, i;
      for (i = 0; i < w.length; i++) tot += w[i];
      var r = u() * tot;
      for (i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
      return w.length - 1;
    }
    return { u: u, n: n, pickW: pickW };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function Phi(z) {                            // standard normal CDF (A&S 26.2.17)
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989422804 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  function normalize(w) {
    var s = 0, i;
    for (i = 0; i < w.length; i++) s += w[i];
    var o = [];
    for (i = 0; i < w.length; i++) o.push(s > 0 ? w[i] / s : 1 / w.length);
    return o;
  }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function unit(a) { var m = norm(a); return [a[0] / m, a[1] / m, a[2] / m]; }

  // ------------------------------------------------------ the ball and bat
  var BALL_M = 0.145, BALL_R = 0.0366;        // 5.125 oz; 9.125 in around
  var BALL_A = Math.PI * BALL_R * BALL_R;
  var BAT_R = 0.0331;                          // 2.61 in barrel
  var R_SUM = BALL_R + BAT_R;                  // centre-to-centre when touching: 2.75 in
  var Q_SWEET = 0.21;     // collision efficiency of wood at the sweet spot (Nathan): exit speed = q*pitch + (1+q)*bat
  var MU_BAT = 0.5;       // ball-bat friction; caps the tangential impulse on glancing contact
  var SWING_RADIUS = 0.6; // m: the barrel turns at (bat speed / this) rad/s near contact, so timing sets spray
  var C_LOC = 0.9;        // rad per m: an inside pitch is met farther out front and pulled
  var TIP_IN = 6, HANDLE_IN = -14;   // how far along the barrel from the sweet spot a ball can still be struck

  // ---------------------------------------------------------- the field
  var Y_PLATE = 17 * IN;                       // front edge of the plate - where location is measured
  var PLATE_HALF = 8.5 * IN;
  var ZONE_HALF = PLATE_HALF + BALL_R;         // any part of the ball over the plate is a strike
  var RUBBER_Y = 60.5 * FT;
  var CONTACT_Y = Y_PLATE + 0.45;              // contact happens about 18 in in front of the plate
  var BASE_FT = 90;
  var HBP_X = 0.58;                            // m from the plate's centre line toward the batter: his body

  // An environment is one ballpark on one day: air density from temperature,
  // elevation and humidity (humid air is LIGHTER - water vapour displaces
  // heavier nitrogen and oxygen), wind, and the fence (distances in ft at the
  // left-field line, left-centre, centre, right-centre, right-field line).
  function makeEnv(o) {
    o = o || {};
    var tempF = o.tempF === undefined ? 70 : o.tempF, elevFt = o.elevFt || 0;
    var rh = o.rh === undefined ? 0.5 : o.rh;
    var Tc = (tempF - 32) * 5 / 9, T = Tc + 273.15;
    var P = 101325 * Math.pow(1 - 2.25577e-5 * elevFt * FT, 5.25588);
    var Pv = rh * 610.78 * Math.exp(17.27 * Tc / (Tc + 237.3));
    return { tempF: tempF, elevFt: elevFt, rh: rh, rho: (P - Pv) / (287.05 * T) + Pv / (461.5 * T),
             wind: o.wind || [0, 0, 0], fence: o.fence || [330, 375, 400, 375, 330], wallFt: o.wallFt || 8 };
  }

  // The air MLB actually plays in (Joe, 2026-09-29: league batted-ball
  // statistics were gathered across these parks, not at sea level, so the
  // model is judged under the same mix). Approximate field elevation (ft)
  // and roof. Game-weighted mean elevation ~510 ft, most of it Denver. A
  // closed roof holds ~72 F; outdoor game-time temperature ~N(74, 10) F.
  var MLB_PARKS = [
    [55, 'open'], [20, 'open'], [35, 'open'], [30, 'open'], [270, 'retract'],        // NYY BOS BAL TB TOR
    [595, 'open'], [650, 'open'], [585, 'open'], [750, 'open'], [815, 'open'],       // CWS CLE DET KC MIN
    [40, 'retract'], [150, 'open'], [25, 'open'], [10, 'retract'], [550, 'retract'], // HOU LAA ATH SEA TEX
    [1050, 'open'], [10, 'retract'], [20, 'open'], [20, 'open'], [25, 'open'],       // ATL MIA NYM PHI WSH
    [595, 'open'], [535, 'open'], [635, 'retract'], [730, 'open'], [465, 'open'],    // CHC CIN MIL PIT STL
    [1085, 'retract'], [5200, 'open'], [450, 'open'], [15, 'open'], [5, 'open']      // ARI COL LAD SD SF
  ];
  function mlbEnv(rng) {
    var p = MLB_PARKS[Math.floor(rng.u() * MLB_PARKS.length)];
    var closed = p[1] === 'dome' || (p[1] === 'retract' && rng.u() < 0.6);
    return makeEnv({ elevFt: p[0], tempF: closed ? 72 : clamp(rng.n(74, 10), 40, 102),
                     rh: closed ? 0.45 : clamp(rng.n(0.6, 0.15), 0.15, 0.95) });
  }
  function fenceAt(env, sprayDeg) {            // metres to the fence along a spray angle
    var f = env.fence, a = clamp((sprayDeg + 45) / 22.5, 0, 4), i = Math.min(3, Math.floor(a)), t = a - i;
    var s = (1 - Math.cos(t * Math.PI)) / 2;
    return (f[i] * (1 - s) + f[i + 1] * s) * FT;
  }

  // ------------------------------------------------------------ aerodynamics
  // Drag and lift coefficients from Alan Nathan's trajectory calculator:
  // drag rises gently with spin; lift is a saturating function of the spin
  // factor S = R*w_perp/v. Only the TRANSVERSE part of the spin makes lift -
  // gyro spin along the flight path bends nothing.
  function cdOf(spinRpm) { return 0.3008 + 0.0292 * spinRpm / 1000; }
  function clOf(S) { return 1.12 * S / (0.583 + 2.333 * S); }
  // Batted-ball drag multiplier, FITTED: with it, a 103.5 mph drive at 28
  // degrees (with the backspin this model's collision gives it, ~2900 rpm)
  // carries ~400 ft AVERAGED OVER MLB'S PARKS AND WEATHER (mlbEnv) -
  // Statcast's average home run, 2023-25. That mix is 2.6% thinner air than
  // sea level at 70 F, worth +5 ft league-wide and +32 ft at Coors, so a fit
  // at standard air (1.115) under-corrected. Unscaled, the model carried the
  // ball 429 ft. Pitches keep the unscaled drag: their speed loss and
  // movement already matched Savant (physics_check.js).
  var AERO = { batCd: 1.142 };

  function accel(v, w, env, a, cds) {
    var ux = v[0] - env.wind[0], uy = v[1] - env.wind[1], uz = v[2] - env.wind[2];
    var sp = Math.sqrt(ux * ux + uy * uy + uz * uz);
    var k = 0.5 * env.rho * BALL_A / BALL_M;
    var wm = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
    var kd = k * cdOf(wm / RPM) * cds * sp;
    a[0] = -kd * ux; a[1] = -kd * uy; a[2] = -kd * uz - G;
    var cx = w[1] * uz - w[2] * uy, cy = w[2] * ux - w[0] * uz, cz = w[0] * uy - w[1] * ux;
    var cm = Math.sqrt(cx * cx + cy * cy + cz * cz);          // = w_perp * speed
    if (cm > 1e-9 && sp > 1e-6) {
      var f = k * clOf(BALL_R * cm / (sp * sp)) * sp * sp / cm;
      a[0] += f * cx; a[1] += f * cy; a[2] += f * cz;
    }
  }

  // RK4 step. Acceleration depends on velocity only, so position integrates
  // from the four velocity stages. Spin is held through the step and then
  // decays (time constant R / (2e-5 * speed), Nathan).
  var A1 = [0, 0, 0], A2 = [0, 0, 0], A3 = [0, 0, 0], A4 = [0, 0, 0];
  var V2 = [0, 0, 0], V3 = [0, 0, 0], V4 = [0, 0, 0];
  function step(p, v, w, env, dt, cds) {
    var i;
    accel(v, w, env, A1, cds);
    for (i = 0; i < 3; i++) V2[i] = v[i] + 0.5 * dt * A1[i];
    accel(V2, w, env, A2, cds);
    for (i = 0; i < 3; i++) V3[i] = v[i] + 0.5 * dt * A2[i];
    accel(V3, w, env, A3, cds);
    for (i = 0; i < 3; i++) V4[i] = v[i] + dt * A3[i];
    accel(V4, w, env, A4, cds);
    for (i = 0; i < 3; i++) {
      p[i] += dt / 6 * (v[i] + 2 * V2[i] + 2 * V3[i] + V4[i]);
      v[i] += dt / 6 * (A1[i] + 2 * A2[i] + 2 * A3[i] + A4[i]);
    }
    var decay = Math.exp(-dt * 2e-5 * norm(v) / BALL_R);
    w[0] *= decay; w[1] *= decay; w[2] *= decay;
  }

  // A pitch flies until it crosses the front of the plate.
  var PITCH_DT = 0.0025;
  function flyPitch(p0, v0, w0, env, rec) {
    var p = p0.slice(), v = v0.slice(), w = w0.slice(), t = 0;
    var path = rec ? [[0, p[0], p[1], p[2]]] : null;
    var px = p[0], py = p[1], pz = p[2], pvx = v[0], pvy = v[1], pvz = v[2];
    while (p[1] > Y_PLATE && t < 3) {
      px = p[0]; py = p[1]; pz = p[2]; pvx = v[0]; pvy = v[1]; pvz = v[2];
      step(p, v, w, env, PITCH_DT, 1); t += PITCH_DT;
      if (rec) path.push([t, p[0], p[1], p[2]]);
    }
    var f = (py - Y_PLATE) / (py - p[1]);
    return { x: px + f * (p[0] - px), z: pz + f * (p[2] - pz), t: t - PITCH_DT + f * PITCH_DT,
             v: [pvx + f * (v[0] - pvx), pvy + f * (v[1] - pvy), pvz + f * (v[2] - pvz)],
             w: w.slice(), path: path };
  }

  // A batted ball flies until it lands, or reaches the fence in fair
  // territory ('over' it = a home run, below the top = off the wall).
  var BAT_DT = 0.005;
  function flyBatted(p0, v0, w0, env, rec) {
    var p = p0.slice(), v = v0.slice(), w = w0.slice(), t = 0, apex = p[2];
    var path = rec ? [[0, p[0], p[1], p[2]]] : null;
    var wallZ = env.wallFt * FT, out = null, q = [0, 0, 0], qt = 0;
    while (t < 15) {
      q[0] = p[0]; q[1] = p[1]; q[2] = p[2]; qt = t;
      step(p, v, w, env, BAT_DT, AERO.batCd); t += BAT_DT;
      if (p[2] > apex) apex = p[2];
      if (rec) path.push([t, p[0], p[1], p[2]]);
      var spray = Math.atan2(p[0], p[1]) / DEG, f;
      if (p[1] > 0 && Math.abs(spray) <= 45) {
        var rf = fenceAt(env, spray);
        var r0 = Math.sqrt(q[0] * q[0] + q[1] * q[1]), r1 = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
        if (!out && r0 < rf && r1 >= rf) {
          f = (rf - r0) / (r1 - r0);
          var zc = q[2] + f * (p[2] - q[2]);
          out = { kind: zc > wallZ ? 'over' : 'wall', x: q[0] + f * (p[0] - q[0]), y: q[1] + f * (p[1] - q[1]),
                  z: zc, t: qt + f * BAT_DT, v: v.slice() };
          if (out.kind === 'wall') break;
          // a home run flies on to where it would land at field level
        }
      }
      if (p[2] <= BALL_R) {
        f = (q[2] - BALL_R) / (q[2] - p[2]);
        var land = { x: q[0] + f * (p[0] - q[0]), y: q[1] + f * (p[1] - q[1]), t: qt + f * BAT_DT };
        if (out) { out.land = land; break; }
        out = { kind: 'land', x: land.x, y: land.y, z: BALL_R, t: land.t, v: v.slice(), land: land };
        break;
      }
    }
    if (!out) out = { kind: 'land', x: p[0], y: p[1], z: p[2], t: t, v: v.slice() };
    out.apex = apex; out.path = path; out.w = w.slice();
    return out;
  }

  // ------------------------------------------------------------- pitches
  // Each pitch type's league-typical physics for a pitcher's arm side.
  // `tilt` is the direction the spin pushes the ball as the catcher sees it,
  // degrees from straight up toward the pitcher's ARM side (a four-seamer
  // rides up and runs arm-side; a curveball dives glove-side). `eff` is the
  // fraction of spin that is transverse. `dv` is mph below the fastball.
  // `cmd` scales the pitcher's command (breaking balls are harder to locate);
  // `cost` scales the fatigue load of throwing one.
  // Speeds and spin rates: Baseball Savant pitch-type averages, 2023-25.
  // `eff` and `tilt` were FITTED (headless/physics_check.js) so a typical
  // pitch of each type reproduces Savant's average movement to 0.1 in. For
  // the breaking balls the fitted eff runs well below Savant's published
  // "active spin" (slider 0.12 vs ~0.35): this lift model credits low spin
  // factors generously, and seam-shifted-wake effects are not modelled.
  var PITCH_TYPES = {
    FF: { name: 'four-seam', dv: 0,     rpm: 2290, rpmSD: 130, eff: 0.85, effSD: 0.05, tilt: 25,   tiltSD: 9,  cmd: 1.00, cost: 1.00, kind: 'FB' },
    SI: { name: 'sinker',    dv: -0.9,  rpm: 2160, rpmSD: 130, eff: 0.85, effSD: 0.05, tilt: 63,   tiltSD: 7,  cmd: 1.00, cost: 1.00, kind: 'FB' },
    FC: { name: 'cutter',    dv: -4.8,  rpm: 2400, rpmSD: 150, eff: 0.28, effSD: 0.08, tilt: -11,  tiltSD: 12, cmd: 1.05, cost: 1.00, kind: 'FB' },
    SL: { name: 'slider',    dv: -8.6,  rpm: 2430, rpmSD: 170, eff: 0.12, effSD: 0.05, tilt: -67,  tiltSD: 12, cmd: 1.10, cost: 1.05, kind: 'BR' },
    ST: { name: 'sweeper',   dv: -11.5, rpm: 2600, rpmSD: 170, eff: 0.43, effSD: 0.08, tilt: -87,  tiltSD: 8,  cmd: 1.15, cost: 1.05, kind: 'BR' },
    CU: { name: 'curveball', dv: -14.5, rpm: 2560, rpmSD: 220, eff: 0.34, effSD: 0.08, tilt: -141, tiltSD: 12, cmd: 1.20, cost: 1.05, kind: 'BR' },
    CH: { name: 'changeup',  dv: -8.5,  rpm: 1780, rpmSD: 180, eff: 0.84, effSD: 0.06, tilt: 65,   tiltSD: 8,  cmd: 1.10, cost: 0.90, kind: 'OS' },
    FS: { name: 'splitter',  dv: -7.8,  rpm: 1350, rpmSD: 200, eff: 0.65, effSD: 0.08, tilt: 75,   tiltSD: 10, cmd: 1.20, cost: 1.05, kind: 'OS' }
  };

  // Repertoire archetypes and their usage; `w` is how common each is.
  var ARCH = [
    { name: 'power fastball-slider', w: 0.28, mix: { FF: 0.52, SL: 0.30, CH: 0.12, CU: 0.06 } },
    { name: 'sinker-slider',         w: 0.16, mix: { SI: 0.45, SL: 0.30, CH: 0.15, FF: 0.10 } },
    { name: 'four-pitch',            w: 0.20, mix: { FF: 0.40, SL: 0.20, CU: 0.20, CH: 0.20 } },
    { name: 'cutter',                w: 0.10, mix: { FF: 0.38, FC: 0.30, CU: 0.17, CH: 0.15 } },
    { name: 'sweeper',               w: 0.14, mix: { SI: 0.30, FF: 0.18, ST: 0.37, CH: 0.15 } },
    { name: 'splitter',              w: 0.12, mix: { FF: 0.50, FS: 0.30, SL: 0.20 } }
  ];

  // Spin vector for a pitch leaving along unit direction `dir`. The movement
  // direction m is built from the tilt, made perpendicular to the flight, and
  // the spin axis is s = dir x m, so that the Magnus force (w x v) points
  // along m. The non-transverse share of the spin is gyro spin along dir.
  function spinVector(dir, rpm, tiltDeg, eff, armSide) {
    var t = tiltDeg * DEG;
    var mx = Math.sin(t) * armSide, my = 0, mz = Math.cos(t);
    var d = mx * dir[0] + my * dir[1] + mz * dir[2];
    mx -= d * dir[0]; my -= d * dir[1]; mz -= d * dir[2];
    var mn = Math.sqrt(mx * mx + my * my + mz * mz);
    mx /= mn; my /= mn; mz /= mn;
    var sx = dir[1] * mz - dir[2] * my, sy = dir[2] * mx - dir[0] * mz, sz = dir[0] * my - dir[1] * mx;
    var w = rpm * RPM, e = clamp(eff, 0, 1), g = Math.sqrt(1 - e * e);
    return [w * (e * sx + g * dir[0]), w * (e * sy + g * dir[1]), w * (e * sz + g * dir[2])];
  }
  function dirOf(yaw, pit) { var c = Math.cos(pit); return [Math.sin(yaw) * c, -Math.cos(yaw) * c, Math.sin(pit)]; }

  // Solve for the release direction that puts this pitch on `target` [x, z]
  // at the front of the plate - the pitcher's IDEAL. The pitch's break is
  // nearly independent of the target, so the last solve's correction is
  // cached on the pitch and the next solve starts there.
  function aim(rel, speed, rpm, tilt, eff, armSide, target, env, cache) {
    var dx = target[0] - rel[0], dy = rel[1] - Y_PLATE, dz = target[1] - rel[2];
    var dist = Math.sqrt(dx * dx + dy * dy);
    var yaw0 = Math.atan2(dx, dy), pit0 = Math.atan2(dz, dist);
    var yaw, pit;
    if (cache && cache.ok) { yaw = yaw0 + cache.dy; pit = pit0 + cache.dp; }
    else { yaw = yaw0; pit = pit0 + 0.5 * G * dist / (speed * speed); }
    for (var it = 0; it < 8; it++) {
      var d = dirOf(yaw, pit);
      var hit = flyPitch(rel, [d[0] * speed, d[1] * speed, d[2] * speed], spinVector(d, rpm, tilt, eff, armSide), env, false);
      var ex = target[0] - hit.x, ez = target[1] - hit.z;
      if (ex * ex + ez * ez < 1e-6) break;               // within a millimetre
      yaw += ex / dist; pit += ez / dist;
    }
    if (cache) { cache.ok = true; cache.dy = yaw - yaw0; cache.dp = pit - pit0; }
    return { yaw: yaw, pit: pit, dist: dist };
  }

  // -------------------------------------------------------------- traits
  // THE CALIBRATION KNOBS. Each entry is [mean, sd, lo, hi] of a league
  // distribution; players are draws from these. Changing a mean here is how
  // the league is tuned - never by touching an outcome.
  var TRAITS = {
    // hitters
    // THE POWER CHAIN (v0.7). Bat speed is not drawn, it is built: body (height,
    // weight), the swing power the body delivers per kg (muscle and technique
    // together - they cannot be told apart from bat speed alone), the length of
    // the swing and the bat he chooses set the bat's kinetic energy; the bat's
    // effective mass turns that into speed and sets the collision efficiency.
    // Means and spreads are the 2025 Statcast marginals (STATCAST_TARGETS_2025.md);
    // the correlations weight~bat speed .53, height~bat speed .45, swing
    // length~bat speed .58 are TESTS of the chain, checked by headless/power_chain.js.
    weightLb:   [206, 15.6, 155, 300],   // lb: scatter about the height line (206 + 5.25 per inch over 72; r = .62)
    armIdx:     [1.0, 0.03, 0.9, 1.1],   // arm length over 0.44 x height: limb proportion (reach, plate coverage)
    swingLenFt: [7.32, 0.38, 6.2, 8.6],  // ft: the bat head's path to contact, about the height line (0.047 per inch; r = .27)
    batOz:      [31.8, 0.6, 29, 35],     // oz: the bat he swings (plus 0.6 oz per 50 lb of hitter)
    swingPower: [26, 0.080, 10, 60],     // W/kg at 206 lb, lognormal with this log-sd (fitted: bat speed sd 2.65); falls as weight^POWER_EXP
    motorIn:    [0.62, 0.10, 0.40, 1.0], // in: vertical bat-to-ball scatter AT 72 MPH; grows as bat speed squared (impulse variability)
    batSpeed:   [72.0, 2.65, 62, 82],    // mph - DERIVED from the chain; this entry only scales the display bars
    barrelSD:   [0.62, 0.11, 0.40, 1.1], // in - DERIVED (motorIn x (bat speed/72)^2); display scale only
    attack:    [9, 4, -2, 20],          // deg: upward tilt of the swing path at contact
    undercut:  [0.45, 0.25, -0.3, 1.2], // in: how far below the ball's centre he aims the barrel
    timingSD:  [7.0, 1.2, 4.5, 11],     // ms: scatter of the bat's arrival time
    longSD:    [2.6, 0.4, 1.5, 4.0],    // in: along-the-barrel scatter
    spotIn:    [4.5, 0.8, 2.5, 7.5],    // in: how far a pitch must have left his expected path by the commit point for him to pick it up
    eyeSD:     [5.0, 0.9, 3.0, 7.5],    // in: zone-judgement scatter at the commit point
    aggr:      [0, 0.07, -0.2, 0.2],    // lowers his swing threshold (positive = swings more)
    commit:    [0.55, 0.12, 0.2, 0.9],  // how hard he sits on his guess (0 = pure hedger)
    fbLean:    [1.3, 0.2, 1.0, 1.9],    // how much he leans toward guessing fastball
    pullBias:  [7, 5, -5, 19],          // deg toward his pull side
    learn:     [0.35, 0.1, 0.1, 0.6],   // share of his spotting distance he can learn away in a game
    coverage:  [3.0, 0.6, 1.8, 5.0],    // in off the zone at which his swing errors have doubled (reach)
    heightIn:  [72, 2.35, 66, 80],      // in (2025 Statcast hitters: 72.0 +- 2.35)
    // pitchers when they bat (NL rules) - override the hitter entries above
    pBatSpeed: [63, 4, 54, 72], pTimingSD: [10.5, 1.5, 7, 15], pBarrelSD: [1.7, 0.2, 1.2, 2.3],
    pSpotIn: [6.5, 1.0, 4.5, 9.5], pEyeSD: [3.6, 0.6, 2.4, 5], pAttack: [6, 4, -2, 16],
    // pitchers
    fbVeloSP:  [93.6, 2.0, 88, 100], fbVeloRP: [95.0, 2.0, 89, 102],
    commandSP: [4.0, 0.6, 2.6, 6.5],  commandRP: [4.6, 0.7, 3.0, 7.5],   // in: location scatter per axis at the plate
    staminaSP: [95, 10, 70, 120],    staminaRP: [28, 6, 15, 45],        // pitches before fatigue bites
    relHt:     [5.85, 0.4, 4.8, 6.8], relSide: [1.9, 0.5, 0.8, 3.2], ext: [6.4, 0.35, 5.6, 7.4],   // ft
    pAggr:     [0, 0.08, -0.2, 0.2],  // shifts his intent from expanding toward attacking
    // umpires
    umpSD:     [1.4, 0.25, 0.9, 2.2], // in: the soft edge of his zone (his accuracy)
    umpEdge:   [0, 0.45, -1.2, 1.2],  // in: systematic miss per edge (positive = calls that edge wide)
    umpQuirk:  [1.4, 0.4, 0.6, 2.4],  // in: the size of one strong habit, for umpires who have one
    umpCount:  [0.5, 0.25, 0, 1.2],   // in: zone swell when the pitcher is behind, shrink when ahead
    // catchers
    framing:   [0, 0.35, -0.8, 0.8],  // in: how much he widens the edges
    // fielding and running (Statcast-shaped; position means in FIELD_MEANS)
    speed:     [27.0, 1.2, 22, 31],   // ft/s sprint speed
    react:     [0.70, 0.10, 0.35, 1.10],   // s: his jump - reading the ball and taking the first step
    route:     [0.90, 0.04, 0.75, 1.0],    // straight-line share of the path he actually runs
    glove:     [0.982, 0.008, 0.94, 0.999],// clean-play rate on a routine chance
    armMph:    [85, 3.5, 70, 100],    // throw speed
    armAcc:    [0.6, 0.15, 0.25, 1.3],// m: throw scatter at 40 m
    transfer:  [0.68, 0.08, 0.45, 1.0],    // s: glove to release
    runAggr:   [0, 0.15, -0.4, 0.4],  // s: shifts the margin he demands before taking a base (negative = bolder)
    // the running game (Statcast-shaped)
    jump:      [0.22, 0.08, 0.05, 0.5],    // s: a runner's break on the pitcher's first move
    holdTime:  [1.35, 0.10, 1.05, 1.7],    // s: a pitcher's first move to the mitt with a man on
    popTime:   [1.95, 0.08, 1.7, 2.3],     // s: a catcher's mitt to the glove at second base
    block:     [0.75, 0.10, 0.4, 0.98]     // share of balls in the dirt a catcher keeps in front of him
  };
  // Where a position sits relative to the league on speed, arm and first step.
  // Infielders read a ball off the bat a quarter-second sooner than an
  // outfielder judging a fly: it is close, low and on them at once.
  var FIELD_MEANS = {
    C:  { speed: -1.5, armMph: -5, react: -0.15, transfer: 0.02 }, '1B': { speed: -1.0, armMph: -5, react: -0.25 },
    '2B': { speed: 0.3, armMph: -3, react: -0.25 }, SS: { speed: 0.8, armMph: 1, react: -0.25 }, '3B': { speed: -0.2, armMph: 1, react: -0.25 },
    LF: { speed: 0.2, armMph: 1 }, CF: { speed: 1.3, armMph: 2 }, RF: { speed: 0.2, armMph: 4 },
    DH: { speed: -0.5, armMph: -3 }, P: { speed: -1.5, armMph: -3, react: -0.1, glove: -0.02 }
  };
  function drawField(rng, key, pos, T) {
    var t = TRAITS[key], m = FIELD_MEANS[pos] || {}, off = m[key] || 0;
    return clamp(rng.n(t[0] + off, t[1]), t[2], t[3]);
  }
  function equipFielder(rng, o, pos) {
    o.pos = pos;
    ['speed', 'react', 'route', 'glove', 'armMph', 'armAcc', 'transfer', 'runAggr', 'jump'].forEach(function (k) { o[k] = drawField(rng, k, pos); });
    if (pos === 'C') { o.popTime = drawField(rng, 'popTime', pos); o.block = drawField(rng, 'block', pos); }
    return o;
  }
  function drawT(rng, t) { return clamp(rng.n(t[0], t[1]), t[2], t[3]); }

  // ------------------------------------------------------ the power chain
  // The bat: effective mass at the sweet spot (Nathan: I_pivot / r^2, about
  // 0.72 of a wood bat's mass) and the collision efficiency that follows from
  // it with the ball-bat COR at game speed: a 31.8 oz bat gives q = 0.21.
  var BAT_EFF = 0.72, E_COR = 0.48;
  function batOf(oz, lenIn) {
    var m = oz * 0.02835, mEff = BAT_EFF * m;
    return { oz: oz, lenIn: lenIn, m: m, mEff: mEff, q: (E_COR * mEff - BALL_M) / (mEff + BALL_M) };
  }
  // Bat speed from the chain. The bat's kinetic energy 1/2 mEff v^2 is the
  // swing power (W/kg) x body mass x swing time, and the swing time is 2L/v
  // (from rest over the arc L), so v^3 = 4 p W L / mEff. At the means: 337 J
  // delivered in 0.139 s (2.4 kW) - the measured shape of a major-league swing.
  function batSpeedOf(powerKg, weightLb, swingLenFt, bat) {
    return Math.cbrt(4 * powerKg * weightLb * 0.4536 * swingLenFt * FT / bat.mEff) / MPH;
  }
  // Swing power per kg against body weight: the big men make more power, but
  // less per kilogram. The exponent is FITTED so that, through v^3 ∝ p W L, the
  // drawn league reproduces weight~bat speed r = .53 (headless/power_chain.js):
  // -0.45, a little steeper than the isometric -1/3. (-0.6, read off a proxy
  // that had weight in its own denominator, gave only .37.)
  var POWER_EXP = -0.45;
  function swingPowerOf(rng, weightLb) { var t = TRAITS.swingPower; return clamp(t[0] * Math.pow(weightLb / 206, POWER_EXP) * Math.exp(rng.n(0, t[1])), t[2], t[3]); }

  var nextId = 1;

  function makePitcher(rng, o) {
    o = o || {};
    var T = TRAITS, role = o.role || 'SP';
    var throws = o.throws || (rng.u() < 0.28 ? 'L' : 'R');
    var armSide = throws === 'R' ? -1 : 1;
    var arch = ARCH[rng.pickW(ARCH.map(function (a) { return a.w; }))];
    var fb = drawT(rng, role === 'SP' ? T.fbVeloSP : T.fbVeloRP);
    var types = Object.keys(arch.mix).sort(function (a, b) { return arch.mix[b] - arch.mix[a]; });
    if (role === 'RP') types = types.slice(0, rng.u() < 0.6 ? 2 : 3);   // relievers carry their best two or three
    var pitches = types.map(function (k) {
      var d = PITCH_TYPES[k];
      return { type: k,
               velo: fb + d.dv + (d.dv === 0 ? 0 : rng.n(0, 1.0)),
               rpm: clamp(rng.n(d.rpm, d.rpmSD), d.rpm - 3 * d.rpmSD, d.rpm + 3 * d.rpmSD),
               eff: clamp(rng.n(d.eff, d.effSD), 0.03, 0.99),
               tilt: rng.n(d.tilt, d.tiltSD),
               usage: arch.mix[k] * Math.exp(rng.n(0, 0.25)),
               cmd: d.cmd, aimCache: { ok: false } };
    });
    var u = normalize(pitches.map(function (p) { return p.usage; }));
    pitches.forEach(function (p, i) { p.usage = u[i]; });
    return equipFielder(rng, {
      id: nextId++, name: o.name || '', role: role, throws: throws, armSide: armSide, arch: arch.name,
      rel: { ht: drawT(rng, T.relHt), side: drawT(rng, T.relSide), ext: drawT(rng, T.ext) },
      command: drawT(rng, role === 'SP' ? T.commandSP : T.commandRP),
      stamina: drawT(rng, role === 'SP' ? T.staminaSP : T.staminaRP),
      holdTime: drawT(rng, T.holdTime),
      aggr: drawT(rng, T.pAggr),
      pitches: pitches, load: 0
    }, 'P');
  }

  function makeBatter(rng, o) {
    o = o || {};
    var T = TRAITS, pb = !!o.pitcher;
    var r = rng.u();
    var bats = o.bats || (pb ? (r < 0.72 ? 'R' : r < 0.95 ? 'L' : 'S') : (r < 0.55 ? 'R' : r < 0.90 ? 'L' : 'S'));
    var h = drawT(rng, T.heightIn);
    // the power chain: body -> swing power, swing length, bat -> bat speed, collision efficiency, precision
    var w = clamp(T.weightLb[0] + 5.25 * (h - 72) + rng.n(0, T.weightLb[1]), T.weightLb[2], T.weightLb[3]);
    var armIdx = drawT(rng, T.armIdx);
    var swingLen = clamp(T.swingLenFt[0] + 0.047 * (h - 72) + rng.n(0, T.swingLenFt[1]), T.swingLenFt[2], T.swingLenFt[3]);
    var bat = batOf(clamp(T.batOz[0] + 0.012 * (w - 206) + rng.n(0, T.batOz[1]), T.batOz[2], T.batOz[3]), 34);
    var power = swingPowerOf(rng, w);
    var batSpeed = pb ? drawT(rng, T.pBatSpeed) : batSpeedOf(power, w, swingLen, bat);   // pitchers at the plate keep their own weak draw
    var motor = drawT(rng, pb ? T.pBarrelSD : T.motorIn);
    var b = {
      id: nextId++, name: o.name || '', bats: bats, heightIn: h, isPitcher: pb,
      weightLb: w, armIdx: armIdx, swingLenFt: swingLen, bat: bat, swingPower: power, motorIn: motor,
      batSpeed: batSpeed,
      attack:   drawT(rng, pb ? T.pAttack : T.attack),
      undercut: drawT(rng, T.undercut),
      timingSD: drawT(rng, pb ? T.pTimingSD : T.timingSD),
      barrelSD: pb ? motor : motor * Math.pow(batSpeed / 72, 2),   // a harder swing is a less precise one (impulse variability: error ∝ force ∝ v^2)
      longSD:   drawT(rng, T.longSD),
      spotIn:   drawT(rng, pb ? T.pSpotIn : T.spotIn),
      eyeSD:    drawT(rng, pb ? T.pEyeSD : T.eyeSD),
      aggr:     drawT(rng, T.aggr),
      commit:   drawT(rng, T.commit),
      fbLean:   drawT(rng, T.fbLean),
      pullBias: drawT(rng, T.pullBias),
      learn:    drawT(rng, T.learn),
      coverage: drawT(rng, T.coverage) * armIdx,   // longer arms cover more plate
      // rulebook zone from height: bottom at the hollow of the knee, top
      // midway between belt and shoulders (Statcast averages 1.6 / 3.4 ft)
      zone: { bot: 0.263 * h * IN, top: 0.559 * h * IN }
    };
    if (o.pos === 'C') b.framing = drawT(rng, T.framing);
    return equipFielder(rng, b, o.pos || 'DH');
  }

  // An umpire: his accuracy (the soft edge), a small systematic miss on every
  // edge, and - for about a third of umpires - one strong habit on one edge
  // (the umpire who never gives the inside corner, or always gives the
  // low strike). Edges are named from the BATTER's side of the plate.
  function makeUmp(rng, o) {
    o = o || {};
    var T = TRAITS;
    var e = { inside: drawT(rng, T.umpEdge), outside: drawT(rng, T.umpEdge), high: drawT(rng, T.umpEdge), low: drawT(rng, T.umpEdge) };
    var quirk = null;
    if (rng.u() < 0.33) {
      var names = ['inside', 'outside', 'high', 'low'], k = names[Math.floor(rng.u() * 4)];
      var sgn = rng.u() < 0.5 ? -1 : 1;
      e[k] += sgn * drawT(rng, T.umpQuirk);
      quirk = { edge: k, dir: sgn > 0 ? 'wide' : 'tight' };
    }
    return { id: nextId++, name: o.name || '', sd: drawT(rng, T.umpSD), edge: e, quirk: quirk, countK: drawT(rng, T.umpCount) };
  }

  function batterSide(B, P) {           // -1 stands on the -x (third-base) side = right-handed
    if (B.bats === 'R') return -1;
    if (B.bats === 'L') return 1;
    return -P.armSide;                  // a switch hitter bats opposite the pitcher's hand
  }
  function inZone(B, x, z) {
    return Math.abs(x) <= ZONE_HALF && z >= B.zone.bot - BALL_R && z <= B.zone.top + BALL_R;
  }

  // --------------------------------------------------------------- PLAN
  // How a pitcher approaches each count: probabilities of ATTACK (in the
  // zone with margin), EDGE (on the corner), EXPAND (off the plate to get a
  // chase). These are behavioural norms of the league, shifted per pitcher
  // by his aggression trait.
  var INTENTS = ['attack', 'edge', 'expand'];
  var INTENT = {
    '0-0': [0.25, 0.65, 0.10], '1-0': [0.40, 0.55, 0.05], '2-0': [0.65, 0.35, 0.00], '3-0': [0.90, 0.10, 0.00],
    '0-1': [0.15, 0.60, 0.25], '1-1': [0.25, 0.60, 0.15], '2-1': [0.45, 0.50, 0.05], '3-1': [0.70, 0.30, 0.00],
    '0-2': [0.05, 0.35, 0.60], '1-2': [0.05, 0.45, 0.50], '2-2': [0.10, 0.60, 0.30], '3-2': [0.35, 0.60, 0.05]
  };
  function intentProbs(P, balls, strikes) {
    var t = INTENT[balls + '-' + strikes].slice();
    t[0] = Math.max(0, t[0] + P.aggr); t[2] = Math.max(0, t[2] - P.aggr);
    return normalize(t);
  }

  // Weight on each of the pitcher's pitches, before sampling. `last` is the
  // pitch types he just threw to this batter (null when a batter is
  // modelling him: a scouting report knows his count and platoon habits,
  // not his next sequence). Returns weights plus the reasons that moved them.
  function typeWeights(P, sb, intent, last) {
    var same = sb === P.armSide;        // right-on-right or left-on-left
    return P.pitches.map(function (pt) {
      var k = PITCH_TYPES[pt.type].kind, t = pt.type, m = pt.usage;
      if (intent === 'attack') m *= k === 'FB' ? 1.6 : 0.7;
      else if (intent === 'expand') m *= k === 'FB' ? (t === 'FF' ? 0.9 : 0.6) : 1.5;
      if (same) { if (k === 'BR' || t === 'FC') m *= 1.3; else if (k === 'OS') m *= 0.55; }
      else { if (k === 'OS') m *= 1.45; else if (t === 'ST') m *= 0.6; else if (t === 'SL') m *= 0.85; }
      if (last && last[0] === t) m *= last[1] === t ? 0.42 : 0.7;   // a third straight one is rare
      return m;
    });
  }

  // Where each pitch type is aimed, by intent. Margins are metres inside
  // (positive) or outside (negative) the plate edge / zone edge.
  function targetFor(P, B, sb, type, intent, rng) {
    var a = P.armSide, glove = -a;
    var mH = intent === 'attack' ? 0.07 + 0.004 * (P.command - 7) : intent === 'edge' ? 0.015 : -0.07;
    var mV = intent === 'attack' ? 0.08 : intent === 'edge' ? 0.02 : -0.075;
    var side, vert;
    switch (type) {
      case 'FF': side = rng.u() < 0.5 ? glove : a; vert = 'high'; break;
      case 'SI': side = a; vert = 'low'; break;
      case 'FC': side = glove; vert = 'mid'; break;
      case 'SL': case 'ST': side = glove; vert = 'low'; break;
      case 'CU': side = 0; vert = 'low'; break;
      default:   side = a; vert = 'low';                     // CH, FS
    }
    var x = side === 0 ? 0 : side * (PLATE_HALF - mH);
    if (intent === 'attack' && PITCH_TYPES[type].kind === 'FB') x *= 0.5;   // a get-me-over fastball
    var z = vert === 'low' ? B.zone.bot + mV : vert === 'high' ? B.zone.top - mV : B.zone.bot + 0.45 * (B.zone.top - B.zone.bot);
    return [x + rng.n(0, 0.02), z + rng.n(0, 0.02)];
  }

  function planPitch(P, B, sb, st, rng) {
    var ip = intentProbs(P, st.balls, st.strikes);
    var intent = INTENTS[rng.pickW(ip)];
    var w = typeWeights(P, sb, intent, st.last);
    var i = rng.pickW(w);
    var type = P.pitches[i].type;
    var why = [st.balls + '-' + st.strikes + ': ' + intent];
    if (sb === P.armSide) why.push('same-side hitter'); else why.push('opposite-side hitter');
    if (st.last.length && st.last[0] === type) why.push('repeats the ' + PITCH_TYPES[type].name);
    else if (st.last.length) why.push('off the ' + PITCH_TYPES[st.last[0]].name);
    return { intent: intent, intentP: ip, probs: normalize(w), pick: i, type: type,
             target: targetFor(P, B, sb, type, intent, rng), why: why };
  }

  // -------------------------------------------------------------- EXPECT
  // The batter's scouting-report picture of what comes next: the pitcher's
  // mix in this count to this side, averaged over his intents. He sits on
  // the likeliest pitch, leaning to fastballs (being beaten by a fastball
  // costs more than being fooled by a slow one), and blends his timing
  // toward the mix by how much he hedges. With two strikes he hedges more.
  var SWING_THR = { '0-0': 0.55, '0-1': 0.50, '0-2': 0.30, '1-0': 0.55, '1-1': 0.48, '1-2': 0.30,
                    '2-0': 0.60, '2-1': 0.50, '2-2': 0.32, '3-0': 0.92, '3-1': 0.58, '3-2': 0.33 };
  function expectPitch(B, P, sb, st) {
    var ip = intentProbs(P, st.balls, st.strikes), mix = P.pitches.map(function () { return 0; });
    for (var k = 0; k < 3; k++) {
      var w = normalize(typeWeights(P, sb, INTENTS[k], null));
      for (var i = 0; i < mix.length; i++) mix[i] += ip[k] * w[i];
    }
    var g = 0, best = -1;
    mix.forEach(function (p, i) {
      var s = p * (PITCH_TYPES[P.pitches[i].type].kind === 'FB' ? B.fbLean : 1);
      if (s > best) { best = s; g = i; }
    });
    var protect = st.strikes === 2;
    var commit = B.commit * (protect ? 0.6 : 1);
    var blend = mix.map(function (p, i) { return (1 - commit) * p + (i === g ? commit : 0); });
    var velo = 0;
    blend.forEach(function (p, i) { velo += p * P.pitches[i].velo; });
    var approach = protect ? 'protect' : st.balls === 3 && st.strikes === 0 ? 'take' : st.balls - st.strikes >= 2 ? 'hunt' : 'normal';
    return { mix: mix, guess: g, guessType: P.pitches[g].type, commit: commit, blend: blend, velo: velo, approach: approach };
  }

  // --------------------------------------------------------------- THROW
  // Fatigue: nothing until 70% of his stamina, then it climbs as a square.
  // At his stamina he has lost ~1.3 mph and ~27% of his command; at 1.15x
  // stamina, 3 mph and 60%.
  function fatigueOf(P) {
    var s = P.stamina, x = (P.load - 0.7 * s) / (0.45 * s);
    return x <= 0 ? 0 : Math.min(1.5, x * x);
  }
  function releasePoint(P) { return [P.armSide * P.rel.side * FT, RUBBER_Y - P.rel.ext * FT, P.rel.ht * FT]; }

  function throwPitch(P, plan, env, rng) {
    var pt = P.pitches[plan.pick], f = fatigueOf(P);
    var velo = pt.velo - 3.0 * f, rpm = pt.rpm * (1 - 0.05 * f);
    var rel = releasePoint(P);
    var ideal = aim(rel, velo * MPH, rpm, pt.tilt, pt.eff, P.armSide, plan.target, env, pt.aimCache);
    var cmdIn = P.command * pt.cmd * (1 + 0.6 * f);
    var sa = cmdIn * IN / ideal.dist;                                   // command as an angle
    var yaw = ideal.yaw + rng.n(0, sa), pit = ideal.pit + rng.n(0, sa);
    var relA = [rel[0] + rng.n(0, 0.02), rel[1] + rng.n(0, 0.02), rel[2] + rng.n(0, 0.02)];
    var vA = (velo + rng.n(0, 0.6)) * MPH, rpmA = rpm * (1 + rng.n(0, 0.025));
    var tiltA = pt.tilt + rng.n(0, 5), effA = clamp(pt.eff + rng.n(0, 0.03), 0.05, 1);
    var d = dirOf(yaw, pit), v0 = [d[0] * vA, d[1] * vA, d[2] * vA];
    var w0 = spinVector(d, rpmA, tiltA, effA, P.armSide);
    var fl = flyPitch(relA, v0, w0, env, false);
    return { type: pt.type, rel: relA, v0: v0, w0: w0, mph: vA / MPH, rpm: rpmA, tilt: tiltA, eff: effA,
             fatigue: f, cmdIn: cmdIn, plate: { x: fl.x, z: fl.z, t: fl.t, v: fl.v, w: fl.w } };
  }

  // ---------------------------------------------------------------- READ
  function ghostPitch(pitch, ex, P, env, rec) {       // rec: keep the path, for drawing
    var d = unit(pitch.v0), w = [0, 0, 0];
    ex.blend.forEach(function (b, i) {
      if (b < 1e-3) return;
      var q = P.pitches[i], wi = spinVector(d, q.rpm, q.tilt, q.eff, P.armSide);
      w[0] += b * wi[0]; w[1] += b * wi[1]; w[2] += b * wi[2];
    });
    var v = ex.velo * MPH;
    var fl = flyPitch(pitch.rel, [d[0] * v, d[1] * v, d[2] * v], w, env, !!rec);
    return { x: fl.x, z: fl.z, t: fl.t, path: fl.path };
  }
  // RECOGNITION IS A YES/NO EVENT. Either he picks the pitch up before he
  // commits (COMMIT_S before it reaches the plate - about 24 ft out, where
  // Baseball Prospectus measures pitch tunnels) or he is fooled:
  //   picked up:  he re-reads it as what it is; DETECT_RESID of the
  //               ghost-vs-real difference is left over
  //   fooled:     he swings at the pitch he expected; all he has corrected
  //               is the break he could SEE by the commit point, which grows
  //               as time squared - so the residual is 1 - (t_commit/t_flight)^2
  //               (~0.68 on a fastball, ~0.60 on a curveball)
  // TUNNELLING: the chance he is fooled falls with how far the real pitch
  // has already separated from the expected one at the commit point,
  //   pFooled = exp(-separation / spot)
  // `spot` is his trait (spotIn): the separation he needs to see, smaller =
  // better. It grows with time pressure (tp = 1 for a 94-mph fastball; a
  // faster pitch leaves less time to look) and shrinks with the pitches he
  // has seen from this pitcher today (`seen`, which a game weights to
  // include his dugout's view) - the mechanism the times-through-the-order
  // penalty should emerge from. A curveball that leaves the hand going up
  // has separated a long way by the commit point and is rarely missed; a
  // changeup that shares the fastball's tunnel is the one that fools him.
  // When he guessed right the separation is tiny, and so is the damage.
  // (v0.2 used a proportional misread, then a saturating one; both spread
  // contact evenly across the bat face and flattened the launch angles.)
  var COMMIT_S = 0.175, DETECT_RESID = 0.05;
  function readFactors(B, pitch, gh, seen, rng) {
    var T = pitch.plate.t, tp = 0.26 / Math.max(0.12, T - 0.15);
    var tc = Math.max(0, T - COMMIT_S) / T;
    var dx = gh.x - pitch.plate.x, dz = gh.z - pitch.plate.z;
    var sep = Math.sqrt(dx * dx + dz * dz) * tc * tc;
    var spot = B.spotIn * IN * tp * (1 - B.learn * (1 - Math.exp(-(seen || 0) / 40)));
    var pFooled = Math.exp(-sep / spot);
    var detected = rng.u() >= pFooled;
    return { tp: tp, sep: sep, pFooled: pFooled, detected: detected, resid: detected ? DETECT_RESID : 1 - tc * tc };
  }
  function misreadOf(rf, pitch, gh) {       // [x m, z m, t s]: where he is wrong, signed ghost - real
    return [rf.resid * (gh.x - pitch.plate.x), rf.resid * (gh.z - pitch.plate.z), rf.resid * (gh.t - pitch.plate.t)];
  }

  // -------------------------------------------------------------- DECIDE
  // His decision uses his perception at the commit point (eyeSD, earlier and
  // noisier); the swing is then steered by later tracking (barrelSD).
  function decide(B, pitch, gh, rf, st, rng) {
    var m = misreadOf(rf, pitch, gh), mx = m[0], mz = m[1];
    var eye = B.eyeSD * IN * rf.tp;
    var xp = pitch.plate.x + mx + rng.n(0, eye), zp = pitch.plate.z + mz + rng.n(0, eye);
    var pin = Phi((ZONE_HALF - Math.abs(xp)) / eye) * Phi((zp - (B.zone.bot - BALL_R)) / eye) * Phi((B.zone.top + BALL_R - zp) / eye);
    var dx = gh.x - pitch.plate.x, dz = gh.z - pitch.plate.z;
    var onIt = Math.sqrt(dx * dx + dz * dz) < 0.08 && Math.abs(gh.t - pitch.plate.t) < 0.012;
    var thr = SWING_THR[st.balls + '-' + st.strikes] - B.aggr - (onIt ? 0.06 : 0);
    return { swing: pin > thr, pin: pin, thr: thr, onIt: onIt, perceived: [xp, zp], misread: [mx, mz] };
  }

  // ---------------------------------------------------------------- CALL
  function signedMargin(a, b, c, e) {          // inside all four edges: distance to the nearest
    var m = Math.min(a, b, c, e);
    if (m >= 0) return m;
    var ox = Math.min(0, a, b), oz = Math.min(0, c, e);
    return -Math.sqrt(ox * ox + oz * oz);
  }
  function callPitch(U, framing, B, sb, x, z, balls, strikes, rng) {
    var xin = x * sb;                          // positive toward the batter
    var dIn = ZONE_HALF + U.edge.inside * IN - xin;
    var dOut = ZONE_HALF + U.edge.outside * IN + xin;
    var dLow = z - (B.zone.bot - BALL_R - U.edge.low * IN);
    var dHigh = (B.zone.top + BALL_R + U.edge.high * IN) - z;
    var swell = (U.countK * (balls - strikes) / 3 + (framing || 0)) * IN;
    var d = signedMargin(dIn, dOut, dLow, dHigh) + swell;
    var p = Phi(d / (U.sd * IN));
    return { strike: rng.u() < p, p: p, d: d };
  }

  // --------------------------------------------------------------- SWING
  // A swing is built for the strike zone. A pitch off the plate makes him
  // REACH, and every execution error grows with the reach: doubled at
  // `coverage` inches outside the zone (a bad-ball hitter has a big one).
  function reachOf(B, x, z) {
    var ox = Math.max(0, Math.abs(x) - ZONE_HALF);
    var oz = Math.max(0, B.zone.bot - BALL_R - z, z - B.zone.top - BALL_R);
    return Math.sqrt(ox * ox + oz * oz);
  }
  function swing(B, pitch, gh, rf, sb, st, rng) {
    var reach = reachOf(B, pitch.plate.x, pitch.plate.z);
    var prot = (st.strikes === 2 ? 0.85 : 1)   // a shorter two-strike swing: less scatter, less speed
             * (1 + reach / (B.coverage * IN));
    var m = misreadOf(rf, pitch, gh);
    var e = -m[2] + rng.n(0, B.timingSD / 1000 * prot * rf.tp);    // + = bat early (he expected it sooner)
    var D = -m[1] + B.undercut * IN + rng.n(0, B.barrelSD * IN * prot);   // + = ball above the barrel
    var xAim = pitch.plate.x + m[0];
    var dLong = (pitch.plate.x - xAim) * (-sb) + rng.n(0, B.longSD * IN * prot);   // + toward the tip
    var batMph = B.batSpeed * (st.strikes === 2 ? 0.96 : 1);
    var omega = batMph * MPH / SWING_RADIUS;
    var theta = sb * (omega * e + C_LOC * pitch.plate.x * sb + B.pullBias * DEG);
    var sw = { e: e, D: D, dLong: dLong, theta: theta, batMph: batMph, attack: B.attack + rng.n(0, 3), reach: reach, contact: false, why: '',
               qSweet: B.bat ? B.bat.q : Q_SWEET };   // his bat's collision efficiency
    if (Math.abs(D) >= R_SUM) { sw.why = D > 0 ? 'under' : 'over'; return sw; }
    if (dLong > TIP_IN * IN) { sw.why = 'off the end'; return sw; }
    if (dLong < HANDLE_IN * IN) { sw.why = 'inside the hands'; return sw; }
    if (Math.abs(theta) > 80 * DEG) { sw.why = e > 0 ? 'way early' : 'way late'; return sw; }
    sw.contact = true;
    return sw;
  }

  // The collision, in the frame of the bat's contact point. n is the line
  // of centres (tilted by the vertical offset D); the ball's approach along
  // n reverses with collision efficiency q; friction brings the contact
  // point toward rolling on the bat (sphere, I = 0.4 m R^2), capped by
  // Coulomb friction. Backspin, topspin and hook/slice all come out of the
  // same impulse - including what the pitch's own spin contributes.
  function qOf(dLong, qSweet) {   // falls off along the barrel from the sweet-spot value (his bat's, or the wood default)
    var d = dLong / IN, L = d >= 0 ? 5.5 : 10;
    return Math.max(0, (qSweet || Q_SWEET) * (1 - (d / L) * (d / L)));
  }
  function collide(pitch, sw) {
    var al = sw.attack * DEG, th = sw.theta;
    var p = [Math.sin(th) * Math.cos(al), Math.cos(th) * Math.cos(al), Math.sin(al)];   // bat path
    var ax = [Math.cos(th), -Math.sin(th), 0];                                          // bat axis (level)
    var q = cross(p, ax);
    if (q[2] < 0) q = [-q[0], -q[1], -q[2]];
    var s = sw.D / R_SUM, c = Math.sqrt(1 - s * s);
    var n = [c * p[0] + s * q[0], c * p[1] + s * q[1], c * p[2] + s * q[2]];
    var vb = sw.batMph * MPH * (1 + sw.dLong / (30 * IN));
    var V = [p[0] * vb, p[1] * vb, p[2] * vb];
    var qe = qOf(sw.dLong, sw.qSweet);
    var vin = pitch.plate.v, win = pitch.plate.w;
    var u = [vin[0] - V[0], vin[1] - V[1], vin[2] - V[2]];
    var un = dot(u, n);
    if (un >= 0) return null;                  // the bat never closes on the ball
    var dvn = -(1 + qe) * un;
    var rc = [-BALL_R * n[0], -BALL_R * n[1], -BALL_R * n[2]];
    var wr = cross(win, rc);
    var slip = [u[0] + wr[0], u[1] + wr[1], u[2] + wr[2]];
    var sn = dot(slip, n);
    var J = [-2 / 7 * (slip[0] - sn * n[0]), -2 / 7 * (slip[1] - sn * n[1]), -2 / 7 * (slip[2] - sn * n[2])];
    var jm = norm(J), jmax = MU_BAT * dvn;
    if (jm > jmax) { J[0] *= jmax / jm; J[1] *= jmax / jm; J[2] *= jmax / jm; }
    var dw = cross(rc, J), I = 0.4 * BALL_R * BALL_R;
    return { v: [vin[0] + dvn * n[0] + J[0], vin[1] + dvn * n[1] + J[1], vin[2] + dvn * n[2] + J[2]],
             w: [win[0] + dw[0] / I, win[1] + dw[1] / I, win[2] + dw[2] / I], q: qe };
  }

  // ----------------------------------------------------------------- FLY
  function battedBall(pitch, col, env, rec) {
    var p0 = [pitch.plate.x, CONTACT_Y, pitch.plate.z], v = col.v, sp = norm(v);
    var fl = flyBatted(p0, v, col.w, env, rec);
    var vh = unit([v[0], v[1], 0]), side = cross(vh, [0, 0, 1]);
    var back = dot(col.w, side) / RPM;         // + = backspin
    var r = Math.sqrt(fl.x * fl.x + fl.y * fl.y);
    var L = fl.land || fl, proj = Math.sqrt(L.x * L.x + L.y * L.y);
    var landSpray = Math.atan2(fl.x, fl.y) / DEG;
    var fair;
    if (fl.kind === 'over' || fl.kind === 'wall') fair = true;
    else if (fl.y <= 0) fair = false;          // behind the plate
    else if (r < BASE_FT * FT) {               // short of the bags: it rolls - judge by its direction
      fair = Math.abs(Math.atan2(fl.v[0], fl.v[1]) / DEG) <= 45 && Math.abs(landSpray) <= 60;
    } else fair = Math.abs(landSpray) <= 45;
    return { ev: sp / MPH, la: Math.asin(v[2] / sp) / DEG, spray: Math.atan2(v[0], v[1]) / DEG,
             spin: norm(col.w) / RPM, backspin: back, q: col.q,
             kind: fl.kind, fair: fair, hr: fl.kind === 'over',
             landing: [fl.x, fl.y], landZ: fl.z, landV: fl.v, landT: fl.t,
             dist: r / FT, projDist: proj / FT, hang: fl.t, apex: fl.apex / FT, path: fl.path };
  }

  // --------------------------------------------------- one plate appearance
  // g = { env, ump, framing, seen (pitches of this pitcher already read), runnersOn, rec,
  //       foulCatch (optional: bb -> true when the defence catches a foul pop),
  //       beforePitch (optional: st -> anything the running game wants noted on the pitch),
  //       afterPitch (optional: (rec, end) -> {abort:true} when the bases ended the
  //                   inning mid-count; `end` names how this pitch ends the PA, or null) }
  // A PA ended from the bases returns result 'END': no plate appearance is charged.
  function simPA(P, B, g, rng) {
    var sb = batterSide(B, P);
    var st = { balls: 0, strikes: 0, last: [] };
    var log = [], seen = g.seen || 0;
    for (;;) {
      var before = g.beforePitch ? g.beforePitch(st) : null;
      var plan = planPitch(P, B, sb, st, rng);
      var ex = expectPitch(B, P, sb, st);
      var pitch = throwPitch(P, plan, g.env, rng);
      var gh = ghostPitch(pitch, ex, P, g.env);
      var rf = readFactors(B, pitch, gh, seen, rng);
      var rec = { count: st.balls + '-' + st.strikes, plan: plan, expect: ex, pitch: pitch, ghost: gh, read: rf,
                  inZone: inZone(B, pitch.plate.x, pitch.plate.z), side: sb };
      var res, xs = pitch.plate.x * sb, z = pitch.plate.z;
      if (xs > HBP_X && z > 0.25 && z < 1.75 && rng.u() < 0.65) res = 'hbp';
      else {
        var dec = decide(B, pitch, gh, rf, st, rng);
        rec.decide = dec;
        if (!dec.swing) {
          var call = callPitch(g.ump, g.framing, B, sb, pitch.plate.x, pitch.plate.z, st.balls, st.strikes, rng);
          rec.call = call;
          res = call.strike ? 'called_strike' : 'ball';
        } else {
          var sw = swing(B, pitch, gh, rf, sb, st, rng);
          rec.swing = sw;
          var col = sw.contact ? collide(pitch, sw) : null;
          if (sw.contact && !col) { sw.contact = false; sw.why = 'no catch-up'; }
          if (!col) res = 'swinging_strike';
          else {
            var bb = battedBall(pitch, col, g.env, g.rec);
            rec.bb = bb;
            res = bb.hr ? 'hr' : bb.fair ? 'in_play' : 'foul';
          }
        }
      }
      rec.result = res;
      if (before) rec.before = before;
      log.push(rec);
      P.load += PITCH_TYPES[pitch.type].cost * (g.runnersOn ? 1.1 : 1);
      seen += 1;
      st.last.unshift(pitch.type);
      if (st.last.length > 2) st.last.length = 2;

      // how this pitch ends the plate appearance, if it does
      var caughtFoul = res === 'foul' && g.foulCatch && g.foulCatch(rec.bb);
      var end = res === 'hbp' ? 'HBP' : res === 'hr' ? 'HR' : (res === 'in_play' || caughtFoul) ? 'BIP'
              : res === 'ball' ? (st.balls === 3 ? 'BB' : null) : res === 'foul' ? null : (st.strikes === 2 ? 'K' : null);
      if (g.afterPitch) { var ap = g.afterPitch(rec, end); if (ap && ap.abort) return { result: 'END', pitches: log }; }
      if (end === 'HBP') return { result: 'HBP', pitches: log };
      if (caughtFoul) return { result: 'BIP', pitches: log, bb: rec.bb, foulCaught: true };
      if (end === 'HR') return { result: 'HR', pitches: log, bb: rec.bb };
      if (end === 'BIP') return { result: 'BIP', pitches: log, bb: rec.bb };
      if (res === 'ball') { if (++st.balls === 4) return { result: 'BB', pitches: log }; }
      else if (res === 'foul') { if (st.strikes < 2) st.strikes++; }
      else if (++st.strikes === 3) return { result: 'K', pitches: log };
    }
  }

  return {
    version: '0.5',
    units: { MPH: MPH, FT: FT, IN: IN, RPM: RPM, DEG: DEG },
    geometry: { Y_PLATE: Y_PLATE, PLATE_HALF: PLATE_HALF, ZONE_HALF: ZONE_HALF, RUBBER_Y: RUBBER_Y, BALL_R: BALL_R },
    PITCH_TYPES: PITCH_TYPES, ARCH: ARCH, TRAITS: TRAITS, AERO: AERO,
    makeRng: makeRng, makeEnv: makeEnv, mlbEnv: mlbEnv, MLB_PARKS: MLB_PARKS, fenceAt: fenceAt,
    makePitcher: makePitcher, makeBatter: makeBatter, makeUmp: makeUmp, equipFielder: equipFielder, FIELD_MEANS: FIELD_MEANS,
    batOf: batOf, batSpeedOf: batSpeedOf, swingPowerOf: swingPowerOf, POWER_EXP: POWER_EXP,
    flyPitch: flyPitch, flyBatted: flyBatted, spinVector: spinVector, dirOf: dirOf, aim: aim,
    fatigueOf: fatigueOf, releasePoint: releasePoint, batterSide: batterSide, inZone: inZone,
    planPitch: planPitch, expectPitch: expectPitch, throwPitch: throwPitch, ghostPitch: ghostPitch,
    readFactors: readFactors, decide: decide, callPitch: callPitch, swing: swing, collide: collide,
    battedBall: battedBall, simPA: simPA
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BB;
