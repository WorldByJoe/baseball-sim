"""
ibb_fold.py · v0.1 · 2026-10-14

A fold's data folder with every hitter's walk rate net of intentional walks (the model review of 2026-10-14: the
engine's plate appearance never issues an intentional walk, the game's manager does, so a hitter fitted to walks that
include them was given the eye to draw them unintentionally and then walked again by the manager). Every season's
and the pooled BB_pct mean less the same key's IBB_pct mean; the standard errors kept. The new folder links every
other file of the old.

  python3 season/ibb_fold.py season/foldA_aaa season/foldA_7
"""
import json, os, sys
SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)
for f in os.listdir(SRC):
    if f == 'players_measured.json': continue
    d = os.path.join(DST, f)
    if not os.path.lexists(d): os.symlink(os.path.abspath(os.path.join(SRC, f)), d)
D = json.load(open(os.path.join(SRC, 'players_measured.json')))
P = D['players'] if isinstance(D, dict) else D; P = P if isinstance(P, list) else list(P.values())
n = big = 0
for r in P:
    h = (r.get('summaries') or {}).get('hitting') or {}
    bb, ibb = h.get('BB_pct'), h.get('IBB_pct')
    if not (bb and ibb): continue
    for k, v in bb.items():
        if isinstance(v, dict) and v.get('mean') is not None and isinstance(ibb.get(k), dict) and ibb[k].get('mean'):
            v['mean'] = v['mean'] - ibb[k]['mean']; n += 1
            if k == 'pooled' and ibb[k]['mean'] >= 0.01: big += 1
json.dump(D, open(os.path.join(DST, 'players_measured.json'), 'w'), indent=None, separators=(',', ':'))
print('%s: %d walk rates made net of intentional walks; %d hitters with 1%%+ of PA intentional' % (DST, n, big))
