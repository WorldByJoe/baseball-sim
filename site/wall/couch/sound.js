/* ============================================================================
   couch/sound.js · v1.0 · 2026-10-08

   The ballpark's sound for the wall's Couch Analyst, from the live game. The game's events are real (MLB's feed,
   through the analyst's cues: every pitch and every finished at-bat); the park around them is a GUESS, made with
   the Ballgame's sound kit (sounds/, its manifest in sounds/manifest.js) and the announcers' voices (the speech
   server on the Pi, tts/speech_server.py, 127.0.0.1:8898):

     the crowd bed     how keyed up the park would be: the inning, how close the score is, runners on, the home team
                       batting with men on; sparse, normal, buzzing or on its feet, crossfaded as it changes
     each pitch        the mitt, the umpire on a called third strike, the bat by the real exit speed (weak, medium,
                       solid), a rising crowd on a long fly, clapping when the home pitcher gets two strikes
     each at-bat       the home crowd's reaction: cheers for the home team's hits and the visitors' outs, groans the
                       other way, an eruption, the organ and fireworks on a home run; the visitors' pocket on theirs
     voices            the ballpark announcer for each home batter; the play-by-play voice reads MLB's own account of
                       each at-bat; the colour voice says so when the model had given it little chance
     the organ         between half-innings, a charge for a home rally, the stretch, the outro on a home win

   Sound files play through HTML audio elements (they load from file://; fetch and Web Audio decoding of files do
   not). The voices: each new line is added to a script posted to the speech server a couple of seconds ahead of its
   moment, the server renders it, and the page plays it when ready (up to LATE_S late; never older). No server: no
   voices, no errors. When the page first opens on a game in progress it stays silent for what already happened.

   Usage: var snd = CouchSound.create({ base: 'sounds/', pk }); snd.feed(state) on each state; snd.mute('voice'|'park')

   CHANGED
     v1.0  first build (Joe, 2026-10-08: "add our audio track to the couch, including the background audio, which
           will be a guess, but still fun to experiment with")
============================================================================ */
var CouchSound = (function () {
  'use strict';
  var SERVER = 'http://127.0.0.1:8898', LEAD_S = 2.2, LATE_S = 6, DUCK = 0.45, PITCH_GAP = 2.4;
  var VOL = { bed: 0.32, field: 0.6, crowd: 0.85, organ: 0.6, park: 0.6, voice: 1.0 };

  function create(opt) {
    var base = opt.base || 'sounds/', S = (window.BB_SOUNDS || {}).sounds || {}, muted = { voice: false, park: false };
    var lastCue = null, queue = [], busyUntil = 0, ducking = false, lastHalf = null, lastState = null, finalDone = false;
    var bed = { name: null, el: null, fade: null }, clock0 = performance.now();
    function now() { return (performance.now() - clock0) / 1000; }
    var ORGAN = { organ_filler: 8 };   // the organ's files sit in sounds/organ/ but are not in the manifest (the Ballgame synthesises its organ)
    function pick(name) {
      var s = S[name];
      if ((!s || !s.files || !s.files.length) && /^organ_/.test(name)) return { file: 'organ/' + name + (ORGAN[name] ? '_0' + (1 + Math.floor(Math.random() * ORGAN[name])) : '') + '.ogg' };
      if (!s || !s.files || !s.files.length) return null;
      return s.files[Math.floor(Math.random() * s.files.length)];
    }
    function play(name, vol, delay) {
      if (muted.park) return;
      var f = pick(name); if (!f) return;
      setTimeout(function () { var a = new Audio(base + f.file); a.volume = Math.max(0, Math.min(1, vol * (ducking ? DUCK : 1))); a.play().catch(function () {}); }, (delay || 0) * 1000);
    }
    function chance(p) { return Math.random() < p; }

    // ---------------------------------------------------------- the bed: how keyed up the park would be
    function arousal(st) {
      var n = st && st.now; if (!n) return 0.3;
      var sc = st.score || [0, 0], diff = Math.abs(sc[0] - sc[1]), late = Math.min(1, (n.inning - 1) / 8);
      var close = diff <= 1 ? 1 : diff <= 3 ? 0.6 : diff <= 5 ? 0.25 : 0;
      var on = n.bases.filter(function (b) { return b; }).length, homeBat = n.half === 'bottom';
      var a = 0.22 + 0.25 * late * close + 0.08 * on + (homeBat && on >= 2 ? 0.15 : 0) + (n.outs === 2 && on ? 0.05 : 0) + (close ? 0.05 : 0);
      if (st.status === 'Final') a = 0.15;
      return Math.max(0, Math.min(1, a));
    }
    function bedFor(a) { return a < 0.25 ? 'bed_sparse' : a < 0.5 ? 'bed_normal' : a < 0.75 ? 'bed_buzz' : 'bed_rally'; }
    function setBed(name) {
      if (bed.name === name || muted.park) return;
      var f = pick(name); if (!f) return;
      var old = bed.el, el = new Audio(base + f.file); el.loop = true; el.volume = 0; el.play().catch(function () {});
      bed = { name: name, el: el, fade: null };
      var t0 = performance.now();
      var iv = setInterval(function () {
        var k = Math.min(1, (performance.now() - t0) / 3000), v = VOL.bed * (ducking ? DUCK : 1);
        el.volume = v * k; if (old) old.volume = Math.max(0, v * (1 - k));
        if (k >= 1) { clearInterval(iv); if (old) { old.pause(); old.src = ''; } }
      }, 100);
    }
    function duck(on) { ducking = on; if (bed.el) bed.el.volume = VOL.bed * (on ? DUCK : 1); }

    // ---------------------------------------------------------- voices: lines posted to the speech server ahead of their moment
    var lines = [], version = 0, ready = {}, played = {}, srvUp = false, seed = 'couch-' + (opt.pk || 0) + '-' + Math.floor(Date.now() / 1000);
    function say(role, text, energy, pace) {
      if (muted.voice || !text) return;
      var t = now() + LEAD_S + Math.max(0, busyUntil - now());
      var id = 'c' + (++version);
      lines.push({ id: id, t: +t.toFixed(2), role: role, text: text, pace: pace || 1.0, energy: energy || 'calm', maxDur: 9 });
      if (lines.length > 30) lines = lines.slice(-30);
      fetch(SERVER + '/script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed: seed, version: version, lines: lines }) })
        .then(function () { srvUp = true; }).catch(function () { srvUp = false; });
      busyUntil = t + Math.min(9, 0.42 * text.split(' ').length + 0.6);
    }
    setInterval(function () {
      if (muted.voice) return;
      fetch(SERVER + '/cursor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: now(), speed: 1 }) }).catch(function () {});
      fetch(SERVER + '/status').then(function (r) { return r.json(); }).then(function (s) { srvUp = true; ready = s.ready || {}; }).catch(function () { srvUp = false; });
    }, 1000);
    setInterval(function () {   // play each line at its moment when it is ready; a little late is fine live, an old one is dropped
      var t = now();
      lines.forEach(function (l) {
        if (played[l.id] || t < l.t) return;
        if (t - l.t > LATE_S) { played[l.id] = 'skipped'; return; }
        if (ready[l.id] == null) return;
        played[l.id] = 'played';
        var a = new Audio(SERVER + '/voice/' + l.id); a.volume = VOL.voice; duck(true);
        a.onended = a.onerror = function () { duck(false); };
        a.play().catch(function () { duck(false); });
      });
    }, 200);

    // ---------------------------------------------------------- the game's events, paced
    function cueEnergy(c) {
      var big = c.eventType === 'home_run' || (c.runs >= 2), mid = c.runs >= 1 || /^(double|triple)$/.test(c.eventType) || (c.onBase >= 2 && /strikeout|double_play/.test(c.eventType));
      return big ? 'peak' : mid ? 'excited' : c.onBase ? 'building' : 'calm';
    }
    function onPitch(c) {
      var homePitch = c.bat === 'away', h = c.hit;
      if (c.res === 'ball') { if (c.pz != null && c.pz < 0.6) play('ball_dirt', VOL.field * 0.7); else play('mitt_pop', VOL.field * 0.55); }
      else if (c.res === 'called') { play('mitt_pop', VOL.field); if (c.strikes === 2) play('ump_strike', VOL.field, 0.25); }
      else if (c.res === 'whiff') play('mitt_pop', VOL.field * 0.8);
      else if (c.res === 'foul') play(chance(0.5) ? 'foul_tip' : 'bat_weak', VOL.field * 0.7);
      else if (c.res === 'hbp') play('ooh_wince', VOL.crowd * 0.8);
      else if (c.res === 'inplay') {
        var ev = h && h.ev != null ? h.ev : 85;
        play(ev < 75 ? 'bat_weak' : ev < 95 ? 'bat_medium' : 'bat_solid', VOL.field * (0.7 + 0.3 * Math.min(1, Math.max(0, (ev - 60) / 45))));
        if (h && ev >= 95 && h.la >= 18 && h.la <= 40) play('swell_fly', VOL.crowd * 0.8, 0.3);
      }
      // the count builds: clapping for the home pitcher's two strikes, a rumble at a full count late
      if (homePitch && c.strikes === 1 && /called|whiff|foul/.test(c.res) && chance(0.6)) play('clap_two_strike', VOL.crowd * 0.55, 0.8);
      if (c.balls === 3 && c.strikes === 2 && c.inning >= 7) play('rumble_rising', VOL.crowd * 0.5, 0.6);
    }
    function onPA(c) {
      var homeBat = c.bat === 'home', e = c.eventType || '', hit = /^(single|double|triple|home_run)$/.test(e), d = 1.1;
      if (homeBat) {
        if (e === 'home_run') { play('eruption', VOL.crowd, d); play('organ_hr', VOL.organ, d + 1.5); play('fireworks', VOL.park, d + 2.5); }
        else if (e === 'triple' || e === 'double') play(c.runs ? 'cheer_big' : 'cheer_medium', VOL.crowd, d);
        else if (e === 'single') play(c.runs ? 'cheer_big' : 'cheer_medium', VOL.crowd * 0.85, d);
        else if (/walk|hit_by_pitch/.test(e)) play('applause_polite', VOL.crowd * 0.7, d);
        else if (c.runs) play('cheer_medium', VOL.crowd * 0.8, d);
        else if (/double_play|triple_play/.test(e)) play('groan_big', VOL.crowd, d);
        else if (c.onBase) play(/strikeout/.test(e) ? 'letdown' : 'groan_small', VOL.crowd * 0.75, d);
        if (homeBat && c.onBase >= 1 && hit && c.inning >= 6 && chance(0.5)) play('organ_charge', VOL.organ, d + 3);
      } else {
        if (e === 'home_run') { play('murmur_stunned', VOL.crowd * 0.8, d); play('pocket_visitors', VOL.crowd * 0.5, d + 0.8); }
        else if (hit) play(c.runs ? 'groan_big' : 'groan_small', VOL.crowd * 0.8, d);
        else if (/walk/.test(e)) { if (chance(0.4)) play('boo_short', VOL.crowd * 0.5, d); }
        else if (/strikeout/.test(e)) play(c.onBase >= 2 ? 'cheer_big' : 'cheer_medium', VOL.crowd * 0.85, d);
        else if (/double_play|triple_play/.test(e)) play('cheer_big', VOL.crowd, d);
        else play(c.onBase ? 'cheer_small' : 'applause_polite', VOL.crowd * 0.6, d);
      }
      // the call: MLB's own account, then the model's word when it had given this little chance
      say('pbp', (c.desc || '').replace(/\s+/g, ' ').trim(), cueEnergy(c), cueEnergy(c) === 'peak' ? 1.0 : 1.05);
      if (c.flag && c.pActual != null && c.pActual < 0.2) say('colour', 'The model gave that ' + Math.max(1, Math.round(100 * c.pActual)) + ' percent.', 'building', 1.1);
    }
    function onUp(c) {
      var key = c.inning + c.half;
      if (lastHalf && key !== lastHalf) {   // a new half-inning: the organ in the break, the stretch before the home seventh
        if (c.half === 'bottom' && c.inning === 7) play('organ_stretch', VOL.organ, 0.5);
        else play(chance(0.5) ? 'organ_filler' : 'organ_take_field', VOL.organ * 0.8, 0.5);
      }
      lastHalf = key;
      if (c.bat === 'home') { play('pa_chime', VOL.park * 0.6); say('pa', 'Now batting, ' + c.batter + '.', 'calm', 1.0); }
    }
    function run() {   // one cue at a time: a pitch's sounds take PITCH_GAP seconds, so a burst from the feed plays out
      if (!queue.length) return;
      var t = now(); if (t < runUntil) return;
      var c = queue.shift();
      if (c.kind === 'pitch') { onPitch(c); runUntil = t + PITCH_GAP; }
      else if (c.kind === 'pa') { onPA(c); runUntil = t + 3.5; }
      else if (c.kind === 'up') { onUp(c); runUntil = t + 1.0; }
    }
    var runUntil = 0; setInterval(run, 150);

    function feed(st) {
      lastState = st;
      var cues = st.cues || [];
      if (lastCue === null) { lastCue = cues.length ? cues[cues.length - 1].id : 0; }   // opened on a game in progress: what happened is not replayed
      var fresh = cues.filter(function (c) { return c.id > lastCue; });
      if (fresh.length) lastCue = fresh[fresh.length - 1].id;
      if (queue.length + fresh.length > 12) queue = [];             // too far behind: keep the latest, drop the rest
      queue = queue.concat(fresh.slice(-12));
      setBed(bedFor(arousal(st)));
      if (st.status === 'Final' && !finalDone && lastCue !== null && fresh.length) {
        finalDone = true; var homeWon = (st.score || [0, 0])[1] > (st.score || [0, 0])[0];
        if (homeWon) { play('ovation', VOL.crowd, 4.5); play('organ_win', VOL.organ, 6); } else play('letdown', VOL.crowd * 0.8, 4.5);
      }
    }
    function mute(what) {
      muted[what] = !muted[what];
      if (what === 'park' && muted.park && bed.el) { bed.el.pause(); bed = { name: null, el: null }; }
      if (what === 'park' && !muted.park && lastState) setBed(bedFor(arousal(lastState)));
      return muted[what];
    }
    return { feed: feed, mute: mute, status: function () { return { voices: srvUp, bed: bed.name, queue: queue.length, muted: muted }; } };
  }
  return { create: create };
})();
