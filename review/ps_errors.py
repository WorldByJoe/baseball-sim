"""
ps_errors.py · v0.1 · 2026-10-10

Do error-prone fielders make even more errors in the postseason, or their usual rate? Each fielder's postseason
chances and errors (the box scores of every finished division series game, playoffs/games/<pk>_feed.json) beside his
own 2025-26 regular-season errors per chance (playoffs/fielding_season.json, MLB Stats API) and his error tendency
(review/err_mult.json: his rate against his positions', shrunk with 150 chances of prior weight). Expected errors =
his postseason chances x his own season rate. Then: all fielders, the error-prone and the sure-handed halves, the
fielders who made the errors, and a Poisson regression of postseason errors on log(tendency) with log(expected) as
the offset (an exponent of 0 = everyone at his usual rate, scaled by one postseason factor; above 0 = the
error-prone run further over their usual rate).

  python3 review/ps_errors.py   ->  review/ps_errors.json
"""
import json, sys, glob
import numpy as np, statsmodels.api as sm
sys.path.insert(0, 'review')
from replay_grids import GAMES

SEASON = json.load(open('playoffs/fielding_season.json'))
REL = json.load(open('review/err_mult.json'))['players']
ps = {}
games = 0
for pk, ser, num, date in GAMES:
    try: d = json.load(open('playoffs/games/%d_feed.json' % pk))
    except FileNotFoundError: continue
    if d['gameData']['status']['abstractGameState'] != 'Final': continue
    games += 1
    for s in ('away', 'home'):
        for p in d['liveData']['boxscore']['teams'][s]['players'].values():
            f = p.get('stats', {}).get('fielding', {}) or {}
            tc, e = f.get('chances') or 0, f.get('errors') or 0
            if not tc and not e: continue
            r = ps.setdefault(str(p['person']['id']), {'name': p['person']['fullName'], 'tc': 0, 'e': 0, 'g': 0}); r['tc'] += tc; r['e'] += e; r['g'] += 1
rows = []
for pid, r in ps.items():
    S = SEASON.get(pid)
    if not S: continue
    E = TC = 0
    for yr in ('2025', '2026'):
        for x in S.get(yr, []):
            if x['pos'] in ('DH', None): continue
            E += x['E']; TC += x['TC']
    if not TC: continue
    rel = REL.get(pid, {}).get('rel', 1.0)
    rows.append(dict(r, id=pid, seasonE=E, seasonTC=TC, rate=E / TC, rel=rel, exp=r['tc'] * E / TC))
obs = sum(r['e'] for r in rows); exp = sum(r['exp'] for r in rows); tc = sum(r['tc'] for r in rows)
print('%d games, %d fielders with season data: %d postseason errors in %d chances; their own season rates expected %.1f (ratio %.2f)' % (games, len(rows), obs, tc, exp, obs / exp))
from scipy import stats
print('  chance of %d or more if each man kept his own rate (Poisson %.1f): p = %.3f' % (obs, exp, stats.poisson.sf(obs - 1, exp)))
med = np.median([r['rel'] for r in rows])
for lab, sel in (('error-prone half (tendency above %.2f)' % med, [r for r in rows if r['rel'] > med]), ('sure-handed half', [r for r in rows if r['rel'] <= med])):
    o = sum(r['e'] for r in sel); x = sum(r['exp'] for r in sel); c = sum(r['tc'] for r in sel)
    print('  %-38s %3d fielders, %4d chances: %2d errors vs %.1f expected from their own rates (ratio %.2f)' % (lab, len(sel), c, o, x, o / x if x else float('nan')))
# Poisson: errors ~ log(tendency), offset log(expected own)
use = [r for r in rows if r['exp'] > 0]
y = np.array([r['e'] for r in use]); X = sm.add_constant(np.log([r['rel'] for r in use])); off = np.log([r['exp'] for r in use])
m = sm.GLM(y, X, family=sm.families.Poisson(), offset=off).fit()
print('  Poisson: postseason factor exp(%.2f) = %.2f x own rate; tendency exponent %.2f (se %.2f, p %.2f)' % (m.params[0], np.exp(m.params[0]), m.params[1], m.bse[1], m.pvalues[1]))
print('\nthe fielders who made errors:')
for r in sorted([r for r in rows if r['e']], key=lambda r: -r['e']):
    print('  %-22s %d E in %3d chances (expected %.2f) | season %d E in %d (%.3f) | tendency %.2f' % (r['name'], r['e'], r['tc'], r['exp'], r['seasonE'], r['seasonTC'], r['rate'], r['rel']))
print('\nthe most error-prone fielders (tendency 1.4+) and how they did:')
for r in sorted([r for r in rows if r['rel'] >= 1.4], key=lambda r: -r['rel']):
    print('  %-22s tendency %.2f | %d E in %3d chances (expected %.2f)' % (r['name'], r['rel'], r['e'], r['tc'], r['exp']))
json.dump({'games': games, 'observed': obs, 'expected': exp, 'chances': tc, 'rows': rows, 'poisson': {'b0': m.params[0], 'b1': m.params[1], 'se1': m.bse[1], 'p1': m.pvalues[1]}},
          open('review/ps_errors.json', 'w'), indent=1, default=float)
