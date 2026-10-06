/* ============================================================================
   bb_engine.js · v3.3 · 2026-10-06

   The baseball engine. Pure JavaScript, seeded randomness, no DOM and no
   clock: the same file runs headless under jsc (calibration batches of
   thousands of plate appearances) and in the browser app, and a seed replays
   a game exactly. The page must never be the only way to run the model.

   THE DESIGN DECISION (Joe, 2026-09-29): players are defined by physical
   TRAITS - mostly things Statcast actually measures (bat speed, pitch
   velocity and spin, release point) plus the skills behind them (timing
   precision, pitch recognition, command). Every statistic - K%, walk rate,
   exit velocity, home runs - is an OUTPUT of those traits meeting physics and
   noise. Nothing below sets an outcome probability directly.

   THE GOAL (Joe, 2026-10-03): the frequency distribution of the traits among
   the whole pool of professional players, majors and minors, and how those
   latent traits meet the physics to give the statistics we measure. TRAITS is
   that pool. The majors are its top: each roster spot goes to the best of
   FARM_N = 6 candidates (an extreme-value sample), and the levels below take
   the next-best (level 2 Triple-A ... level 6 rookie ball). The pool is fitted
   so the majors' measured traits come out; the levels below are predictions.

   STAGES, in the order they run on every pitch:
     PLAN    the pitcher picks a pitch type from his usage, the batter's side,
             the count and what he has just thrown, and a target: the league's
             aim point for that type, side and count, moved by his own habits
             (measured, statcast/locations.py)                 (planPitch)
     EXPECT  the batter forms his guess from the scouting report on this
             pitcher in this count, and decides how hard to sit on it
                                                               (expectPitch)
     THROW   physics flies the real pitch from his release point (built from
             his height and arm slot); his command (measured, 7-8 in per axis)
             scatters it about the target, its speed, spin and seams vary from
             pitch to pitch as the league's do, fatigue takes off speed and
             spin                                              (throwPitch)
     READ    the batter's picture of the pitch is a GHOST pitch - the same
             release, flown as the pitch type he EXPECTED usually flies.
             Recognition corrects part of the difference before he commits;
             the rest is his misread. Unrecognised, he still reads where the
             ball is and its direction across and up and down; the curve still
             to come and its speed toward him are what fool him. Tunnelling falls out of this: two
             pitches that look alike early and separate late fool him. Even
             a pitch he recognises is judged partly from what its kind
             usually does: a pitch that rides or drops more than most is
             swung under or over                  (ghostPitch, readFactors)
     DECIDE  swing or take, from where he thinks the ball will cross the
             zone at the commit point, the count, and whether it is the pitch
             he was sitting on: a policy fitted to the league's swing curves
     CALL    a take is called by an umpire whose zone has a soft edge (his
             accuracy), per-edge systematic misses, a count lean, and the
             catcher's framing                                 (callPitch)
     SWING   timing error, vertical offset and barrel position come from the
             misread plus his execution noise; a swing he had to alter for a
             pitch he did not time is slower; the bat-ball collision is
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
     v3.3  the batted ball carries its spin to the ground (landW, for bb_field's bounce); a fielder's first step fitted to both
           windows of Statcast's outfield jump (react 0.20 s for position players, was 0.47; the catcher's and pitcher's kept)
     v3.2  THE RELEASE BEHIND HIS SHOULDER (PL): a batter reads a pitch worse, swings slower and meets it higher the
           further the release sits toward his own side of his line of sight (a same-side pitcher, a sidearmer most),
           measured from the league by release angle with batter, pitcher and pitch type held fixed; the model's
           platoon split had the wrong sign because its batter read every release alike (statcast/platoon.py)
     v3.1  BREAKING BALLS READ AS THE LEAGUE'S: a breaking ball or changeup shows the eye only TUNNEL_SEP of its
           separation from the fastball path at the commit point, and a batter who has not picked a pitch up
           decides on where the ball is, not on its motion (DIR_READ_DEC); the swing policy fitted by count x
           pitch kind (fit_swing_policy v0.5): breaking balls are now swung at and chased as the league's
     v3.0  THE BAT IS FASTEST WHERE THE SWING IS BUILT TO GO (BAT_LOC): bat speed rises low over the plate
           and falls as a pitch pulls the swing up, away or in, measured from the league's swings about
           each hitter's mean (reaching contact had kept the model's full bat speed); SWING_NORM 0.961
     v2.9  THE BARREL'S HEIGHT FOLLOWS THE PITCH LESS THAN FULLY: the up-down aim is pulled toward
           the middle of his zone (VERT_MISS), as the league's launch angles climb with pitch
           height; timing scatter grows with the time he is judging (flight time, a Weber
           fraction), not with pitch speed, refitted to the league's contact depth by pitch kind;
           a recognised breaking ball keeps half the misread it did (RESID_S); aim under the ball -0.15 in
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
  function jacobi(A, n) {   // eigenvalues and eigenvectors of a symmetric matrix by cyclic Jacobi rotations; A is overwritten
    var V = [], i, j, p, q, sweep;
    for (i = 0; i < n; i++) { V.push([]); for (j = 0; j < n; j++) V[i].push(i === j ? 1 : 0); }
    for (sweep = 0; sweep < 60; sweep++) {
      var off = 0, dg = 0;
      for (p = 0; p < n; p++) { dg += A[p][p] * A[p][p]; for (q = p + 1; q < n; q++) off += A[p][q] * A[p][q]; }
      if (off <= 1e-26 * dg) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (A[p][q] === 0) continue;
        var th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        var t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        var c = 1 / Math.sqrt(t * t + 1), sn = t * c, apq = A[p][q];
        A[p][p] -= t * apq; A[q][q] += t * apq; A[p][q] = A[q][p] = 0;
        for (i = 0; i < n; i++) {
          if (i !== p && i !== q) {
            var aip = A[i][p], aiq = A[i][q];
            A[i][p] = A[p][i] = c * aip - sn * aiq;
            A[i][q] = A[q][i] = sn * aip + c * aiq;
          }
          var vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - sn * viq; V[i][q] = sn * vip + c * viq;
        }
      }
    }
    var val = [], vec = [];
    for (i = 0; i < n; i++) { val.push(A[i][i]); vec.push([]); for (j = 0; j < n; j++) vec[i].push(V[j][i]); }
    return { val: val, vec: vec };
  }

  // ------------------------------------------------------ the ball and bat
  var BALL_M = 0.145, BALL_R = 0.0366;        // 5.125 oz; 9.125 in around
  var BALL_A = Math.PI * BALL_R * BALL_R;
  // The bat is a tapered wood beam: a 34 in professional profile, diameter
  // in inches at inches from the barrel end. The shape, not a constant,
  // gives the collision what it needs - the radius a ball meets at each
  // point, the balance point and the recoil about it, and the bending modes
  // that drain a strike away from the sweet spot (Nathan, Am. J. Phys. 68,
  // 979 (2000); Cross, Am. J. Phys. 66, 772 (1998)).
  var BAT_SHAPE = [[0, 2.55], [5, 2.55], [11, 2.2], [16, 1.7], [21, 1.2], [25, 0.96], [33, 0.94], [34, 1.6]];
  var SWEET_IN = 6;       // in from the barrel end: where a batter means to meet the ball; dLong is measured from here, + toward the end
  var BAT_TAU = 0.001;    // s: how long ball and bat touch. A bending mode slower than this takes energy as if the bat were lighter there; a faster one hands it back
  var WOOD_C = 4300;      // m/s: sqrt(E/rho) of ash and maple; sets the mode frequencies
  var E_COR = [0.546, 0.51];   // the ball's own coefficient of restitution at 60 mph (the MLB specification) and at 140 mph (Nathan); linear between
  var MU_BAT = 0.5;       // ball-bat friction; caps the tangential impulse on glancing contact
  // THE SWING IS A TILTED CIRCLE. Near contact the sweet spot travels on an arc
  // of radius SWING_R in a plane tilted from the ground by the batter's swing
  // tilt (Statcast's swing_path_tilt), with the barrel below the hands. Meeting
  // the ball further round the arc (out front) or short of it (deep) turns the
  // bat toward the pull side by cos(tilt) of that angle and raises its path by
  // sin(tilt) of it. Pitch-level 2025 (one week of July, 9,972 contacts): balls
  // met out front were pulled 1.59 deg per inch and the attack angle rose 0.80
  // deg per inch; SWING_R is the one radius that gives both within 11% at the
  // league's tilt. The plane is steeper for low pitches: 9.4 deg per zone height.
  var SWING_R = 0.87;     // m
  var TILT_PER_H = 9.4;   // deg of swing tilt per zone height (0 = bottom of his zone, 1 = top); 38 deg below the zone, 21 above
  var BAT_PEAK_M = 0.229, BAT_GAIN_EXP = 0.2;   // the barrel's speed peaks 9 in out front of his usual contact point; fitted to bat speed by contact depth (pitch-level 2025)
  // Pitch location (pitch-level 2025, one week of July): an inside pitch was met
  // a little further out front, 1.89 in per foot (r .10), and pulled more than
  // that depth alone explains, 7.9 deg per foot in all; the rest is the bat
  // face turned by the hands. And the hands only partly follow the pitch in and
  // out: what they do not cover moves the contact along the barrel, toward the
  // hands on an inside pitch and toward the end on an outside one. And a
  // batter aims the sweet spot a little inside the ball, because missing off
  // the end is worse than being jammed; so inside pitches suffer more (squared-
  // up contact fell from .69 over the middle to .27 more than a foot inside and
  // .44 more than a foot away, on balls struck square vertically).
  var LOC_DEPTH = 0.157;  // m of planned contact depth per m the pitch is inside
  var LOC_FACE = 0.29;    // rad of extra pull per m inside, at the same depth
  // THE FACE AND THE PATH (v2.3). The bat's path at contact (its direction of
  // travel, which Statcast measures as the attack direction) and its face (the
  // way the barrel's hitting surface points, which sends the ball) are not the
  // same: the hands are still moving at contact, so the barrel does not travel
  // square to itself. The face points FACE_PATH further to the pull side than
  // the path, and its own swing-to-swing scatter (faceSD) is about the path.
  // FITTED with pullBias: the league's path points square to centre field
  // (attack direction -0.5 deg on balls in play, hitters' means +0.3 ± 4.3),
  // yet a ball met with a square path goes ~14 deg to the pull side (spray
  // against attack direction, pitch-level 2025); 9 deg of face gives the
  // league's spray of liners and flies (statcast/bat_direction.py).
  var FACE_PATH = 9;      // deg
  var HAND_MISS = 0.3;    // share of the pitch's distance in or out that the hands do NOT cover
  // THE UP-DOWN TWIN (v2.9): the barrel follows a pitch's height less than fully, falling short by VERT_MISS of its
  // distance from the middle of his zone - under a high pitch, over a low one. In the league the launch angle minus
  // the attack angle climbed from -15 deg on pitches below the zone to +30 above it (+31 per zone height for
  // fastballs, +37 breaking, +29 off-speed, with contact depth held; pitch-level 2025, 42 days, 52,925 contacts),
  // where the model's climbed 7 deg: its aim followed the pitch exactly and only the misreads leaned with height.
  // FITTED jointly with the timing scale, RESID_S and the aim under the ball to the league's launch angle minus attack
  // angle by pitch height and kind, whiffs by kind and by height in and above the zone, and contact depth by kind
  // (scratch random search, two seeds; CALIBRATION v3.1)
  var VERT_MISS = 0.065;
  // TIMING SCATTER FOLLOWS THE TIME BEING JUDGED (v2.9). Judging when a ball arrives is timing an interval, and the
  // error of timing an interval grows with its length (a Weber fraction): a slower pitch, a longer flight, a larger
  // error. Until v2.9 the scatter grew with time pressure instead (faster = worse), and the model met fastballs over
  // a wider spread of depths than breaking balls (10.0 in against 9.1) where the league met them over a narrower one
  // (7.4 against 8.3, about each batter's mean). The scatter is now his timingSD x the flight time over FLIGHT_REF,
  // the flight of a 94-mph fastball (where time pressure is 1).
  var FLIGHT_REF = 0.41;  // s
  var AIM_HANDS = 1.4;    // in: how far toward the hands of the sweet spot he aims (v2.2, with longSD: few misses past the end, as the league's)
  var TIP_IN = 6, HANDLE_IN = -14;   // how far along the barrel from the sweet spot a ball can still be struck
  var BAT_CAP_IN = 1.0;              // in: a ball centred this far past the end still catches the rounded cap (ball radius 1.45 in)

  function batDiameter(shape, x) {   // in, at x in from the barrel end
    if (x <= 0) return shape[0][1];
    for (var j = 1; j < shape.length; j++) if (x <= shape[j][0]) { var a = shape[j - 1], b = shape[j]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return shape[shape.length - 1][1];
  }
  // The shape's bending modes, computed once in inches with E and rho scaled
  // out: a free-free Euler-Bernoulli beam on a half-inch grid, bending energy
  // from the second differences weighted by pi r^4/4, mass pi r^2 h, solved
  // by Jacobi rotations. The two zero modes are the rigid recoil (balance
  // point xc, radius of gyration k); the next three bending modes are kept,
  // each with S(x) = phi(x)^2 M / m_mode, its share of the inverse mass a
  // ball at x feels, and its frequency for the shape at this length.
  function batModes(shape) {
    var L = shape[shape.length - 1][0], N = 2 * L + 1, h = L / (N - 1), i, j, k, x = [], mu = [], ei = [], A = [];
    for (i = 0; i < N; i++) { var d = batDiameter(shape, i * h); x.push(i * h); mu.push(Math.PI * d * d / 4 * h); ei.push(Math.PI * Math.pow(d / 2, 4) / 4); }
    for (i = 0; i < N; i++) { A.push([]); for (j = 0; j < N; j++) A[i].push(0); }
    for (i = 1; i < N - 1; i++) {
      var w = ei[i] / (h * h * h), st = [[i - 1, 1], [i, -2], [i + 1, 1]], a, b;
      for (a = 0; a < 3; a++) for (b = 0; b < 3; b++) A[st[a][0]][st[b][0]] += w * st[a][1] * st[b][1];
    }
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) A[i][j] /= Math.sqrt(mu[i] * mu[j]);
    var E = jacobi(A, N), order = [], M = 0, xc = 0, k2 = 0, modes = [];
    for (i = 0; i < N; i++) { order.push(i); M += mu[i]; xc += mu[i] * x[i]; }
    order.sort(function (p, q) { return E.val[p] - E.val[q]; });
    xc /= M;
    for (i = 0; i < N; i++) k2 += mu[i] * (x[i] - xc) * (x[i] - xc);
    k2 /= M;
    for (k = 2; k < 5; k++) {
      var v = E.vec[order[k]], phi = [], S = [], mn = 0;
      for (i = 0; i < N; i++) { phi.push(v[i] / Math.sqrt(mu[i])); mn += mu[i] * phi[i] * phi[i]; }
      for (i = 0; i < N; i++) S.push(phi[i] * phi[i] * M / mn);
      modes.push({ f: Math.sqrt(Math.max(0, E.val[order[k]])) * WOOD_C / IN / (2 * Math.PI), phi: phi, S: S });
    }
    return { L: L, h: h, x: x, xc: xc, k2: k2, modes: modes };
  }
  var BAT_MODES = batModes(BAT_SHAPE);
  function pulseOf(wt) {   // energy a half-sine force pulse leaves in a mode (w x tau), relative to an instant blow
    var d = 1 - (wt / Math.PI) * (wt / Math.PI), F = Math.abs(d) < 1e-6 ? Math.PI / 4 : Math.cos(wt / 2) / d;
    return F * F;
  }
  // A bat: this weight of wood in the shape, at this length. batRadius is
  // the radius the ball meets x in from the end; batMass the mass it feels
  // there - the rigid recoil about the balance point plus every bending mode
  // slow enough to take energy during the contact (the pulse factor filters
  // each by its frequency, which scales as 1/length when the shape is
  // stretched). mEff is the rigid mass at the sweet spot, the inertia the
  // swing accelerates; q is the collision efficiency there at game speed, the
  // reference for the squared-up measure. The ball's own COR falls with the
  // approach speed, so a glancing or slow collision keeps a little more.
  function batOf(oz, lenIn) {
    var bat = { oz: oz, lenIn: lenIn, m: oz * 0.02835, g: [] };
    BAT_MODES.modes.forEach(function (md) { bat.g.push(pulseOf(2 * Math.PI * md.f * BAT_MODES.L / lenIn * BAT_TAU)); });
    var b = SWEET_IN * BAT_MODES.L / lenIn - BAT_MODES.xc;
    bat.mEff = bat.m / (1 + b * b / BAT_MODES.k2);
    bat.q = qAt(bat, SWEET_IN, 140 * MPH);
    return bat;
  }
  function batRadius(bat, xIn) { return 0.5 * batDiameter(BAT_SHAPE, xIn * BAT_MODES.L / bat.lenIn) * IN; }
  function batMass(bat, xIn) {
    var xs = xIn * BAT_MODES.L / bat.lenIn, b = xs - BAT_MODES.xc, inv = 1 + b * b / BAT_MODES.k2;
    var i = Math.max(0, Math.min(BAT_MODES.x.length - 1, Math.round(xs / BAT_MODES.h)));
    for (var n = 0; n < BAT_MODES.modes.length; n++) inv += bat.g[n] * BAT_MODES.modes[n].S[i];
    return bat.m / inv;
  }
  function corOf(vn) { return clamp(E_COR[0] + (E_COR[1] - E_COR[0]) * (vn / MPH - 60) / 80, 0.40, 0.60); }   // vn: normal approach speed, m/s
  function qAt(bat, xIn, vn) { var ms = batMass(bat, xIn); return (corOf(vn) * ms - BALL_M) / (ms + BALL_M); }   // exit = q*pitch + (1+q)*bat along the normal
  var BAT_DEFAULT = batOf(31.8, 34);

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
  // Batted-ball drag multiplier, FITTED to how far the league's balls in the
  // air carried by exit velocity and launch angle (statcast/bip.py table 5,
  // 42 days of 2025; headless/bip_check.js plays whole games, so MLB's parks
  // and weather are in it): 1.08 brings the model within 6 ft rms over 20-40
  // deg, with the spin this model's collision actually gives (about 3,200 rpm
  // in all at 25-30 deg, a third of it sidespin from the dipped barrel). The
  // old 1.142 had been fitted to one 400-ft drive at a spin the collision no
  // longer gives, and fly balls at 25-40 deg carried 7-23 ft short. Liners at
  // 15-20 deg still carry 10-20 ft too far: the spin's shape with launch angle
  // is not yet right. Pitches keep the unscaled drag: their speed loss and
  // movement already matched Savant (physics_check.js); against Nathan's
  // backspin table for a 103 mph, 27 deg drive the unscaled aerodynamics give
  // 380-399 ft from 500 to 2,000 rpm (his 368-400).
  var AERO = { batCd: 1.08 };

  function accel(v, w, env, a, cds, sm) {
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
    if (sm) { var s2 = sp * sp; a[0] += sm[0] * s2; a[2] += sm[1] * s2; }   // the seam force: sideways and vertical, growing with speed squared like lift
  }

  // RK4 step. Acceleration depends on velocity only, so position integrates
  // from the four velocity stages. Spin is held through the step and then
  // decays (time constant R / (2e-5 * speed), Nathan).
  var A1 = [0, 0, 0], A2 = [0, 0, 0], A3 = [0, 0, 0], A4 = [0, 0, 0];
  var V2 = [0, 0, 0], V3 = [0, 0, 0], V4 = [0, 0, 0];
  function step(p, v, w, env, dt, cds, sm) {
    var i;
    accel(v, w, env, A1, cds, sm);
    for (i = 0; i < 3; i++) V2[i] = v[i] + 0.5 * dt * A1[i];
    accel(V2, w, env, A2, cds, sm);
    for (i = 0; i < 3; i++) V3[i] = v[i] + 0.5 * dt * A2[i];
    accel(V3, w, env, A3, cds, sm);
    for (i = 0; i < 3; i++) V4[i] = v[i] + dt * A3[i];
    accel(V4, w, env, A4, cds, sm);
    for (i = 0; i < 3; i++) {
      p[i] += dt / 6 * (v[i] + 2 * V2[i] + 2 * V3[i] + V4[i]);
      v[i] += dt / 6 * (A1[i] + 2 * A2[i] + 2 * A3[i] + A4[i]);
    }
    var decay = Math.exp(-dt * 2e-5 * norm(v) / BALL_R);
    w[0] *= decay; w[1] *= decay; w[2] *= decay;
  }

  // A pitch flies until it crosses the front of the plate. `seam` is the
  // extra break the seams give this pitch, [arm side, up] in inches over a
  // typical flight (SEAM_D), on a pitcher whose arm side is `armSide`.
  // Seam-shifted wakes move real pitches by inches beyond what their spin
  // explains; the spin model leaves them out, so they enter here as a force
  // that grows with speed squared, like lift.
  var PITCH_DT = 0.0025, SEAM_D = 16.0;   // m: release to the front of the plate for a typical extension
  function seamForce(seam, armSide) { return seam ? [2 * seam[0] * IN / (SEAM_D * SEAM_D) * armSide, 2 * seam[1] * IN / (SEAM_D * SEAM_D)] : null; }
  function flyPitch(p0, v0, w0, env, rec, seam, armSide) {
    var p = p0.slice(), v = v0.slice(), w = w0.slice(), t = 0, sm = seamForce(seam, armSide || 1);
    var path = rec ? [[0, p[0], p[1], p[2]]] : null;
    var px = p[0], py = p[1], pz = p[2], pvx = v[0], pvy = v[1], pvz = v[2];
    while (p[1] > Y_PLATE && t < 3) {
      px = p[0]; py = p[1]; pz = p[2]; pvx = v[0]; pvy = v[1]; pvz = v[2];
      step(p, v, w, env, PITCH_DT, 1, sm); t += PITCH_DT;
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
  // `cmd` scales the pitcher's command [across, up and down] for the type: each
  // type's scatter within pitcher and count against the four-seamer's
  // (statcast/locations.py table 3). `plateW` [in] is the part of a pitch's
  // scatter at the plate that its pitch-to-pitch speed, spin, seam and release
  // variation make on their own (tools/plate_scatter.js, from this engine);
  // `cost` scales the fatigue load of throwing one.
  // Speeds and spin rates: Baseball Savant pitch-type averages, 2023-25.
  // `eff` and `tilt` were FITTED (headless/physics_check.js) so a typical
  // pitch of each type reproduces Savant's average movement to 0.1 in. For
  // the breaking balls the fitted eff runs well below Savant's published
  // "active spin" (slider 0.12 vs ~0.35): this lift model credits low spin
  // factors generously, and seam-shifted-wake effects are not modelled.
  // effArm: the share of spin that is active changes this much (relative) per
  // degree of arm angle (Savant active spin against arm angle, 2025: four-seam
  // +0.12 points per deg, r .17; cutter +0.22; slider +0.11; sweeper -0.10).
  // tiltArm: how the type's movement direction turns per degree of arm angle
  // above the league's average slot (37.7 deg): a higher slot gives a more
  // upright spin, a lower one more run (statcast/pitcher_chain.py, from each
  // pitcher's average movement). tiltSD is the spread left between pitchers at
  // the same slot, read from their spin axes (FC and SL keep a hand-set 12: a
  // mostly gyro spin has a poorly defined axis). spinRho: how far a pitcher's
  // spin on this type follows his four-seamer's (per mph; sinker .81, slider
  // .36, curveball .15, changeup .19 measured; cutter, sweeper, splitter
  // assumed like the sinker, slider and changeup).
  // ivbSD: the league's spread of induced vertical break within the type, in
  // inches (pitch-level 2025, one week of July): how much a pitch of the
  // kind can differ from the usual, which a batter's picture of it allows for.
  // How much pitches of a type differ, from statcast/pitch_spread.py (42 days
  // of 2025): rpmSD is the spread of pitchers' usual spin rate, rpmW (share
  // of his spin) and veloW (mph) the pitch-to-pitch spread within a game.
  // seamSD (between pitchers) and seamW (pitch to pitch), [arm side, up] in
  // inches, were FITTED (tools/fit_pitch_spread.js) so that, with the spin
  // spreads, the model's pitches spread in movement as the league's do.
  var PITCH_TYPES = {
    FF: { name: 'four-seam', dv: 0,     rpm: 2290, rpmSD: 141, rpmW: 0.031, eff: 0.85, effSD: 0.05, effArm: 0.0013, tilt: 25,   tiltSD: 6.8, tiltArm: -0.79, spinRho: 1.00,  veloW: 0.90, seamSD: [0.9, 1.3], seamW: [1.0, 1.1], cmd: [1.00, 1.00], plateW: [1.9, 1.6], cost: 1.00, ivbSD: 3.0, kind: 'FB' },
    SI: { name: 'sinker',    dv: -0.9,  rpm: 2160, rpmSD: 132, rpmW: 0.033, eff: 0.85, effSD: 0.05, effArm: 0.0006, tilt: 63,   tiltSD: 7.6, tiltArm: -0.93, spinRho: 0.81,  veloW: 0.87, seamSD: [1.2, 2.2], seamW: [1.4, 1.2], cmd: [1.06, 0.92], plateW: [1.8, 2.1], cost: 1.00, ivbSD: 5.0, kind: 'FB' },
    FC: { name: 'cutter',    dv: -4.8,  rpm: 2400, rpmSD: 182, rpmW: 0.029, eff: 0.28, effSD: 0.08, effArm: 0.0048, tilt: -11,  tiltSD: 12, tiltArm: -0.76, spinRho: 0.81, veloW: 1.05, seamSD: [0.0, 2.2], seamW: [1.7, 1.7], cmd: [1.03, 0.97], plateW: [2.0, 2.2], cost: 1.00, ivbSD: 3.9, kind: 'FB' },
    SL: { name: 'slider',    dv: -8.6,  rpm: 2430, rpmSD: 217, rpmW: 0.030, eff: 0.12, effSD: 0.05, effArm: 0.0035, tilt: -67,  tiltSD: 12, tiltArm: -0.11, spinRho: 0.36, veloW: 1.09, seamSD: [2.1, 3.3], seamW: [1.6, 1.9], cmd: [1.10, 1.11], plateW: [2.0, 2.3], cost: 1.05, ivbSD: 4.0, kind: 'BR' },
    ST: { name: 'sweeper',   dv: -11.5, rpm: 2600, rpmSD: 230, rpmW: 0.035, eff: 0.43, effSD: 0.08, effArm: -0.0020, tilt: -87,  tiltSD: 14.5, tiltArm: -0.35, spinRho: 0.36,  veloW: 1.03, seamSD: [1.2, 0.0], seamW: [2.4, 2.0], cmd: [1.21, 1.09], plateW: [2.6, 2.6], cost: 1.05, ivbSD: 4.3, kind: 'BR' },
    CU: { name: 'curveball', dv: -14.5, rpm: 2560, rpmSD: 276, rpmW: 0.030, eff: 0.34, effSD: 0.08, effArm: 0.0006, tilt: -141, tiltSD: 12, tiltArm: -1.03, spinRho: 0.15, veloW: 1.16, seamSD: [1.7, 3.6], seamW: [1.6, 1.6], cmd: [1.10, 1.22], plateW: [2.1, 2.4], cost: 1.05, ivbSD: 4.7, kind: 'BR' },
    CH: { name: 'changeup',  dv: -8.5,  rpm: 1780, rpmSD: 285, rpmW: 0.056, eff: 0.84, effSD: 0.06, effArm: -0.0005, tilt: 65,   tiltSD: 10.2, tiltArm: -0.88, spinRho: 0.19,  veloW: 1.00, seamSD: [0.0, 1.1], seamW: [1.7, 2.0], cmd: [1.10, 1.08], plateW: [2.1, 2.6], cost: 0.90, ivbSD: 5.1, kind: 'OS' },
    FS: { name: 'splitter',  dv: -7.8,  rpm: 1350, rpmSD: 331, rpmW: 0.089, eff: 0.65, effSD: 0.08, effArm: 0.0014, tilt: 75,   tiltSD: 13.4, tiltArm: -0.98, spinRho: 0.19, veloW: 0.93, seamSD: [1.5, 1.4], seamW: [2.2, 2.5], cmd: [1.08, 1.18], plateW: [2.5, 2.9], cost: 1.05, ivbSD: 4.2, kind: 'OS' }
  };

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
  function aim(rel, speed, rpm, tilt, eff, armSide, target, env, cache, seam) {
    var dx = target[0] - rel[0], dy = rel[1] - Y_PLATE, dz = target[1] - rel[2];
    var dist = Math.sqrt(dx * dx + dy * dy);
    var yaw0 = Math.atan2(dx, dy), pit0 = Math.atan2(dz, dist);
    var yaw, pit;
    if (cache && cache.ok) { yaw = yaw0 + cache.dy; pit = pit0 + cache.dp; }
    else { yaw = yaw0; pit = pit0 + 0.5 * G * dist / (speed * speed); }
    for (var it = 0; it < 8; it++) {
      var d = dirOf(yaw, pit);
      var hit = flyPitch(rel, [d[0] * speed, d[1] * speed, d[2] * speed], spinVector(d, rpm, tilt, eff, armSide), env, false, seam, armSide);
      var ex = target[0] - hit.x, ez = target[1] - hit.z;
      if (ex * ex + ez * ez < 1e-6) break;               // within a millimetre
      yaw += ex / dist; pit += ez / dist;
    }
    if (cache) { cache.ok = true; cache.dy = yaw - yaw0; cache.dp = pit - pit0; }
    return { yaw: yaw, pit: pit, dist: dist };
  }

  // -------------------------------------------------------------- traits
  // THE CALIBRATION KNOBS. Each entry is [mean, sd, lo, hi] of a distribution
  // players are drawn from. Since v1.8 these are the POPULATION - the full
  // range of players, most of whom would never reach the majors - and the farm
  // (makeBatter, makePitcher) picks the major leaguers; where a trait is
  // measured, its population was fitted so the picks have the league's values.
  // Changing a mean here is how the league is tuned - never by touching an
  // outcome.
  var TRAITS = {
    // hitters
    // THE POWER CHAIN (v0.7). Bat speed is not drawn, it is built: body (height,
    // weight), the swing power the body delivers per kg (muscle and technique
    // together - they cannot be told apart from bat speed alone), the length of
    // the swing and the bat he chooses set the bat's kinetic energy; the bat's
    // effective mass turns that into speed and sets the collision efficiency.
    // THE POPULATION (v1.8): these are the hitters drawn before the farm picks
    // (makeBatter); heightIn, weightLb, swingLenFt and swingPower were FITTED
    // (tools/fit_population.js) so the picked hitters have the 2025 Statcast
    // marginals - height 72.0 ± 2.35 in, weight 206.3 ± 19.9 lb, swing length
    // 7.32 ± 0.39 ft, bat speed 71.2 ± 2.70 mph (mean over tracked swings) - and
    // weight~bat speed .53; height~bat speed (.45) and swing length~bat speed
    // (.58) are TESTS (headless/power_chain.js). Every other hitter trait below
    // is the population too: its mean moved (tools/fit_population.js) so the
    // farm's picks keep the mean it was calibrated to when every drawn hitter
    // counted as a major leaguer, its spread as it was set - the farm narrows it.
    weightLb:   [202.7, 16.2, 155, 300], // lb: scatter about the height line (mean at 72 in, + 5.25 per inch)
    armIdx:     [1.0, 0.03, 0.9, 1.1],   // arm length over 0.44 x height: limb proportion (reach, plate coverage)
    swingLenFt: [7.246, 0.378, 6.2, 8.6], // ft: the bat head's path to contact, about the height line (0.047 per inch; r = .27)
    batOz:      [31.8, 0.6, 29, 35],     // oz: the bat he swings (plus 0.6 oz per 50 lb of hitter)
    swingPower: [25.517, 0.087, 10, 60],  // W/kg at 206 lb, lognormal with this log-sd; falls as weight^CHAIN.powerExp
    motorIn:    [0.892, 0.14, 0.56, 1.4], // in: vertical bat-to-ball scatter AT 72 MPH; grows as bat speed squared (impulse variability); x1.4 in v2.2 (the miss table)
    batSpeed:   [72.0, 2.65, 62, 82],    // mph - DERIVED from the chain; this entry only scales the display bars
    barrelSD:   [0.62, 0.11, 0.40, 1.1], // in - DERIVED (motorIn x (bat speed/72)^2); display scale only
    attack:    [9.57, 3.546, -2, 20],          // deg: upward tilt of the swing path at contact
    athletic:  [0, 1, -4, 4],                // standard normal: the deep trait beneath swing power, arm strength and sprint speed (ATHLETIC, v2.6)
    swingTilt: [31.778, 3.811, 22, 44],     // deg: the tilt of his swing plane for a mid-zone pitch (2025 leaderboard swing_path_tilt: 32.3 +- 3.8)
    faceSD:    [8.187, 4, 4, 20],           // deg: swing-to-swing scatter of the bat face's horizontal angle about its path at contact; fitted to fair-ball spray by contact depth (pitch-level 2025)
    undercut:  [0.391, 0.25, -0.35, 1.15], // in: how far below the ball's centre he aims the barrel; -0.15 in v2.9 with VERT_MISS (the joint fit)
    timingSD:  [9.935, 1.66, 6.26, 15.26],  // ms at a 94-mph fastball's flight, growing with flight time (v2.9); x0.72 in v2.9 so contact depth about each batter's mean has the league's sd by kind: 7.4 in fastballs, 8.3 breaking, 8.2 off-speed (pitch-level 2025)
    longSD:    [3.436, 0.51, 1.9, 5.1],   // in: along-the-barrel scatter; fitted so contact struck square vertically is squared up .695 of the time (pitch-level 2025), then x0.88 with the aim toward the hands (v2.2: the miss table's tail past the end)
    spotIn:    [5.007, 0.87, 2.7, 8.1],     // in: how far a pitch must have left his expected path by the commit point for him to pick it up; x1.09 in v2.2 (the miss table)
    eyeSD:     [5.497, 0.9, 3, 7.5],    // in: zone-judgement scatter at the commit point
    aggr:      [0.013, 0.07, -0.2, 0.2],    // lowers his swing threshold (positive = swings more)
    commit:    [0.545, 0.12, 0.2, 0.9],  // how hard he sits on his guess (0 = pure hedger)
    fbLean:    [1.846, 0.58, 1, 3.6],   // how much he leans toward guessing fastball: x his mix's fastball share; its excess over 1 x2.9 in v2.2 (the miss table)
    pullBias:  [1.989, 5, -12, 14],          // deg: how far round the arc his usual contact point is, which sets his bat's path there; mean fitted (v2.3) so the path points as Statcast's attack direction does (square to centre); spread: batters' usual depth sd 3.5 in
    learn:     [0.337, 0.1, 0.1, 0.6],   // share of his spotting distance he can learn away in a game
    coverage:  [6.234, 1.26, 3.8, 10.5],   // in off the zone at which his swing errors have doubled (reach); x2.1 in v2.2, fitted to the league's whiffs and misses by reach
    heightIn:  [71.42, 2.39, 66, 80],   // in: the population (the picked hitters: 72.0 +- 2.35, 2025 Statcast)
    // pitchers when they bat (NL rules) - override the hitter entries above
    pBatSpeed: [63, 4, 54, 72], pTimingSD: [14.62, 2.09, 9.72, 20.88], pBarrelSD: [2.38, 0.28, 1.7, 3.2],
    pSpotIn: [7.05, 1.09, 4.9, 10.3], pEyeSD: [3.6, 0.6, 2.4, 5], pAttack: [6, 4, -2, 16],
    // pitchers
    // THE PITCHER'S BODY AND DELIVERY (v1.6, statcast/pitcher_chain.py, 2025): his release point is built from
    // his height and arm slot (see THE DELIVERY), his pitches' movement turns with his slot, and his repertoire
    // leans with it; four-seam speed does not follow his body in the majors (r .09 with height, .05 with weight)
    pHeightIn: [74.61, 2.11, 68, 82],   // in: the population (the picks: 74.7 ± 2.1, 2025 pitchers)
    pWeightLb: [214, 18.8, 160, 300], // lb: scatter about the height line (214 + 4.2 per inch over 74.7)
    armAngle:  [36.58, 12.75, -5, 80],  // deg: his arm slot, the arm's angle above horizontal from the shoulder to the ball at release (Statcast arm angle); the population (picks 37.7 ± 12.8)
    fbVeloSP:  [93.65, 2.18, 88, 101], fbVeloRP: [94.65, 2.43, 89, 103],   // mph: four-seam speed of the POPULATION; the farm's picks have the league's (2025: starters 94.06 ± 2.16, relievers 95.05 ± 2.37)
    spinTalent: [-0.06, 1, -3.5, 3.5],    // sd units: his spin per mph against the type's league mean, shared across his pitches (PITCH_TYPES spinRho)
    // command: his scatter at the plate about the target, across and up and down, for a four-seamer. These are the
    // POPULATION's (v1.8), fitted (tools/fit_population.js) so the farm's picks have the league's, measured from 3-0
    // four-seamers about each pitcher's own 3-0 mean (statcast/locations.py; starters 7.2 / 8.4 in, relievers
    // 8.4 / 8.2; the spread between pitchers 7% and 11% of the mean; the two axes not strongly linked)
    cmdXSP:    [7.47, 0.53, 5.4, 9.4],   // in: scatter about the target across the plate, starters
    cmdZSP:    [8.86, 0.95, 5.6, 11.4],  // in: scatter about the target up and down, starters
    cmdXRP:    [8.73, 0.64, 6.4, 10.8],  // in: across, relievers (pitchers under 40 pitches a game)
    cmdZRP:    [8.66, 0.96, 5.4, 11],  // in: up and down, relievers
    staminaSP: [95, 10, 70, 120],    staminaRP: [28, 6, 15, 45],        // pitches before fatigue bites
    // umpires
    umpSD:     [1.4, 0.25, 0.9, 2.2], // in: the soft edge of his zone (his accuracy)
    umpEdge:   [0, 0.45, -1.2, 1.2],  // in: systematic miss per edge (positive = calls that edge wide)
    umpQuirk:  [1.4, 0.4, 0.6, 2.4],  // in: the size of one strong habit, for umpires who have one
    umpCount:  [0.5, 0.25, 0, 1.2],   // in: zone swell when the pitcher is behind, shrink when ahead
    // catchers
    framing:   [0, 0.35, -0.8, 0.8],  // in: how much he widens the edges
    // fielding and running (Statcast-shaped; position means in FIELD_MEANS)
    speed:     [27.023, 1.012, 22, 31],   // ft/s sprint speed
    react:     [0.468, 0.06, 0.25, 0.7],   // s: reading the ball and taking the first step; with bb_field's acceleration, Statcast's outfield jump (33.9 +- 1.9 ft)
    route:     [0.886, 0.04, 0.75, 1],    // straight-line share of the path he actually runs
    glove:     [0.982, 0.008, 0.94, 0.999],// clean-play rate on a routine chance
    armMph:    [84.012, 3.5, 70, 100],    // throw speed
    armAcc:    [0.603, 0.15, 0.25, 1.3],// m: throw scatter at 40 m
    transfer:  [0.688, 0.08, 0.45, 1],    // s: glove to release
    runAggr:   [0, 0.15, -0.4, 0.4],  // s: shifts the margin he demands before taking a base (negative = bolder)
    // the running game (Statcast-shaped)
    jump:      [0.22, 0.08, 0.05, 0.5],    // s: a runner's break on the pitcher's first move
    holdTime:  [1.35, 0.10, 1.05, 1.7],    // s: a pitcher's first move to the mitt with a man on
    pickMove:  [0, 0.06, -0.15, 0.15],     // s: how much sooner (-) or later than the league's his throw over beats a runner back to first; not measured (Statcast does not time the move), sized so pickoffs per game come out near the league's
    popTime:   [1.95, 0.08, 1.7, 2.3],     // s: a catcher's mitt to the glove at second base
    block:     [0.75, 0.10, 0.4, 0.98]     // share of balls in the dirt a catcher keeps in front of him
  };
  // Where a position sits relative to the league on speed, arm and first step.
  // Outfielders and infielders take their first step alike (the jump is measured
  // on outfielders); the catcher rises from his crouch and the pitcher finishes
  // his delivery first: their offsets keep the reaction they had before v3.2
  // (0.57 and 0.62 s), since the jump says nothing about them.
  var FIELD_MEANS = {
    C:  { speed: -1.5, armMph: -5, react: 0.37, transfer: 0.02 }, '1B': { speed: -1.0, armMph: -5 },
    '2B': { speed: 0.3, armMph: -3 }, SS: { speed: 0.8, armMph: 1 }, '3B': { speed: -0.2, armMph: 1 },
    LF: { speed: 0.2, armMph: 1 }, CF: { speed: 1.3, armMph: 2 }, RF: { speed: 0.2, armMph: 4 },
    DH: { speed: -0.5, armMph: -3 }, P: { speed: -1.5, armMph: -3, react: 0.42, glove: -0.02 }
  };
  // ATHLETICISM (v2.6, Joe: "a deeper trait upon which power, strength and speed
  // depend"). A position player's athleticism `athletic` is one standard normal,
  // drawn before anything else about him. His swing power (per kg), his arm
  // strength and his sprint speed are each drawn as their own normal loaded on
  // it - x = loading * athletic + the rest, his own - so each keeps its own
  // spread, and sprint speed also falls with body mass (heavier men run
  // slower). The loadings are FITTED (tools/fit_population.js) so the hitters the
  // farm picks have the league's correlations among the three (2025, qualified
  // hitters: power/kg ~ sprint +.46, power/kg ~ arm +.29, sprint ~ arm +.37) and
  // weight ~ sprint (-.37); one shared trait fits all three pairs at once. Bat
  // speed ~ sprint (+.09) and bat speed ~ arm (+.18) are left as the test.
  // Pitchers' fielding is drawn as before.
  var ATHLETIC = { power: 0.950, speed: 0.500, arm: 0.433, weightSpeed: -0.376 };
  function loaded(rng, a, lam, extra, extraVar) { return lam * a + (extra || 0) + Math.sqrt(Math.max(0, 1 - lam * lam - (extraVar || 0))) * rng.n(0, 1); }   // a standard normal sharing `a`
  function drawField(rng, key, pos, o) {
    var t = TRAITS[key], m = FIELD_MEANS[pos] || {}, off = m[key] || 0, a = o && o.athletic;
    if (a !== undefined && key === 'speed') return clamp(t[0] + off + t[1] * loaded(rng, a, ATHLETIC.speed, ATHLETIC.weightSpeed * (o.weightLb - 206) / 20, ATHLETIC.weightSpeed * ATHLETIC.weightSpeed), t[2], t[3]);
    if (a !== undefined && key === 'armMph') return clamp(t[0] + off + t[1] * loaded(rng, a, ATHLETIC.arm), t[2], t[3]);
    return clamp(rng.n(t[0] + off, t[1]), t[2], t[3]);
  }
  function equipFielder(rng, o, pos) {
    o.pos = pos;
    ['speed', 'react', 'route', 'glove', 'armMph', 'armAcc', 'transfer', 'runAggr', 'jump'].forEach(function (k) { o[k] = drawField(rng, k, pos, o); });
    if (pos === 'C') { o.popTime = drawField(rng, 'popTime', pos); o.block = drawField(rng, 'block', pos); }
    return o;
  }
  function drawT(rng, t) { return clamp(rng.n(t[0], t[1]), t[2], t[3]); }

  // ------------------------------------------------------ the power chain
  // Bat speed from the chain (the bat itself is built above, with the ball). The bat's kinetic energy 1/2 mEff v^2 is the
  // swing power (W/kg) x body mass x swing time, and the swing time is 2L/v
  // (from rest over the arc L), so v^3 = 4 p W L / mEff. At the means: 337 J
  // delivered in 0.139 s (2.4 kW) - the measured shape of a major-league swing.
  function batSpeedOf(powerKg, weightLb, swingLenFt, bat) {
    return Math.cbrt(4 * powerKg * weightLb * 0.4536 * swingLenFt * FT / bat.mEff) / MPH;
  }
  // Swing power per kg against body weight: the big men make more power, but
  // less per kilogram. The exponent is FITTED so that, through v^3 ∝ p W L, the
  // hitters the farm picks reproduce weight~bat speed r = .53
  // (tools/fit_population.js): -0.25. (Before the farm, drawn hitters were the
  // league and the fit gave -0.45; selection on value trims the slow end of
  // bat speed, so the population needs less of a weight penalty.)
  var CHAIN = { powerExp: -0.326 };
  function swingPowerOf(rng, weightLb, athletic) {   // per kg; loaded on his athleticism when he has one
    var t = TRAITS.swingPower, z = athletic === undefined ? rng.n(0, 1) : loaded(rng, athletic, ATHLETIC.power);
    return clamp(t[0] * Math.pow(weightLb / 206, CHAIN.powerExp) * Math.exp(t[1] * z), t[2], t[3]);
  }

  var nextId = 1;

  // THE DELIVERY (v1.6, statcast/pitcher_chain.py). His release point is his
  // shoulder plus his arm as a lever at his arm angle: the shoulder 0.705 of his
  // height up (sd 0.037), shoulder to ball 0.372 of his height (sd 0.016); the
  // release side adds where he stands on the rubber (0.14 +- 0.63 ft toward his
  // arm side); extension is 1.58 + 0.065 ft per inch of height (+- 0.39 ft).
  // A four-seamer, sinker or cutter thrown harder spins more, 18.2 rpm per mph.
  var SHOULDER_H = [0.705, 0.037], ARM_LEVER = [0.372, 0.016], REL_SIDE0 = [0.14, 0.63], EXT_H = [1.58, 0.065, 0.39];
  var ARM_MEAN = 37.7, FB_MEAN = 94.45, SPIN_PER_MPH = 18.2, FB_SD = 2.3;
  // HIS REPERTOIRE is a league pitcher's: drawn from the 2025 repertoires of
  // pitchers in his role with an arm slot near his (a Gaussian weight with
  // REP_BAND deg of width, set by hand), so the sinker-sweeper low slots and
  // the four-seam-curveball high slots, and how many pitches each role
  // carries (starters 4.8 types of 3% or more, relievers 3.8), are the
  // league's. A little lognormal scatter (USAGE_SD) makes each mix his own.
  // ---- REPERTOIRES: written by statcast/pitcher_chain.py; do not edit by hand ----
  // 2025 pitch-level Statcast: every pitcher with 150+ pitches, as [arm angle (deg), 0 starter / 1 reliever,
  // percent of his pitches of each type FF SI FC SL ST CU CH FS (types under 3% dropped, the rest renormalized)]. 422 pitchers.
  var REPERTOIRES = [
    [-60,1,0,79,0,21,0,0,0,0], [-24,1,17,78,5,0,0,0,0,0], [-6,1,14,33,0,0,33,0,19,0], [-4,1,20,34,0,0,41,0,5,0], [4,1,36,25,0,0,39,0,0,0], [5,1,8,25,0,27,34,0,6,0], [9,0,41,4,0,48,0,0,7,0], [11,1,9,29,0,0,8,55,0,0],
    [11,1,15,28,20,0,31,0,0,5], [12,1,30,18,15,0,32,0,4,0], [13,1,41,0,14,0,5,0,40,0], [15,0,48,18,0,23,0,0,11,0], [15,0,31,18,0,0,0,26,24,0], [16,1,0,12,40,48,0,0,0,0], [16,0,62,0,0,0,34,0,4,0], [16,1,39,25,0,16,10,0,10,0],
    [16,1,8,55,0,3,18,0,9,7], [16,0,46,6,0,5,28,0,14,0], [16,1,9,32,0,49,0,0,10,0], [17,1,52,22,0,0,19,0,7,0], [17,1,0,43,8,7,0,33,10,0], [18,1,60,0,0,0,0,0,0,40], [18,1,0,60,0,40,0,0,0,0], [18,0,28,36,0,12,0,0,24,0],
    [18,0,4,41,0,0,40,0,0,15], [19,1,48,14,0,34,0,0,4,0], [19,1,0,32,0,0,39,29,0,0], [19,0,50,16,0,20,0,0,13,0], [20,0,32,18,6,0,0,28,16,0], [20,0,33,0,16,32,0,0,19,0], [20,1,56,0,0,44,0,0,0,0], [20,0,18,35,5,0,42,0,0,0],
    [21,1,48,0,0,0,0,0,52,0], [21,0,32,12,8,0,0,41,8,0], [22,0,7,34,9,0,27,0,24,0], [22,0,44,17,9,0,8,0,22,0], [22,0,10,45,0,0,14,0,31,0], [22,1,51,9,6,0,34,0,0,0], [22,1,25,16,0,12,29,18,0,0], [22,0,0,39,6,0,0,36,18,0],
    [23,0,42,16,0,14,0,11,17,0], [23,0,43,17,11,0,12,9,0,8], [23,0,28,14,8,34,0,0,16,0], [23,1,29,10,20,0,0,21,0,20], [23,0,24,0,37,17,0,0,22,0], [23,1,48,0,0,38,0,0,15,0], [24,0,38,11,0,6,15,5,11,14], [24,0,22,13,22,7,0,10,27,0],
    [24,0,10,24,22,0,10,24,9,0], [24,0,52,0,0,15,0,12,21,0], [25,0,47,21,0,10,15,0,7,0], [25,0,12,41,7,31,9,0,0,0], [25,0,42,3,0,10,31,0,13,0], [25,1,15,33,9,0,22,0,0,21], [25,0,53,7,0,10,0,21,8,0], [26,1,52,16,12,0,12,0,8,0],
    [26,1,18,25,0,0,27,25,5,0], [26,0,52,15,0,9,12,4,0,9], [26,0,8,26,7,0,26,12,19,0], [26,1,44,0,0,27,0,0,29,0], [26,1,0,10,35,0,15,40,0,0], [26,0,40,9,0,28,0,17,5,0], [26,0,22,32,0,4,20,0,22,0], [26,1,66,0,0,34,0,0,0,0],
    [26,0,22,25,7,0,20,10,15,0], [27,0,17,21,26,0,15,0,21,0], [27,1,3,21,0,0,52,0,24,0], [27,0,51,3,10,31,0,0,5,0], [27,0,38,21,3,6,0,26,5,0], [27,1,39,15,11,0,31,0,4,0], [27,0,51,0,0,25,0,24,0,0], [27,1,49,27,0,24,0,0,0,0],
    [28,0,31,4,18,0,12,30,5,0], [28,0,21,22,41,0,0,9,7,0], [28,0,20,13,30,0,21,0,16,0], [28,0,10,30,11,0,21,15,13,0], [28,0,37,20,0,0,23,10,10,0], [28,0,41,12,0,12,4,25,6,0], [28,1,6,50,0,0,33,0,11,0], [29,1,0,56,0,41,0,0,3,0],
    [29,0,38,11,0,18,8,10,0,15], [29,0,33,30,0,0,31,6,0,0], [29,1,0,47,0,0,53,0,0,0], [29,1,7,35,0,0,25,21,0,11], [29,1,21,45,0,34,0,0,0,0], [29,0,53,0,0,23,12,4,8,0], [29,0,0,50,0,15,0,0,34,0], [29,0,35,4,0,16,15,0,31,0],
    [29,0,52,0,0,26,0,16,6,0], [30,0,8,34,0,26,0,0,31,0], [30,1,0,29,0,58,0,0,14,0], [30,0,19,43,0,14,6,0,18,0], [30,1,0,45,0,30,25,0,0,0], [30,1,0,54,0,13,0,15,18,0], [30,1,12,43,0,0,19,10,16,0], [30,1,24,27,14,26,0,6,3,0],
    [30,0,43,8,7,10,9,10,12,0], [30,1,46,0,14,0,0,0,40,0], [30,0,28,15,0,12,5,19,19,0], [31,1,38,16,15,31,0,0,0,0], [31,1,38,25,0,8,0,0,28,0], [31,1,37,18,0,0,46,0,0,0], [31,0,18,21,14,20,0,16,11,0], [31,1,0,57,19,0,0,13,11,0],
    [31,0,63,0,0,16,0,20,0,0], [31,1,27,20,0,17,0,37,0,0], [31,0,21,6,23,0,0,20,0,29], [31,1,33,0,0,40,0,0,27,0], [32,0,51,0,0,21,0,0,28,0], [32,1,4,44,15,0,38,0,0,0], [32,0,44,13,0,0,24,11,8,0], [32,1,20,30,0,0,0,11,40,0],
    [32,1,15,34,4,38,9,0,0,0], [32,0,10,46,14,0,5,17,4,3], [32,0,47,0,0,39,0,5,9,0], [32,1,5,33,0,0,45,0,18,0], [32,1,49,12,0,0,22,0,0,17], [32,1,32,9,7,45,0,0,7,0], [32,1,12,0,0,0,0,0,88,0], [32,1,13,63,0,7,0,0,18,0],
    [32,0,21,26,15,16,0,0,23,0], [32,1,14,59,0,21,0,0,5,0], [32,1,4,64,12,18,0,0,3,0], [32,1,27,21,9,0,25,0,18,0], [32,0,49,0,0,33,0,0,0,18], [32,1,19,31,13,27,0,0,0,11], [32,0,29,13,0,5,33,0,20,0], [33,1,45,6,11,0,38,0,0,0],
    [33,0,43,8,0,39,0,0,11,0], [33,1,36,0,0,0,4,22,0,37], [33,1,35,9,0,55,0,0,0,0], [33,1,22,16,0,12,11,0,39,0], [33,0,18,37,12,0,18,0,15,0], [33,0,27,16,10,0,15,16,16,0], [33,0,20,19,11,14,12,20,0,4], [33,0,36,26,9,0,9,12,9,0],
    [33,0,49,0,0,27,0,12,12,0], [33,0,32,16,11,13,9,0,18,0], [33,0,0,39,15,23,0,11,0,13], [33,1,67,10,0,0,24,0,0,0], [33,0,46,13,0,11,0,14,15,0], [33,1,6,56,0,9,26,0,0,3], [33,0,22,25,43,5,0,0,5,0], [34,0,33,7,11,0,27,22,0,0],
    [34,1,5,30,25,0,18,0,0,23], [34,1,33,6,0,5,0,0,0,56], [34,0,38,10,0,0,20,13,20,0], [34,1,23,24,0,49,0,0,4,0], [34,1,12,27,0,7,37,0,5,12], [34,0,9,16,30,0,25,7,12,0], [34,1,42,0,0,0,27,0,30,0], [34,0,48,0,0,34,0,6,12,0],
    [34,1,52,0,36,0,12,0,0,0], [34,0,11,22,0,20,0,23,24,0], [35,1,45,0,0,21,0,0,34,0], [35,1,44,0,0,56,0,0,0,0], [35,1,0,58,0,0,0,26,16,0], [35,0,17,18,0,15,0,27,0,24], [35,1,0,36,13,0,0,50,0,0], [35,0,0,33,28,0,26,0,13,0],
    [35,0,31,17,12,0,22,0,17,0], [35,1,23,19,19,0,30,0,8,0], [35,0,25,19,23,4,11,11,9,0], [35,1,45,0,0,55,0,0,0,0], [35,1,6,51,0,28,14,0,0,0], [35,0,43,7,0,0,18,12,20,0], [35,1,54,0,0,46,0,0,0,0], [35,1,10,25,0,12,13,25,15,0],
    [36,0,31,16,4,38,0,0,11,0], [36,0,7,12,38,4,20,18,0,0], [36,1,10,16,35,0,21,4,13,0], [36,0,34,17,26,0,18,0,4,0], [36,0,52,0,0,8,0,0,0,40], [36,0,19,29,0,0,0,12,40,0], [36,0,43,0,0,0,21,0,0,36], [36,1,42,0,0,45,0,0,0,13],
    [36,1,4,37,27,6,8,0,18,0], [36,1,37,0,0,23,24,0,0,16], [36,1,77,0,0,20,0,0,0,3], [36,0,32,5,13,22,0,14,0,15], [36,0,33,0,0,40,0,14,12,0], [36,1,15,49,0,37,0,0,0,0], [36,0,26,25,0,17,0,6,26,0], [36,1,30,16,21,28,0,6,0,0],
    [36,0,10,44,0,22,0,9,16,0], [36,0,45,0,15,4,0,24,12,0], [36,1,24,17,0,32,0,13,14,0], [36,0,0,27,29,35,0,0,9,0], [37,0,18,28,14,6,0,16,18,0], [37,1,67,0,0,0,33,0,0,0], [37,1,31,8,0,36,0,0,0,25], [37,1,70,0,0,0,8,0,0,21],
    [37,1,35,0,0,51,0,0,13,0], [37,1,15,0,0,39,5,0,41,0], [37,1,29,0,34,16,21,0,0,0], [37,1,22,40,0,27,0,8,3,0], [37,1,12,34,9,4,0,0,41,0], [37,0,32,11,4,25,0,4,22,0], [37,0,41,0,0,34,0,9,16,0], [38,0,40,5,0,9,22,0,25,0],
    [38,0,46,0,5,16,0,13,19,0], [38,1,0,50,0,50,0,0,0,0], [38,1,46,0,16,17,0,14,6,0], [38,1,27,22,0,33,4,0,15,0], [38,0,9,44,0,6,0,29,0,12], [38,0,34,20,0,14,16,7,8,0], [38,0,17,12,0,36,17,0,19,0], [38,0,57,0,0,7,0,15,0,21],
    [39,1,54,0,0,26,0,0,20,0], [39,0,17,35,5,26,0,0,18,0], [39,0,54,0,0,8,0,16,22,0], [39,1,20,35,0,45,0,0,0,0], [39,0,32,0,16,41,0,11,0,0], [39,1,0,48,0,30,0,0,22,0], [39,0,30,21,18,4,21,0,6,0], [39,1,45,0,0,0,0,37,0,17],
    [39,1,75,0,0,0,0,25,0,0], [39,1,18,0,5,0,0,77,0,0], [39,0,46,5,17,22,0,0,10,0], [39,0,26,19,0,26,4,0,0,25], [39,0,36,0,16,15,0,20,13,0], [40,0,52,0,0,36,0,0,0,12], [40,0,41,5,0,5,19,0,30,0], [40,0,24,15,12,14,8,8,18,0],
    [40,1,24,9,0,24,6,33,5,0], [40,1,38,9,0,31,0,0,22,0], [40,1,28,13,19,20,0,3,17,0], [40,1,29,0,31,0,19,0,0,21], [40,1,52,0,0,48,0,0,0,0], [40,0,29,10,8,0,11,25,17,0], [40,0,43,10,0,16,0,24,7,0], [40,0,23,27,0,17,0,16,16,0],
    [40,0,41,0,0,19,0,16,0,24], [40,0,14,33,31,0,0,13,10,0], [40,0,48,0,0,8,32,0,13,0], [40,0,16,27,0,16,27,0,14,0], [40,1,0,31,39,9,0,0,21,0], [41,1,30,23,26,0,21,0,0,0], [41,1,11,23,30,0,18,5,13,0], [41,0,51,0,9,12,0,0,0,28],
    [41,1,40,16,0,24,0,11,9,0], [41,0,17,15,11,0,22,10,0,25], [41,1,56,0,5,15,0,0,23,0], [41,1,55,0,0,22,0,4,0,20], [41,0,36,20,0,10,0,34,0,0], [41,0,10,24,30,12,0,4,0,20], [41,1,46,5,0,11,0,31,6,0], [41,0,35,18,0,21,0,15,11,0],
    [41,1,49,0,0,51,0,0,0,0], [41,0,46,11,13,0,0,6,24,0], [41,0,0,15,47,11,0,18,9,0], [41,1,11,35,0,54,0,0,0,0], [41,0,28,16,0,30,0,22,4,0], [41,0,42,5,10,15,0,3,25,0], [41,0,53,7,21,0,0,18,0,0], [41,0,55,0,0,0,0,12,0,33],
    [41,1,31,16,33,0,0,0,0,20], [41,0,38,0,0,36,5,0,0,21], [41,1,29,0,0,21,28,0,23,0], [42,1,46,0,0,38,0,0,16,0], [42,1,38,0,17,0,0,0,45,0], [42,0,0,47,0,0,0,33,20,0], [42,0,34,0,0,33,0,9,24,0], [42,0,47,0,0,11,0,24,18,0],
    [42,1,51,5,0,44,0,0,0,0], [42,1,58,0,30,6,0,0,6,0], [42,0,13,40,0,9,0,10,27,0], [42,1,52,0,0,26,23,0,0,0], [42,1,58,0,21,0,0,0,0,21], [42,1,30,23,0,29,0,0,18,0], [42,0,10,14,41,6,0,20,0,9], [42,0,35,10,0,30,0,8,17,0],
    [42,0,0,11,44,25,0,20,0,0], [43,0,47,4,0,19,0,24,6,0], [43,1,17,15,33,0,22,14,0,0], [43,0,14,42,0,0,0,9,35,0], [43,1,0,66,0,26,0,0,8,0], [43,1,15,11,7,0,46,0,21,0], [43,0,6,43,8,10,19,0,15,0], [43,0,28,22,0,19,0,12,0,18],
    [43,0,39,0,7,23,7,0,24,0], [43,0,54,0,0,20,0,0,26,0], [43,0,39,8,10,0,0,16,0,27], [43,0,45,0,0,36,0,13,6,0], [44,1,15,50,0,0,35,0,0,0], [44,0,27,21,12,0,0,29,10,0], [44,0,31,25,27,0,4,0,13,0], [44,0,30,17,0,23,0,20,11,0],
    [44,1,21,16,0,38,0,0,25,0], [44,0,44,16,0,6,0,11,0,22], [44,0,46,12,12,0,8,11,10,0], [44,0,43,11,0,30,0,0,16,0], [44,0,51,0,4,13,0,21,12,0], [44,0,15,20,30,7,0,8,0,20], [44,0,63,0,0,16,0,16,5,0], [44,0,50,0,0,26,0,0,25,0],
    [45,0,30,13,21,8,7,16,4,0], [45,1,0,46,0,0,27,0,0,28], [45,0,67,0,0,0,0,33,0,0], [45,1,23,17,27,0,0,18,0,14], [45,0,0,48,14,31,0,0,7,0], [45,0,30,16,0,18,0,13,22,0], [45,1,0,46,0,18,0,0,35,0], [45,1,72,12,0,0,0,0,16,0],
    [45,0,31,0,0,38,0,20,12,0], [45,1,30,21,25,25,0,0,0,0], [45,0,37,8,0,27,0,0,0,28], [45,0,48,0,0,26,0,15,11,0], [45,0,32,7,23,0,6,0,0,31], [45,1,30,8,0,20,13,21,8,0], [45,0,46,0,0,28,0,10,0,16], [46,1,55,5,0,40,0,0,0,0],
    [46,1,25,0,0,27,0,0,0,48], [46,0,4,38,24,0,0,8,26,0], [46,1,29,18,14,0,0,18,21,0], [46,1,25,0,0,65,0,10,0,0], [46,0,40,10,0,27,0,9,15,0], [46,0,16,18,26,0,11,16,13,0], [46,1,31,0,0,53,0,0,17,0], [46,1,34,0,19,0,29,18,0,0],
    [46,1,22,52,0,0,0,25,0,0], [46,0,25,0,37,0,17,5,15,0], [47,1,45,4,0,51,0,0,0,0], [47,1,49,0,0,16,0,32,4,0], [47,0,37,6,15,0,16,12,13,0], [47,1,0,46,0,21,0,12,22,0], [47,1,47,17,0,22,0,0,13,0], [47,1,43,0,0,16,0,20,21,0],
    [47,0,39,8,0,17,0,13,25,0], [47,0,0,44,19,29,0,8,0,0], [47,0,29,11,10,20,0,17,13,0], [47,0,36,5,25,0,0,4,29,0], [47,0,28,12,12,16,8,0,0,24], [47,0,22,21,14,0,17,18,8,0], [47,0,30,0,0,34,0,29,7,0], [47,0,39,0,0,30,0,10,21,0],
    [47,0,41,7,9,7,0,13,23,0], [47,0,45,0,5,0,20,9,20,0], [48,1,45,4,0,31,0,20,0,0], [48,1,57,0,7,0,0,0,36,0], [48,1,43,14,0,15,16,0,12,0], [48,1,37,0,0,0,55,0,8,0], [48,1,70,0,0,15,0,15,0,0], [48,0,45,0,0,22,10,14,0,9],
    [48,1,48,6,16,0,0,5,26,0], [48,1,22,13,0,39,20,0,6,0], [49,0,51,5,0,0,21,9,14,0], [49,0,43,0,8,24,0,17,8,0], [49,1,56,0,3,0,0,0,40,0], [49,1,26,15,0,0,0,0,0,60], [49,0,44,5,0,7,20,0,24,0], [49,0,46,5,0,25,16,0,8,0],
    [49,1,32,0,0,19,0,15,34,0], [49,0,29,24,0,12,0,0,34,0], [49,0,54,0,0,0,0,14,5,26], [49,0,34,0,11,22,0,10,23,0], [49,1,21,0,4,40,0,35,0,0], [49,1,80,0,0,5,0,0,15,0], [49,0,51,0,0,22,0,7,20,0], [50,1,0,44,0,3,0,23,0,30],
    [50,0,27,18,0,30,0,0,26,0], [50,1,58,0,0,17,12,0,0,13], [50,1,3,49,0,9,0,24,15,0], [51,1,0,0,71,29,0,0,0,0], [51,1,45,18,0,12,0,0,26,0], [51,0,25,13,14,15,0,8,24,0], [51,1,18,41,0,42,0,0,0,0], [51,1,45,0,21,7,0,28,0,0],
    [51,1,56,0,0,44,0,0,0,0], [52,1,48,14,0,11,0,28,0,0], [52,0,12,44,0,36,0,0,9,0], [52,0,46,0,0,41,4,9,0,0], [52,1,39,0,0,48,0,13,0,0], [52,0,49,0,0,24,0,5,23,0], [52,1,51,0,15,34,0,0,0,0], [53,1,67,0,0,33,0,0,0,0],
    [53,1,41,33,0,17,0,0,0,10], [53,1,57,0,12,0,0,27,0,4], [53,0,62,0,0,34,0,3,0,0], [53,1,53,15,0,25,0,0,7,0], [53,1,0,7,82,7,4,0,0,0], [53,0,35,0,0,16,0,31,18,0], [53,0,41,0,0,10,0,19,30,0], [53,1,52,0,0,43,0,0,0,4],
    [53,0,49,0,0,14,0,12,25,0], [54,0,37,4,19,5,0,0,35,0], [54,0,29,12,0,26,14,9,9,0], [54,0,62,0,15,12,0,11,0,0], [54,0,43,0,0,26,8,15,8,0], [54,0,7,11,20,11,0,15,0,35], [54,0,35,24,32,0,5,3,0,0], [55,0,39,0,0,27,12,14,8,0],
    [55,1,48,0,0,52,0,0,0,0], [55,0,43,5,28,0,0,13,0,12], [55,1,35,0,0,20,8,0,0,37], [55,1,49,0,0,22,0,0,29,0], [55,1,58,0,5,0,5,21,10,0], [55,1,0,0,51,49,0,0,0,0], [55,0,26,17,27,0,11,5,14,0], [56,0,60,7,0,18,0,10,0,5],
    [56,0,35,0,0,41,0,17,0,7], [56,1,40,0,0,15,13,31,0,0], [56,0,40,0,0,10,0,27,23,0], [56,0,30,26,0,21,0,23,0,0], [56,0,22,29,0,35,0,14,0,0], [56,0,49,0,7,0,20,24,0,0], [57,0,55,0,0,0,18,18,9,0], [57,0,26,0,21,15,0,18,20,0],
    [57,0,39,21,0,12,0,16,11,0], [57,1,47,0,0,45,0,7,0,0], [57,1,14,22,46,0,19,0,0,0], [58,0,19,21,19,8,0,13,19,0], [58,0,44,13,0,29,0,14,0,0], [58,1,54,0,20,6,0,20,0,0], [59,1,48,0,12,37,0,0,4,0], [61,0,51,0,24,18,0,0,0,7],
    [62,0,59,0,0,9,0,23,0,9], [62,1,42,0,0,52,0,6,0,0], [63,0,45,0,10,21,0,11,0,13], [64,1,45,0,22,9,0,19,5,0], [65,1,57,0,0,36,0,0,7,0], [66,1,49,0,0,24,0,0,0,26]
  ];
  // ---- REPERTOIRES: end ----
  var REP_TYPES = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS'], REP_BAND = 5, USAGE_SD = 0.15;
  function drawRepertoire(rng, arm, role) {
    var rp = role === 'RP' ? 1 : 0;
    var w = REPERTOIRES.map(function (r) { return r[1] === rp ? Math.exp(-0.5 * Math.pow((r[0] - arm) / REP_BAND, 2)) : 0; });
    var r = REPERTOIRES[rng.pickW(w)], mix = {};
    REP_TYPES.forEach(function (t, i) { if (r[i + 2] > 0) mix[t] = r[i + 2] / 100; });
    return mix;
  }
  function repertoireName(mix) {      // for the screen: 'sinker-sweeper', or 'four-pitch' and up
    var ts = Object.keys(mix).sort(function (a, b) { return mix[b] - mix[a]; }), big = ts.filter(function (t) { return mix[t] >= 0.10; });
    if (big.length >= 4) return ['', '', '', '', 'four', 'five', 'six', 'seven'][Math.min(big.length, 7)] + '-pitch';
    return ts.slice(0, 2).map(function (t) { return PITCH_TYPES[t].name; }).join('-');
  }

  function drawPitcher(rng, o) {      // a pitcher from the population; makePitcher picks the major leaguer (THE FARM)
    o = o || {};
    var T = TRAITS, role = o.role || 'SP';
    var throws = o.throws || (rng.u() < 0.28 ? 'L' : 'R');
    var armSide = throws === 'R' ? -1 : 1;
    var h = drawT(rng, T.pHeightIn), arm = drawT(rng, T.armAngle);
    var wt = clamp(T.pWeightLb[0] + 4.2 * (h - T.pHeightIn[0]) + rng.n(0, T.pWeightLb[1]), T.pWeightLb[2], T.pWeightLb[3]);
    var mix = drawRepertoire(rng, arm, role);
    var fb = drawT(rng, role === 'SP' ? T.fbVeloSP : T.fbVeloRP), spinZ = drawT(rng, T.spinTalent);
    var types = Object.keys(mix).sort(function (a, b) { return mix[b] - mix[a]; });
    var pitches = types.map(function (k) {
      var d = PITCH_TYPES[k], fbk = d.kind === 'FB';
      var sdSpin = fbk ? Math.sqrt(Math.max(0, d.rpmSD * d.rpmSD - Math.pow(SPIN_PER_MPH * FB_SD, 2))) : d.rpmSD;   // the spread left once speed has had its say
      var rpm = d.rpm + (fbk ? SPIN_PER_MPH * (fb - FB_MEAN) : 0) + sdSpin * (d.spinRho * spinZ + Math.sqrt(1 - d.spinRho * d.spinRho) * rng.n(0, 1));
      return { type: k,
               velo: fb + d.dv + (d.dv === 0 ? 0 : rng.n(0, 1.0)),
               rpm: clamp(rpm, d.rpm - 3 * d.rpmSD, d.rpm + 3 * d.rpmSD),
               eff: clamp(d.eff * (1 + d.effArm * (arm - ARM_MEAN)) + rng.n(0, d.effSD), 0.03, 0.99),   // a higher slot spins a four-seamer more cleanly
               tilt: d.tilt + d.tiltArm * (arm - ARM_MEAN) + rng.n(0, d.tiltSD),   // his slot turns the movement
               seam: [rng.n(0, d.seamSD[0]), rng.n(0, d.seamSD[1])],   // in: his usual seam break, arm side and up
               usage: mix[k] * Math.exp(rng.n(0, USAGE_SD)),
               habit: [rng.n(0, PLAN_LOC.habit[k][0]), rng.n(0, PLAN_LOC.habit[k][1])],   // his own aim for it: in toward his arm side, share of the zone
               aimCache: { ok: false } };
    });
    var u = normalize(pitches.map(function (p) { return p.usage; }));
    pitches.forEach(function (p, i) { p.usage = u[i]; });
    var hFt = h / 12, sa = arm * DEG;
    var shoulder = hFt * clamp(rng.n(SHOULDER_H[0], SHOULDER_H[1]), 0.6, 0.8), lever = hFt * clamp(rng.n(ARM_LEVER[0], ARM_LEVER[1]), 0.32, 0.42);
    var P = equipFielder(rng, {
      id: nextId++, name: o.name || '', role: role, throws: throws, armSide: armSide, arch: repertoireName(mix),
      heightIn: h, weightLb: wt, armAngle: arm,
      rel: { ht: shoulder + lever * Math.sin(sa), side: rng.n(REL_SIDE0[0], REL_SIDE0[1]) + lever * Math.cos(sa), ext: clamp(EXT_H[0] + EXT_H[1] * h + rng.n(0, EXT_H[2]), 5.2, 7.8) },
      cmd: [drawT(rng, role === 'SP' ? T.cmdXSP : T.cmdXRP), drawT(rng, role === 'SP' ? T.cmdZSP : T.cmdZRP)],
      stamina: drawT(rng, role === 'SP' ? T.staminaSP : T.staminaRP),
      holdTime: drawT(rng, T.holdTime),
      pitches: pitches, load: 0
    }, 'P');
    P.pickMove = drawT(rng, T.pickMove);   // drawn last, so every earlier draw keeps its place
    P.command = Math.sqrt((P.cmd[0] * P.cmd[0] + P.cmd[1] * P.cmd[1]) / 2);   // one number for the screen: his scatter per axis
    P.fbVelo = fb; P.spinZ = spinZ;    // kept for the scouts
    return P;
  }

  // A hitter drawn from the POPULATION of players - the full range, most of
  // whom would never reach the major leagues. makeBatter picks the major
  // leaguer (THE FARM, below).
  // HIS SWING STYLE (v1.9). Pull-and-lift is a way of hitting, not a by-product
  // of where he meets the ball: across 2025's qualified hitters the uphill
  // swingers pulled more (attack angle ~ pull% +.66) and swung longer (+.33),
  // and the long swingers pulled more (+.34), while contact depth hardly
  // followed attack angle (+.17; swing-path and batting leaderboards). One
  // latent style per hitter, shared by his attack angle, pull bias and swing
  // length with STYLE loadings that reproduce those three correlations (their
  // products), fitted to them; each trait keeps its own marginal spread.
  var STYLE = { attack: 0.80, pullBias: 0.82, swingLen: 0.41 };
  function styled(rng, t, z, lam) { return clamp(t[0] + t[1] * (lam * z + Math.sqrt(1 - lam * lam) * rng.n(0, 1)), t[2], t[3]); }
  function drawBatter(rng, o) {
    o = o || {};
    var T = TRAITS, pb = !!o.pitcher;
    var ath = pb ? undefined : drawT(rng, T.athletic);   // his athleticism, first: power, arm and speed are drawn on it
    var r = rng.u(), style = rng.n(0, 1);
    var bats = o.bats || (pb ? (r < 0.72 ? 'R' : r < 0.95 ? 'L' : 'S') : (r < 0.55 ? 'R' : r < 0.90 ? 'L' : 'S'));
    var h = drawT(rng, T.heightIn);
    // the power chain: body -> swing power, swing length, bat -> bat speed, collision efficiency, precision
    var w = clamp(T.weightLb[0] + 5.25 * (h - 72) + rng.n(0, T.weightLb[1]), T.weightLb[2], T.weightLb[3]);
    var armIdx = drawT(rng, T.armIdx);
    var swingLen = clamp(T.swingLenFt[0] + 0.047 * (h - 72) + T.swingLenFt[1] * (STYLE.swingLen * style + Math.sqrt(1 - STYLE.swingLen * STYLE.swingLen) * rng.n(0, 1)), T.swingLenFt[2], T.swingLenFt[3]);
    var bat = batOf(clamp(T.batOz[0] + 0.012 * (w - 206) + rng.n(0, T.batOz[1]), T.batOz[2], T.batOz[3]), 34);
    var power = swingPowerOf(rng, w, ath);
    var batSpeed = pb ? drawT(rng, T.pBatSpeed) : batSpeedOf(power, w, swingLen, bat);   // pitchers at the plate keep their own weak draw
    var motor = drawT(rng, pb ? T.pBarrelSD : T.motorIn);
    var b = {
      id: nextId++, name: o.name || '', bats: bats, heightIn: h, isPitcher: pb, athletic: ath,
      weightLb: w, armIdx: armIdx, swingLenFt: swingLen, bat: bat, swingPower: power, motorIn: motor,
      batSpeed: batSpeed,
      attack:   pb ? drawT(rng, T.pAttack) : styled(rng, T.attack, style, STYLE.attack),
      undercut: drawT(rng, T.undercut),
      timingSD: drawT(rng, pb ? T.pTimingSD : T.timingSD),
      barrelSD: pb ? motor : motor * Math.pow(batSpeed / 72, 2),   // a harder swing is a less precise one (impulse variability: error ∝ force ∝ v^2)
      longSD:   drawT(rng, T.longSD),
      spotIn:   drawT(rng, pb ? T.pSpotIn : T.spotIn),
      eyeSD:    drawT(rng, pb ? T.pEyeSD : T.eyeSD),
      aggr:     drawT(rng, T.aggr),
      commit:   drawT(rng, T.commit),
      fbLean:   drawT(rng, T.fbLean),
      pullBias: styled(rng, T.pullBias, style, STYLE.pullBias),
      learn:    drawT(rng, T.learn),
      style:    style,
      coverage: drawT(rng, T.coverage) * armIdx,   // longer arms cover more plate
      // rulebook zone from height: bottom at the hollow of the knee, top
      // midway between belt and shoulders (Statcast averages 1.6 / 3.4 ft)
      zone: { bot: 0.263 * h * IN, top: 0.559 * h * IN }
    };
    b.swingTilt = drawT(rng, T.swingTilt);   // drawn last, so every earlier draw keeps its place
    b.faceSD = drawT(rng, T.faceSD);
    if (o.pos === 'C') b.framing = drawT(rng, T.framing);
    return equipFielder(rng, b, o.pos || 'DH');
  }

  // THE FARM (v1.8). The major leagues are the top of a much larger pool, and
  // selection shapes who is there: a hitter who swings softly AND misses a lot
  // does not get there, which by itself makes the survivors' bat speed and
  // whiffs go together (Berkson's paradox), and the player below average in
  // everything is rare. Each roster spot goes to the best of FARM_N candidates
  // drawn from the population, as the scouts judge them: HITTER_VALUE, the
  // expected wOBA the engine itself gives each trait (tools/hitter_value.js,
  // a regression over population hitters each facing 300 plate appearances),
  // with SCOUT_SD of judgement error (set by hand). FARM_N = 6: each major
  // leaguer is the best of six draws, so the majors are an extreme-value
  // sample of the pro pool (Joe's choice; an organisation's six levels, the
  // majors down to rookie ball, hold roughly a roster each). The population
  // (TRAITS) is the pro pool, fitted so that the chosen ones' measured traits
  // are the league's (tools/fit_population.js). LEVELS: the candidates are
  // ranked by the scouts' judgement and the k-th best plays at level k
  // (o.level; 1 the majors, the default), so the minors are the same pool's
  // lower order statistics - a prediction to test against Triple-A.
  var FARM_N = 6, SCOUT_SD = 0.015;
  // ---- HITTER_VALUE: printed by tools/hitter_value.js ----
  // the mean of three fits on engine v2.4 (seeds 5, 7, 9; 1,500 hitters x 300 PA each, familiarity as in games; R2 .68-.69 against their expected wOBA)
  var HITTER_VALUE = { c0: -0.0996, w: { batSpeed: 0.009266, heightIn: -0.0004589, motorIn: -0.04250, timingSD: -0.002781, longSD: -0.01294, faceSD: -0.001518, undercut: 0.004967, attack: -0.001126, swingTilt: 0.001409, pullBias: -0.001880, coverage: 0.001440, spotIn: -0.005781, eyeSD: -0.02356, aggr: -0.09209, commit: 0.01640, fbLean: 0.0003493, learn: 0.04212 } };
  // ---- HITTER_VALUE: end ----
  function hitterValue(B) { var v = HITTER_VALUE.c0; for (var k in HITTER_VALUE.w) v += HITTER_VALUE.w[k] * B[k]; return v; }
  // DEFENCE (v2.1). A position player is judged by his bat AND his glove, in
  // runs per game: his expected wOBA over 4.2 plate appearances (wOBA scale
  // 1.23), plus the runs his fielding saves over the 25 balls in play a team
  // allows (FIELD_VALUE: runs per ball in play against each fielding trait, at
  // his position, measured by playing the engine's own balls in play through
  // him among average team-mates - tools/field_value.js). A designated hitter
  // and a catcher are judged by the bat alone (a catcher's framing and
  // throwing are not valued yet).
  // ---- FIELD_VALUE: printed by tools/field_value.js ----
  // one fit on engine v2.3 (seed 5; 3,000 balls in play x 400 test fielders per position; R2 .86-.97)
  var FIELD_VALUE = {
    '1B': { c0: 0.2612, w: { speed: -0.0002136, react: 0.02483, route: -0.02384, glove: 0.0002868, armMph: -3.47e-05, armAcc: 0.000136, transfer: 0.002145 } },
    '2B': { c0: 0.3131, w: { speed: -0.0004279, react: 0.028, route: -0.03526, glove: -0.03876, armMph: -0.000125, armAcc: 0.001905, transfer: 0.01329 } },
    'SS': { c0: 0.3611, w: { speed: -0.0008291, react: 0.06475, route: -0.07566, glove: -0.0539, armMph: -0.0002436, armAcc: 0.003034, transfer: 0.02231 } },
    '3B': { c0: 0.2974, w: { speed: -0.0002161, react: 0.02775, route: -0.02444, glove: -0.03722, armMph: -0.0001076, armAcc: 0.00265, transfer: 0.009896 } },
    'LF': { c0: 0.3853, w: { speed: -0.001999, react: 0.03254, route: -0.09693, glove: -0.0118, armMph: -9.988e-05, armAcc: 0.0007397, transfer: 0.00588 } },
    'CF': { c0: 0.4126, w: { speed: -0.002102, react: 0.03704, route: -0.1025, glove: -0.03252, armMph: -7.711e-05, armAcc: 0.0001257, transfer: 0.004709 } },
    'RF': { c0: 0.425, w: { speed: -0.002013, react: 0.02896, route: -0.09906, glove: -0.04268, armMph: -0.0001421, armAcc: 0.0001617, transfer: 0.00627 } }
  };
  // ---- FIELD_VALUE: end ----
  var PA_GAME = 4.2, WOBA_SCALE = 1.23, BIP_GAME = 25;
  function fieldValue(B, pos) {   // runs per ball in play he allows at this position (lower is better)
    var f = FIELD_VALUE[pos]; if (!f) return 0;
    var v = f.c0; for (var k in f.w) v += f.w[k] * B[k]; return v;
  }
  function playerValue(B, pos) { return hitterValue(B) * PA_GAME / WOBA_SCALE - (FIELD_VALUE[pos] ? fieldValue(B, pos) * BIP_GAME : 0); }   // runs per game, up to a constant
  var LINEUP = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'];
  function makeBatter(rng, o) {
    o = o || {};
    if (o.pitcher || o.population) return drawBatter(rng, o);   // a pitcher batting was chosen for his arm
    if (!o.pos) o = { pos: LINEUP[Math.floor(rng.u() * 9)], level: o.level };   // no position asked: a major leaguer at any position of a lineup
    var C = [];
    for (var i = 0; i < FARM_N; i++) { var c = drawBatter(rng, o); c.scouted = playerValue(c, o.pos) + rng.n(0, SCOUT_SD * PA_GAME / WOBA_SCALE); C.push(c); }
    C.sort(function (a, b) { return b.scouted - a.scouted; });
    return C[Math.min(FARM_N, o.level || 1) - 1];
  }
  // Pitchers too: each staff spot goes to the best of FARM_N candidates of
  // his role, as the scouts judge them - PITCHER_VALUE, the expected wOBA
  // against that the engine gives each pitcher's traits (tools/pitcher_value.js),
  // with SCOUT_SD of judgement error. Lower is better.
  // ---- PITCHER_VALUE: printed by tools/pitcher_value.js ----
  // the mean of three fits on engine v2.4 (seeds 5, 7, 9; 1,000 pitchers x 300 PA; R2 .24-.29: 300 batters are mostly
  // luck, and these features catch about half the rest - command most, then speed; see CALIBRATION v1.8 and v2.2)
  var PITCHER_VALUE = { c0: 0.2920, w: { fbVelo: -0.0008665, spinZ: 0.0007459, cmdX: 0.01298, cmdZ: 0.007677, armAngle: -0.00007871, ext: -0.003677, relHt: -0.0001349, nPitches: 0.001373, starter: -0.007115, stamina: 0.000008560, rpmDev: -0.002480, effDev: -0.002818, tiltDev: -0.0001460, rpmOdd: 0.0003902, effOdd: -0.004069, tiltOdd: -0.006699, seamBreak: -0.005435, speedGap: -0.00007956 } };
  // ---- PITCHER_VALUE: end ----
  // WHAT THE SCOUTS SEE (v2.8): besides speed, command, slot and release, what
  // each of his pitches does against its type as the league throws it - the
  // batter pictures every pitch from the league's shape, so a pitch whose spin,
  // spin efficiency or direction is unusual (in sd of the type, usage-weighted,
  // signed and as a size), or whose seams move it more, plays up - and the
  // speed gap off his fastball, his role and stamina (shapes judged
  // against the league's at his slot, as the batter now pictures them). With these the
  // estimate saw 39% of the pool's true differences in expected wOBA allowed
  // (split halves, 4,200 pitchers x 400 PA), where the first eight features saw
  // 18-20%: unusual direction counted most (11 points of wOBA per sd), then
  // command, speed and seam break. Squares and products added nothing.
  // The mix itself (mixBR, mixOS) is computed but not judged: repertoires are
  // drawn from the major leaguers' measured mixes, and with it in the estimate
  // the farm chose breaking-ball pitchers (the major leaguers' breaking share
  // .356 against the league's .320) because the model's batters miss breaking
  // balls in the zone too often - it selected for the engine's flaw.
  var PITCHER_FEATURES = ['fbVelo', 'spinZ', 'cmdX', 'cmdZ', 'armAngle', 'ext', 'relHt', 'nPitches', 'starter', 'stamina',
                          'rpmDev', 'effDev', 'tiltDev', 'rpmOdd', 'effOdd', 'tiltOdd', 'seamBreak', 'speedGap'];
  function pitcherFeatures(P) {
    var f = { fbVelo: P.fbVelo, spinZ: P.spinZ, cmdX: P.cmd[0], cmdZ: P.cmd[1], armAngle: P.armAngle, ext: P.rel.ext, relHt: P.rel.ht, nPitches: P.pitches.length,
              starter: P.role === 'SP' ? 1 : 0, stamina: P.stamina, mixBR: 0, mixOS: 0, rpmDev: 0, effDev: 0, tiltDev: 0, rpmOdd: 0, effOdd: 0, tiltOdd: 0, seamBreak: 0, speedGap: 0 };
    var off = 0;
    P.pitches.forEach(function (q) {
      var d = PITCH_TYPES[q.type], u = q.usage, r = (q.rpm - d.rpm) / d.rpmSD, e = (q.eff - d.eff * (1 + d.effArm * (P.armAngle - ARM_MEAN))) / d.effSD, t = (q.tilt - d.tilt - d.tiltArm * (P.armAngle - ARM_MEAN)) / d.tiltSD;   // against the league's shape at his slot
      if (d.kind === 'BR') f.mixBR += u; else if (d.kind === 'OS') f.mixOS += u;
      f.rpmDev += u * r; f.effDev += u * e; f.tiltDev += u * t; f.rpmOdd += u * Math.abs(r); f.effOdd += u * Math.abs(e); f.tiltOdd += u * Math.abs(t);
      f.seamBreak += u * Math.sqrt(q.seam[0] * q.seam[0] + q.seam[1] * q.seam[1]);
      if (d.kind !== 'FB') { f.speedGap += u * (P.fbVelo - q.velo); off += u; }
    });
    if (off) f.speedGap /= off;
    return f;
  }
  function pitcherValue(P) { var f = pitcherFeatures(P), v = PITCHER_VALUE.c0; for (var k in PITCHER_VALUE.w) v += PITCHER_VALUE.w[k] * f[k]; return v; }
  function makePitcher(rng, o) {
    o = o || {};
    if (o.population) return drawPitcher(rng, o);
    var C = [];
    for (var i = 0; i < FARM_N; i++) { var c = drawPitcher(rng, o); c.scouted = pitcherValue(c) + rng.n(0, SCOUT_SD); C.push(c); }
    C.sort(function (a, b) { return a.scouted - b.scouted; });
    return C[Math.min(FARM_N, o.level || 1) - 1];
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
  // What a pitcher throws and where he aims it, as the league's pitchers do
  // (v1.4, statcast/locations.py, 42 days of 2025). He picks a pitch from his
  // usage, weighted by how the league uses that type against this side of
  // batter and that kind of pitch in this count. Each type has the league's
  // aim point against same- and opposite-side batters; the count moves it
  // (with two strikes breaking balls go lower and farther away, fastballs
  // higher); his own habits move it a little more, and within a count his
  // target still varies a little (the spread left once his command is taken
  // out of his scatter). His command then scatters the pitch about the target,
  // and command, measured from 3-0 four-seamers, is most of a pitch's distance
  // from where it was aimed: 7-8 in per axis, a mean miss of about 10 in.
  // ---- PLAN_LOC: written by statcast/locations.py; do not edit by hand ----
  // 2025, 42 days of pitch-level Statcast. aim: league mean location by type and side of batter, [in toward
  // his arm side, share of the zone height]; shift: the count's move from it, by kind and side; spread: sd of
  // his targets within a count with his command taken out, by kind; habit: sd between pitchers of their own
  // aim for a type; sideUse: use of a type against same / opposite-side batters over its share; countUse:
  // use of fastballs, breaking balls, off-speed by count over their share against that side; repeat: the
  // chance of the same type again after a change / after two alike, over what usage predicts.
  var PLAN_LOC = {
    aim: {'FF':{'same':[-1.9,0.666],'opp':[1.5,0.706]},'SI':{'same':[1.8,0.427],'opp':[1.7,0.471]},'FC':{'same':[-5.7,0.419],'opp':[-2.2,0.546]},'SL':{'same':[-6.6,0.177],'opp':[-1.5,0.185]},'ST':{'same':[-7.8,0.205],'opp':[-0.2,0.245]},'CU':{'same':[-4.6,0.102],'opp':[0.4,0.127]},'CH':{'same':[0.3,0.082],'opp':[5.6,0.137]},'FS':{'same':[0.6,0.031],'opp':[4.3,0.095]}},
    shift: {'FB':{'same':{'0-0':[0.0,-0.018],'0-1':[0.2,-0.007],'0-2':[-1.3,0.183],'1-0':[0.5,-0.039],'1-1':[0.2,-0.014],'1-2':[-1.2,0.112],'2-0':[0.4,-0.041],'2-1':[0.5,-0.046],'2-2':[-0.5,0.028],'3-0':[0.5,-0.055],'3-1':[0.5,-0.047],'3-2':[0.5,-0.038]},'opp':{'0-0':[0.3,-0.053],'0-1':[-0.5,0.051],'0-2':[1.0,0.253],'1-0':[-0.1,-0.075],'1-1':[-0.7,0.002],'1-2':[0.2,0.15],'2-0':[0.6,-0.081],'2-1':[-0.2,-0.052],'2-2':[-0.5,0.06],'3-0':[0.7,-0.068],'3-1':[0.5,-0.07],'3-2':[-0.4,-0.081]}},'BR':{'same':{'0-0':[1.8,0.108],'0-1':[-0.6,-0.033],'0-2':[-4.2,-0.185],'1-0':[1.8,0.081],'1-1':[0.5,0.018],'1-2':[-2.9,-0.135],'2-0':[2.4,0.074],'2-1':[2.1,0.078],'2-2':[-0.6,-0.032],'3-0':[0.4,0.023],'3-1':[1.7,0.05],'3-2':[2.2,0.059]},'opp':{'0-0':[1.1,0.127],'0-1':[0.2,-0.032],'0-2':[-2.1,-0.306],'1-0':[1.1,0.108],'1-1':[0.1,0.036],'1-2':[-1.6,-0.19],'2-0':[1.0,0.117],'2-1':[0.7,0.086],'2-2':[-1.1,-0.079],'3-0':[0.1,0.003],'3-1':[0.3,0.084],'3-2':[-0.1,0.054]}},'OS':{'same':{'0-0':[0.4,0.134],'0-1':[0.1,0.006],'0-2':[-0.6,-0.165],'1-0':[0.2,0.082],'1-1':[0.3,0.015],'1-2':[-0.5,-0.09],'2-0':[0.3,0.075],'2-1':[-0.2,0.04],'2-2':[0.2,-0.016],'3-0':[0.0,-0.003],'3-1':[0.2,0.04],'3-2':[0.0,0.059]},'opp':{'0-0':[-0.5,0.102],'0-1':[0.5,-0.043],'0-2':[2.5,-0.168],'1-0':[-1.0,0.066],'1-1':[-0.8,0.016],'1-2':[1.5,-0.091],'2-0':[-1.2,0.059],'2-1':[-1.0,0.077],'2-2':[-0.1,-0.04],'3-0':[-0.2,0.017],'3-1':[-0.7,0.074],'3-2':[-1.6,0.057]}}},
    spread: {'FB':{'0-0':[3.5,0.181],'0-1':[4.1,0.191],'0-2':[4.2,0.231],'1-0':[3.1,0.164],'1-1':[3.8,0.192],'1-2':[3.9,0.239],'2-0':[1.9,0.154],'2-1':[2.6,0.148],'2-2':[3.5,0.185],'3-0':[1.3,0.065],'3-1':[1.5,0.113],'3-2':[1.7,0.119]},'BR':{'0-0':[3.1,0.178],'0-1':[3.4,0.181],'0-2':[4.5,0.238],'1-0':[1.7,0.111],'1-1':[2.6,0.139],'1-2':[3.6,0.217],'2-0':[3.0,0.138],'2-1':[0.8,0.0],'2-2':[3.4,0.195],'3-0':[3.0,0.138],'3-1':[0.0,0.075],'3-2':[0.7,0.029]},'OS':{'0-0':[2.8,0.197],'0-1':[2.9,0.181],'0-2':[2.6,0.24],'1-0':[2.1,0.136],'1-1':[2.6,0.174],'1-2':[2.7,0.202],'2-0':[0.0,0.103],'2-1':[0.0,0.128],'2-2':[1.8,0.164],'3-0':[0.0,0.103],'3-1':[4.1,0.163],'3-2':[0.0,0.0]}},
    habit: {'FF':[1.6,0.104],'SI':[2.4,0.114],'FC':[2.1,0.173],'SL':[2.1,0.139],'ST':[1.9,0.117],'CU':[2.0,0.131],'CH':[1.9,0.11],'FS':[1.9,0.119]},
    sideUse: {'FF':[0.87,1.1],'SI':[1.4,0.67],'FC':[0.96,1.03],'SL':[1.29,0.76],'ST':[1.43,0.66],'CU':[0.71,1.24],'CH':[0.43,1.46],'FS':[0.72,1.23]},
    countUse: {'same':{'0-0':[1.12,0.92,0.44],'0-1':[0.91,1.14,1.02],'0-2':[0.7,1.35,1.58],'1-0':[1.13,0.84,0.76],'1-1':[0.92,1.08,1.24],'1-2':[0.75,1.26,1.7],'2-0':[1.3,0.61,0.56],'2-1':[1.07,0.9,0.98],'2-2':[0.89,1.04,1.74],'3-0':[1.66,0.14,0.11],'3-1':[1.4,0.48,0.44],'3-2':[1.14,0.76,1.14]},'opp':{'0-0':[1.08,1.08,0.67],'0-1':[0.89,0.92,1.41],'0-2':[0.83,1.2,1.2],'1-0':[1.06,0.87,1.02],'1-1':[0.9,0.96,1.33],'1-2':[0.82,1.2,1.21],'2-0':[1.27,0.69,0.69],'2-1':[1.04,0.92,1.01],'2-2':[0.9,1.15,1.08],'3-0':[1.77,0.13,0.11],'3-1':[1.38,0.57,0.56],'3-2':[1.13,0.93,0.73]}},
    repeat: [1.13,0.98]
  };
  // ---- PLAN_LOC: end ----
  var KINDS = ['FB', 'BR', 'OS'];
  function sideKey(P, sb) { return sb === P.armSide ? 'same' : 'opp'; }   // right-on-right or left-on-left is 'same'

  // Weight on each of the pitcher's pitches before sampling. `last` is the
  // pitch types he just threw to this batter (null when a batter is
  // modelling him: a scouting report knows his count and platoon habits,
  // not his next sequence); the league throws the same pitch again a little
  // more often than its usage predicts after a change, as often after two alike.
  function typeWeights(P, sb, st, last) {
    var side = sideKey(P, sb), si = side === 'same' ? 0 : 1, cu = PLAN_LOC.countUse[side][st.balls + '-' + st.strikes];
    return P.pitches.map(function (pt) {
      var t = pt.type, m = pt.usage * PLAN_LOC.sideUse[t][si] * cu[KINDS.indexOf(PITCH_TYPES[t].kind)];
      if (last && last[0] === t) m *= last[1] === t ? PLAN_LOC.repeat[1] : PLAN_LOC.repeat[0];
      return m;
    });
  }

  // His target [x, z] in metres for pitch `pt`, and the centre and spread it is
  // drawn from. Positions in PLAN_LOC are inches toward his arm side and shares
  // of the batter's zone height.
  // PITCHING AROUND (v1.7): against a dangerous hitter he aims a little farther
  // from the middle of the zone, against a weak one a little nearer: every
  // target's distance from the zone's centre is scaled by 1 + AROUND per mph of
  // the hitter's bat speed above the league's average (71.2 mph: hitters' mean
  // over all their tracked swings, those seeing 400+ pitches, pitch-level 2025;
  // scouting knows it). AROUND was fitted so the zone rate falls with bat speed
  // as the league's did: 0.0038 per mph, r -.34 (see CALIBRATION v1.7).
  var AROUND = 0.021, BAT_REF = 71.2;
  // AIMING TO HIS COMMAND (v2.8): a wilder pitcher aims nearer the middle. In
  // the league, per pitcher, pitch type and batter side, the mean location's
  // distance from the zone's centre falls 0.29 in for each inch of scatter
  // about it (majors; Triple-A 0.31: statcast pitch-level 2025, 1,900 cells),
  // where the model's targets ignored command (slope about 0). Every target's
  // distance from the centre is scaled by 1 - AIM_CMD per inch his scatter
  // (the mean of his two command traits) is wider than CMD_REF, the major
  // leaguers' mean. AIM_CMD FITTED so the model's slope, measured the same
  // way, is the league's: 0.08 gave -0.25 and 0.10 -0.34 (six seeds, 300
  // pitchers each; a single seed scatters by 0.1).
  var AIM_CMD = 0.09, CMD_REF = 8.0;
  function targetFor(P, B, sb, pt, st, rng) {
    var side = sideKey(P, sb), c = st.balls + '-' + st.strikes, k = PITCH_TYPES[pt.type].kind;
    var a = PLAN_LOC.aim[pt.type][side], sh = PLAN_LOC.shift[k][side][c], sp = PLAN_LOC.spread[k][c], h = B.zone.top - B.zone.bot;
    var mx = a[0] + sh[0] + pt.habit[0], mz = a[1] + sh[1] + pt.habit[1];
    var xa = mx + rng.n(0, sp[0]), zf = mz + rng.n(0, sp[1]);
    var g = (B.isPitcher ? 1 : Math.max(0.5, 1 + AROUND * (B.batSpeed - BAT_REF)))   // how far out from the middle he works this hitter
          * Math.max(0.5, 1 - AIM_CMD * ((P.cmd[0] + P.cmd[1]) / 2 - CMD_REF));      // and as far as his command lets him
    xa *= g; zf = 0.5 + (zf - 0.5) * g; mx *= g; mz = 0.5 + (mz - 0.5) * g;
    return { target: [P.armSide * xa * IN, B.zone.bot + zf * h],
             centre: [P.armSide * mx * IN, B.zone.bot + mz * h], spread: [sp[0] * IN * g, sp[1] * h * g] };
  }

  // The intent, named from where he aims (for the screen; nothing downstream
  // reads it): ATTACK inside the zone by 2 in or more, EDGE within 2 in of the
  // edge either way, EXPAND farther out. intentProbs gives the chance of each
  // for the pitch he chose, from the spread his target was drawn from.
  var INTENTS = ['attack', 'edge', 'expand'], EDGE_BAND = 2 * IN;
  function boxP(c, s, lo, hi) { return Phi((hi - c) / s) - Phi((lo - c) / s); }
  function intentProbs(B, centre, spread) {
    var sx = Math.max(spread[0], 1e-4), sz = Math.max(spread[1], 1e-4), lo = B.zone.bot - BALL_R, hi = B.zone.top + BALL_R, m = EDGE_BAND;
    var inner = boxP(centre[0], sx, -ZONE_HALF + m, ZONE_HALF - m) * boxP(centre[1], sz, lo + m, hi - m);
    var outer = boxP(centre[0], sx, -ZONE_HALF - m, ZONE_HALF + m) * boxP(centre[1], sz, lo - m, hi + m);
    return [inner, outer - inner, 1 - outer];
  }
  function intentOf(B, t) {
    var lo = B.zone.bot - BALL_R, hi = B.zone.top + BALL_R, m = EDGE_BAND, ax = Math.abs(t[0]);
    if (ax <= ZONE_HALF - m && t[1] >= lo + m && t[1] <= hi - m) return 'attack';
    if (ax <= ZONE_HALF + m && t[1] >= lo - m && t[1] <= hi + m) return 'edge';
    return 'expand';
  }

  function planPitch(P, B, sb, st, rng) {
    var w = typeWeights(P, sb, st, st.last);
    var i = rng.pickW(w), pt = P.pitches[i], type = pt.type;
    var tg = targetFor(P, B, sb, pt, st, rng), intent = intentOf(B, tg.target);
    var why = [st.balls + '-' + st.strikes + ': ' + intent];
    if (sb === P.armSide) why.push('same-side hitter'); else why.push('opposite-side hitter');
    if (st.last.length && st.last[0] === type) why.push('repeats the ' + PITCH_TYPES[type].name);
    else if (st.last.length) why.push('off the ' + PITCH_TYPES[st.last[0]].name);
    return { intent: intent, intentP: intentProbs(B, tg.centre, tg.spread), probs: normalize(w), pick: i, type: type,
             target: tg.target, why: why };
  }

  // -------------------------------------------------------------- EXPECT
  // The batter's scouting-report picture of what comes next: the pitcher's
  // mix in this count to this side (his weights without his sequence). He sits on
  // the likeliest pitch, leaning to fastballs (being beaten by a fastball
  // costs more than being fooled by a slow one: he looks fastball and adjusts), and blends his timing
  // toward the mix by how much he hedges. With two strikes he hedges more.
  function expectPitch(B, P, sb, st) {
    var mix = normalize(typeWeights(P, sb, st, null));
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
  // At his stamina he has lost ~1.3 mph and ~4% of his command; at 1.15x
  // stamina, 3 mph and 10%. League starters lost 0.4 mph by pitches 76-90 of
  // a game (the model: about the same) and their four-seamers scattered no
  // more than in their first 25, within 4% (statcast/locations.py table 11);
  // managers take a tired pitcher out, so the league shows only the decline it lets happen.
  var FATIGUE_CMD = 0.1;
  function fatigueOf(P) {
    var s = P.stamina, x = (P.load - 0.7 * s) / (0.45 * s);
    return x <= 0 ? 0 : Math.min(1.5, x * x);
  }
  function releasePoint(P) { return [P.armSide * P.rel.side * FT, RUBBER_Y - P.rel.ext * FT, P.rel.ht * FT]; }

  function throwPitch(P, plan, env, rng) {
    var pt = P.pitches[plan.pick], f = fatigueOf(P);
    var velo = pt.velo - 3.0 * f, rpm = pt.rpm * (1 - 0.05 * f);
    var rel = releasePoint(P);
    var ideal = aim(rel, velo * MPH, rpm, pt.tilt, pt.eff, P.armSide, plan.target, env, pt.aimCache, pt.seam);
    var ty = PITCH_TYPES[pt.type], cmdIn = [P.cmd[0] * ty.cmd[0] * (1 + FATIGUE_CMD * f), P.cmd[1] * ty.cmd[1] * (1 + FATIGUE_CMD * f)];
    // command is his whole scatter at the plate about the target; the pitch-to-pitch speed, spin, seam and
    // release scatter below make up plateW of it, the release angle the rest
    var sx = Math.sqrt(Math.max(0, cmdIn[0] * cmdIn[0] - ty.plateW[0] * ty.plateW[0])) * IN / ideal.dist;   // as angles
    var sz = Math.sqrt(Math.max(0, cmdIn[1] * cmdIn[1] - ty.plateW[1] * ty.plateW[1])) * IN / ideal.dist;
    var yaw = ideal.yaw + rng.n(0, sx), pit = ideal.pit + rng.n(0, sz);
    var relA = [rel[0] + rng.n(0, 0.02), rel[1] + rng.n(0, 0.02), rel[2] + rng.n(0, 0.02)];
    // pitch to pitch: speed, spin and seam scatter as the league's pitchers show within a game
    var vA = (velo + rng.n(0, ty.veloW)) * MPH, rpmA = rpm * (1 + rng.n(0, ty.rpmW));
    var tiltA = pt.tilt + rng.n(0, 5), effA = clamp(pt.eff + rng.n(0, 0.03), 0.05, 1);
    var seamA = [pt.seam[0] + rng.n(0, ty.seamW[0]), pt.seam[1] + rng.n(0, ty.seamW[1])];
    var d = dirOf(yaw, pit), v0 = [d[0] * vA, d[1] * vA, d[2] * vA];
    var w0 = spinVector(d, rpmA, tiltA, effA, P.armSide);
    var fl = flyPitch(relA, v0, w0, env, false, seamA, P.armSide);
    return { type: pt.type, rel: relA, v0: v0, w0: w0, seam: seamA, armSide: P.armSide, mph: vA / MPH, rpm: rpmA, tilt: tiltA, eff: effA,
             fatigue: f, cmdIn: cmdIn, plate: { x: fl.x, z: fl.z, t: fl.t, v: fl.v, w: fl.w } };
  }

  // ---------------------------------------------------------------- READ
  // The pitch he is ready for: the one he is sitting on, pictured as a pitch
  // that exists - not an average of the pitcher's mix - at this pitcher's
  // speed for it, with the shape he pictures for that kind of pitch (see
  // pictured below), while his TIMING hedges toward the rest of the mix by
  // how little he commits (he starts the swing for the blended speed).
  // (Until v0.9 the picture itself was a blend, a hybrid that looked like no
  // real pitch: fastballs counted as surprises 43% of the time and were
  // whiffed .29-.37 against .17.)
  function ghostPitch(pitch, ex, P, env, rec, familiar) {       // rec: keep the path, for drawing
    var q = P.pitches[ex.guess], fl = pictured(pitch, P, q, familiar || 0, env, !!rec);
    return { x: fl.x, z: fl.z, t: fl.t * q.velo / ex.velo, path: fl.path };   // arrival as he has timed it: at the hedged speed
  }
  // RECOGNITION IS A YES/NO EVENT, WITH A SECOND LOOK. Either he picks the
  // pitch up before he commits (COMMIT_S before it reaches the plate - about
  // 24 ft out, where Baseball Prospectus measures pitch tunnels) or he is
  // fooled and launches the swing for the pitch he expected, having corrected
  // only the break he could SEE by then (which grows as time squared: tc^2 of
  // the ghost-vs-real gap). The swing then flies for STEER_S more before the
  // last look that can still change the barrel's path (the visuomotor delay). By that look more of the gap has shown itself (ts^2):
  //   picked up at commit:  he swings for the pitch it is, as he judges it
  //                         (see THE PRIOR'S PULL below)
  //   picked up late:       he redirects toward that same judgement, but the
  //                         barrel can move no more than STEER_IN after launch
  //   still fooled:         he extrapolates from the last look, so the gap that
  //                         develops after it (1 - ts^2) is left, and the
  //                         redirect is bounded the same way
  // TUNNELLING: the chance he is fooled falls with how far the real pitch
  // has already separated from the expected one at the look in question,
  //   pFooled = exp(-separation / spot)
  // `spot` is his trait (spotIn): the separation he needs to see, smaller =
  // better. It grows with time pressure (tp = 1 for a 94-mph fastball; a
  // faster pitch leaves less time to look) and shrinks with the pitches he
  // has seen from this pitcher today (`seen`, which a game weights to
  // include his dugout's view) - the mechanism the times-through-the-order
  // penalty should emerge from. A curveball that leaves the hand going up
  // has separated a long way by the commit point and is rarely missed; a
  // changeup that shares the fastball's tunnel is the one that fools him.
  // The pitch type he expected cannot fool him: he judges it as he judges
  // a pitch he has picked up (until v1.0 a right guess drew the yes/no
  // event like any other and was mostly judged 'fooled', which kept 60% of
  // the pitch's difference from its usual shape whatever his eye).
  // (v0.2 used a proportional misread, then a saturating one; both spread
  // contact evenly across the bat face and flattened the launch angles.)
  // STEER_S is the visuomotor delay: the last look that can still change the
  // barrel's path, the "last 150 ms" of the hitting literature (110 and 130 ms
  // were tried: whiffs fell to .17-.19 per swing and league K% to 16-20%).
  // STEER_IN is how far the barrel can be redirected after the swing launches
  // (late corrections of 5-10 cm are reported when the cue comes 150 ms out).
  // THE PRIOR'S PULL. Even a pitch he has picked up is judged partly from what
  // he expected, as a blend of what he sees and what he was ready for: the
  // share his expectation gets is pull = 1 / (1 + (prior spread / (eyeSD x
  // tp))^2), larger under time pressure and with a worse eye, smaller as he
  // gets used to the pitcher. It works differently for WHEN and for WHERE:
  //   when:   the swing's timing is committed early, so it stays pulled
  //           toward the pitch he expected. A batter ready for a fastball is
  //           early on a breaking ball he has recognised and meets it out
  //           front (pitch-level 2025: breaking balls and off-speed pitches
  //           were met 8 in further out front than fastballs, 35-36 in
  //           against 27-28). PRIOR_T is fitted to the 8 in.
  //   where:  the barrel's path is steered to the pitch he has recognised,
  //           but he predicts its last few feet from what that kind of pitch
  //           usually does - the league's shape for the type (turning toward
  //           this pitcher's own as he gets used to him) at this pitcher's
  //           speed - so a pitch that rides or drops more than its kind
  //           fools him by a share of the difference. A fastball arriving
  //           flatter than its height implies gets swung under (pitch-level
  //           2025: whiffs .14 to .28, squared-up .45 to .34 from the
  //           steepest to the flattest fifth). The prior's spread is the
  //           league's spread of the type's vertical break (ivbSD, pitch-level
  //           2025) times PRIOR_S. PRIOR_S = 1 would be an ideal observer
  //           whose eye at the plate is his zone judgement at the commit
  //           point (eyeSD); it gave whiffs of .36 per swing. PRIOR_S = 2.5
  //           (his judgement of where the ball ends up 2.5 times sharper)
  //           was FITTED to the flat-fastball table and the fastball whiffs.
  //           And a share RESID_S of the gap to the pitch he expected stays
  //           in his picture of where it will be: a recognised breaking ball
  //           is still met a little over. FITTED to the breaking-ball whiffs
  //           (.308) and the launch angles of low breaking balls against low
  //           fastballs (pitch-level 2025, 42 days: 7.8 against 1.8 deg);
  //           halved in v2.9 (0.07 -> 0.035), when VERT_MISS took over the
  //           topping that comes with any low pitch: within each band of
  //           height the league's breaking balls are met 7-9 deg lower than
  //           its fastballs, not the 15-20 the model had.
  // THE TUNNEL (v3.1). A breaking ball or a changeup shows the eye only TUNNEL_SEP of its separation from the
  // fastball path at the commit point: what has shown itself by then is a position, and a position is as easily a
  // fastball aimed lower as a pitch that is breaking - the curve that tells them apart has barely begun. With the
  // full geometric separation, 80% of breaking balls were picked up at the commit point, and they were swung at
  // .54 in the heart of the zone against the league's .71 and chased .05 far outside against .15-.21 (pitch-level
  // 2025), where the league chases breaking balls MORE than fastballs in every count. FITTED (class O, rough until
  // the joint fit) with the swing policy to the league's swings by count x pitch kind, breaking-ball whiffs and
  // strikeouts: 0.5. (Doubling every batter's spotIn instead, fastballs included, gave too many walks and too
  // many whiffs on changeups.)
  // DECIDING ON A PITCH HE HAS NOT PICKED UP (v3.1): his decision uses where the ball is at the commit point and
  // the curve of the pitch he expected (DIR_READ_DEC = 0 of its direction read), while the swing he has launched
  // still steers on what shows itself by the last look (DIR_READ). With half the direction read in the decision too,
  // a fooled batter judged a diving breaking ball most of the way to where it went, and seldom chased it.
  var COMMIT_S = 0.175, STEER_S = 0.15, STEER_IN = 3, PRIOR_T = 5.0, PRIOR_S = 2.5, RESID_S = 0.035, DIR_READ = 0.5, TUNNEL_SEP = 0.5, DIR_READ_DEC = 0;
  // THE RELEASE BEHIND HIS SHOULDER (v3.2, statcast/platoon.py). A same-side pitcher lets the ball go from the batter's
  // own side of his line of sight; an opposite-side pitcher from well in front of it. In the league (42 days of 2025,
  // batter and pitcher held fixed, pitch type held fixed) the batter's read worsens steadily as the release moves
  // behind his eye: by the release's angle psi toward his side (eye 1.8 ft from the plate's centre line, 0.7 ft in
  // front of the plate's point; + behind him), from an opposite-side release at -4 deg through a same-side one level
  // with his eye (0) to a sidearmer's (+1 to +2): whiffs per swing -.014, +.011, +.026, +.027 across the same-side
  // bands against the opposite-side reference, swings at strikes +.007, -.028, -.047, -.066, chases -.009, +.013,
  // +.028, +.070, exit speed -1.6, -2.3, -3.0, -3.1 mph; the opposite-side bands flat. The model's batter had read
  // every release alike, and the league's own same-side mix and aim (sinkers and sweepers in, changeups out) then made
  // him BETTER against his own side (+.025 of wOBA against the league's -.028). Three things follow the ramp
  // max(0, psi - psi0), centred on the league's mean of it over its matchups (PL.mean) so the average batter is the
  // one the traits were fitted to: (1) the read's noise - his pickup (spotIn), his judgement of a pitch he has picked
  // up and his eye at the decision (eyeSD), all through the same time-pressure term - grows by PL.read per degree,
  // FITTED to the league's whiff, chase and zone-swing steps (class O, rough until the joint fit); (2) his bat is
  // slower by PL.speed per degree and (3) his barrel sits higher on the ball by PL.over per degree, both MEASURED from
  // the league's bat tracking with batter, pitcher and pitch type held fixed (same-side swings -1.0 mph, launch minus
  // attack -2.8 deg, topped balls +.036, over a 3.1 deg difference in the ramp; 23 deg of launch per inch of barrel
  // height in this engine). The league's contact penalty is these two, not scatter: a scattered barrel bought weak
  // contact only with twice the league's whiffs.
  var PL = { read: 0.03, speed: 0.0045, over: 0.039, psi0: -3.0, mean: 1.593, eye: [1.8 * FT, 0.7 * FT] };
  function ramp(psi) { return Math.max(0, psi - PL.psi0) - PL.mean; }   // deg behind the start of the ramp, centred on the league's matchups
  function releaseAngle(B, pitch) {   // deg, + when the release sits toward the batter's own side of his line of sight
    var sbR = B.bats === 'R' ? -1 : B.bats === 'L' ? 1 : -pitch.armSide;
    return Math.atan2((pitch.rel[0] - sbR * PL.eye[0]) * sbR, pitch.rel[1] - PL.eye[1]) / DEG;
  }
  function readFactors(B, pitch, gh, ref, seen, same, rng, sameKind) {
    var T = pitch.plate.t, psi = releaseAngle(B, pitch), tp = 0.26 / Math.max(0.12, T - 0.15) * (1 + PL.read * ramp(psi));
    var tc = Math.max(0, T - COMMIT_S) / T, ts = Math.max(0, T - STEER_S) / T;
    var dx = gh.x - pitch.plate.x, dz = gh.z - pitch.plate.z, gap = Math.sqrt(dx * dx + dz * dz);
    var sep = gap * tc * tc * (PITCH_TYPES[pitch.type].kind === 'FB' ? 1 : TUNNEL_SEP);
    var spot = B.spotIn * IN * tp * (1 - B.learn * (1 - Math.exp(-(seen || 0) / 40)));
    var pFooled = Math.exp(-sep / spot);
    // the pitch he expected cannot fool him: he judges it as he would any pitch he has picked up. LOOKING FASTBALL
    // (v2.2): sitting on a fastball, his eye is ready for any of the pitcher's fastballs (he tracks a sinker he did
    // not guess as well as the four-seamer he did) - but he is HUNTING only the one he guessed, so the swing decision
    // still counts another fastball he did not pick up by its gap as the pitch he sat on, and one he did as another
    var u = rng.u(), detectedD = same || u >= pFooled, detected = detectedD || !!sameKind;
    var late = !detected && rng.u() >= Math.exp(-gap * ts * ts / spot);
    var eye = B.eyeSD * tp * (1 - B.learn * (1 - Math.exp(-(seen || 0) / 40)));   // in: how unsure his judgement of this pitch is
    var pullT = 1 / (1 + (PRIOR_T / eye) * (PRIOR_T / eye));
    var ps = PRIOR_S * (PITCH_TYPES[pitch.type].ivbSD || 4), pullS = 1 / (1 + (ps / eye) * (ps / eye));
    var real = [pitch.plate.x, pitch.plate.z, pitch.plate.t];
    var judged = [pullS * (ref.x - real[0]) + RESID_S * (gh.x - real[0]), pullS * (ref.z - real[1]) + RESID_S * (gh.z - real[1]), pullT * (gh.t - real[2])];   // how far off his judgement of a recognised pitch is
    // What is left of the gap when he extrapolates from a look at a share f of
    // the flight. Across and up and down he reads where the ball is, f^2 of the
    // gap, and a share DIR_READ of the direction it is travelling, 2f(1 - f) of
    // it, so 1 - f^2 - DIR_READ 2f(1 - f) is left, with the expected pitch's
    // curve assumed from there. DIR_READ = 1 (v1.3-v2.1) left only the curve
    // still to come, (1 - f)^2, and a fooled breaking ball then missed the bat
    // by a couple of inches where the league's misses run to a foot (breaking
    // balls swung through: 3.0 in at the median, 11.8 at the 90th percentile;
    // statcast/misses.py). DIR_READ 0.5 was FITTED with the other v2.2
    // constants to the league's misses by pitch kind and by reach, and the
    // whiffs by pitch kind and strikeouts in games. Its speed
    // toward him he reads far worse, so his timing keeps the arrival he
    // expected, corrected only for what had shown itself (1 - f^2).
    function leftS(f) { return 1 - f * f - DIR_READ * 2 * f * (1 - f); }
    var g3 = [gh.x - real[0], gh.z - real[1], gh.t - real[2]], err = judged, lastPic = judged, launchedS = leftS(tc), launchedT = 1 - tc * tc;
    var base = [launchedS * g3[0], launchedS * g3[1], launchedT * g3[2]];   // the pitch he expected, corrected for what had shown itself by the commit point
    var lsDec = 1 - tc * tc - DIR_READ_DEC * 2 * tc * (1 - tc), baseDec = [lsDec * g3[0], lsDec * g3[1], launchedT * g3[2]];   // the same, as his decision judges it
    if (!detected) {   // he launched on the pitch he expected
      // late: he steers toward his judgement; fooled: only by what has shown itself by the last look
      var lastS = leftS(ts), lastT = 1 - ts * ts;
      var target = late ? judged : [lastS * g3[0], lastS * g3[1], lastT * g3[2]]; lastPic = target;
      var cx = target[0] - base[0], cz = target[1] - base[1], cm = Math.sqrt(cx * cx + cz * cz), k = cm > STEER_IN * IN ? STEER_IN * IN / cm : 1;
      err = [base[0] + k * cx, base[1] + k * cz, base[2] + k * (target[2] - base[2])];
    }
    return { tp: tp, psi: psi, sep: sep, pFooled: pFooled, detected: detected, detectedD: detectedD, late: late, lastPic: lastPic, same: !!same, pullT: pullT, pullS: pullS, err: err, base: base, baseDec: baseDec };
  }
  function misreadOf(rf) { return rf.err; }   // [x m, z m, t s]: how far off his judgement is, judged minus real
  // A pitch of one kind as he pictures it: from this release, along this
  // first direction, at this pitcher's speed for it (velocity he knows), with
  // the shape of that kind of pitch as the league throws it, turned a share
  // `familiar` toward this pitcher's own as he gets used to him, spin and
  // seam break alike. A batter's picture of a fastball is the league's
  // fastball, so a pitcher whose fastball rides more than most gets it swung
  // under.
  // HE READS THE SLOT (v2.8): the shape he starts from is the league's for
  // that kind of pitch FROM THIS ARM SLOT - its tilt and spin efficiency
  // turned by the slot as the league's are (tiltArm, effArm) - since he sees
  // the arm at release. Until v2.8 he pictured the league's average shape
  // whatever the slot, so a slot's ordinary movement fooled him like real
  // deception, unusual direction became a pitcher's strongest trait (11 points
  // of wOBA per sd), and the farm, once it could see it, picked extreme slots:
  // the major leaguers' arm angles spread 12.5 deg and level 2's 10.9, where
  // the league's majors and Triple-A spread alike (12.9 and 12.4).
  function pictured(pitch, P, own, familiar, env, rec) {
    var d = PITCH_TYPES[own.type], dir = unit(pitch.v0), v = own.velo * MPH, k = familiar;
    var t0 = d.tilt + d.tiltArm * (P.armAngle - ARM_MEAN), e0 = d.eff * (1 + d.effArm * (P.armAngle - ARM_MEAN));   // the league's shape at his slot
    var w = spinVector(dir, d.rpm + k * (own.rpm - d.rpm), t0 + k * (own.tilt - t0), e0 + k * (own.eff - e0), P.armSide);
    var seam = own.seam ? [k * own.seam[0], k * own.seam[1]] : null;   // the league's pitches average no seam break
    return flyPitch(pitch.rel, [dir[0] * v, dir[1] * v, dir[2] * v], w, env, rec, seam, P.armSide);
  }
  function typicalPitch(pitch, P, familiar, env) {   // the kind of pitch it really is, as he pictures it
    var own = P.pitches.filter(function (q) { return q.type === pitch.type; })[0] || { type: pitch.type, velo: pitch.mph, rpm: PITCH_TYPES[pitch.type].rpm, tilt: PITCH_TYPES[pitch.type].tilt, eff: PITCH_TYPES[pitch.type].eff };
    var fl = pictured(pitch, P, own, familiar, env, false);
    return { x: fl.x, z: fl.z, t: fl.t };
  }

  // -------------------------------------------------------------- DECIDE
  // THE SWING POLICY. He decides at the commit point, on what he could see by
  // then: a pitch already picked up, as he judges it (THE PRIOR'S PULL); one
  // not yet picked up, where the ball has got to on the curve of the pitch he
  // expected (rf.baseDec, v3.1: no read of its direction yet); then his eye's scatter
  // (eyeSD, larger under time pressure). From that he judges his chance it is
  // a strike (pin) and swings when it passes his threshold for the count,
  // less his aggression. The threshold also depends on his read: 'on' when it
  // is the pitch he was sitting on, or one he has not told apart from it;
  // 'off' when he has recognised something else, which early in the count he
  // mostly lets go. SWING_THR is [on, off] per count, FITTED to the league's
  // swing probability by distance from the zone edge in each count and pitch
  // kind (v3.1: statcast/swing_count_kind.py; tools/fit_swing_policy.js v0.5;
  // the 'off' read costs swings only in hitters' counts, as the league's
  // breaking balls in the zone are taken more than fastballs only there). A swing
  // policy, not a bet: the league's batters swing more in hitters' counts than
  // the next pitch's run value pays for (discipline.py table 6).
  var SWING_THR = {
    '0-0': [0.59, 0.75], '0-1': [0.30, 0.31], '0-2': [0.14, 0.14], '1-0': [0.50, 0.51], '1-1': [0.29, 0.29], '1-2': [0.14, 0.14],
    '2-0': [0.48, 0.71], '2-1': [0.27, 0.27], '2-2': [0.14, 0.14], '3-0': [0.92, 0.94], '3-1': [0.32, 0.53], '3-2': [0.14, 0.14]
  };
  function decide(B, pitch, gh, rf, st, rng) {
    var m = rf.detected ? rf.err : rf.baseDec, mx = m[0], mz = m[1];   // a pitch not yet picked up: where it is, on the curve he expected (v3.1)
    var eye = B.eyeSD * IN * rf.tp;
    var xp = pitch.plate.x + mx + rng.n(0, eye), zp = pitch.plate.z + mz + rng.n(0, eye);
    var pin = Phi((ZONE_HALF - Math.abs(xp)) / eye) * Phi((zp - (B.zone.bot - BALL_R)) / eye) * Phi((B.zone.top + BALL_R - zp) / eye);
    var state = rf.detectedD && !rf.same ? 'off' : 'on';
    var thr = SWING_THR[st.balls + '-' + st.strikes][state === 'on' ? 0 : 1] - B.aggr;
    return { swing: pin > thr, pin: pin, thr: thr, state: state, perceived: [xp, zp], misread: [mx, mz] };
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
  // The reach also costs bat speed (BAT_LOC, below, v3.0).
  function reachOf(B, x, z) {
    var ox = Math.max(0, Math.abs(x) - ZONE_HALF);
    var oz = Math.max(0, B.zone.bot - BALL_R - z, z - B.zone.top - BALL_R);
    return Math.sqrt(ox * ox + oz * oz);
  }
  // How hard he swings by the count. FITTED so the model's bat speed by count
  // follows the league's (pitch-level 2025, 42 days: fastballs 72.0 mph ahead,
  // 70.5 even or behind, 68.9 with two strikes); part of the two-strike drop
  // already comes from his wider hedge, which the adjusted swing pays for.
  var SWING_EFFORT = { ahead: 1.017, even: 1.0, two: 0.982 };
  var ADJ_PER_MS = 0.0014;   // share of his bat speed lost per ms of timing he closes by altering the swing
  var SWING_NORM = 0.961;    // the average of effort x adjustment x location over the league's swings, MEASURED from the model (v3.0, seeds 3, 11, 29; 0.978 before the location surface)
  // WHERE THE BAT IS FASTEST (v3.0). A swing is quickest where it is built to go - a little below the middle of his
  // zone and over the plate - and slows as a pitch pulls it away: up (the hands lift and the swing flattens), away
  // (the arms reach) and in (the hands crowd). In the league each hitter's bat speed, about his own mean, ran from
  // +2 mph low over the plate to -3.5 to -6 above the zone and -4 well away (pitch-level 2025, 72,476 swings of 50+
  // mph, the count held fixed), where the model's barely moved (-0.6 above, -0.8 away). MEASURED: a quadratic surface
  // in height h (share of his zone) and a, inches away from the plate's centre over 10 (+ away from him), fitted to
  // the league's swings as a share of each hitter's mean; its peak is at 0.23 of the zone. Clamped where the league's
  // swings are thick (beyond, a quadratic runs away from the thin data: 8+ in outside it gave -7.7 mph against -5.0).
  var BAT_LOC = { h: 0.0386, h2: -0.0849, a: -0.0172, a2: -0.0203, ah: 0.0203 };
  function batLoc(B, x, z, sb) {
    var h = clamp((z - B.zone.bot) / (B.zone.top - B.zone.bot), -0.5, 1.5), a = clamp(-x * sb / IN / 10, -1.5, 1.8);   // where the league's swings are thick
    return 1 + BAT_LOC.h * h + BAT_LOC.h2 * h * h + BAT_LOC.a * a + BAT_LOC.a2 * a * a + BAT_LOC.ah * a * h;
  }
  // SWING TO SWING (v2.4). Beyond the count and the adjusted swing, his effort
  // varies from swing to swing: his bat speed times exp(N(0, EFFORT_SD)). And
  // at his last look (STEER_S out), the farther off the zone his picture now
  // puts the pitch, the likelier he tries to check - never inside CHECK_IN[0],
  // always beyond CHECK_IN[1], in proportion between: he holds up HOLD_P of the
  // time (a take), else the bat comes through slowed by a share of CHECK_SLOW.
  // The league's swings, each against the hitter's own mean bat speed
  // (pitch-level 2025, 52,434 swings): sd 7.5 mph, median +1.4, 5% more than
  // 11 mph below, 1% more than 35 below - a core about 4.3 mph wide and a tail
  // of checked and half swings. FITTED to that distribution (the model's came
  // to sd 7.1, median +0.9, p5 -8.9, p1 -33.6). The effort does not change his
  // precision: within a hitter, harder swings do not miss more (v1.9).
  // ONLY SOMETHING NEW (v2.7): the last look is 25 ms after the commit, so a pitch he had already
  // picked up shows him nothing he did not decide on - he cannot check it. Only a pitch he had not
  // picked up can surprise him: a fooled one by what its curve has shown by the last look, one he
  // picks up late by his judgement. Until v2.7 every swing was judged again at the last look,
  // without the eye's error the decision carried, and that undid the swings far off the plate his
  // eye had misjudged (9+ in outside at 0-0: .00-.02 of pitches against the league's .04-.06).
  // With only the new looks the slow-swing tail fell to 1.6% of swings more than 10 mph under his
  // mean (league 5.7%); the constants, refitted under this rule, reach 3.1% only if nobody ever
  // holds up, so they are left as fitted in v2.4 and the rest of the tail is an open question.
  var EFFORT_SD = 0.05, CHECK_IN = [2, 8], HOLD_P = 0.5, CHECK_SLOW = [0.05, 0.6];
  function checkChance(B, rf, pitch) {   // the chance he tries to check: nothing new to see once he had picked it up (v2.7)
    if (rf.detected) return 0;
    return clamp((reachOf(B, pitch.plate.x + rf.lastPic[0], pitch.plate.z + rf.lastPic[1]) / IN - CHECK_IN[0]) / (CHECK_IN[1] - CHECK_IN[0]), 0, 1);
  }
  function effortGroup(st) { return st.strikes === 2 ? 'two' : st.balls > st.strikes ? 'ahead' : 'even'; }
  function swing(B, pitch, gh, rf, sb, st, rng, check) {
    var reach = reachOf(B, pitch.plate.x, pitch.plate.z);
    var prot = (st.strikes === 2 ? 0.85 : 1)   // a shorter two-strike swing: less scatter, less speed
             * (1 + reach / (B.coverage * IN));
    var behind = ramp(rf.psi);                  // THE RELEASE BEHIND HIS SHOULDER: the swing he makes at a pitch he sees less well (below)
    var m = misreadOf(rf);
    // THE ADJUSTED SWING. He planned his swing for the pitch he expected,
    // arriving when he timed it (the ghost). Whatever part of the gap between
    // that plan and the real arrival he closes - waiting on a slower pitch
    // than he timed, or hurrying for a faster one - he closes by altering the
    // swing, and it costs bat speed: ADJ_PER_MS of his speed per ms closed,
    // FITTED to the league's bat speed on breaking and off-speed pitches
    // against fastballs met at the same depth (pitch-level 2025, 42 days: about
    // 2 mph slower). The pitch he sat on and got is met with his full swing.
    var adjMs = Math.max(0, Math.abs(gh.t - pitch.plate.t) - Math.abs(m[2])) * 1000;
    var e = -m[2] + rng.n(0, B.timingSD / 1000 * prot * pitch.plate.t / FLIGHT_REF);    // + = bat early (he expected it sooner); scatter grows with the flight he is timing
    var D = -m[1] + B.undercut * IN + rng.n(0, B.barrelSD * IN * prot)   // + = ball above the barrel
          + VERT_MISS * (pitch.plate.z - (B.zone.bot + B.zone.top) / 2)    // the barrel falls short of the pitch's height away from the middle of his zone
          - PL.over * IN * behind;                                          // and sits higher on a ball released behind his shoulder (the league's launch minus attack, -2.8 deg same-side)
    var xAim = pitch.plate.x + m[0];
    var dLong = (pitch.plate.x - xAim) * (-sb) + rng.n(0, B.longSD * IN * prot)   // + toward the tip
              - pitch.plate.x * sb * HAND_MISS - AIM_HANDS * IN;   // what the hands did not cover (jammed inside, toward the end outside), and his aim inside the ball
    // His effort follows the count (SWING_EFFORT), and an adjusted swing is
    // slower; SWING_NORM keeps his average over his swings at his bat speed
    // trait, which is what the leaderboard measures.
    var batMph = B.batSpeed * SWING_EFFORT[effortGroup(st)] * Math.max(0.7, 1 - ADJ_PER_MS * adjMs) * batLoc(B, pitch.plate.x, pitch.plate.z, sb) / SWING_NORM * Math.exp(rng.n(0, EFFORT_SD)) * (1 - (check || 0))   // a checked swing comes through slowed
               * (1 - PL.speed * behind);   // and a swing at a pitch released behind his shoulder is slower (the league's bat speed, -1.0 mph same-side)
    var attack = B.attack + rng.n(0, 3);
    var face = rng.n(0, (B.faceSD || TRAITS.faceSD[0]) * DEG * prot);   // the face's own horizontal scatter: hooks and slices, not misses
    // WHERE ON THE ARC HE MEETS IT. Spray comes from how far round the arc
    // the ball is met (pitch-level 2025: the bat's direction of travel turned
    // 1.46 deg per inch of contact depth, r .83, and the ball's spray followed
    // depth, r .40; at a given depth, what was left of the bat's direction
    // barely moved the ball, r .09). So he PLANS to meet an inside pitch a
    // little out front and an outside one a little deep (LOC_DEPTH), turns the
    // face to pull an inside pitch (LOC_FACE; the face, not the path - see
    // FACE_PATH), and a pull hitter meets
    // everything a little out front (pullBias). Timing then moves the actual
    // contact from the plan: an early bat meets the ball s = v_bat e v_pitch /
    // (v_bat + v_pitch) further out, s / SWING_R further round the circle.
    // From the angle round the arc: the bat faces the pull side by cos(tilt)
    // of it (spray), and its path rises by sin(tilt) of it away from his
    // usual contact point, where his attack angle trait and his full bat
    // speed belong. The timing error alone moves the strike up or down the
    // ball, because out there the ball has yet to descend (higher by
    // s tan(descent)) while the barrel rises along its planned path (higher
    // by s tan(attack)): a path steeper than the pitch tops a ball met out
    // front and gets under one met deep. The arc's own curve does not add to
    // that, because a batter keeps the barrel on the pitch's line through the
    // zone (pitch-level 2025: launch angle minus attack angle went steadily
    // from +20 deg on contact met deep to -12 deg out front, which is the
    // attack-against-descent term alone). Met deep, the barrel is slower:
    // it is still gathering speed, and keeps gathering it until about 9 in out
    // front of his usual point (pitch-level 2025, full swings: 69.0 mph at
    // 10-20 in of depth, 71.8 at 25-30, 73.2 at 35-40). The speed lost goes as
    // the path he is short of that point, as a share of his swing length, to
    // the power BAT_GAIN_EXP; his bat speed trait is the leaderboard's
    // average over his contact, which sits 1.5% below the peak.
    var tilt = clamp((B.swingTilt || TRAITS.swingTilt[0]) - TILT_PER_H * ((pitch.plate.z - B.zone.bot) / (B.zone.top - B.zone.bot) - 0.5), 8, 55);
    var vb = batMph * MPH, vp = norm(pitch.plate.v), descent = Math.atan2(-pitch.plate.v[2], -pitch.plate.v[1]), tr = tilt * DEG;
    var sFwd = vb * e * vp / (vb + vp);
    var inside = pitch.plate.x * sb;   // m toward the batter from the middle of the plate
    var phiUsual = B.pullBias * DEG / Math.cos(tr), phiPlan = phiUsual + LOC_DEPTH * inside / SWING_R, phi = phiPlan + sFwd / SWING_R;
    var theta = sb * (phi * Math.cos(tr)), faceTh = theta + sb * (LOC_FACE * inside + FACE_PATH * DEG) + face;   // the path, and the face that sends the ball
    var attackPlan = attack + (phiPlan - phiUsual) * Math.sin(tr) / DEG, attackAt = attack + (phi - phiUsual) * Math.sin(tr) / DEG;
    D += sFwd * (Math.tan(descent) - Math.tan(attackPlan * DEG));
    var depth = (phi - phiUsual) * SWING_R;   // m out front of his usual contact point
    var batAt = batMph * 1.015 * Math.pow(Math.max(0.2, 1 - Math.max(0, BAT_PEAK_M - depth) / ((B.swingLenFt || TRAITS.swingLenFt[0]) * FT)), BAT_GAIN_EXP);
    var bat = B.bat || BAT_DEFAULT;
    var sw = { e: e, D: D, dLong: dLong, theta: theta, faceTh: faceTh, check: check || 0, batMph: batMph, batAt: batAt, adjMs: adjMs, attack: attack, attackAt: attackAt, tilt: tilt, side: sb,
               sFwd: sFwd, depth: depth, reach: reach, contact: false, why: '',
               bat: bat, qSweet: bat.q };   // his bat, and its collision efficiency at the sweet spot
    if (dLong > (TIP_IN + BAT_CAP_IN) * IN) { sw.why = 'off the end'; return sw; }   // past the end, unless the ball still catches the rounded cap
    if (dLong < HANDLE_IN * IN) { sw.why = 'inside the hands'; return sw; }
    if (Math.abs(D) >= BALL_R + batRadius(bat, SWEET_IN - dLong / IN)) { sw.why = D > 0 ? 'under' : 'over'; return sw; }   // the barrel is thinner toward the hands
    if (Math.abs(theta) > 80 * DEG) { sw.why = e > 0 ? 'way early' : 'way late'; return sw; }
    sw.contact = true;
    return sw;
  }

  // The collision, in the frame of the bat's contact point. The barrel
  // moves along p (its direction and attack angle at contact) and points
  // away from the batter, tilted down by his swing tilt. n is the line of
  // centres: in the plane across the barrel, tilted from p by the vertical
  // offset D over the radius the barrel has where the ball meets it. Because
  // the barrel is tilted, that plane leans toward the tip: a ball struck
  // under its centre goes up and slices toward the tip side, one struck over
  // it goes down and hooks to the pull side. The ball's approach along n
  // reverses with the collision efficiency the bat shows at that point and
  // speed (qAt); friction brings the contact point toward rolling on the bat
  // (sphere, I = 0.4 m R^2), capped by Coulomb friction. Backspin, topspin
  // and sidespin all come out of the same impulse - including what the
  // pitch's own spin contributes.
  function collide(pitch, sw) {
    var bat = sw.bat || BAT_DEFAULT, xBar = SWEET_IN - sw.dLong / IN;   // in from the barrel end
    var al = (sw.attackAt !== undefined ? sw.attackAt : sw.attack) * DEG, th = sw.theta, tl = (sw.tilt || 0) * DEG, side = sw.side || -1;
    var p = [Math.sin(th) * Math.cos(al), Math.cos(th) * Math.cos(al), Math.sin(al)];   // bat path: the barrel's velocity
    var thf = sw.faceTh !== undefined ? sw.faceTh : th, pf = [Math.sin(thf) * Math.cos(al), Math.cos(thf) * Math.cos(al), Math.sin(al)];   // the face: square to the barrel
    var tipH = [-side * Math.cos(thf), side * Math.sin(thf), 0];                         // toward the tip, level
    var up = cross(tipH, pf); if (up[2] < 0) up = [-up[0], -up[1], -up[2]];
    up = unit(up);
    var tip = unit([Math.cos(tl) * tipH[0] - Math.sin(tl) * up[0], Math.cos(tl) * tipH[1] - Math.sin(tl) * up[1], Math.cos(tl) * tipH[2] - Math.sin(tl) * up[2]]);   // the barrel, dipped toward its end
    var q = unit(cross(pf, tip));
    if (q[2] < 0) q = [-q[0], -q[1], -q[2]];
    var s = sw.D / (BALL_R + batRadius(bat, xBar)), c = Math.sqrt(Math.max(0, 1 - s * s));
    var n = [c * pf[0] + s * q[0], c * pf[1] + s * q[1], c * pf[2] + s * q[2]];   // the contact normal, from the face
    var vb = (sw.batAt || sw.batMph) * MPH * (1 + sw.dLong / (30 * IN));
    var V = [p[0] * vb, p[1] * vb, p[2] * vb];
    var vin = pitch.plate.v, win = pitch.plate.w;
    var u = [vin[0] - V[0], vin[1] - V[1], vin[2] - V[2]];
    var un = dot(u, n);
    if (un >= 0) return null;                  // the bat never closes on the ball
    var qe = qAt(bat, xBar, -un);
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
             landing: [fl.x, fl.y], landZ: fl.z, landV: fl.v, landW: fl.w, landT: fl.t,
             dist: r / FT, projDist: proj / FT, hang: fl.t, apex: fl.apex / FT, path: fl.path };
  }

  // --------------------------------------------------- one plate appearance
  // g = { env, ump, framing, seen (pitches of this pitcher already read), runnersOn, rec,
  //       foulCatch (optional: bb -> true when the defence catches a foul pop),
  //       beforePitch (optional: st -> anything the running game wants noted on the pitch;
  //                    {abort:true} when the bases ended the inning before it),
  //       afterPitch (optional: (rec, end) -> {abort:true} when the bases ended the
  //                   inning mid-count; `end` names how this pitch ends the PA, or null) }
  // A PA ended from the bases returns result 'END': no plate appearance is charged.
  function simPA(P, B, g, rng) {
    var sb = batterSide(B, P);
    var st = { balls: 0, strikes: 0, last: [] };
    var log = [], seen = g.seen || 0;
    for (;;) {
      var before = g.beforePitch ? g.beforePitch(st) : null;
      if (before && before.abort) return { result: 'END', pitches: log };   // the bases ended the inning before this pitch (a pickoff)
      var plan = planPitch(P, B, sb, st, rng);
      var ex = expectPitch(B, P, sb, st);
      var pitch = throwPitch(P, plan, g.env, rng);
      var familiar = B.learn * (1 - Math.exp(-(seen || 0) / 40));   // how far he has got used to this pitcher's shapes
      var gh = ghostPitch(pitch, ex, P, g.env, false, familiar);
      var ref = typicalPitch(pitch, P, familiar, g.env);
      var rf = readFactors(B, pitch, gh, ref, seen, P.pitches[ex.guess].type === pitch.type, rng, PITCH_TYPES[ex.guessType].kind === 'FB' && PITCH_TYPES[pitch.type].kind === 'FB');
      var rec = { count: st.balls + '-' + st.strikes, plan: plan, expect: ex, pitch: pitch, ghost: gh, read: rf, familiar: familiar,
                  inZone: inZone(B, pitch.plate.x, pitch.plate.z), side: sb };
      var res, xs = pitch.plate.x * sb, z = pitch.plate.z;
      if (xs > HBP_X && z > 0.25 && z < 1.75 && rng.u() < 0.65) res = 'hbp';
      else {
        var dec = decide(B, pitch, gh, rf, st, rng), check = 0;
        if (dec.swing && rng.u() < checkChance(B, rf, pitch)) {   // a pitch he had not picked up, which his last look puts off the plate: he tries to hold up
          if (rng.u() < HOLD_P) { dec.swing = false; dec.checked = true; }
          else check = CHECK_SLOW[0] + (CHECK_SLOW[1] - CHECK_SLOW[0]) * rng.u();
        }
        rec.decide = dec;
        if (!dec.swing) {
          var call = callPitch(g.ump, g.framing, B, sb, pitch.plate.x, pitch.plate.z, st.balls, st.strikes, rng);
          rec.call = call;
          res = call.strike ? 'called_strike' : 'ball';
        } else {
          var sw = swing(B, pitch, gh, rf, sb, st, rng, check);
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
    version: '3.3',
    SWING: { R: SWING_R, tiltPerH: TILT_PER_H },
    units: { MPH: MPH, FT: FT, IN: IN, RPM: RPM, DEG: DEG },
    geometry: { Y_PLATE: Y_PLATE, PLATE_HALF: PLATE_HALF, ZONE_HALF: ZONE_HALF, RUBBER_Y: RUBBER_Y, BALL_R: BALL_R },
    PITCH_TYPES: PITCH_TYPES, REPERTOIRES: REPERTOIRES, TRAITS: TRAITS, AERO: AERO,
    makeRng: makeRng, makeEnv: makeEnv, mlbEnv: mlbEnv, MLB_PARKS: MLB_PARKS, fenceAt: fenceAt,
    makePitcher: makePitcher, PITCHER_FEATURES: PITCHER_FEATURES, makeBatter: makeBatter, ATHLETIC: ATHLETIC, drawBatter: drawBatter, hitterValue: hitterValue, fieldValue: fieldValue, playerValue: playerValue, FIELD_VALUE: FIELD_VALUE, STYLE: STYLE, drawPitcher: drawPitcher, pitcherValue: pitcherValue, pitcherFeatures: pitcherFeatures, FARM_N: FARM_N, CHAIN: CHAIN, makeUmp: makeUmp, FACE_PATH: FACE_PATH, CHECK: { effortSD: EFFORT_SD, at: CHECK_IN, hold: HOLD_P, slow: CHECK_SLOW }, checkChance: checkChance, equipFielder: equipFielder, FIELD_MEANS: FIELD_MEANS,
    batOf: batOf, batSpeedOf: batSpeedOf, swingPowerOf: swingPowerOf,
    batMass: batMass, batRadius: batRadius, qAt: qAt, corOf: corOf, BAT_MODES: BAT_MODES, BAT_SHAPE: BAT_SHAPE, SWEET_IN: SWEET_IN, BAT_DEFAULT: BAT_DEFAULT,
    flyPitch: flyPitch, flyBatted: flyBatted, spinVector: spinVector, dirOf: dirOf, aim: aim, SWING_THR: SWING_THR, ZONE_HALF: ZONE_HALF, PLAN_LOC: PLAN_LOC,
    fatigueOf: fatigueOf, releasePoint: releasePoint, releaseAngle: releaseAngle, PL: PL, batterSide: batterSide, inZone: inZone,
    planPitch: planPitch, expectPitch: expectPitch, throwPitch: throwPitch, ghostPitch: ghostPitch,
    readFactors: readFactors, decide: decide, callPitch: callPitch, swing: swing, collide: collide,
    battedBall: battedBall, simPA: simPA
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BB;
