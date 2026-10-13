"""
nodata.py · v0.1 · 2026-10-13

Did the men with no major-league data in a fold's window bend the team forecasts? Per team and half: the share of its
appearances (lineup spots and pitchers used) by men with nothing in the window (no pitch seen as a hitter, no pitch type
thrown as a pitcher), before and after season/aaa_fold.py's Triple-A priors (after: the men with neither); and each run's
real minus expected wins in that half. A model that treats those men right shows no correlation between the share and
the miss.

  python3 season/nodata.py [run suffixes, e.g. 2,3]    -> season/nodata.json

CHANGED
  v0.1  first build (Joe, 2026-10-13: Triple-A priors for men with no data)
"""
import json, os, sys
import numpy as np
from scipy import stats
HERE = os.path.dirname(os.path.abspath(__file__))
FOLDOF = {'h2': 'foldA', 'h1': 'foldB'}
WT = {'h2': 'hist26A', 'h1': 'hist26B'}


def empty(fold):
    """ids with no hitting summaries, and ids with no pitch types, in a fold's measured records"""
    M = json.load(open(os.path.join(HERE, fold, 'players_measured.json')))['players']
    return ({r['id'] for r in M if not r['summaries'].get('hitting')}, {r['id'] for r in M if not (r['summaries'].get('pitching') or {}).get('pitchTypes')})


def main(runs):
    sched = json.load(open(os.path.join(HERE, 'schedule.json')))
    out = {}
    for h in ('h1', 'h2'):
        before = empty(FOLDOF[h]); after = empty(FOLDOF[h] + '_aaa') if os.path.exists(os.path.join(HERE, FOLDOF[h] + '_aaa')) else None
        share = {}; tot = {}; real = {}; exp = {r: {} for r in runs}
        for g in sched:
            if g['block'] != h: continue
            G = json.load(open(os.path.join(HERE, 'games', '%d.json' % g['pk'])))
            for s, t in (('away', g['away']), ('home', g['home'])):
                ids_h = [q['id'] for q in G['lineups'][s]]; ids_p = list(G['pitchers'][s])
                c = share.setdefault(t, [0, 0]); tot[t] = tot.get(t, 0) + len(ids_h) + len(ids_p)
                c[0] += sum(i in before[0] for i in ids_h) + sum(i in before[1] for i in ids_p)
                if after: c[1] += sum(i in after[0] for i in ids_h) + sum(i in after[1] for i in ids_p)
            w = g['home'] if g['final'][1] > g['final'][0] else g['away']; real[w] = real.get(w, 0) + 1; real.setdefault(g['home'], 0); real.setdefault(g['away'], 0)
            for r in runs:
                f = os.path.expanduser('~/bsim-wt/%s%s/diag_out/replays/%d.jsonl' % (WT[h], r, g['pk']))
                if not os.path.exists(f): continue
                R = [json.loads(l) for l in open(f) if l.startswith('{')]
                p = sum(x['score'][1] > x['score'][0] for x in R) / len(R)
                exp[r][g['home']] = exp[r].get(g['home'], 0) + p; exp[r][g['away']] = exp[r].get(g['away'], 0) + 1 - p
        teams = sorted(share)
        sb = np.array([share[t][0] / tot[t] for t in teams]); sa = np.array([share[t][1] / tot[t] for t in teams])
        o = {'shareBefore': {'mean': round(float(sb.mean()), 4), 'max': round(float(sb.max()), 4), 'byTeam': {str(t): round(float(x), 4) for t, x in zip(teams, sb)}},
             'shareAfter': {'mean': round(float(sa.mean()), 4), 'max': round(float(sa.max()), 4)} if after else None, 'runs': {}}
        for r in runs:
            if len(exp[r]) < 30: continue
            miss = np.array([real[t] - exp[r][t] for t in teams])
            rb, pb = stats.pearsonr(sb, miss)
            o['runs'][r or 'first'] = {'corrShareBeforeMiss': [round(float(rb), 3), round(float(pb), 4)], 'missSd': round(float(miss.std()), 2)}
            print('%s run %-5s  no-data share before %.3f (max %.3f), after %s;  corr(share before, real - expected) %+.2f (p %.3f)' % (
                h, r or 'first', sb.mean(), sb.max(), '%.3f' % sa.mean() if after else '-', rb, pb))
        out[h] = o
    json.dump(out, open(os.path.join(HERE, 'nodata.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1].split(',') if len(sys.argv) > 1 else ['', '2', '3'])
