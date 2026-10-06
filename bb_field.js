/* ============================================================================
   bb_field.js · v1.10 · 2026-10-05

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
   - where he throws: the out worth the most runs (the league's run
     expectancy), a double play if the relay can beat the batter, or he
     holds the ball
   - how far each runner goes: as far as the throw cannot beat him by the
     margin he demands (his aggression), never past the runner ahead
   Everything the renderer needs to animate a play is in `events`, with
   times from contact.

   Not here yet: steals, wild pitches, pickoffs, the infield-fly rule, the
   outfield's no-doubles depth; ground-rule doubles are approximate; the
   cut-off man is a timing rule, not a player.

   CHANGED
     v1.10 a tag play that makes the third out counts a run only if it crossed the plate before the tag (a time
           play); the hurried throw of the last commit taken out again (recorded, not kept: the write-up)
     v1.9  a runner on base starting from a standstill runs the league's measured curve (Statcast's running splits:
           his speed rises as 1 - exp(-t / 0.78 s)): 90 ft in 4.11 s where he ran the batter's 4.40 s from the box;
           a fly the fielder was under and dropped puts the batter on by the error (rule 9.12), no longer a hit as well;
           the tag-up for third or home is a read, as a send on a hit is (READ_SD, SAFETY_3 and SAFETY_H by the outs
           after the catch, the throw's arrival as sure as raceSD): he went only when no throw could get him;
           the cut-off man's catch, turn and throw takes the double play's pivot (0.65 s, measured), not 0.45 s by hand;
           SAFETY_3 and SAFETY_H refitted to the league's sends and tag-ups together: [0.95, 0.95, 0.35], [0.8, 0.2, 0]
     v1.8  the infield stands where the league's did in 2025 (Savant's fielder positioning): by the batter's side,
           the first baseman holding a runner, double-play depth, the infield in with a man on third as the manager's
           call, and the 2023 rule (two infielders each side of second, all on the dirt);
           the second baseman covers second on a ball to third; a double play's relay goes to the man covering first;
           the throw goes for the out worth the most runs by the league's RE24 (it had counted outs, and took the lead
           runner on .13 of single outs with a man on first, the league .60);
           the pivot 0.65 s, fitted to the league's relay success once the force is made (was 0.35 s, by hand)
     v1.7  a force tried and thrown away is an error, not a fielder's choice (the bug audit): v1.5 had scored the
           batter a fielder's choice with nobody out when the throw to second got away
     v1.6  a batter thrown out past first base keeps the hit that got him there (rule 9.05; the bug audit): the play
           had been scored a plain out and the single lost - 0.2-0.3% of balls in play, three times the league's
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
  // error (set by hand) and send him when the read beats the margin for that
  // base and the outs (plus his own runAggr), so a runner is sometimes thrown
  // out and sometimes held when he would have made it. Third and home have
  // their own margins (v1.0): never make the first or third out at third
  // base, but risk the plate when a run is there, most of all with two out.
  // REFITTED (v1.9) once the tag-up read the race as a send does and the runner on base ran from a standstill on
  // the measured curve: one margin per base and outs for hits and tag-ups together - a tag-up uses the outs after
  // the catch, so SAFETY_H[1] serves one-out hits and none-out tags, [2] two-out hits and one-out tags. A sweep
  // of 1,000 games a setting (seed 7; xbt_check, mob_check) against the league's extra bases (statcast/
  // baserunning.py: a man on second scored on a single .36 / .51 / .83 with none, one and two out, a man on first
  // on a double .34 / .31 / .52, a man on first took third on a single .28 / .30 / .42) and tag-ups (statcast/
  // men_on_base.py: a man on third scored on a caught ball .65 / .62 with none and one out, out .00 / .03; a man
  // on second took third .21). Until v1.9 [0.75, 0.75, 0.35] and [0.7, 0.2, -0.4], fitted with bug A present
  // (the second runner never sent) and the tag-up on its own rule: the two-out double sent a man on first home
  // and lost him .12 of the time, the league .03.
  var SAFETY_3 = [0.95, 0.95, 0.35], SAFETY_H = [0.8, 0.2, 0.0], READ_SD = 0.25;   // s, by outs: taking third, going home
  // How sure a throw's arrival is: 0.15 s for an infield throw, and more the
  // longer it is beyond 40 m (footwork, a hop, the catcher moving for it); set
  // by hand, so runners are thrown out at third and home about as often as
  // the league's (1-5% of chances).
  var RACE_SD = 0.15, RACE_SD_M = 0.005;   // s, s per m beyond 40 m
  function raceSD(from, to) { return RACE_SD + RACE_SD_M * Math.max(0, dist(from, BASES[to]) - 40); }
  // The double-play pivot: the man covering second catches the force, crosses the bag and releases the relay. 0.65 s,
  // FITTED (v1.8) to how often the league's relay beat the batter once the force at second was made (statcast/
  // men_on_base.py, 42 days of 2025: .60 of the time, and .73 / .59 / .47 for slow, middling and fast batters; the
  // model .61 / .62 at seeds 3 / 11, and .76 / .58 / .49 by the batter's speed - the slope is the check, not fitted).
  // It was 0.35 s, set by hand while the infield played at its usual depth with a man on: at double-play depth that
  // relay beat the batter .90 of the time and double plays ran .61 of the chances against .40.
  var PIVOT = 0.65;    // s
  var STD_AIR = BB.makeEnv({ fence: [9999, 9999, 9999, 9999, 9999] });
  // The league's run expectancy to the end of the inning from each base-out state (statcast/runs_league.py, 42 days of
  // 2025), by outs and the bases as bits (first 1, second 2, third 4): what a fielder's throw is worth (v1.8).
  var RE24 = [[0.486, 0.898, 1.217, 1.650, 1.186, 1.746, 2.129, 2.888],
              [0.249, 0.515, 0.671, 0.960, 0.917, 1.119, 1.324, 1.591],
              [0.092, 0.203, 0.317, 0.461, 0.352, 0.403, 0.621, 0.754]];

  function Phi(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function polar(rFt, aDeg) { var r = rFt * FT, a = aDeg * DEG; return [r * Math.sin(a), r * Math.cos(a)]; }
  function onDirt(x, y) {
    return Math.hypot(x, y) < 13 * FT ||
      (Math.hypot(x, y - 60.5 * FT) < 93 * FT && Math.abs(Math.atan2(x, y)) <= 50 * DEG);
  }

  // ------------------------------------------------------------ positions
  // Spots are ft from home and degrees from the centre-field line, + toward
  // right field. Outfielders stand where the league's did in 2025 (Statcast
  // fielder positioning, eight teams, every pitch): the pull-side corner 300 ft
  // out at 26 deg, the opposite corner 291 ft at 28 deg, centre 323 ft shaded
  // 1.7 deg toward the opposite field - they do NOT turn toward his pull side.
  // Everyone plays deeper for more bat speed (outfielders 3 ft per mph,
  // infielders 1.5, set by hand so the depth varies about as much as the
  // league's, sd 9-12 ft).
  // INFIELDERS (v1.8) stand where the league's did in 2025 with the bases empty, against right- and left-handed
  // hitters (Baseball Savant's fielder positioning, every fielder with 10+ plate appearances, weighted by them;
  // statcast/infield_positioning.py), and shade from there toward a hitter's pull side in proportion to how far
  // he pulls beyond the average hitter, at the rate that turns the right-handed spots into the left-handed ones
  // over the average hitter's pull (2B and SS 0.54 deg per deg, 3B 0.42, 1B 0.36; until v1.8 1.0, 1.0, 0.8 and
  // 0.2 from a central spot, set by hand: the middle infielders stood 5-7 deg too far round toward the pull
  // side, and the opposite-field hole let through .46 of ground balls against the league's .31). The 2023 rule
  // the league played under holds them: two infielders on each side of second base, all four on the dirt.
  // WITH MEN ON (v1.8), the league's spots with a man on first only: the first baseman HOLDS him (88 ft out at
  // 41 deg) whenever second base is open; with a force at second and fewer than two out the middle infielders
  // and the third baseman play at DOUBLE-PLAY DEPTH, the 'first only' shift over the share of those pitches
  // thrown with fewer than two out (.63), since with two out they play their usual depth; and with a man on
  // third and fewer than two out the manager may bring the INFIELD IN, as often as the league's did by whether
  // first base was open, the inning and his lead (Statcast's 'Strategic' infield alignment, less its .079 with
  // third base empty: with first open 0.4-0.85 unless he led by two or more, when never). In, all four stand on
  // the line through the bases at their angle (2B and SS about 102 ft out, 1B and 3B about 92): a definition,
  // not a measurement - Statcast publishes no depths for it.
  var STD = { P: [60.5, 0], C: [-4.5, 0] };
  var INF = { '1B': { R: [113.7, 29.8], L: [123.6, 37.8] }, '2B': { R: [153.0, 6.8], L: [148.3, 19.0] },
              SS: { R: [148.3, -18.1], L: [152.3, -6.0] }, '3B': { R: [122.3, -36.5], L: [116.0, -27.1] } };
  var INF_FIRST = { '1B': { R: [87.9, 40.5], L: [88.8, 41.1] }, '2B': { R: [148.9, 6.7], L: [143.8, 18.8] },
                    SS: { R: [145.0, -17.2], L: [149.1, -5.5] }, '3B': { R: [119.1, -36.6], L: [114.6, -27.3] } };
  var FIRST_LT2 = 0.63;   // share of the league's pitches with a man on first only thrown with fewer than two out
  var PULL_MEAN = BB.TRAITS.pullBias[0] + BB.FACE_PATH;   // the average hitter's pull, deg (his path's plus the face's, engine v2.3)
  // P(infield in) with a man on third and fewer than two out: [first open, first occupied] x inning 1-3, 4-6, 7+ x
  // the fielding side's lead -2 (trailing by two or more) .. +2 (leading by two or more)
  var IN_P = [[[0.797, 0.695, 0.413, 0.365, 0.022], [0.83, 0.85, 0.682, 0.59, 0.013], [0.744, 0.779, 0.753, 0.784, 0]],
              [[0, 0.008, 0, 0, 0], [0.25, 0, 0.071, 0, 0], [0.267, 0.437, 0.546, 0.205, 0]]];
  var OF_SPOT = { pull: [300, 26], oppo: [291, 28], CF: [323, -1.7] };   // ft, deg toward the pull side
  function dirtEdge(aDeg) {   // ft from home to the edge of the infield dirt (95 ft round the front of the rubber)
    var a = aDeg * DEG, s = 60.5 * Math.sin(a);
    return 60.5 * Math.cos(a) + Math.sqrt(95 * 95 - s * s);
  }
  function lineDepth(aDeg) {   // ft from home to the line through the bases at this angle
    var a = Math.abs(aDeg) * DEG, c = 90 / Math.SQRT2;   // the line from first (c, c) to second (0, 2c)
    return 2 * c / (Math.cos(a) + Math.sin(a));
  }
  // sit (optional): { bases: [null, r1, r2, r3], outs, inning, lead (the fielding side's), u (the manager's draw) }
  function positionDefense(D, batter, side, sit) {
    var dv = batter.batSpeed - BB.TRAITS.batSpeed[0], hand = side < 0 ? 'R' : 'L', pull = Math.max(0, batter.pullBias + BB.FACE_PATH);
    var b = sit && sit.bases ? sit.bases : [], outs = sit ? sit.outs || 0 : 0;
    var hold = !!b[1] && !b[2], dpDepth = !!b[1] && outs < 2, infieldIn = false;
    if (b[3] && outs < 2 && sit) {
      var lead = Math.max(-2, Math.min(2, Math.round(sit.lead || 0))), inn = (sit.inning || 1) <= 3 ? 0 : sit.inning <= 6 ? 1 : 2;
      infieldIn = (sit.u === undefined ? 1 : sit.u) < IN_P[b[1] ? 1 : 0][inn][lead + 2];
    }
    D.forEach(function (F) {
      var spot;
      if (isOF(F.pos)) {
        spot = F.pos === 'CF' ? OF_SPOT.CF : (F.pos === 'LF') === (side < 0) ? OF_SPOT.pull : OF_SPOT.oppo;   // a right-handed hitter pulls to left
        var a = F.pos === 'CF' ? side * spot[1] : (F.pos === 'LF' ? -1 : 1) * spot[1];
        F.std = polar(spot[0], a);
        F.at = polar(spot[0] + 3 * dv, a);
        return;
      }
      if (!INF[F.pos]) { F.std = F.at = polar(STD[F.pos][0], STD[F.pos][1]); return; }
      var m = INF[F.pos][hand], first = INF_FIRST[F.pos][hand];
      var halfSwing = (INF[F.pos].L[1] - INF[F.pos].R[1]) / 2;
      var depth = m[0] + 1.5 * dv, ang = m[1] + side * (halfSwing / PULL_MEAN) * (pull - PULL_MEAN);
      if (F.pos === '1B' && hold) { depth = first[0]; ang = first[1]; }
      else if (F.pos !== '1B' && dpDepth) { depth += (first[0] - m[0]) / FIRST_LT2; ang += (first[1] - m[1]) / FIRST_LT2; }
      if (F.pos === '2B') ang = Math.max(1, ang);         // two infielders on each side of second base
      if (F.pos === 'SS') ang = Math.min(-1, ang);
      if (infieldIn && !(F.pos === '1B' && hold)) depth = Math.min(depth, lineDepth(ang));
      depth = Math.min(depth, dirtEdge(ang) - 1);          // and all four on the dirt
      F.std = polar(m[0], m[1]);
      F.at = polar(depth, ang);
    });
    return { hold: hold, dpDepth: dpDepth, infieldIn: infieldIn };
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
  // RUNNING FROM REST (v1.9). A runner on base who starts from a standstill - tagging up, held at the bag till a fly
  // drops, frozen at his lead till a grounder is through - runs the league's measured curve: his speed rises toward
  // his sprint speed as 1 - exp(-t / TAU_RUN), TAU_RUN 0.78 s, fitted to Statcast's running splits (549 hitters,
  // 2025, every 5 ft from 5 to 90: rmse .054 s, where a constant acceleration fits at .082). The average runner (27.0
  // ft/s) covers 90 ft in 4.11 s from a standstill. Until v1.9 he ran the batter's run from the box (4.5 m/s^2 with
  // 0.15 s to get going, fitted to Statcast's 4.4 s home to first, the swing's finish included): 4.40 s. The batter
  // keeps that run (he finishes his swing first: Statcast's home to first runs .44 s longer than his running split
  // to 90 ft), and a man moving off his lead keeps ACC_R (the curve from 1.5 m/s is worth 4.35 m/s^2 over 90 ft).
  var TAU_RUN = 0.78;   // s
  function restTime(pl, d) {   // s to cover d m from a standstill, on the curve
    var v = pl.speed * FT; d = Math.max(0, d);
    if (!d) return 0;
    var t = d / v + TAU_RUN;   // the asymptote; Newton from there
    for (var i = 0; i < 8; i++) { var e = Math.exp(-t / TAU_RUN); t -= (v * (t - TAU_RUN * (1 - e)) - d) / Math.max(v * (1 - e), 0.5); if (t < 1e-3) t = 1e-3; }
    return t;
  }
  function stealTime(pl, d, v0) {
    var v = pl.speed * FT; v0 = v0 === undefined ? V_SECONDARY : v0;
    var dAcc = (v * v - v0 * v0) / (2 * ACC_R);
    return d < dAcc ? (Math.sqrt(v0 * v0 + 2 * ACC_R * d) - v0) / ACC_R : (v - v0) / ACC_R + (d - dAcc) / v;
  }
  // The part of foul ground a fielder can reach: in front of the backstop and
  // within a strip along each line that narrows from the plate to the poles.
  // Anything else is in the seats. MEASURED (v1.1) from where the league's
  // foul-territory outs were made (785 field outs with foul landing spots, 42
  // days of 2025, the hit coordinates at 2.38 ft a unit): off the nearer line
  // the 95th percentile ran 12.6-12.9 m for the first 46 m along it, 10.3 m
  // at 46-61 m, 6.4 m at 61-91 m and 2 m beyond; behind the plate the outs
  // reached 14 m (46 ft) at the 95th percentile. The league makes such outs
  // on .027 of balls in play, 0.68 a team-game.
  function accessible(x, y) {
    if (y < -14) return false;
    var ax = Math.abs(x);
    if (ax <= y) return true;                                     // fair
    var s = (ax + y) / Math.SQRT2, perp = (ax - y) / Math.SQRT2;  // along the line, and off it
    if (s > 100) return false;
    var w = s <= 46 ? 12.8 : s <= 64 ? 12.8 - 6.4 * (s - 46) / 18 : s <= 91 ? 6.4 : 6.4 - 4.4 * (s - 91) / 9;
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
  // The cut-off man's catch, turn and release is the double play's pivot
  // (v1.9): the same body's motion, measured there (0.65 s, PIVOT below);
  // it was 0.45 s, set by hand when the cut-off man came in to curb triples.
  var RELAY_FROM = 55, CUT = 35;   // m, m
  function throwArrival(F, from, to) {
    var d = dist(from, BASES[to]), direct = throwTime(F.pl.armMph, d);
    if (d <= RELAY_FROM) return direct;
    return Math.min(direct, throwTime(F.pl.armMph, d - CUT) + PIVOT + throwTime(86, CUT));
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
    return { m: m, p: Phi((m - CATCH_SET) / 0.2) * (1 - DROP_K * (1 - F.pl.glove)) };
  }
  // A ball he is under is dropped DROP_K of his fumble rate on a grounder (1 - glove), FITTED to the
  // league's missed-catch errors (2025: about 0.023 a team-game, from the play descriptions' share of
  // the non-throwing errors: 0.15 gave 0.018-0.022 over 600 games; was 0.6, set by hand, which dropped 1.1% of routine catches).
  var DROP_K = 0.15;
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
  // A grounder fielded cleanly? Harder when it is hot, on a bad hop, and for an infielder when he had to
  // range for it (the ground he covered stands for fielding on the run). An outfielder picking up a ball
  // that got through is not hurried by the ground he ran to reach it (until v0.9 half of those pickups
  // were fumbled, each costing 1.2 s). D is the chance's difficulty, its scales set by hand; how much it
  // costs, CLEAN_K, was FITTED to the league's fielding errors per ground ball (2025 play descriptions:
  // .0145, and flat with exit velocity, 1.3-1.9% from 70 to 130 mph): .015 gave .014-.016 over 600 games.
  // It was 0.10, set by hand, and 10% of grounders were fumbled.
  function chanceD(F, ic) { return Math.pow(ic.v / 30, 2) + (isOF(F.pos) ? 0 : Math.pow(ic.moved / 10, 2)); }
  function cleanChance(F, ic) { return F.pl.glove * Math.exp(-CLEAN_K * chanceD(F, ic)); }
  var CLEAN_K = 0.015;
  // THE STOP AND TURN (v1.0). An outfielder who reaches the ball on the run
  // must shed the part of his speed that is not carrying him toward his
  // throw before he can make it: v (1 - max(0, cos a)) at ACC_F, where a is
  // the angle between his run and his throw - nothing if he is charging
  // toward the target, his whole speed if he is running across or away. His
  // speed at the ball is what his acceleration gives over the ground he ran,
  // less what he could brake in any time he had to spare. Braking is taken as
  // his acceleration (ACC_F, from Statcast's jump): an assumption, not a
  // measurement. Until v1.0 he threw as soon as he had the ball, and the
  // fumbles of v0.8 (half of all outfield pickups) had stood in for this: the
  // throw beat a batter-runner to second by a median 1.6 s on the singles that
  // stayed singles, and liners landing 150-300 ft were doubles 2-3% of the
  // time against the league's 9-12%. Infielders are left as they were.
  function settleTime(F, from, to, moved, spare) {
    if (!isOF(F.pos) || !(moved > 0)) return 0;
    var pl = F.pl, d = Math.max(0, moved - REACH * 0.5) / pl.route;
    var v = Math.max(0, Math.min(pl.speed * FT, Math.sqrt(2 * ACC_F * d)) - ACC_F * Math.max(0, spare));
    if (!v) return 0;
    var rx = from[0] - F.at[0], ry = from[1] - F.at[1], rm = Math.hypot(rx, ry) || 1;
    var tx = BASES[to][0] - from[0], ty = BASES[to][1] - from[1], tm = Math.hypot(tx, ty) || 1;
    var c = (rx * tx + ry * ty) / (rm * tm);
    return v * (1 - Math.max(0, c)) / ACC_F;
  }
  // THE SCORER. A fumble that costs the out is an error only on a chance an ordinary fielder handles
  // (the rulebook's ordinary effort): no harder than D = 1, a ball reaching him at 30 m/s (67 mph) or a
  // 10 m range, where an average glove's clean chance has fallen about a tenth. A harder chance fumbled
  // is a hit. (Until v0.9 any fumble that cost the out was an error: 0.59 a team-game against the
  // league's 0.25 non-throwing errors.)
  var ORDINARY_D = 1;

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
    // Second base: the second baseman covers when the shortstop or the third baseman has the ball, the shortstop
    // otherwise - the league's forces at second (2025 play descriptions): a ball to third went to the second
    // baseman 239 times in 267, to first to the shortstop 104 in 106, to the pitcher 26 to the shortstop and 21 to
    // the second baseman (until v1.8 the shortstop covered on a ball to third).
    function coverOf(to, who) { return { 1: '1B', 2: who === 'SS' || who === '3B' ? '2B' : 'SS', 3: '3B', 4: 'C' }[to]; }
    function fielderAt(pos) { return D.filter(function (F) { return F.pos === pos; })[0]; }
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
      // runners held; now they may tag up against this arm, once he has stopped and turned - the lead runner first,
      // and each only to a base the man ahead leaves (until v1.3 a man could tag up onto one who held, and the man
      // who held vanished from the bases). THE TAG-UP (v1.9): he leaves the bag as the ball is caught (0.05 s) and
      // runs from a standstill; for third or home he and the coach read the race as on a hit - the same read error
      // (READ_SD) and the same margins (SAFETY_3, SAFETY_H) by the outs he now plays with, the catch's out included -
      // and the throw's arrival is as sure as on a hit (raceSD). Until v1.9 he weighed the race with no error
      // against SAFETY (0.30 s, the margin for taking second), from the batter's start out of the box: he went only
      // when no throw could get him (no runner was ever thrown out tagging up, the league's .02 of chances), and a
      // man on third scored on a fly caught 300-320 ft out .42 of the time, the league's .98.
      var tagging = [], aheadTag = 5;
      function settleC(to) { return settleTime(F, at, to, dist(F.at, at), best.c.m); }
      R.slice(0, -1).forEach(function (r) {
        var to = r.base + 1, tRun = tc + 0.05 + restTime(r.pl, BASE), oNow = Math.min(outs + 1, 2);   // from a standstill; the outs he now plays with
        var tBall = Math.max(tc + settleC(to) + F.pl.transfer + throwArrival(F, at, to), rcvArrival(to, F.pos)) + TAG;
        var goes = to < aheadTag && (to >= 3 ? tBall - tRun + rng.n(0, READ_SD) > (to === 3 ? SAFETY_3 : SAFETY_H)[oNow] + r.pl.runAggr : tRun + SAFETY + r.pl.runAggr < tBall);
        if (goes) tagging.push({ r: r, to: to, tRun: tRun, tBall: tBall });
        aheadTag = goes ? to : r.base;
      });
      if (tagging.length) {
        var play = null;
        tagging.forEach(function (q) { q.sd = raceSD(at, q.to); q.p = Phi((q.tRun - q.tBall) / q.sd) * (q.to === 4 ? 1.4 : 1); if (!play || q.p > play.p) play = q; });
        tagging.forEach(function (q) { q.r.target = q.to; q.r.start = tc; q.r.tagRun = q.tRun; });
        if (play.p > 0.12) {
          ev.push({ t: tc + settleC(play.to) + F.pl.transfer, kind: 'throw', who: F.pos, from: at, to: play.to, arrive: play.tBall, rcv: coverOf(play.to, F.pos) });
          if (rng.u() < Phi((play.tRun - play.tBall) / play.sd)) {
            play.r.out = true; out.outsMade++; out.desc += ', ' + baseName(play.to) + ' tag: out';
          } else out.desc += ', runner ' + (play.to === 4 ? 'scores' : 'to ' + baseName(play.to)) + ' on the tag';
        } else out.desc += ', runner ' + (play.r === tagging[0].r && play.to === 4 ? 'scores' : 'tags to ' + baseName(play.to));
      }
      // a tag play that makes the third out is a time play: a run counts only if it crossed the plate before the tag
      // (rule 5.08(a); until v1.10 every runner who tagged and reached home counted - seldom wrong while no runner
      // was ever thrown out tagging up)
      var thirdTagAt = play && play.r.out && outs + out.outsMade >= 3 ? play.tBall : Infinity;
      R.forEach(function (r) { if (!r.out && r.target >= 4 && !(r.tagRun >= thirdTagAt)) { out.runs++; out.rbi++; } });
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
      return { t: Math.max(t0 + settle(to, from) + Ff.pl.transfer + throwArrival(Ff, from, to), rcvArrival(to, Ff.pos)), how: 'throw' };
    }
    function settle(to, from) { return settleTime(Ff, from, to, ic.moved, ic.t - moveTime(Ff.pl, ic.moved - (isOF(Ff.pos) ? REACH * 0.5 : REACH_GB))); }
    // The double play's relay: the man covering second catches the force, pivots and throws to first with his own
    // arm - and someone must be at first to take it. When the first baseman fielded the ball, the pitcher covers or
    // the first baseman gets back himself, whichever is there first (the league's 3-6 double plays: the pitcher took
    // the relay 19 times, the first baseman 11). Until v1.8 the relay always arrived at 85 mph to a first baseman
    // standing on the bag, even when he was the man who had thrown to second.
    function relayAt1(tAt2) {
      var Pv = fielderAt(coverOf(2, Ff.pos)), t = tAt2 + PIVOT + throwTime(Pv ? Pv.pl.armMph : 85, BASE);
      if (Ff.pos === '1B') {
        var tP = Pf ? moveTime(Pf.pl, dist(Pf.at, BASES[1])) + 0.2 : Infinity;
        var tBack = tField + Ff.pl.transfer + moveTime(Ff.pl, dist(fieldAt, BASES[1])) - Ff.pl.react + 0.1;
        t = Math.max(t, Math.min(tP, tBack));
      }
      return t;
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
        var to = r.base + 1, tRun = 0.1 + restTime(r.pl, BASE - LEAD);
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
      if (r.base > 0) return r.start + (r.start >= 0.5 && !r.midway ? 0.15 : 0.05) + restTime(r.pl, d);   // from a standstill (v1.9)
      return r.start + runTime(r.pl, d, true);   // the batter, out of the box
    }
    // how far each goes: lead runner first, nobody passes the man ahead - and a man who has crossed the plate is
    // nobody's ceiling (until v1.2 he was: the runner behind him was held to third, so no single, double or triple
    // ever scored two runs)
    var ahead = 5;
    R.forEach(function (r, i) {
      if (r.start === null) { r.target = r.base; ahead = r.base; return; }
      var to = r.base + 1;
      if (r.base === 0) to = 1;
      while (to + 1 < ahead && to < 4) {
        var next = to + 1, tRun = arrive(r, next);
        var tBall = ballTo(next, tField, fieldAt).t + TAG;
        if (next >= 3 ? tBall - tRun + rng.n(0, READ_SD) > (next === 3 ? SAFETY_3 : SAFETY_H)[Math.min(outs, 2)] + r.pl.runAggr : tRun + SAFETY + r.pl.runAggr < tBall) to = next; else break;
      }
      if (T.groundRule) to = Math.min(4, r.base + 2);
      r.target = Math.min(to, ahead - 1); ahead = r.target >= 4 ? 5 : r.target;
    });

    // THE THROW (v1.8): the out worth the most runs. For each runner he could play, the runs that would score plus
    // the league's run expectancy of the bases and outs left (RE24), if the throw gets him and if it does not -
    // and for a force at second with fewer than two out, if the relay gets the batter too - weighted by those
    // chances; he throws for the lowest. No run scores on a third out made by a force or on the batter. Until v1.8
    // he counted expected outs (home 1.4) and tried a force at second only when it was .6 likely: with a man on
    // first the league's infielders took the lead runner on .60 of single outs, the model's .13.
    function valueAfter(outR, batOut, force, tBall) {
      var o = outs + (outR ? 1 : 0) + (batOut ? 1 : 0), occ = 0, runs = 0;
      R.forEach(function (r) {
        if (r === outR || (batOut && r.base === 0)) return;
        if (r.target >= 4) { if (o < 3 || (!force && arrive(r, 4) < tBall)) runs++; }
        else if (r.target > 0) occ |= 1 << (r.target - 1);
      });
      return runs + (o >= 3 ? 0 : RE24[o][occ]);
    }
    var cands = [], vNone = valueAfter(null, false, false, 0);
    R.forEach(function (r, i) {
      if (r.target <= r.base) return;
      var isForce = r.base === 0 ? true : (forced(i) && r.target === r.base + 1);
      var tRun = arrive(r, r.target), way = ballTo(r.target, tField, fieldAt);
      var tBall = way.t + (isForce ? 0 : TAG);
      var p = Phi((tRun - tBall) / raceSD(fieldAt, r.target)), pRelay = 0, vOut = valueAfter(r, false, isForce || r.base === 0, tBall);
      if (isForce && r.target === 2 && r.base === 1 && outs < 2) {   // the relay's chance at the batter
        var bat = R[R.length - 1], t2 = relayAt1(tBall);
        pRelay = Phi((arrive(bat, 1) - t2) / 0.15);
        vOut = pRelay * valueAfter(r, true, true, tBall) + (1 - pRelay) * vOut;
      }
      cands.push({ r: r, i: i, p: p, v: p * vOut + (1 - p) * vNone, tRun: tRun, tBall: tBall, force: isForce, pRelay: pRelay, how: way.how });
    });
    cands.sort(function (a, b) { return a.v - b.v; });
    var play = cands.length && cands[0].p > 0.12 ? cands[0] : null;
    if (T.groundRule) play = null;
    if (play) {
      var to = play.r.target, d = dist(fieldAt, BASES[to]), err = 0;
      if (play.how === 'run') ev.push({ t: tField, kind: 'carry', who: Ff.pos, from: fieldAt, to: to, arrive: play.tBall });   // carries it to the bag: nothing to throw away ('run' is a run scoring)
      else {
        if (play.how === 'cover') ev.push({ t: 0.3, kind: 'cover', who: 'P', to: 1, arrive: play.tBall });
        err = Math.abs(rng.n(0, Ff.pl.armAcc * d / 40));
        ev.push({ t: tField + settle(to, fieldAt) + Ff.pl.transfer, kind: 'throw', who: Ff.pos, from: fieldAt, to: to, arrive: play.tBall, wild: err > 1.6, rcv: play.how === 'cover' ? 'P' : coverOf(to, Ff.pos) });
      }
      var via = play.how === 'run' ? Ff.pos + ' unassisted' : play.how === 'cover' ? Ff.pos + ' to the pitcher covering' : Ff.pos + ' to ' + baseName(to);
      if (err > 1.6) {                                   // thrown away: everyone moves up a base, the men who held included (until v1.4 a holder stayed, and a runner behind him landed on top of him)
        out.error = true;
        R.forEach(function (r) { r.target = Math.min(4, r.target + 1); });
        out.desc = 'throwing error by ' + Ff.pos;
      } else if (rng.u() < play.p) {
        play.r.out = true; out.outsMade++;
        out.desc = play.r.base === 0 ? (out.type === 'GB' ? 'ground out, ' + via : 'out at ' + baseName(to) + ', ' + Ff.pos)
                                    : (play.force ? 'force out at ' : 'out at ') + baseName(to) + ', ' + Ff.pos + ' (runner from ' + baseName(play.r.base) + ')';
        // double play: force at second, relay to first
        var bat = R[R.length - 1];
        if (play.force && to === 2 && play.r.base === 1 && !bat.out && bat.target === 1 && outs + out.outsMade < 3) {
          var t2 = relayAt1(play.tBall), p2 = Phi((arrive(bat, 1) - t2) / 0.15);
          ev.push({ t: play.tBall + PIVOT, kind: 'throw', who: 'relay', from: BASES[2], to: 1, arrive: t2, rcv: Ff.pos === '1B' ? 'P' : '1B' });
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
    var triedRunner = play && play.r.base > 0 && !play.r.out && play.force && !out.error;   // the fielder tried a force on a runner and failed (a throw that got away is an error, scored below; v1.7)
    if (!batR.out) {
      // a fly he was under and dropped would have been the batter's out: he reaches on the error (rule 9.12; until v1.9
      // he was scored a hit and the fielder an error on the same play)
      var wouldBeOut = ev.some(function (e) { return e.kind === 'drop'; });
      if (!wouldBeOut && (!clean || out.error || triedRunner)) {           // would a clean play on the batter have got him?
        var tB = ballTo(1, ic.t, ic.at).t;
        wouldBeOut = arrive(batR, 1) > tB + 0.1;
      }
      if (wouldBeOut && (out.error || chanceD(Ff, ic) <= ORDINARY_D) && !(triedRunner && clean)) { out.hit = 'E'; out.error = true; out.desc = 'reaches on an error by ' + Ff.pos; }
      else if (anyForceOut || (triedRunner && wouldBeOut)) out.hit = 'FC';   // a force tried and missed is the batter's hit only if he would have beaten a throw to first (rule 9.05; until v1.5 it was always a hit)
      else out.hit = ['', '1B', '2B', '3B', 'HR'][batR.target];
      if (T.groundRule) out.desc = 'ground-rule double';
    } else out.hit = batR.target >= 2 ? ['', '', '1B', '2B', '3B'][batR.target] : 'OUT';   // thrown out past first, he keeps the hit that got him there (rule 9.05; until v1.6 a plain out)
    if (!out.desc || out.hit === '1B' || out.hit === '2B' || out.hit === '3B') {
      var where = Ff.pos, kind = out.type === 'GB' ? 'ground ball' : out.type === 'LD' ? 'line drive' : 'fly ball';
      out.desc = (out.hit === 'OUT' ? out.desc : (out.hit === '1B' ? 'single' : out.hit === '2B' ? 'double' : out.hit === '3B' ? 'triple' : out.hit === 'HR' ? 'inside-the-park home run' : out.desc) + ', ' + kind + ' to ' + where +
                 (batR.out ? ', out at ' + baseName(batR.target) + ' trying for more' : play && !play.r.out && play.r.base !== 0 ? ', ' + out.desc : ''));
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

  return { version: '1.10', BASES: BASES, positionDefense: positionDefense, makeDefense: makeDefense,
           moveTime: moveTime, runTime: runTime, stealTime: stealTime, LEAD_STEAL: LEAD_STEAL, accessible: accessible,
           throwTime: throwTime, throwArrival: throwArrival, buildTrack: buildTrack, restTime: restTime,
           catchChance: catchChance, intercept: intercept, resolve: resolve, foulCatch: foulCatch, onDirt: onDirt };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBField;
