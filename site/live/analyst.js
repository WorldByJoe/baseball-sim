/* ============================================================================
   analyst.js · v0.1 · 2026-10-06

   The couch analyst in the browser: a Web Worker that follows one game on
   MLB's live feed (statsapi.mlb.com, open to any page) and runs the model on
   it, in the viewer's own browser. It is review/live/poll.py, the feed parser
   review/game_feed.py, and the per-plate-appearance analysis of
   review/game_review.js and the pregame replays of review/pregame.js,
   in one script, with the playoff players bundled in data/playoff.js.

   Messages in:  { cmd: 'start', pk, replay (a feed file, optional), dt }
   Messages out: { type: 'state', state }, { type: 'status', text }

   CHANGED
     v0.1  first build (Brewers-Padres, NLDS Game 3, 2026-10-06)
============================================================================ */
var V = '?v=3.9';   // bump with each engine or bundle, as index.html's worker tag (GitHub Pages caches 10 min)
importScripts('engine/bb_engine.js' + V, 'engine/bb_names.js' + V, 'engine/bb_field.js' + V, 'engine/bb_game.js' + V, 'engine/players.js' + V, 'data/playoff.js' + V);
REVIEW.setData(PLAYOFF.recs, PLAYOFF.fits, PLAYOFF.pfit);

var U = BB.units, MPH = U.MPH, FT = U.FT, DEG = U.DEG;
var D = REVIEW.load(), REC = D.recs;
var WOBA = { BB: 0.69, HBP: 0.72, '1B': 0.88, '2B': 1.25, '3B': 1.58, HR: 2.03, E: 0.88, OUT: 0, K: 0, CI: 0.72 };
var MAP = { CS: 'CU', KC: 'CU', SV: 'SL', FO: 'FS', SC: 'CH' };
var NAMES = { FF: 'four-seamer', SI: 'sinker', FC: 'cutter', SL: 'slider', ST: 'sweeper', CU: 'curveball', KC: 'knuckle curve', CH: 'changeup', FS: 'splitter', CS: 'slow curve', SV: 'slurve', FO: 'forkball', KN: 'knuckleball', EP: 'eephus' };
var KIND = { FF: 'FB', SI: 'FB', FC: 'FB', SL: 'BR', ST: 'BR', CU: 'BR', KC: 'BR', SV: 'BR', CS: 'BR', CH: 'OS', FS: 'OS', FO: 'OS' };
var KINDWORD = { FB: 'fastballs', BR: 'breaking balls', OS: 'changeups and splitters' };
var M_FULL = 300, M_QUICK = 100, R_PITCH = 120;
function status(t) { postMessage({ type: 'status', text: t }); }
function pct(p) { return p >= 0.01 ? Math.round(100 * p) + '%' : (100 * p).toFixed(1) + '%'; }
function kindOf(t) { return BB.PITCH_TYPES[t] ? BB.PITCH_TYPES[t].kind : null; }
function last(n) { var a = String(n).split(' ').filter(function (w) { return !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w); }); return a[a.length - 1]; }   // the surname, without Jr.

// ---------------------------------------------------------------- the feed
function parseFeed(d) {
  var gd = d.gameData, ld = d.liveData, box = ld.boxscore.teams, out = { teams: {}, lineups: {}, pitchers: {}, pas: [] };
  ['away', 'home'].forEach(function (s) {
    out.teams[s] = { id: gd.teams[s].id, name: gd.teams[s].name, abbrev: gd.teams[s].abbreviation };
    var L = [];
    Object.keys(box[s].players).forEach(function (k) { var p = box[s].players[k]; if (p.battingOrder) L.push({ id: p.person.id, name: p.person.fullName, order: +p.battingOrder, pos: (p.position || {}).abbreviation }); });
    L.sort(function (a, b) { return a.order - b.order; });
    out.lineups[s] = L; out.pitchers[s] = box[s].pitchers || [];
  });
  var prevKey = null, bases = [null, null, null], outs = 0, score = [0, 0];
  (ld.plays.allPlays || []).forEach(function (pl) {
    var ab = pl.about, half = ab.isTopInning ? 'top' : 'bottom', key = ab.inning + half, m = pl.matchup;
    if (key !== prevKey) { bases = [null, null, null]; outs = 0; }
    var pitches = [], b = 0, s = 0, hit = null;
    pl.playEvents.forEach(function (ev) {
      if (ev.hitData && ev.hitData.launchSpeed != null) { var h = ev.hitData, co = h.coordinates || {}; hit = { ev: h.launchSpeed, la: h.launchAngle, dist: h.totalDistance, hcx: co.coordX, hcy: co.coordY }; }
      if (!ev.isPitch) return;
      var pd = ev.pitchData || {}, c = pd.coordinates || {}, br = pd.breaks || {}, det = ev.details || {};
      pitches.push({ code: det.code, type: (det.type || {}).code, mph: pd.startSpeed, rpm: br.spinRate, px: c.pX, pz: c.pZ, balls: b, strikes: s });
      var cnt = ev.count || {}; if (cnt.balls != null) b = cnt.balls; if (cnt.strikes != null) s = cnt.strikes;
    });
    var r = pl.result || {}, done = !!r.eventType;
    var post = [m.postOnFirst ? m.postOnFirst.id : null, m.postOnSecond ? m.postOnSecond.id : null, m.postOnThird ? m.postOnThird.id : null];
    var newScore = [r.awayScore != null ? r.awayScore : score[0], r.homeScore != null ? r.homeScore : score[1]];
    out.pas.push({ i: out.pas.length, inning: ab.inning, half: half, bat: half === 'top' ? 'away' : 'home', outs: outs, bases: bases.slice(), score: score.slice(),
                   batter: m.batter.id, batterName: m.batter.fullName, pitcher: m.pitcher.id, pitcherName: m.pitcher.fullName,
                   batSide: (m.batSide || {}).code, pitchHand: (m.pitchHand || {}).code, event: r.event || null, eventType: done ? r.eventType : null,
                   desc: r.description || '', pitches: pitches, hit: done ? hit : null, scoreAfter: newScore });
    score = newScore; prevKey = key; bases = post; outs = (pl.count || {}).outs != null ? pl.count.outs : outs;
  });
  var ls = ld.linescore || {}, lt = ls.teams || {};
  out.final = { away: (lt.away || {}).runs || 0, home: (lt.home || {}).runs || 0 };
  out.innings = (ls.innings || []).map(function (i) { return [(i.away || {}).runs, (i.home || {}).runs]; });
  out.status = gd.status.abstractGameState; out.detailed = gd.status.detailedState;
  out.venue = gd.venue.name; out.weather = gd.weather; out.probables = gd.probablePitchers || {};
  return out;
}

// ---------------------------------------------------------------- players and park
var envCache = {}, hitterCache = {}, pitcherCache = {}, rng = BB.makeRng(20261006);
function envFor(G) {
  if (envCache[G.venue]) return envCache[G.venue];
  var V = (Array.isArray(PLAYOFF.venues) ? PLAYOFF.venues : Object.keys(PLAYOFF.venues).map(function (k) { return PLAYOFF.venues[k]; })).filter(function (v) { return v.name === G.venue; })[0];
  var dome = V && /dome|retract/i.test(V.roof || ''), temp = dome ? 72 : (G.weather && +G.weather.temp) || 70;
  return (envCache[G.venue] = BB.makeEnv({ tempF: temp, elevFt: V ? V.elevFt : 0, fence: V ? V.fence : undefined }));
}
function posOf(G, id) { var p = null; ['away', 'home'].forEach(function (s) { G.lineups[s].forEach(function (q) { if (q.id === id) p = q.pos; }); }); return p || 'DH'; }
function hitter(G, id, draw) {
  if (!D.fits[id]) return null;
  if (draw == null) { if (!hitterCache[id]) hitterCache[id] = REVIEW.hitter(D.fits[id], rng, null, posOf(G, id)); return hitterCache[id]; }
  return REVIEW.hitter(D.fits[id], rng, draw, posOf(G, id));
}
function pitcher(G, id) { if (!pitcherCache[id]) { if (!REC[id] || !REC[id].summaries.pitching) return null; pitcherCache[id] = REVIEW.pitcher(REC[id], rng, envFor(G)); } return pitcherCache[id]; }
function defence(G, s, P) {
  var F = G.lineups[s].filter(function (p) { return p.order % 100 === 0 && p.pos !== 'DH'; }).map(function (p) { var h = hitter(G, p.id); if (!h) { h = BB.makeBatter(rng, { pos: p.pos }); } h.pos = p.pos; return h; });
  P.pos = 'P';
  return BBField.makeDefense(F.concat([P]));
}
var UMP = { id: 0, name: 'a league umpire', sd: BB.TRAITS.umpSD[0], edge: { inside: 0, outside: 0, high: 0, low: 0 }, quirk: null, countK: BB.TRAITS.umpCount[0] };
function pitchFor(P, code) {
  var t = MAP[code] || code, q = P.pitches.filter(function (x) { return x.type === t; })[0];
  if (!q && kindOf(t)) q = P.pitches.filter(function (x) { return kindOf(x.type) === kindOf(t); }).sort(function (a, b) { return b.usage - a.usage; })[0];
  return q || null;
}
function realPitch(P, q, f, env) {
  var rel = BB.releasePoint(P), velo = (f.mph || q.velo) * MPH, rpm = f.rpm || q.rpm, target = [f.px * FT, f.pz * FT];
  var a = BB.aim(rel, velo, rpm, q.tilt, q.eff, P.armSide, target, env, null, q.seam);
  var d = BB.dirOf(a.yaw, a.pit), v0 = [d[0] * velo, d[1] * velo, d[2] * velo], w0 = BB.spinVector(d, rpm, q.tilt, q.eff, P.armSide);
  var fl = BB.flyPitch(rel, v0, w0, env, false, q.seam, P.armSide);
  return { type: q.type, rel: rel, v0: v0, w0: w0, seam: q.seam, armSide: P.armSide, mph: velo / MPH, rpm: rpm, tilt: q.tilt, eff: q.eff, fatigue: BB.fatigueOf(P), cmdIn: P.cmd, deception: P.deception, plate: { x: fl.x, z: fl.z, t: fl.t, v: fl.v, w: fl.w } };
}
function resultOf(code) {
  if (/^(B|\*B|P|V|I)$/.test(code)) return 'ball';
  if (code === 'C') return 'called';
  if (/^(S|W|M|Q)$/.test(code)) return 'whiff';
  if (/^(F|L|R|O|T)$/.test(code)) return 'foul';
  if (/^(X|D|E)$/.test(code)) return 'inplay';
  if (code === 'H') return 'hbp';
  return null;
}
function categoryOf(et) {
  if (!et) return null;
  if (/^strikeout/.test(et)) return 'K';
  if (et === 'walk' || et === 'intent_walk') return 'BB';
  if (et === 'hit_by_pitch') return 'HBP';
  return { single: '1B', double: '2B', triple: '3B', home_run: 'HR', field_error: 'E', catcher_interf: 'CI' }[et] || 'OUT';
}

// ---------------------------------------------------------------- one plate appearance through the model
function analyse(G, i, M, withPitches) {
  var pa = G.pas[i], env = envFor(G), P0 = pitcher(G, pa.pitcher), Bm = hitter(G, pa.batter);
  var actual = categoryOf(pa.eventType), out = { i: i, actual: actual, probs: null, pActual: null, xwoba: null, woba: WOBA[actual] != null ? WOBA[actual] : null, pitches: [] };
  if (!P0 || !Bm) return out;
  var ld0 = 0, so = 0, st0 = 0;
  for (var k = 0; k < i; k++) { var q = G.pas[k]; if (q.pitcher === pa.pitcher) { ld0 += q.pitches.length; if (q.bat === pa.bat) st0 += q.pitches.length; if (q.batter === pa.batter) so += q.pitches.length; } }
  var sb = BB.batterSide(Bm, P0), seen = so + 0.25 * (st0 - so), lead = pa.bat === 'away' ? pa.score[1] - pa.score[0] : pa.score[0] - pa.score[1];
  var Dd = defence(G, pa.bat === 'away' ? 'home' : 'away', P0), basesObj = [null].concat(pa.bases.map(function (id) { return id ? hitter(G, id) || BB.makeBatter(rng, {}) : null; }));
  var sit = { bases: basesObj, outs: pa.outs, inning: pa.inning, lead: lead };
  var cats = { K: 0, BB: 0, HBP: 0, '1B': 0, '2B': 0, '3B': 0, HR: 0, OUT: 0, E: 0 }, wsum = 0;
  for (k = 0; k < M; k++) {
    var Bk = hitter(G, pa.batter, k); P0.load = ld0;
    var res = BB.simPA(P0, Bk, { env: env, ump: UMP, framing: 0, seen: seen, rec: false, runnersOn: !!(pa.bases[0] || pa.bases[1] || pa.bases[2]) }, rng), c;
    if (res.result === 'K' || res.result === 'BB' || res.result === 'HBP' || res.result === 'HR') c = res.result;
    else if (res.result === 'END') c = 'OUT';
    else { sit.u = rng.u(); BBField.positionDefense(Dd, Bk, sb, sit); var r = BBField.resolve(res.bb, Bk, basesObj.slice(), pa.outs, Dd, env, rng, { side: sb, foulCaught: !!res.foulCaught }); c = r.hit === 'OUT' || r.hit === 'SF' || r.hit === 'FC' ? 'OUT' : r.hit; }
    cats[c] = (cats[c] || 0) + 1; wsum += WOBA[c];
  }
  for (var c2 in cats) cats[c2] /= M;
  out.probs = cats; out.xwoba = wsum / M; out.pActual = cats[actual] != null ? cats[actual] : null;
  if (!withPitches) return out;
  P0.load = ld0;
  var lastT = [];
  pa.pitches.forEach(function (f, j) {
    var rcode = resultOf(f.code), q = f.px == null ? null : pitchFor(P0, f.type), rec = { type: f.type, mph: f.mph, count: f.balls + '-' + f.strikes, result: rcode };
    if (q && rcode && rcode !== 'hbp') {
      var pitch = realPitch(P0, q, f, env), stc = { balls: f.balls, strikes: f.strikes, last: lastT.slice() };
      var seenNow = so + j + 0.25 * (st0 - so), fam = Bm.learn * (1 - Math.exp(-seenNow / 40));
      var nS = 0, nW = 0, nF = 0, nI = 0, nT = 0, nCS = 0, nFool = 0;
      for (var t = 0; t < R_PITCH; t++) {
        var ex = BB.expectPitch(Bm, P0, sb, stc), gh = BB.ghostPitch(pitch, ex, P0, env, false, fam), ref = BB.typicalPitch(pitch, P0, fam, env);
        var rf = BB.readFactors(Bm, pitch, gh, ref, seenNow, P0.pitches[ex.guess].type === pitch.type, rng, kindOf(ex.guessType) === 'FB' && kindOf(pitch.type) === 'FB');
        if (!rf.detected && !rf.late) nFool++;
        var dec = BB.decide(Bm, pitch, gh, rf, stc, rng), chk = 0;
        if (dec.swing && rng.u() < BB.checkChance(Bm, rf, pitch)) { if (rng.u() < BB.CHECK.hold) dec.swing = false; else chk = BB.CHECK.slow[0] + (BB.CHECK.slow[1] - BB.CHECK.slow[0]) * rng.u(); }
        if (!dec.swing) { nT++; if (BB.callPitch(UMP, 0, Bm, sb, pitch.plate.x, pitch.plate.z, f.balls, f.strikes, rng).strike) nCS++; continue; }
        nS++;
        var sw = BB.swing(Bm, pitch, gh, rf, sb, stc, rng, chk), col = sw.contact ? BB.collide(pitch, sw) : null;
        if (!col) { nW++; continue; }
        var bbx = BB.battedBall(pitch, col, env, false); if (bbx.hr || bbx.fair) nI++; else nF++;
      }
      rec.pSwing = nS / R_PITCH; rec.pWhiff = nS ? nW / nS : null; rec.pCalled = nT ? nCS / nT : null; rec.pFooled = nFool / R_PITCH;
      var pr = { ball: nT ? (nT - nCS) / R_PITCH : 0, called: nCS / R_PITCH, whiff: nW / R_PITCH, foul: nF / R_PITCH, inplay: nI / R_PITCH };
      rec.pResult = pr[rcode] || 0;
    }
    out.pitches.push(rec);
    if (q) { lastT.unshift(q.type); if (lastT.length > 2) lastT.length = 2; }
  });
  return out;
}

// ---------------------------------------------------------------- the league's balls like this one
var LX = PLAYOFF.league.X, LC = PLAYOFF.league.C, LN = LC.length, CODE = { O: 'OUT', '1': '1B', '2': '2B', '3': '3B', H: 'HR', E: 'E' };
function leagueHit(pa) {
  var h = pa.hit; if (!h || h.ev == null || h.la == null || h.hcx == null) return null;
  var spray = Math.atan2(h.hcx - 126.0, 205.0 - h.hcy) / DEG, pull = pa.batSide === 'R' ? -spray : spray, best = [];
  for (var k = 0; k < LN; k++) {
    var a = (LX[3 * k] - h.ev) / 2.5, b = (LX[3 * k + 1] - h.la) / 2.5, c = (LX[3 * k + 2] - pull) / 4, d = a * a + b * b + c * c;
    if (best.length < 40) { best.push([d, k]); if (best.length === 40) best.sort(function (x, y) { return y[0] - x[0]; }); }
    else if (d < best[0][0]) { best[0] = [d, k]; best.sort(function (x, y) { return y[0] - x[0]; }); }
  }
  var cats = { OUT: 0, '1B': 0, '2B': 0, '3B': 0, HR: 0, E: 0 };
  best.forEach(function (e) { cats[CODE[LC[e[1]]]] += 1 / best.length; });
  return { pHit: cats['1B'] + cats['2B'] + cats['3B'] + cats.HR, cats: cats };
}

// ---------------------------------------------------------------- words
function mix(pid, side) {
  var S = ((REC[pid] || {}).summaries || {}).pitching || {}, tot = {}, sum = 0;
  Object.keys(S.pitchTypes || {}).forEach(function (t) {
    var n = 0, u = S.pitchTypes[t].usageByCountSide || {};
    Object.keys(u).forEach(function (key) { if (key.split('|')[1] === side && u[key] && u[key].pooled) n += u[key].pooled.mean * (u[key].pooled.n || 0); });
    tot[t] = n; sum += n;
  });
  return Object.keys(tot).map(function (t) { return [t, sum ? tot[t] / sum : 0]; }).filter(function (x) { return x[1] >= 0.05; }).sort(function (a, b) { return b[1] - a[1]; });
}
function watch(G, pa, a) {
  var lines = [], bat = REC[pa.batter] || {}, pit = REC[pa.pitcher] || {}, side = pa.batSide === pa.pitchHand ? 'same' : 'opp', k = 1;
  for (var j = 0; j < pa.i; j++) if (G.pas[j].batter === pa.batter && G.pas[j].pitcher === pa.pitcher) k++;
  lines.push(pa.batterName + ' (bats ' + pa.batSide + ') against ' + pa.pitcherName + ' (throws ' + pa.pitchHand + '): ' + (side === 'same' ? 'a same-side' : 'an opposite-side') + ' matchup' +
             (k > 1 ? ', the ' + (['', '', 'second', 'third', 'fourth', 'fifth'][k] || k + 'th') + ' time he has faced him tonight' : '') + '.');
  var m = mix(pa.pitcher, side);
  if (m.length) {
    lines.push(last(pa.pitcherName) + ' to ' + (pa.batSide === 'R' ? 'right' : 'left') + '-handed hitters: ' + m.slice(0, 3).map(function (x) { return (NAMES[x[0]] || x[0]) + ' ' + pct(x[1]); }).join(', ') + '.');
    var kinds = m.slice(0, 3).map(function (x) { return KIND[x[0]]; }).filter(function (k2) { return k2 && k2 !== 'FB'; });
    var H = ((bat.summaries || {}).hitting) || {};
    if (kinds.length && H.whiffPerSwing && H.whiffPerSwing[kinds[0]] && H.whiffPerSwing[kinds[0]].pooled)
      lines.push(last(pa.batterName) + ' misses on ' + pct(H.whiffPerSwing[kinds[0]].pooled.mean) + ' of his swings at ' + KINDWORD[kinds[0]] + ' and chases ' + pct(((H.chaseRate || {}).pooled || {}).mean || 0) + ' of pitches off the plate.');
  }
  if (a && a.probs) { var p = a.probs; lines.push('Model: strikeout ' + pct(p.K) + ', walk ' + pct(p.BB + p.HBP) + ', hit ' + pct(p['1B'] + p['2B'] + p['3B'] + p.HR) + ', home run ' + pct(p.HR) + '.'); }
  var S = (pit.summaries || {}).pitching || {}, fb = Object.keys(S.pitchTypes || {}).filter(function (t) { return KIND[t] === 'FB'; }).sort(function (x, y) { return ((S.pitchTypes[y].usage || {}).pooled || {}).mean - ((S.pitchTypes[x].usage || {}).pooled || {}).mean; })[0];
  if (fb) {
    var sv = ((S.pitchTypes[fb].velo || {})['2026'] || {}).mean, mph = [];
    G.pas.slice(0, pa.i + 1).forEach(function (q2) { if (q2.pitcher === pa.pitcher) q2.pitches.forEach(function (q) { if (q.type === fb && q.mph) mph.push(q.mph); }); });
    if (sv && mph.length >= 8) { var avg = mph.reduce(function (x, y) { return x + y; }, 0) / mph.length, d = avg - sv; lines.push(last(pa.pitcherName) + '’s ' + (NAMES[fb] || fb) + ': ' + avg.toFixed(1) + ' mph tonight, ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' against his season.'); }
  }
  return lines;
}
function pitchText(q) {
  var s = q.count + ' ' + (NAMES[q.type] || q.type || 'pitch') + ', ' + Math.round(q.mph || 0) + ' mph';
  if (q.pSwing == null) return [s, false];
  var r = q.result, flag = q.pResult != null && q.pResult < 0.15;
  if (r === 'ball' || r === 'called') { s += ': taken, ' + (r === 'called' ? 'a strike' : 'a ball') + '. The model had him swinging ' + pct(q.pSwing); if (q.pCalled != null) s += ', and that pitch called a strike ' + pct(q.pCalled) + ' of the time'; }
  else { s += ': swung at (' + pct(q.pSwing) + ' likely)'; if (r === 'whiff' && q.pWhiff != null) s += ', missed. ' + pct(q.pWhiff) + ' of his swings at it miss'; else if (r === 'foul') s += ', fouled off'; else if (r === 'inplay') s += ', in play'; }
  if (q.pFooled >= 0.3) s += '. It fools him ' + pct(q.pFooled) + ' of the time';
  return [s + '.', flag];
}
function paText(pa, a, lg) {
  var p = a ? a.pActual : null, s = (pa.half === 'top' ? 'T' : 'B') + pa.inning + ' ' + pa.batterName + ': ' + (pa.event || '') + '.', flag = p != null && p < 0.10;
  if (p != null) s += ' The model gave that ' + pct(p) + '.';
  if (lg) {
    var hit = /^(single|double|triple|home_run)$/.test(pa.eventType);
    s += ' ' + Math.round(pa.hit.ev) + ' mph at ' + pa.hit.la + '°: balls like it fall for hits ' + pct(lg.pHit) + ' of the time.';
    if (hit && lg.pHit < 0.3) { s += ' A lucky one.'; flag = true; } else if (!hit && pa.eventType !== 'field_error' && lg.pHit > 0.6) { s += ' An unlucky out.'; flag = true; }
  }
  return [s, flag];
}

// ---------------------------------------------------------------- the pregame replays
function pregame(G) {
  var pp = G.probables, asp = (pp.away || {}).id || G.pitchers.away[0], hsp = (pp.home || {}).id || G.pitchers.home[0];
  if (!asp || !hsp || !REC[asp] || !REC[hsp]) return null;
  var env = envFor(G), built = {};
  function P(id, rel) { if (!built[id]) { built[id] = REVIEW.pitcher(REC[id], rng, env); built[id].bat = BB.makeBatter(rng, { pitcher: true, pos: 'P' }); } var p = built[id]; if (rel && p.role === 'SP') { p.role = 'RP'; p.stamina = 35; } return p; }
  function fresh(p) { p.load = 0; p.used = false; p.pitchesToday = 0; p.warm = 0; return p; }
  function team(s, draw, sp) {
    var T = G.teams[s], starters = G.lineups[s].filter(function (p) { return p.order % 100 === 0; }), ids = {};
    var lineup = starters.map(function (p) { ids[p.id] = 1; var h = D.fits[p.id] ? REVIEW.hitter(D.fits[p.id], rng, draw, p.pos) : BB.makeBatter(rng, { pos: p.pos }); h.pos = p.pos; h.homePos = p.pos; return h; });
    var bench = Object.keys(REC).map(function (k) { return REC[k]; }).filter(function (r) { return r.team === T.abbrev && r.kind !== 'pitcher' && !ids[r.id] && D.fits[r.id]; }).map(function (r) { var h = REVIEW.hitter(D.fits[r.id], rng, draw, r.position); h.benchPos = r.position; h.pos = r.position; return h; });
    var pen = Object.keys(REC).map(function (k) { return REC[k]; }).filter(function (r) { return r.team === T.abbrev && r.kind !== 'position' && r.id !== sp && r.summaries.pitching && ((r.summaries.pitching.role || {}).role === 'RP'); }).map(function (r) { return fresh(P(r.id, true)); });
    var closer = pen.slice().sort(function (a, b) { return ((REC[b.mlbId].seasonStats.pitching_2026 || {}).SV || 0) - ((REC[a.mlbId].seasonStats.pitching_2026 || {}).SV || 0); })[0];
    return { city: T.name, nick: '', name: T.name, lineup: lineup, bench: bench, starter: fresh(P(sp, false)), bullpen: pen, closer: closer, manager: { hook: 0.42, warmAt: 0.2, ibb: 0.075, glove: 0.012 } };
  }
  var N = 200, aw = 0, ar = 0, hr = 0;
  for (var g = 0; g < N; g++) {
    if (g % 50 === 0) status('Playing tonight’s game before the first pitch: ' + g + ' of ' + N);
    var GM = BBGame.simGame(team('away', g % 24, asp), team('home', (g * 7 + 3) % 24, hsp), { rng: rng, env: env, rules: 'AL', ghost: false });
    if (GM.score[0] > GM.score[1]) aw++; ar += GM.score[0]; hr += GM.score[1];
  }
  return { n: N, awayWin: aw / N, awayRuns: ar / N, homeRuns: hr / N, awaySP: REC[asp].name, homeSP: REC[hsp].name };
}

// ---------------------------------------------------------------- following the game
var A = { cache: {}, done: {}, events: [], pre: null, wp: [], pk: null, live: true };
function step(feed) {
  var G = parseFeed(feed), now = Date.now() / 1000, pas = G.pas;
  var todo = pas.filter(function (pa) { var s = A.done[pa.i]; return !s || s[0] !== pa.pitches.length || s[1] !== !!pa.eventType; });
  var backlog = todo.length > 3;
  todo.forEach(function (pa, n) {
    var i = pa.i, complete = !!pa.eventType, prev = A.cache[i], quick = backlog && n < todo.length - 2;
    if (quick) status('Catching up: plate appearance ' + (i + 1) + ' of ' + pas.length);
    var a;
    if (!prev) a = analyse(G, i, quick ? M_QUICK : M_FULL, !quick);
    else { a = analyse(G, i, 0, true); a.probs = prev.probs; a.xwoba = prev.xwoba; a.pActual = a.probs && a.actual ? (a.probs[a.actual] != null ? a.probs[a.actual] : null) : null; }
    a.watch = (prev && prev.watch) || watch(G, pa, a);
    A.cache[i] = a;
    if (!prev && !quick) A.events.push({ t: now, kind: 'up', text: 'Now batting: ' + a.watch[0], flag: false });
    if (!quick) (a.pitches || []).slice(prev ? (prev.pitches || []).length : 0).forEach(function (q) { var x = pitchText(q); A.events.push({ t: now, kind: 'pitch', text: x[0], flag: x[1] }); });
    if (complete) {
      a.league = leagueHit(pa);
      var y = paText(pa, a, a.league); A.events.push({ t: now, kind: 'pa', text: y[0], flag: y[1] });
      if (A.live) fetch('https://statsapi.mlb.com/api/v1/game/' + A.pk + '/winProbability').then(function (r) { return r.json(); }).then(function (w) { A.wp = w.map(function (x) { return [x.atBatIndex, x.homeTeamWinProbability]; }); }).catch(function () {});
    }
    A.done[i] = [pa.pitches.length, complete];
  });
  status('');
  postMessage({ type: 'state', state: stateOf(G, now) });
  if (!A.pre && G.lineups.away.length && G.lineups.home.length) {   // the pregame replays, after the plays are caught up
    A.pre = pregame(G) || { failed: true }; status('');
    postMessage({ type: 'state', state: stateOf(G, now) });
  }
}
function stateOf(G, now) {
  var pas = G.pas, cur = pas[pas.length - 1], led = {};
  ['away', 'home'].forEach(function (side) {
    var T = pas.filter(function (pa) { return pa.bat === side && pa.eventType && A.cache[pa.i] && A.cache[pa.i].probs; }).map(function (pa) { return [pa, A.cache[pa.i]]; });
    var lg = T.filter(function (x) { return x[1].league; });
    var sum = function (arr, f) { return arr.reduce(function (s, x) { return s + f(x); }, 0); };
    led[side] = { K: [+sum(T, function (x) { return x[1].probs.K; }).toFixed(1), T.filter(function (x) { return x[1].actual === 'K'; }).length],
                  BB: [+sum(T, function (x) { return x[1].probs.BB + x[1].probs.HBP; }).toFixed(1), T.filter(function (x) { return x[1].actual === 'BB' || x[1].actual === 'HBP'; }).length],
                  hits: [+sum(lg, function (x) { return x[1].league.pHit; }).toFixed(1), lg.filter(function (x) { return /^(single|double|triple|home_run)$/.test(x[0].eventType); }).length],
                  xwoba: T.length ? sum(T, function (x) { return x[1].xwoba; }) / T.length : null, woba: T.length ? sum(T, function (x) { return x[1].woba || 0; }) / T.length : null };
  });
  var now_pa = null;
  if (cur) {
    var a = A.cache[cur.i] || {};
    now_pa = { batter: cur.batterName, pitcher: cur.pitcherName, inning: cur.inning, half: cur.half, outs: cur.outs, bases: cur.bases.map(function (x) { return !!x; }), score: cur.score,
               complete: !!cur.eventType, watch: a.watch || [], probs: a.probs || null, pitches: (a.pitches || []).map(function (q) { var x = pitchText(q); return { text: x[0], flag: x[1] }; }) };
  }
  var score = cur ? (cur.eventType ? cur.scoreAfter : cur.score) : [G.final.away, G.final.home];
  return { updated: now, pk: A.pk, teams: G.teams, status: G.status, detailed: G.detailed, final: G.final, score: score, now: now_pa, ledger: led, pregame: A.pre && !A.pre.failed ? A.pre : null, wp: A.wp, events: A.events.slice(-60) };
}

// ---------------------------------------------------------------- the loop: live, or a finished game replayed
function replayFeeds(full) {
  var plays = full.liveData.plays.allPlays, out = [];
  plays.forEach(function (pl, k) {
    var idx = []; pl.playEvents.forEach(function (ev, j) { if (ev.isPitch) idx.push(j); });
    for (var m = 1; m <= idx.length; m++) out.push([k, m, idx]);
  });
  return function (n) {
    var e = out[n]; if (!e) return null;
    var k = e[0], m = e[1], idx = e[2], pl = plays[k], cut = JSON.parse(JSON.stringify(pl)), f = JSON.parse(JSON.stringify(full));
    if (m < idx.length) { cut.playEvents = pl.playEvents.slice(0, idx[m - 1] + 1).map(function (ev) { var x = JSON.parse(JSON.stringify(ev)); delete x.hitData; return x; }); cut.result = { type: 'atBat' }; }
    f.liveData.plays.allPlays = plays.slice(0, k).concat([cut]);
    if (n < out.length - 1) { f.gameData.status.abstractGameState = 'Live'; f.gameData.status.detailedState = 'In Progress'; }
    return f;
  };
}
onmessage = function (e) {
  var m = e.data;
  if (m.cmd !== 'start') return;
  A.pk = m.pk;
  if (m.replay) {
    A.live = false;
    status('Loading the replay');
    Promise.all([fetch(m.replay).then(function (r) { return r.json(); }), m.replayWp ? fetch(m.replayWp).then(function (r) { return r.json(); }) : Promise.resolve([])]).then(function (x) {
      var next = replayFeeds(x[0]), wp = x[1], n = 0;
      (function tick() {
        var f = next(n++); if (!f) return;
        var np = f.liveData.plays.allPlays.length;
        A.wp = wp.filter(function (w) { return w.atBatIndex < np - 1; }).map(function (w) { return [w.atBatIndex, w.homeTeamWinProbability]; });
        try { step(f); } catch (err) { status('Replay step failed: ' + err.message); }
        setTimeout(tick, m.dt || 1500);
      })();
    });
    return;
  }
  var url = 'https://statsapi.mlb.com/api/v1.1/game/' + m.pk + '/feed/live';
  (function loop() {
    fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (f) {
      var st = f.gameData.status.abstractGameState;
      try { step(f); } catch (err) { status('Could not read that update: ' + err.message); }
      if (st !== 'Final') setTimeout(loop, st === 'Preview' ? 60000 : 10000);
    }).catch(function () { status('The feed did not answer; trying again'); setTimeout(loop, 15000); });
  })();
};
