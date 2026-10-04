/* ============================================================================
   bb_game.js · v1.1 · 2026-10-04

   A whole game: two teams, nine innings or more, lineups that turn over,
   pitchers who tire and get replaced, managers with their own habits.
   Pure and seeded like the rest; the game log carries everything the
   screen needs to replay it pitch by pitch.

   RULES (Joe, 2026-09-29: pre-2023) - no pitch clock, no ghost runner in
   extra innings, shifts allowed, no three-batter minimum. 'AL' plays a
   designated hitter; 'NL' has the pitcher bat and the manager pinch-hit
   for him.

   THE MANAGER is two traits. `hook` is the fatigue at which he pulls a
   starter (0.3 quick, 0.85 patient; 0.5 is about 95 pitches); `warmAt` is
   how far below the hook he starts a reliever warming. Relievers pitch an
   inning at a time: one who has thrown a dozen pitches is replaced between
   innings while fresh arms remain. Warming up COSTS the reliever pitches (Joe):
   every half-inning in the pen adds load, and if he never gets in he
   carries it anyway. A reliever is chosen for the hitters due up (a
   left-hander for left-handed bats) among the freshest arms; the closer is
   held for a save. In the NL a pitcher due up from the sixth inning on is
   pinch-hit for when his manager is about to pull him anyway or the team
   is behind.

   TIMES THROUGH THE ORDER: every pitch a batter sees from this pitcher is
   remembered for him, and a quarter of what his team-mates see counts too,
   so recognition improves through the game (bb_engine readFactors). The
   penalty is an OUTPUT to be measured, not a rule.

   THE MANAGER'S OTHER MOVES (v0.9). Two more traits: `ibb`, the gap in expected
   wOBA between this hitter and the next that he needs before he puts a man on
   intentionally, and `glove`, the runs a defensive change must gain before he
   makes it. The bench is four men drawn for a catcher, a utility infielder, a
   fourth outfielder and a first baseman, from the level below the team's. Pitchers throw over to first; NL
   managers double-switch.

   Not here yet: pinch-runners, injuries, weather that changes during a game.

   STANDING ROSTERS (v1.0, for bb_league.js): makeRoster draws a club's
   twenty-six (thirteen hitters - two catchers, a utility infielder, a fourth
   outfielder - five starters, eight relievers) and its manager once;
   teamFromRoster sets the day's team from it: the best fielder the roster has at
   each position (the farm's own value at that position), the best remaining bat
   at DH, the rest on the bench, the next man in the five-man rotation.

   CHANGED
     v1.1  a steal's wild throw moves every runner up a base (the stealer from first had
           landed on a man already on third, who vanished: 16 times in 2,000 games)
     v1.0  standing rosters for a league: makeRoster, teamFromRoster
     v0.9  intentional walks (signalled, 2017-2022 rule), pickoffs, late defensive
           substitutions and NL double switches; a bench of four drawn for their
           positions; the pinch-hitter is the best bat on the bench
     v0.8  a team can be drawn from a level of the pro pool (o.level: 1 the majors,
           2 Triple-A ... 6 rookie ball; bb_engine v2.0)
============================================================================ */

var BBGame = (function () {
  'use strict';
  var POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  var BENCH = ['C', 'SS', 'CF', '1B'];   // a backup catcher, a utility infielder, a fourth outfielder, a first baseman
  var CAN = { C: ['C'], SS: ['SS', '2B', '3B'], CF: ['CF', 'LF', 'RF'], '1B': ['1B'] };   // where a bench man can play, by what he was drawn for
  function canPlay(b, pos) { return (CAN[b.benchPos] || [b.pos]).indexOf(pos) >= 0; }
  // the manager's two other habits (drawn, not measured; sized so the league's rates come out)
  var IBB_GAP = [0.075, 0.025];   // expected-wOBA gap to the next hitter he needs before an intentional walk
  var GLOVE_BAR = [0.012, 0.008]; // runs a defensive change must gain over the innings left
  // what a game holds, for the manager's sums (as the farm's: bb_engine playerValue)
  var BIP_INN = 25 / 9, PA_INN = 4.2 / 9, WOBA_SCALE = 1.23;
  // pickoffs: a throw over beats the runner back when its time (PK_T plus the
  // pitcher's pickMove) is shorter than his: half his jump (his read of the move)
  // plus his primary lead at diving speed. PK_T and PK_RATE are sized so pickoffs
  // and throws per game come out near the league's (2019/2022: 0.05 pickoffs per
  // team-game; throws over are not counted publicly - about one a game is assumed).
  var PK_T = 0.915, PK_LEAD = 3.5, V_BACK = 6.0, PK_RATE = 0.042, PK_ERR = 0.012;

  function named(rng, o, taken) {      // no two men on a roster share a surname
    var p;
    do { p = BBNames.person(rng); } while (taken && taken[p.last]);
    if (taken) taken[p.last] = true;
    o.name = BBNames.fullName(p); o.last = p.last; return o;
  }

  // A crude eye for the batting order: bat speed and recognition, the two
  // traits the projections lean on most. Best hitters bat 2-4.
  function batScore(b) { return (b.batSpeed - 71.8) / 3 - (b.spotIn - 4.5) / 0.8 * 0.6 - (b.eyeSD - 5) / 0.9 * 0.3; }

  function makeTeam(rng, o) {
    o = o || {};
    var t = { city: o.city, nick: o.nick, name: o.city + ' ' + o.nick }, taken = {};
    var players = POS.map(function (pos) { return named(rng, BB.makeBatter(rng, { pos: pos, level: o.level }), taken); });
    // the bench, drawn for its positions from the level below: a regular is the best of
    // the farm's six candidates, a bench man the next best (the starters stay the ones
    // the pool is fitted to; letting the better of starter and bench man start made
    // four positions the best of twelve, and runs rose by half a run a game)
    t.bench = BENCH.map(function (pos) { var b = named(rng, BB.makeBatter(rng, { pos: pos, level: Math.min(BB.FARM_N, (o.level || 1) + 1) }), taken); b.benchPos = pos; return b; });
    players.sort(function (a, b) { return batScore(b) - batScore(a); });
    // 3-4-2-1-5-6-7-8-9 by quality
    var slots = [3, 4, 2, 1, 5, 6, 7, 8, 9], order = [];
    players.forEach(function (p, i) { order[slots[i] - 1] = p; });
    t.lineup = order;
    function pitcher(role) {
      var p = named(rng, BB.makePitcher(rng, { role: role, level: o.level }), taken);
      p.bat = BB.makeBatter(rng, { pitcher: true, pos: 'P' }); p.bat.name = p.name; p.bat.id = p.id;
      p.warm = 0; p.used = false; p.pitchesToday = 0;
      return p;
    }
    t.starter = pitcher('SP');
    t.bullpen = [0, 1, 2, 3, 4, 5, 6].map(function () { return pitcher('RP'); });
    t.bullpen.sort(function (a, b) { return b.pitches[0].velo - a.pitches[0].velo; });
    t.closer = t.bullpen[0];
    t.manager = { hook: Math.min(0.85, Math.max(0.3, rng.n(0.5, 0.12))), warmAt: 0.2,
                  ibb: Math.max(0.02, rng.n(IBB_GAP[0], IBB_GAP[1])), glove: Math.max(0, rng.n(GLOVE_BAR[0], GLOVE_BAR[1])) };
    return t;
  }

  // --------------------------------------------------- standing rosters
  var ROSTER_POS = ['C', 'C', '1B', '2B', 'SS', '3B', 'SS', 'LF', 'CF', 'RF', 'CF', '1B', 'DH'];   // a club's thirteen hitters, by the position each was found for
  function makeRoster(rng, o) {
    o = o || {};
    var lv = o.level || 1, taken = {}, R = { city: o.city, nick: o.nick, name: o.city + ' ' + o.nick, level: lv };
    R.hitters = ROSTER_POS.map(function (pos) { var b = named(rng, BB.makeBatter(rng, { pos: pos, level: lv }), taken); b.homePos = pos; return b; });
    function pitcher(role) {
      var p = named(rng, BB.makePitcher(rng, { role: role, level: lv }), taken);
      p.bat = BB.makeBatter(rng, { pitcher: true, pos: 'P' }); p.bat.name = p.name; p.bat.id = p.id;
      return p;
    }
    R.starters = [0, 1, 2, 3, 4].map(function () { return pitcher('SP'); });
    R.relievers = [0, 1, 2, 3, 4, 5, 6, 7].map(function () { return pitcher('RP'); });
    R.manager = { hook: Math.min(0.85, Math.max(0.3, rng.n(0.5, 0.12))), warmAt: 0.2,
                  ibb: Math.max(0.02, rng.n(IBB_GAP[0], IBB_GAP[1])), glove: Math.max(0, rng.n(GLOVE_BAR[0], GLOVE_BAR[1])) };
    return R;
  }
  // The day's team: the scarce positions filled first, each by the best man the roster has who can play there (a catcher
  // catches, a shortstop plays short: only catchers have a catcher's arm and blocking, and the first build that let anyone
  // catch scored a fifth fewer runs); the best remaining bat at DH; the rest on the bench (each keeps the position he was
  // found for as the one he can cover). gameNo turns the rotation.
  var ELIG = { C: ['C'], SS: ['SS'], '2B': ['2B', 'SS'], '3B': ['3B', 'SS'], CF: ['CF'], LF: ['LF', 'CF', 'RF'], RF: ['RF', 'CF', 'LF'], '1B': ['1B', '3B', 'DH', 'C', 'LF', 'RF'] };
  function teamFromRoster(R, gameNo) {
    var free = R.hitters.slice(), byPos = {};
    ['C', 'SS', 'CF', '2B', '3B', 'RF', 'LF', '1B'].forEach(function (pos) {
      var best = null; free.forEach(function (b) { if (ELIG[pos].indexOf(b.homePos) < 0) return; var v = BB.playerValue(b, pos); if (!best || v > best.v) best = { b: b, v: v }; });
      if (!best) free.forEach(function (b) { var v = BB.playerValue(b, pos); if (!best || v > best.v) best = { b: b, v: v }; });   // nobody suited left: the best of the rest
      free.splice(free.indexOf(best.b), 1); best.b.pos = pos; byPos[pos] = best.b;
    });
    var dh = free.slice().sort(function (a, b) { return BB.hitterValue(b) - BB.hitterValue(a); })[0];
    free.splice(free.indexOf(dh), 1); dh.pos = 'DH'; byPos.DH = dh;
    var players = POS.map(function (pos) { return byPos[pos]; }).sort(function (a, b) { return batScore(b) - batScore(a); });
    var slots = [3, 4, 2, 1, 5, 6, 7, 8, 9], order = [];
    players.forEach(function (p, i) { order[slots[i] - 1] = p; });
    free.forEach(function (b) { b.pos = b.homePos === 'DH' ? '1B' : b.homePos; b.benchPos = b.pos; });
    function fresh(p) { p.load = 0; p.used = false; p.pitchesToday = 0; p.warm = 0; return p; }   // a day's rest between games
    var pen = R.relievers.map(fresh).sort(function (a, b) { return b.pitches[0].velo - a.pitches[0].velo; });
    return { city: R.city, nick: R.nick, name: R.name, level: R.level, lineup: order, bench: free, starter: fresh(R.starters[(gameNo || 0) % R.starters.length]),
             bullpen: pen, closer: pen[0], manager: R.manager };
  }

  // ------------------------------------------------------------ the game
  function simGame(A, H, o) {
    o = o || {};
    var rng = o.rng || BB.makeRng(o.seed || 1);
    var rules = o.rules || (rng.u() < 0.5 ? 'AL' : 'NL');
    var env = o.env || BB.mlbEnv(rng), ump = o.ump || named(rng, BB.makeUmp(rng));
    var G = { rules: rules, env: env, ump: ump, teams: [A, H], score: [0, 0], innings: [], plays: [], pitches: 0, over: false,
              hits: [0, 0], errors: [0, 0], lob: [0, 0], stats: [newStats(), newStats()], changes: [0, 0] };
    var side = [teamState(A, rules), teamState(H, rules)];
    var inning = 1, half = 0;   // half 0 = top (A bats), 1 = bottom (H bats)

    while (!G.over && inning <= 18) {
      var bat = side[half], def = side[1 - half], defTeam = G.teams[1 - half];
      var inn = { n: inning, half: half, runs: 0, plays: [] };
      var outs = 0, bases = [null, null, null, null], runsBefore = G.score[half];
      startHalf(def, defTeam, inning, G.score[1 - half] - G.score[half], rng);
      while (outs < 3) {
        // the pitcher
        managePitching(def, defTeam, inning, outs, bases, G.score[1 - half] - G.score[half], bat, G, half, rng);
        var P = def.pitcher;
        // the batter (in the NL the pitcher's spot may be pinch-hit)
        var B = nextBatter(bat, inning, G.score[half] - G.score[1 - half], rng);
        var D = def.defense, sb = BB.batterSide(B, P);
        BBField.positionDefense(D, B, sb);
        var seenOwn = bat.seen[P.id + ':' + B.id] || 0, seenTeam = bat.seenTeam[P.id] || 0;
        var outsAtPA = outs, basesAtPA = bases.slice();   // the play records the state he came up to (a steal or a pickoff during the at-bat changes it)
        var caughtFoul = null, S = G.stats[half], SD = G.stats[1 - half];
        // THE RUNNING GAME, pitch by pitch. A runner on first (or on second with
        // third open and fewer than two out) weighs his own time to the bag - his
        // jump, then a sprint from a moving lead - against this battery's: the
        // pitcher's delivery and the catcher's pop time are public knowledge. He
        // goes when the odds clear his own bar (runAggr), picking his pitch; then
        // the stopwatch and the throw decide it, a pitch in the dirt costing the
        // catcher a step. A pitch the catcher cannot hold - in the dirt, wide, over
        // his head, judged against his blocking - sends every runner up a base.
        // A third out on the bases mid-count ends the PA without charging one.
        var going = null, paRuns = 0, C = def.catcher, basesAtPitch = null, BASE = 90 * BB.units.FT, pickN = 0, pickLog = [];
        // THE PICKOFF. With a man on first and second open the pitcher throws over now
        // and then: more often the more the runner threatens to steal (his own odds of
        // making it, as he weighs them below), less after each throw. The runner is off
        // at his primary lead; he is back if his dive beats the throw - his read of the
        // move (half his jump) and his lead at diving speed against the pitcher's move
        // and throw (PK_T + pickMove), with scatter on both. A wild throw over gives him
        // second, now and then third.
        function pickoffs() {
          while (bases[1] && !bases[2]) {
            var pl = bases[1], tRun = pl.jump + BBField.stealTime(pl, BASE - BBField.LEAD_STEAL), tBall = P.holdTime + C.popTime;
            var threat = Phi((tBall + 0.15 - tRun) / 0.2), pThrow = PK_RATE * (0.3 + threat) * Math.pow(0.55, pickN);
            if (rng.u() >= pThrow) return null;
            pickN++;
            var back = 0.5 * pl.jump + PK_LEAD / V_BACK + rng.n(0, 0.09), ball = PK_T + (P.pickMove || 0) + rng.n(0, 0.07);
            var ev = { id: pl.id, from: 1, basesBefore: bases.slice(), outsBefore: outs, error: rng.u() < PK_ERR };
            ev.out = !ev.error && back > ball; ev.margin = +(ball - back).toFixed(3);
            pickLog.push(ev);
            if (ev.out) { bases[1] = null; outs++; S.po++; SD.pko++; }
            else if (ev.error) { bases[1] = null; var to = rng.u() < 0.25 && !bases[3] ? 3 : 2; bases[to] = pl; ev.to = to; SD.e++; G.errors[1 - half]++; }
            ev.basesAfter = bases.slice(); ev.outsAfter = outs;
            if (outs >= 3) return { abort: true };
          }
          return null;
        }
        function beforePitch(st) {
          var ab = pickoffs(); if (ab) return ab;
          basesAtPitch = bases.slice(); going = null;
          if (st.balls === 3) return null;                                    // ball four is a free base anyway
          var from = bases[1] && !bases[2] ? 1 : bases[2] && !bases[3] && outs < 2 ? 2 : 0;
          if (!from) return null;
          var pl = bases[from], to = from + 1;
          var tRun = pl.jump + BBField.stealTime(pl, BASE - BBField.LEAD_STEAL);
          var tBall = P.holdTime + C.popTime - (to === 3 ? 0.2 : 0);
          var p = Phi((tBall + 0.15 - tRun) / 0.2);
          if (p < 0.72 + pl.runAggr + (to === 3 ? 0.12 : 0) || rng.u() > 0.22) return null;   // he picks his pitch
          going = { from: from, to: to, id: pl.id, p: p };
          return going;
        }
        function afterPitch(rec, end) {
          var res = rec.result, pk = rec.pitch.plate, hit = res === 'in_play' || res === 'hr' || (res === 'foul' && end === 'BIP');
          rec.bases = basesAtPitch; rec.outsAt = outs;   // after any pickoff, before this pitch's steal
          if (pickLog.length) { rec.pickoffs = pickLog; pickLog = []; }
          if (going && hit) rec.going = going.from;                            // he was running on contact
          else if (going && res === 'foul') rec.steal = { id: going.id, from: going.from, back: true };
          else if (going && !((end === 'BB' || end === 'HBP') && going.from === 1) && !(end === 'K' && outs >= 2)) {
            var g = going, pl = bases[g.from], dirt = pk.z < 0.12 || Math.abs(pk.x) > 0.75;
            // the stopwatch: his jump varies, the pitcher's delivery varies (a slide step
            // or not), the throw is not always on the bag
            var tRun = pl.jump + rng.n(0, 0.08) + BBField.stealTime(pl, BASE - BBField.LEAD_STEAL);
            var tBall = P.holdTime + C.popTime - (g.to === 3 ? 0.2 : 0) + rng.n(0, 0.22) + (dirt ? 0.3 : 0);
            var wildThrow = rng.u() < 0.03, safe = wildThrow || tRun < tBall + 0.15;
            rec.steal = { id: g.id, from: g.from, to: g.to, safe: safe, tRun: tRun, tBall: tBall, wild: wildThrow };
            bases[g.from] = null;
            if (safe && wildThrow) {   // the throw gets away: everyone moves up a base, the stealer one past his target (until v1.1 he landed on a man already on third, who vanished)
              if (bases[3]) { paRuns++; bases[3] = null; rec.steal.scored = 1; }
              for (var bb2 = 2; bb2 >= 1; bb2--) if (bases[bb2]) { bases[bb2 + 1] = bases[bb2]; bases[bb2] = null; }
            }
            if (safe) { var to2 = wildThrow ? Math.min(4, g.to + 1) : g.to; if (to2 >= 4) paRuns++; else bases[to2] = pl; S.sb++; if (wildThrow) { SD.e++; G.errors[1 - half]++; } }
            else { outs++; S.cs++; }
          }
          // a pitch the catcher cannot hold
          if (!hit && res !== 'hbp' && res !== 'foul' && (bases[1] || bases[2] || bases[3])) {
            // bounced (3.1% of pitches, as in the league), below the knees (7.7%), wide or over his head (1.3%), or an ordinary
            // one he simply misses. The chances are set by hand in proportion and scaled so wild pitches per game come out
            // as the league's with the league's share of pitches in each band (statcast/locations.py; engine v1.4)
            var low = pk.z < 0.35, wide = Math.abs(pk.x) > 0.6 || pk.z > 1.9, brk = /^(CU|SL|ST|FS)$/.test(rec.pitch.type);
            var pPast = (pk.z < 0.15 ? 0.24 : low ? 0.076 : wide ? 0.08 : 0.006) * (brk ? 1.4 : 1) * (1 - C.block);
            if (rng.u() < pPast) {
              var moved = [];
              if (bases[3]) { paRuns++; moved.push(3); bases[3] = null; }
              if (bases[2]) { bases[3] = bases[2]; bases[2] = null; moved.push(2); }
              if (bases[1]) { bases[2] = bases[1]; bases[1] = null; moved.push(1); }
              rec.wild = { kind: low || wide ? 'WP' : 'PB', from: moved, runs: moved.indexOf(3) >= 0 ? 1 : 0 };
              if (low || wide) SD.wp++; else SD.pb++;
            }
          }
          if (rec.steal || rec.wild) { rec.basesAfter = bases.slice(); rec.outsAfter = outs; }
          return (!end && outs >= 3) ? { abort: true } : null;
        }
        // THE INTENTIONAL WALK (signalled, the 2017-2022 rule: no pitches). With first
        // base open and a man in scoring position, late (or with the pitcher on deck and
        // two out), close, the manager puts this hitter on when the next one is clearly
        // weaker: the scouts' expected-wOBA gap between the two clears his own bar.
        var pa;
        if (walkHim(def, bat, B, bases, outs, inning, G.score[1 - half] - G.score[half])) pa = { result: 'IBB', pitches: [] };
        else {
          pa = BB.simPA(P, B, { env: env, ump: ump, framing: def.catcher.framing || 0, seen: seenOwn + 0.25 * (seenTeam - seenOwn),
                                runnersOn: !!(bases[1] || bases[2] || bases[3]), rec: true,
                                foulCatch: function (bb) { caughtFoul = BBField.foulCatch(bb, D, env, rng); return !!caughtFoul; },
                                beforePitch: beforePitch, afterPitch: afterPitch }, rng);
          if (pickLog.length) pa.pickoffsEnd = pickLog;   // thrown over, with no pitch after: the inning ended on the bases
        }
        var n = pa.pitches.length;
        bat.seen[P.id + ':' + B.id] = seenOwn + n; bat.seenTeam[P.id] = seenTeam + n;
        P.pitchesToday += n; G.pitches += n;
        var play = { inning: inning, half: half, outs: outsAtPA, bases: basesAtPA, batter: B, pitcher: P, pa: pa, count: n ? pa.pitches[n - 1].count : '0-0',
                     defense: D.map(function (F) { return { pos: F.pos, id: F.pl.id, name: F.pl.name, at: F.at.slice(), std: F.std.slice(), react: F.pl.react, speed: F.pl.speed, route: F.pl.route }; }),
                     pitchCount: P.pitchesToday - n, load: P.load - n, seen: seenOwn + 0.25 * (seenTeam - seenOwn),
                     newPitcher: def.justChanged || null, pinchHit: bat.justPinch || null, defSubs: def.justSubs || null, ibb: pa.result === 'IBB' || null,
                     warming: def.warming ? { id: def.warming.id, name: def.warming.name } : null,
                     warmingBat: bat.warming ? { id: bat.warming.id, name: bat.warming.name } : null };
        def.justChanged = null; bat.justPinch = null; def.justSubs = null;
        var r = pa.result, runs = paRuns;
        if (r !== 'END') S.pa++;
        if (r === 'END') { play.desc = pa.pickoffsEnd ? 'picked off, inning over' : 'caught stealing, inning over'; bat.idx--; }   // no plate appearance: he leads off next inning
        else if (r === 'IBB') { S.bb++; S.ibb++; play.desc = 'intentional walk'; runs += advanceForced(bases, B); }
        else if (r === 'K') { outs++; S.ab++; S.k++; play.desc = 'strikeout' + (pa.pitches[n - 1].result === 'called_strike' ? ' looking' : ' swinging') + (pa.pitches[n - 1].steal && !pa.pitches[n - 1].steal.safe ? ', runner thrown out' : ''); }
        else if (r === 'BB' || r === 'HBP') {
          if (r === 'BB') S.bb++; else S.hbp++;
          play.desc = r === 'BB' ? 'walk' : 'hit by pitch';
          runs += advanceForced(bases, B);
        } else {
          var res = BBField.resolve(pa.bb, B, bases, outs, D, env, rng, { foulCaught: !!pa.foulCaught, side: sb, going: pa.pitches[n - 1].going || 0 });
          play.play = res; play.desc = res.desc;
          outs += res.outsMade; runs += res.runs; bases = res.bases;
          if (res.hit !== 'SF') S.ab++;
          if (res.hit === '1B' || res.hit === '2B' || res.hit === '3B' || res.hit === 'HR') { S.h++; G.hits[half]++; if (res.hit === '2B') S.d++; if (res.hit === '3B') S.t++; if (res.hit === 'HR') S.hr++; }
          if (res.hit === 'SF') S.sf++;
          if (res.error) { SD.e++; G.errors[1 - half]++; }
          if (res.dp) SD.dp++;
          if (res.hit === 'E') S.roe++;
          S.rbi += res.rbi;
          S[res.type]++;
        }
        G.score[half] += runs; S.r += runs; inn.runs += runs;
        play.runs = runs; play.outsAfter = outs; play.basesAfter = bases.slice(); play.score = G.score.slice();
        inn.plays.push(play); G.plays.push(play);
        // a walk-off
        if (half === 1 && inning >= 9 && G.score[1] > G.score[0]) { G.over = true; break; }
      }
      if (outs >= 3) G.lob[half] += (bases[1] ? 1 : 0) + (bases[2] ? 1 : 0) + (bases[3] ? 1 : 0);
      G.innings.push(inn);
      endHalf(def, bat);
      if (G.over) break;
      // is the game over?
      if (half === 1) {
        if (inning >= 9 && G.score[0] !== G.score[1]) G.over = true;
        inning++; half = 0;
      } else {
        if (inning >= 9 && G.score[1] > G.score[0]) { G.over = true; }   // home leads after the top of the ninth: no bottom
        half = 1;
      }
    }
    G.finalInning = G.innings[G.innings.length - 1].n;
    G.lineScore = [[], []];
    G.innings.forEach(function (inn) { G.lineScore[inn.half][inn.n - 1] = inn.runs; });
    G.pitchersUsed = [side[0].used.length, side[1].used.length];
    return G;
  }

  function newStats() {
    return { pa: 0, ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, ibb: 0, hbp: 0, k: 0, sf: 0, rbi: 0, roe: 0, e: 0, dp: 0, sb: 0, cs: 0, po: 0, pko: 0, wp: 0, pb: 0, GB: 0, LD: 0, FB: 0, PU: 0, subs: 0, dswitch: 0 };
  }
  function Phi(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  function teamState(T, rules) {
    var fielders = T.lineup.filter(function (b) { return b.pos !== 'DH'; });
    var st = { team: T, rules: rules, order: T.lineup.slice(), idx: 0, pitcher: T.starter, used: [T.starter],
               seen: {}, seenTeam: {}, bench: T.bench.slice(), warming: null, warmHalves: 0, catcher: T.lineup.filter(function (b) { return b.pos === 'C'; })[0] };
    if (rules === 'NL') st.order = st.order.map(function (b) { return b.pos === 'DH' ? null : b; });   // the pitcher bats in the DH's slot
    st.defense = BBField.makeDefense(fielders.concat([T.starter]));
    T.starter.used = true;
    return st;
  }
  function setPitcher(st, P) {
    st.justChanged = { out: st.pitcher, in: P };
    st.pitcher = P; P.used = true; st.used.push(P);
    st.defense = st.defense.map(function (F) { return F.pos === 'P' ? { pos: 'P', pl: P, at: F.at, std: F.std } : F; });
  }
  function nextBatter(st, inning, diff, rng) {
    var B = st.order[st.idx % 9];
    if (B === null) {                       // the pitcher's spot (NL)
      var P = st.pitcher, f = BB.fatigueOf(P), M = st.team.manager;
      var ph = inning >= 6 && st.bench.length && (f >= M.hook - 0.15 || diff < 0);
      if (ph) {   // the best bat on the bench; the backup catcher last
        var pick = st.bench.slice().sort(function (a, b) { return (b.benchPos === 'C' ? -1 : 0) - (a.benchPos === 'C' ? -1 : 0) || BB.hitterValue(b) - BB.hitterValue(a); })[0];
        st.bench.splice(st.bench.indexOf(pick), 1); B = pick; st.order[st.idx % 9] = B; st.pinchHitFor = P; st.justPinch = { batter: B, forPitcher: P };
      }
      else B = P.bat;
    }
    st.idx++;
    return B;
  }
  function advanceForced(bases, B) {        // a walk: runners move only when pushed
    var runs = 0;
    if (bases[1]) { if (bases[2]) { if (bases[3]) { runs++; } bases[3] = bases[2]; } bases[2] = bases[1]; }
    bases[1] = B;
    return runs;
  }

  // ------------------------------------------------------- the manager
  function startHalf(def, T, inning, lead, rng) {
    // pitcher who was pinch-hit for is done; the pen takes over
    if (def.pinchHitFor === def.pitcher) { bringIn(def, T, inning, lead, rng); def.pinchHitFor = null; }
    // a reliever who has had his inning gives way to a fresh arm (the closer keeps his save)
    var Pn = def.pitcher;
    if (Pn.role === 'RP' && Pn.pitchesToday >= 12 && !(Pn === T.closer && inning >= 9 && lead > 0 && lead <= 3) &&
        T.bullpen.some(function (p) { return !p.used; })) { bringIn(def, T, inning, lead, rng); }
    // warming: keep an arm going if the starter is getting there, or late in the game
    var P = def.pitcher, f = BB.fatigueOf(P), M = T.manager;
    if (!def.warming && (f >= M.hook - M.warmAt || P.pitchesToday >= 80 || (P.role === 'RP' && f >= 0.5) || (inning >= 8 && P.role === 'RP'))) {
      def.warming = pickReliever(def, T, inning, lead); def.warmHalves = 0;
    }
    if (def.warming) { def.warming.load += 3; def.warmHalves++; }   // warming up costs pitches
    if (def.warming && def.warmHalves > 3) { def.warming = null; }  // sat down; the load stays
    lateDefence(def, T, inning, lead);
  }
  // LATE DEFENCE. Protecting a lead of one to three from the 8th on, the manager sends
  // a bench glove out for a starter when the runs the glove saves over the innings left
  // outweigh the runs the bat costs in the plate appearances left (the farm's own sums:
  // FIELD_VALUE per ball in play, expected wOBA per plate appearance), by his own bar.
  // The catcher stays.
  function lateDefence(def, T, inning, lead) {
    if (inning < 8 || lead < 1 || lead > 3 || !def.bench.length) return;
    var left = Math.max(1, 10 - inning), subs = [];
    def.defense.forEach(function (F, fi) {
      if (F.pos === 'P' || F.pos === 'C' || subs.length >= 2) return;
      var best = null;
      def.bench.forEach(function (b) {
        if (!canPlay(b, F.pos) || subs.some(function (q) { return q.in === b; })) return;
        var gain = (BB.fieldValue(F.pl, F.pos) - BB.fieldValue(b, F.pos)) * BIP_INN * left, cost = (BB.hitterValue(F.pl) - BB.hitterValue(b)) * PA_INN * left / WOBA_SCALE;
        if (!best || gain - cost > best.net) best = { b: b, net: gain - cost };
      });
      if (best && best.net > T.manager.glove) subs.push({ fi: fi, in: best.b, net: best.net });
    });
    subs.forEach(function (q) { substitute(def, q.fi, q.in); });
  }
  // a bench man takes a fielder's place: his position, his spot in the order; the man he replaces is done
  function substitute(def, fi, b) {
    var F = def.defense[fi], out = F.pl, slot = def.order.indexOf(out);
    b.pos = F.pos; def.bench.splice(def.bench.indexOf(b), 1);
    if (slot >= 0) def.order[slot] = b;
    def.defense[fi] = { pos: F.pos, pl: b, at: F.at, std: F.std };
    (def.justSubs = def.justSubs || []).push({ out: out, in: b, pos: F.pos, slot: slot });
    return { out: out, in: b, pos: F.pos, slot: slot };
  }
  // THE DOUBLE SWITCH (NL). Bringing in a pitcher whose spot would bat within the next
  // two, the manager also changes a fielder whose turn is furthest off - the man who
  // batted last, as near as the bench allows: the new pitcher bats in that man's spot
  // and the bench man in the pitcher's, playing that man's position.
  function doubleSwitch(def) {
    if (def.rules !== 'NL' || def.bench.length < 2) return null;   // keeps a bat on the bench for the pitcher's spot
    var ps = def.order.indexOf(null); if (ps < 0) return null;
    if ((ps - def.idx % 9 + 9) % 9 > 1) return null;   // his spot is not among the next two
    for (var back = 1; back <= 5; back++) {
      var j = (def.idx - back + 18) % 9, X = def.order[j]; if (!X || j === ps) continue;
      var fi = -1; def.defense.forEach(function (F, k) { if (F.pl === X) fi = k; }); if (fi < 0 || def.defense[fi].pos === 'C') continue;
      var pos = def.defense[fi].pos, b = def.bench.filter(function (q) { return canPlay(q, pos); }).sort(function (p, q) { return BB.fieldValue(p, pos) - BB.fieldValue(q, pos); })[0];
      if (!b) continue;
      var sw = substitute(def, fi, b); def.justSubs = null;   // reported with the pitching change instead
      def.order[ps] = b; def.order[j] = null;
      return { out: sw.out, in: b, pos: pos, slotIn: ps, slotP: j };
    }
    return null;
  }
  // THE INTENTIONAL WALK: is this the man to put on?
  function walkHim(def, bat, B, bases, outs, inning, lead) {
    if (bases[1] || !(bases[2] || bases[3]) || lead < -1 || lead > 2) return false;
    var N = bat.order[bat.idx % 9], pitcherNext = N === null;
    if (pitcherNext) N = bat.pitcher.bat;
    if (inning < 7 && !(pitcherNext && outs === 2)) return false;
    var gap = BB.hitterValue(B) - BB.hitterValue(N), bar = def.team.manager.ibb + (outs === 0 ? 0.03 : 0) - (inning >= 9 ? 0.015 : 0);
    return gap > bar;
  }
  function endHalf(def, bat) {
    def.pitcher.load = Math.max(0, def.pitcher.load - 0.75);         // a rest between innings recovers a little
  }
  function managePitching(def, T, inning, outs, bases, lead, bat, G, half, rng) {
    var P = def.pitcher, f = BB.fatigueOf(P), M = T.manager, pull = false;
    if (P.role === 'SP') pull = f >= M.hook || P.pitchesToday >= 115;
    else pull = f >= 0.9 || (P.pitchesToday >= 35);
    // trouble: runners on, late, a tired arm
    if (!pull && f >= M.hook - 0.2 && inning >= 6 && (bases[1] || bases[2] || bases[3]) && outs < 2 && lead <= 2) pull = true;
    // a save situation in the ninth: the closer, if he is fresh
    var closer = T.closer;
    if (!pull && inning >= 9 && lead > 0 && lead <= 3 && P !== closer && !closer.used && outs === 0 && !(bases[1] || bases[2] || bases[3])) { pull = true; def.warming = closer; }
    if (pull && T.bullpen.some(function (p) { return !p.used; })) { bringIn(def, T, inning, lead, rng); G.changes[1 - half]++; }
  }
  function pickReliever(def, T, inning, lead) {
    var fresh = T.bullpen.filter(function (p) { return !p.used && p !== T.closer; });
    if (!fresh.length) fresh = T.bullpen.filter(function (p) { return !p.used; });
    if (!fresh.length) return null;
    // a left-hander for a left-handed group due up
    var due = [0, 1, 2].map(function (k) { return def.oppOrder ? def.oppOrder[k] : null; });
    fresh.sort(function (a, b) { return a.load - b.load; });
    return fresh[0];
  }
  function bringIn(def, T, inning, lead, rng) {
    var R = def.warming || pickReliever(def, T, inning, lead);
    if (!R) return;
    if (!def.warming) R.load += 4;          // came in cold: he throws his warm-up pitches anyway
    def.warming = null; def.warmHalves = 0;
    setPitcher(def, R);
    var ds = doubleSwitch(def); if (ds) def.justChanged.doubleSwitch = ds;
  }

  // ----------------------------------------------------------- reports
  function line(G) {
    var s = G.stats, A = G.teams[0], H = G.teams[1];
    function tl(i) { var t = s[i]; return G.score[i] + ' R ' + t.h + ' H ' + t.e + ' E'; }
    return A.name + ' ' + tl(0) + '  at  ' + H.name + ' ' + tl(1) + '  (' + G.finalInning + ' inn, ' + G.rules + ', ' + G.pitches + ' pitches, ' + G.pitchersUsed.join('+') + ' pitchers)';
  }
  function playByPlay(G, maxInnings) {
    var out = [];
    G.innings.forEach(function (inn) {
      if (maxInnings && inn.n > maxInnings) return;
      out.push('--- ' + (inn.half ? 'bottom' : 'top') + ' ' + inn.n + '  ' + G.teams[inn.half].nick + ' batting');
      inn.plays.forEach(function (p) {
        var b = ['', '1st', '2nd', '3rd'].filter(function (x, i) { return i && p.bases[i]; }).join(' ');
        out.push('  ' + p.outs + ' out' + (b ? ', on ' + b : '') + ' | ' + p.batter.name + ' vs ' + p.pitcher.name + ' | ' + p.count + ' ' + p.pa.pitches.length + ' pitches | ' +
                 p.desc + (p.runs ? ' (' + p.runs + ' run' + (p.runs > 1 ? 's' : '') + ')' : '') + '  [' + p.score.join('-') + ']');
      });
    });
    return out.join('\n');
  }

  return { version: '1.0', makeTeam: makeTeam, makeRoster: makeRoster, teamFromRoster: teamFromRoster, canPlay: canPlay, simGame: simGame, line: line, playByPlay: playByPlay, newStats: newStats };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBGame;
