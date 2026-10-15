"""
pitcher_sd.py · v0.1 · 2026-10-14

The uncertainty of each pitcher's point fit (review/fit_pitchers.js: deception for his strikeouts, the command scale for
his walks), which the replays had used as exact (the model review, 2026-10-14). His target log-odds carry his measured
standard errors (playoffs/players_measured.json, pooled, as season/view.py shrank them) and the fit's own simulation noise
(its last bisection step, 1,500 plate appearances); they map to log deception and log command scale through the engine's
slopes (review/pitcher_slopes.js, four seeds of eight pitchers x 3,000 PA):
    logit K  = 1.61 log dec - 0.75 log cmd,    logit BB = 0.19 log dec + 3.44 log cmd
Writes sdLogDec, sdLogCmd and their correlation into review/pitchers_fit.json; players.js draws from them when a
replay asks (REVIEW.PDRAW, replay_game mode 'pdraw').

  python3 review/pitcher_sd.py        (in a worktree)
"""
import json, math
import numpy as np
J = np.array([[1.61, -0.75], [0.19, 3.44]]); Ji = np.linalg.inv(J); NSIM = 1500
F = json.load(open('review/pitchers_fit.json')); M = json.load(open('playoffs/players_measured.json'))
R = {str(r['id']): r for r in (M['players'] if isinstance(M, dict) else M)}
n = 0; sds = []
for pid, f in F['pitchers'].items():
    S = ((R.get(pid) or {}).get('summaries') or {}).get('pitching') or {}
    var = []
    for k, key in (('K', 'K_pct'), ('BB', 'BB_pct')):
        o = (S.get(key) or {}).get('pooled') or {}; p = o.get('mean'); se = o.get('se')
        if p is None or not se: var = None; break
        p = min(max(p, 0.01), 0.6); var.append((se / (p * (1 - p))) ** 2 + 1 / (NSIM * p * (1 - p)))
    if not var: continue
    C = Ji @ np.diag(var) @ Ji.T
    f['sdLogDec'] = round(float(math.sqrt(C[0, 0])), 4); f['sdLogCmd'] = round(float(math.sqrt(C[1, 1])), 4); f['rhoDecCmd'] = round(float(C[0, 1] / math.sqrt(C[0, 0] * C[1, 1])), 3)
    n += 1; sds.append((f['sdLogDec'], f['sdLogCmd']))
json.dump(F, open('review/pitchers_fit.json', 'w'), indent=1)
s = np.array(sds); print('pitcher uncertainty for %d pitchers: sd log deception median %.3f, sd log command median %.3f' % (n, np.median(s[:, 0]), np.median(s[:, 1])))
