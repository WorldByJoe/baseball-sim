"""
build_real2026.py · v0.1 · 2026-10-15

The Ballgame's real-player file (Joe, 2026-10-15: a random game whose rosters are drawn from 2026's major leaguers with
their actual traits). Every 2026 major leaguer the season replay fitted: hitters from run 7's fits (each half's fit,
the second half's preferred: 2025 and 2026's second half), with each man's own range from Savant (review/field_traits.py,
2025-26) as route and first-step shifts; pitchers with what review/players.js's builder reads (pitch shapes, speeds,
spins, release, command, workload) and their fitted deception, command scale and mishit. Hitters need 100 plate
appearances in the fits' window and pitchers 30 batters faced, so the draws are real major leaguers, not a September cup.

  python3 review/build_real2026.py OUT.js       -> window.BB_REAL = { fits, recs, pfit, made }
"""
import json, os, sys, datetime
H = os.path.expanduser('~/bsim-wt')
OUT = sys.argv[1]
def load(w):
    fits = json.load(open('%s/%s/review/hitters_fit.json' % (H, w)))
    recs = {str(r['id']): r for r in json.load(open('%s/%s/playoffs/players_measured.json' % (H, w)))['players']}
    pf = json.load(open('%s/%s/review/pitchers_fit.json' % (H, w)))
    return fits, recs, pf
fB, rB, pB = load('hist26B7'); fA, rA, pA = load('hist26A7')
ft = json.load(open('%s/hist26B7/review/field_traits.json' % H))['players'] if os.path.exists('%s/hist26B7/review/field_traits.json' % H) else {}
def pa(r, kind):
    ss = (r or {}).get('seasonStats') or {}
    if kind == 'hit': return sum(((ss.get('hitting_%d' % y) or {}).get('PA') or 0) for y in (2025, 2026))
    return sum(((ss.get('pitching_%d' % y) or {}).get('BF') or 0) for y in (2025, 2026))
fits, recs, pfit = {}, [], {}
for src_f, src_r in ((fB, rB), (fA, rA)):
    for k, f in src_f.items():
        if k in fits or not isinstance(f, dict) or 'refined' not in f: continue
        r = src_r.get(k) or {}
        if r.get('kind') == 'pitcher' or pa(r, 'hit') < 100 or not f.get('position') or f.get('position') == 'P': continue
        g = {x: f[x] for x in ('id', 'name', 'team', 'bats', 'position', 'speed', 'armMph') if f.get(x) is not None}
        g['known'] = f['known']; g['refined'] = f['refined']
        z = ((ft.get(k) or {}).get(f['position']) or (ft.get(k) or {}).get('all') or {}).get('z')
        if z is not None: g['rangeZ'] = z
        fits[k] = g
P_KEYS_T = ('usage', 'velo', 'rpm', 'ivbIn', 'hbArmIn', 'activeSpin', 'command')
seen = set()
for src_r, src_p in ((rB, pB), (rA, pA)):
    for k, r in src_r.items():
        if k in seen: continue
        S = (r.get('summaries') or {}).get('pitching') or {}; T = (r.get('traits') or {}).get('pitching') or {}
        if r.get('kind') == 'position' or not S.get('pitchTypes') or pa(r, 'pit') < 30: continue
        def slim(o):
            if not isinstance(o, dict): return o
            out = {}
            if 'pooled' in o and isinstance(o['pooled'], dict): out['pooled'] = {'mean': o['pooled'].get('mean')}
            for y in ('2026', '2025'):
                if isinstance(o.get(y), dict): out[y] = {kk: o[y][kk] for kk in ('mean', 'x', 'z', 'n') if kk in o[y]}
            return out
        pt = {t: {kk: slim(d.get(kk)) for kk in P_KEYS_T if d.get(kk) is not None} for t, d in S['pitchTypes'].items()}
        use = {y: {'pitchesPerApp': {'mean': ((S.get('use') or {}).get(y) or {}).get('pitchesPerApp', {}).get('mean')}} for y in ('2026', '2025') if ((S.get('use') or {}).get(y) or {}).get('pitchesPerApp')}
        recs.append({'id': r['id'], 'name': r['name'], 'team': r.get('team'), 'kind': r.get('kind'), 'throws': r.get('throws'), 'heightIn': r.get('heightIn'), 'weightLb': r.get('weightLb'),
                     'summaries': {'pitching': {'pitchTypes': pt, 'role': S.get('role'), 'use': use}},
                     'traits': {'pitching': {kk: slim(T.get(kk)) for kk in ('armAngle', 'releaseHeightFt', 'releaseSideFt', 'ext') if T.get(kk) is not None}}, 'seasonStats': {}})
        p = (src_p.get('pitchers') or {}).get(k)
        if p: pfit[k] = {kk: p[kk] for kk in ('deception', 'cmdScale', 'mishit') if kk in p}
        seen.add(k)
roles = {}
for r in recs: roles[((r['summaries']['pitching'].get('role') or {}).get('role') or 'RP')] = roles.get(((r['summaries']['pitching'].get('role') or {}).get('role') or 'RP'), 0) + 1
pos = {}
for f in fits.values(): pos[f['position']] = pos.get(f['position'], 0) + 1
D = {'fits': fits, 'recs': recs, 'pfit': {'pitchers': pfit}, 'made': datetime.date.today().isoformat(), 'note': '2026 major leaguers: run 7 hitter fits (second half preferred), pitchers with run 4 fits (review/build_real2026.py)'}
open(OUT, 'w').write('// bb_real2026.js: 2026 major leaguers with their fitted traits, for the Ballgame\'s real-player games (review/build_real2026.py)\nwindow.BB_REAL = ' + json.dumps(D, separators=(',', ':')) + ';\n')
print('%d hitters %s; %d pitchers %s; %.2f MB' % (len(fits), dict(sorted(pos.items())), len(recs), roles, os.path.getsize(OUT) / 1e6))
