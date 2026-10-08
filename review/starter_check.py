"""
starter_check.py · v0.1 · 2026-10-08

Does the model value starting pitchers as their real seasons do? Each playoff starter's simulated starts
(review/starter_check.js: neutral park, league lineups, the model's manager) beside his real 2025-26 line (MLB Stats
API season stats in playoffs/players_measured.json): outs a start, pitches a start, runs a nine, strikeouts and
walks. Real run prevention as FIP ((13 HR + 3 (BB + HBP) - 2 K) / IP + 3.10, steadier than ERA over a season or two)
and as ERA. Across starters: the correlation and the slope of the model's runs on the real (a slope under one = the
model squeezes aces and back-end starters together), and the same for length.

  python3 review/starter_check.py
"""
import json, glob
import numpy as np, statsmodels.api as sm

M = {m['id']: m for f in glob.glob('diag_out/starters/sp_*.jsonl') for l in open(f) if l.startswith('{') for m in [json.loads(l)]}
R = json.load(open('playoffs/players_measured.json')); R = R if isinstance(R, list) else R['players']; R = {r['id']: r for r in R}
rows = []
for i, m in M.items():
    S = R[i].get('seasonStats', {}); t = {k: 0 for k in ('G', 'GS', 'outs', 'ER', 'pitches', 'BF', 'SO', 'BB', 'HBP', 'HR')}
    for yr in ('pitching_2025', 'pitching_2026'):
        for k in t: t[k] += (S.get(yr) or {}).get(k, 0) or 0
    if t['GS'] < 8 or t['GS'] < 0.7 * t['G'] or not t['outs']: continue
    ip = t['outs'] / 3
    rows.append({'id': i, 'name': m['name'], 'team': m['team'], 'gs': t['GS'], 'fip': (13 * t['HR'] + 3 * (t['BB'] + t['HBP']) - 2 * t['SO']) / ip + 3.10, 'era': 27 * t['ER'] / t['outs'],
                 'outs_real': t['outs'] / t['G'], 'pc_real': t['pitches'] / t['G'], 'k_real': t['SO'] / t['BF'], 'bb_real': (t['BB'] + t['HBP']) / t['BF'],
                 'ra9': m['ra9'], 'outs_model': m['outsPerStart'], 'pc_model': m['pitchesPerStart'], 'k_model': m['K'], 'bb_model': m['BB']})
print('%d starters (8+ starts in 2025-26, mostly starting)' % len(rows))
def fit(y, x, lab):
    X = sm.add_constant(np.array(x)); r = sm.OLS(np.array(y), X).fit()
    print('  %-44s r %.2f  slope %.2f (se %.2f)  model sd %.2f vs real sd %.2f' % (lab, np.corrcoef(x, y)[0, 1], r.params[1], r.bse[1], np.std(y), np.std(x)))
    return r
A = lambda k: [r[k] for r in rows]
fit(A('ra9'), A('fip'), 'model runs a nine on real FIP')
fit(A('ra9'), A('era'), 'model runs a nine on real ERA')
fit(A('outs_model'), A('outs_real'), 'model outs a start on real')
fit(A('pc_model'), A('pc_real'), 'model pitches a start on real')
fit(A('k_model'), A('k_real'), 'model K rate on real (fitted)')
print('means: outs a start model %.1f real %.1f | pitches model %.0f real %.0f | runs a nine model %.2f, real ERA %.2f FIP %.2f' % (
    np.mean(A('outs_model')), np.mean(A('outs_real')), np.mean(A('pc_model')), np.mean(A('pc_real')), np.mean(A('ra9')), np.mean(A('era')), np.mean(A('fip'))))
ROT = {'LAD': [669373, 605483, 808967, 607192], 'MIL': [694819, 701656, 669160, 688107], 'TB': [656876, 642547, 607259, 643377], 'CWS': [696146, 641743, 656794, 663436]}
byid = {r['id']: r for r in rows}
for t, ids in ROT.items():
    print(t)
    for g, i in enumerate(ids):
        r = byid.get(i); m = M.get(i)
        if r: print('   G%d %-20s real FIP %.2f ERA %.2f, %.1f outs/start | model %.2f runs/9, %.1f outs/start' % (g + 1, r['name'], r['fip'], r['era'], r['outs_real'], r['ra9'], r['outs_model']))
        elif m: print('   G%d %-20s (too few real starts) | model %.2f runs/9, %.1f outs/start' % (g + 1, m['name'], m['ra9'], m['outsPerStart']))
        else: print('   G%d %d: not a fitted starter' % (g + 1, i))
json.dump(rows, open('review/starter_check.json', 'w'), indent=1)
