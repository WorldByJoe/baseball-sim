"""
replay_view.py · v0.3 · 2026-10-12

The inputs a postseason's replays read, as they stood that October, written into a worktree of their own (the review's
scripts read fixed paths, so a past October gets its own checkout, e.g. ~/bsim-wt/hist2025):
  playoffs/players_measured.json   history/players_measured.json with every season after S dropped and the seasons
                                   relabelled so the scripts' 'this season' (2026) is S and 'last season' (2025) is S-1.
                                   'pooled' is S's value (S-1's when he has none for S), except a pitcher's strikeout,
                                   walk and chase rates: their estimate through S (each season's rate shrunk toward the
                                   participants' mean by its reliability, the seasons tied by the carry-over that
                                   history/seasons.py measured; review/fit_pitchers.js fits his traits to these)
  playoffs/rosters.json            the participants and S's teams (id, abbreviation, park)
  playoffs/fielding_season.json    seasons S-1 and S, relabelled 2025 and 2026, for review/err_mult.py
  playoffs/pitches/                links to history/pitches for S-1 and S, relabelled likewise (review/fit_mishit.py)

  python3 history/replay_view.py 2025 ~/bsim-wt/hist2025

CHANGED
  v0.3  the age trend in a pitcher's rates through S (history/aging.py): each season's expected rate moves with his age
  v0.2  only that October's participants, on the teams they played for then (the history files hold every October's men)
  v0.1  first build (Joe, 2026-10-12: the 2025 playoffs in the logistic regression)
"""
import json, os, sys, copy, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'playoffs'))
from common import fetch_json


def relabel(o, S):
    """drop seasons after S; S -> '2026', S-1 -> '2025'; pooled = this season's value, else last season's"""
    if isinstance(o, dict):
        yk = [k for k in o if k.isdigit() and len(k) == 4]
        if yk:
            out = {k: relabel(v, S) for k, v in o.items() if not (k.isdigit() and len(k) == 4) and k != 'pooled'}
            cur, prev = o.get(str(S)), o.get(str(S - 1))
            if cur is not None: out['2026'] = relabel(cur, S)
            if prev is not None: out['2025'] = relabel(prev, S)
            pick = cur if cur is not None else prev
            if pick is not None and 'pooled' in o: out['pooled'] = relabel(pick, S)
            return out
        return {k: relabel(v, S) for k, v in o.items()}
    if isinstance(o, list):
        return [relabel(v, S) for v in o]
    return o


def through(obs, mu, tv, rho):
    """the true rate in the last season of obs [(mean, se) or None per season, oldest first], given every season so far:
    true values N(mu_s, tv) each season (mu a number, or one per season when his age moves it), correlated rho between
    consecutive seasons (rho^k k apart)"""
    mu = np.array(mu if np.ndim(mu) else [mu] * len(obs), float)
    idx = [i for i, o in enumerate(obs) if o]
    if not idx: return None
    n = len(obs); T = n - 1
    Sig = np.array([[tv * rho ** abs(i - j) for j in range(n)] for i in range(n)])
    x = np.array([obs[i][0] for i in idx]); C = Sig[np.ix_(idx, idx)] + np.diag([obs[i][1] ** 2 for i in idx])
    k = Sig[T, idx]; w = np.linalg.solve(C, k)
    return mu[T] + w @ (x - mu[idx]), math.sqrt(max(tv - w @ k, 1e-12))


def main(S, wt):
    part = {p['id']: p for p in json.load(open(os.path.join(HERE, 'participants_%d.json' % S)))['players']}   # that October's men, on that October's teams
    M = json.load(open(os.path.join(HERE, 'players_measured.json'))); recs = [r for r in M['players'] if r['id'] in part]
    carry = json.load(open(os.path.join(HERE, 'seasons.json')))['measured']
    stats = json.load(open(os.path.join(HERE, 'season_stats.json')))['players']
    out = []
    # the participants' mean of each pitcher rate (every season), for the shrinkage
    pm = {}
    for k in ('K_pct', 'BB_pct', 'chaseRate'):
        v = [o['mean'] for r in recs for y, o in ((r['summaries'].get('pitching') or {}).get(k) or {}).items() if y.isdigit() and isinstance(o, dict) and o.get('mean') is not None]
        pm[k] = float(np.mean(v)) if v else None
    shrunk = 0
    AG = json.load(open(os.path.join(HERE, 'aging.json')))['measured'] if 'age' in sys.argv[3:] else {}   # pinned for later (Joe, 2026-10-12): on only when asked
    import datetime
    birth = {p['id']: p.get('birthDate') for p in json.load(open(os.path.join(HERE, 'rosters.json')))['players']}
    for r in recs:
        R = relabel(copy.deepcopy(r), S); R['team'] = part[r['id']]['team']
        ss = stats.get(str(r['id'])) or {}
        R['seasonStats'] = {g + '_2026': ss.get('%s_%d' % (g, S)) for g in ('hitting', 'pitching')}
        R['seasonStats'].update({g + '_2025': ss.get('%s_%d' % (g, S - 1)) for g in ('hitting', 'pitching')})
        P = R['summaries'].get('pitching')
        if P is not None:
            role = None
            for lab in ('2026', '2025'):
                s_ = R['seasonStats'].get('pitching_' + lab)
                if s_ and s_.get('G'):
                    role = {'role': 'SP' if (s_.get('GS') or 0) >= 0.5 * s_['G'] else 'RP', 'from': S if lab == '2026' else S - 1, 'G': s_['G'], 'GS': s_.get('GS')}; break
            P['role'] = role
            for k in ('K_pct', 'BB_pct', 'chaseRate'):
                c = carry.get('pitcher ' + k); o = (r['summaries']['pitching'].get(k) or {})
                if not c or not o or pm[k] is None: continue
                obs = [(o[str(y)]['mean'], o[str(y)]['se']) if isinstance(o.get(str(y)), dict) and o[str(y)].get('se') else None for y in (S - 1, S)]
                mus = pm[k]; ag = AG.get('pitcher ' + k)
                if ag and birth.get(r['id']):   # his expected rate each season moves with his age: g (mean age - 30) + d (age - mean) + e ((age-30)^2 - mean)
                    b = datetime.date.fromisoformat(birth[r['id']]); a_ = np.array([(datetime.date(y, 7, 1) - b).days / 365.25 for y in (S - 1, S)]); q_ = (a_ - 30) ** 2
                    mus = [pm[k] + ag['g'][0] * (a_.mean() - 30) + ag['d'][0] * (x - a_.mean()) + ag['e'][0] * (qq - q_.mean()) for x, qq in zip(a_, q_)]
                est = through(obs, mus, c['trueSd'] ** 2, min(max(c['corr'], 0.0), 0.99))
                if est:
                    P[k]['pooled'] = {'mean': round(est[0], 4), 'se': round(est[1], 4), 'note': 'through %d: seasons %d-%d shrunk by reliability (history/replay_view.py)' % (S, S - 1, S)}
                    shrunk += 1
        out.append(R)
    M2 = {'meta': dict(M['meta'], view='%d as of its October (history/replay_view.py): 2026 = %d, 2025 = %d' % (S, S, S - 1)), 'players': out}
    json.dump(M2, open(os.path.join(wt, 'playoffs', 'players_measured.json'), 'w'), separators=(',', ':'))
    # rosters, with S's teams
    T = fetch_json('https://statsapi.mlb.com/api/v1/teams?sportId=1&season=%d' % S, 'history/teams_%d.json' % S)['teams']
    teams = {str(t['id']): {'id': t['id'], 'abbrev': t['abbreviation'], 'name': t['name'], 'venueId': t['venue']['id']} for t in T}
    byab = {t['abbrev']: t['id'] for t in teams.values()}
    ros = [dict(p, teamAbbrev=part[p['id']]['team']) for p in json.load(open(os.path.join(HERE, 'rosters.json')))['players'] if p['id'] in part]
    for p in ros: p['team'] = byab.get(p['teamAbbrev'])
    json.dump({'note': 'postseason %d participants (history/replay_view.py)' % S, 'teams': teams, 'players': ros}, open(os.path.join(wt, 'playoffs', 'rosters.json'), 'w'), indent=1)
    F = json.load(open(os.path.join(HERE, 'fielding_season.json')))
    F2 = {pid: {'name': f['name'], '2025': f.get(str(S - 1), []), '2026': f.get(str(S), [])} for pid, f in F.items() if int(pid) in part}
    json.dump(F2, open(os.path.join(wt, 'playoffs', 'fielding_season.json'), 'w'), indent=0)
    pdir = os.path.join(wt, 'playoffs', 'pitches'); os.makedirs(pdir, exist_ok=True)
    for fn in os.listdir(pdir):
        if fn.endswith('.csv.gz'): os.remove(os.path.join(pdir, fn))
    n = 0
    for fn in os.listdir(os.path.join(HERE, 'pitches')):
        if not fn.endswith('.csv.gz'): continue
        y = int(fn[:4])
        if y in (S - 1, S):
            os.symlink(os.path.join(HERE, 'pitches', fn), os.path.join(pdir, ('2026' if y == S else '2025') + fn[4:])); n += 1
    print('%d players (%d pitcher rates shrunk through %d), %d teams, %d pitch files linked' % (len(out), shrunk, S, len(teams), n))


if __name__ == '__main__':
    main(int(sys.argv[1]), os.path.expanduser(sys.argv[2]))
