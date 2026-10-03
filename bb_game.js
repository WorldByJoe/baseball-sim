/* ============================================================================
   bb_game.js · v0.7 · 2026-10-02

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

   Not here yet: pickoffs, intentional walks, defensive substitutions, double
   switches, injuries, weather that changes during a game.

   CHANGED
     v0.7  a pitch past the catcher is rarer per pitch in the dirt (0.4 of before):
           with the measured command (engine v1.4) four times as many pitches
           bounce, as many as in the league
     v0.6  the running game: steals decided and timed pitch by pitch, wild pitches
           and passed balls from where the pitch crosses against the catcher's
           blocking; a third out on the bases ends a PA uncharged ('END')
     v0.5  the snapshot carries route too, so the screen can judge a foul chase
     v0.4  the defence snapshot carries each man's react and speed, so the screen
           can show the men a ball beats breaking for it
     v0.3  each play notes who is warming in either bullpen
============================================================================ */

var BBGame = (function () {
  'use strict';
  var POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

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
    var players = POS.map(function (pos) { return named(rng, BB.makeBatter(rng, { pos: pos }), taken); });
    players.sort(function (a, b) { return batScore(b) - batScore(a); });
    // 3-4-2-1-5-6-7-8-9 by quality
    var slots = [3, 4, 2, 1, 5, 6, 7, 8, 9], order = [];
    players.forEach(function (p, i) { order[slots[i] - 1] = p; });
    t.lineup = order;
    t.bench = [0, 1, 2].map(function () { return named(rng, BB.makeBatter(rng, { pos: 'DH' }), taken); });
    function pitcher(role) {
      var p = named(rng, BB.makePitcher(rng, { role: role }), taken);
      p.bat = BB.makeBatter(rng, { pitcher: true, pos: 'P' }); p.bat.name = p.name; p.bat.id = p.id;
      p.warm = 0; p.used = false; p.pitchesToday = 0;
      return p;
    }
    t.starter = pitcher('SP');
    t.bullpen = [0, 1, 2, 3, 4, 5, 6].map(function () { return pitcher('RP'); });
    t.bullpen.sort(function (a, b) { return b.pitches[0].velo - a.pitches[0].velo; });
    t.closer = t.bullpen[0];
    t.manager = { hook: Math.min(0.85, Math.max(0.3, rng.n(0.5, 0.12))), warmAt: 0.2 };
    return t;
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
        var going = null, paRuns = 0, C = def.catcher, basesAtPitch = null, BASE = 90 * BB.units.FT;
        function beforePitch(st) {
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
          rec.bases = basesAtPitch;
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
        var pa = BB.simPA(P, B, { env: env, ump: ump, framing: def.catcher.framing || 0, seen: seenOwn + 0.25 * (seenTeam - seenOwn),
                                  runnersOn: !!(bases[1] || bases[2] || bases[3]), rec: true,
                                  foulCatch: function (bb) { caughtFoul = BBField.foulCatch(bb, D, env, rng); return !!caughtFoul; },
                                  beforePitch: beforePitch, afterPitch: afterPitch }, rng);
        var n = pa.pitches.length;
        bat.seen[P.id + ':' + B.id] = seenOwn + n; bat.seenTeam[P.id] = seenTeam + n;
        P.pitchesToday += n; G.pitches += n;
        var play = { inning: inning, half: half, outs: outs, bases: bases.slice(), batter: B, pitcher: P, pa: pa, count: pa.pitches[n - 1].count,
                     defense: D.map(function (F) { return { pos: F.pos, id: F.pl.id, name: F.pl.name, at: F.at.slice(), std: F.std.slice(), react: F.pl.react, speed: F.pl.speed, route: F.pl.route }; }),
                     pitchCount: P.pitchesToday - n, load: P.load - n, seen: seenOwn + 0.25 * (seenTeam - seenOwn),
                     newPitcher: def.justChanged || null, pinchHit: bat.justPinch || null,
                     warming: def.warming ? { id: def.warming.id, name: def.warming.name } : null,
                     warmingBat: bat.warming ? { id: bat.warming.id, name: bat.warming.name } : null };
        def.justChanged = null; bat.justPinch = null;
        var r = pa.result, runs = paRuns;
        if (r !== 'END') S.pa++;
        if (r === 'END') { play.desc = 'caught stealing, inning over'; bat.idx--; }   // no plate appearance: he leads off next inning
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
    return { pa: 0, ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, k: 0, sf: 0, rbi: 0, roe: 0, e: 0, dp: 0, sb: 0, cs: 0, wp: 0, pb: 0, GB: 0, LD: 0, FB: 0, PU: 0 };
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
      if (ph) { B = st.bench.shift(); st.order[st.idx % 9] = B; st.pinchHitFor = P; st.justPinch = { batter: B, forPitcher: P }; }
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

  return { version: '0.1', makeTeam: makeTeam, simGame: simGame, line: line, playByPlay: playByPlay, newStats: newStats };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBGame;
