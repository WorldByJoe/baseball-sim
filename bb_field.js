/* ============================================================================
   bb_field.js · v0.7 · 2026-10-02

   The ball in play: fielders, throws and base runners, from the moment the
   engine's batted ball leaves the bat to the moment every runner is on a
   base, out, or across the plate. Pure and seeded like bb_engine.js.

   WHAT IS PHYSICS HERE
   - the ball's whole track: the engine's flight, a carom off the wall
     (radial component reflected and damped), bounces (restitution and
     friction differ on dirt and grass), then a roll that slows to a stop
     or reaches the fence
   - a fielder's motion: first-step delay, acceleration to his sprint
     speed, a route longer than the straight line by his route trait
   - a runner's motion: the same, from a standing start or a lead
   - a throw: a real ball flight at his arm speed, launched at the angle
     that reaches the receiver soonest (solved and cached); a long one
     goes through a cut-off man when that is quicker
   WHAT IS A DECISION RULE
   - who takes the ball (the fielder who can reach it first), whether he
     catches it (his margin of time, his glove), whether he fields a
     grounder cleanly (ball speed, ground covered, his glove, a bad hop)
   - where he throws: the out that is most likely and most valuable, a
     double play if the relay can beat the batter, or he holds the ball
   - how far each runner goes: as far as the throw cannot beat him by the
     margin he demands (his aggression), never past the runner ahead
   Everything the renderer needs to animate a play is in `events`, with
   times from contact.

   Not here yet: steals, wild pitches, pickoffs, the infield-fly rule,
   positioning for the situation (infield in, no-doubles); ground-rule
   doubles are approximate; the cut-off man is a timing rule, not a player.

   CHANGED
     v0.7  outfielders move as Statcast's jump shows, stand where the league's did, and
           catch as often as the league's by exit velocity and launch angle; bounces lose
           more the steeper they land (measured); runners read the race with error and are
           sent by the outs (fitted to extra bases taken); a runner thrown out on a clean
           hit to the outfield no longer costs the batter his hit
     v0.6  the running game: stealTime from a moving lead, a runner going with the
           pitch is 9 m down the line at contact (o.going); accessible() marks the
           foul ground a man can reach - foul pops in the seats are nobody's
     v0.5  a throw cannot arrive before the man covering that base does; on a
           fly ball a runner reads the catch chance - goes on contact when nobody
           will reach it, halfway when it might drop, holds on a routine fly (he
           used to wait at the bag on every fly and the batter caught him up)
     v0.4  unassisted putouts: the man who covers a base runs the ball there
           himself; a first baseman far off the bag throws to the pitcher covering
           and waits for him (Joe saw a throw to an empty bag). Events 'carry', 'cover'
     v0.3  a third-out catch carries its runner list too (every play has one shape)
============================================================================ */

var BBField = (function () {
  'use strict';
  var U = BB.units, FT = U.FT, MPH = U.MPH, DEG = U.DEG, RPM = U.RPM;
  var BALL_R = BB.geometry.BALL_R;
  var BASE = 90 * FT, H2 = BASE / Math.SQRT2;
  var BASES = [[0, 0], [H2, H2], [0, 2 * H2], [-H2, H2], [0, 0]];   // home, 1st, 2nd, 3rd, home again
  var REACH = 1.2;     // m: glove plus a dive
  // A fielder's acceleration and the react trait together reproduce Statcast's
  // average outfield JUMP: 33.9 ft covered toward the ball in the first 3 s
  // after the pitch is RELEASED (2025 leaderboard), about 2.6 s after contact:
  // 0.45 s to the first step, 5.5 m/s^2, a route 0.90 of straight gives 33.7 ft.
  // (Until v0.7 outfielders reacted in 0.70 s and accelerated at 3.5 m/s^2, set
  // to "30 ft in 3 s" counted from contact; they covered 18 ft in the jump's
  // window, and fly balls to 300-400 ft fell in twice as often as the league's.)
  var ACC_F = 5.5, ACC_R = 4.5;   // m/s^2 (a runner's 4.5 puts the average home-to-first at 4.4 s, Statcast's average; 5.5 was tried and inflated BABIP to .315)
  var REACH_GB = 1.5;  // m: a dive or full extension for a grounder
  var LEAD = 4.66;     // m: a runner's lead when the ball is hit: Statcast's average secondary lead, 15.3 ft (2025, runners on first)
  var TAG = 0.25;      // s: catch and apply a tag
  var SAFETY = 0.30;   // s: the margin a runner wants before taking second (plus his own runAggr)
  // Taking third or home: he and the coach read the race with READ_SD s of
  // error (set by hand) and send him when the read beats SAFETY_FAR for the
  // outs (plus his own runAggr), so a runner is sometimes thrown out and
  // sometimes held when he would have made it. SAFETY_FAR was fitted to how
  // often the league's runners took the extra base on a single or a double
  // with none, one and two out (statcast/baserunning.py): a runner on second
  // scored on a single .36 / .51 / .83 of the time, and .02-.03 were thrown out.
  var SAFETY_FAR = [0.6, 0.5, 0.2], READ_SD = 0.25;   // s, by outs
  // How sure a throw's arrival is: 0.15 s for an infield throw, and more the
  // longer it is beyond 40 m (footwork, a hop, the catcher moving for it); set
  // by hand, so runners are thrown out at third and home about as often as
  // the league's (1-5% of chances).
  var RACE_SD = 0.15, RACE_SD_M = 0.005;   // s, s per m beyond 40 m
  function raceSD(from, to) { return RACE_SD + RACE_SD_M * Math.max(0, dist(from, BASES[to]) - 40); }
  var PIVOT = 0.35;    // s: catch, pivot and release on a double-play relay
  var STD_AIR = BB.makeEnv({ fence: [9999, 9999, 9999, 9999, 9999] });

  function Phi(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function polar(rFt, aDeg) { var r = rFt * FT, a = aDeg * DEG; return [r * Math.sin(a), r * Math.cos(a)]; }
  function onDirt(x, y) {
    return Math.hypot(x, y) < 13 * FT ||
      (Math.hypot(x, y - 60.5 * FT) < 93 * FT && Math.abs(Math.atan2(x, y)) <= 50 * DEG);
  }

  // ------------------------------------------------------------ positions
  // Standard spots (ft from home, degrees from the centre-field line, + toward
  // right field). Infielders turn toward the hitter's pull side in proportion
  // to his pull bias (never past 40 degrees): pre-2023 rules, shifts allowed.
  // Outfielders stand where the league's did in 2025 (Statcast fielder
  // positioning, eight teams, every pitch): the pull-side corner 300 ft out at
  // 26 deg, the opposite corner 291 ft at 28 deg, centre 323 ft shaded 1.7 deg
  // toward the opposite field - they do NOT turn toward his pull side. Everyone
  // plays deeper for more bat speed (outfielders 3 ft per mph, set by hand so
  // the depth varies about as much as the league's, sd 9-12 ft).
  var STD = { P: [60.5, 0, 0], C: [-4.5, 0, 0], '1B': [110, 36, 0.2], '2B': [150, 15, 1.0], SS: [150, -13, 1.0], '3B': [115, -34, 0.8] };
  var OF_SPOT = { pull: [300, 26], oppo: [291, 28], CF: [323, -1.7] };   // ft, deg toward the pull side
  function positionDefense(D, batter, side) {
    var dv = batter.batSpeed - BB.TRAITS.batSpeed[0];
    D.forEach(function (F) {
      var s = STD[F.pos], spot;
      if (isOF(F.pos)) {
        spot = F.pos === 'CF' ? OF_SPOT.CF : (F.pos === 'LF') === (side < 0) ? OF_SPOT.pull : OF_SPOT.oppo;   // a right-handed hitter pulls to left
        var a = F.pos === 'CF' ? side * spot[1] : (F.pos === 'LF' ? -1 : 1) * spot[1];
        F.std = polar(spot[0], a);
        F.at = polar(spot[0] + 3 * dv, a);
        return;
      }
      var turn = side * Math.max(0, batter.pullBias) * s[2];
      var ang = s[2] ? Math.max(-40, Math.min(40, s[1] + turn)) : s[1];
      F.std = polar(s[0], s[1]);
      F.at = polar(s[0] + (s[2] ? 1.5 * dv : 0), ang);
    });
  }
  function makeDefense(players) {         // players: array of {pos, ...traits}
    return players.map(function (pl) { return { pos: pl.pos, pl: pl, at: [0, 0], std: [0, 0] }; });
  }

  // -------------------------------------------------------------- motion
  function isOF(pos) { return pos === 'LF' || pos === 'CF' || pos === 'RF'; }
  function moveTime(pl, d) {              // a fielder, from his first step
    var v = pl.speed * FT, a = ACC_F; d = Math.max(0, d) / pl.route;
    var t = d < v * v / (2 * a) ? Math.sqrt(2 * d / a) : v / (2 * a) + d / v;
    return pl.react + t;
  }
  function runTime(pl, d, standing) {     // a runner
    var v = pl.speed * FT; d = Math.max(0, d);
    var t = d < v * v / (2 * ACC_R) ? Math.sqrt(2 * d / ACC_R) : v / (2 * ACC_R) + d / v;
    return t + (standing ? 0.15 : 0.05);
  }

  // A steal starts from a moving secondary lead: he is already walking off
  // the bag at about 3 m/s when the pitcher commits to the plate.
  var LEAD_STEAL = 3.7, V_SECONDARY = 3.0;   // m, m/s
  // A runner who breaks on contact is shuffling at his secondary lead, slower
  // than a man walking off on a steal: V_CONTACT, fitted to the league's double
  // plays per game (the forced runner's race to second).
  var V_CONTACT = 1.5;   // m/s
  function stealTime(pl, d, v0) {
    var v = pl.speed * FT; v0 = v0 === undefined ? V_SECONDARY : v0;
    var dAcc = (v * v - v0 * v0) / (2 * ACC_R);
    return d < dAcc ? (Math.sqrt(v0 * v0 + 2 * ACC_R * d) - v0) / ACC_R : (v - v0) / ACC_R + (d - dAcc) / v;
  }
  // The part of foul ground a fielder can reach: in front of the backstop and
  // within a strip along each line that narrows from the plate to the poles,
  // with the dugouts cut out of it (16 to 24 m off the lines, 50 to 80 m out).
  // Anything else is in the seats.
  function accessible(x, y) {
    if (y < -18) return false;
    var ax = Math.abs(x);
    if (ax <= y) return true;                                     // fair
    var s = (ax + y) / Math.SQRT2, perp = (ax - y) / Math.SQRT2;  // along the line, and off it
    if (s > 105) return false;
    var w = s < 30 ? 18 : 18 - 14 * (s - 30) / 75;
    if (s > 50 && s < 80) w = Math.min(w, 15);
    return perp <= w;
  }

  // A throw is a real flight. For each (arm speed, distance) the launch
  // angle that brings the ball to a receiver's chest soonest is solved once
  // and cached; beyond his range the ball is lofted and bounces in.
  var THROW = {};
  function throwTime(mph, d) {
    if (d < 12) return d / (mph * MPH * 0.95) + 0.02;
    var key = Math.round(mph / 2) * 2 + ':' + Math.round(d / 2) * 2;
    if (THROW[key] !== undefined) return THROW[key];
    var v = mph * MPH;
    function reach(aDeg) {
      var a = aDeg * DEG, fl = BB.flyBatted([0, 0, 1.8], [0, v * Math.cos(a), v * Math.sin(a)], [1800 * RPM, 0, 0], STD_AIR, true);
      var P = fl.path;
      for (var i = 1; i < P.length; i++) if (P[i][3] <= 1.5 && P[i - 1][3] > 1.5) return { d: P[i][2], t: P[i][0] };
      return { d: fl.y, t: fl.t };
    }
    var far = reach(38), out;
    if (far.d < d) out = far.t + (d - far.d) / (v * 0.4);
    else {
      var lo = -4, hi = 38, r = far;
      for (var i = 0; i < 14; i++) { var m = (lo + hi) / 2; r = reach(m); if (r.d < d) lo = m; else hi = m; }
      out = r.t + 0.02;
    }
    THROW[key] = out;
    return out;
  }

  // A long outfield throw goes through a cut-off man: two shorter throws
  // beat one lofted one. The estimate every fielder and runner works from.
  var RELAY_FROM = 55, CUT = 35, RELAY_XFER = 0.45;   // m, m, s
  function throwArrival(F, from, to) {
    var d = dist(from, BASES[to]), direct = throwTime(F.pl.armMph, d);
    if (d <= RELAY_FROM) return direct;
    return Math.min(direct, throwTime(F.pl.armMph, d - CUT) + RELAY_XFER + throwTime(86, CUT));
  }

  // ---------------------------------------------------------- the track
  // A bounce: the ball keeps BOUNCE_E of its speed into the ground and
  // BOUNCE_KF of its speed along it, less BOUNCE_C times its speed into the
  // ground (the friction and the ploughing grow with how hard it lands), and
  // never less than BOUNCE_FLOOR. KF and C were fitted, with E held at 0.45 on
  // dirt and 0.35 on grass, to the share of speed a baseball kept bouncing off
  // a skinned infield (.57 at 25 deg, .49 at 35 deg) and natural grass (.44,
  // .32), measured at 31 and 40 m/s (Brosnan, McNitt & Schlossberg 2007, J.
  // Testing & Evaluation 35(6)). The floor is set by hand: steeper than those
  // tests, the friction would stop the ball dead. (Until v0.7 every bounce kept
  // 0.50 / 0.72 on dirt and 0.42 / 0.62 on grass whatever the angle: a hard
  // ball topped into the dirt hopped 60 ft high over the infield.)
  var BOUNCE_E = { dirt: 0.45, grass: 0.35 }, BOUNCE_KF = 0.76, BOUNCE_C = { dirt: 0.35, grass: 0.65 }, BOUNCE_FLOOR = 0.2;
  // Bounces and the roll after the ball comes down. Samples [t, x, y, z, speed].
  function groundTrack(x, y, vx, vy, vz, t0, env, out) {
    var t = t0, groundRule = false;
    for (var b = 0; b < 10; b++) {
      var srf = onDirt(x, y) ? 'dirt' : 'grass', vn = -vz, vh = Math.hypot(vx, vy);
      var kh = vh > 0 ? Math.max(BOUNCE_FLOOR, BOUNCE_KF - BOUNCE_C[srf] * vn / vh) : 0;
      vz = BOUNCE_E[srf] * vn; vx *= kh; vy *= kh;
      if (vz < 1.0) break;
      var fl = BB.flyBatted([x, y, BALL_R], [vx, vy, vz], [0, 0, 0], env, true);
      var vh = Math.hypot(vx, vy);
      fl.path.forEach(function (q, i) { if (i) out.push([t + q[0], q[1], q[2], q[3], vh]); });
      x = fl.x; y = fl.y; t += fl.t;
      if (fl.kind === 'over') { groundRule = true; vx = vy = vz = 0; break; }   // bounced over: ground-rule double
      vx = fl.v[0]; vy = fl.v[1]; vz = fl.v[2];
      if (fl.kind === 'wall') {                       // off the wall on a bounce
        var r = Math.hypot(x, y), nx = -x / r, ny = -y / r, vn = vx * nx + vy * ny;
        vx = (vx - 2 * vn * nx) * 0.45; vy = (vy - 2 * vn * ny) * 0.45; vz = -Math.abs(vz) * 0.5;
      }
    }
    var v = Math.hypot(vx, vy), ux = v > 0 ? vx / v : 0, uy = v > 0 ? vy / v : 1, dt = 0.02;
    while (v > 0.05 && t < t0 + 20) {
      var a = onDirt(x, y) ? 2.4 : 3.2;
      x += ux * v * dt; y += uy * v * dt; v = Math.max(0, v - a * dt); t += dt;
      var rr = Math.hypot(x, y), sp = Math.atan2(x, y) / DEG;
      if (Math.abs(sp) <= 45 && rr >= BB.fenceAt(env, sp)) { v *= 0.35; ux = -ux; uy = -uy; }
      out.push([t, x, y, 0, v]);
    }
    return { stop: [x, y], t: t, groundRule: groundRule };
  }
  function buildTrack(bb, env) {
    var T = { air: bb.path, land: { t: bb.landT, x: bb.landing[0], y: bb.landing[1], z: bb.landZ }, kind: bb.kind, ground: [] };
    var x = bb.landing[0], y = bb.landing[1], v = bb.landV, t = bb.landT;
    if (bb.kind === 'wall') {                          // carom, then fly on and come down
      var r = Math.hypot(x, y), nx = -x / r, ny = -y / r, vn = v[0] * nx + v[1] * ny;
      var vx = (v[0] - 2 * vn * nx) * 0.45, vy = (v[1] - 2 * vn * ny) * 0.45, vz = v[2] * 0.5, vh = Math.hypot(vx, vy);
      var fl = BB.flyBatted([x, y, bb.landZ], [vx, vy, vz], [0, 0, 0], env, true);
      fl.path.forEach(function (q, i) { if (i) T.ground.push([t + q[0], q[1], q[2], q[3], vh]); });
      x = fl.x; y = fl.y; v = fl.v; t += fl.t;
    }
    var end = groundTrack(x, y, v[0], v[1], v[2], t, env, T.ground);
    T.stop = end.stop; T.stopT = end.t; T.groundRule = end.groundRule;
    return T;
  }

  // ------------------------------------------------------ the fielders
  // Can he get under it? Margin = time to spare at the landing point. He has
  // an even chance when he gets there CATCH_SET s before the ball, with 0.2 s
  // of spread either way: fitted so balls in the air are caught as often as
  // the league's at each launch angle and exit velocity (statcast/bip.py,
  // headless/bip_check.js; 0.15 s, where -0.05 had been set by hand).
  var CATCH_SET = 0.15;
  function catchChance(F, T) {
    var L = T.land, m = L.t - moveTime(F.pl, dist(F.at, [L.x, L.y]) - REACH);
    if (T.kind === 'wall' && L.z > 2.6) return { m: m, p: 0 };
    return { m: m, p: Phi((m - CATCH_SET) / 0.2) * (1 - 0.6 * (1 - F.pl.glove)) };
  }
  // The first point on the ground track he can reach.
  function intercept(F, T) {
    var G = T.ground;
    for (var k = 0; k < G.length; k += 2) {
      var q = G[k]; if (q[3] > 2.0) continue;
      var d = dist(F.at, [q[1], q[2]]);
      if (moveTime(F.pl, d - (isOF(F.pos) ? REACH * 0.5 : REACH_GB)) <= q[0]) return { t: q[0], at: [q[1], q[2]], v: q[4], moved: d };
    }
    var last = G.length ? G[G.length - 1] : [T.land.t, T.land.x, T.land.y, 0, 0], d2 = dist(F.at, [last[1], last[2]]);
    return { t: Math.max(last[0], moveTime(F.pl, d2)), at: [last[1], last[2]], v: 0, moved: d2 };
  }
  // A grounder fielded cleanly? Harder when it is hot, when he had to move, on a bad hop.
  function cleanChance(F, ic) {
    var D = Math.pow(ic.v / 30, 2) + Math.pow(ic.moved / 10, 2);
    return F.pl.glove * Math.exp(-0.10 * D);
  }

  // ---------------------------------------------------------- the play
  // bases: [null, r1, r2, r3] players; returns what happened and how.
  function resolve(bb, batter, bases, outs, D, env, rng, o) {
    o = o || {};
    var ev = [], out = { outsMade: 0, runs: 0, rbi: 0, bases: [null, null, null, null], events: ev, error: false, hit: null,
                         type: bb.la < 10 ? 'GB' : bb.la < 25 ? 'LD' : bb.la < 50 ? 'FB' : 'PU', desc: '' };
    var R = [], b;
    for (b = 3; b >= 1; b--) if (bases[b]) R.push({ pl: bases[b], base: b, out: false, target: b, start: null, going: o.going === b });   // going: he broke with the pitch
    R.push({ pl: batter, base: 0, out: false, target: 0, start: 0.05 });
    // Who covers each base when `who` has the ball, and when that man can be
    // there: a throw cannot arrive before its receiver does (a first baseman
    // playing deep is late to the bag on a hot shot - Joe saw throws to an empty bag).
    function coverOf(to, who) { return { 1: '1B', 2: who === 'SS' ? '2B' : 'SS', 3: '3B', 4: 'C' }[to]; }
    function rcvArrival(to, who) { var Fr = D.filter(function (F) { return F.pos === coverOf(to, who); })[0]; return Fr ? moveTime(Fr.pl, dist(Fr.at, BASES[to])) + 0.1 : 0; }
    function forced(i) { for (var j = i; j < R.length; j++) if (R[j].base !== R[i].base - (j - i)) return false; return true; }
    function scoreRuns(thirdOutForce) {
      R.forEach(function (r) { if (!r.out && r.target >= 4 && !thirdOutForce) { out.runs++; } });
    }

    // HOME RUN
    if (bb.hr) {
      R.forEach(function (r) { r.target = 4; r.start = 0.05; });
      out.runs = R.length; out.rbi = R.length; out.hit = 'HR'; out.desc = 'home run, ' + Math.round(bb.projDist) + ' ft';
      ev.push({ t: bb.hang, kind: 'homer' });
      finish(); return out;
    }

    var T = buildTrack(bb, env), twoOut = outs === 2;

    // CATCH?
    var best = null;
    D.forEach(function (F) { var c = catchChance(F, T); if (!best || c.m > best.c.m) best = { F: F, c: c }; });
    var caught = o.foulCaught || (best.c.p > 0 && rng.u() < best.c.p);
    if (!caught && best.c.m > 0.6 && !o.foulCaught) {   // he was there and dropped it
      out.error = true; ev.push({ t: T.land.t, kind: 'drop', who: best.F.pos, at: [T.land.x, T.land.y] });
    }
    if (caught) {
      var F = best.F, tc = T.land.t, at = [T.land.x, T.land.y];
      ev.push({ t: tc, kind: 'catch', who: F.pos, at: at });
      R[R.length - 1].out = true; out.outsMade = 1;
      out.hit = 'OUT'; out.desc = (out.type === 'PU' ? 'pop out' : out.type === 'LD' ? 'line out' : 'fly out') + ' to ' + F.pos;
      if (outs + 1 >= 3) { out.desc += ', inning over'; finish(); return out; }
      // runners held; now they may tag up against this arm
      var tagging = [];
      R.slice(0, -1).forEach(function (r) {
        var to = r.base + 1, tRun = tc + runTime(r.pl, BASE, true);
        var tBall = Math.max(tc + F.pl.transfer + throwArrival(F, at, to), rcvArrival(to, F.pos)) + TAG;
        if (tRun + SAFETY + r.pl.runAggr < tBall && !tagging.some(function (q) { return q.to === to; })) tagging.push({ r: r, to: to, tRun: tRun, tBall: tBall });
      });
      if (tagging.length) {
        var play = null;
        tagging.forEach(function (q) { q.p = Phi((q.tRun - q.tBall) / 0.15) * (q.to === 4 ? 1.4 : 1); if (!play || q.p > play.p) play = q; });
        tagging.forEach(function (q) { q.r.target = q.to; q.r.start = tc; });
        if (play.p > 0.12) {
          ev.push({ t: tc + F.pl.transfer, kind: 'throw', who: F.pos, from: at, to: play.to, arrive: play.tBall, rcv: coverOf(play.to, F.pos) });
          if (rng.u() < Phi((play.tRun - play.tBall) / 0.15)) {
            play.r.out = true; out.outsMade++; out.desc += ', ' + baseName(play.to) + ' tag: out';
          } else out.desc += ', runner ' + (play.to === 4 ? 'scores' : 'to ' + baseName(play.to)) + ' on the tag';
        } else out.desc += ', runner ' + (play.r === tagging[0].r && play.to === 4 ? 'scores' : 'tags to ' + baseName(play.to));
      }
      R.forEach(function (r) { if (!r.out && r.target >= 4) { out.runs++; out.rbi++; } });
      if (out.runs && outs + out.outsMade < 3) out.hit = 'SF';
      finish(); return out;
    }

    // NOT CAUGHT: the ball is on the ground. Who fields it, when, how well.
    var ics = D.map(function (F) { return { F: F, ic: intercept(F, T) }; });
    ics.sort(function (a, b) { return a.ic.t - b.ic.t; });
    var Ff = ics[0].F, ic = ics[0].ic, tField = ic.t, fieldAt = ic.at;
    var landed = T.land.t, flyBall = out.type !== 'GB';
    // How the ball gets to a base from the man who fielded it. The man who
    // covers that base runs it there himself (the first baseman to first, any
    // man within a few steps of a bag); a first baseman far off the bag throws
    // to the pitcher covering, and waits for him; everyone else throws.
    var Pf = D.filter(function (F) { return F.pos === 'P'; })[0];
    function ballTo(to, t0, from) {
      var d = dist(from, BASES[to]), self = Ff.pos === coverOf(to, Ff.pos) || d < 3;
      if (self && (d < 12 || to !== 1)) return { t: t0 + 0.1 + moveTime(Ff.pl, d) - Ff.pl.react, how: 'run' };   // already moving; a step and a stretch
      if (to === 1 && Ff.pos === '1B' && Pf) return { t: Math.max(t0 + Ff.pl.transfer + throwArrival(Ff, from, to), moveTime(Pf.pl, dist(Pf.at, BASES[1])) + 0.2), how: 'cover' };
      return { t: Math.max(t0 + Ff.pl.transfer + throwArrival(Ff, from, to), rcvArrival(to, Ff.pos)), how: 'throw' };
    }
    var clean = rng.u() < cleanChance(Ff, ic) && !(onDirt(fieldAt[0], fieldAt[1]) && rng.u() < 0.01);
    ev.push({ t: tField, kind: clean ? 'field' : 'muff', who: Ff.pos, at: fieldAt });
    if (!clean) { tField += 1.2; }

    // when each runner leaves
    R.forEach(function (r, i) {
      if (r.base === 0) return;
      var isForced = forced(i);
      if (r.going) r.start = 0.05;                                       // already running with the pitch
      else if (twoOut || (!flyBall && isForced)) { r.start = 0.05; r.onContact = true; }   // goes on contact
      else if (!flyBall) {                                                // unforced on a grounder: read the ball
        var to = r.base + 1, tRun = 0.05 + runTime(r.pl, BASE - LEAD, false);
        var tBall = ballTo(to, ic.t, ic.at).t + TAG;
        r.start = tRun + SAFETY + r.pl.runAggr < tBall ? 0.05 : null;
      } else if (best.c.p < 0.3) r.start = 0.05;                          // a fly nobody will reach: goes on contact
      else if (best.c.p < 0.85) { r.start = landed; r.midway = true; }   // might drop: halfway, then reads it
      else r.start = landed;                                             // a routine fly: holds at the bag, ready to tag
    });
    function leadOf(r) { return r.going ? 9 : r.midway ? BASE / 2 : (r.base > 0 && r.start !== null && r.start < 0.5 ? LEAD : 0); }   // a man going with the pitch is 9 m down the line at contact
    // A man who breaks on contact - with two outs, or forced on a grounder - is
    // already moving off his secondary lead, as on a steal. With fewer than
    // two outs an unforced runner freezes at his lead to see the ball caught
    // or through, and starts from there at rest.
    function arrive(r, to) {
      var d = (to - r.base) * BASE - leadOf(r);
      if (r.base > 0 && r.start !== null && r.start < 0.5 && !r.midway && r.onContact) return r.start + stealTime(r.pl, d, V_CONTACT);
      return r.start + runTime(r.pl, d, (r.start >= 0.5 && !r.midway) || r.base === 0);
    }
    // how far each goes: lead runner first, nobody passes the man ahead
    var ahead = 5;
    R.forEach(function (r, i) {
      if (r.start === null) { r.target = r.base; ahead = r.base; return; }
      var to = r.base + 1;
      if (r.base === 0) to = 1;
      while (to + 1 < ahead && to < 4) {
        var next = to + 1, tRun = arrive(r, next);
        var tBall = ballTo(next, tField, fieldAt).t + TAG;
        if (next >= 3 ? tBall - tRun + rng.n(0, READ_SD) > SAFETY_FAR[Math.min(outs, 2)] + r.pl.runAggr : tRun + SAFETY + r.pl.runAggr < tBall) to = next; else break;
      }
      if (T.groundRule) to = Math.min(4, r.base + 2);
      r.target = Math.min(to, ahead - 1); ahead = r.target;
    });

    // the fielder's throw: the most likely, most valuable out
    var cands = [];
    R.forEach(function (r, i) {
      if (r.target <= r.base) return;
      var isForce = r.base === 0 ? true : (forced(i) && r.target === r.base + 1);
      var tRun = arrive(r, r.target), way = ballTo(r.target, tField, fieldAt);
      var tBall = way.t + (isForce ? 0 : TAG);
      var p = Phi((tRun - tBall) / raceSD(fieldAt, r.target)), w = p * (r.target === 4 ? 1.4 : 1), pRelay = 0;
      // the lead runner at second is worth going for only when it is a likely
      // out; then the relay's chance at the batter counts too (expected outs)
      if (isForce && r.target === 2 && r.base === 1 && outs < 2) {
        var bat = R[R.length - 1], t2 = tBall + PIVOT + throwTime(85, BASE);
        pRelay = Phi((arrive(bat, 1) - t2) / 0.15); w = p < 0.6 ? 0 : p * (1 + pRelay);
      }
      cands.push({ r: r, i: i, p: p, w: w, tRun: tRun, tBall: tBall, force: isForce, pRelay: pRelay, how: way.how });
    });
    cands.sort(function (a, b) { return b.w - a.w; });
    var play = cands.length && cands[0].p > 0.12 ? cands[0] : null;
    if (T.groundRule) play = null;
    if (play) {
      var to = play.r.target, d = dist(fieldAt, BASES[to]), err = 0;
      if (play.how === 'run') ev.push({ t: tField, kind: 'carry', who: Ff.pos, from: fieldAt, to: to, arrive: play.tBall });   // carries it to the bag: nothing to throw away ('run' is a run scoring)
      else {
        if (play.how === 'cover') ev.push({ t: 0.3, kind: 'cover', who: 'P', to: 1, arrive: play.tBall });
        err = Math.abs(rng.n(0, Ff.pl.armAcc * d / 40));
        ev.push({ t: tField + Ff.pl.transfer, kind: 'throw', who: Ff.pos, from: fieldAt, to: to, arrive: play.tBall, wild: err > 1.6, rcv: play.how === 'cover' ? 'P' : coverOf(to, Ff.pos) });
      }
      var via = play.how === 'run' ? Ff.pos + ' unassisted' : play.how === 'cover' ? Ff.pos + ' to the pitcher covering' : Ff.pos + ' to ' + baseName(to);
      if (err > 1.6) {                                   // thrown away: everyone moves up
        out.error = true;
        R.forEach(function (r) { if (r.target > r.base || r.base === 0) r.target = Math.min(4, r.target + 1); });
        out.desc = 'throwing error by ' + Ff.pos;
      } else if (rng.u() < play.p) {
        play.r.out = true; out.outsMade++;
        out.desc = play.r.base === 0 ? (out.type === 'GB' ? 'ground out, ' + via : 'out at ' + baseName(to) + ', ' + Ff.pos)
                                    : (play.force ? 'force out at ' : 'out at ') + baseName(to) + ', ' + Ff.pos + ' (runner from ' + baseName(play.r.base) + ')';
        // double play: force at second, relay to first
        var bat = R[R.length - 1];
        if (play.force && to === 2 && play.r.base === 1 && !bat.out && bat.target === 1 && outs + out.outsMade < 3) {
          var t2 = play.tBall + PIVOT + throwTime(85, BASE), p2 = Phi((arrive(bat, 1) - t2) / 0.15);
          ev.push({ t: play.tBall + PIVOT, kind: 'throw', who: 'relay', from: BASES[2], to: 1, arrive: t2, rcv: '1B' });
          if (rng.u() < p2) { bat.out = true; out.outsMade++; out.desc = 'double play, ' + Ff.pos + ' to second to first'; out.dp = true; }
          else out.desc += ', batter beats the relay';
        }
      } else out.desc = 'safe at ' + baseName(to) + ' ahead of the throw';
    } else out.desc = clean ? (Ff.pos + ' holds the ball') : 'muffed by ' + Ff.pos;

    // what it was
    // A runner retired by an infielder, or forced, makes it a fielder's choice;
    // a runner thrown out trying for an extra base on a clean hit to the
    // outfield leaves the batter his hit (until v0.7 that was scored a
    // fielder's choice, and the batter lost the hit).
    var batR = R[R.length - 1], runnerOut = R.some(function (r) { return r.out && r.base > 0; });
    var anyForceOut = runnerOut && (!isOF(Ff.pos) || (play && play.force));
    if (!batR.out) {
      var wouldBeOut = false;
      if (!clean || out.error) {                          // would a clean play have got him?
        var tB = ballTo(1, ic.t, ic.at).t;
        wouldBeOut = arrive(batR, 1) > tB + 0.1;
      }
      if (wouldBeOut) { out.hit = 'E'; out.error = true; out.desc = 'reaches on an error by ' + Ff.pos; }
      else if (anyForceOut) out.hit = 'FC';
      else out.hit = ['', '1B', '2B', '3B', 'HR'][batR.target];
      if (T.groundRule) out.desc = 'ground-rule double';
    } else out.hit = 'OUT';
    if (!out.desc || out.hit === '1B' || out.hit === '2B' || out.hit === '3B') {
      var where = Ff.pos, kind = out.type === 'GB' ? 'ground ball' : out.type === 'LD' ? 'line drive' : 'fly ball';
      out.desc = (out.hit === 'OUT' ? out.desc : (out.hit === '1B' ? 'single' : out.hit === '2B' ? 'double' : out.hit === '3B' ? 'triple' : out.hit === 'HR' ? 'inside-the-park home run' : out.desc) + ', ' + kind + ' to ' + where + (play && !play.r.out && play.r.base !== 0 ? ', ' + out.desc : ''));
    }
    // runs: none score if the third out is the batter or a force; on a tag play a run counts if it crossed first
    var third = outs + out.outsMade >= 3, thirdOutForce = third && (batR.out || (play && play.r.out && play.force));
    var tagAt = third && !thirdOutForce && play && play.r.out ? play.tBall : Infinity;
    R.forEach(function (r) { if (!r.out && r.target >= 4 && !thirdOutForce && arrive(r, 4) < tagAt) { out.runs++; if (!out.error && !out.dp) out.rbi++; } });
    finish();
    return out;

    function finish() {
      R.forEach(function (r) {
        if (r.out || r.target >= 4) return;
        out.bases[r.target] = r.pl;
        ev.push({ t: r.start === null ? 0 : arrive(r, r.target), kind: 'safe', who: r.pl.id, from: r.base, to: r.target });
      });
      R.forEach(function (r) { if (r.out) ev.push({ kind: 'out', who: r.pl.id, from: r.base, to: r.target }); if (!r.out && r.target >= 4) ev.push({ kind: 'run', who: r.pl.id }); });
      out.runners = R.map(function (r) { return { id: r.pl.id, from: r.base, to: r.target, out: r.out, start: r.start, lead: leadOf(r) }; });
      out.fielded = Ff ? { who: Ff.pos, t: tField, at: fieldAt } : null;
      out.track = typeof T !== 'undefined' ? T : null;
    }
    var Ff, tField, fieldAt;   // hoisted for finish() when the ball was caught
  }
  function baseName(b) { return ['home', 'first', 'second', 'third', 'home'][b]; }

  // Can the defence catch this foul pop? Called from simPA on every foul.
  function foulCatch(bb, D, env, rng) {
    if (!bb.path || bb.hang < 1.2 || !accessible(bb.landing[0], bb.landing[1])) return null;   // in the seats: nobody's
    var T = buildTrack(bb, env), best = null;
    D.forEach(function (F) { var c = catchChance(F, T); if (!best || c.m > best.c.m) best = { F: F, c: c }; });
    return best.c.p > 0 && rng.u() < best.c.p ? best : null;
  }

  return { version: '0.6', BASES: BASES, positionDefense: positionDefense, makeDefense: makeDefense,
           moveTime: moveTime, runTime: runTime, stealTime: stealTime, LEAD_STEAL: LEAD_STEAL, accessible: accessible,
           throwTime: throwTime, throwArrival: throwArrival, buildTrack: buildTrack,
           catchChance: catchChance, intercept: intercept, resolve: resolve, foulCatch: foulCatch, onDirt: onDirt };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBField;
