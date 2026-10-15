"""fix_score.py · v0.1 · 2026-10-14: the pitcher-cache fix (replay_game v1.2) on fold A's games: game-level Brier (net of
replay noise), de-attenuated calibration and the spread of shares, for run 6, run 7 and run 7 with the fix, paired."""
import json, os, glob, sys
import numpy as np, statsmodels.api as sm
S = {g['pk']: g for g in json.load(open(os.path.expanduser('~/bsim-wt/review/season/schedule.json')))}
D = {'run6': '~/bsim-wt/hist26A6/diag_out/replays', 'run7': '~/bsim-wt/hist26A7/diag_out/replays', 'run7fix': '~/bsim-wt/hist26A7/diag_out/replays_fix', 'plain': '~/bsim-wt/hist26A7/diag_out/abl_plain', 'fieldonly': '~/bsim-wt/hist26A7/diag_out/abl_fieldonly', 'run6newfield': '~/bsim-wt/hist26A6/diag_out/abl_newfield', 'run7oldfield': '~/bsim-wt/hist26A7/diag_out/abl_oldfield', 'run75': '~/bsim-wt/hist26A7/diag_out/replays_75', 'bugfix': '~/bsim-wt/hist26A7/diag_out/abl_bugfix', 'bugfix06': '~/bsim-wt/hist26A7/diag_out/abl_bugfix06', 'v118_06': '~/bsim-wt/hist26A7/diag_out/abl_v118_06'}
P = {}
for k, d in D.items():
    for f in glob.glob(os.path.expanduser(d) + '/*.jsonl'):
        R = [json.loads(l) for l in open(f) if l.startswith('{')]
        if len(R) >= 50: P.setdefault(int(os.path.basename(f)[:-6]), {})[k] = (sum(r['score'][1] > r['score'][0] for r in R) / len(R), len(R))
pks = [pk for pk, v in P.items() if len(v) == len(D) and pk in S]
y = np.array([int(S[pk]['final'][1] > S[pk]['final'][0]) for pk in pks])
out = {}
for k in D:
    p = np.array([P[pk][k][0] for pk in pks]); n = np.array([P[pk][k][1] for pk in pks], float)
    b = (p - y) ** 2 - p * (1 - p) / n
    lp = np.log(np.clip(p, .01, .99) / (1 - np.clip(p, .01, .99))); lv = 1 / (np.clip(p, .02, .98) * (1 - np.clip(p, .02, .98)) * n); lam = max(lp.var() - lv.mean(), 1e-9) / lp.var()
    m = sm.Logit(y, sm.add_constant(lp)).fit(disp=0)
    out[k] = b; print('%-8s games %d  Brier net %.4f  favourite won %.3f  share sd %.3f  calibration %.2f (de-attenuated %.2f)' % (k, len(pks), b.mean(), ((p > .5) == (y == 1)).mean(), p.std(), m.params[1], m.params[1] / lam))
rng = np.random.default_rng(1)
for a, c in (('run7fix', 'run7'), ('run7fix', 'run6'), ('run7', 'run6'), ('plain', 'run6'), ('fieldonly', 'plain'), ('run7fix', 'fieldonly'), ('run6newfield', 'run6'), ('run7oldfield', 'plain'), ('run7oldfield', 'run6'), ('run75', 'run6'), ('bugfix', 'run6'), ('bugfix', 'run75'), ('bugfix06', 'run75'), ('v118_06', 'run75'), ('bugfix06', 'bugfix'), ('v118_06', 'run7fix')):
    d = out[a] - out[c]; bs = [d[rng.integers(0, len(d), len(d))].mean() for _ in range(2000)]
    print('%s minus %s: %+.5f (se %.5f)' % (a, c, d.mean(), np.std(bs)))
