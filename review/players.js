/* ============================================================================
   players.js · v0.6 · 2026-10-15

   Real players as the engine's players, for the playoff review. Loaded after
   bb_engine.js (and bb_field.js, bb_game.js when games are played).

   A HITTER: his measured body and swing (height, weight, swing length, bat
   speed, attack angle, swing tilt; playoffs/players_measured.json) and his
   hidden traits from review/fit_hitters.py, the posterior mean or one of its
   draws. Bat speed is held at his measured mean by solving the power chain
   for his swing power; his sprint speed and arm are his measured ones.

   A PITCHER: his measured arm slot, release point (height, side, extension),
   and for each pitch type he throws 2% or more: its speed, spin, active spin
   (the spin efficiency) and movement. The movement is matched by solving the
   engine's spin tilt so the Magnus break points the measured way, then the
   seam break for what is left (the engine's movement is the whole flight's
   break off a spinless pitch, as pitcher_chain_check measures it and as the
   engine's types were fitted to Savant's IVB and HB). Command is his measured
   scatter per type over the type's own multiplier, usage-weighted. Usage is
   his overall mix; the league's count and side multipliers do the rest.
   When review/pitchers_fit.json exists, his two fitted hidden traits are
   applied: deception, and the scale on his command (review/fit_pitchers.js); his mishit, the scale on the batter's miss
   along the barrel, when fitted (review/fit_mishit.py).

   CHANGED
     v0.6  redraw() draws a fresh population pitcher and takes from the build only what came from data or callers
     v0.5  redraw(): a replay's copy of a pitcher built once a game, with PDRAW's draw made there (the model review)
     v0.4  PDRAW: pitchers drawn from their fit's uncertainty (review/pitcher_sd.py; the model review)
     v0.3  traits the data cannot identify (FREEZE) held at the posterior mean in replays (the model review)
     v0.2  setData(recs, fits, pfit) for a browser, which has no read(): the live page hands its bundle in
     v0.1  first build (the Yankees-Rays review, 2026-10-06)
============================================================================ */
var REVIEW = (function () {
  var U = BB.units, MPH = U.MPH, FT = U.FT, IN = U.IN;
  var MAP = { CS: 'CU', KC: 'CU', SV: 'SL', FO: 'FS', SC: 'CH' };
  function pm(o) { return o && o.pooled && o.pooled.mean !== undefined ? o.pooled.mean : null; }
  function latest(o) { if (!o) return null; var y = o['2026'] !== undefined ? o['2026'] : o['2025']; return typeof y === 'object' && y ? y.mean : y; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var PDRAW = false;   // v0.4: draw each pitcher's deception and command from his fit's uncertainty (replay_game mode 'pdraw')
  var FREEZE = ['learn', 'coverage', 'commit'];   // faceSD and timingSD are now measured directly (review/fit_hitters.py v0.3)
  function hitter(fit, rng, draw, pos) {
    var B = BB.makeBatter(rng, { population: true, pos: pos || fit.position || 'DH', bats: fit.bats });
    var k = fit.known, h = draw === undefined || draw === null ? (fit.refined || fit.mean) : fit.draws[draw % fit.draws.length];
    B.name = fit.name; B.mlbId = fit.id; B.team = fit.team; B.bats = fit.bats;
    B.heightIn = k.heightIn; B.weightLb = k.weightLb; B.swingLenFt = k.swingLenFt; B.attack = k.attack; B.swingTilt = k.swingTilt;
    B.bat = BB.batOf(clamp(31.8 + 0.012 * (k.weightLb - 206), 29, 35), 34);
    var v = k.batSpeed * MPH;
    B.swingPower = v * v * v * B.bat.mEff / (4 * k.weightLb * 0.4536 * k.swingLenFt * FT);
    B.batSpeed = BB.batSpeedOf(B.swingPower, B.weightLb, B.swingLenFt, B.bat);
    for (var key in h) B[key] = h[key];
    // the model review (2026-10-14): traits the data cannot identify (the posterior sd over 0.9 of the prior's and no
    // carry-over from one season to the next) are held at his posterior mean, not drawn afresh each replay
    if (fit.mean && draw !== undefined && draw !== null) FREEZE.forEach(function (k) { if (fit.mean[k] !== undefined) B[k] = fit.mean[k]; });
    B.barrelSD = B.motorIn * Math.pow(B.batSpeed / 72, 2);
    B.zone = { bot: 0.263 * B.heightIn * IN, top: 0.559 * B.heightIn * IN };
    if (fit.speed) B.speed = fit.speed;
    if (fit.armMph) B.armMph = fit.armMph;
    return B;
  }

  // the whole flight's break off a spinless pitch: [up, toward his arm side], inches
  function move(P, q, env) {
    var rel = BB.releasePoint(P), sp = q.velo * MPH, a = BB.aim(rel, sp, q.rpm, q.tilt, q.eff, P.armSide, [0, 0.75], env, null, q.seam);
    var dir = BB.dirOf(a.yaw, a.pit), v0 = [dir[0] * sp, dir[1] * sp, dir[2] * sp];
    var fl = BB.flyPitch(rel, v0, BB.spinVector(dir, q.rpm, q.tilt, q.eff, P.armSide), env, false, q.seam, P.armSide), none = BB.flyPitch(rel, v0, [0, 0, 0], env, false);
    return [(fl.z - none.z) / IN, (fl.x - none.x) / IN * P.armSide];
  }
  function solveShape(P, q, ivb, hb, env) {
    var tgt = Math.atan2(ivb, hb), best = null;
    q.seam = [0, 0];
    for (var t = -180; t < 180; t += 4) {   // the Magnus break's direction
      q.tilt = t; var m = move(P, q, env), e = Math.abs(Math.atan2(Math.sin(Math.atan2(m[0], m[1]) - tgt), Math.cos(Math.atan2(m[0], m[1]) - tgt)));
      if (!best || e < best.e) best = { t: t, e: e };
    }
    for (var step = 2; step >= 0.25; step /= 2) {
      [best.t - step, best.t + step].forEach(function (t2) {
        q.tilt = t2; var m2 = move(P, q, env), e2 = Math.abs(Math.atan2(Math.sin(Math.atan2(m2[0], m2[1]) - tgt), Math.cos(Math.atan2(m2[0], m2[1]) - tgt)));
        if (e2 < best.e) best = { t: t2, e: e2 };
      });
    }
    q.tilt = best.t;
    for (var it = 0; it < 4; it++) {          // the seam break: what the spin leaves
      var mm = move(P, q, env);
      q.seam = [q.seam[0] + (hb - mm[1]), q.seam[1] + (ivb - mm[0])];
    }
    var fin = move(P, q, env);
    q.fit = { ivb: +fin[0].toFixed(2), hb: +fin[1].toFixed(2), ivbMeasured: +ivb.toFixed(2), hbMeasured: +hb.toFixed(2) };
  }

  function pitcher0(rec, rng, env) {
    if (!rec.summaries.pitching || !rec.traits.pitching || !rec.summaries.pitching.pitchTypes || !Object.keys(rec.summaries.pitching.pitchTypes).length) {
      // no pitches of his in the seasons the replay may use (a position player pitching, a man back from injury): a generic
      // reliever from the model's population, so the game can still be played
      var G0 = BB.makePitcher(rng, { population: true, role: 'RP', throws: rec.throws || 'R' }); G0.name = rec.name; G0.mlbId = rec.id; G0.team = rec.team; G0.generic = true; return G0;
    }
    var S = rec.summaries.pitching, T = rec.traits.pitching, role = (S.role && S.role.role) || 'RP';
    var P = BB.makePitcher(rng, { population: true, role: role, throws: rec.throws });
    P.name = rec.name; P.mlbId = rec.id; P.team = rec.team;
    P.heightIn = rec.heightIn || P.heightIn; P.weightLb = rec.weightLb || P.weightLb;
    if (pm(T.armAngle) !== null) P.armAngle = pm(T.armAngle);
    if (pm(T.releaseHeightFt) !== null) P.rel = { ht: pm(T.releaseHeightFt), side: Math.abs(pm(T.releaseSideFt)), ext: pm(T.ext) };
    var pitches = [], cx = 0, cz = 0, cw = 0;
    Object.keys(S.pitchTypes).forEach(function (t0) {
      var d = S.pitchTypes[t0], t = MAP[t0] || t0, use = pm(d.usage);
      if (!BB.PITCH_TYPES[t] || !use || use < 0.02 || pm(d.velo) === null || pm(d.ivbIn) === null) return;
      var dup = pitches.filter(function (q) { return q.type === t; })[0];
      if (dup) { dup.usage += use; return; }   // a slow curve folded into the curveball
      var as = latest(d.activeSpin), q = { type: t, velo: pm(d.velo), rpm: pm(d.rpm) || BB.PITCH_TYPES[t].rpm,
        eff: as ? clamp(as / 100, 0.03, 0.99) : BB.PITCH_TYPES[t].eff, tilt: 0, seam: [0, 0], usage: use, habit: [0, 0], aimCache: { ok: false } };
      solveShape(P, q, pm(d.ivbIn), pm(d.hbArmIn), env);
      q.aimCache = { ok: false };
      pitches.push(q);
      var c = d.command && (d.command['2026'] || d.command['2025']);
      if (c && c.x && c.n >= 50) { var m = BB.PITCH_TYPES[t].cmd; cx += use * c.x / m[0]; cz += use * c.z / m[1]; cw += use; }
    });
    var tot = pitches.reduce(function (a, q) { return a + q.usage; }, 0);
    pitches.forEach(function (q) { q.usage /= tot; });
    pitches.sort(function (a, b) { return b.usage - a.usage; });
    P.pitches = pitches;
    if (cw) { P.cmd = [cx / cw, cz / cw]; P.cmdData = true; }
    P.command = Math.sqrt((P.cmd[0] * P.cmd[0] + P.cmd[1] * P.cmd[1]) / 2);
    var ff = pitches.filter(function (q) { return BB.PITCH_TYPES[q.type].kind === 'FB'; })[0];
    if (ff) P.fbVelo = ff.velo;
    var use26 = S.use && (S.use['2026'] || S.use['2025']);
    if (use26 && use26.pitchesPerApp) P.staminaData = true;
    if (use26 && use26.pitchesPerApp) P.stamina = role === 'SP' ? Math.max(75, use26.pitchesPerApp.mean) : Math.max(15, 1.2 * use26.pitchesPerApp.mean);
    P.role = role;
    var pf = PFIT && PFIT.pitchers[rec.id];   // the fitted hidden traits, when review/fit_pitchers.js has run
    if (pf) { P.cmdScale = pf.cmdScale; P.deception = pf.deception; P.cmd = [P.cmd[0] * pf.cmdScale, P.cmd[1] * pf.cmdScale]; P.command = Math.sqrt((P.cmd[0] * P.cmd[0] + P.cmd[1] * P.cmd[1]) / 2); if (pf.mishit) P.mishit = pf.mishit; }
    P.fitSd = pf && pf.sdLogDec ? { dec: pf.sdLogDec, cmd: pf.sdLogCmd, rho: pf.rhoDecCmd || 0 } : null;
    return P;
  }
  // v0.6 (the model review, 2026-10-15): one replay's own pitcher from the game's single build. The build is costly (it flies
  // every pitch type to fit his shapes and caches his aims), so it is made once a game; each replay then draws a FRESH pitcher
  // from the population and takes from the build only what came from data or from the caller: his body and slot, his pitch
  // shapes and their aim caches (shared), his measured command and workload, his fitted deception, command scale and
  // mishit, and anything a caller added (errMult, a velocity boost, his bat). Everything else (fielding, holding runners,
  // whatever else the population draws) is drawn afresh, as a full rebuild would. Until v0.6 the replays built each pitcher
  // once a game and reused him in every replay, so whatever was drawn for him never averaged out. With PDRAW (engine-dev),
  // his deception and command are also drawn from his fit's uncertainty.
  var DATA_KEYS = ['name', 'mlbId', 'team', 'generic', 'heightIn', 'weightLb', 'armAngle', 'rel', 'fbVelo', 'role', 'deception', 'mishit', 'throws', 'armSide'];
  function redraw(P0, rng) {
    if (!P0 || !P0.pitches) return P0;
    var P = BB.makePitcher(rng, { population: true, role: P0.role, throws: P0.throws });
    DATA_KEYS.forEach(function (k) { if (P0[k] !== undefined) P[k] = P0[k]; });
    for (var k in P0) if (!(k in P)) P[k] = P0[k];   // what callers added
    P.pitches = P0.pitches.map(function (q) { var c = {}; for (var j in q) c[j] = q[j]; return c; });
    if (P0.cmdData) { P.cmd = P0.cmd.slice(); P.command = P0.command; }
    else if (P0.cmdScale) { P.cmd = [P.cmd[0] * P0.cmdScale, P.cmd[1] * P0.cmdScale]; P.command = Math.sqrt((P.cmd[0] * P.cmd[0] + P.cmd[1] * P.cmd[1]) / 2); }
    if (P0.staminaData) P.stamina = P0.stamina;
    if (typeof PDRAW !== 'undefined' && PDRAW && P0.fitSd) {
      var z1 = rng.n(0, 1), z2 = rng.n(0, 1), f = P0.fitSd, sc = Math.exp(f.cmd * (f.rho * z1 + Math.sqrt(1 - f.rho * f.rho) * z2));
      P.deception = P.deception * Math.exp(f.dec * z1); P.cmd = [P.cmd[0] * sc, P.cmd[1] * sc]; P.command = P.command * sc;
    }
    return P;
  }  function pitcher(rec, rng, env) {
    var P = pitcher0(rec, rng, env);
    if (!P.generic && (!P.pitches || !P.pitches.length)) {   // only pitch types the engine does not throw (a position player's lob, an eephus)
      var G0 = BB.makePitcher(rng, { population: true, role: 'RP', throws: rec.throws || 'R' }); G0.name = rec.name; G0.mlbId = rec.id; G0.team = rec.team; G0.generic = true; return G0;
    }
    return P;
  }

  var PFIT = null;

  var GIVEN = null;
  function setData(recs, fits, pfit) {   // a browser's bundle (live/data/playoff.js), in place of the files
    var byId = {};
    (recs.players || recs).forEach(function (r) { byId[r.id] = r; });
    PFIT = pfit || null; GIVEN = { recs: byId, fits: fits, pfit: PFIT };
  }
  function load() {
    if (GIVEN) return GIVEN;
    var recs = JSON.parse(read('playoffs/players_measured.json')); recs = recs.players || recs;
    var fits = JSON.parse(read('review/hitters_fit.json')), byId = {};
    recs.forEach(function (r) { byId[r.id] = r; });
    try { PFIT = JSON.parse(read('review/pitchers_fit.json')); } catch (e) { PFIT = null; }
    return { recs: byId, fits: fits, pfit: PFIT };
  }
  return { hitter: hitter, pitcher: pitcher, redraw: redraw, move: move, load: load, setData: setData, setPDraw: function (v) { PDRAW = !!v; } };
})();
