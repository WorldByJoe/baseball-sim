"""october_compare.py · v0.1 · 2026-10-15: each past October's games under the replays that were run (hist<S>, the live
engine's settings) and under run 7's (hist<S>r7), on the same games: favourite won, Brier net of replay noise, log loss,
calibration, and the paired Brier difference by bootstrap; per year and pooled. Both 'season' and 'pitched' settings."""
import json, os, numpy as np
R = os.path.expanduser('~/bsim-wt/review')
def share(f):
    if not os.path.exists(f): return None
    L = [json.loads(l) for l in open(f) if l.startswith('{')]
    return (sum(r['score'][1] > r['score'][0] for r in L) / len(L), len(L)) if len(L) >= 100 else None
rng = np.random.default_rng(3)
for setting, sub in (('season', 'replays'), ('pitched', 'replays_pitched')):
    pool = {'old': [], 'r7': [], 'y': [], 'nold': [], 'nr7': []}
    for S in (2024, 2025, 2026):
        games = json.load(open('%s/history/participants_%d.json' % (R, S)))['games']
        for g in games:
            pk = g['pk']; G = os.path.expanduser('~/bsim-wt/hist%d/review/games/%d.json' % (S, pk))
            if not os.path.exists(G): continue
            F = json.load(open(G))['final']
            a = share(os.path.expanduser('~/bsim-wt/hist%d/diag_out/%s/%d.jsonl' % (S, sub, pk))); b = share(os.path.expanduser('~/bsim-wt/hist%dr7/diag_out/%s/%d.jsonl' % (S, sub, pk)))
            if not a or not b: continue
            pool['old'].append(a[0]); pool['nold'].append(a[1]); pool['r7'].append(b[0]); pool['nr7'].append(b[1]); pool['y'].append(int(F['home'] > F['away'])); pool.setdefault('S', []).append(S)
    if not pool['y']: print(setting, 'no games yet'); continue
    y = np.array(pool['y']); Sy = np.array(pool['S'])
    for lab in ['all'] + sorted(set(Sy)):
        m = (Sy == lab) if lab != 'all' else np.ones(len(y), bool)
        out = []
        for k, nk in (('old', 'nold'), ('r7', 'nr7')):
            p = np.array(pool[k])[m]; n = np.array(pool[nk], float)[m]; yy = y[m]
            b = (p - yy) ** 2 - p * (1 - p) / n; ll = -np.mean(yy * np.log(np.clip(p, .01, .99)) + (1 - yy) * np.log(np.clip(1 - p, .01, .99)))
            out.append((b, ((p > .5) == (yy == 1)).mean(), ll))
        d = out[1][0] - out[0][0]; bs = [d[rng.integers(0, len(d), len(d))].mean() for _ in range(2000)]
        print('%-8s %-4s n %3d | favourite won old %.3f r7 %.3f | Brier net old %.4f r7 %.4f (coin 0.2500) | log loss old %.4f r7 %.4f | r7 minus old %+.4f (se %.4f)'
              % (setting, lab, m.sum(), out[0][1], out[1][1], out[0][0].mean(), out[1][0].mean(), out[0][2], out[1][2], d.mean(), np.std(bs)))
