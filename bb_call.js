/* ============================================================================
   bb_call.js · v0.3 · 2026-10-02

   The broadcast, written ahead. Given a game and its schedule (bb_schedule.js)
   it writes everything the park will say and play: every voice line, every
   sound, the crowd's mood, the organ. Pure JavaScript, no DOM, deterministic
   from the game: the same seed writes the same broadcast. Nothing is
   improvised during play; the page and the speech server only carry it out.

   THE VOICES. Three roles: 'pbp' (play-by-play: fast, calls each pitch and
   each ball in play as it happens), 'colour' (slow, in the gaps: true
   observations from the game's own records - traits against the league,
   how a man has done today, pitch counts and fatigue, the chance of
   winning, the park and its air) and 'pa' (the public-address announcer:
   home batters, line-ups, pitching changes). The booth is the home team's
   radio crew: it gets louder for the home side's good moments and flatter
   for the visitors', and every word stays true. Lines only use what has
   happened by their moment (no foreshadowing) and speak of it in the past.

   Every line carries an ENERGY - calm, building, excited, peak, deflated -
   and a pace (Piper's length_scale). Its length is estimated from a table
   of seconds per word measured by rendering real lines (tts/README.md),
   and it must fit before the next line that needs the air: the writer
   places the lines that must be said first (the calls), then fits colour
   into what is left, shortening or dropping what does not fit.

   THE CROWD follows sounds/SOUNDS.md: arousal from the game situation and
   the stakes of the next pitch (how far the home team's chance of winning
   would swing between the batter reaching and making an out), valence and
   reaction size from how far a play moved that chance, boos for a missed
   call (the pitch against the rulebook zone, by more than an inch).

   Output: { lines, sfx, crowd, organ, dropped, stats }. Every cue names an
   event id (bb_schedule.js) and an offset in seconds from that segment's
   start; voice lines also carry maxDur, the air they have.

   CHANGED
     v0.3  the PA gives uniform numbers; colour notes a man who wears e, pi or i
     v0.2  the timing table measured by rendering real lines; the PA paced quicker
     v0.1  first build
============================================================================ */

var BBCall = (function () {
  'use strict';
  var VERSION = '0.3';
  var IN = BB.units.IN, FT = BB.units.FT, GEO = BB.geometry;

  // ================================================================ TIMING
  // Pace (Piper length_scale: bigger is slower) by role and energy. The speech
  // server turns the energy into sentence pauses, variability, a small pitch
  // lift and a little volume (tts/energy.json); this table is what the
  // writer asks for.
  var PACE = {
    pbp:    { calm: 1.08, building: 1.0, excited: 0.92, peak: 0.88, deflated: 1.12 },
    colour: { calm: 1.30, building: 1.2, excited: 1.08, peak: 1.0, deflated: 1.32 },
    pa:     { calm: 1.05, building: 1.0, excited: 0.95, peak: 0.95, deflated: 1.05 }
  };
  // How long a line lasts: per role a lead-in, seconds per word at that role's pace
  // for each energy, and a margin that nine lines in ten fall within; plus the
  // pauses between sentences (tts/energy.json) and the PA's echo tail. Measured on
  // 2026-10-02 by rendering 1,130 of this writer's own lines from three games, every
  // energy for each role, with the default voices (tts/voices.json): the table that
  // tts/speech_server.py --dry-run prints. (The PA's lead-in fits below zero: its
  // lines are mostly long name lists, where the per-word figure carries the pauses.)
  var TIMING = {
    pbp:    { lead: 0.22, margin: 0.44, spw: { calm: 0.282, building: 0.268, excited: 0.252, peak: 0.241, deflated: 0.279 } },
    colour: { lead: 0.21, margin: 0.79, spw: { calm: 0.302, building: 0.309, excited: 0.285, peak: 0.273, deflated: 0.314 } },
    pa:     { lead: -1.06, margin: 0.44, spw: { calm: 0.545, building: 0.533, excited: 0.522, peak: 0.517, deflated: 0.549 } }
  };
  var GAP = { calm: 0.45, building: 0.30, excited: 0.15, peak: 0.10, deflated: 0.50 };   // the server's pause between sentences
  var AIR = 0.25;       // a breath between one line and the next
  function words(text) { return text.split(/[\s\-]+/).filter(function (w) { return /[A-Za-z0-9]/.test(w); }).length; }
  function sentences(text) { var m = text.match(/[.!?]+(\s|$)/g); return Math.max(1, m ? m.length : 1); }
  function estDur(text, role, energy) {
    var T = TIMING[role], spw = T.spw[energy] || T.spw.calm * PACE[role][energy] / PACE[role].calm;
    return T.lead + T.margin + words(text) * spw + (sentences(text) - 1) * GAP[energy] + (role === 'pa' ? 0.6 : 0);
  }

  // ================================================================= WORDS
  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
              'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function num(n) {
    n = Math.round(n);
    if (n < 0) return 'minus ' + num(-n);
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + num(n % 100) : '');
    return num(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + num(n % 1000) : '');
  }
  var ORDW = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
              'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth'];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var POSW = { C: 'catcher', '1B': 'first baseman', '2B': 'second baseman', '3B': 'third baseman', SS: 'shortstop', LF: 'left fielder',
               CF: 'center fielder', RF: 'right fielder', DH: 'designated hitter', P: 'pitcher', PH: 'pinch hitter' };
  var POSTO = { C: 'the catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right', P: 'the mound' };
  var BASEW = ['home', 'first', 'second', 'third', 'home'];
  var HITW = { '1B': 'a single', '2B': 'a double', '3B': 'a triple', HR: 'a home run' };
  function countWords(c) {
    var b = +c.split('-')[0], s = +c.split('-')[1];
    if (b === 3 && s === 2) return 'full count';
    if (b === 0 && s === 0) return 'nothing and nothing';
    return (b ? num(b) : 'oh') + ' and ' + (s ? num(s) : 'oh');
  }
  function outsWords(o) { return o === 0 ? 'nobody out' : o === 1 ? 'one out' : 'two out'; }
  function basesWords(bases) {
    var on = [1, 2, 3].filter(function (b) { return bases[b]; });
    if (!on.length) return 'nobody on';
    if (on.length === 3) return 'the bases loaded';
    if (on.length === 1) return 'a runner on ' + BASEW[on[0]];
    return 'runners on ' + BASEW[on[0]] + ' and ' + BASEW[on[1]];
  }
  // past tense of a plate appearance, from the page's own words for it
  var PAST = { single: 'singled', double: 'doubled', triple: 'tripled', 'home run': 'homered', walk: 'walked', strikeout: 'struck out',
               'ground out': 'grounded out', 'fly out': 'flied out', 'pop out': 'popped out', 'line out': 'lined out', error: 'reached on an error',
               "fielder's choice": "reached on a fielder's choice", 'sac fly': 'hit a sacrifice fly', 'double play': 'hit into a double play',
               'hit by pitch': 'was hit by a pitch', out: 'made an out' };

  // the same small seeded chooser everywhere, so a seed writes the same words
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ================================================================ WRITE
  function write(GAME, SCHED, opts) {
    opts = opts || {};
    var G = GAME.G, SEG = SCHED.SEG, env = GAME.env, seed = GAME.seed, HOME = 1;
    var T = G.teams, NICK = [T[0].nick, T[1].nick];
    var voices = opts.voices || { pbp: 'pbp', colour: 'colour', pa: 'pa' };
    function pick(key, arr) { return arr[hash(seed + ':' + key) % arr.length]; }

    // names by id: full and last
    var NAME = {};
    T.forEach(function (Tm) {
      Tm.lineup.concat(Tm.bench).concat([Tm.starter]).concat(Tm.bullpen).forEach(function (p) { NAME[p.id] = { full: p.name, last: p.last || p.name.split(' ').pop() }; });
    });
    function last(id) { return NAME[id] ? NAME[id].last : 'the runner'; }
    var NUMBER = GAME.NUMBER || {};
    function numberWords(id) {   // 'number seven', 'number pi'
      var n = NUMBER[id]; if (n === undefined) return '';
      return 'number ' + (n === 'π' ? 'pi' : n === 'e' || n === 'i' ? n : num(+n));
    }
    function withNumber(id, name) { var w = numberWords(id); return w ? w + ', ' + name : name; }
    function ln(o) { return o.last || last(o.id); }   // a pitcher at bat is his .bat, which has no surname of its own
    function fielderName(play, pos) { var F = play.defense.filter(function (q) { return q.pos === pos; })[0]; return F ? last(F.id) : POSTO[pos]; }
    function hand(P) { return P.throws === 'R' ? 'right-hander' : 'left-hander'; }
    function scoreLine(sc, verb) {   // 'the Comets lead four to two', home team first when tied
      if (sc[0] === sc[1]) return sc[0] ? 'it is tied at ' + num(sc[0]) : 'still no score';
      var w = sc[1] > sc[0] ? 1 : 0;
      return 'the ' + NICK[w] + ' ' + (verb || 'lead') + ' ' + num(sc[w]) + ' to ' + (sc[1 - w] ? num(sc[1 - w]) : 'nothing');
    }
    function wpOf(inning, half, outs, bases, score) { return BBSchedule.winProb(inning, half, outs, bases, score); }

    // ------------------------------------------------- what has happened so far
    function paWords(p) {
      var r = p.pa.result, pl = p.play;
      if (r === 'END') return null;
      if (r === 'K') return { word: 'strikeout', ab: true };
      if (r === 'BB') return { word: 'walk' };
      if (r === 'HBP') return { word: 'hit by pitch' };
      var h = pl.hit, W = { '1B': 'single', '2B': 'double', '3B': 'triple', HR: 'home run' };
      if (W[h]) return { word: W[h], ab: true, hit: true };
      if (h === 'E') return { word: 'error', ab: true };
      if (h === 'FC') return { word: "fielder's choice", ab: true };
      if (h === 'SF') return { word: 'sac fly' };
      if (pl.dp) return { word: 'double play', ab: true };
      return { word: { GB: 'ground out', LD: 'line out', FB: 'fly out', PU: 'pop out' }[pl.type] || 'out', ab: true };
    }
    function dayOf(play) {
      var k = G.plays.indexOf(play), pas = [], ab = 0, hits = 0;
      for (var j = 0; j < k; j++) { var p = G.plays[j]; if (p.batter.id !== play.batter.id) continue; var w = paWords(p); if (!w) continue;
        pas.push({ word: w.word, inning: p.inning, pitcher: p.pitcher, play: p }); if (w.ab) ab++; if (w.hit) hits++; }
      return { pas: pas, ab: ab, hits: hits };
    }
    function forAB(day) { return day.ab ? (day.hits ? num(day.hits) : 'oh') + ' for ' + num(day.ab) : ''; }
    function dayPhrase(day) {   // 'one for two today' or 'walked in the first'
      if (!day.pas.length) return '';
      if (day.ab) return forAB(day) + ' today';
      return PAST[day.pas[day.pas.length - 1].word] + ' in the ' + ORDW[day.pas[day.pas.length - 1].inning];
    }
    function dayStory(day) {    // 'He singled in the second and struck out in the fourth.'
      var groups = [];   // 'struck out in the first and third, and walked in the fifth'
      day.pas.slice(-4).forEach(function (q) { var g = groups.filter(function (x) { return x.word === q.word; })[0]; if (g) g.inn.push(ORDW[q.inning]); else groups.push({ word: q.word, inn: [ORDW[q.inning]] }); });
      var bits = groups.map(function (g) { return PAST[g.word] + ' in the ' + (g.inn.length === 1 ? g.inn[0] : g.inn.slice(0, -1).join(', ') + ' and ' + g.inn[g.inn.length - 1]); });
      if (!bits.length) return '';
      return bits.length === 1 ? bits[0] : bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1];
    }
    // a pitcher's day up to (not including) play k, and pitch i of it
    function pitcherDay(P, k, upto) {
      var d = { pitches: 0, k: 0, bb: 0, h: 0, runs: 0, outs: 0, bf: 0, maxFB: 0, streak: 0, fb: [] };
      for (var j = 0; j < k; j++) {
        var p = G.plays[j]; if (p.pitcher.id !== P.id) continue;
        d.bf++; d.pitches += p.pa.pitches.length; d.runs += p.runs; d.outs += p.outsAfter - p.outs;
        var w = paWords(p);
        if (p.pa.result === 'K') d.k++; if (p.pa.result === 'BB') d.bb++; if (w && w.hit) d.h++;
        d.streak = (w && !w.hit && p.pa.result !== 'BB' && p.pa.result !== 'HBP' && !(p.play && p.play.hit === 'E')) ? d.streak + 1 : 0;
        p.pa.pitches.forEach(function (q) { if (BB.PITCH_TYPES[q.pitch.type].kind === 'FB') { d.maxFB = Math.max(d.maxFB, q.pitch.mph); d.fb.push(q.pitch.mph); } });
      }
      if (upto) { var cp = G.plays[k]; cp.pa.pitches.forEach(function (q, i) { if (i < upto) { d.pitches++; if (BB.PITCH_TYPES[q.pitch.type].kind === 'FB') d.maxFB = Math.max(d.maxFB, q.pitch.mph); } }); }
      return d;
    }
    function inningsWords(outs) {
      var n = Math.floor(outs / 3), r = outs % 3;
      var w = n ? num(n) + (r ? ' and ' + (r === 1 ? 'a third' : 'two-thirds') : '') + ' inning' + (n === 1 && !r ? '' : 's') : (r === 1 ? 'a third of an inning' : 'two-thirds of an inning');
      return w;
    }
    // the stakes of a plate appearance: how far the home side's chance would swing
    // between the batter reaching first (runners pushed along) and his making an out
    function stakesOf(play, outs, bases) {
      var b = bases, sc = play.scoreBefore.slice(), reach = [null, play.batter, b[1] ? b[1] : b[2], b[1] && b[2] ? b[2] : b[3]];
      if (b[1] && b[2] && b[3]) sc[play.half]++;
      var wR = wpOf(play.inning, play.half, outs, reach, sc), wO = wpOf(play.inning, play.half, outs + 1, b, play.scoreBefore);
      return Math.abs(wR - wO);
    }
    // where a pitch crossed, against the rulebook zone: + inside the zone by d m, - outside it by d m
    function zoneDepth(B, plate) {
      var dx = GEO.ZONE_HALF - Math.abs(plate.x), dLo = plate.z - (B.zone.bot - GEO.BALL_R), dHi = (B.zone.top + GEO.BALL_R) - plate.z;
      if (dx >= 0 && dLo >= 0 && dHi >= 0) return Math.min(dx, dLo, dHi);
      var ox = Math.max(0, -dx), oz = Math.max(0, -dLo, -dHi);
      return -Math.hypot(ox, oz);
    }
    function locWords(B, side, plate) {
      var zb = B.zone.bot, zt = B.zone.top, xin = plate.x * side, ph = GEO.PLATE_HALF, v = '', s = '';
      if (plate.z < zb - GEO.BALL_R) v = plate.z < 0.2 ? 'in the dirt' : 'low'; else if (plate.z > zt + GEO.BALL_R) v = 'high';
      if (xin > ph + GEO.BALL_R) s = 'inside'; else if (xin < -ph - GEO.BALL_R) s = 'outside';
      return v && s ? v + ' and ' + s : v || s || '';
    }
    function sprayDir(sp, type) {   // sp degrees, minus to left field
      if (type === 'GB') return sp < -25 ? 'down the third-base line' : sp < -9 ? 'to the left side' : sp <= 9 ? 'up the middle' : sp <= 25 ? 'to the right side' : 'down the first-base line';
      return sp < -30 ? 'to left' : sp < -12 ? 'to left-center' : sp <= 12 ? 'to center' : sp <= 30 ? 'to right-center' : 'to right';
    }

    // ============================================================ ALLOCATION
    // Candidate lines: { t (absolute start), role, energy, alts: [text, shorter text...],
    // prio (1 must, 2 should, 3 colour, 4 filler), slide (s it may start later),
    // until (absolute time it must have ended by) }.
    var cands = [], sfx = [], organ = [], crowd = [];
    function say(seg, off, role, energy, alts, prio, o) {
      o = o || {};
      alts = (Array.isArray(alts) ? alts : [alts]).filter(function (a) { return a; });
      if (!alts.length) return;
      cands.push({ seg: seg, t: seg.t0 + off, role: role, energy: energy, alts: alts, prio: prio, slide: o.slide || 0, until: o.until || Infinity, chime: o.chime, gen: o.gen, n: cands.length });
    }
    function cue(seg, off, sound, gain, dur) { sfx.push({ event: seg.id, offset: +off.toFixed(2), sound: sound, gain: +(gain === undefined ? 1 : gain).toFixed(2), dur: dur ? +dur.toFixed(2) : undefined, t: seg.t0 + off }); }
    function play_(seg, off, c) { organ.push({ event: seg.id, offset: +off.toFixed(2), cue: c, t: seg.t0 + off }); }

    // ================================================================ PASSES
    var streakSaid = {}, lastCharge = -99, lastLetsGo = -999, glow = { t: -999, size: 0 }, lastBig = 0, airSaid = 0, wpSaidHalf = {}, used = {};
    var paIndex = 0;
    function reactionSize(dwp) { var m = Math.abs(dwp); return m < 0.025 ? 1 : m < 0.07 ? 2 : m < 0.15 ? 3 : 4; }
    function react(seg, off, play, dwp, kind) {   // the home crowd answers a play: kind is a hint ('HR', 'K', 'walk', ...)
      var homeBat = play.half === HOME, good = dwp > 0, size = reactionSize(dwp), t = seg.t0 + off;
      if (kind === 'HR') {
        if (homeBat) { cue(seg, off, size >= 4 || (play.play && play.play.runs === 4) ? 'eruption' : 'cheer_big', 1); cue(seg, off + 6, 'fireworks', 0.6); }
        else { cue(seg, off, 'groan_big', 0.9); cue(seg, off + 0.4, 'pocket_visitors', 0.7); if (dwp < -0.1 || leadChanged(play)) cue(seg, off + 3.5, 'murmur_stunned', 0.8); }
        size = Math.max(size, 3);
      } else if (good) {
        var nm = ['', 'cheer_small', 'cheer_medium', 'cheer_big', 'eruption'][size];
        if (size === 4 && !(play.half === HOME && play === G.plays[G.plays.length - 1]) && Math.abs(dwp) < 0.25) nm = 'cheer_big';
        cue(seg, off, nm, homeBat ? 1 : 0.85);
      } else if (dwp < -0.004) {
        cue(seg, off, size >= 3 ? 'groan_big' : 'groan_small', size >= 3 ? 0.9 : 0.6 + 0.1 * size);
        if (!homeBat && play.runs) cue(seg, off + 0.3, 'pocket_visitors', 0.6);
        if (size >= 3 && leadChanged(play)) cue(seg, off + 3, 'murmur_stunned', 0.7);
      }
      if (size >= 2) { glow = { t: t, size: size }; lastBig = t; }
      return size;
    }
    function leadChanged(play) { var a = play.scoreBefore, b = play.score; return Math.sign(a[1] - a[0]) !== Math.sign(b[1] - b[0]) && b[1] !== b[0]; }

    // ------------------------------------------------------------- pregame
    var pre = SEG[0], A = T[0], H = T[1], rho0 = BB.makeEnv({ tempF: 70, elevFt: 0, rh: 0.5 }).rho, thin = 100 * (1 - env.rho / rho0);
    var parkWords = GAME.parkName + (env.elevFt > 1500 ? ', ' + num(Math.round(env.elevFt / 100) * 100) + ' feet above sea level' : '');
    say(pre, 0.8, 'pbp', 'building', ['Good evening, everybody, and welcome to ' + parkWords + '. The ' + A.name + ' at the ' + H.name + '.',
                                      'Welcome to ' + GAME.parkName + '. The ' + A.nick + ' at the ' + H.nick + '.'], 1);
    var airLine = num(env.tempF) + ' degrees at first pitch' + (Math.abs(thin) >= 4 ? ', and the air is about ' + num(Math.abs(thin)) + ' percent ' + (thin > 0 ? 'thinner' : 'thicker') + ' than a mild day at sea level' + (thin > 0 ? ', so the ball should carry.' : ', so it will hold the ball up.') : '.');
    say(pre, 9.5, 'colour', 'calm', [cap(airLine), cap(num(env.tempF) + ' degrees at first pitch.')], 3, { slide: 30, until: pre.dur - 0.5 });
    function lineupText(Tm, full) {
      var order = G.rules === 'NL' ? Tm.lineup.filter(function (b) { return b.pos !== 'DH'; }).concat([{ name: Tm.starter.name, pos: 'P' }]) : Tm.lineup;
      if (!full) return order.map(function (b) { return b.name; }).join(', ') + '.';
      return order.map(function (b, i) { return 'Batting ' + ORDW[i + 1] + ', the ' + POSW[b.pos] + ', ' + b.name + '.'; }).join(' ');
    }
    cue(pre, 7.4, 'pa_chime', 0.8);
    say(pre, 8.2, 'pa', 'calm', ['The starting line-up for the visiting ' + A.nick + ': ' + lineupText(A, false)], 1, { slide: 2, until: pre.dur - 0.5 });
    say(pre, 19.5, 'pa', 'building', ['And now, your starting line-up for the ' + H.nick + '! ' + lineupText(H, true), 'And now, your ' + H.nick + '! ' + lineupText(H, false)], 1, { slide: 4, until: pre.dur - 0.5 });
    play_(pre, 0.3, 'organ_filler');
    crowd.push({ event: pre.id, arousal: 0.32, valence: 0, bed: 'bed_normal' });

    // ------------------------------------------------------------- the game
    var half = null, halfPlays = 0, lastHalfStats = null;
    SEG.forEach(function (seg, si) {
      var k = seg.kind, play = seg.play, nextSeg = SEG[si + 1] || null;
      if (k === 'pregame') return;
      // ---------------------------------------------------------- the crowd bed
      var arousal = arousalAt(seg), valence = 0;
      if (k === 'result' && seg.last) valence = +(play.wpAfter - play.wpBefore).toFixed(3);
      if (k === 'final') { arousal = G.score[1] > G.score[0] ? 0.9 : 0.12; valence = G.score[1] > G.score[0] ? 1 : -1; }
      crowd.push({ event: seg.id, arousal: +arousal.toFixed(2), valence: valence, bed: arousal < 0.25 ? 'bed_sparse' : arousal < 0.5 ? 'bed_normal' : arousal < 0.75 ? 'bed_buzz' : 'bed_rally' });

      if (k === 'halfStart') writeHalfStart(seg);
      else if (k === 'change') writeChange(seg);
      else if (k === 'paStart') writePAStart(seg);
      else if (k === 'setup') writeSetup(seg);
      else if (k === 'flight') writeFlight(seg);
      else if (k === 'result') writeResult(seg, nextSeg);
      else if (k === 'halfEnd') writeHalfEnd(seg);
      else if (k === 'stretch') writeStretch(seg);
      else if (k === 'final') writeFinal(seg);
    });

    function arousalAt(seg) {
      var play = seg.play || (seg.inn && seg.inn.plays[0]);
      if (!play) return 0.3;
      var sc = seg.kind === 'halfEnd' ? seg.inn.plays[seg.inn.plays.length - 1].score : play.scoreBefore, diff = Math.abs(sc[1] - sc[0]);
      var late = clamp((play.inning - 1) / 8, 0, 1), close = Math.exp(-diff / 2.5);
      var a = 0.16 + 0.24 * close + 0.22 * late * close + (play.inning === 1 ? 0.06 : 0);
      if (diff >= 6) a = Math.min(a, 0.2);
      if (seg.play && seg.i !== undefined && seg.kind !== 'paStart') {
        var p = play.pa.pitches[seg.i], c = p.count.split('-').map(Number), bases = p.bases || play.bases;
        a += 0.3 * clamp(stakesOf(play, play.outs, bases) / 0.25, 0, 1);
        if (c[1] === 2) a += 0.05; if (c[0] === 3) a += 0.05;
        if (c[0] === 3 && c[1] === 2 && (bases[1] || bases[2] || bases[3])) a += 0.07;
      } else if (seg.kind === 'paStart' || seg.kind === 'change') a += 0.2 * clamp(stakesOf(play, play.outs, play.bases) / 0.25, 0, 1);
      a += glow.size * 0.06 * Math.exp(-(seg.t0 - glow.t) / 75);
      return clamp(a, 0.05, 1);
    }

    // ------------------------------------------------------------ halves
    function writeHalfStart(seg) {
      var inn = seg.inn, first = inn.plays[0], bat = inn.half, sc = first.scoreBefore;
      half = inn; halfPlays = 0;
      var where = (inn.half ? 'Bottom' : 'Top') + ' of the ' + ORDW[inn.n], lead = sc[0] === sc[1] ? (sc[0] ? 'Tied at ' + num(sc[0]) + '.' : 'No score.') : cap(scoreLine(sc)) + '.';
      var leadoff = first.pinchHit ? '' : ' ' + first.batter.name + ' leads off.';
      if (inn.n === 1 && inn.half === 0) {
        cue(seg, 0.4, 'pa_chime', 0.8);
        say(seg, 1.2, 'pa', 'excited', ['Ladies and gentlemen, now taking the field, your ' + H.name + '!'], 1, { chime: true });
        cue(seg, 3.2, 'applause_polite', 1.0); cue(seg, 4.2, 'cheer_medium', 0.8);
        play_(seg, 4.4, 'organ_take_field');
        say(seg, 6.5, 'pbp', 'building', ['And ' + H.starter.name + ', the ' + hand(H.starter) + ', will take the ball for the ' + H.nick + '. ' + first.batter.name + ' leads off for the ' + A.nick + '.',
                                         ln(H.starter) + ' on the mound for the ' + H.nick + '.'], 1, { slide: 2 });
        return;
      }
      say(seg, 0.6, 'pbp', inn.n >= 8 && Math.abs(sc[1] - sc[0]) <= 2 ? 'building' : 'calm', [where + '. ' + lead + leadoff, where + '.'], 1, { slide: 1 });
      // colour in the break: the chance of winning, once a half at most and only when it has a story
      var wp = first.wpBefore, pct = Math.round(wp * 20) * 5;
      if (inn.n >= 4 && !wpSaidHalf[inn.n] && (inn.n % 3 === 1 || Math.abs(wp - 0.5) > 0.3)) {
        wpSaidHalf[inn.n] = true;
        say(seg, 4.0, 'colour', 'calm', ['By our numbers the ' + H.nick + ' chance of winning this one is about ' + num(pct) + ' percent.',
                                         H.nick + ', about ' + num(pct) + ' percent to win.'], 3, { slide: 2, until: seg.t0 + seg.dur + 3 });
      } else if (airSaid < 2 && env.elevFt > 2500 && inn.n === 5) {
        airSaid++;
        say(seg, 4.0, 'colour', 'calm', ['Remember the air up here: about ' + num(thin) + ' percent thinner than at sea level. Fly balls carry.'], 3, { slide: 2 });
      }
      if (inn.half === 0 && inn.n > 1) play_(seg, 0.2, 'organ_filler');
      if (inn.half === 0 && inn.n % 3 === 0) cue(seg, 2.0, 'vendor', 0.5);
    }
    function halfStats(inn) {
      var s = { runs: 0, hits: 0, bb: 0, lob: 0, k: 0 };
      inn.plays.forEach(function (p) { var w = paWords(p); s.runs += p.runs; if (w && w.hit) s.hits++; if (p.pa.result === 'BB' || p.pa.result === 'HBP') s.bb++; if (p.pa.result === 'K') s.k++; });
      var lp = inn.plays[inn.plays.length - 1]; if (lp.outsAfter >= 3) s.lob = [1, 2, 3].filter(function (b) { return lp.basesAfter[b]; }).length;
      return s;
    }
    function writeHalfEnd(seg) {
      var inn = seg.inn, lp = inn.plays[inn.plays.length - 1], s = halfStats(inn), sc = lp.score, gameOver = SEG[SEG.indexOf(seg) + 1].kind === 'final';
      if (gameOver) return;   // the final call and the final segment say it
      var tally = (s.runs ? num(s.runs) + ' run' + (s.runs > 1 ? 's' : '') : 'No runs') + ', ' + (s.hits ? num(s.hits) + ' hit' + (s.hits > 1 ? 's' : '') : 'no hits') + (s.lob ? ', ' + num(s.lob) + ' left on' : '') + '.';
      var mood = inn.half === HOME ? (s.runs ? 'excited' : 'calm') : (s.runs ? 'deflated' : 'building');
      say(seg, 0.4, 'pbp', mood, [cap(tally) + ' ' + (inn.half ? 'End of the ' : 'Middle of the ') + ORDW[inn.n] + ', ' + scoreLine(sc) + '.', cap(scoreLine(sc)) + '.'], 1, { slide: 1 });
      if (inn.half === 1 || inn.n !== 7) play_(seg, 2.6, 'organ_filler');
      lastHalfStats = s;
    }
    function writeStretch(seg) {
      cue(seg, 0.2, 'pa_chime', 0.8);
      say(seg, 1.0, 'pa', 'building', ['Ladies and gentlemen, please rise and join us for the seventh-inning stretch!'], 1, { chime: true });
      play_(seg, 5.0, 'organ_stretch');
      cue(seg, 4.5, 'applause_polite', 0.8);
      cue(seg, 27.0, 'cheer_medium', 0.8);
    }

    // ------------------------------------------------------------ changes
    function writeChange(seg) {
      var play = seg.play;
      if (seg.change) {
        var out = seg.change.out, inP = seg.change.in, k = G.plays.indexOf(play), d = pitcherDay(out, k), defHome = play.half !== HOME;
        var line = !d.pitches ? '' : d.outs ? ln(out) + ' is done: ' + inningsWords(d.outs) + ', ' + num(d.pitches) + ' pitches, ' + (d.runs ? num(d.runs) + ' run' + (d.runs > 1 ? 's' : '') : 'no runs') + ' while he was on the mound.' : ln(out) + ' is done after ' + num(d.pitches) + ' pitches.';
        // the PA announces him as he comes in; the booth sums up the man leaving after it
        say(seg, 0.2, 'pa', 'calm', ['Now pitching for the ' + T[1 - play.half].nick + ', ' + withNumber(inP.id, inP.name) + '.', 'Now pitching, ' + inP.name + '.'], 1, { slide: 1 });
        say(seg, 0.25, 'pbp', 'calm', [(line ? line + ' ' : '') + inP.last + ' is a ' + hand(inP) + '.', line, d.pitches ? ln(out) + ' threw ' + num(d.pitches) + ' pitches.' : ''], 2, { slide: 22 });
        // the crowd says goodbye: an ovation for a home pitcher who pitched well, thin applause if he was hit hard,
        // a mocking cheer for a visiting pitcher who was
        if (defHome && d.outs >= 18 && d.runs <= 1) cue(seg, 0.4, 'ovation', 1.0, 6);
        else if (defHome && d.runs <= 3) cue(seg, 0.4, 'applause_polite', 0.9);
        else if (defHome) cue(seg, 0.4, 'applause_polite', 0.45);
        else if (d.runs >= 4) cue(seg, 0.4, 'cheer_sarcastic', 0.8);
        play_(seg, 1.2, 'organ_filler');

      } else if (seg.pinch) {
        say(seg, 0.2, 'pbp', 'calm', [seg.pinch.batter.name + ' will pinch-hit for ' + ln(seg.pinch.forPitcher) + '.'], 1, { slide: 1 });
      }
    }

    // ------------------------------------------------------------ at-bats
    var curPA = null;
    function writePAStart(seg) {
      var play = seg.play, B = play.batter, P = play.pitcher, k = G.plays.indexOf(play), day = dayOf(play), homeBat = play.half === HOME;
      var pos = play.pinchHit && play.pinchHit.batter === B ? 'PH' : (B.pos === 'P' ? 'P' : B.pos), stk = stakesOf(play, play.outs, play.bases);
      halfPlays++; paIndex++;
      curPA = { play: play, colour: [], usedColour: {}, stakes: stk };
      if (play.pa.result === 'END') { /* the inning ends on the bases before he finishes: still introduced */ }
      var dp = dayPhrase(day), sit = play.outs || play.bases[1] || play.bases[2] || play.bases[3] ? ' ' + cap(outsWords(play.outs)) + (basesWords(play.bases) !== 'nobody on' ? ', ' + basesWords(play.bases) : '') + '.' : '';
      if (homeBat) {
        say(seg, 0.4, 'pa', stk > 0.12 ? 'building' : 'calm', [(pos === 'PH' ? 'Now batting for the ' + H.nick + ', pinch-hitting, ' : 'Now batting for the ' + H.nick + ', the ' + POSW[pos] + ', ') + withNumber(B.id, B.name) + '.', 'Now batting, ' + withNumber(B.id, B.name) + '.', 'Now batting, ' + B.name + '.'], 1, { slide: 2.5 });
        if (dp || sit) say(seg, 4.0, 'pbp', stk > 0.12 ? 'building' : 'calm', [dp ? ln(B) + ', ' + dp + '.' + sit : sit.trim(), sit.trim(), dp ? cap(dp) + '.' : ''], 2, { slide: 3 });
      } else {
        say(seg, 0.4, 'pbp', 'calm', ['Here is ' + B.name + ', the ' + POSW[pos] + (dp ? ', ' + dp : '') + '.' + sit, B.name + '.' + sit, B.name + '.'], 1, { slide: 3 });
      }
      // the home crowd urges its batters on late; the organ calls the charge
      var late = play.inning >= 6, diff = play.scoreBefore[1] - play.scoreBefore[0], risp = play.bases[2] || play.bases[3], on = [1, 2, 3].filter(function (b) { return play.bases[b]; }).length;
      if (homeBat && late && diff >= -3 && diff <= 1 && (risp || on >= 2) && paIndex - lastCharge >= 4) {
        lastCharge = paIndex; play_(seg, 3.6, 'organ_charge'); cue(seg, 6.4, 'shout_charge', 0.9);
      } else if (homeBat && late && diff >= -3 && diff <= 1 && on) cue(seg, 0.8, 'clap_rally', 0.6);
      // a long lull: the organ tries to rev them up
      if (homeBat && seg.t0 - lastBig > 420 && seg.t0 - lastLetsGo > 900 && arousalAt(seg) < 0.42) {
        lastLetsGo = seg.t0; play_(seg, 3.4, 'organ_lets_go'); cue(seg, 6.2, 'clap_letsgo', 0.8);
      }
      planColour(play, day, k, 0);
      // colour before the first pitch, if the introductions leave room
      cands.push({ seg: seg, t: seg.t0 + 2.0, role: 'colour', energy: 'calm', alts: null, gen: true, prio: 3, slide: 4, until: seg.t0 + seg.dur + BBSchedule.PACE.setup + BBSchedule.PACE.flight - 0.3, n: cands.length });
    }
    // the colour for this at-bat, most interesting first; each is used once
    function planColour(play, day, k, upto) {
      var B = play.batter, P = play.pitcher, L = [], homeBat = play.half === HOME;
      // the three numbers nobody else in the league wears
      var NUM_FUN = { e: ' wears e on his back: two point seven one eight, and on, the base of the natural logarithm.',
                      'π': ' wears pi: three point one four one six, and it never ends.',
                      i: ' wears i, the square root of minus one. An imaginary number on a very real ballplayer.' };
      if (NUM_FUN[NUMBER[B.id]] && !used['num' + B.id]) L.push({ key: 'num' + B.id, alts: [ln(B) + NUM_FUN[NUMBER[B.id]]] });
      // his traits against the league: the one that stands out most, once a game
      if (!used['trait' + B.id] && !used['speed' + B.id] && B.pos !== 'P') {
        var Tr = BB.TRAITS, best = null;
        [['batSpeed', 1], ['spotIn', -1], ['eyeSD', -1], ['barrelSD', -1], ['speed', 1]].forEach(function (q) {
          var t = Tr[q[0]], z = q[1] * (B[q[0]] - t[0]) / t[1]; if (!best || Math.abs(z) > Math.abs(best.z)) best = { key: q[0], z: z, v: B[q[0]], mean: t[0] };
        });
        if (best && Math.abs(best.z) >= 1.0) {
          var share = Math.round(10 * BBSchedule.Phi(Math.abs(best.z))), better = best.z > 0, txt, sh;
          if (best.key === 'batSpeed') { txt = ln(B) + (better ? ' swings one of the quicker bats around: about ' : ' does not have much bat speed: about ') + num(best.v) + ' miles an hour at the sweet spot, where the league averages ' + num(best.mean) + '.';
            sh = ln(B) + (better ? ' has a quick bat, ' : ' has a slow bat, ') + num(best.v) + ' miles an hour.'; }
          else if (best.key === 'spotIn') { txt = better ? ln(B) + ' picks up a pitch early; he reads spin better than ' + num(share) + ' hitters in ten.' : ln(B) + ' is slow to pick up a pitch; most hitters read spin sooner than he does.';
            sh = ln(B) + (better ? ' reads spin early.' : ' is slow to read spin.'); }
          else if (best.key === 'eyeSD') { txt = better ? ln(B) + ' has a sharp eye for the zone, better than ' + num(share) + ' hitters in ten.' : ln(B) + ' does not judge the zone well; he will chase.';
            sh = ln(B) + (better ? ' has a good eye.' : ' will chase.'); }
          else if (best.key === 'barrelSD') { txt = better ? ln(B) + ' puts the barrel on the ball as well as almost anyone; better than ' + num(share) + ' hitters in ten.' : ln(B) + ' misses the barrel more than most.';
            sh = ln(B) + (better ? ' finds the barrel.' : ' misses the barrel a lot.'); }
          else { txt = better ? ln(B) + ' can run: ' + num(best.v) + ' feet a second, faster than ' + num(share) + ' players in ten.' : ln(B) + ' is not quick, ' + num(best.v) + ' feet a second down the line.';
            sh = ln(B) + (better ? ' can really run.' : ' is not quick.'); }
          L.push({ key: best.key === 'speed' ? 'speed' + B.id : 'trait' + B.id, alts: [txt, sh] });
        }
      }
      // how he has done today, for the home batters the PA introduced without it
      if (day.pas.length) L.push({ key: 'day' + k, alts: ['He ' + dayStory(day) + '.'] });
      // the last time he faced this pitcher today, when that is news beyond his day
      var prev = day.pas.filter(function (q) { return q.pitcher.id === P.id; });
      if (prev.length && prev.length < day.pas.length) { var q = prev[prev.length - 1]; L.push({ key: 'met' + k, alts: [ln(P) + ' saw him in the ' + ORDW[q.inning] + ', and he ' + PAST[q.word] + '.'] }); }
      // the pitcher's day: pitch count and fatigue, his strikeouts, a streak
      var d = pitcherDay(P, k, upto), fat = BB.fatigueOf ? (play.load - 0.7 * P.stamina) / (0.45 * P.stamina) : 0, loss = fat > 0 ? 3 * Math.min(1.5, fat * fat) : 0;
      if (d.pitches >= 60 && !used['count' + P.id + ':' + Math.floor(d.pitches / 20)]) {
        L.push({ key: 'count' + P.id + ':' + Math.floor(d.pitches / 20), alts: [ln(P) + ' is at ' + num(d.pitches) + ' pitches' + (loss >= 0.5 ? ', and he is tiring: that is costing him about ' + (loss >= 1.5 ? num(loss) + ' miles an hour' : 'a mile an hour') + ' on his pitches.' : '.'), ln(P) + ' is at ' + num(d.pitches) + ' pitches.'] });
      }
      var said = streakSaid[P.id] || 0;   // a streak is news again only four outs on
      if (d.streak >= 6 && (d.streak >= said + 4 || d.streak < said)) L.push({ key: 'streak' + P.id + ':' + d.streak, streak: [P.id, d.streak], alts: [ln(P) + ' has retired ' + num(d.streak) + ' in a row.'] });
      if (d.k >= 5 && !used['ks' + P.id + ':' + d.k]) L.push({ key: 'ks' + P.id + ':' + d.k, alts: [ln(P) + ' has ' + num(d.k) + ' strikeouts today' + (d.maxFB >= 96 ? ', and he has touched ' + num(d.maxFB) + ' with the fastball.' : '.')] });
      else if (d.maxFB >= 98 && !used['velo' + P.id]) L.push({ key: 'velo' + P.id, alts: [ln(P) + ' has touched ' + num(d.maxFB) + ' miles an hour today.'] });
      // the umpire's habit, once a game
      if (GAME.ump.quirk && !used.ump && paIndex > 6) L.push({ key: 'ump', alts: [GAME.ump.name + ', behind the plate, calls the ' + GAME.ump.quirk.edge + ' edge ' + GAME.ump.quirk.dir + '.'] });
      // a fast man on first
      var r1 = play.bases[1] && !play.bases[2] ? play.bases[1] : null;
      if (r1 && r1.speed && (r1.speed - 27) / 1.2 > 1.0 && !used['speed' + r1.id]) L.push({ key: 'speed' + r1.id, alts: [last(r1.id) + ' on first can run, ' + num(r1.speed) + ' feet a second. Watch him.'] });
      curPA.colour = L;
    }
    // the next colour line that has not been used, with its shorter forms
    function nextColour() {
      if (!curPA) return null;
      var L = curPA.colour.filter(function (c) { return !used[c.key]; });
      return L.length ? L : null;
    }
    function writeSetup(seg) {
      var play = seg.play, p = play.pa.pitches[seg.i], c = p.count, cw = c.split('-').map(Number), bases = p.bases || play.bases;
      var homePitch = play.half !== HOME, stk = curPA ? curPA.stakes : 0, runners = bases[1] || bases[2] || bases[3];
      // the count, with tension when it matters
      var big = (cw[1] === 2 && (cw[0] === 3 || stk > 0.1)) || (cw[0] === 3 && stk > 0.08);
      var verb = runners ? pick(seg.id, ['He comes set.', 'Set.', 'He checks the runner. Sets.']) : pick(seg.id, ['The wind-up.', 'Here is the pitch.', 'He deals.']);
      if (seg.i > 0 || cw[0] || cw[1]) say(seg, 0.3, 'pbp', big ? 'building' : 'calm', [cap(countWords(c)) + '. ' + verb, cap(countWords(c)) + '.'], big ? 2 : 4, { slide: 0.3, until: seg.t0 + seg.dur + PACE_FLIGHT() });
      // the crowd leans in
      if (homePitch && cw[1] === 2 && stk > 0.04) cue(seg, 0.1, 'clap_two_strike', 0.8, seg.dur + 1.6);
      if (((cw[0] === 3 && cw[1] === 2) || (bases[1] && bases[2] && bases[3])) && play.inning >= 7 && Math.abs(play.scoreBefore[1] - play.scoreBefore[0]) <= 2) cue(seg, 0.2, 'rumble_rising', 0.8, seg.dur + 1.6);
    }
    function PACE_FLIGHT() { return BBSchedule.PACE.flight; }
    function writeFlight(seg) {
      var play = seg.play, p = play.pa.pitches[seg.i];
      if (p.steal && !p.steal.back) say(seg, 0.2, 'pbp', 'excited', ['The runner goes!'], 1);
    }

    // ------------------------------------------------------------ each pitch
    function writeResult(seg, nextSeg) {
      var play = seg.play, i = seg.i, p = play.pa.pitches[i], B = play.batter, P = play.pitcher, res = p.result, isLast = seg.last;
      var homeBat = play.half === HOME, side = p.side || BB.batterSide(B, P), cw = p.count.split('-').map(Number), r = play.pa.result;
      var ptype = BB.PITCH_TYPES[p.pitch.type].name, mph = num(p.pitch.mph), loc = locWords(B, side, p.pitch.plate);
      var withPitch = hash(seed + seg.id) % 3 === 0 || p.pitch.mph >= 98.5;
      var pitchBit = withPitch ? cap(ptype === 'four-seam' ? 'fastball' : ptype) + ', ' + mph + (loc ? ', ' + loc : '') + '. ' : '';
      var plateDepth = zoneDepth(B, p.pitch.plate);
      // ---- field sounds of the pitch itself
      var thrown = res === 'ball' || res === 'called_strike' || res === 'swinging_strike';
      if (thrown && !p.wild) cue(seg, 0.0, p.pitch.plate.z < 0.15 ? 'ball_dirt' : 'mitt_pop', clamp(0.45 + (p.pitch.mph - 78) / 40, 0.35, 1));
      if (p.wild) cue(seg, 0.0, 'ball_dirt', 0.9);
      if (res === 'called_strike') cue(seg, 0.35, 'ump_strike', 0.7);
      if (p.bb && (res === 'foul' || res === 'in_play' || res === 'hr')) {
        var ev = p.bb.ev, fd = p.bb.projDist || 0;
        cue(seg, 0.0, res === 'foul' && fd < 25 ? 'foul_tip' : ev >= 95 ? 'bat_solid' : ev >= 78 ? 'bat_medium' : 'bat_weak', clamp(0.5 + (ev - 60) / 60, 0.4, 1));
      }
      // ---- a missed call against the home side: boos (rulebook zone, by more than an inch)
      if (p.call) {
        var missed = p.call.strike ? plateDepth < -1 * IN : plateDepth > 1 * IN;
        var against = p.call.strike ? homeBat : !homeBat;
        if (missed && against) {
          var ends = isLast && (r === 'K' || r === 'BB'), bigM = ends || (curPA && curPA.stakes > 0.1);
          cue(seg, 0.6, bigM ? 'boo_long' : 'boo_short', bigM ? 0.9 : 0.7);
        }
      }
      // ---- the running game on this pitch
      if (p.steal && !p.steal.back) {
        var tB = Math.max(0.5, p.steal.tRun - 1.35);
        cue(seg, tB, 'slide', 0.9);
        var who = last(p.steal.id), bag = BASEW[p.steal.to];
        var dwpS = stealSwing(play, p), good = (dwpS > 0);
        if (p.steal.safe) {
          say(seg, tB + 0.2, 'pbp', play.half === HOME ? 'excited' : 'building', [p.steal.wild ? 'Safe, and the throw gets away! ' + who + ' takes ' + BASEW[Math.min(4, p.steal.to + 1)] + '.' : 'Safe at ' + bag + '! A stolen base for ' + who + '.', 'Safe at ' + bag + '!'], 1);
        } else {
          say(seg, tB + 0.2, 'pbp', play.half === HOME ? 'deflated' : 'excited', ['The throw... and he is out! Caught stealing' + (r === 'END' || (p.outsAfter >= 3) ? ', and that ends the inning.' : '.'), 'Caught stealing!'], 1);
        }
        react(seg, tB + 0.2, play, dwpS);
      }
      if (p.wild) {
        var runs = p.wild.runs;
        say(seg, 1.2, 'pbp', play.half === HOME ? 'excited' : 'building', [(p.wild.kind === 'WP' ? 'In the dirt, and it gets away!' : 'Past the catcher!') + (runs ? ' A run scores!' : ' The runner' + (p.wild.from.length > 1 ? 's move up.' : ' moves up.')), (p.wild.kind === 'WP' ? 'Wild pitch!' : 'Passed ball!')], 1);
        react(seg, 1.4, play, stealSwing(play, p));
      }
      // ---- the call
      var strikesAfter = cw[1] + (res === 'called_strike' || res === 'swinging_strike' || (res === 'foul' && cw[1] < 2) ? 1 : 0), ballsAfter = cw[0] + (res === 'ball' ? 1 : 0);
      var callE = (cw[1] === 2 || cw[0] === 3) && curPA && curPA.stakes > 0.08 ? 'building' : 'calm';
      if (isLast && r === 'K') {
        var homeK = !homeBat, looking = res === 'called_strike', dwp = play.wpAfter - play.wpBefore;
        var e = homeK ? (Math.abs(dwp) > 0.06 ? 'peak' : 'excited') : 'deflated';
        say(seg, 0.15, 'pbp', e, homeK ? [looking ? pitchBit + 'Strike three called! ' + ln(P) + ' froze him!' : 'Swung on and missed! Strike three! ' + ln(P) + ' gets him!', looking ? 'Strike three called!' : 'Strike three!']
                                        : [looking ? 'Called strike three. ' + ln(B) + ' goes down looking.' : 'Strike three. ' + ln(B) + ' goes down swinging.', 'Strike three.'], 1);
        if (play === G.plays[G.plays.length - 1]) say(seg, 3.4, 'pbp', homeK ? 'peak' : 'deflated', [endWords()], 1, { slide: 1 });
        react(seg, 0.4, play, dwp, 'K');
      } else if (isLast && r === 'BB') {
        var forced = play.runs > 0, dwp2 = play.wpAfter - play.wpBefore;
        say(seg, 0.15, 'pbp', homeBat ? (forced ? 'excited' : 'building') : (forced ? 'deflated' : 'calm'), ['Ball four' + (loc ? ', ' + loc : '') + '. ' + ln(B) + ' walks' + (forced ? ', and that forces in a run! ' + cap(scoreLine(play.score)) + '.' : '.'), 'Ball four.'], 1);
        cue(seg, 0.8, 'bat_drop', 0.8);
        if (homeBat || forced) react(seg, 0.5, play, dwp2, 'walk');
      } else if (isLast && r === 'HBP') {
        cue(seg, 0.05, 'ooh_wince', 0.9); cue(seg, 0.9, 'bat_drop', 0.7);
        say(seg, 0.3, 'pbp', 'building', ['And he is hit by the pitch! ' + ln(B) + ' takes first' + (play.runs ? ', and a run is forced in.' : '.'), 'Hit by the pitch.'], 1);
        if (play.runs) react(seg, 1.5, play, play.wpAfter - play.wpBefore);
      } else if (isLast && r === 'END') {
        // caught stealing for the third out: called above
      } else if (isLast && play.play) {
        callBallInPlay(seg, play, p);   // a ball in play, or a foul pop caught for the out
      } else if (res === 'ball') {
        say(seg, 0.15, 'pbp', callE, [pitchBit + 'Ball ' + num(ballsAfter) + (pitchBit || !loc ? '' : ', ' + loc) + '.', 'Ball ' + num(ballsAfter) + '.'], 1);
      } else if (res === 'called_strike') {
        var corner = plateDepth < 1.5 * IN ? (plateDepth < 0 ? ', and that looked off the plate' : ', on the corner') : '';
        say(seg, 0.15, 'pbp', callE, [pitchBit + 'Called strike ' + num(strikesAfter) + corner + '.', 'Strike ' + num(strikesAfter) + '.'], 1);
      } else if (res === 'swinging_strike') {
        say(seg, 0.15, 'pbp', callE, [pitchBit + pick(seg.id + 's', ['Swung on and missed', 'Swing and a miss', 'He swung through it']) + ', strike ' + num(strikesAfter) + '.', 'Strike ' + num(strikesAfter) + '.'], 1);
      } else if (res === 'foul') {
        var b = p.bb, fd2 = b.projDist || 0, longF = fd2 > 300 && b.la > 15, stands = fd2 > 120 && b.la > 18 && Math.abs(b.spray) > 46;
        var where = b.spray < -45 ? 'the third-base side' : b.spray > 45 ? 'the first-base side' : '';
        var fl = longF ? 'Long drive... foul ball!' : fd2 < 25 ? 'Fouled back.' : stands ? pick(seg.id + 'f', ['Fouled off, into the seats' + (where ? ' on ' + where : '') + '.', 'Foul, and into the stands.']) : pick(seg.id + 'f', ['Fouled off.', 'Foul ball.', 'Fouled away' + (where ? ' to ' + where : '') + '.']);
        say(seg, 0.15, 'pbp', longF ? 'excited' : 'calm', [fl + (cw[1] === 2 ? ' Still ' + countWords(cw[0] + '-2') + '.' : ''), fl], 1);
        if (longF) cue(seg, 0.4, 'ooh_close_foul', 0.8);
        else if (stands) cue(seg, Math.min(b.hang || 2, 3), 'foul_souvenir', 0.6);
      }
      // ---- colour in the gap after a taken pitch, a foul or a swing and miss, before the next call
      if (!isLast && nextSeg) {
        var nextCall = nextSeg.t0 + BBSchedule.PACE.setup + BBSchedule.PACE.flight;   // the next pitch's result
        if (nextColour()) cands.push({ seg: seg, t: seg.t0 + 1.4, role: 'colour', energy: 'calm', alts: null, gen: true, prio: 3, slide: 1.2, until: nextCall - 0.3, n: cands.length });
      }
    }
    function stealSwing(play, p) {   // how far a steal or wild pitch moved the home side's chance
      if (!p.basesAfter) return 0;
      var sc = play.scoreBefore.slice(), runs = 0;
      if (p.wild && p.wild.runs) runs = p.wild.runs;
      if (p.steal && p.steal.safe && p.steal.to >= 4) runs = 1;
      sc[play.half] += runs;
      var before = wpOf(play.inning, play.half, play.outs, p.bases || play.bases, play.scoreBefore), after = wpOf(play.inning, play.half, p.outsAfter, p.basesAfter, sc);
      return after - before;
    }

    // ------------------------------------------------------------ a ball in play
    function callBallInPlay(seg, play, p) {
      var r = play.play, bb = play.pa.bb || p.bb, B = play.batter, homeBat = play.half === HOME, dwp = play.wpAfter - play.wpBefore;
      var tRes = play.tResolve - seg.t0, lastPlay = play === G.plays[G.plays.length - 1];
      var deep = bb.projDist > 330, hard = bb.ev >= 100, dir = sprayDir(bb.spray, r.type);
      var hot = homeBat ? (deep || hard ? 'excited' : 'building') : (deep || hard ? 'building' : 'calm');
      // contact: only what can be seen - the kind of ball and where it is going
      var contact;
      if (r.hit === 'HR' || (r.type === 'FB' && deep)) contact = pick(seg.id + 'c', ['Swung on, a high drive ' + (bb.spray < -12 ? 'to deep left' : bb.spray > 12 ? 'to deep right' : 'to deep center') + '...', 'There is a drive, deep ' + dir.replace('to ', '') + '...']);
      else if (r.type === 'GB') contact = (hard ? 'Hard ground ball ' : pick(seg.id + 'c', ['Ground ball ', 'A bouncer ', 'Grounder '])) + dir + '.';
      else if (r.type === 'LD') contact = 'Line drive ' + dir + '!';
      else if (r.type === 'PU') contact = 'Popped up' + (bb.projDist < 150 ? ', on the infield.' : ', shallow ' + dir.replace('to ', '') + '.');
      else contact = 'Fly ball ' + dir + '.';
      say(seg, 0.05, 'pbp', r.hit === 'HR' || deep ? (homeBat ? 'excited' : 'building') : hot, [contact], 1);
      if (bb.hang > 2.5 && bb.projDist > 250) cue(seg, 0.3, 'swell_fly', clamp((bb.projDist - 200) / 200, 0.4, 1) * (homeBat ? 1 : 0.7), Math.min(6, bb.hang - 0.3));
      // the sounds of the play
      r.events.forEach(function (e) {
        if (e.kind === 'catch') cue(seg, e.t, 'glove_catch', 0.9);
        if (e.kind === 'throw' && e.arrive && !e.wild) cue(seg, e.arrive, 'glove_catch', 0.8);
        if (e.kind === 'cover' && e.arrive) cue(seg, e.arrive, 'glove_catch', 0.7);
      });
      if (bb.kind === 'wall' && r.hit !== 'HR') cue(seg, bb.landT, 'ball_wall', 0.9);
      r.runners.forEach(function (rn) {   // a close play at a bag: the slide
        var th = r.events.filter(function (e) { return e.kind === 'throw' && e.to === rn.to && e.arrive; })[0], a = rn.arrive;
        if (th && a !== undefined && Math.abs(th.arrive - a) < 0.45 && rn.to > rn.from && rn.from > 0) cue(seg, Math.min(a, th.arrive) - 0.15, 'slide', 0.8);
      });
      // the middle: the catch, the stop, the ball dropping in - at the moment it happens
      var catchE = r.events.filter(function (e) { return e.kind === 'catch'; })[0], fieldE = r.events.filter(function (e) { return e.kind === 'field' || e.kind === 'muff'; })[0];
      var dropE = r.events.filter(function (e) { return e.kind === 'drop'; })[0];
      var outsNow = play.outsAfter, outW = outsNow >= 3 ? (lastPlay ? endWords() : 'And that is three outs.') : outsNow === 2 ? 'Two down.' : 'One away.';
      if (r.hit === 'HR') {
        var hrE = homeBat ? 'peak' : 'building';
        say(seg, Math.max(1.6, bb.hang - 0.4), 'pbp', hrE, homeBat ? [pick(seg.id + 'h', ['It is gone!', 'Way back... gone!', 'Get out of here! Gone!'])] : ['And that one is gone.'], 1);
        var nm = r.runs === 4 ? 'A grand slam' : r.runs === 1 ? 'A solo home run' : 'A ' + num(r.runs) + '-run homer';
        var sum = nm + ' for ' + B.name + ', ' + num(bb.projDist) + ' feet. ' + cap(scoreLine(play.score)) + (lastPlay && homeBat ? ', and the ' + H.nick + ' win it!' : '.');
        say(seg, Math.max(bb.hang + 1.8, 4.5), 'pbp', homeBat ? 'excited' : 'deflated', [sum, nm + '. ' + cap(scoreLine(play.score)) + '.'], 1, { slide: 2 });
        react(seg, bb.hang, play, dwp, 'HR');
        if (homeBat) play_(seg, tRes + 0.5, 'organ_hr');
        // colour: how hard and how far, in the trot's wake
        cands.push({ seg: seg, t: seg.t0 + tRes + 0.8, role: 'colour', energy: homeBat ? 'building' : 'calm', alts: ['Off the bat at ' + num(bb.ev) + ' miles an hour, at ' + num(bb.la) + ' degrees.'], prio: 3, slide: 3, until: Infinity, n: cands.length });
        return;
      }
      if (catchE && r.hit !== 'E') {
        var fn = fielderName(play, catchE.who);
        say(seg, Math.max(0.9, catchE.t - 0.25), 'pbp', homeBat ? (deep ? 'deflated' : 'calm') : (deep ? 'excited' : 'building'), [deep ? fn + ' is there, and he makes the catch.' : pick(seg.id + 'k', [fn + ' has it.', fn + ' makes the catch.', 'Caught by ' + fn + '.'])], 1);
        if (deep && homeBat) cue(seg, catchE.t, 'letdown', 0.85);
      } else if (dropE) {
        say(seg, Math.max(0.9, dropE.t - 0.1), 'pbp', 'excited', ['And he drops it!'], 1);
      } else if (fieldE && r.type === 'GB' && r.hit === 'OUT') {
        var fw = fielderName(play, fieldE.who), th0 = r.events.filter(function (e) { return e.kind === 'throw'; })[0];
        say(seg, Math.max(0.8, fieldE.t - 0.3), 'pbp', 'calm', [fw + (th0 ? ' has it, throws...' : ' has it...')], 2);
      } else if (fieldE && fieldE.kind === 'muff') {
        say(seg, Math.max(0.8, fieldE.t), 'pbp', 'excited', [fielderName(play, fieldE.who) + ' cannot handle it!'], 1);
      } else if (r.hit === '1B' || r.hit === '2B' || r.hit === '3B') {
        var land = bb.kind === 'wall' ? 'Off the wall!' : r.type === 'GB' ? 'And it is through!' : r.hit !== '1B' && Math.abs(bb.spray) > 9 && Math.abs(bb.spray) < 32 ? 'Into the gap!' : 'It drops in!';
        var tLand = r.type === 'GB' ? (fieldE ? fieldE.t - 0.6 : 1.6) : Math.min(bb.landT || 1, 4);   // a grounder is 'through' as it reaches the outfield
        say(seg, Math.max(0.9, tLand), 'pbp', homeBat ? 'excited' : 'building', [land], 1, { slide: 0.8 });
      }
      // the resolution: the play's own description, the runners and the score
      var scored = r.runners.filter(function (rn) { return !rn.out && rn.to >= 4 && rn.from > 0; }).map(function (rn) { return last(rn.id); });
      var batR = r.runners.filter(function (rn) { return rn.from === 0; })[0];
      var outAt = r.runners.filter(function (rn) { return rn.out && rn.from > 0; });
      var scoreBit = play.runs ? ' ' + (scored.length === 1 ? scored[0] + ' scores' : scored.length ? scored.slice(0, -1).join(', ') + ' and ' + scored[scored.length - 1] + ' score' : 'A run scores') + (lastPlay && homeBat ? '! And the ' + H.nick + ' win it!' : ', and ' + scoreLine(play.score) + '.') : '';
      var resText, shortText, eRes;
      if (r.hit === '1B' || r.hit === '2B' || r.hit === '3B') {
        var bag = { '1B': 'first', '2B': 'second', '3B': 'third' }[r.hit];
        resText = (r.hit === '1B' ? pick(seg.id + 'b', ['Base hit, ' + ln(B) + '.', 'A single for ' + ln(B) + '.']) : ln(B) + ' is into ' + bag + ' with ' + HITW[r.hit] + '.') + scoreBit; shortText = cap(HITW[r.hit]) + '.' + scoreBit;
        eRes = homeBat ? (play.runs || r.hit !== '1B' ? (Math.abs(dwp) > 0.12 || lastPlay ? 'peak' : 'excited') : 'building') : (play.runs ? 'deflated' : 'calm');
      } else if (r.hit === 'E') {
        resText = ln(B) + ' is safe on the error.' + scoreBit; shortText = 'Safe on the error.'; eRes = homeBat ? 'excited' : 'deflated';
      } else if (r.hit === 'SF') {
        resText = 'The runner tags and scores; a sacrifice fly for ' + ln(B) + '. ' + cap(scoreLine(play.score)) + '.'; shortText = 'Sacrifice fly, a run scores.'; eRes = homeBat ? 'excited' : 'deflated';
      } else if (r.dp) {
        resText = 'Double play! ' + (outsNow >= 3 ? 'That ends the inning.' : 'Two down.'); shortText = 'Double play!'; eRes = homeBat ? 'deflated' : 'excited';
      } else if (r.hit === 'FC') {
        var oa = outAt[0];
        resText = (oa ? 'They get ' + last(oa.id) + ' at ' + BASEW[Math.min(4, oa.to)] + ', ' : 'A fielder\'s choice, ') + 'and ' + ln(B) + ' is safe at first. ' + outW + scoreBit; shortText = 'Fielder\'s choice. ' + outW; eRes = homeBat ? 'calm' : 'building';
      } else {
        // an out: who made it, from the play's own description
        var outWhere = outAt.length ? 'Out at ' + BASEW[Math.min(4, outAt[0].to)] + '! ' : '', how = '';
        var gm = /^ground out, (\w+) (to first|unassisted|to the pitcher covering|to second)/.exec(play.desc);
        if (gm) how = fielderName(play, gm[1]) + (gm[2] === 'unassisted' ? ' takes it to the bag himself. ' : gm[2] === 'to first' ? ' to first, in time. ' : ' ' + gm[2] + ', and he is out. ');
        var tag = /tag|runner scores/.test(play.desc) ? cap(play.desc.split(', ').slice(1).join(', ')) + '. ' : '';
        resText = (catchE ? '' : how || outWhere || 'Out at first. ') + tag + outW + (play.runs && !tag ? scoreBit : ''); shortText = outW; eRes = homeBat ? 'calm' : (outsNow >= 3 ? 'building' : 'calm');
      }
      say(seg, Math.max(1.3, tRes), 'pbp', eRes, [resText.trim(), shortText.trim()], 1, { slide: 1.5 });
      react(seg, Math.max(0.6, tRes), play, dwp);
      // colour in the walk back after a hard-hit or long ball
      if (!lastPlay && (bb.ev >= 100 || bb.projDist >= 340)) cands.push({ seg: seg, t: seg.t0 + tRes + 1.2, role: 'colour', energy: 'calm', alts: [(r.hit === 'OUT' ? 'He hit that one hard: ' : 'Off the bat at ') + num(bb.ev) + ' miles an hour' + (bb.projDist > 200 ? ', ' + num(bb.projDist) + ' feet.' : '.'), num(bb.ev) + ' off the bat.'], prio: 3, slide: 2.5, until: Infinity, n: cands.length });
    }

    function endWords() { return G.score[1] > G.score[0] ? 'And that is the ball game! The ' + H.nick + ' win it!' : 'And that will do it.'; }

    // ------------------------------------------------------------ the final
    function writeFinal(seg) {
      var lp = G.plays[G.plays.length - 1], homeWin = G.score[1] > G.score[0], w = homeWin ? 1 : 0, walkoff = homeWin && lp.half === HOME;
      var fin = 'Final score: the ' + T[w].nick + ' ' + num(G.score[w]) + ', the ' + T[1 - w].nick + ' ' + num(G.score[1 - w]) + '.';
      say(seg, 1.0, 'pbp', homeWin ? 'excited' : 'deflated', [fin, 'Final: ' + T[w].nick + ' ' + num(G.score[w]) + ', ' + T[1 - w].nick + ' ' + num(G.score[1 - w]) + '.'], 1);
      // the star of the game, from the winners' box score
      var best = null, box = {};
      G.plays.forEach(function (p) {
        if (p.half !== w) return; var wd = paWords(p); if (!wd) return;
        var b = box[p.batter.id] || (box[p.batter.id] = { id: p.batter.id, ab: 0, h: 0, hr: 0, rbi: 0, xbh: [] });
        if (wd.ab) b.ab++; if (wd.hit) b.h++; if (p.play && p.play.hit === 'HR') b.hr++; if (p.play && p.play.hit !== 'HR' && p.play.hit !== '1B' && wd.hit) b.xbh.push(wd.word);
        b.rbi += p.play ? p.play.rbi || 0 : (p.runs || 0);
      });
      Object.keys(box).forEach(function (id) { var b = box[id], sc = b.h * 1.5 + b.hr * 3 + b.rbi; if (!best || sc > best.sc) { best = b; best.sc = sc; } });
      var lines2 = [];
      if (best && best.h) lines2.push(last(best.id) + ' went ' + num(best.h) + ' for ' + num(best.ab) + (best.hr ? ' with ' + (best.hr === 1 ? 'a home run' : num(best.hr) + ' home runs') : best.xbh.length ? ', with ' + (best.xbh.length === 1 ? 'a ' + best.xbh[0] : num(best.xbh.length) + ' extra-base hits') : '') + (best.rbi ? ', and drove in ' + num(best.rbi) + '.' : '.'));
      var sp = T[w].starter, d = pitcherDay(sp, G.plays.length);
      if (d.outs) lines2.push(ln(sp) + ' started and went ' + inningsWords(d.outs) + ', with ' + num(d.k) + ' strikeout' + (d.k === 1 ? '' : 's') + '.');
      if (lines2.length) say(seg, 8.5, 'colour', homeWin ? 'building' : 'calm', [lines2.join(' '), lines2[0]], 2, { slide: 3 });
      say(seg, 26, 'pbp', 'calm', [homeWin ? 'A win for the ' + H.nick + '. Thanks for listening, everybody, and good night.' : 'Thanks for listening, everybody. Good night.'], 2, { slide: 4 });
      if (homeWin) { cue(seg, 0.2, walkoff ? 'eruption' : 'cheer_big', 1); cue(seg, 6, 'ovation', 0.9, 20); play_(seg, 4.0, 'organ_win'); }
      else { cue(seg, 0.2, 'groan_big', 0.8); cue(seg, 1.0, 'pocket_visitors', 0.8); cue(seg, 4, 'murmur_stunned', 0.7); }
    }

    // ============================================================ PLACE THE AIR
    // Lines that must be said go first, then the rest in order of priority and time.
    // Each takes the first stretch of free air in its window that fits it whole
    // (its full form, or a shorter one); what fits nowhere is dropped.
    var busy = [], placed = [], dropped = [], shortened = 0, budget = { colourPA: {} };
    function free(s, e) { for (var j = 0; j < busy.length; j++) if (s < busy[j][1] + AIR && e + AIR > busy[j][0]) return busy[j]; return null; }
    cands.sort(function (a, b) { return a.prio - b.prio || a.t - b.t || a.n - b.n; });
    cands.forEach(function (c) {
      var alts = c.alts;
      if (c.gen) {   // colour from this at-bat's list, the first that is still unsaid
        var L = colourFor(c);
        if (!L) return;
        alts = [];
        L.forEach(function (q) { q.alts.forEach(function (a) { alts.push({ text: a, key: q.key, streak: q.streak }); }); });
      } else alts = alts.map(function (a) { return { text: a }; });
      for (var ai = 0; ai < alts.length; ai++) {
        var d = estDur(alts[ai].text, c.role, c.energy), s = c.t, endBy = c.until;
        while (s <= c.t + c.slide + 1e-9) {
          var e = s + d, hit = free(s, e);
          if (e > endBy) break;
          if (!hit) {
            busy.push([s, e]); busy.sort(function (a, b) { return a[0] - b[0]; });
            placed.push({ c: c, text: alts[ai].text, t: s, dur: d, short: ai > 0 && !c.gen });
            if (ai > 0 && !c.gen) shortened++;
            if (alts[ai].key) used[alts[ai].key] = true;
            if (alts[ai].streak) streakSaid[alts[ai].streak[0]] = alts[ai].streak[1];
            return;
          }
          s = hit[1] + AIR;
        }
      }
      dropped.push({ event: c.seg.id, role: c.role, text: c.gen ? '(colour)' : alts[0].text, prio: c.prio, est: +estDur(alts[0].text || '', c.role, c.energy).toFixed(1) });
    });
    // colour cands remember their at-bat: rebuilt from the segment (the plan for that at-bat)
    function colourFor(c) {
      var play = c.seg.play, k = G.plays.indexOf(play), save = curPA;
      if (!play) return null;
      curPA = { play: play, colour: [] }; planColour(play, dayOf(play), k, c.seg.i === undefined ? 0 : c.seg.i + 1);   // his pitches so far count
      var L = curPA.colour.filter(function (q) { return !used[q.key]; }); curPA = save;
      return L.length ? L : null;
    }

    // every cue is keyed to the segment its moment falls in, with its offset from that segment's start
    function rekey(o) { var sg = SCHED.segAt(o.t + 1e-6); o.event = sg.id; o.offset = +(o.t - sg.t0).toFixed(2); return o; }
    placed.sort(function (a, b) { return a.t - b.t; });
    var lines = placed.map(function (q, j) {
      var nx = placed[j + 1], maxDur = nx ? nx.t - q.t - 0.1 : 30, o = rekey({ t: q.t });
      return { id: o.event + '.v' + j, event: o.event, offset: o.offset, t: +q.t.toFixed(2), role: q.c.role, voice: voices[q.c.role],
               text: q.text, pace: PACE[q.c.role][q.c.energy], energy: q.c.energy, est: +q.dur.toFixed(2), maxDur: +Math.min(maxDur, q.c.until - q.t).toFixed(2), prio: q.c.prio };
    });
    sfx.sort(function (a, b) { return a.t - b.t; }).forEach(rekey);
    organ.sort(function (a, b) { return a.t - b.t; }).forEach(rekey);
    // stats for the checks
    var pas = G.plays.length, withColour = {};
    lines.forEach(function (l) { if (l.role === 'colour') { var m = /^(\d+[tb]\.\d+)/.exec(l.event); if (m) withColour[m[1]] = 1; } });
    var stats = { lines: lines.length, candidates: cands.length, dropped: dropped.length, shortened: shortened, pas: pas, pasWithColour: Object.keys(withColour).length,
                  words: lines.reduce(function (s, l) { return s + words(l.text); }, 0), speech: lines.reduce(function (s, l) { return s + l.est; }, 0), total: SCHED.total };
    return { version: VERSION, seed: seed, lines: lines, sfx: sfx, crowd: crowd, organ: organ, dropped: dropped, stats: stats };
  }

  return { version: VERSION, write: write, estDur: estDur, PACE: PACE, TIMING: TIMING, GAP: GAP, num: num };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBCall;
