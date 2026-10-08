"""
fit_mishit.py · v0.1 · 2026-10-08

Each playoff pitcher's MISHIT: his scale on the batter's miss along the barrel (bb_engine's review hook, pitch.mishit),
fitted so the squareness of the contact he allows in the model (review/check_contact.js) stands to the model's league
as his measured squareness (2025-26 Statcast: exit speed over 1.23 bat speed + 0.23 pitch speed, review/weak_contact.py)
stands to the real league (0.834, 42 days of 2025); his measure shrunk toward the league's by his balls in play
(K 160: the split-half reliability, 0.68 at 340 balls). His deception is moved with it so his strikeouts stay where
review/fit_pitchers.js put them (a wider miss along the barrel also misses the bat: 0.47 logit-K per log-unit).
Slopes from runs at mishit x1.35 and deception x1.15 (diag_out/mishit). Writes review/pitchers_fit.json (the
previous one kept as review/pitchers_fit_before_mishit.json).

  python3 review/fit_mishit.py
"""
import json, glob, gzip, csv, os, math, shutil
import numpy as np

REAL_LEAGUE, K_SHRINK, LO, HI = 0.8340, 160, math.log(0.6), math.log(1.8)

def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None

def real_sq(pid):
    v = []
    for yr in ('2025', '2026'):
        p = 'playoffs/pitches/%s_pitcher_%d.csv.gz' % (yr, pid)
        if not os.path.exists(p): continue
        for r in csv.DictReader(gzip.open(p, 'rt')):
            if r.get('game_type') != 'R' or r.get('type') != 'X': continue
            ev, bs, ps = f(r.get('launch_speed')), f(r.get('bat_speed')), f(r.get('release_speed'))
            if ev and bs and bs > 40 and ps: v.append(ev / (1.23 * bs + 0.23 * 0.92 * ps))
    return (float(np.mean(v)), len(v)) if v else (None, 0)

def load(pat): return {m['id']: m for fn in glob.glob(pat) for l in open(fn) if l.startswith('{') for m in [json.loads(l)]}
lg = lambda p: math.log(p / (1 - p))
B, MX, DX = load('diag_out/mishit/base_*.jsonl'), load('diag_out/mishit/mx_*.jsonl'), load('diag_out/mishit/dx_*.jsonl')
C = load('diag_out/contact2/*.jsonl')   # a second base run (2,000 PA each): averaged in, for less noise
L = [json.loads(l) for l in open('diag_out/mishit/league.jsonl') if l.startswith('{')]
MODEL_LEAGUE = float(np.mean([m['sq'] for m in L]))
ids = [i for i in B if i in MX and i in DX]
s_m = np.mean([(MX[i]['sq'] - B[i]['sq']) / math.log(1.35) for i in ids]); k_m = np.mean([(lg(MX[i]['K']) - lg(B[i]['K'])) / math.log(1.35) for i in ids])
s_d = np.mean([(DX[i]['sq'] - B[i]['sq']) / math.log(1.15) for i in ids]); k_d = np.mean([(lg(DX[i]['K']) - lg(B[i]['K'])) / math.log(1.15) for i in ids])
ratio = -k_m / k_d                    # log deception moved per log mishit to hold strikeouts
s_net = s_m + s_d * ratio             # squareness per log mishit, deception following
print('model league squareness %.4f (real %.4f); per log mishit %.4f sq, %.3f logit K; deception follows at %.3f; net %.4f' % (MODEL_LEAGUE, REAL_LEAGUE, s_m, k_m, ratio, s_net))
F = json.load(open('review/pitchers_fit.json'))
if not os.path.exists('review/pitchers_fit_before_mishit.json'): shutil.copy('review/pitchers_fit.json', 'review/pitchers_fit_before_mishit.json')
out = []
for i in ids:
    key = str(i); p = F['pitchers'].get(key)
    if not p: continue
    sq_now = (B[i]['sq'] * B[i]['bip'] + C[i]['sq'] * C[i]['bip']) / (B[i]['bip'] + C[i]['bip']) if i in C else B[i]['sq']
    rs, n = real_sq(i)
    shrunk = REAL_LEAGUE + ((rs - REAL_LEAGUE) * n / (n + K_SHRINK) if rs is not None else 0)
    target = MODEL_LEAGUE + (shrunk - REAL_LEAGUE)
    dm = min(HI, max(LO, (target - sq_now) / s_net))
    p['mishit'] = round(math.exp(dm), 3); p['deception'] = round(p['deception'] * math.exp(ratio * dm), 3)
    p['measuredSq'] = None if rs is None else round(rs, 4); p['nSq'] = n; p['targetSq'] = round(target, 4); p['sqBefore'] = round(sq_now, 4)
    out.append((p['name'], p['team'], n, rs, target, sq_now, p['mishit']))
F['league']['sq'] = {'model': MODEL_LEAGUE, 'real': REAL_LEAGUE, 'shrinkK': K_SHRINK, 'perLogMishit': s_m, 'kPerLogMishit': k_m, 'deceptionFollows': ratio}
json.dump(F, open('review/pitchers_fit.json', 'w'), indent=1)
m = np.array([o[6] for o in out]); print('%d pitchers fitted: mishit %.2f-%.2f (median %.2f); at a bound: %d' % (len(out), m.min(), m.max(), np.median(m), sum((m <= 0.601) | (m >= 1.799))))
for t in ('LAD', 'MIL', 'TB', 'CWS', 'CLE', 'NYY', 'ATL', 'SD'):
    T = [o for o in out if o[1] == t]; print('  %s: mean mishit %.2f, target squareness %.4f (model now %.4f)' % (t, np.mean([o[6] for o in T]), np.mean([o[4] for o in T]), np.mean([o[5] for o in T])))
