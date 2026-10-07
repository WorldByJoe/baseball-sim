/* ============================================================================
   bb_organ.js · v0.1 · 2026-10-02

   The ballpark organ, played by the page itself with Web Audio: no sound
   files, no licence, every riff a note list that can be tuned by hand.

   The sound is a tonewheel organ. Each key is one oscillator whose wave is
   built from drawbar harmonics (the sub-octave, the fundamental, the fifth,
   the octaves above - the numbers of a registration like 88 8000 000), with a
   short percussive second-harmonic ping on the attack and a soft key click.
   Everything then passes through a rotating-speaker wobble: a delay swept
   by a slow oscillator (the pitch shimmer) and a gain swept by a second one
   a little out of step (the tremolo).

   The cues (sounds/SOUNDS.md, the organ table): organ_charge (the "Charge!"
   bugle call, traditional), organ_lets_go (the "Let's go" riff), eight
   short original fillers (organ_filler), organ_take_field, organ_stretch
   ("Take Me Out to the Ball Game", Albert Von Tilzer 1908, public domain;
   its melody written down here from memory - worth checking by ear),
   organ_hr and organ_win (original). Only public-domain or original tunes.

   Usage: var org = BBOrgan.create(audioContext, destinationNode);
          org.play('organ_charge', { when: ctx.currentTime, pick: 3 }) -> seconds long
          org.stop()   silences whatever is sounding

   CHANGED
     v0.1  first build
============================================================================ */

var BBOrgan = (function () {
  'use strict';

  // ------------------------------------------------------------------ tunes
  // A tune is a tempo (beats a minute), a registration, and a line of notes:
  // 'C5/2' is C in the fifth octave for two beats, 'r/1' a beat's rest,
  // 'C4+E4+G4/2' a chord. Two lines (melody and chords) play together.
  var REG_FULL = [8, 8, 8, 0, 0, 0, 0, 0, 0], REG_BRIGHT = [8, 8, 8, 8, 0, 0, 6, 0, 8], REG_SOFT = [0, 8, 6, 4, 0, 0, 0, 0, 0], REG_JAZZ = [8, 8, 8, 6, 0, 0, 0, 0, 0];
  var TUNES = {
    // the traditional bugle call: sol-do-mi-sol, mi-sol
    organ_charge: [{ bpm: 150, reg: REG_BRIGHT, lines: ['G4/0.67 C5/0.67 E5/0.67 G5/1.33 E5/0.67 G5/3'] }],
    // the call and its answer: "Let's go," then the crowd claps two and three
    organ_lets_go: [{ bpm: 132, reg: REG_JAZZ, lines: ['C5+E5+G5/1 r/0.2 D5+F5+A5/1 r/0.8 C5+E5+G5/0.5 r/0.5 C5+E5+G5/0.5 r/0.5 C5+E5+A5/0.5 r/0.5 C5+E5+A5/0.5 r/0.5 C5+F5+A5/1.5'] }],
    organ_take_field: [{ bpm: 140, reg: REG_BRIGHT, lines: ['C5/0.5 E5/0.5 G5/0.5 C6/1.5 B5/0.5 G5/0.5 A5/1 F5/0.5 A5/0.5 G5/2 E5/0.5 G5/0.5 C6/3', 'C3+G3/2 C3+G3/2 F3+A3/2 G3+B3/2 C3+G3/4'] }],
    organ_hr: [{ bpm: 168, reg: REG_BRIGHT, lines: ['C5/0.25 E5/0.25 G5/0.25 C6/0.25 E6/0.25 G6/0.25 C7/1.5 r/0.25 G6/0.25 A6/0.25 G6/0.25 E6/0.25 G6/0.25 C7+E6+G6/3', 'C3/2 r/1 C3+G3/1 C3+E3+G3/4'] }],
    organ_win: [{ bpm: 120, reg: REG_JAZZ, lines: ['G4/1 C5/1 E5/1 G5/2 E5/1 G5/2 A5/1 G5/1 F5/1 E5/1 D5/2 r/1 E5/1 F5/1 G5/1 A5/2 B5/1 C6/4',
                                                    'C3+E3/4 C3+G3/4 F3+A3/4 G3+B3/4 F3+A3/2 G3+B3/2 C3+E3+G3/4'] }],
    // "Take Me Out to the Ball Game" (1908), the chorus in 3/4
    organ_stretch: [{ bpm: 168, reg: REG_JAZZ, lines: [
      'C5/2 C6/1 A5/1 G5/1 E5/1 G5/3 D5/3 C5/2 C6/1 A5/1 G5/1 E5/1 G5/6 ' +
      'A5/1 G#5/1 A5/1 E5/1 F5/1 G5/1 A5/2 F5/1 D5/3 A5/2 A5/1 A5/1 B5/1 C6/1 D6/1 B5/1 A5/1 G5/1 E5/1 D5/1 ' +
      'C5/2 C6/1 A5/1 G5/1 E5/1 G5/3 D5/3 C5/2 D5/1 E5/1 F5/1 G5/1 A5/3 r/1 A5/1 B5/1 C6/3 C6/3 C6/1 B5/1 A5/1 G5/1 F#5/1 G5/1 A5/3 B5/3 C6/6',
      'C3+E3+G3/3 C3+E3+G3/3 C3+E3+G3/3 G2+B2+F3/3 C3+E3+G3/3 C3+E3+G3/3 C3+E3+G3/6 ' +
      'F3+A3+C4/3 F3+A3+C4/3 F3+A3+C4/3 D3+F3+A3/3 D3+F#3+A3/3 D3+F#3+A3/3 G2+B2+D3/3 G2+B2+F3/3 ' +
      'C3+E3+G3/3 C3+E3+G3/3 C3+E3+G3/3 G2+B2+F3/3 C3+E3+G3/3 C3+E3+G3/3 F3+A3+C4/3 F3+A3+C4/3 C3+E3+G3/3 A2+C#3+E3/3 D3+F3+A3/3 G2+B2+F3/3 C3+E3+G3/6'] }],
    // eight short original fillers
    organ_filler: [
      { bpm: 132, reg: REG_JAZZ, lines: ['E5/0.5 G5/0.5 A5/1 G5/0.5 E5/0.5 D5/1 C5/0.5 D5/0.5 E5/2', 'C3+G3/2 F3+A3/2 C3+G3/2'] },
      { bpm: 120, reg: REG_FULL, lines: ['C5/0.5 C5/0.5 G5/1 G5/0.5 A5/0.5 G5/1 F5/0.5 E5/0.5 D5/0.5 E5/0.5 C5/2', 'C3+E3/2 C3+E3/2 G2+F3/2 C3+E3/2'] },
      { bpm: 150, reg: REG_BRIGHT, lines: ['G5/0.5 F#5/0.5 G5/0.5 A5/0.5 B5/1 G5/1 E5/0.5 D5/0.5 E5/0.5 G5/0.5 C6/2', 'C3/1 G3/1 C3/1 G3/1 A2/1 E3/1 F3/1 G3/1'] },
      { bpm: 110, reg: REG_SOFT, lines: ['A4/1 C5/1 E5/1 D5/0.5 C5/0.5 B4/1 G4/1 A4/2', 'A2+E3/2 E2+B2/2 A2+E3/2'] },
      { bpm: 140, reg: REG_JAZZ, lines: ['D5/0.5 E5/0.5 F#5/0.5 A5/0.5 B5/1 A5/1 F#5/0.5 E5/0.5 D5/2', 'D3+A3/2 G3+B3/2 D3+A3/2'] },
      { bpm: 126, reg: REG_FULL, lines: ['C5/0.33 E5/0.33 G5/0.33 C6/1 G5/0.33 E5/0.33 C5/0.33 D5/1 F5/0.5 A5/0.5 G5/2', 'C3+G3/2 D3+F3/2 G2+F3/1 C3+E3/2'] },
      { bpm: 144, reg: REG_BRIGHT, lines: ['F5/0.5 A5/0.5 C6/0.5 A5/0.5 Bb5/1 G5/1 E5/0.5 G5/0.5 F5/2', 'F3+A3/2 G3+Bb3/2 F3+A3/2'] },
      { bpm: 116, reg: REG_JAZZ, lines: ['G4/0.5 B4/0.5 D5/0.5 G5/1.5 F#5/0.5 E5/0.5 D5/1 B4/0.5 C5/0.5 D5/2', 'G2+D3/2 C3+E3/2 D3+F#3/1 G2+D3/2'] }
    ]
  };

  var NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(name) { var m = /^([A-G][#b]?)(\d)$/.exec(name); return 440 * Math.pow(2, (NOTE[m[1]] + 12 * (+m[2] + 1) - 69) / 12); }
  function parse(line) {   // -> [{ beat, len, f: [Hz...] }]
    var out = [], beat = 0;
    line.trim().split(/\s+/).forEach(function (tok) {
      var p = tok.split('/'), len = +p[1];
      if (p[0] !== 'r') out.push({ beat: beat, len: len, f: p[0].split('+').map(freq) });
      beat += len;
    });
    return { notes: out, beats: beat };
  }

  // ------------------------------------------------------------- the sound
  function create(ctx, dest) {
    var out = ctx.createGain(); out.gain.value = 0.32;
    // the rotating speaker: a swept delay for the shimmer, a swept gain for the tremolo
    var dly = ctx.createDelay(0.05); dly.delayTime.value = 0.004;
    var lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 6.4; lfoG.gain.value = 0.0009; lfo.connect(lfoG); lfoG.connect(dly.delayTime);
    var trem = ctx.createGain(), lfo2 = ctx.createOscillator(), lfo2G = ctx.createGain(); trem.gain.value = 0.85; lfo2.frequency.value = 5.9; lfo2G.gain.value = 0.15; lfo2.connect(lfo2G); lfo2G.connect(trem.gain);
    var bus = ctx.createGain();
    bus.connect(dly); dly.connect(trem); bus.connect(trem); trem.connect(out); out.connect(dest || ctx.destination);
    lfo.start(); lfo2.start();
    // drawbar footages as harmonics of the sub-octave: 16', 8', 5 1/3', 4', 2 2/3', 2', 1 3/5', 1 1/3', 1'
    var HARM = [1, 2, 3, 4, 6, 8, 10, 12, 16], waves = {}, live = [];
    function wave(reg) {
      var key = reg.join('');
      if (waves[key]) return waves[key];
      var re = new Float32Array(17), im = new Float32Array(17);
      reg.forEach(function (d, i) { im[HARM[i]] += d / 8 * Math.pow(10, -3 * (8 - d) / 20); });
      return (waves[key] = ctx.createPeriodicWave(re, im));
    }
    function key(f, t0, dur, reg, vel) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.setPeriodicWave(wave(reg)); o.frequency.value = f / 2;   // the wave's first harmonic is the sub-octave
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vel, t0 + 0.006); g.gain.setValueAtTime(vel, t0 + Math.max(0.01, dur - 0.04)); g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
      // percussion: the second harmonic pings and dies away
      var p = ctx.createOscillator(), pg = ctx.createGain();
      p.frequency.value = f * 2; pg.gain.setValueAtTime(0, t0); pg.gain.linearRampToValueAtTime(vel * 0.35, t0 + 0.004); pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      p.connect(pg); pg.connect(bus); p.start(t0); p.stop(t0 + 0.3);
      live.push({ nodes: [o, p], end: t0 + dur + 0.05 });
    }
    function play(name, o) {
      o = o || {};
      var list = TUNES[name]; if (!list) return 0;
      var tune = list[(o.pick || 0) % list.length], spb = 60 / tune.bpm, t0 = Math.max(ctx.currentTime, o.when || ctx.currentTime) + 0.02, len = 0;
      tune.lines.forEach(function (line, li) {
        var P = parse(line), n = Math.max(1, P.notes.reduce(function (m, q) { return Math.max(m, q.f.length); }, 1));
        P.notes.forEach(function (q) { q.f.forEach(function (f) { key(f, t0 + q.beat * spb, q.len * spb * 0.94, tune.reg, (li ? 0.12 : 0.22) / Math.sqrt(q.f.length)); }); });
        len = Math.max(len, P.beats * spb);
      });
      live = live.filter(function (x) { return x.end > ctx.currentTime; });   // forget the keys that have finished
      return len;
    }
    function stop() { var t = ctx.currentTime; live.forEach(function (x) { x.nodes.forEach(function (n) { try { n.stop(t); } catch (e) { } }); }); live = []; }
    function length(name, pick) {   // how long a cue lasts, in seconds
      var list = TUNES[name]; if (!list) return 0;
      var tune = list[(pick || 0) % list.length];
      return Math.max.apply(null, tune.lines.map(function (l) { return parse(l).beats; })) * 60 / tune.bpm;
    }
    return { play: play, stop: stop, out: out, length: length };
  }

  function variants(name) { return TUNES[name] ? TUNES[name].length : 0; }
  return { version: '0.1', create: create, variants: variants, cues: Object.keys(TUNES) };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBOrgan;
