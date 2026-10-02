/* ============================================================================
   bb_sound.js · v0.1 · 2026-10-02

   Plays the broadcast (bb_call.js) in the page, on the game's clock.

   Sound files play through HTML audio elements, which load from file://
   (fetch and Web Audio decoding of files do not, on the wall). The list of
   files comes from sounds/manifest.js, a script beside the page; without it
   there are no sounds and nothing else changes. Each cue picks its variant
   at random, seeded by the game and the event, so a replayed game sounds the
   same. The crowd bed crossfades as the park's mood changes; everything but
   the voices ducks a few decibels while a line is spoken.

   The voices come from the speech server on the Pi (tts/speech_server.py,
   127.0.0.1:8898). At load the page posts the game's voice lines; it tells
   the server where the game is (the cursor) on a seek, a pause or a change
   of speed and every few seconds; it asks /status which lines are ready.
   A line plays exactly at its moment if it is ready and fits its air, and
   is skipped otherwise - never late. No server: no voices, no errors.

   The organ (bb_organ.js) is synthesised with Web Audio.

   At speeds other than 1x the voices and the beds go quiet and only the big
   moments sound; a pause silences everything. Keys (wired in baseball.html):
   v mutes and unmutes the announcers, c the crowd, the field and the organ.

   Usage: var snd = BBSound.create({ call, SEG, segAt, seed, base });
          snd.update(T, speed, paused) every frame; snd.toggle('voice'|'crowd')

   CHANGED
     v0.1  first build
============================================================================ */

var BBSound = (function () {
  'use strict';
  var SERVER = 'http://127.0.0.1:8898';
  // the moments that still sound when the game runs fast
  var BIG = { eruption: 1, cheer_big: 1, groan_big: 1, ovation: 1, murmur_stunned: 1, fireworks: 1, boo_long: 1 };
  var BIG_ORGAN = { organ_hr: 1, organ_win: 1, organ_stretch: 1 };
  var DUCK = 0.45;   // everything but the voices, while a line is spoken (about -7 dB)
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function create(o) {
    var C = o.call, base = o.base || 'sounds/', seed = o.seed, segAt = o.segAt;
    var M = (typeof window !== 'undefined' && window.BB_SOUNDS && window.BB_SOUNDS.sounds) || {};
    var mute = { voice: false, crowd: false };
    try { mute.voice = localStorage.getItem('bb_mute_voice') === '1'; mute.crowd = localStorage.getItem('bb_mute_crowd') === '1'; } catch (e) { }
    var cues = [];   // one time line: sounds, organ cues, voice lines
    C.sfx.forEach(function (q) { cues.push({ t: q.t, kind: 'sfx', q: q }); });
    C.organ.forEach(function (q) { cues.push({ t: q.t, kind: 'organ', q: q }); });
    C.lines.forEach(function (q) { cues.push({ t: q.t, kind: 'voice', q: q }); });
    cues.sort(function (a, b) { return a.t - b.t; });
    var crowdAt = {}; C.crowd.forEach(function (c) { crowdAt[c.event] = c; });

    // ---------------------------------------------------------- files
    var pool = {};   // file -> a loaded element, cloned to play
    function fileFor(sound, key) {
      var S = M[sound]; if (!S || !S.files || !S.files.length) return null;
      return S.files[hash(seed + ':' + key + ':' + sound) % S.files.length].file;
    }
    Object.keys(M).forEach(function (s) { (M[s].files || []).forEach(function (f) {
      if (M[s].loop) return;   // beds load when they are needed
      var a = new Audio(); a.preload = 'auto'; a.src = base + f.file; pool[f.file] = a; }); });
    var playing = [];   // { el, vol, kind, end }
    function start(file, vol, kind, maxDur) {
      var src = pool[file], el = src ? src.cloneNode() : new Audio(base + file);
      var p = { el: el, vol: vol, kind: kind, end: maxDur ? Date.now() + maxDur * 1000 : 0 };
      el.volume = level(p);
      var pr = el.play(); if (pr && pr.catch) pr.catch(function () { });
      el.onended = function () { p.done = true; };
      playing.push(p); return p;
    }

    // ---------------------------------------------------------- beds
    var bed = { cur: null, next: null, name: '', fade: 0 };
    function bedTo(name, key, now) {
      if (!name || name === bed.name) return;
      var file = fileFor(name, key); if (!file) return;
      bed.name = name;
      var el = new Audio(base + file); el.loop = true; el.volume = 0;
      var pr = el.play(); if (pr && pr.catch) pr.catch(function () { });
      if (bed.next) { stopEl(bed.cur); bed.cur = bed.next; }
      bed.next = { el: el, t0: now };
    }
    function stopEl(b) { if (b && b.el) { try { b.el.pause(); } catch (e) { } b.el.src = ''; } }
    var arousal = 0.3;

    // ---------------------------------------------------------- the organ
    var ctx = null, organ = null, organGain = null;
    function organInit() {
      if (organ || typeof window === 'undefined' || !window.BBOrgan) return;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ctx = new AC(); organGain = ctx.createGain(); organGain.connect(ctx.destination); organ = BBOrgan.create(ctx, organGain); } catch (e) { organ = null; }
    }
    organInit();
    // a laptop's browser holds sound until the first key or click (the wall's does not)
    function wake() { if (ctx && ctx.state === 'suspended' && !pausedNow) ctx.resume(); playing.forEach(function (p) { if (p.el.paused && !p.done && !pausedNow) { var pr = p.el.play(); if (pr && pr.catch) pr.catch(function () { }); } }); }
    if (typeof document !== 'undefined') { document.addEventListener('keydown', wake); document.addEventListener('click', wake); }

    // ---------------------------------------------------------- the voices
    // no server (a laptop, a friend's computer): it is asked again less and less often, and
    // when it appears (restarted on the wall) it is sent the script then
    var srv = { up: false, sent: false, ready: {}, lastCursor: 0, lastStatus: 0, failed: 0, cursor: null };
    function post(path, body) {
      if (typeof fetch === 'undefined') return Promise.reject();
      return fetch(SERVER + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    function sendScript() {
      post('/script', { seed: seed, version: C.version, lines: C.lines.map(function (l) { return { id: l.id, t: l.t, role: l.role, text: l.text, pace: l.pace, energy: l.energy, maxDur: l.maxDur }; }) })
        .then(function (r) { srv.sent = r.ok; if (srv.cursor) cursor(srv.cursor); }, function () { srv.sent = false; });
    }
    function cursor(c) { srv.cursor = c; srv.lastCursor = Date.now(); if (srv.up && srv.sent) post('/cursor', c).catch(function () { }); }
    function status() {
      if (typeof fetch === 'undefined') return;
      fetch(SERVER + '/status').then(function (r) { return r.json(); }).then(function (s) {
        srv.up = true; srv.failed = 0; srv.ready = s.ready || {}; srv.ahead = s.ahead;
        if (!srv.sent || s.script !== seed + '-' + C.version) { srv.sent = true; sendScript(); }   // a fresh server, or one holding another game
      }, function () { srv.failed++; srv.up = false; srv.sent = false; });
    }
    status();
    var preload = {};
    function voiceReady(l) { var d = srv.ready[l.id]; return d !== undefined && d <= l.maxDur + 0.3; }

    // ---------------------------------------------------------- levels
    var talking = 0;   // ms timestamp until which a voice line is speaking
    function level(p) {
      if (pausedNow) return 0;
      if (p.kind === 'voice') return mute.voice ? 0 : clamp(p.vol, 0, 1);
      if (mute.crowd) return 0;
      return clamp(p.vol * (Date.now() < talking ? DUCK : 1), 0, 1);
    }

    // ---------------------------------------------------------- the clock
    var lastT = null, idx = 0, pausedNow = false, lastSpeed = 1, lastBig = 0;
    var count = { voice: 0, voiceSkipped: 0, sfx: 0, organ: 0 };   // what has played, for the HUD's owner and the headless checks
    function seekTo(T) { var lo = 0, hi = cues.length; while (lo < hi) { var m = (lo + hi) >> 1; if (cues[m].t < T) lo = m + 1; else hi = m; } idx = lo; }
    function fire(c, speed) {
      var q = c.q, normal = speed === 1;
      if (c.kind === 'sfx') {
        if (!normal && !BIG[q.sound]) return;
        if (!normal && Date.now() - lastBig < 3000) return;
        var f = fileFor(q.sound, q.event); if (!f) return;
        if (!normal) lastBig = Date.now();
        count.sfx++;
        start(f, 0.9 * q.gain, M[q.sound].group === 'field' ? 'field' : 'crowd', q.dur);
      } else if (c.kind === 'organ') {
        if (!organ || (!normal && !BIG_ORGAN[q.cue])) return;
        organ.play(q.cue, { pick: hash(seed + ':' + q.event) % 8 }); count.organ++;
      } else if (c.kind === 'voice') {
        if (!normal || mute.voice) return;
        if (!srv.up || !voiceReady(q)) { count.voiceSkipped++; return; }   // never late, never unready: skipped
        count.voice++;
        var el = preload[q.id] || new Audio(SERVER + '/voice/' + q.id);
        delete preload[q.id];
        var p = { el: el, vol: q.role === 'pa' ? 0.9 : 1, kind: 'voice', end: 0 };
        el.volume = level(p); var pr = el.play(); if (pr && pr.catch) pr.catch(function () { });
        el.onended = function () { p.done = true; };
        playing.push(p);
        talking = Date.now() + 1000 * (srv.ready[q.id] || q.est);
      }
    }
    function update(T, speed, paused) {
      var now = Date.now();
      if (paused !== pausedNow) {
        pausedNow = paused;
        if (paused) { playing.forEach(function (p) { try { p.el.pause(); } catch (e) { } }); [bed.cur, bed.next].forEach(function (b) { if (b) b.el.pause(); }); if (ctx) ctx.suspend(); }
        else { [bed.cur, bed.next].forEach(function (b) { if (b) { var pr = b.el.play(); if (pr && pr.catch) pr.catch(function () { }); } }); if (ctx) ctx.resume(); playing.forEach(function (p) { p.done = true; }); }
        cursor({ t: T, speed: speed, playing: !paused });
      }
      if (lastT === null || T < lastT - 0.05 || T > lastT + Math.max(1.5, 0.5 * speed)) {   // a seek: carry on from here, fire nothing skipped
        seekTo(T); playing.forEach(function (p) { if (p.kind === 'voice') { try { p.el.pause(); } catch (e) { } p.done = true; } });
        cursor({ t: T, speed: speed, playing: !paused });
      } else if (!paused) {
        while (idx < cues.length && cues[idx].t <= T) { fire(cues[idx], speed); idx++; }
      }
      if (speed !== lastSpeed) {   // off 1x the voices stop; back at 1x they pick up with the next line
        lastSpeed = speed; cursor({ t: T, speed: speed, playing: !paused });
        if (speed !== 1) { playing.forEach(function (p) { if (p.kind === 'voice') { try { p.el.pause(); } catch (e) { } p.done = true; } }); talking = 0; if (organ) organ.stop(); }
      }
      lastT = T;
      if (now - srv.lastCursor > 8000) cursor({ t: T, speed: speed, playing: !paused });
      if (now - srv.lastStatus > (srv.up ? 2000 : Math.min(60000, 2000 * Math.pow(2, srv.failed)))) { srv.lastStatus = now; status(); }
      // load the next few seconds of voice ahead, so each starts on its moment
      if (srv.up && speed === 1) for (var j = idx; j < cues.length && cues[j].t < T + 6; j++) {
        var c = cues[j]; if (c.kind === 'voice' && !preload[c.q.id] && voiceReady(c.q)) { var a = new Audio(); a.preload = 'auto'; a.src = SERVER + '/voice/' + c.q.id; preload[c.q.id] = a; }
      }
      // the crowd bed: the segment's mood; quiet when the game runs fast
      var seg = segAt(T), cw = crowdAt[seg.id];
      if (cw && speed === 1) { arousal += (cw.arousal - arousal) * 0.02; bedTo(cw.bed, cw.bed + Math.floor(T / 600), now); }
      if (bed.next) {
        var k = clamp((now - bed.next.t0) / 2500, 0, 1), vol = speed === 1 ? 0.28 + 0.3 * arousal : 0;
        bed.next.el.volume = level({ vol: vol * k, kind: 'crowd' });
        if (bed.cur) { bed.cur.el.volume = level({ vol: vol * (1 - k), kind: 'crowd' }); if (k >= 1) { stopEl(bed.cur); bed.cur = null; } }
      }
      if (organGain) organGain.gain.value = mute.crowd || paused ? 0 : (now < talking ? DUCK : 1);
      // levels of what is sounding; let go of what has finished or run out its air
      playing = playing.filter(function (p) {
        if (p.done || (p.end && now > p.end + 400)) { if (!p.done) { try { p.el.pause(); } catch (e) { } } return false; }
        var v = level(p); if (p.end && now > p.end) v *= clamp(1 - (now - p.end) / 400, 0, 1);   // over its time: a short fade
        p.el.volume = v; return true;
      });
    }
    function toggle(which) {
      mute[which] = !mute[which];
      try { localStorage.setItem('bb_mute_' + which, mute[which] ? '1' : '0'); } catch (e) { }
      if (which === 'voice' && mute.voice) talking = 0;
      wake();
    }
    function state() { return { voice: !mute.voice, crowd: !mute.crowd, server: srv.up, files: Object.keys(pool).length, ahead: srv.ahead, count: count }; }
    return { update: update, toggle: toggle, state: state };
  }
  return { version: '0.1', create: create };
})();
