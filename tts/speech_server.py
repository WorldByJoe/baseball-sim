#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# speech_server.py · v0.1 · 2026-10-02
# The announcers' voices for baseball.html, rendered on the Pi ahead of the
# picture. The page writes the whole broadcast at load (bb_call.js) and posts
# its voice lines here; this server renders them in time order into a cache,
# staying ahead of the game, and the page plays each one on its moment. A
# line whose moment has passed is skipped, never queued: the page would not
# play it late anyway.
#
# Standard library only, plus the speech engines and numpy (which Piper's
# onnxruntime already brings). Listens on 127.0.0.1 only; every answer, the
# OPTIONS preflight included, carries Access-Control-Allow-Origin: * so the
# page can fetch it from file:// (the wall's ratings_server.py is the pattern).
#
#   POST /script   {seed, version, lines: [{id, t, role, text, pace, energy, maxDur}]}
#   POST /cursor   {t, speed}         where the game is now (after a seek: re-prioritise)
#   GET  /status   voices per role, lines rendered, how far ahead, each line's real length
#   GET  /voice/<id>                  one rendered line (WAV)
#
# Energy (calm, building, excited, peak, deflated) becomes, for Piper, pauses,
# variability, a pitch lift and a little gain (energy.json); the pa role gets
# a ballpark-speaker tone and a short echo. Voices per role: voices.json.
#
# usage: speech_server.py [--port 8898] [--voices DIR] [--kokoro DIR] [--cache DIR]
#        speech_server.py --dry-run SCRIPT.json OUTDIR   render a whole script, report speeds
#
# CHANGED
#   v0.1  first version
# ---------------------------------------------------------------------------
import json, os, re, sys, threading, time, wave, argparse, shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ENERGY = {k: v for k, v in json.load(open(os.path.join(HERE, 'energy.json'))).items() if not k.startswith('_')}
VOICES = {k: v for k, v in json.load(open(os.path.join(HERE, 'voices.json'))).items() if not k.startswith('_')}
LEAD_S = 1.0          # a line is rendered only if its moment is at least this far ahead of the game
FIT_MIN = 0.85        # a line too long for its air may be sped up to this share of its pace, no more


# ---------------------------------------------------------------- the engines
class Engines:
    """Loads each voice once, on first use. 'piper:NAME' or 'kokoro:NAME'."""
    def __init__(self, voice_dir, kokoro_dir):
        self.voice_dir, self.kokoro_dir, self.loaded, self.lock = voice_dir, kokoro_dir, {}, threading.Lock()

    def get(self, spec):
        with self.lock:
            if spec not in self.loaded:
                kind, name = spec.split(':', 1)
                if kind == 'piper':
                    from piper import PiperVoice
                    v = PiperVoice.load(os.path.join(self.voice_dir, name + '.onnx'))
                    self.loaded[spec] = ('piper', v, v.config.sample_rate)
                else:
                    from kokoro_onnx import Kokoro
                    # the full model: on this x86 machine the int8 one rendered four times slower (2026-10-02); try both on the Pi
                    model = os.path.join(self.kokoro_dir, 'kokoro-v1.0.onnx')
                    if not os.path.exists(model): model = os.path.join(self.kokoro_dir, 'kokoro-v1.0.int8.onnx')
                    k = self.loaded.get('_kokoro') or Kokoro(model, os.path.join(self.kokoro_dir, 'voices-v1.0.bin'))
                    self.loaded['_kokoro'] = k
                    self.loaded[spec] = ('kokoro', (k, name), 24000)
            return self.loaded[spec]


def sentences(text):
    return [s for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s]


def synth(engines, spec, text, pace, energy):
    """Mono float32 samples and their rate for one line at this pace and energy."""
    E = ENERGY.get(energy, ENERGY['calm'])
    kind, v, sr = engines.get(spec)
    lift = E['lift']
    gap = np.zeros(int(sr * E['gap']), np.float32)
    parts = []
    if kind == 'piper':
        from piper import SynthesisConfig
        cfg = SynthesisConfig(length_scale=pace * lift, noise_scale=E['noise'], noise_w_scale=E['noise_w'])
        for chunk in v.synthesize(text, cfg):   # one chunk per sentence
            parts += [chunk.audio_int16_array.astype(np.float32) / 32768.0, gap]
    else:
        k, name = v
        for s in sentences(text):
            a, _ = k.create(s, voice=name, speed=1.0 / (pace * lift), lang='en-us')
            parts += [np.asarray(a, np.float32), gap]
    x = np.concatenate(parts[:-1]) if parts else np.zeros(1, np.float32)
    if abs(lift - 1) > 1e-3:   # resample up by the lift: the pitch rises, the length returns to the pace asked for
        n = int(len(x) / lift)
        x = np.interp(np.arange(n) * lift, np.arange(len(x)), x).astype(np.float32)
    return x * (10 ** (E['gain_db'] / 20)), sr


def ballpark(x, sr):
    """The public-address sound: a horn speaker's narrow band and a short echo off the stands."""
    n = len(x) + int(0.9 * sr)
    X = np.fft.rfft(np.concatenate([x, np.zeros(n - len(x), np.float32)]))
    f = np.fft.rfftfreq(n, 1 / sr)
    band = 1 / np.sqrt(1 + (300 / np.maximum(f, 1)) ** 4) / np.sqrt(1 + (f / 4200) ** 4)
    y = np.fft.irfft(X * band, n).astype(np.float32)
    out = y.copy()
    for d, g in ((0.11, 0.38), (0.23, 0.22), (0.37, 0.12), (0.55, 0.06)):
        k = int(d * sr); out[k:] += g * y[:n - k]
    return out


def finish(x, sr, role):
    if role == 'pa': x = ballpark(x, sr)
    peak = float(np.max(np.abs(x))) or 1.0
    if peak > 0.98: x = x * (0.98 / peak)
    f = min(len(x) // 4, int(0.01 * sr))   # 10 ms fades: no click at either end
    if f > 0:
        x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x


def write_wav(path, x, sr):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


def render_line(engines, line, path, natural=None):
    """Render one line to path; speed it up a little if it outruns its air. Returns (seconds, seconds to render, fit)."""
    spec = VOICES.get(line['role'], VOICES['pbp'])
    t0 = time.time()
    x, sr = synth(engines, spec, line['text'], line['pace'], line['energy'])
    dur = len(x) / sr + (0.6 if line['role'] == 'pa' else 0)
    if natural is not None: natural.append(dur)   # its length at the pace asked for
    fit = 'ok'
    air = line.get('maxDur') or 99
    if dur > air:
        pace = line['pace'] * max(FIT_MIN, air / dur * 0.97)
        x, sr = synth(engines, spec, line['text'], pace, line['energy'])
        dur = len(x) / sr + (0.6 if line['role'] == 'pa' else 0)
        fit = 'sped' if dur <= air else 'too_long'
    x = finish(x, sr, line['role'])
    write_wav(path, x, sr)
    return len(x) / sr, time.time() - t0, fit


def safe_name(lid):
    return re.sub(r'[^A-Za-z0-9._-]', '_', lid)


# ---------------------------------------------------------------- the queue
class Broadcast:
    def __init__(self, engines, cache):
        self.engines, self.cache = engines, cache
        self.lock = threading.Condition()
        self.lines, self.key, self.done, self.skipped = [], None, {}, set()
        self.cursor, self.cursor_at, self.speed = 0.0, time.time(), 0.0   # still until a page says where its game is
        threading.Thread(target=self.worker, daemon=True).start()

    def now(self):   # where the game is, extrapolated from the last cursor
        return self.cursor + (time.time() - self.cursor_at) * self.speed

    def set_script(self, body):
        with self.lock:
            key = '%s-%s' % (body.get('seed'), body.get('version'))
            if key != self.key:
                self.key, self.done, self.skipped = key, {}, set()
                d = os.path.join(self.cache, safe_name(key)); os.makedirs(d, exist_ok=True)
                # this game's cache survives a reload; other games' are cleared
                for old in os.listdir(self.cache):
                    if old != safe_name(key): shutil.rmtree(os.path.join(self.cache, old), ignore_errors=True)
                meta = os.path.join(d, 'done.json')
                if os.path.exists(meta): self.done = json.load(open(meta))
            self.lines = sorted(body.get('lines', []), key=lambda l: l['t'])
            self.lock.notify_all()

    def set_cursor(self, body):
        with self.lock:
            t = float(body.get('t', 0))
            if t < self.now() - 1: self.skipped = set()   # a seek back: what was skipped may be ahead again
            self.cursor, self.cursor_at = t, time.time()
            self.speed = float(body.get('speed', 1)) if body.get('playing', True) else 0.0
            self.lock.notify_all()

    def next_line(self):
        now = self.now()
        for l in self.lines:
            if l['id'] in self.done or l['id'] in self.skipped: continue
            if l['t'] < now + LEAD_S:
                self.skipped.add(l['id']); continue   # its moment has passed: skipped, never queued
            return l
        return None

    def worker(self):
        while True:
            with self.lock:
                l = self.next_line()
                while l is None:
                    self.lock.wait(1.0); l = self.next_line()
                key = self.key
            path = os.path.join(self.cache, safe_name(key), safe_name(l['id']) + '.wav')
            try:
                dur, took, fit = render_line(self.engines, l, path)
            except Exception as e:   # one bad line must not stop the rest
                print('render failed', l['id'], e, file=sys.stderr); dur, took, fit = 0, 0, 'failed'
            with self.lock:
                if key == self.key:
                    self.done[l['id']] = {'dur': round(dur, 2), 'took': round(took, 2), 'fit': fit}
                    if len(self.done) % 10 == 0:
                        json.dump(self.done, open(os.path.join(self.cache, safe_name(key), 'done.json'), 'w'))

    def status(self):
        with self.lock:
            now = self.now(); ahead = now
            for l in self.lines:   # rendered without a gap from the game's moment to here
                if l['t'] < now: continue
                if l['id'] in self.done: ahead = l['t']
                else: break
            return {'voices': VOICES, 'script': self.key, 'lines': len(self.lines), 'rendered': len(self.done), 'skipped': len(self.skipped),
                    'now': round(now, 1), 'ahead': round(ahead - now, 1),
                    'ready': {k: v['dur'] for k, v in self.done.items() if v['fit'] in ('ok', 'sped')}}

    def path_of(self, lid):
        p = os.path.join(self.cache, safe_name(self.key or ''), safe_name(lid) + '.wav')
        return p if lid in self.done and os.path.exists(p) else None


def make_handler(bc):
    class H(BaseHTTPRequestHandler):
        def cors(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')

        def reply(self, code, body, ctype='application/json'):
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            self.send_response(code); self.cors()
            self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(data)

        def do_OPTIONS(self):
            self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()

        def do_GET(self):
            if self.path.startswith('/status'): return self.reply(200, bc.status())
            if self.path.startswith('/voice/'):
                p = bc.path_of(self.path[7:].split('?')[0])
                if not p: return self.reply(404, {'error': 'not ready'})
                return self.reply(200, open(p, 'rb').read(), 'audio/wav')
            self.reply(404, {'error': 'unknown'})

        def do_POST(self):
            try:
                body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
            except ValueError:
                return self.reply(400, {'error': 'bad json'})
            if self.path.startswith('/script'): bc.set_script(body); return self.reply(200, {'ok': True, 'lines': len(bc.lines)})
            if self.path.startswith('/cursor'): bc.set_cursor(body); return self.reply(200, {'ok': True})
            self.reply(404, {'error': 'unknown'})

        def log_message(self, *a): pass
    return H


# ---------------------------------------------------------------- dry run
def words_of(text): return len([w for w in re.split(r'[\s\-]+', text) if re.search(r'[A-Za-z0-9]', w)])
def sentences_of(text): return max(1, len(re.findall(r'[.!?]+(\s|$)', text)))


def dry_run(engines, script_path, out):
    """Render a whole game's script to a folder, as fast as it goes. Reports the render speed and
    measures the timing table bb_call.js needs: per role a lead-in (s) and, per energy, seconds per
    word at that role's pace, fitted to each line's length at the pace asked for (sentence pauses
    and the PA's echo tail taken out), and the margin that 90% of lines fall within."""
    body = json.load(open(script_path))
    os.makedirs(out, exist_ok=True)
    rows = []
    for spec in set(VOICES.values()): engines.get(spec)   # load first, so the timings are of rendering only
    t_all = time.time()
    for l in body['lines']:
        nat = []
        dur, took, fit = render_line(engines, l, os.path.join(out, safe_name(l['id']) + '.wav'), nat)
        rows.append({'id': l['id'], 't': l['t'], 'role': l['role'], 'energy': l['energy'], 'pace': l['pace'], 'words': words_of(l['text']),
                     'sents': sentences_of(l['text']), 'natural': round(nat[0], 3), 'dur': round(dur, 2), 'maxDur': l.get('maxDur'), 'took': round(took, 3), 'fit': fit})
    json.dump(rows, open(os.path.join(out, 'rendered.json'), 'w'), indent=0)
    wall = time.time() - t_all
    total = sum(r['dur'] for r in rows)
    print('voices: %s' % VOICES)
    print('%d lines, %.0f s of speech rendered in %.0f s: real-time factor %.2f' % (len(rows), total, wall, wall / max(total, 1)))
    fits = {}
    for r in rows: fits[r['fit']] = fits.get(r['fit'], 0) + 1
    print('fit to their air: %s' % fits)
    table = {}
    for role in sorted(set(r['role'] for r in rows)):
        R = [r for r in rows if r['role'] == role]
        ens = sorted(set(r['energy'] for r in R))
        # least squares: length = lead + sum over energies of spw[energy] * words
        X = np.array([[1.0] + [r['words'] if r['energy'] == e else 0 for e in ens] for r in R])
        y = np.array([r['natural'] - (r['sents'] - 1) * ENERGY[r['energy']]['gap'] - (0.6 if role == 'pa' else 0) for r in R])
        c = np.linalg.lstsq(X, y, rcond=None)[0]
        res = y - X @ c
        table[role] = {'lead': round(float(c[0]), 2), 'margin': round(float(np.percentile(res, 90)), 2),
                       'spw': {e: round(float(c[k + 1]), 3) for k, e in enumerate(ens)},
                       'rtf': round(sum(r['took'] for r in R) / max(sum(r['natural'] for r in R), 1), 3), 'lines': len(R)}
        print('%-7s %4d lines  lead %.2f s  margin(p90) %.2f s  real-time factor %.2f  s/word: %s' % (role, len(R), c[0], table[role]['margin'], table[role]['rtf'],
              '  '.join('%s %.3f (pace %s)' % (e, table[role]['spw'][e], sorted(set(r['pace'] for r in R if r['energy'] == e))) for e in ens)))
    json.dump(table, open(os.path.join(out, 'timing.json'), 'w'), indent=1)
    print('timing table for bb_call.js written to %s' % os.path.join(out, 'timing.json'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8898)
    ap.add_argument('--voices', default=os.path.expanduser('~/piper/voices'))
    ap.add_argument('--kokoro', default=os.path.expanduser('~/piper/kokoro'))
    ap.add_argument('--cache', default=os.path.expanduser('~/piper/speech_cache'))
    ap.add_argument('--dry-run', nargs=2, metavar=('SCRIPT', 'OUTDIR'))
    a = ap.parse_args()
    engines = Engines(a.voices, a.kokoro)
    if a.dry_run: return dry_run(engines, *a.dry_run)
    os.makedirs(a.cache, exist_ok=True)
    bc = Broadcast(engines, a.cache)
    for spec in set(VOICES.values()):   # load the voices now, not on the first line
        try: engines.get(spec)
        except Exception as e: print('could not load', spec, e, file=sys.stderr)
    srv = ThreadingHTTPServer(('127.0.0.1', a.port), make_handler(bc))
    print('speech server on 127.0.0.1:%d, voices %s' % (a.port, VOICES))
    srv.serve_forever()


if __name__ == '__main__':
    main()
