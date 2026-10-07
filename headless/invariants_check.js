/* ============================================================================
   invariants_check.js · v0.5 · 2026-10-06

   Every simulated play checked for the impossible, over whole games: base
   states that are legal (one man a base, nobody on 'base 0', nobody passing
   the man ahead), runners that are conserved (every man who was on base or
   came to bat is on a base, out or across the plate afterwards, exactly
   once), outs that never pass three and end the inning at exactly three,
   runs credited once and summing to the score, the scored result consistent
   with where the batter and the runners went, the running game's bookkeeping
   (steals, pickoffs, wild pitches), nine distinct fielders at nine positions,
   and a legal batting order (the pitcher's spot in the NL). Every violation
   is counted and the first few are printed with the seed and the play's key,
   so it can be replayed. A regression test: it should print no violations.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js headless/invariants_check.js -- [games] [seed]

   CHANGED
     v0.5  every trait's mean, at every position, lies inside the range its draws are clipped to (react's had fallen
           below its floor in the integration: every position player then reacted in exactly 0.25 s)
     v0.4  the current rules (bb_game v1.6): no pitcher leaves before he has faced three or finished a half-inning;
           from the tenth inning each half starts with the man who batted before its leadoff hitter on second; no
           more than two throws over a plate appearance
     v0.3  a run on a caught fly whose third out is a runner tagged out is a time play, not a run after a third out
           made by the batter (bb_field v1.10 judges the time; the rule had never fired while no tag-up was thrown out)
     v0.2  half the games play NL rules by name (a game given no rules now plays a designated hitter for both
           sides, bb_game v1.4), so the pitcher's spot and the pinch-hitter are still checked
============================================================================ */
(function (A) {
  var N = +A[0] || 500, SEED = +A[1] || 3, MAXEX = +A[2] || 3, rng = BB.makeRng(SEED);
  var V = {}, EX = {}, nGames = 0, nPlays = 0, nPitches = 0;
  var POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  function flag(kind, key, detail) {
    V[kind] = (V[kind] || 0) + 1;
    if (!EX[kind]) EX[kind] = [];
    if (EX[kind].length < MAXEX) EX[kind].push(key + (detail ? '  | ' + detail : ''));
  }
  // the traits first: a mean outside its clip (at any position's offset) pins every draw at the edge
  Object.keys(BB.TRAITS).forEach(function (k) {
    var t = BB.TRAITS[k]; if (!Array.isArray(t) || t.length !== 4) return;
    var offs = { all: 0 }; Object.keys(BB.FIELD_MEANS).forEach(function (pos) { if (BB.FIELD_MEANS[pos][k] !== undefined) offs[pos] = BB.FIELD_MEANS[pos][k]; });
    Object.keys(offs).forEach(function (pos) { var m = t[0] + offs[pos]; if (!(m > t[2] && m < t[3])) flag('a trait whose mean lies outside the range its draws are clipped to', k + ' at ' + pos, 'mean ' + m.toFixed(3) + ', clipped to ' + t[2] + '..' + t[3]); });
  });
  function ids(b) { var o = []; for (var i = 1; i <= 3; i++) if (b && b[i]) o.push(b[i].id); return o; }
  function show(b) { return [1, 2, 3].map(function (i) { return b && b[i] ? i : '-'; }).join(''); }
  function legal(b, what, key) {
    var seen = {};
    for (var i = 1; i <= 3; i++) if (b[i]) { if (seen[b[i].id]) flag('a runner on two bases (' + what + ')', key, show(b)); seen[b[i].id] = 1; }
    if (b[0]) flag('a man left on base 0 (' + what + ')', key);
  }
  function forcedAdvance(b, batter) {       // what a walk does, from any state
    var o = b.slice(), runs = 0;
    if (o[1]) { if (o[2]) { if (o[3]) runs++; o[3] = o[2]; } o[2] = o[1]; }
    o[1] = batter; return { bases: o, runs: runs };
  }
  function same(a, b) { for (var i = 1; i <= 3; i++) { var x = a[i] ? a[i].id : null, y = b[i] ? b[i].id : null; if (x !== y) return false; } return true; }

  // one pitch's running game: replay its records from the state before it and compare with the state it left
  function checkPitch(p, rec, k, key) {
    nPitches++;
    var pk = key + ' pitch ' + (k + 1);
    if (rec.outsAt > 3) flag('a pitch thrown with more than three outs', pk);
    if (rec.pickoffs) rec.pickoffs.forEach(function (ev) {
      var b0 = ev.basesBefore, b1 = ev.basesAfter;
      if (!b0[ev.from] || b0[ev.from].id !== ev.id) flag('pickoff: the runner was not on the base he was picked from', pk);
      if (ev.out) { if (b1[ev.from] || ev.outsAfter !== ev.outsBefore + 1) flag('pickoff out: the runner stayed or the out was not counted', pk); }
      else if (ev.error) { if (!b1[ev.to] || b1[ev.to].id !== ev.id || b1[ev.from]) flag('pickoff error: the runner did not take his base', pk); }
      else if (!same(b0, b1) || ev.outsAfter !== ev.outsBefore) flag('pickoff back safely: the state changed', pk);
    });
    if (!rec.steal && !rec.wild) return;
    if (rec.steal && rec.steal.back) return;           // a foul: he goes back, nothing to check
    var b = rec.bases.slice(), outs = rec.outsAt, runs = 0, st = rec.steal;
    if (st) {
      if (!b[st.from] || b[st.from].id !== st.id) flag('steal: the runner was not on the base he stole from', pk, show(rec.bases));
      var pl = b[st.from]; b[st.from] = null;
      if (st.safe) {
        if (st.wild) { if (b[3]) { runs++; b[3] = null; } for (var i = 2; i >= 1; i--) if (b[i]) { b[i + 1] = b[i]; b[i] = null; } }
        var to = st.wild ? Math.min(4, st.to + 1) : st.to;
        if (to >= 4) runs++; else { if (b[to]) flag('steal: the base he took was occupied', pk, show(rec.bases)); b[to] = pl; }
      } else outs++;
    }
    if (rec.wild) {
      if (b[3]) { runs++; b[3] = null; }
      if (b[2]) { b[3] = b[2]; b[2] = null; }
      if (b[1]) { b[2] = b[1]; b[1] = null; }
    }
    if (!same(b, rec.basesAfter)) flag('the running game left a different state than its records say', pk, show(rec.bases) + ' -> ' + show(rec.basesAfter) + ' (replayed ' + show(b) + ')');
    if (outs !== rec.outsAfter) flag('the running game: outs differ from its records', pk, outs + ' vs ' + rec.outsAfter);
    rec._runs = runs;
  }

  function checkPlay(p, key, outs0) {
    var r = p.play, R = r.runners || [];
    if (!r.runners) { flag('a ball in play without its runner list', key); return; }
    var outsOnPlay = R.filter(function (q) { return q.out; }).length, scored = R.filter(function (q) { return !q.out && q.to >= 4; }).length;
    if (outsOnPlay !== r.outsMade) flag('outs made differ from the runners put out', key, outsOnPlay + ' vs ' + r.outsMade);
    var thirdOut = outs0 + r.outsMade >= 3;   // outs0: the count when the ball was hit (a runner may have been thrown out during the at-bat)
    if (!thirdOut && scored !== r.runs) flag('runs differ from the runners who crossed the plate', key, scored + ' vs ' + r.runs);
    if (thirdOut && r.runs > scored) flag('more runs than runners crossed the plate', key);
    // no run scores when the third out is the batter before first base or a runner forced
    var bat0 = R.filter(function (q) { return q.from === 0; })[0];
    // (a caught fly puts the batter out first: a runner tagged out after it for the third out is a time play, and a run
    // that crossed before the tag counts - bb_field v1.10 judges it)
    var caught = (r.events || []).some(function (e) { return e.kind === 'catch'; });
    if (thirdOut && r.runs && ((bat0 && bat0.out && !caught) || /force out|double play/.test(r.desc))) flag('a run scored on a play whose third out was a force or the batter', key, r.desc);
    // nobody passes the man ahead; one man a base
    var live = R.filter(function (q) { return !q.out; }).sort(function (a, b) { return b.from - a.from; });
    for (var i = 1; i < live.length; i++) {
      var a = live[i - 1], b = live[i];
      if (b.to > a.to) flag('a runner passed the man ahead', key, 'from ' + b.from + ' to ' + b.to + ' past the man from ' + a.from + ' to ' + a.to);
      else if (b.to === a.to && a.to < 4) flag('two runners on one base (in the play)', key, 'both to ' + a.to + ' from ' + a.from + ' and ' + b.from);
    }
    // the batter went where the scoring says
    var bat = R.filter(function (q) { return q.from === 0; })[0];
    if (!bat) { flag('a ball in play without the batter among its runners', key); return; }
    var want = { '1B': 1, '2B': 2, '3B': 3, 'HR': 4 }[r.hit];
    if (want !== undefined) { if (bat.out) { if (bat.to !== want + 1) flag('a hit with the batter out, not at the next base', key, r.hit + ' out at ' + bat.to); } else if (bat.to < want) flag('a hit with the batter short of its base', key, r.hit + ' to ' + bat.to); else if (bat.to > want && !r.error) flag('a hit with the batter past its base and no error', key, r.hit + ' to ' + bat.to); }
    else if (r.hit === 'OUT' || r.hit === 'SF') { if (!bat.out) flag('an out with the batter safe', key, r.hit); if (r.hit === 'SF' && (r.runs === 0 || thirdOut)) flag('a sacrifice fly with no run, or as the third out', key); }
    else if (r.hit === 'FC') { if (bat.out) flag("a fielder's choice with the batter out", key); if (!R.some(function (q) { return q.out && q.from > 0; }) && !/ahead of the throw/.test(r.desc)) flag("a fielder's choice with no runner out and no force tried", key); }
    else if (r.hit === 'E') { if (bat.out || !r.error) flag('reached on an error without an error, or out', key); }
    else flag('no scored result', key, String(r.hit));
    // the bases afterwards hold exactly the runners the play left there
    var expect = [null, null, null, null];
    R.forEach(function (q) { if (!q.out && q.to >= 1 && q.to <= 3) { if (expect[q.to]) flag('two runners on one base (left there)', key, 'base ' + q.to); expect[q.to] = q.id; } });
    for (var bI = 1; bI <= 3; bI++) { var x = p.basesAfter[bI] ? p.basesAfter[bI].id : null; if (x !== expect[bI]) flag('a runner ended where the play did not put him', key, 'base ' + bI + ': ' + x + ' vs ' + expect[bI]); }
  }

  for (var g = 0; g < N; g++) {
    var T = BBNames.teams(rng), away = BBGame.makeTeam(rng, T[0]), home = BBGame.makeTeam(rng, T[1]);
    var G = BBGame.simGame(away, home, { rng: rng, rules: g % 2 ? 'NL' : 'AL' }), score = [0, 0], gone = {};
    var mound = [null, null];   // each side's pitcher now: who, batters faced since he came in, whether he has finished a half
    nGames++;
    G.innings.forEach(function (inn, ii) {
      var outs = 0, runsInn = 0, last = null, d = 1 - inn.half;
      if (G.ghost && inn.n >= 10) {   // the extra-innings runner on second
        var gk = 'seed ' + SEED + ' game ' + g + ' ' + (inn.half ? 'bot' : 'top') + ' ' + inn.n;
        if (!inn.ghost || !inn.plays[0].bases[2] || inn.plays[0].bases[2].id !== inn.ghost.id || inn.plays[0].bases[1] || inn.plays[0].bases[3]) flag('an extra inning that did not start with its runner alone on second', gk);
      }
      inn.plays.forEach(function (p, pi) {
        nPlays++;
        var key = 'seed ' + SEED + ' game ' + g + ' ' + (inn.half ? 'bot' : 'top') + ' ' + inn.n + ' play ' + pi + ' (' + p.batter.name + ': ' + p.desc + ')';
        // the three-batter minimum: a pitcher replaced has faced three, or finished a half-inning
        if (mound[d] && mound[d].id !== p.pitcher.id && mound[d].bf < 3 && !mound[d].done) flag('a pitcher left before facing three or finishing a half-inning', key, mound[d].bf + ' faced');
        if (!mound[d] || mound[d].id !== p.pitcher.id) mound[d] = { id: p.pitcher.id, bf: 0, done: false };
        if (p.pa.result !== 'END') mound[d].bf++;
        var throwsOver = (p.pa.pickoffsEnd || []).length;
        p.pa.pitches.forEach(function (q) { throwsOver += (q.pickoffs || []).length; });
        if (throwsOver > 2) flag('more than two throws over in a plate appearance', key, String(throwsOver));
        if (p.outs !== outs) flag('a play started from a different out count than the last one left', key, p.outs + ' vs ' + outs);
        if (p.outsAfter > 3) flag('outs above three', key, String(p.outsAfter));
        if (p.outsAfter < p.outs) flag('outs went down', key);
        legal(p.bases, 'before the play', key); legal(p.basesAfter, 'after the play', key);
        var before = ids(p.bases), after = ids(p.basesAfter), made = p.outsAfter - p.outs, batterIn = p.pa.result === 'END' ? 0 : 1;
        // every man is on a base, out or across the plate afterwards - except on the third out, when a runner who crossed
        // before a force does not score and one still running is simply left
        var conserved = before.length + batterIn - (after.length + made + p.runs);
        if (conserved < 0 || (conserved > 0 && p.outsAfter < 3)) flag('a runner appeared or vanished', key, 'before ' + show(p.bases) + ' + batter ' + batterIn + ' -> after ' + show(p.basesAfter) + ', outs ' + made + ', runs ' + p.runs);
        after.forEach(function (id) { if (before.indexOf(id) < 0 && id !== p.batter.id) flag('a runner from nowhere', key, String(id)); });
        if (p.pa.result !== 'END' && after.indexOf(p.batter.id) < 0 && before.indexOf(p.batter.id) >= 0) flag('the batter was already on base', key);
        score[inn.half] += p.runs;
        if (p.score[0] !== score[0] || p.score[1] !== score[1]) flag('the score is not the running sum of the runs', key, p.score.join('-') + ' vs ' + score.join('-'));
        // the pitches
        var st = p.bases.slice(), pitchRuns = 0;
        p.pa.pitches.forEach(function (rec, k) { checkPitch(p, rec, k, key); if (rec._runs) pitchRuns += rec._runs; });
        if (p.pa.pickoffsEnd && !p.pa.pickoffsEnd[p.pa.pickoffsEnd.length - 1].out) flag('the at-bat ended on a pickoff that was not an out', key);
        // the plate appearance's own result from the state the last pitch left
        var nP = p.pa.pitches.length, lastRec = nP ? p.pa.pitches[nP - 1] : null, pkEnd = p.pa.pickoffsEnd;
        var s0 = pkEnd ? pkEnd[pkEnd.length - 1].basesAfter : lastRec ? (lastRec.basesAfter || lastRec.bases) : p.bases, res = p.pa.result;
        var outs0 = pkEnd ? pkEnd[pkEnd.length - 1].outsAfter : lastRec ? (lastRec.outsAfter !== undefined ? lastRec.outsAfter : lastRec.outsAt) : p.outs;
        if (res === 'BB' || res === 'HBP' || res === 'IBB') {
          var fa = forcedAdvance(s0, p.batter);
          if (!same(fa.bases, p.basesAfter)) flag('a walk or hit by pitch left the wrong bases', key, show(s0) + ' -> ' + show(p.basesAfter));
          if (p.runs !== fa.runs + pitchRuns) flag('a walk or hit by pitch scored the wrong runs', key, p.runs + ' vs ' + (fa.runs + pitchRuns));
        } else if (res === 'K' || res === 'END') {
          if (!same(s0, p.basesAfter)) flag('a strikeout or an inning ended on the bases moved the runners', key, show(s0) + ' -> ' + show(p.basesAfter));
          if (res === 'K' && p.outsAfter !== outs0 + 1) flag('a strikeout did not add exactly one out', key);
          if (res === 'END' && outs0 !== 3) flag('an at-bat ended on the bases short of three outs', key, String(outs0));
        } else if (p.play) {
          checkPlay(p, key, outs0);
          if (p.runs !== p.play.runs + pitchRuns) flag('the play\'s runs and the pitches\' runs do not sum to the plate appearance\'s', key, p.runs + ' vs ' + p.play.runs + ' + ' + pitchRuns);
        } else flag('a plate appearance with neither a play nor a known result', key, String(res));
        // nine fielders at nine positions
        var pos = {}, fid = {}, nF = 0;
        (p.defense || []).forEach(function (F) { nF++; if (pos[F.pos]) flag('two men at one position', key, F.pos); pos[F.pos] = 1; if (fid[F.id]) flag('one man at two positions', key); fid[F.id] = 1; });
        if (nF !== 9 || POSITIONS.some(function (q) { return !pos[q]; })) flag('not nine fielders at the nine positions', key, Object.keys(pos).join(' '));
        if (p.pitcher && !fid[p.pitcher.id]) flag('the pitcher is not in the field', key);
        // the batting order: nine distinct men; in the NL exactly one spot is the pitcher's (null) and the batter is one of
        // the nine or the pitcher himself, in the AL no spot is empty; every fielder but the pitcher bats for his side
        if (p.order) {
          var seenO = {}, nulls = 0, nO = 0;
          p.order.forEach(function (id) { nO++; if (id === null) nulls++; else { if (seenO[id]) flag('a man twice in the batting order', key); seenO[id] = 1; } });
          if (nO !== 9) flag('the batting order is not nine', key, String(nO));
          if (G.rules === 'NL' && nulls !== (p.pinchPending ? 0 : 1)) flag('NL: the pitcher has no spot in the batting order', key, 'empty spots ' + nulls + (p.pinchPending ? ' (a pinch-hitter has it until the next half)' : ''));
          if (G.rules === 'AL' && nulls) flag('AL: an empty spot in the batting order', key);
          if (!seenO[p.batter.id] && !(G.rules === 'NL' && p.batter.id === p.batP)) flag('the batter is not in the batting order', key);
          var seenD = {}; (p.defOrder || []).forEach(function (id) { if (id !== null) seenD[id] = 1; });
          (p.defense || []).forEach(function (F) { if (F.pos !== 'P' && !seenD[F.id]) flag('a fielder who does not bat for his side', key, F.pos); });
          // a man who left the game stays out of it: a pitcher who was pinch-hit for never pitches again
          if (p.pinchHit && p.pinchHit.forPitcher) gone[p.pinchHit.forPitcher.id] = 1;
          if (p.pitcher && gone[p.pitcher.id]) flag('a pitcher who was pinch-hit for came back to pitch', key);
        }
        outs = p.outsAfter; runsInn += p.runs; last = p;
      });
      if (mound[d]) mound[d].done = true;   // he finished the half
      if (runsInn !== inn.runs) flag('the inning\'s runs are not the sum of its plays\'', 'seed ' + SEED + ' game ' + g + ' inning ' + inn.n + (inn.half ? ' bot' : ' top'));
      var isLast = ii === G.innings.length - 1;
      if (!last) flag('an inning with no plays', 'seed ' + SEED + ' game ' + g + ' inning ' + inn.n);
      else if (last.outsAfter !== 3 && !(isLast && G.over)) flag('the inning ended short of three outs', 'seed ' + SEED + ' game ' + g + ' inning ' + inn.n + (inn.half ? ' bot' : ' top'), String(last.outsAfter));
    });
    if (G.score[0] !== score[0] || G.score[1] !== score[1]) flag('the final score is not the sum of the runs', 'seed ' + SEED + ' game ' + g);
    if (!G.over) flag('a game that did not finish', 'seed ' + SEED + ' game ' + g, G.finalInning + ' innings, ' + G.score.join('-'));
  }
  print('invariants_check v0.5 · ' + nGames + ' games · seed ' + SEED + ' · ' + nPlays + ' plate appearances · ' + nPitches + ' pitches');
  var kinds = Object.keys(V).sort(function (a, b) { return V[b] - V[a]; });
  if (!kinds.length) print('  no violations');
  kinds.forEach(function (k) { print('  ' + V[k] + '  ' + k); EX[k].forEach(function (e) { print('       e.g. ' + e); }); });
  print(kinds.length ? 'FAIL: ' + kinds.reduce(function (a, k) { return a + V[k]; }, 0) + ' violations of ' + kinds.length + ' kinds' : 'PASS');
})(typeof arguments !== 'undefined' ? arguments : []);
