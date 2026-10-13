"""
exceptional.py · v0.1 · 2026-10-12

Who is truly exceptional at the trait level. For each player (history/seasons.json, every season's evidence used):
  hidden skill traits   the chance his trait lies beyond the top 1% (and 10%) of the model's major leaguers (the emulator's
                        population), from his posterior; skill direction from TRAITS.md (lower scatter, earlier pickup,
                        wider reach and more in-game learning are better); style traits (aggression, commitment, fastball
                        lean, pull, undercut) are reported as distinctive, not better
  measured traits       his rank on Savant's league-wide leaderboard of the same season (bat speed, sprint speed, arm)
  stacking              how many skill traits he holds in the top 10% with better-than-even odds

  python3 history/exceptional.py [season]      -> history/exceptional.json and a printed summary

CHANGED
  v0.1  first build (Joe, 2026-10-12: pick out the truly exceptional players at the trait scale)
"""
import json, os, sys, csv, math
import numpy as np
from scipy.stats import norm
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'review'))
import fit_hitters as FH

SKILL = {'motorIn': -1, 'timingSD': -1, 'longSD': -1, 'spotIn': -1, 'eyeSD': -1, 'learn': 1, 'coverage': 1}
UNMEASURED = ['faceSD']   # one season's data leave its sd at 0.93 of the prior's: nobody can be told apart on it
STYLE = ['undercut', 'aggr', 'commit', 'fbLean', 'pullBias']
WHAT = {'motorIn': 'bat-to-ball precision (vertical scatter)', 'faceSD': 'bat-face control', 'timingSD': 'timing precision', 'longSD': 'along-the-barrel precision',
        'spotIn': 'early pickup of a pitch leaving its expected path', 'eyeSD': 'zone judgement', 'learn': 'learning a pitcher within a game', 'coverage': 'plate coverage (reach)',
        'undercut': 'aims under the ball (loft)', 'aggr': 'swing aggression', 'commit': 'sits on his guess', 'fbLean': 'leans fastball', 'pullBias': 'contact point out front (pull)'}
BOARDS = {'batSpeed': ('bat_tracking', 'id', 'avg_bat_speed', 'swings_competitive', 100), 'sprint': ('sprint_speed', 'player_id', 'sprint_speed', 'competitive_runs', 10),
          'arm': ('arm_strength', 'player_id', 'arm_overall', 'total_throws', 50)}


def board(name, y):
    fn, idk, val, cnt, mn = BOARDS[name]
    out = {}
    p = os.path.join(HERE, 'leaderboards', '%s_%d.csv' % (fn, y))
    if not os.path.exists(p): return out
    for r in csv.DictReader(open(p, encoding='utf-8-sig')):
        try:
            if float(r.get(cnt) or 0) >= mn and r.get(val): out[int(r[idk])] = float(r[val])
        except ValueError: pass
    return out


def main(season):
    E = FH.emulator(os.path.join(HERE, '..', 'diag_out', 'emu.jsonl'))
    NK = len(FH.KNOWN); X = E['X'][:, NK:]
    S = json.load(open(os.path.join(HERE, 'seasons.json')))
    q = {h: (np.percentile(X[:, k], 99 if SKILL.get(h, 1) > 0 else 1), np.percentile(X[:, k], 90 if SKILL.get(h, 1) > 0 else 10),
             np.percentile(X[:, k], 1), np.percentile(X[:, k], 99)) for k, h in enumerate(FH.HIDDEN)}
    rows = []
    for pid, pr in S['players'].items():
        ys = sorted(pr['seasons']); y = str(season) if str(season) in pr['seasons'] else ys[-1]
        est = pr['seasons'][y]['all']
        rec = {'id': int(pid), 'name': pr['name'], 'team': pr['team'], 'season': int(y), 'seasons': ys, 'skill': {}, 'style': {}}
        for h, d in SKILL.items():
            m, s = est['mean'][h], max(est['sd'][h], 1e-6)
            t1, t10 = q[h][0], q[h][1]
            p1 = norm.sf((t1 - m) / s) if d > 0 else norm.cdf((t1 - m) / s)
            p10 = norm.sf((t10 - m) / s) if d > 0 else norm.cdf((t10 - m) / s)
            pct = float((X[:, FH.HIDDEN.index(h)] < m).mean()); pct = pct if d > 0 else 1 - pct
            rec['skill'][h] = {'mean': m, 'sd': s, 'pTop1': round(float(p1), 3), 'pTop10': round(float(p10), 3), 'pctile': round(100 * pct, 1)}
        for h in STYLE:
            m, s = est['mean'][h], max(est['sd'][h], 1e-6); lo, hi = q[h][2], q[h][3]
            rec['style'][h] = {'mean': m, 'sd': s, 'pBeyond1pct': round(float(norm.cdf((lo - m) / s) + norm.sf((hi - m) / s)), 3)}
        rec['stack10'] = sum(1 for v in rec['skill'].values() if v['pTop10'] > 0.5)
        rows.append(rec)
    yrs = sorted({r['season'] for r in rows})
    B = {n: {y: board(n, y) for y in yrs} for n in BOARDS}
    for r in rows:
        r['measured'] = {}
        for n in BOARDS:
            b = B[n][r['season']]
            if r['id'] in b:
                v = b[r['id']]; vals = np.array(list(b.values()))
                r['measured'][n] = {'value': v, 'rank': int((vals > v).sum()) + 1, 'of': len(vals), 'pctile': round(100 * float((vals < v).mean()), 1)}
    json.dump({'season': season, 'thresholds': {h: {'top1': round(float(q[h][0]), 3), 'top10': round(float(q[h][1]), 3)} for h in SKILL}, 'players': rows},
              open(os.path.join(HERE, 'exceptional.json'), 'w'), indent=1)
    print('%d hitters' % len(rows))
    for h in SKILL:
        top = sorted(rows, key=lambda r: -r['skill'][h]['pTop1'])[:5]
        print('\n%s (%s): top-1%% line %.2f' % (h, WHAT[h], q[h][0]))
        for r in top:
            v = r['skill'][h]; print('   %-22s %-4s %d  %.2f +- %.2f   P(top 1%%) %.2f   P(top 10%%) %.2f' % (r['name'], r['team'], r['season'], v['mean'], v['sd'], v['pTop1'], v['pTop10']))
    print('\nstacking: skill traits in the top 10% with better-than-even odds')
    for r in sorted(rows, key=lambda r: -r['stack10'])[:15]:
        print('   %-22s %-4s %d  %d: %s' % (r['name'], r['team'], r['season'], r['stack10'], ', '.join(h for h, v in r['skill'].items() if v['pTop10'] > 0.5)))
    for n in BOARDS:
        print('\n%s: league leaders among the participants' % n)
        for r in sorted([r for r in rows if n in r['measured']], key=lambda r: r['measured'][n]['rank'])[:5]:
            v = r['measured'][n]; print('   %-22s %-4s %d  %.1f  rank %d of %d' % (r['name'], r['team'], r['season'], v['value'], v['rank'], v['of']))


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2025)
