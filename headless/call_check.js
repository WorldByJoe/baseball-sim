/* ============================================================================
   call_check.js · v0.1 · 2026-10-02

   Runs the broadcast writer (bb_call.js) over whole games headless and
   prints the broadcast against the schedule: each voice line with its
   event, start, estimated length and the air it had (maxDur); the sound
   and organ cues; every line dropped. Then, over all the games: the share
   of at-bats with colour, the share of lines dropped or shortened, speech
   per minute, and the most crowded stretch (the minute with the most
   speech). It also checks what can be checked mechanically: no two voice
   lines overlap, none outruns its air, every cue names a real event, and
   the writer is deterministic (written twice, the same).

   Usage:
     node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js bb_schedule.js bb_call.js headless/call_check.js -- SEEDS [PRINT] [JSON]
       SEEDS  comma list of seeds (default 7,48,59)
       PRINT  what to print in full: 'none', 'all', or a half such as '3b' (default none)
       JSON   'json' prints the first game's voice lines as JSON (for the speech server's --dry-run)
     jsc ... the same files ... headless/call_check.js -- 7,48,59 3b

   CHANGED
     v0.1  first build
============================================================================ */
(function (argv) {
  var seeds = (argv[0] || '7,48,59').split(',').map(Number), show = argv[1] || 'none', asJson = argv[2] === 'json';
  var tot = { pas: 0, col: 0, lines: 0, dropped: 0, cands: 0, shortened: 0, speech: 0, min: 0, bad: 0 }, worst = { n: 0 };
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  function mmss(t) { var m = Math.floor(t / 60), s = t - 60 * m; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  seeds.forEach(function (seed, gi) {
    var g = BBSchedule.game(seed), S = BBSchedule.build(g.G, g.PLAYER), C = BBCall.write(g, S);
    var g2 = BBSchedule.game(seed), C2 = BBCall.write(g2, BBSchedule.build(g2.G, g2.PLAYER));   // written again from scratch: the same?
    var ids = {}; S.SEG.forEach(function (s) { ids[s.id] = s; });
    var bad = [];
    if (JSON.stringify(C.lines) !== JSON.stringify(C2.lines) || JSON.stringify(C.sfx) !== JSON.stringify(C2.sfx)) bad.push('not deterministic');
    C.lines.forEach(function (l, j) {
      var nx = C.lines[j + 1];
      if (!ids[l.event]) bad.push('unknown event ' + l.event);
      if (nx && l.t + l.est > nx.t + 1e-6) bad.push('overlap at ' + l.id);
      if (l.est > l.maxDur + 1e-6) bad.push('too long ' + l.id);
    });
    C.sfx.concat(C.organ).forEach(function (q) { if (!ids[q.event]) bad.push('unknown event ' + q.event); });
    var st = C.stats, mins = S.total / 60;
    // the most crowded minute: speech seconds in any 60 s window starting at a line
    C.lines.forEach(function (l, j) { var sum = 0; for (var k = j; k < C.lines.length && C.lines[k].t < l.t + 60; k++) sum += Math.min(C.lines[k].est, l.t + 60 - C.lines[k].t); if (sum > worst.n) worst = { n: sum, seed: seed, t: l.t, event: l.event }; });
    print('seed ' + seed + ': ' + g.G.teams[0].name + ' ' + g.G.score[0] + ', ' + g.G.teams[1].name + ' ' + g.G.score[1] + ' | ' + mmss(S.total) + ' | ' + st.lines + ' lines (' + st.words + ' words, ' + (st.speech / 60).toFixed(1) + ' min of speech, ' +
          (st.speech / S.total * 100).toFixed(0) + '% of the game) | dropped ' + st.dropped + ' of ' + st.candidates + ' candidates, shortened ' + st.shortened + ' | at-bats with colour ' + st.pasWithColour + ' of ' + st.pas +
          ' | ' + C.sfx.length + ' sounds, ' + C.organ.length + ' organ cues' + (bad.length ? ' | PROBLEMS: ' + bad.slice(0, 5).join('; ') : ''));
    tot.pas += st.pas; tot.col += st.pasWithColour; tot.lines += st.lines; tot.dropped += st.dropped; tot.cands += st.candidates; tot.shortened += st.shortened; tot.speech += st.speech; tot.min += mins; tot.bad += bad.length;
    if (asJson && gi === 0) print(JSON.stringify({ seed: seed, version: C.version, lines: C.lines.map(function (l) { return { id: l.id, t: l.t, role: l.role, text: l.text, pace: l.pace, energy: l.energy, maxDur: l.maxDur }; }) }));
    if (show === 'none') return;
    // the broadcast against the schedule
    var ev = [];
    C.lines.forEach(function (l) { ev.push({ t: l.t, s: pad(l.role.toUpperCase(), 7) + pad(l.energy, 9) + pad(l.est.toFixed(1) + '/' + l.maxDur.toFixed(1) + 's', 11) + '"' + l.text + '"', e: l.event }); });
    C.sfx.forEach(function (q) { ev.push({ t: q.t, s: '  sfx  ' + q.sound + ' ' + q.gain + (q.dur ? ' for ' + q.dur + 's' : ''), e: q.event }); });
    C.organ.forEach(function (q) { ev.push({ t: q.t, s: '  organ ' + q.cue, e: q.event }); });
    C.dropped.forEach(function (d) { var sg = null; S.SEG.forEach(function (s) { if (s.id === d.event) sg = s; }); ev.push({ t: sg ? sg.t0 : 0, s: '  DROPPED ' + d.role + ' p' + d.prio + ' ' + d.est + 's: "' + d.text + '"', e: d.event }); });
    var crowd = {}; C.crowd.forEach(function (c) { crowd[c.event] = c; });
    S.SEG.forEach(function (sg) { var cw = crowd[sg.id]; ev.push({ t: sg.t0 - 1e-3, seg: true, s: '-- ' + pad(sg.id, 16) + pad(sg.kind, 10) + pad(sg.dur.toFixed(1) + 's', 7) + (cw ? 'crowd ' + cw.bed.replace('bed_', '') + ' a=' + cw.arousal + (cw.valence ? ' v=' + cw.valence : '') : ''), e: sg.id }); });
    ev.sort(function (a, b) { return a.t - b.t; });
    ev.forEach(function (x) {
      if (show !== 'all' && x.e.split('.')[0] !== show) return;
      print(pad(mmss(Math.max(0, x.t)), 8) + (x.seg ? x.s : '   ' + pad(x.e.split('.').slice(1).join('.') || x.e, 14) + x.s));
    });
  });
  print('');
  print('over ' + seeds.length + ' games: at-bats with colour ' + (100 * tot.col / tot.pas).toFixed(0) + '% | lines dropped ' + (100 * tot.dropped / tot.cands).toFixed(0) + '% of candidates, shortened ' + (100 * tot.shortened / tot.cands).toFixed(0) + '% | speech ' +
        (tot.speech / tot.min).toFixed(0) + ' s a minute | most crowded minute: ' + worst.n.toFixed(0) + ' s of speech from ' + worst.event + ' (seed ' + worst.seed + ', ' + mmss(worst.t) + ') | ' + (tot.bad ? tot.bad + ' PROBLEMS' : 'no problems'));
})(typeof arguments !== 'undefined' ? Array.prototype.slice.call(arguments) : []);
