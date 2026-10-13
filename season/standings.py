"""
standings.py · v0.1 · 2026-10-13

How well the season replay predicted each team's record and the standings. For every 2026 regular-season game, the home
team's share of its replays (fold A replays the second half with traits from 2025 and the first half; fold B the first half
with traits from 2025 and the second half). A team's expected wins are the sum of its shares over its games.
Against the real season:
  teams      correlation and root mean square error of expected against real wins; the same for three baselines: last
             season's record (2025 win share x games), the other half's record (the fair comparison, since the model also
             learns from the other half), and the Pythagorean record from the real runs (which knows the runs, so it is a
             ceiling rather than a forecast); and luck's ceiling: the best correlation any model could have, given the
             spread of real wins that luck alone makes (binomial) against the spread between teams
  standings  each division's predicted order against the real one (Spearman), the division winners and the twelve
             postseason teams
  games      the favourite's record, the Brier score against the home team always at its season-wide rate, the logistic
             calibration slope c (1 = shares right), and the same for games between two postseason teams

  python3 season/standings.py [--run 2]    -> season/standings_result[2].json

CHANGED
  v0.1  first build (Joe, 2026-10-13: how well do we predict each team's win percentage and the final standings?)
"""
import json, os, sys, math, urllib.request
import numpy as np
from scipy import stats
HERE = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
SUF = sys.argv[sys.argv.index('--run') + 1] if '--run' in sys.argv else ''   # '2': the rerun with the hitter fit's bounds widened
FOLD = {'h2': os.path.expanduser('~/bsim-wt/hist26A' + SUF), 'h1': os.path.expanduser('~/bsim-wt/hist26B' + SUF)}
DIV = {200: 'AL West', 201: 'AL East', 202: 'AL Central', 203: 'NL West', 204: 'NL East', 205: 'NL Central'}


def postseason(tab):
    """the twelve: each division's winner, then the three best others in each league (ties by expected order as given)"""
    out = set()
    for lg in (103, 104):
        L = [t for t in tab if t['league'] == lg]
        winners = [max([t for t in L if t['division'] == d], key=lambda t: t['w']) for d in {t['division'] for t in L}]
        out |= {t['team'] for t in winners}
        rest = sorted([t for t in L if t['team'] not in out], key=lambda t: -t['w'])[:3]
        out |= {t['team'] for t in rest}
    return out


def main():
    sched = json.load(open(os.path.join(HERE, 'schedule.json'))); St = json.load(open(os.path.join(HERE, 'standings.json')))
    byid = {t['team']: t for t in St}
    games = []
    for g in sched:
        f = os.path.join(FOLD[g['block']], 'diag_out', 'replays', '%d.jsonl' % g['pk'])
        if not os.path.exists(f): continue
        R = [json.loads(l) for l in open(f) if l.startswith('{')]
        if len(R) < 50: continue
        p = sum(r['score'][1] > r['score'][0] for r in R) / len(R)
        games.append(dict(g, p=p, y=int(g['final'][1] > g['final'][0]), n=len(R)))
    print('%d games with replays (of %d)' % (len(games), len(sched)))
    teams = sorted(byid)
    exp = {t: 0.0 for t in teams}; real = {t: 0 for t in teams}; ng = {t: 0 for t in teams}
    half = {b: {t: [0, 0] for t in teams} for b in ('h1', 'h2')}
    for g in games:
        exp[g['home']] += g['p']; exp[g['away']] += 1 - g['p']; ng[g['home']] += 1; ng[g['away']] += 1
        w = g['home'] if g['y'] else g['away']; real[w] += 1
    for g in sched:   # every final game for the halves' records (the baseline)
        w = g['home'] if g['final'][1] > g['final'][0] else g['away']
        for t in (g['home'], g['away']): half[g['block']][t][1] += 1
        half[g['block']][w][0] += 1
    # per half: the model's expected wins in that half's games against the real wins in them (each half replayed with traits
    # from the other half and 2025), beside the other half's record and last season's, both as a share times the half's games
    S25 = json.load(urllib.request.urlopen(urllib.request.Request('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2025&standingsTypes=regularSeason', headers=UA), timeout=60))
    w25 = {t['team']['id']: t['wins'] / (t['wins'] + t['losses']) for rec in S25['records'] for t in rec['teamRecords']}
    expH = {b: {t: [0.0, 0] for t in teams} for b in ('h1', 'h2')}
    for g in games:
        expH[g['block']][g['home']][0] += g['p']; expH[g['block']][g['home']][1] += 1
        expH[g['block']][g['away']][0] += 1 - g['p']; expH[g['block']][g['away']][1] += 1
    res = {'games': len(games), 'halves': {}}
    for h, o in (('h1', 'h2'), ('h2', 'h1')):
        if not all(expH[h][t][1] for t in teams): continue
        n = np.array([half[h][t][1] for t in teams], float); W = np.array([half[h][t][0] for t in teams], float)
        cover = np.array([expH[h][t][1] for t in teams], float) / n          # replayed share of the half's games
        E = np.array([expH[h][t][0] for t in teams]) / cover                   # scaled up for any game not replayed
        Bo = n * np.array([half[o][t][0] / half[o][t][1] for t in teams]); Bl = n * np.array([w25[t] for t in teams])
        wp = W / n; luck = np.mean(n * 0.25); tv = max(W.var(ddof=1) - luck, 1e-9)
        row = {'games': int(n.mean()), 'realSd': round(float(W.std(ddof=1)), 2), 'luckSd': round(float(math.sqrt(luck)), 2), 'ceiling': round(float(math.sqrt(tv / W.var(ddof=1))), 3)}
        for lab, X in (('model', E), ('other half', Bo), ('last season', Bl)):
            row[lab] = {'corr': round(float(np.corrcoef(X, W)[0, 1]), 3), 'rmse': round(float(math.sqrt(np.mean((X - W) ** 2))), 2), 'spread': round(float(X.std(ddof=1)), 2)}
        res['halves'][h] = row
        print('%s (%d games a team; real wins spread %.2f, luck alone %.2f, best possible correlation %.3f)' % (h, row['games'], row['realSd'], row['luckSd'], row['ceiling']))
        for lab in ('model', 'other half', 'last season'):
            print('   %-12s corr %.3f   RMSE %.2f wins   spread %.2f' % (lab, row[lab]['corr'], row[lab]['rmse'], row[lab]['spread']))
    # the final standings forecast at the All-Star break: real first-half wins plus the model's second half (fold A, which knows
    # only 2025 and the first half); baselines: the first half's pace, and 0.500 the rest of the way
    teamsL = teams
    W1 = np.array([half['h1'][t][0] for t in teams], float); n2 = np.array([half['h2'][t][1] for t in teams], float)
    if all(expH['h2'][t][1] for t in teams):
        E2 = np.array([expH['h2'][t][0] for t in teams]) / (np.array([expH['h2'][t][1] for t in teams]) / n2)
        Wf = np.array([byid[t]['w'] for t in teams], float)
        F = {'model': W1 + E2, 'first-half pace': W1 + n2 * W1 / np.array([half['h1'][t][1] for t in teams]), '0.500 the rest of the way': W1 + n2 / 2}
        res['finalForecast'] = {}
        print('final standings, forecast at the All-Star break:')
        for lab, X in F.items():
            tabE = [dict(byid[t], w=float(x)) for t, x in zip(teams, X)]; tabR = [dict(byid[t], w=float(w)) for t, w in zip(teams, Wf)]
            divw, rhos = 0, []
            for d in DIV:
                T = [i for i, t in enumerate(teams) if byid[t]['division'] == d]
                divw += int(np.argmax(X[T]) == np.argmax(Wf[T])); rhos.append(stats.spearmanr(X[T], Wf[T])[0])
            pE, pR = postseason(tabE), postseason(tabR)
            res['finalForecast'][lab] = {'rmse': round(float(math.sqrt(np.mean((X - Wf) ** 2))), 2), 'corr': round(float(np.corrcoef(X, Wf)[0, 1]), 3), 'divisionWinners': divw,
                                         'postseasonTeams': len(pE & pR), 'meanDivisionSpearman': round(float(np.mean(rhos)), 2)}
            r = res['finalForecast'][lab]
            print('   %-26s RMSE %.2f wins  corr %.3f  division winners %d/6  postseason teams %d/12  mean division rank correlation %.2f' % (lab, r['rmse'], r['corr'], r['divisionWinners'], r['postseasonTeams'], r['meanDivisionSpearman']))
        res['table'] = sorted([{'team': byid[t]['abbrev'], 'name': byid[t]['name'], 'division': DIV[byid[t]['division']], 'real': int(byid[t]['w']), 'realLosses': int(byid[t]['l']),
                                'firstHalf': int(w1), 'forecast': round(float(f), 1), 'pace': round(float(pc), 1), 'secondHalfExpected': round(float(e2), 1), 'secondHalfReal': int(half['h2'][t][0])}
                               for t, w1, f, pc, e2 in zip(teams, W1, F['model'], F['first-half pace'], E2)], key=lambda r: (r['division'], -r['real']))
    pR = postseason([dict(byid[t], w=float(byid[t]['w'])) for t in teams])
    # games
    p = np.array([g['p'] for g in games]); y = np.array([g['y'] for g in games])
    hw = y.mean(); fav = ((p > 0.5) == (y == 1)).mean()
    brier = np.mean((p - y) ** 2); brier0 = np.mean((hw - y) ** 2)
    lp = np.log(np.clip(p, 0.01, 0.99) / (1 - np.clip(p, 0.01, 0.99)))
    import statsmodels.api as sm
    m = sm.Logit(y, sm.add_constant(lp)).fit(disp=0)
    playoff = [i for i, g in enumerate(games) if g['home'] in pR and g['away'] in pR]
    pp, yp = p[playoff], y[playoff]
    mp = sm.Logit(yp, sm.add_constant(np.log(np.clip(pp, .01, .99) / (1 - np.clip(pp, .01, .99))))).fit(disp=0)
    res['gameLevel'] = {'n': len(games), 'homeWinRate': round(float(hw), 3), 'favouriteWon': round(float(fav), 3), 'brier': round(float(brier), 4), 'brierHomeRate': round(float(brier0), 4),
                        'calib': [round(float(m.params[1]), 2), round(float(m.bse[1]), 2)], 'lrP': float(m.llr_pvalue), 'shareSd': round(float(p.std()), 3),
                        'betweenPostseasonTeams': {'n': len(playoff), 'favouriteWon': round(float(((pp > 0.5) == (yp == 1)).mean()), 3), 'shareSd': round(float(pp.std()), 3),
                                                   'calib': [round(float(mp.params[1]), 2), round(float(mp.bse[1]), 2)], 'lrP': float(mp.llr_pvalue)}}
    print('games: favourite won %.1f%%; Brier %.4f vs %.4f for the home team at its rate (%.3f); calibration c %.2f (se %.2f), p %.2g; share sd %.3f' % (100 * fav, brier, brier0, hw, m.params[1], m.bse[1], m.llr_pvalue, p.std()))
    print('games between two postseason teams (%d): favourite won %.1f%%, share sd %.3f, calibration c %.2f (se %.2f), p %.2g' % (len(playoff), 100 * res['gameLevel']['betweenPostseasonTeams']['favouriteWon'], pp.std(), mp.params[1], mp.bse[1], mp.llr_pvalue))
    json.dump(res, open(os.path.join(HERE, 'standings_result%s.json' % SUF), 'w'), indent=1)


if __name__ == '__main__':
    main()
