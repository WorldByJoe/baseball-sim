"""
logit_all.py · v0.1 · 2026-10-12

The game-pick regression over every October replayed: one point per game (the home team's share of its 1,000 replays,
whether it won the real game), per setting, from each October's worktree. Two fits:
  y ~ a + b p           as the Postseason page draws it (b: the slope on the replay share)
  y ~ a + c logit(p)    the calibration form: c = 1 if a team's real chance equals its replay share, c > 1 if the
                        replays are too timid (real results follow them more steeply), c < 1 if too bold
with the likelihood-ratio test of each against the intercept alone, and the same fits per October.

  python3 history/logit_all.py [--refit]     (also writes history/points_<year>.json for each past October; --refit: 2026 from
                                               the history-2026 worktree)
CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys
import numpy as np
import statsmodels.api as sm
REV = os.path.expanduser('~/bsim-wt/review')
sys.path.insert(0, os.path.join(REV, 'review'))
from replay_grids import GAMES, SETS

def past(y): return (os.path.expanduser('~/bsim-wt/hist%d' % y), [g['pk'] for g in json.load(open(os.path.join(REV, 'history', 'participants_%d.json' % y)))['games']])
# 2026 from the live review worktree (its original 2025-26 pooled fits), or with --refit from the history-2026 worktree (through 2026)
OCT = {2026: (os.path.expanduser('~/bsim-wt/hist2026') if '--refit' in sys.argv else REV, [g[0] for g in GAMES]), 2025: past(2025), 2024: past(2024)}


def rows(key, d):
    out = []
    for yr, (wt, pks) in OCT.items():
        for pk in pks:
            f = os.path.join(wt, d, '%d.jsonl' % pk)
            if not os.path.exists(f): continue
            R = [json.loads(l) for l in open(f) if l.startswith('{')]
            if len(R) < 900: continue
            G = json.load(open(os.path.join(wt, 'review', 'games', '%d.json' % pk)))
            out.append({'yr': yr, 'pk': pk, 'p': sum(r['score'][1] > r['score'][0] for r in R) / len(R), 'y': int(G['final']['home'] > G['final']['away'])})
    return out


def fit(x, y):
    m = sm.Logit(y, sm.add_constant(x)).fit(disp=0)
    return m.params[1], m.bse[1], m.llr_pvalue, m.prsquared


def main():
    res = {}
    for key, d in SETS:
        D = rows(key, d)
        if not D: continue
        res[key] = {}
        for lab, sub in [('all', D)] + [(str(y), [r for r in D if r['yr'] == y]) for y in sorted(OCT, reverse=True)]:
            if len(sub) < 5: continue
            p = np.array([r['p'] for r in sub]); y = np.array([r['y'] for r in sub]); lp = np.log(p / (1 - p))
            b = fit(p, y); c = fit(lp, y)
            res[key][lab] = {'n': len(sub), 'homeWins': int(y.sum()), 'shareSd': round(float(p.std(ddof=1)), 3), 'favouriteWon': int(((p > 0.5) == (y == 1)).sum()),
                             'slope': [round(float(b[0]), 2), round(float(b[1]), 2)], 'lrP': round(float(b[2]), 4), 'mcfadden': round(float(b[3]), 3),
                             'calib': [round(float(c[0]), 2), round(float(c[1]), 2)], 'calibP0': round(float(c[2]), 4),
                             'calibP1': round(float(2 * (1 - __import__('scipy').stats.norm.cdf(abs(c[0] - 1) / c[1]))), 3)}
            r = res[key][lab]
            print('%-8s %-4s n %3d  favourite won %2d  share sd %.3f | slope %5.1f (se %4.1f) LR p %.3f McF %.2f | calibration c %.2f (se %.2f): p(c=0) %.3f, p(c=1) %.2f' % (
                key, lab, r['n'], r['favouriteWon'], r['shareSd'], r['slope'][0], r['slope'][1], r['lrP'], r['mcfadden'], r['calib'][0], r['calib'][1], r['calibP0'], r['calibP1']))
    json.dump(res, open(os.path.join(REV, 'history', 'logit_all.json'), 'w'), indent=1)
    # each past October's points, for the Postseason page's regression (review/replay_grids.py reads history/points_<year>.json)
    for yr, (wt, pks) in OCT.items():
        if yr == 2026: continue
        games = {g['pk']: g for g in json.load(open(os.path.join(REV, 'history', 'participants_%d.json' % yr)))['games']}
        pts = {}
        for key, d in SETS:
            for r in rows(key, d):
                if r['yr'] != yr: continue
                g = games[r['pk']]; q = pts.setdefault(r['pk'], {'pk': r['pk'], 'yr': yr, 'y': r['y'], 'label': '%d %s, %s at %s' % (yr, g['series'], g['away'], g['home']), 'p': {}})
                q['p'][key] = round(r['p'], 4)
        json.dump(sorted(pts.values(), key=lambda q: q['pk']), open(os.path.join(REV, 'history', 'points_%d.json' % yr), 'w'), indent=1)
        print('history/points_%d.json: %d games' % (yr, len(pts)))


if __name__ == '__main__':
    main()
