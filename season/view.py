"""
view.py · v0.4 · 2026-10-14

A season fold's inputs written into its worktree (as history/replay_view.py does for a past October; the season's
labels are already 2025 and 2026, the 2026 one being the fold's half):
  playoffs/players_measured.json   'pooled' = 2026's value (2025's when he has none); a pitcher's strikeout, walk and chase
                                   rates through 2026 (each season shrunk toward the league's mean by its reliability)
  playoffs/rosters.json            the fold's rosters and the 30 teams
  playoffs/pitches/                links to the fold's pitches (review/fit_mishit.py reads them)
  playoffs/venues.json             every park the replayed half was played in, named as its feeds name them
  review/games/<pk>.json           links to the replayed half's games (season/games)

  python3 season/view.py season/foldA ~/bsim-wt/hist26A

CHANGED
  v0.4  SEASON_Y: another season (2025) in season/y<year>, relabelled (the model review)
  v0.3  the fold's league_means.json, when there (season/aaa_fold.py v0.2), is the pitchers' shrinkage target
  v0.2  the league means a pitcher's rates are shrunk toward come from major-league lines only (not season/aaa_fold.py's
        translated Triple-A ones), so a man with major-league data is fitted exactly as before
  v0.1  first build (Joe, 2026-10-13)
"""
import json, os, sys, copy, glob, urllib.request
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
SY = int(os.environ.get('SEASON_Y', '2026')); PY = SY - 1   # the season replayed (SEASON_Y=2025, the model review: its data in season/y2025, labelled as 2026's, the year before as 2025's)
BASE = HERE if SY == 2026 else os.path.join(HERE, 'y%d' % SY)
sys.path.insert(0, os.path.join(HERE, '..', 'history'))
from replay_view import relabel, through
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}


def clean(o):
    """NaN and infinity to null (Savant's boards give NaN for a rate with no events; JSON has no NaN)"""
    if isinstance(o, float): return o if o == o and abs(o) != float('inf') else None
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list): return [clean(v) for v in o]
    return o


def main(fold, wt):
    fold, wt = os.path.abspath(fold), os.path.expanduser(wt)
    M = json.load(open(os.path.join(fold, 'players_measured.json'))); recs = M['players']
    carry = json.load(open(os.path.join(fold, 'seasons.json')))['measured']
    stats = json.load(open(os.path.join(fold, 'season_stats.json')))['players']
    pm = {}
    for k in ('K_pct', 'BB_pct', 'chaseRate'):
        v = [o['mean'] for r in recs if (r['summaries'].get('pitching') or {}).get('level') != 'AAA' for y, o in ((r['summaries'].get('pitching') or {}).get(k) or {}).items() if y.isdigit() and isinstance(o, dict) and o.get('mean') is not None]
        pm[k] = float(np.mean(v)) if v else None
    if os.path.exists(os.path.join(fold, 'league_means.json')): pm = json.load(open(os.path.join(fold, 'league_means.json')))   # major-league only (aaa_fold.py v0.2)
    out, shrunk = [], 0
    for r in recs:
        R = relabel(copy.deepcopy(r), 2026)
        R['seasonStats'] = stats.get(str(r['id'])) or {}
        P = R['summaries'].get('pitching')
        if P is not None:
            role = None
            for lab in ('2026', '2025'):
                s_ = R['seasonStats'].get('pitching_' + lab)
                if s_ and s_.get('G'):
                    role = {'role': 'SP' if (s_.get('GS') or 0) >= 0.5 * s_['G'] else 'RP', 'from': int(lab), 'G': s_['G'], 'GS': s_.get('GS')}; break
            P['role'] = role
            for k in ('K_pct', 'BB_pct', 'chaseRate'):
                c = carry.get('pitcher ' + k); o = (r['summaries']['pitching'].get(k) or {})
                if not c or not o or pm[k] is None: continue
                obs = [(o[str(y)]['mean'], o[str(y)]['se']) if isinstance(o.get(str(y)), dict) and o[str(y)].get('se') else None for y in (2025, 2026)]
                est = through(obs, pm[k], c['trueSd'] ** 2, min(max(c['corr'], 0.0), 0.99))
                if est: P[k]['pooled'] = {'mean': round(est[0], 4), 'se': round(est[1], 4), 'note': 'through the fold: 2025 and the fold half shrunk by reliability'}; shrunk += 1
        out.append(R)
    json.dump(clean({'meta': dict(M['meta'], view='season fold %s (season/view.py)' % os.path.basename(fold)), 'players': out}), open(os.path.join(wt, 'playoffs', 'players_measured.json'), 'w'), separators=(',', ':'), allow_nan=False)
    ros = json.load(open(os.path.join(fold, 'rosters.json')))
    byab = {t['abbrev']: t['id'] for t in ros['teams'].values()}
    for p in ros['players']: p['team'] = byab.get(p['teamAbbrev'])
    json.dump(ros, open(os.path.join(wt, 'playoffs', 'rosters.json'), 'w'), indent=0)
    pdir = os.path.join(wt, 'playoffs', 'pitches')
    for fn in glob.glob(os.path.join(pdir, '*.csv.gz')): os.remove(fn)
    n = 0
    for fn in glob.glob(os.path.join(fold, 'pitches', '*.csv.gz')):
        os.symlink(os.path.realpath(fn), os.path.join(pdir, os.path.basename(fn))); n += 1
    part = json.load(open(os.path.join(fold, 'participants_2026.json')))
    gdir = os.path.join(wt, 'review', 'games'); os.makedirs(gdir, exist_ok=True)
    venues, ng = {}, 0
    sched = {g['pk']: g for g in json.load(open(os.path.join(BASE, 'schedule.json')))}
    for g in part['games']:
        src = os.path.join(BASE, 'games', '%d.json' % g['pk']); dst = os.path.join(gdir, '%d.json' % g['pk'])
        if not os.path.exists(src): continue
        if os.path.lexists(dst): os.remove(dst)
        os.symlink(src, dst); ng += 1
        venues[sched[g['pk']]['venue']] = json.load(open(src))['venue']
    V = {}
    for vid, nm in venues.items():
        fn = os.path.join(BASE, 'raw', 'venue_%d.json' % vid)
        if not os.path.exists(fn): open(fn, 'wb').write(urllib.request.urlopen(urllib.request.Request('https://statsapi.mlb.com/api/v1/venues/%d?hydrate=location,fieldInfo' % vid, headers=UA), timeout=60).read())
        v = json.load(open(fn))['venues'][0]; loc, fi = v.get('location', {}), v.get('fieldInfo', {})
        fence = [fi.get(k) for k in ('leftLine', 'leftCenter', 'center', 'rightCenter', 'rightLine')]
        V[str(vid)] = {'id': vid, 'name': nm, 'elevFt': loc.get('elevation') or 0, 'roof': fi.get('roofType') or 'Open', 'fence': fence if all(fence) else None}
    json.dump({'note': 'parks of the replayed half (season/view.py)', 'venues': V}, open(os.path.join(wt, 'playoffs', 'venues.json'), 'w'), indent=0)
    print('%s -> %s: %d players (%d pitcher rates shrunk), %d pitch files, %d games, %d parks' % (os.path.basename(fold), wt, len(out), shrunk, n, ng, len(V)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
