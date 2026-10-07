#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# render_samples.py · v0.1 · 2026-10-02
# Renders the same five short lines with every candidate voice, at the pace
# and energy the broadcast would use for each, so the voices can be judged by
# ear: a colour line, a tension line, an action call, a home-run call and a
# public-address announcement. Each line goes through speech_server.py's own
# synthesis (energy mapping, pitch lift, the PA's ballpark echo), then to a
# small mono MP3 with ffmpeg. Prints each voice's render speed on this machine.
#
# usage: render_samples.py OUTDIR [--voices DIR] [--kokoro DIR] [--only SPEC,...]
#
# CHANGED
#   v0.1  first version
# ---------------------------------------------------------------------------
import argparse, json, os, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import speech_server as S

# (file tag, role, energy, pace, text) - paces as bb_call.js asks for them
LINES = [
    ('colour', 'colour', 'calm', 1.30, 'Kendrick can run: twenty-nine feet a second, faster than nine players in ten.'),
    ('tension', 'pbp', 'building', 1.00, 'Two and two. He comes set.'),
    ('action', 'pbp', 'excited', 0.92, 'Line drive to right-center! Into the gap! Quinlan is into second with a double.'),
    ('homerun', 'pbp', 'peak', 0.88, 'Swung on, a high drive to deep left... Get out of here! Gone!'),
    ('pa', 'pa', 'calm', 1.25, 'Now batting for the Comets, the catcher, Darwin Rodríguez.'),
]
PIPER = ['en_US-ryan-high', 'en_US-ryan-medium', 'en_US-lessac-high', 'en_US-lessac-medium', 'en_US-joe-medium', 'en_US-john-medium',
         'en_US-norman-medium', 'en_US-bryce-medium', 'en_US-hfc_male-medium', 'en_US-kusal-medium', 'en_US-sam-medium', 'en_US-danny-low',
         'en_US-amy-medium', 'en_US-kristin-medium', 'en_US-ljspeech-high', 'en_US-hfc_female-medium', 'en_GB-alan-medium',
         'en_GB-northern_english_male-medium', 'en_GB-cori-high']
KOKORO = ['am_michael', 'am_adam', 'am_eric', 'am_fenrir', 'am_liam', 'am_onyx', 'am_puck', 'am_echo', 'bm_george', 'bm_fable', 'bm_lewis',
          'af_heart', 'af_bella', 'af_nicole']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--voices', default=os.path.expanduser('~/piper/voices'))
    ap.add_argument('--kokoro', default=os.path.expanduser('~/piper/kokoro'))
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    eng = S.Engines(a.voices, a.kokoro)
    specs = ['piper:' + v for v in PIPER] + ['kokoro:' + v for v in KOKORO]
    if a.only: specs = a.only.split(',')
    speeds = {}
    for spec in specs:
        try: eng.get(spec)
        except Exception as e: print('skip', spec, e); continue
        audio = took = 0.0
        for tag, role, energy, pace, text in LINES:
            t0 = time.time()
            x, sr = S.synth(eng, spec, text, pace, energy)
            took += time.time() - t0; audio += len(x) / sr
            x = S.finish(x, sr, role)
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp: S.write_wav(tmp.name, x, sr)
            out = os.path.join(a.out, '%s_%s.mp3' % (spec.split(':')[1], tag))
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp.name, '-ac', '1', '-b:a', '40k', out], check=True)
            os.unlink(tmp.name)
        speeds[spec] = round(took / audio, 3)
        print('%-45s real-time factor %.3f' % (spec, took / audio))
    json.dump(speeds, open(os.path.join(a.out, 'speeds.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
