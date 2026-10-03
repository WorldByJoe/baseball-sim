/* ============================================================================
   bb_league.js · v0.1 · 2026-10-03

   A professional baseball world (Joe, 2026-10-03): thirty organisations, each
   with a major-league club and a club at each of the five levels below it -
   Triple-A, Double-A, High-A, Single-A and Rookie - every club with a
   standing roster of twenty-six. Minor leaguers play minor leaguers: a good
   Triple-A season is earned against Triple-A pitching, so a man promoted to
   the majors should hit worse there (a medium background to a high one).
   This file builds the world, plays its seasons headless, moves players
   between levels, and measures what promotion does to them.

   THE WORLD. Each club's roster is drawn at its level by the farm (bb_engine:
   the k-th best of six candidates plays at level k), so on the first day the
   levels are the engine's. Ages are drawn by level (display and tie-breaks
   only: no one ages or develops yet - that needs aging curves measured from
   several Statcast seasons, the next step).

   A SEASON. Each level plays its own schedule (every club `games` games, a new
   pairing each day; the home club alternates). The majors play AL or NL rules
   by the home club's league, the minors use a designated hitter. Every plate
   appearance is tallied for the batter and the pitcher.

   PROMOTION, at the end of a season, within each organisation and between
   each pair of adjacent levels: the organisation's score for a man is its
   scouting of him (bb_engine's `scouted`, standardised over the world) plus
   his season against his own level, shrunk by his playing time; a man below
   whose score beats a man above by PROMO_MARGIN swaps with him (hitters for
   hitters found for the same position, starters for starters, relievers for
   relievers; at most two of each kind per boundary). The organisation never
   sees a man's traits, only its scouts' estimate and his line.

   THE PROMOTION DROP: a promoted man's wOBA in his last season below against
   his first season above, beside the men who stayed (their change is the
   regression to the mean that any selected season shows).

   Usage: var U = BBLeague.create(seed, { orgs: 30 });
          BBLeague.playSeason(U, { games: 60 });  BBLeague.promote(U);
          BBLeague.report(U)  ->  text;   BBLeague.stable(U)  ->  plain object for the screen

   CHANGED
     v0.1  first build
============================================================================ */

var BBLeague = (function () {
  'use strict';
  var LEVELS = [{ key: 'MLB', name: 'Major League' }, { key: 'AAA', name: 'Triple-A' }, { key: 'AA', name: 'Double-A' },
                { key: 'A+', name: 'High-A' }, { key: 'A', name: 'Single-A' }, { key: 'Rk', name: 'Rookie' }];
  // ages by level, mean and spread, hitters and pitchers: the majors and Triple-A measured (statcast/levels.py, 2025:
  // hitters 28.3 +- 3.7 and 26.9 +- 3.0, pitchers 29.4 +- 3.9 and 27.6 +- 3.3); the levels below set by hand from the
  // usual shape of a system (Rookie ball about 20)
  var AGE = [[28.3, 3.7], [26.9, 3.0], [24.2, 1.8], [22.6, 1.6], [21.3, 1.5], [20.0, 1.5]];
  var AGE_P = [[29.4, 3.9], [27.6, 3.3], [24.6, 1.9], [23.0, 1.7], [21.6, 1.6], [20.3, 1.6]];
  // linear weights of the plate appearance (FanGraphs, about 2024)
  var W = { BB: 0.69, HBP: 0.72, '1B': 0.88, '2B': 1.25, '3B': 1.58, HR: 2.03 };
  var PROMO_MARGIN = 0.25, PERF_W = 0.8, SHRINK_PA = 250;

  function create(seed, o) {
    o = o || {};
    var nOrg = o.orgs || 30, rng = BB.makeRng(seed), names = BBNames.league(rng, nOrg);
    var U = { seed: seed, season: 0, orgs: [], promotions: [], history: [] };
    names.forEach(function (nm, oi) {
      var org = { id: oi, league: oi < nOrg / 2 ? 'AL' : 'NL', clubs: [] };
      nm.teams.forEach(function (tn, li) {
        var R = BBGame.makeRoster(rng, { city: tn.city, nick: tn.nick, level: li + 1 });
        R.org = oi; R.games = 0; R.w = 0; R.l = 0;
        R.hitters.forEach(function (p) { p.age = Math.round(Math.max(18, Math.min(40, rng.n(AGE[li][0], AGE[li][1])))); });
        R.starters.concat(R.relievers).forEach(function (p) { p.age = Math.round(Math.max(18, Math.min(41, rng.n(AGE_P[li][0], AGE_P[li][1])))); });
        R.hitters.concat(R.starters, R.relievers).forEach(function (p) { p.stats = []; p.org = oi; });
        org.clubs.push(R);
      });
      U.orgs.push(org);
    });
    return U;
  }
  function clubsAt(U, lv) { return U.orgs.map(function (org) { return org.clubs[lv - 1]; }); }
  function line(p, U, lv, club) {   // this season's line for a man at a level (a man can have two lines in a season only after a move, which is between seasons)
    var s = p.stats[p.stats.length - 1];
    if (!s || s.season !== U.season || s.level !== lv) { s = { season: U.season, level: lv, club: club.name, G: 0, PA: 0, AB: 0, H: 0, d: 0, t: 0, HR: 0, BB: 0, IBB: 0, HBP: 0, K: 0, SF: 0, R: 0, wnum: 0, wden: 0, BF: 0, outs: 0, GS: 0, Ha: 0, HRa: 0, BBa: 0, Ka: 0, HBPa: 0, Ra: 0, wnumA: 0, wdenA: 0 }; p.stats.push(s); }
    return s;
  }
  // every plate appearance of a game into the season lines
  function tally(U, G, lv, home, away) {
    var clubOf = {}; [away, home].forEach(function (R) { R.hitters.concat(R.starters, R.relievers).forEach(function (p) { clubOf[p.id] = R; }); });
    var seenG = {};
    G.plays.forEach(function (pl) {
      var B = pl.batter, P = pl.pitcher, r = pl.pa.result, hit = pl.play ? pl.play.hit : null;
      if (r === 'END') return;
      var wv = r === 'BB' ? W.BB : r === 'HBP' ? W.HBP : (hit === '1B' || hit === '2B' || hit === '3B' || hit === 'HR') ? W[hit] : 0;
      var den = r === 'IBB' ? 0 : 1;   // wOBA leaves out intentional walks
      if (!B.isPitcher && clubOf[B.id]) {
        var s = line(B, U, lv, clubOf[B.id]); if (!seenG[B.id]) { s.G++; seenG[B.id] = 1; }
        s.PA++; s.wnum += wv; s.wden += den;
        if (r === 'K') { s.AB++; s.K++; } else if (r === 'BB') s.BB++; else if (r === 'IBB') { s.BB++; s.IBB++; } else if (r === 'HBP') s.HBP++;
        else { if (hit === 'SF') { s.SF++; s.wden += 0; } else s.AB++; if (wv) { s.H++; if (hit === '2B') s.d++; if (hit === '3B') s.t++; if (hit === 'HR') s.HR++; } }
      }
      if (clubOf[P.id]) {
        var q = line(P, U, lv, clubOf[P.id]); if (!seenG[P.id]) { q.G++; seenG[P.id] = 1; }
        q.BF++; q.outs += Math.max(0, pl.outsAfter - pl.outs); q.Ra += pl.runs || 0; q.wnumA += wv; q.wdenA += den;
        if (r === 'K') q.Ka++; else if (r === 'BB' || r === 'IBB') q.BBa++; else if (r === 'HBP') q.HBPa++; else if (wv) { q.Ha++; if (hit === 'HR') q.HRa++; }
      }
    });
  }
  // A season: every level plays its own schedule
  function playSeason(U, o) {
    o = o || {};
    var games = o.games || 60, log = o.log || function () {};
    U.season++;
    for (var lv = 1; lv <= LEVELS.length; lv++) {
      var rng = BB.makeRng((U.seed * 7919 + U.season * 101 + lv) >>> 0), C = clubsAt(U, lv);
      for (var day = 0; day < games; day++) {
        var order = C.slice(); for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(rng.u() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
        for (var k = 0; k + 1 < order.length; k += 2) {
          var home = day % 2 ? order[k] : order[k + 1], away = day % 2 ? order[k + 1] : order[k];
          var A = BBGame.teamFromRoster(away, away.games), H = BBGame.teamFromRoster(home, home.games);
          var rules = lv === 1 ? U.orgs[home.org].league : 'AL';
          var G = BBGame.simGame(A, H, { rng: rng, rules: rules });
          home.games++; away.games++;
          if (G.score[1] > G.score[0]) { home.w++; away.l++; } else { away.w++; home.l++; }
          var gs = [G.teams[0].starter, G.teams[1].starter];
          tally(U, G, lv, home, away);
          gs.forEach(function (p) { var s = p.stats[p.stats.length - 1]; if (s && s.season === U.season) s.GS++; });
        }
      }
      log('season ' + U.season + ' ' + LEVELS[lv - 1].key + ': ' + (games * C.length / 2) + ' games');
    }
  }

  // ------------------------------------------------------------ promotion
  function woba(s) { return s.wden ? s.wnum / s.wden : null; }
  function wobaA(s) { return s.wdenA ? s.wnumA / s.wdenA : null; }
  function levelMeans(U, lv, season) {   // the level's wOBA, from its batters' lines
    var n = 0, d = 0;
    clubsAt(U, lv).forEach(function (R) { R.hitters.forEach(function (b) { b.stats.forEach(function (s) { if (s.season === season && s.level === lv) { n += s.wnum; d += s.wden; } }); }); });
    return d ? n / d : 0.31;
  }
  function seasonLine(p, season) { return p.stats.filter(function (s) { return s.season === season; })[0] || null; }
  function promote(U) {
    var all = []; U.orgs.forEach(function (org) { org.clubs.forEach(function (R) { all = all.concat(R.hitters.map(function (b) { return { p: b, hit: true }; }), R.starters.concat(R.relievers).map(function (p) { return { p: p, hit: false }; })); }); });
    function zs(list) { var v = list.map(function (q) { return q.hit ? q.p.scouted : -q.p.scouted; }), m = v.reduce(function (a, b) { return a + b; }, 0) / v.length, sd = Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length) || 1; list.forEach(function (q, i) { q.p._z = (v[i] - m) / sd; }); }
    zs(all.filter(function (q) { return q.hit; })); zs(all.filter(function (q) { return !q.hit; }));
    var mean = {}; for (var lv = 1; lv <= LEVELS.length; lv++) mean[lv] = levelMeans(U, lv, U.season);
    function score(p, isHit, lv) {
      var s = seasonLine(p, U.season), perf = 0;
      if (s && isHit && s.wden) perf = (woba(s) - mean[lv]) / 0.040 * s.PA / (s.PA + SHRINK_PA);
      if (s && !isHit && s.wdenA) perf = -(wobaA(s) - mean[lv]) / 0.035 * s.BF / (s.BF + SHRINK_PA);
      return p._z + PERF_W * perf;
    }
    var moves = [];
    U.orgs.forEach(function (org) {
      for (var lv = 2; lv <= LEVELS.length; lv++) {
        var lo = org.clubs[lv - 1], up = org.clubs[lv - 2];
        [['hitters', true], ['starters', false], ['relievers', false]].forEach(function (g) {
          var key = g[0], isHit = g[1], done = 0;
          var cand = lo[key].map(function (p) { return { p: p, s: score(p, isHit, lv) }; }).sort(function (a, b) { return b.s - a.s; });
          cand.forEach(function (c) {
            if (done >= 2) return;
            var same = up[key].filter(function (q) { return !isHit || q.homePos === c.p.homePos; }).map(function (q) { return { p: q, s: score(q, isHit, lv - 1) }; }).sort(function (a, b) { return a.s - b.s; })[0];
            if (!same || c.s <= same.s + PROMO_MARGIN) return;
            lo[key][lo[key].indexOf(c.p)] = same.p; up[key][up[key].indexOf(same.p)] = c.p;
            moves.push({ season: U.season, org: org.id, id: c.p.id, name: c.p.name, hit: isHit, from: lv, to: lv - 1, down: same.p.id, downName: same.p.name });
            done++;
          });
        });
      }
    });
    U.promotions = U.promotions.concat(moves);
    U.orgs.forEach(function (org) { org.clubs.forEach(function (R) { R.hitters.concat(R.starters, R.relievers).forEach(function (p) { p.age++; }); R.games = 0; R.w = 0; R.l = 0; }); });   // a year older (nothing about him changes yet)
    return moves;
  }

  // ------------------------------------------------------------- reports
  function pad(s, n) { s = String(s); return s.length >= n ? s : s + new Array(n - s.length + 1).join(' '); }
  function report(U) {
    var out = [], season = U.season;
    // the levels: what each level's players did, and who they are
    out.push('THE LEVELS, season ' + season + ' (every club ' + (clubsAt(U, 1)[0].games || 'n') + ' games)');
    out.push('  level   wOBA   K%    BB%   HR%   runs/g   bat speed  eye   spot   velo SP');
    for (var lv = 1; lv <= LEVELS.length; lv++) {
      var t = { wn: 0, wd: 0, PA: 0, K: 0, BB: 0, HR: 0, R: 0, G: 0 }, bs = [], eye = [], spot = [], velo = [];
      clubsAt(U, lv).forEach(function (R) {
        R.hitters.forEach(function (b) { bs.push(b.batSpeed); eye.push(b.eyeSD); spot.push(b.spotIn); b.stats.forEach(function (s) { if (s.season === season && s.level === lv) { t.wn += s.wnum; t.wd += s.wden; t.PA += s.PA; t.K += s.K; t.BB += s.BB; t.HR += s.HR; } }); });
        R.starters.forEach(function (p) { velo.push(p.fbVelo); });
        R.starters.concat(R.relievers).forEach(function (p) { p.stats.forEach(function (s) { if (s.season === season && s.level === lv) { t.R += s.Ra; t.G += s.GS; } }); });   // runs against every pitcher, per game started
      });
      function m(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
      out.push('  ' + pad(LEVELS[lv - 1].key, 6) + '  ' + (t.wn / t.wd).toFixed(3) + '  ' + (100 * t.K / t.PA).toFixed(1) + '  ' + (100 * t.BB / t.PA).toFixed(1) + '   ' + (100 * t.HR / t.PA).toFixed(1) + '   ' + (t.R / Math.max(1, t.G)).toFixed(2) + '     ' + m(bs).toFixed(1) + '       ' + m(eye).toFixed(2) + '  ' + m(spot).toFixed(2) + '  ' + m(velo).toFixed(1));
    }
    // the promotion drop
    var rows = {};
    U.promotions.forEach(function (mv) {
      if (!mv.hit || mv.season >= season) return;
      var p = findPlayer(U, mv.id); if (!p) return;
      var a = p.stats.filter(function (s) { return s.season === mv.season && s.level === mv.from; })[0], b = p.stats.filter(function (s) { return s.season === mv.season + 1 && s.level === mv.to; })[0];
      if (!a || !b || a.PA < 100 || b.PA < 100) return;
      var k = LEVELS[mv.from - 1].key + ' to ' + LEVELS[mv.to - 1].key, r = rows[k] || (rows[k] = { n: 0, a: 0, b: 0, lvA: 0, lvB: 0 });
      r.n++; r.a += woba(a); r.b += woba(b); r.lvA += levelMeans(U, mv.from, mv.season); r.lvB += levelMeans(U, mv.to, mv.season + 1);
    });
    // the men who stayed, for the regression every selected season shows
    var stay = {};
    U.orgs.forEach(function (org) { org.clubs.forEach(function (R) { R.hitters.forEach(function (b) {
      for (var sn = 1; sn < season; sn++) { var a = b.stats.filter(function (s) { return s.season === sn; })[0], c = b.stats.filter(function (s) { return s.season === sn + 1; })[0];
        if (!a || !c || a.level !== c.level || a.PA < 100 || c.PA < 100) continue; var mA = levelMeans(U, a.level, sn);
        if (woba(a) - mA < 0.030) continue;   // stayed after a good season (30+ points over his level), like the men who went up
        var k2 = LEVELS[a.level - 1].key, r2 = stay[k2] || (stay[k2] = { n: 0, a: 0, b: 0 }); r2.n++; r2.a += woba(a); r2.b += woba(c); }
    }); }); });
    out.push('');
    out.push('THE PROMOTION DROP: hitters with 100+ PA before and after (wOBA)');
    out.push('  move        n    before  after   drop    the levels\' gap   good seasons that stayed: before, after');
    Object.keys(rows).forEach(function (k) { var r = rows[k], st = stay[k.split(' ')[0]];
      out.push('  ' + pad(k, 11) + pad(r.n, 5) + (r.a / r.n).toFixed(3) + '   ' + (r.b / r.n).toFixed(3) + '   ' + ((r.a - r.b) / r.n).toFixed(3) + '   ' + ((r.lvA - r.lvB) / r.n).toFixed(3) + '             ' + (st ? (st.a / st.n).toFixed(3) + ', ' + (st.b / st.n).toFixed(3) + ' (n ' + st.n + ')' : '-')); });
    return out.join('\n');
  }
  function findPlayer(U, id) {
    for (var o = 0; o < U.orgs.length; o++) for (var c = 0; c < U.orgs[o].clubs.length; c++) {
      var R = U.orgs[o].clubs[c], all = R.hitters.concat(R.starters, R.relievers);
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    }
    return null;
  }

  // ------------------------------------------------------------ the stable
  // What the screen loads: every club and its roster, numbers rounded to five significant figures.
  function stable(U) {
    function round(k, v) { if (k === '_z') return undefined; return typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(5) : v; }   // the promotion score's working value stays behind
    var S = { version: '0.1', seed: U.seed, season: U.season, levels: LEVELS, orgs: U.orgs.map(function (org) {
      return { id: org.id, league: org.league, clubs: org.clubs.map(function (R) { return { city: R.city, nick: R.nick, name: R.name, level: R.level, manager: R.manager, hitters: R.hitters, starters: R.starters, relievers: R.relievers }; }) }; }) };
    return JSON.parse(JSON.stringify(S, round));
  }

  return { version: '0.1', LEVELS: LEVELS, create: create, playSeason: playSeason, promote: promote, report: report, stable: stable, findPlayer: findPlayer, woba: woba };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBLeague;
