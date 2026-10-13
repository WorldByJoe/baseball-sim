"""
coaching.py · v0.1 · 2026-10-13

A team "coaching" term (Joe, 2026-10-13): what a team wins beyond what its players' traits say, a catch-all for
everything the model leaves out (managing, defence, baserunning, the bullpen's use, sequencing), to be broken apart later.

Joe's tally: +1 for each game a team won that the replays said it should lose (its share under one half), -1 for each it
lost that it should have won. The tally has a bias: a team that is usually the underdog collects points from the upsets
the model itself expects (a 45% underdog wins 45% of its games), so beside it is the tally minus its expectation, and the
smooth version the model uses, wins minus expected wins (each game won adds 1 minus the share, each lost subtracts the share).

The term, per team: c = (wins - expected) / sum p(1-p), the step in log-odds that would make its expected wins its real
ones, shrunk toward zero by how much of it luck alone could make (empirical Bayes: the spread of c between teams against
each team's sampling variance 1 / sum p(1-p)). It is fitted on each fold's training half from in-sample replays (the same
traits replaying the games they were fitted on, run 4's diag_out/replays_in) and applied to the other half's replays:
p' = logistic(logit p + c_home - c_away). Scored as standings.py scores the model, against the model without it.
And the whole season's term (both halves in sample) for where to look.

  python3 season/coaching.py [run, default 4]     -> season/coaching.json

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import json, os, sys, math
import numpy as np
from scipy import stats
import statsmodels.api as sm
HERE = os.path.dirname(os.path.abspath(__file__))
RUN = sys.argv[1] if len(sys.argv) > 1 else '4'
WT = {'h2': os.path.expanduser('~/bsim-wt/hist26A' + RUN), 'h1': os.path.expanduser('~/bsim-wt/hist26B' + RUN)}   # worktree that replays a half out of sample
lg = lambda p: math.log(min(max(p, 1e-4), 1 - 1e-4) / (1 - min(max(p, 1e-4), 1 - 1e-4)))
ex = lambda z: 1 / (1 + math.exp(-z))


def shares(sched, block, wt, sub):
    out = {}
    for g in sched:
        if g['block'] != block: continue
        f = os.path.join(wt, 'diag_out', sub, '%d.jsonl' % g['pk'])
        if not os.path.exists(f): continue
        R = [json.loads(l) for l in open(f) if l.startswith('{')]
        if len(R) >= 50: out[g['pk']] = sum(r['score'][1] > r['score'][0] for r in R) / len(R)
    return out


def term(games, P):
    """per team: Joe's tally and its expectation, wins minus expected, the log-odds step c, its sampling variance"""
    T = {}
    for g in games:
        if g['pk'] not in P: continue
        p = P[g['pk']]; yh = int(g['final'][1] > g['final'][0])
        for t, pt, y in ((g['home'], p, yh), (g['away'], 1 - p, 1 - yh)):
            d = T.setdefault(t, {'tally': 0, 'tallyExp': 0.0, 'w': 0, 'e': 0.0, 'info': 0.0, 'n': 0})
            d['tally'] += (1 if (y and pt < 0.5) else 0) - (1 if (not y and pt > 0.5) else 0)
            d['tallyExp'] += (pt if pt < 0.5 else 0) - ((1 - pt) if pt > 0.5 else 0)
            d['w'] += y; d['e'] += pt; d['info'] += pt * (1 - pt); d['n'] += 1
    for d in T.values(): d['c'] = (d['w'] - d['e']) / d['info']; d['v'] = 1 / d['info']
    c = np.array([d['c'] for d in T.values()]); v = np.array([d['v'] for d in T.values()])
    tau2 = max(0.0, c.var() - v.mean())
    for d in T.values(): d['shrink'] = tau2 / (tau2 + d['v']); d['cs'] = d['shrink'] * d['c']
    return T, tau2


def score(games, P):
    y = np.array([int(g['final'][1] > g['final'][0]) for g in games if g['pk'] in P]); p = np.array([P[g['pk']] for g in games if g['pk'] in P])
    fav = float(np.mean((p > 0.5) == (y == 1))); brier = float(np.mean((p - y) ** 2))
    X = sm.add_constant(np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4))))
    m = sm.Logit(y, X).fit(disp=0)
    teams = sorted({g['home'] for g in games}); E = {t: 0.0 for t in teams}; W = {t: 0 for t in teams}
    for g in games:
        if g['pk'] not in P: continue
        E[g['home']] += P[g['pk']]; E[g['away']] += 1 - P[g['pk']]
        W[g['home'] if g['final'][1] > g['final'][0] else g['away']] += 1
    e = np.array([E[t] for t in teams]); w = np.array([W[t] for t in teams])
    return {'favouriteWon': round(fav, 4), 'brier': round(brier, 4), 'calib': [round(float(m.params[1]), 2), round(float(m.bse[1]), 2)],
            'teamCorr': round(float(stats.pearsonr(e, w)[0]), 3), 'teamRmse': round(float(np.sqrt(np.mean((e - w) ** 2))), 2), 'teamSpread': round(float(e.std()), 2)}


def main():
    sched = json.load(open(os.path.join(HERE, 'schedule.json')))
    ab = {}
    for g in sched[:400]:
        G = json.load(open(os.path.join(HERE, 'games', '%d.json' % g['pk'])))
        for s in ('away', 'home'): ab[G['teams'][s]['id']] = G['teams'][s]['abbrev']
    res = {'run': RUN, 'halves': {}}
    for test, train in (('h2', 'h1'), ('h1', 'h2')):
        Pin = shares(sched, train, WT[test], 'replays_in')   # the test half's worktree holds its own training half, replayed in sample
        Pout = shares(sched, test, WT[test], 'replays')
        T, tau2 = term([g for g in sched if g['block'] == train], Pin)
        Padj = {}
        for g in sched:
            if g['block'] != test or g['pk'] not in Pout: continue
            ch, ca = T.get(g['home'], {}).get('cs', 0), T.get(g['away'], {}).get('cs', 0)
            Padj[g['pk']] = ex(lg(Pout[g['pk']]) + ch - ca)
        G = [g for g in sched if g['block'] == test]
        base, adj = score(G, Pout), score(G, Padj)
        # the plain baseline: the training half's record as the only skill (log-odds of its win share)
        WR = {}
        for g in sched:
            if g['block'] != train: continue
            for t in (g['home'], g['away']): WR.setdefault(t, [0, 0])[1] += 1
            WR[g['home'] if g['final'][1] > g['final'][0] else g['away']][0] += 1
        Prec = {g['pk']: ex(lg(WR[g['home']][0] / WR[g['home']][1]) - lg(WR[g['away']][0] / WR[g['away']][1])) for g in G}
        rec = score(G, Prec)
        sd_c = math.sqrt(tau2)
        res['halves'][test] = {'trainedOn': train, 'tau': round(sd_c, 3), 'model': base, 'modelPlusCoaching': adj, 'trainingRecordOnly': rec,
                               'teams': {ab.get(t, str(t)): {k: round(v, 3) if isinstance(v, float) else v for k, v in d.items()} for t, d in T.items()}}
        print('%s, coaching fitted on %s (in sample): true spread of the term %.3f log-odds a game (%.1f wins over 81 games)' % (test, train, sd_c, sd_c * 81 * 0.25))
        for lab, s in (('model', base), ('model + coaching', adj), ('training record only', rec)):
            print('   %-22s team corr %.3f  RMSE %.2f  spread %.2f | games: favourite won %.3f  Brier %.4f  calibration c %.2f (se %.2f)' % (
                lab, s['teamCorr'], s['teamRmse'], s['teamSpread'], s['favouriteWon'], s['brier'], s['calib'][0], s['calib'][1]))
    # the whole season, in sample, for where to look
    Pin_all = {}
    for test, train in (('h2', 'h1'), ('h1', 'h2')): Pin_all.update(shares(sched, train, WT[test], 'replays_in'))
    T, tau2 = term(sched, Pin_all)
    res['season'] = {'tau': round(math.sqrt(tau2), 3), 'teams': {ab.get(t, str(t)): {k: round(v, 3) if isinstance(v, float) else v for k, v in d.items()} for t, d in T.items()}}
    tl = np.array([d['tally'] for d in T.values()]); te = np.array([d['tally'] - d['tallyExp'] for d in T.values()]); wm = np.array([d['w'] - d['e'] for d in T.values()])
    print('season, in sample: true spread of the term %.3f log-odds a game; Joe\'s tally vs wins-minus-expected r %.2f (minus its expectation: r %.2f)' % (
        math.sqrt(tau2), stats.pearsonr(tl, wm)[0], stats.pearsonr(te, wm)[0]))
    print('   team  tally (expected)  wins - expected  term (shrunk, log-odds)')
    for t, d in sorted(T.items(), key=lambda kv: -kv[1]['cs']):
        print('   %-4s  %+4d (%+5.1f)      %+5.1f           %+.3f' % (ab.get(t, t), d['tally'], d['tallyExp'], d['w'] - d['e'], d['cs']))
    json.dump(res, open(os.path.join(HERE, 'coaching.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
