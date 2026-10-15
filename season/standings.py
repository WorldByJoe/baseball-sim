"""
standings.py · v0.4 · 2026-10-14

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

  python3 season/standings.py [--run 2] [--sub replays_home] [--vs 6]    -> season/standings_result[2][_home].json

CHANGED
  v0.4  SEASON_Y: another season (2025) (the model review)
  v0.3  the protocol: Brier and calibration net of replay noise, the team-strength error, --vs RUN paired bootstrap (the model review)
  v0.2  --sub: another replay folder in the worktrees (replays_home: the home hitters' edge on)
  v0.1  first build (Joe, 2026-10-13: how well do we predict each team's win percentage and the final standings?)
"""
import json, os, sys, math, urllib.request
import numpy as np
from scipy import stats
HERE = os.path.dirname(os.path.abspath(__file__))
SY = int(os.environ.get('SEASON_Y', '2026')); PY = SY - 1; YY = '%02d' % (SY % 100)   # v0.4: SEASON_Y=2025, its folds in season/y2025, worktrees hist25A/B
BASE = HERE if SY == 2026 else os.path.join(HERE, 'y%d' % SY)
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
SUF = sys.argv[sys.argv.index('--run') + 1] if '--run' in sys.argv else ''   # '2': the rerun with the hitter fit's bounds widened
SUB = sys.argv[sys.argv.index('--sub') + 1] if '--sub' in sys.argv else 'replays'
FOLD = {'h2': os.path.expanduser('~/bsim-wt/hist%sA' % YY + SUF), 'h1': os.path.expanduser('~/bsim-wt/hist%sB' % YY + SUF)}
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
    sched = json.load(open(os.path.join(BASE, 'schedule.json'))); St = json.load(open(os.path.join(BASE, 'standings.json')))
    byid = {t['team']: t for t in St}
    games = []
    for g in sched:
        f = os.path.join(FOLD[g['block']], 'diag_out', SUB, '%d.jsonl' % g['pk'])
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
    S25 = json.load(urllib.request.urlopen(urllib.request.Request('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=%d&standingsTypes=regularSeason' % PY, headers=UA), timeout=60))
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
    # v0.3 THE PROTOCOL (the model review, 2026-10-14): replay noise taken out of the Brier (each share's Monte Carlo variance
    # p(1-p)/n adds to it) and out of the calibration slope (noise in the regressor attenuates c by var_true / var_observed of
    # the logit shares); the team-strength error (the RMSE with luck's binomial part taken out), per half and pooled per 162
    # games; with --vs RUN, the paired differences from that run on the same games and teams, by bootstrap
    ng_ = np.array([g['n'] for g in games], float); mc = p * (1 - p) / ng_
    lv = 1 / (np.clip(p, .02, .98) * (1 - np.clip(p, .02, .98)) * ng_); lam = max(lp.var() - lv.mean(), 1e-9) / lp.var()
    res['protocol'] = {'brierMC': round(float(brier - mc.mean()), 4), 'calibDeattenuated': round(float(m.params[1] / lam), 2), 'attenuation': round(float(lam), 3)}
    tse = {}
    for h in res['halves']:
        r_ = res['halves'][h]; e = math.sqrt(max(r_['model']['rmse'] ** 2 - r_['luckSd'] ** 2, 0)); tse[h] = (e, r_['games'])
    if tse:
        pooled = math.sqrt(sum((e / n) ** 2 * n for e, n in tse.values()) / sum(n for e, n in tse.values()))
        res['protocol']['teamStrengthError'] = {h: round(e / n, 4) for h, (e, n) in tse.items()}; res['protocol']['teamStrengthError']['pooledWinsPer162'] = round(pooled * 162, 2)
    print('protocol: Brier less replay noise %.4f; calibration de-attenuated %.2f (attenuation %.3f); team-strength error %s, pooled %.1f wins per 162'
          % (res['protocol']['brierMC'], res['protocol']['calibDeattenuated'], lam, {h: round(e / n, 4) for h, (e, n) in tse.items()}, res['protocol'].get('teamStrengthError', {}).get('pooledWinsPer162', float('nan'))))
    if '--vs' in sys.argv:
        V = sys.argv[sys.argv.index('--vs') + 1]
        FV = {'h2': os.path.expanduser('~/bsim-wt/hist%sA' % YY + V), 'h1': os.path.expanduser('~/bsim-wt/hist%sB' % YY + V)}
        pv = {}
        for g in games:
            f = os.path.join(FV[g['block']], 'diag_out', 'replays', '%d.jsonl' % g['pk'])
            if os.path.exists(f):
                R = [json.loads(l) for l in open(f) if l.startswith('{')]
                if len(R) >= 50: pv[g['pk']] = (sum(r['score'][1] > r['score'][0] for r in R) / len(R), len(R))
        idx = [i for i, g in enumerate(games) if g['pk'] in pv]
        a = np.array([games[i]['p'] for i in idx]); b = np.array([pv[games[i]['pk']][0] for i in idx]); yy = y[idx]
        na = np.array([games[i]['n'] for i in idx], float); nb = np.array([pv[games[i]['pk']][1] for i in idx], float)
        d = ((a - yy) ** 2 - a * (1 - a) / na) - ((b - yy) ** 2 - b * (1 - b) / nb)   # each Brier less its replay noise
        rng_ = np.random.default_rng(1); bs = [d[rng_.integers(0, len(d), len(d))].mean() for _ in range(2000)]
        out = {'games': len(idx), 'brierDiff': round(float(d.mean()), 5), 'brierDiffSe': round(float(np.std(bs)), 5)}
        for h in ('h1', 'h2'):
            T = {t: [0.0, 0.0, 0] for t in teams}
            for i in idx:
                g = games[i]
                if g['block'] != h: continue
                T[g['home']][0] += games[i]['p']; T[g['away']][0] += 1 - games[i]['p']; T[g['home']][1] += pv[g['pk']][0]; T[g['away']][1] += 1 - pv[g['pk']][0]
            W = np.array([half[h][t][0] for t in teams], float); A_ = np.array([T[t][0] for t in teams]); B_ = np.array([T[t][1] for t in teams])
            dc = [np.corrcoef(A_[k], W[k])[0, 1] - np.corrcoef(B_[k], W[k])[0, 1] for k in (rng_.integers(0, len(teams), len(teams)) for _ in range(2000))]
            out[h] = {'corrDiff': round(float(np.corrcoef(A_, W)[0, 1] - np.corrcoef(B_, W)[0, 1]), 3), 'se': round(float(np.std(dc)), 3)}
        res['vs' + V] = out
        print('paired against run %s on %d games: Brier difference %+.5f (se %.5f); team correlation difference h1 %+.3f (se %.3f), h2 %+.3f (se %.3f)'
              % (V, out['games'], out['brierDiff'], out['brierDiffSe'], out['h1']['corrDiff'], out['h1']['se'], out['h2']['corrDiff'], out['h2']['se']))
    json.dump(res, open(os.path.join(BASE, 'standings_result%s%s.json' % (SUF, '' if SUB == 'replays' else SUB[7:])), 'w'), indent=1)


if __name__ == '__main__':
    main()
