/* ============================================================================
   game_review.js · v0.1 · 2026-10-06

   One postseason game, plate appearance by plate appearance, through the
   model with each player's own traits (review/players.js). For each plate
   appearance:

   - THE EXPECTATION: the plate appearance played from 0-0 many times between
     this batter and this pitcher, in this park, at the pitcher's pitch count
     and with what the batter had seen of him; each play's batted ball run
     through the field layer with the real fielders, bases and outs. Each
     replay takes one draw of the batter's hidden traits, so the spread holds
     the uncertainty in who he is as well as the dice. Out of it: the chance of
     each outcome, the expected wOBA, and how likely what happened was.
   - EACH PITCH as it was really thrown (its type, speed, spin and plate
     location, aimed exactly there in the model): what the model expected the
     batter to do in that count (swing; miss, foul or put it in play if he
     swung; a called strike if he took it), and how often he would have been
     fooled by it.
   - THE BATTED BALL as it really left the bat (exit speed, launch angle,
     direction; backspin solved so the model's flight carries as far as
     Statcast measured, or the engine's typical spin for its angle on the
     ground), run through the field layer many times: the chance it was an
     out or each kind of hit, and its expected wOBA.

   One JSON line a plate appearance.

   Run:  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/game_review.js -- PK [replays] [seed] [part] [parts]

   CHANGED
     v0.1  first build (the Yankees-Rays review, 2026-10-06)
============================================================================ */
(function (A) {
  var PK = A[0], M = +A[1] || 800, SEED = +A[2] || 1, PART = +A[3] || 0, PARTS = +A[4] || 1;
  var U = BB.units, MPH = U.MPH, FT = U.FT, IN = U.IN, RPM = U.RPM, DEG = U.DEG;
  var G = JSON.parse(read('review/games/' + PK + '.json')), D = REVIEW.load(), rng = BB.makeRng(SEED * 101 + PART);
  var venues = JSON.parse(read('playoffs/venues.json')); venues = venues.venues || venues;
  var V = (Array.isArray(venues) ? venues : Object.keys(venues).map(function (k) { return venues[k]; })).filter(function (v) { return v.name === G.venue; })[0];
  var dome = V && /dome|retract/i.test(V.roof || ''), temp = dome ? 72 : (G.weather && +G.weather.temp) || 70;
  var env = BB.makeEnv({ tempF: temp, elevFt: V ? V.elevFt : 0, fence: V ? V.fence : undefined });
  var ump = { id: 0, name: 'a league umpire', sd: BB.TRAITS.umpSD[0], edge: { inside: 0, outside: 0, high: 0, low: 0 }, quirk: null, countK: BB.TRAITS.umpCount[0] };
  var WOBA = { BB: 0.69, HBP: 0.72, '1B': 0.88, '2B': 1.25, '3B': 1.58, HR: 2.03, E: 0.88, OUT: 0, K: 0, CI: 0.72 };
  var MAP = { CS: 'CU', KC: 'CU', SV: 'SL', FO: 'FS', SC: 'CH' };
  function kindOf(t) { return BB.PITCH_TYPES[t] ? BB.PITCH_TYPES[t].kind : null; }

  // ---- players
  var posOf = {}, side = {};
  ['away', 'home'].forEach(function (s) { G.lineups[s].forEach(function (p) { posOf[p.id] = p.pos; side[p.id] = s; }); });
  var hitterMean = {}, pitcherOf = {};
  function hitter(id, draw) {
    if (!D.fits[id]) return null;
    if (draw === null || draw === undefined) { if (!hitterMean[id]) hitterMean[id] = REVIEW.hitter(D.fits[id], rng, null, posOf[id] === 'DH' ? 'DH' : posOf[id]); return hitterMean[id]; }
    return REVIEW.hitter(D.fits[id], rng, draw, posOf[id] === 'DH' ? 'DH' : posOf[id]);
  }
  function pitcher(id) { if (!pitcherOf[id]) pitcherOf[id] = REVIEW.pitcher(D.recs[id], rng, env); return pitcherOf[id]; }
  // the fielding side's defence: its starting nine at their positions (substitutes not followed in v0.1), and the pitcher
  function defence(s, P) {
    var F = G.lineups[s].filter(function (p) { return p.order % 100 === 0 && p.pos !== 'DH'; }).map(function (p) { var h = hitter(p.id); h.pos = p.pos; return h; });
    P.pos = 'P';
    return BBField.makeDefense(F.concat([P]));
  }

  // ---- the engine's typical backspin by launch angle (for a ground ball, whose distance says nothing of its spin)
  var SPIN = {};
  (function () {
    var r2 = BB.makeRng(4242), e2 = BB.mlbEnv(r2), ps = [], bs = [], u2 = BB.makeUmp(r2), acc = {};
    for (var i = 0; i < 40; i++) { ps.push(BB.makePitcher(r2, { role: 'SP' })); bs.push(BB.makeBatter(r2, {})); }
    for (var k = 0; k < 5000; k++) {
      var res = BB.simPA(ps[k % 40], bs[(k * 7) % 40], { env: e2, ump: u2, framing: 0, seen: 10, rec: false }, r2);
      res.pitches.forEach(function (q) { if (q.bb) { var b = Math.round(q.bb.la / 5) * 5; (acc[b] = acc[b] || []).push(q.bb.backspin); } });
    }
    Object.keys(acc).forEach(function (b) { var a = acc[b].sort(function (x, y) { return x - y; }); SPIN[b] = a[Math.floor(a.length / 2)]; });
  })();
  function typicalSpin(la) { var b = Math.max(-60, Math.min(80, Math.round(la / 5) * 5)); while (SPIN[b] === undefined && b > -60) b -= 5; return SPIN[b] || 1500; }

  // ---- a pitch as it was really thrown
  function pitchFor(P, code) {
    var t = MAP[code] || code, q = P.pitches.filter(function (x) { return x.type === t; })[0];
    if (!q && kindOf(t)) q = P.pitches.filter(function (x) { return kindOf(x.type) === kindOf(t); }).sort(function (a, b) { return b.usage - a.usage; })[0];
    return q || null;
  }
  function realPitch(P, q, f) {
    var rel = BB.releasePoint(P), velo = (f.mph || q.velo) * MPH, rpm = f.rpm || q.rpm, target = [f.px * FT, f.pz * FT];
    var a = BB.aim(rel, velo, rpm, q.tilt, q.eff, P.armSide, target, env, null, q.seam);
    var d = BB.dirOf(a.yaw, a.pit), v0 = [d[0] * velo, d[1] * velo, d[2] * velo], w0 = BB.spinVector(d, rpm, q.tilt, q.eff, P.armSide);
    var fl = BB.flyPitch(rel, v0, w0, env, false, q.seam, P.armSide);
    return { type: q.type, rel: rel, v0: v0, w0: w0, seam: q.seam, armSide: P.armSide, mph: velo / MPH, rpm: rpm, tilt: q.tilt, eff: q.eff,
             fatigue: BB.fatigueOf(P), cmdIn: P.cmd, deception: P.deception, plate: { x: fl.x, z: fl.z, t: fl.t, v: fl.v, w: fl.w } };
  }
  function resultOf(code) {
    if (code === 'B' || code === '*B' || code === 'P' || code === 'V' || code === 'I') return 'ball';
    if (code === 'C') return 'called';
    if (code === 'S' || code === 'W' || code === 'M' || code === 'Q' || code === 'T') return code === 'T' ? 'foul' : 'whiff';
    if (code === 'F' || code === 'L' || code === 'R' || code === 'O') return 'foul';
    if (code === 'X' || code === 'D' || code === 'E') return 'inplay';
    if (code === 'H') return 'hbp';
    return null;
  }
  function categoryOf(et) {
    if (!et) return null;
    if (/^strikeout/.test(et)) return 'K';
    if (et === 'walk' || et === 'intent_walk') return 'BB';
    if (et === 'hit_by_pitch') return 'HBP';
    if (et === 'single') return '1B'; if (et === 'double') return '2B'; if (et === 'triple') return '3B'; if (et === 'home_run') return 'HR';
    if (et === 'field_error') return 'E';
    if (et === 'catcher_interf') return 'CI';
    return 'OUT';
  }
  function catOfResolve(r) { return r.hit === 'OUT' || r.hit === 'SF' || r.hit === 'FC' ? 'OUT' : r.hit; }

  // ---- the batted ball as it really left the bat
  function realBatted(pitch, hit) {
    var la = hit.la * DEG, sp = Math.atan2(hit.hcx - 126.0, 205.0 - hit.hcy), ev = hit.ev * MPH;
    var v = [ev * Math.cos(la) * Math.sin(sp), ev * Math.cos(la) * Math.cos(sp), ev * Math.sin(la)];
    var vh = Math.sqrt(v[0] * v[0] + v[1] * v[1]), sideU = [v[1] / vh, -v[0] / vh, 0];   // cross(vh, z)
    function fly(back) { return BB.battedBall(pitch, { v: v, w: [sideU[0] * back * RPM, sideU[1] * back * RPM, 0], q: 1 }, env, false); }
    var back = typicalSpin(hit.la);
    if (hit.la >= 10 && hit.dist) {   // carry it as far as Statcast measured
      var lo = -500, hi = 5000;
      for (var it = 0; it < 22; it++) { var mid = (lo + hi) / 2, b = fly(mid); if (b.projDist < hit.dist) { if (hit.la > 20) lo = mid; else lo = mid; } else hi = mid; }
      back = (lo + hi) / 2;
    }
    var bb = fly(back); bb.solvedSpin = back;
    return bb;
  }

  // ---- the game, plate appearance by plate appearance
  var load = {}, seenOwn = {}, seenTeam = {};
  G.pas.forEach(function (pa, n) {
    var P0 = pitcher(pa.pitcher), key = pa.batter + ':' + pa.pitcher, tkey = pa.bat + ':' + pa.pitcher;
    var ld0 = load[pa.pitcher] || 0, so = seenOwn[key] || 0, st0 = seenTeam[tkey] || 0;
    load[pa.pitcher] = ld0 + pa.pitches.length; seenOwn[key] = so + pa.pitches.length; seenTeam[tkey] = st0 + pa.pitches.length;
    if (n % PARTS !== PART) return;
    var Bm = hitter(pa.batter), fs = pa.bat === 'away' ? 'home' : 'away';
    if (!Bm) { print(JSON.stringify({ i: pa.i, skip: 'no fit for ' + pa.batterName })); return; }
    var sb = BB.batterSide(Bm, P0), seen = so + 0.25 * (st0 - so), lead = pa.bat === 'away' ? pa.score[1] - pa.score[0] : pa.score[0] - pa.score[1];
    var Dd = defence(fs, P0), basesIds = pa.bases, basesObj = [null].concat(basesIds.map(function (id) { return id ? hitter(id) : null; }));
    var sit = { bases: basesObj, outs: pa.outs, inning: pa.inning, lead: lead };
    // 1. the expectation
    var cats = { K: 0, BB: 0, HBP: 0, '1B': 0, '2B': 0, '3B': 0, HR: 0, OUT: 0, E: 0 }, wsum = 0, wvals = [], runs = 0;
    for (var k = 0; k < M; k++) {
      var Bk = hitter(pa.batter, k);
      P0.load = ld0;
      var res = BB.simPA(P0, Bk, { env: env, ump: ump, framing: 0, seen: seen, rec: false, runnersOn: !!(basesIds[0] || basesIds[1] || basesIds[2]) }, rng), c;
      if (res.result === 'K' || res.result === 'BB' || res.result === 'HBP' || res.result === 'HR') c = res.result;
      else {
        sit.u = rng.u(); BBField.positionDefense(Dd, Bk, sb, sit);
        var r = BBField.resolve(res.bb, Bk, basesObj.slice(), pa.outs, Dd, env, rng, { side: sb, foulCaught: !!res.foulCaught });
        c = catOfResolve(r); runs += r.runs;
      }
      cats[c]++; wsum += WOBA[c]; wvals.push(WOBA[c]);
    }
    for (var c2 in cats) cats[c2] = +(cats[c2] / M).toFixed(4);
    var actual = categoryOf(pa.eventType), wa = WOBA[actual] === undefined ? null : WOBA[actual];
    var below = wvals.filter(function (w) { return w < wa; }).length / M, same = wvals.filter(function (w) { return w === wa; }).length / M;
    var out = { i: pa.i, inning: pa.inning, half: pa.half, outs: pa.outs, bases: basesIds.map(function (b) { return b ? 1 : 0; }), score: pa.score,
                batter: pa.batterName, batterId: pa.batter, pitcher: pa.pitcherName, pitcherId: pa.pitcher, bat: pa.bat, event: pa.event, desc: pa.desc,
                actual: actual, probs: cats, pActual: cats[actual] !== undefined ? cats[actual] : null, xwoba: +(wsum / M).toFixed(3), woba: wa,
                pctile: wa === null ? null : +(below + same / 2).toFixed(3), pitchCount: ld0, seen: +seen.toFixed(1) };
    // 2. each pitch as thrown
    P0.load = ld0;
    var last = [], pv = [], soPitch = so, stPitch = st0;
    pa.pitches.forEach(function (f, j) {
      var rcode = resultOf(f.code), q = f.px === null || f.px === undefined ? null : pitchFor(P0, f.type);
      var rec = { n: j + 1, type: f.type, mph: f.mph, count: f.balls + '-' + f.strikes, result: rcode, px: f.px, pz: f.pz };
      if (q && rcode && rcode !== 'hbp') {
        var pitch = realPitch(P0, q, f), stc = { balls: f.balls, strikes: f.strikes, last: last.slice() };
        var seenNow = soPitch + j + 0.25 * (stPitch - soPitch), fam = Bm.learn * (1 - Math.exp(-seenNow / 40));
        var nS = 0, nW = 0, nF = 0, nI = 0, nT = 0, nCS = 0, nFool = 0, nLate = 0, R = 160;
        for (var t = 0; t < R; t++) {
          var ex = BB.expectPitch(Bm, P0, sb, stc), gh = BB.ghostPitch(pitch, ex, P0, env, false, fam), ref = BB.typicalPitch(pitch, P0, fam, env);
          var rf = BB.readFactors(Bm, pitch, gh, ref, seenNow, P0.pitches[ex.guess].type === pitch.type, rng, kindOf(ex.guessType) === 'FB' && kindOf(pitch.type) === 'FB');
          if (!rf.detected && !rf.late) nFool++; if (rf.late) nLate++;
          var dec = BB.decide(Bm, pitch, gh, rf, stc, rng), chk = 0;
          if (dec.swing && rng.u() < BB.checkChance(Bm, rf, pitch)) { if (rng.u() < BB.CHECK.hold) dec.swing = false; else chk = BB.CHECK.slow[0] + (BB.CHECK.slow[1] - BB.CHECK.slow[0]) * rng.u(); }
          if (!dec.swing) { nT++; if (BB.callPitch(ump, 0, Bm, sb, pitch.plate.x, pitch.plate.z, f.balls, f.strikes, rng).strike) nCS++; continue; }
          nS++;
          var sw = BB.swing(Bm, pitch, gh, rf, sb, stc, rng, chk), col = sw.contact ? BB.collide(pitch, sw) : null;
          if (!col) { nW++; continue; }
          var bbx = BB.battedBall(pitch, col, env, false);
          if (bbx.hr || bbx.fair) nI++; else nF++;
        }
        rec.pSwing = +(nS / R).toFixed(3); rec.pWhiff = nS ? +(nW / nS).toFixed(3) : null; rec.pFoul = nS ? +(nF / nS).toFixed(3) : null; rec.pInPlay = nS ? +(nI / nS).toFixed(3) : null;
        rec.pCalled = nT ? +(nCS / nT).toFixed(3) : null; rec.pFooled = +(nFool / R).toFixed(3); rec.pLate = +(nLate / R).toFixed(3);
        var pr = { ball: nT ? (nT - nCS) / R : 0, called: nCS / R, whiff: nW / R, foul: nF / R, inplay: nI / R };
        rec.pResult = +(pr[rcode] || 0).toFixed(3);
        rec.inZone = BB.inZone(Bm, pitch.plate.x, pitch.plate.z);
        rec.mappedType = q.type;
      }
      pv.push(rec);
      if (q) { last.unshift(q.type); if (last.length > 2) last.length = 2; }
    });
    out.pitches = pv;
    // 3. the batted ball as it left the bat
    if (pa.hit && pa.hit.ev !== null && pa.hit.la !== null && pa.hit.hcx !== null) {
      var lastP = pa.pitches[pa.pitches.length - 1], qq = lastP && lastP.px !== null ? pitchFor(P0, lastP.type) : null;
      if (qq) {
        var pitchL = realPitch(P0, qq, lastP), bb = realBatted(pitchL, pa.hit), bc = { '1B': 0, '2B': 0, '3B': 0, HR: 0, OUT: 0, E: 0 }, xw = 0, RB = 400;
        for (var t2 = 0; t2 < RB; t2++) {
          sit.u = rng.u(); BBField.positionDefense(Dd, Bm, sb, sit);
          var rr = BBField.resolve(bb, Bm, basesObj.slice(), pa.outs, Dd, env, rng, { side: sb });
          var cc = catOfResolve(rr); bc[cc]++; xw += WOBA[cc];
        }
        for (var c3 in bc) bc[c3] = +(bc[c3] / RB).toFixed(3);
        out.bip = { ev: pa.hit.ev, la: pa.hit.la, dist: pa.hit.dist, spray: +(Math.atan2(pa.hit.hcx - 126.0, 205.0 - pa.hit.hcy) / DEG).toFixed(1), spin: Math.round(bb.solvedSpin),
                    modelDist: Math.round(bb.projDist), probs: bc, xwobacon: +(xw / RB).toFixed(3), pHit: +(bc['1B'] + bc['2B'] + bc['3B'] + bc.HR).toFixed(3) };
      }
    }
    print(JSON.stringify(out));
  });
})(typeof arguments !== 'undefined' ? arguments : []);
