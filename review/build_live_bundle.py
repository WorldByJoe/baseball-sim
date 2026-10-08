"""
build_live_bundle.py · v0.1 · 2026-10-06

The couch analyst's web bundle (site/live): copies the engine as this branch has
it (bb_engine, bb_names, bb_field, bb_game, review/players.js) into site/live/engine,
and writes site/live/data/playoff.js: the playoff rosters' measured traits (only
the fields the analyst reads), the hitters' fitted hidden traits (24 draws each),
the pitchers' fitted deception, command and mishit, the league's 2025 balls in play (for
the expected hit of a batted ball), and the parks.

  python3 review/build_live_bundle.py

CHANGED
  v0.1  first build (the bundle step of 2026-10-06, kept as a script)
"""
import json, shutil, numpy as np

for f in ('bb_engine.js', 'bb_names.js', 'bb_field.js', 'bb_game.js', 'review/players.js'):
    shutil.copy(f, 'site/live/engine/')
recs = json.load(open('playoffs/players_measured.json')); recs = recs if isinstance(recs, list) else recs['players']


def pooled(o):
    p = (o or {}).get('pooled') or {}
    return {'pooled': {k: (round(v, 4) if isinstance(v, float) else v) for k, v in p.items() if k in ('mean', 'n', 'se')}} if p else None


def yearmean(o):
    return {y: {'mean': round(o[y]['mean'], 3)} for y in ('2025', '2026') if isinstance((o or {}).get(y), dict) and o[y].get('mean') is not None}


R = []
for r in recs:
    t = {'id': r['id'], 'name': r['name'], 'team': r['team'], 'kind': r['kind'], 'position': r['position'], 'bats': r['bats'], 'throws': r['throws'],
         'heightIn': r.get('heightIn'), 'weightLb': r.get('weightLb'), 'traits': {}, 'summaries': {}, 'seasonStats': {}}
    H = r['summaries'].get('hitting') or {}
    if H:
        t['summaries']['hitting'] = {'whiffPerSwing': {k: pooled(v) for k, v in (H.get('whiffPerSwing') or {}).items()}, 'chaseRate': pooled(H.get('chaseRate'))}
    S = r['summaries'].get('pitching')
    if S:
        pt = {}
        for k, d in (S.get('pitchTypes') or {}).items():
            c = {y: {'x': round(cc['x'], 3), 'z': round(cc['z'], 3), 'n': cc.get('n')} for y in ('2025', '2026') for cc in [(d.get('command') or {}).get(y)] if cc and cc.get('x')}
            pt[k] = {'usage': pooled(d.get('usage')), 'velo': dict(pooled(d.get('velo')) or {}, **yearmean(d.get('velo'))), 'rpm': pooled(d.get('rpm')),
                     'ivbIn': pooled(d.get('ivbIn')), 'hbArmIn': pooled(d.get('hbArmIn')), 'activeSpin': d.get('activeSpin'), 'command': c,
                     'usageByCountSide': {kk: pooled(vv) for kk, vv in (d.get('usageByCountSide') or {}).items()}}
        t['summaries']['pitching'] = {'role': S.get('role'), 'use': S.get('use'), 'pitchTypes': pt}
        tp = r['traits'].get('pitching') or {}
        t['traits']['pitching'] = {k: pooled(tp.get(k)) for k in ('armAngle', 'releaseHeightFt', 'releaseSideFt', 'ext') if tp.get(k)}
        t['seasonStats']['pitching_2026'] = {'SV': ((r.get('seasonStats') or {}).get('pitching_2026') or {}).get('SV', 0)}
    R.append(t)
F = json.load(open('review/hitters_fit.json'))
for f in F.values():
    f['draws'] = [{h: round(v, 3) for h, v in d.items()} for d in f['draws'][:24]]
    for k in ('check', 'prior_sd', 'sd'):
        f.pop(k, None)
P = json.load(open('review/pitchers_fit.json'))
z = np.load('diag_out/league_bip.npz', allow_pickle=True)
code = {'OUT': 'O', '1B': '1', '2B': '2', '3B': '3', 'HR': 'H', 'E': 'E'}
venues = json.load(open('playoffs/venues.json')); venues = venues.get('venues', venues) if isinstance(venues, dict) else venues
B = {'recs': R, 'fits': F, 'pfit': {'pitchers': {k: {kk: v[kk] for kk in ('deception', 'cmdScale', 'mishit', 'name', 'team') if kk in v} for k, v in P['pitchers'].items()}},
     'league': {'X': [round(float(v), 1) for v in z['X'].flatten()], 'C': ''.join(code[c] for c in z['C'])}, 'venues': venues}
s = 'var PLAYOFF = ' + json.dumps(B, separators=(',', ':')) + ';\n'
open('site/live/data/playoff.js', 'w').write(s)
print('bundle %.2f MB; engine copied' % (len(s) / 1e6))
