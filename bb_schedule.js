/* ============================================================================
   bb_schedule.js · v0.6 · 2026-10-04

   The game and its schedule, shared by the screen (baseball.html) and the
   headless tools, so the broadcast script can be written and checked
   without a browser. Pure and seeded: no DOM.

   game(seed) draws the same game the screen plays for that seed - the
   teams, the park and its air, the plate umpire, every pitch - and marks
   each play with the score before it and the home team's chance of winning
   before and after it (an estimate from the run difference, the innings
   left and the base-out state).

   build(G, PLAYER) lays the game out on the screen's fixed clock: pregame,
   then per half halfStart, per at-bat a change (a pitching change or a
   pinch hitter, when there is one) and paStart, per pitch setup, flight and
   result, then halfEnd; after the top of the 7th the seventh-inning
   stretch (30 s); and finally final. Each segment has kind, t0, dur
   and its play / pitch index / inning, and a stable readable event id made
   from the game, not from its place in the list: 'pre', '7b.start',
   '7b.3.up' (the third man up in the bottom of the 7th walks to the plate),
   '7b.3.pitcher' / '7b.3.pinch' (a change before him), '7b.3.4.setup',
   '7b.3.4.flight', '7b.3.4.result' (his fourth pitch), '7b.end', '7.stretch',
   'final'. A throw over to first before his fourth pitch is '7b.3.4.pickoff1'
   (a second, '...pickoff2'; with no pitch after it, numbered past his last);
   an intentional walk, '7b.3.ibb'.

   With a stable beside the page (stable/bb_stable.js, written by
   headless/league_run.js from bb_league.js), the game is drawn from it: a level
   (the majors a little over half the time, the five levels below the rest) and
   two of that level's clubs with their standing rosters; the minors play with a
   designated hitter, the majors by the home club's league. Without one, two
   teams are drawn fresh as before.

   CHANGED
     v0.6  more air for the omniscient broadcast: setup 4 s, a take 3.4, a foul 3.0, the batter's
           introduction 5.5, the end of a half 9 (13 in the middle of an inning), and 6 s after each
           at-bat for its summary
     v0.5  games from the league's stable, when there is one: a level and two clubs
     v0.4  the manager's moves (bb_game v0.9): an 'ibb' segment for an intentional walk,
           a 'pickoff' segment for each throw over, a longer change for a double switch
     v0.3  uniform numbers: 0 to 99, and e, pi and i, from a stream of their own
     v0.2  the seventh-inning stretch: 30 s after the top of the 7th, in games that get there
============================================================================ */

var BBSchedule = (function () {
  'use strict';
  var FT = BB.units.FT;
  // seconds each kind of segment lasts at 1x
  // v0.6: more air for the omniscient broadcast (what he meant, what the batter saw, what happened): a pitch about every 9 s
  var PACE = { pregame: 45, halfStart: 8, paStart: 5.5, setup: 4.0, flight: 1.8, take: 3.4, foul: 3.0, bipPad: 3.0, change: 4.5, halfEnd: 9.0, midInning: 13.0, paEnd: 6.0, stretch: 30, final: 40,
               ibb: 5.0, pickoff: 3.4, dswitch: 2.5 };   // an intentional walk (the sign, the jog to first); a throw over and back; a double switch's extra time
  var HR_BASE = 1.6, CELEB = 3.5;   // a home-run trot per base; how long a grand-slam huddle at the plate holds

  function Phi(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }

  // Run expectancy by outs and base state (bits 1B=1, 2B=2, 3B=4); the rest of the
  // game as normal noise. An estimate, labelled as one.
  var RE = [[0.48, 0.86, 1.10, 1.44, 1.35, 1.78, 1.96, 2.29], [0.26, 0.51, 0.66, 0.90, 0.95, 1.13, 1.38, 1.54], [0.10, 0.22, 0.32, 0.43, 0.35, 0.48, 0.58, 0.75]];
  function winProb(inning, half, outs, bases, score) {
    if (outs >= 3) { half = 1 - half; if (half === 0) inning++; outs = 0; bases = [null, null, null, null]; }
    var idx = (bases[1] ? 1 : 0) + (bases[2] ? 2 : 0) + (bases[3] ? 4 : 0), re = RE[Math.min(outs, 2)][idx];
    var left = Math.max(0, 9 - inning), awayH = left, homeH = left + (half === 0 ? 1 : 0);
    var mean = (score[1] - score[0]) + (half === 1 ? re : -re) + 0.48 * (homeH - awayH);
    var sd = Math.sqrt(0.9 * (awayH + homeH) + 0.9);
    return Phi(mean / sd);
  }

  // ============================================================ THE GAME
  var LEVEL_W = [0.55, 0.15, 0.10, 0.08, 0.07, 0.05];   // how often the screen visits each level: the majors, then Triple-A down to Rookie
  function stableOf() { return typeof window !== 'undefined' ? window.BB_STABLE || null : typeof BB_STABLE !== 'undefined' ? BB_STABLE : null; }
  function game(seed) {
    var rng = BB.makeRng(seed), ST = stableOf(), away, home, rules, level = 0, levelName = '';
    if (ST) {   // two clubs of one level from the league, each with its roster as it stands
      level = rng.pickW(LEVEL_W) + 1; levelName = ST.levels[level - 1].name;
      var n = ST.orgs.length, ia = Math.floor(rng.u() * n), ih; do { ih = Math.floor(rng.u() * n); } while (ih === ia);
      away = BBGame.teamFromRoster(ST.orgs[ia].clubs[level - 1], Math.floor(rng.u() * 5));
      home = BBGame.teamFromRoster(ST.orgs[ih].clubs[level - 1], Math.floor(rng.u() * 5));
      rules = level === 1 ? ST.orgs[ih].league : 'AL';
    } else {
      var teams = BBNames.teams(rng);
      away = BBGame.makeTeam(rng, teams[0]); home = BBGame.makeTeam(rng, teams[1]);
    }
    var env = BB.mlbEnv(rng), parkName = BBNames.park(rng);
    var ump = BB.makeUmp(rng); ump.name = BBNames.fullName(BBNames.person(rng));
    var G = BBGame.simGame(away, home, { rng: rng, env: env, ump: ump, rules: rules });
    G.level = level; G.levelName = levelName;
    var PLAYER = {};   // every man who can bat, by id (a pitcher bats as his .bat)
    [away, home].forEach(function (Tm) { Tm.lineup.concat(Tm.bench).forEach(function (b) { PLAYER[b.id] = b; });
      [Tm.starter].concat(Tm.bullpen).forEach(function (P) { if (P.bat) PLAYER[P.id] = P.bat; }); });
    // score before each play, runs in the half so far, win probability
    var sc = [0, 0], innRuns = 0, last = null;
    G.plays.forEach(function (p) {
      if (!last || last.inning !== p.inning || last.half !== p.half) innRuns = 0;
      p.scoreBefore = sc.slice(); p.innRunsBefore = innRuns;
      p.wpBefore = winProb(p.inning, p.half, p.outs, p.bases, sc);
      sc = p.score.slice(); innRuns += p.runs; last = p;
      p.wpAfter = winProb(p.inning, p.half, p.outsAfter, p.basesAfter, sc);
    });
    G.plays[G.plays.length - 1].wpAfter = G.score[1] > G.score[0] ? 1 : 0;
    G.park = parkName;
    return { seed: seed, G: G, away: away, home: home, env: env, parkName: parkName, ump: ump, PLAYER: PLAYER, NUMBER: uniforms(seed, [away, home]) };
  }

  // Uniform numbers, by player id: 0 to 99, and for fun three more that could be
  // drawn (Joe, 2026-10-02): e, pi and i. Each team draws its own, none twice.
  // A separate random stream, so the game itself is untouched.
  function uniforms(seed, teams) {
    var r = BB.makeRng((seed ^ 0x2545f491) >>> 0), N = {};
    teams.forEach(function (Tm) {
      var pool = [];
      for (var k = 0; k < 100; k++) pool.push(String(k));
      pool.push('e', 'π', 'i');
      Tm.lineup.concat(Tm.bench, [Tm.starter], Tm.bullpen).forEach(function (p) {
        N[p.id] = pool.splice(Math.floor(r.u() * pool.length), 1)[0];
      });
    });
    return N;
  }

  // ======================================================== THE SCHEDULE
  function build(G, PLAYER) {
    // When each man reaches his bag. Safe: the fielding layer's own time. Scored or
    // put out: at his own pace (his speed, the fielding layer's running model) - and
    // if the ball beat him he still gets there, after it. The batter runs every ball
    // out as if it will drop, because he cannot know it won't: on a catch he has
    // gone hard through first and rounded it, and pulls up where the catch finds him.
    function ownArrive(rn, to, start) {
      var pl = PLAYER[rn.id] || { speed: 27 }, st = start !== undefined ? start : (rn.start || 0.05);
      return st + BBField.runTime(pl, (to - rn.from) * 90 * FT - (rn.lead || 0), rn.from === 0 || st >= 0.5);
    }
    function runnerArrive(r, rn, bb) {
      if (rn.arrive !== undefined) return rn.arrive;
      var ev = r.events.filter(function (e) { return e.kind === 'safe' && e.who === rn.id; })[0];
      var th = r.events.filter(function (e) { return (e.kind === 'throw' || e.kind === 'carry') && e.to === rn.to; })[0];
      var a;
      if (ev && isFinite(ev.t)) a = ev.t;
      else if (rn.to > rn.from) a = Math.max(rn.out && th ? th.arrive : 0, ownArrive(rn, rn.to));
      else a = rn.start || 0;
      if (r.hit === 'HR') { rn.start = bb.hang * 0.3; a = rn.start + (rn.to - rn.from) * HR_BASE; }
      var ct = r.events.filter(function (e) { return e.kind === 'catch'; })[0];
      if (rn.from === 0 && rn.out && ct) {
        var t1 = ownArrive(rn, 1, 0.05);                               // his time to first, flat out
        rn.start = 0.05; rn.to = 2; a = 0.05 + 2 * (t1 - 0.05);        // on toward second at the same pace...
        rn.stopD = (bb && bb.fair === false ? 0.5 : 1.25) * 90 * FT;   // ...rounding first by a quarter of the way (a foul pop: he knows; half way, then watches)
        rn.gone = ct.t;
      }
      rn.arrive = a; return a;
    }
    function playDuration(play) {
      var r = play.play, bb = play.pa.bb;
      if (!r) return 2;
      var t = bb.hang + 1;
      r.events.forEach(function (e) { if (e.t) t = Math.max(t, e.t); if (e.arrive) t = Math.max(t, e.arrive); });
      (r.runners || []).forEach(function (rn) { var a = runnerArrive(r, rn, bb); t = Math.max(t, rn.gone !== undefined ? rn.gone : a); });   // a man beaten by the throw still runs it out
      if (r.hit === 'HR') t = bb.hang * 0.3 + 4 * HR_BASE + 0.4;   // the trot: he sets off as the ball leaves and touches them all
      return Math.min(t, 16) + 0.6;
    }

    var SEG = [], total = 0;
    function add(kind, dur, d) { var s = d || {}; s.kind = kind; s.dur = dur; s.t0 = total; SEG.push(s); total += dur; return s; }
    add('pregame', PACE.pregame, { id: 'pre' });
    G.innings.forEach(function (inn, ii) {
      var hk = inn.n + (inn.half ? 'b' : 't');   // '7b': the bottom of the 7th
      add('halfStart', PACE.halfStart + (ii === 0 ? 6 : 0), { inn: inn, id: hk + '.start' });   // the first: the home side takes the field from the dugout
      inn.plays.forEach(function (play, ab) {
        var pk = hk + '.' + (ab + 1);
        play.key = pk;
        if (play.newPitcher) add('change', PACE.change + (play.newPitcher.doubleSwitch ? PACE.dswitch : 0), { play: play, change: play.newPitcher, id: pk + '.pitcher' });
        if (play.pinchHit) add('change', PACE.change, { play: play, pinch: play.pinchHit, id: pk + '.pinch' });
        add('paStart', PACE.paStart, { play: play, id: pk + '.up' });
        var n = play.pa.pitches.length;
        function pickoffs(list, i, qk) {   // throws over before pitch i (i = n: none followed)
          (list || []).forEach(function (e, k) { var sg = add('pickoff', PACE.pickoff, { play: play, i: i, k: k, pick: e, id: qk + '.pickoff' + (k + 1) }); e.t0 = sg.t0; });
        }
        if (play.ibb) {   // the manager signals; he jogs to first, anyone forced ahead of him
          var ib = add('ibb', PACE.ibb, { play: play, last: true, id: pk + '.ibb' });
          play.tResult = ib.t0; play.tResolve = ib.t0 + 0.8; play.tEnd = ib.t0 + PACE.ibb;
        }
        play.pa.pitches.forEach(function (p, i) {
          var qk = pk + '.' + (i + 1);
          pickoffs(p.pickoffs, i, qk);
          add('setup', PACE.setup, { play: play, i: i, id: qk + '.setup' });
          add('flight', PACE.flight, { play: play, i: i, id: qk + '.flight' });
          var last = i === n - 1, dur, running = (p.steal && !p.steal.back) || p.wild;   // a steal or a wild pitch plays out in real time
          if (last && play.play) dur = playDuration(play) + PACE.bipPad + (play.play.hit === 'HR' && play.play.runs === 4 ? CELEB + 1.0 : 0);   // a grand slam: the bench comes out
          else if (p.result === 'foul') dur = (p.bb ? Math.min(p.bb.hang, 3) : 0) + PACE.foul;
          else dur = running ? 5.0 : PACE.take;
          if (last) dur += PACE.paEnd;   // the booth sums up the at-bat before the next man is introduced
          var sg = add('result', dur, { play: play, i: i, last: last, id: qk + '.result' });
          p.tResult = sg.t0;
          if (last && !play.pa.pickoffsEnd) { play.tResult = sg.t0; play.tResolve = sg.t0 + (play.play ? playDuration(play) - 0.6 : running ? 2.6 : 0.4); play.tEnd = sg.t0 + dur; }
        });
        if (play.pa.pickoffsEnd) {   // picked off for the third out, no pitch after: the last throw ends the half
          pickoffs(play.pa.pickoffsEnd, n, pk + '.' + (n + 1));
          var lastPk = SEG[SEG.length - 1]; lastPk.last = true;
          play.tResult = lastPk.t0; play.tResolve = lastPk.t0 + 1.4; play.tEnd = lastPk.t0 + lastPk.dur;
        }
      });
      inn.tEnd = add('halfEnd', inn.half === 0 ? PACE.midInning : PACE.halfEnd, { inn: inn, id: hk + '.end' }).t0;   // the middle of an inning is the longer break
      // the middle of the seventh: everyone stands and the organ plays "Take Me Out to the Ball Game"
      if (inn.n === 7 && inn.half === 0) add('stretch', PACE.stretch, { inn: inn, id: '7.stretch' });
    });
    add('final', PACE.final, { id: 'final' });
    function segAt(t) {
      var lo = 0, hi = SEG.length - 1;
      while (lo < hi) { var m = (lo + hi + 1) >> 1; if (SEG[m].t0 <= t) lo = m; else hi = m - 1; }
      return SEG[lo];
    }
    return { SEG: SEG, total: total, segAt: segAt, playDuration: playDuration, runnerArrive: runnerArrive, ownArrive: ownArrive };
  }

  return { version: '0.6', PACE: PACE, HR_BASE: HR_BASE, CELEB: CELEB, Phi: Phi, winProb: winProb, game: game, build: build };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBSchedule;
