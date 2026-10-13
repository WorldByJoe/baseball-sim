"""
patch_hitters.py · v0.1 · 2026-10-13

Hitting traits for the men in a worktree's games who have none (a pitcher batting after his team lost the DH, in the
half a fold did not fit for: the in-sample replays of run_aaa4.sh): the model's major leaguers' traits, as
history/fit_through.py gives any batter without hitting data (the emulator's population mean and 40 draws from its
spread, his height and weight). Adds them to review/hitters_fit.json; nobody already there changes.

  python3 HIST/../season/patch_hitters.py        (from the worktree's root)

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import glob, json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.getcwd(), 'review'))
import fit_hitters as FH

H = json.load(open('review/hitters_fit.json'))
R = {r['id']: r for r in json.load(open('playoffs/players_measured.json'))['players']}
E = FH.emulator('diag_out/emu.jsonl'); NK = len(FH.KNOWN)
mu, sd = E['mu'][NK:], E['sd'][NK:]; Z = (E['X'] - E['mu']) / E['sd']; C = np.cov(Z.T)[NK:, NK:]
rng = np.random.default_rng(20261013); clip = lambda k, v: min(max(v, FH.RANGE[k][0]), FH.RANGE[k][1])
add = {}
for f in glob.glob('review/games/*.json'):
    G = json.load(open(f))
    for s in ('away', 'home'):
        for q in G['lineups'][s]:
            k = str(q['id'])
            if k in H or k in add: continue
            v = R.get(q['id']) or {}
            known = {kk: float(E['mu'][j]) for j, kk in enumerate(FH.KNOWN)}
            for kk in ('heightIn', 'weightLb'):
                if v.get(kk): known[kk] = v[kk]
            draws = rng.multivariate_normal(np.zeros(len(mu)), C, size=40) * sd + mu
            add[k] = {'known': known, 'mean': {h: round(clip(h, float(mu[i])), 4) for i, h in enumerate(FH.HIDDEN)},
                      'sd': {h: round(float(sd[i] * np.sqrt(C[i, i])), 4) for i, h in enumerate(FH.HIDDEN)},
                      'draws': [{h: round(clip(h, float(x)), 4) for h, x in zip(FH.HIDDEN, d)} for d in draws],
                      'id': q['id'], 'name': v.get('name') or q.get('name'), 'team': v.get('team'), 'bats': v.get('bats'), 'position': v.get('position'),
                      'speed': None, 'armMph': None, 'seasons': [], 'basis': 'population (season/patch_hitters.py: no hitting data)'}
H.update(add)
json.dump(H, open('review/hitters_fit.json', 'w'), indent=1)
print('added population hitting traits for %d men: %s' % (len(add), ', '.join(sorted(a['name'] or '?' for a in add.values()))))
