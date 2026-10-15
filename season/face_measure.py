"""
face_measure.py · v0.1 · 2026-10-14

A direct measure of each hitter's face scatter (the engine's faceSD, which the hitter fit could not identify: the model
review of 2026-10-14). On his balls in play with bat tracking, the spread of his pulled spray left once his bat's
pulled direction at contact is accounted for (his own least-squares line, residual sd with n - 2): the bat's direction
carries where on the arc he met the ball, the rest of the spray is the face. Per season and pooled (2026 x1.0, 2025
x0.5, as measure_traits.py pools), se = sd / sqrt(2 (n - 2)). Written into the fold's players_measured.json as
traits.sprayResDeg; review/emulate_hitters.js measures the emulated hitters the same way.

  python3 season/face_measure.py season/foldA_7
"""
import json, os, sys, math, glob
import numpy as np, pandas as pd
FOLD = sys.argv[1]; HC_X0, HC_Y0 = 126.0, 205.0; W = {'2026': 1.0, '2025': 0.5}


def one(f):
    try: D = pd.read_csv(f, usecols=['description', 'stand', 'hc_x', 'hc_y', 'attack_direction'], low_memory=False)
    except Exception: return None
    D = D[(D.description == 'hit_into_play')].dropna(subset=['hc_x', 'hc_y', 'attack_direction'])
    if len(D) < 30: return None
    sp = np.degrees(np.arctan2(D.hc_x.values - HC_X0, HC_Y0 - D.hc_y.values)); sp = np.where(D.stand.values == 'R', -sp, sp)
    x = -D.attack_direction.values.astype(float); X = np.column_stack([np.ones(len(x)), x])
    b, *_ = np.linalg.lstsq(X, sp, rcond=None); r = sp - X @ b; n = len(r)
    return {'mean': float(math.sqrt((r ** 2).sum() / (n - 2))), 'n': n, 'slope': float(b[1])}


path = os.path.join(FOLD, 'players_measured.json'); D = json.load(open(path))
P = D['players'] if isinstance(D, dict) else D; P = P if isinstance(P, list) else list(P.values())
done = 0; slopes = []
for r in P:
    if not (r.get('summaries') or {}).get('hitting'): continue
    o = {}
    for y in ('2025', '2026'):
        v = one(os.path.join(FOLD, 'pitches', '%s_batter_%s.csv.gz' % (y, r['id'])))
        if v: v['se'] = v['mean'] / math.sqrt(2 * (v['n'] - 2)); o[y] = {k: round(v[k], 4) for k in ('mean', 'n', 'se')}; slopes.append(v['slope'])
    if not o: continue
    w = {y: W[y] * o[y]['n'] for y in o}; m = sum(w[y] * o[y]['mean'] for y in o) / sum(w.values())
    neff = sum(w.values()) ** 2 / sum(W[y] ** 2 * o[y]['n'] for y in o)
    o['pooled'] = {'mean': round(m, 4), 'n': sum(o[y]['n'] for y in o if y != 'pooled'), 'se': round(m / math.sqrt(2 * max(neff - 2, 1)), 4)}
    r['traits']['sprayResDeg'] = o; done += 1
json.dump(D, open(path, 'w'), indent=None, separators=(',', ':'))
v = [r['traits']['sprayResDeg']['pooled']['mean'] for r in P if 'sprayResDeg' in r.get('traits', {})]
print('%s: %d hitters; spray residual sd median %.1f deg (p10 %.1f, p90 %.1f); own slopes median %.2f' % (FOLD, done, np.median(v), np.percentile(v, 10), np.percentile(v, 90), np.median(slopes)))
