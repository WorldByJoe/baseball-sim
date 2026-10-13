"""
persistence.py · v0.1 · 2026-10-12

Do traits change between seasons in a way that lasts? A player's deviation from the population can be split three ways:
  lasting     the same every season
  drifting    a change that carries into the next season and fades over the years after (correlation rho^lag)
  blip        one season's own, gone the next
Lasting plus blips predicts the same correlation one and two seasons apart; drifting predicts a lower one two apart.

  measured traits   the true-value correlation at each lag (season-centred, so a league-wide shift is not read as players
                    changing; the standard errors' share taken out), with a bootstrap over players; and, as one persistent
                    change we can name, the season-to-season change against age
  hidden traits     history/seasons.py's likelihood under three models of the between-season correlation:
                    P lasting + blip (c_lag = phi), A drifting (c_lag = rho^lag), M all three (c_lag = w_last + w_drift rho^lag)

  python3 history/persistence.py [years, e.g. 2023,2024,2025,2026]      -> history/persistence.json

CHANGED
  v0.1  first build (Joe, 2026-10-12: is there evidence of a persistent change in traits between seasons?)
"""
import json, os, sys, math
import numpy as np
from scipy.optimize import minimize
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import seasons as SE
from seasons import FH, NH

sig = lambda z: 1 / (1 + np.exp(-z))


def measured_lags(recs, years, rng):
    out = {}
    for who, where, k in SE.MEASURED + [('hitter', 'traits', 'age')]:
        if k == 'age': continue
        ser = {}
        for r in recs:
            o = (r['traits'].get(k) if where == 'traits' else (r['traits'].get('pitching') or {}).get(k) if where == 'pitching_traits'
                 else (r['summaries'].get(where) or {}).get(k)) or {}
            s = {y: (o[str(y)]['mean'], o[str(y)]['se']) for y in years if isinstance(o.get(str(y)), dict) and o[str(y)].get('mean') is not None and o[str(y)].get('se')}
            if len(s) >= 2: ser[r['id']] = s
        if len(ser) < 30: continue
        ids = list(ser)
        def corr(sub):
            mu = {y: np.mean([ser[i][y][0] for i in sub if y in ser[i]]) for y in years if any(y in ser[i] for i in sub)}
            tv = np.mean([np.var([ser[i][y][0] for i in sub if y in ser[i]]) - np.mean([ser[i][y][1] ** 2 for i in sub if y in ser[i]]) for y in mu])
            c = {}
            for lag in range(1, len(years)):
                prods = [(ser[i][y][0] - mu[y]) * (ser[i][y + lag][0] - mu[y + lag]) for i in sub for y in years if y in ser[i] and y + lag in ser[i]]
                if len(prods) >= 15: c[lag] = np.mean(prods) / tv
            return c, tv
        c, tv = corr(ids)
        boots = [corr(list(rng.choice(ids, len(ids), replace=True)))[0] for _ in range(200)]
        out['%s %s' % (who, k)] = {'trueSd': round(float(math.sqrt(max(tv, 0))), 4),
                                   'lags': {str(l): {'corr': round(float(v), 3), 'ci90': [round(float(np.percentile([b[l] for b in boots if l in b], q)), 3) for q in (5, 95)],
                                                     'pairs': sum(1 for i in ids for y in years if y in ser[i] and y + l in ser[i])} for l, v in c.items()}}
        if 2 in c and 1 in c:
            d = [b[1] - b[2] for b in boots if 1 in b and 2 in b]
            out['%s %s' % (who, k)]['lag1MinusLag2'] = {'est': round(float(c[1] - c[2]), 3), 'ci90': [round(float(np.percentile(d, 5)), 3), round(float(np.percentile(d, 95)), 3)]}
    return out


def aging(recs, years, meta):
    """season-to-season change in bat speed, sprint speed and fastball speed against age at the earlier season"""
    age = {r['id']: r for r in meta}
    out = {}
    for who, where, k in (('hitter', 'traits', 'batSpeed'), ('hitter', 'traits', 'speed'), ('pitcher', 'pitching_traits', 'fbVelo')):
        X, Y = [], []
        for r in recs:
            b = age.get(r['id'], {}).get('birthDate')
            if not b: continue
            o = (r['traits'].get(k) if where == 'traits' else (r['traits'].get('pitching') or {}).get(k)) or {}
            for y in years:
                a, c = o.get(str(y)), o.get(str(y + 1))
                if isinstance(a, dict) and isinstance(c, dict) and a.get('mean') is not None and c.get('mean') is not None:
                    X.append(y + 0.75 - int(b[:4]) - (int(b[5:7]) - 1) / 12); Y.append(c['mean'] - a['mean'])
        X, Y = np.array(X), np.array(Y)
        A = np.column_stack([np.ones_like(X), X - 30]); coef, res, *_ = np.linalg.lstsq(A, Y, rcond=None)
        s2 = ((Y - A @ coef) ** 2).sum() / (len(Y) - 2); se = np.sqrt(np.diag(s2 * np.linalg.inv(A.T @ A)))
        bins = {}
        for lo in (21, 25, 28, 31, 34):
            m = (X >= lo) & (X < lo + (4 if lo == 21 else 3 if lo < 34 else 10))
            if m.sum() >= 8: bins['%d-%d' % (lo, lo + (4 if lo == 21 else 3 if lo < 34 else 10) - 1)] = [round(float(Y[m].mean()), 3), int(m.sum())]
        out['%s %s' % (who, k)] = {'changeAt30': [round(float(coef[0]), 3), round(float(se[0]), 3)], 'perYearOfAge': [round(float(coef[1]), 4), round(float(se[1]), 4)], 'byAge': bins, 'n': len(Y)}
    return out


def kernel(model, th, T):
    """c[lag] for lag 0..T-1 per trait (NH x T), from the model's parameters (unconstrained)"""
    th = th.reshape(-1, NH); lag = np.arange(T)[None, :]
    if model == 'P': phi = sig(th[0])[:, None]; c = np.where(lag == 0, 1.0, phi)
    elif model == 'A': rho = sig(th[0])[:, None]; c = rho ** lag
    else:
        e = np.exp(th[:3]); w = e / (1 + e.sum(0)); rho = sig(th[3])[:, None]   # w_last, w_drift, w_blip = rest
        c = np.where(lag == 0, 1.0, w[0][:, None] + w[1][:, None] * rho ** lag)
    return c


def ucov_k(S0h, c):
    T = c.shape[1]
    return np.block([[S0h @ np.diag(c[:, abs(i - j)]) @ S0h for j in range(T)] for i in range(T)])


def ll(model, th, players, years):
    tot = 0.0
    for P, S0h, (y, mean, B, R), idx in players:
        c = kernel(model, th, len(years))
        # this player's seasons are a subset of the years: the kernel at the lags between them
        Tp = len(idx); cc = np.stack([c[:, abs(idx[i] - idx[0])] for i in range(Tp)], 1)
        blocks = [[S0h @ np.diag(c[:, abs(idx[i] - idx[j])]) @ S0h for j in range(Tp)] for i in range(Tp)]
        Cu = np.block(blocks)
        C = B @ Cu @ B.T + R
        L = np.linalg.cholesky(C); r = np.linalg.solve(L, y - mean)
        tot += -0.5 * (r @ r) - np.log(np.diag(L)).sum()
    return tot


def main(years):
    rng = np.random.default_rng(5)
    recs = json.load(open(os.path.join(HERE, 'players_measured.json')))['players']
    meta = json.load(open(os.path.join(HERE, 'rosters.json')))['players']
    out = {'years': years, 'measured': measured_lags(recs, years, rng), 'aging': aging(recs, years, meta)}
    E = FH.emulator(os.path.join(HERE, '..', 'diag_out', 'emu.jsonl'))
    players = []
    for r in recs:
        if not (r['summaries'].get('hitting') or {}): continue
        P, idx = [], []
        for k, y in enumerate(years):
            q = SE.pieces(SE.season_rec(r, y, years), E)
            if q: P.append(q); idx.append(k)
        if len(P) < 2: continue
        players.append((P, SE.sqrtm(P[0]['S0']), SE.stack(P, E), idx))
    print('%d hitters with 2+ seasons' % len(players), file=sys.stderr)
    fits = {}
    for model, npar in (('P', 1), ('A', 1), ('M', 4)):
        th0 = np.zeros(npar * NH) if model != 'M' else np.concatenate([np.full(NH, 1.0), np.full(NH, 0.0), np.full(NH, -1.0), np.full(NH, 1.0)])
        res = minimize(lambda t: -ll(model, t, players, years), th0, method='L-BFGS-B', bounds=[(-6, 6)] * (npar * NH), options={'maxiter': 300})
        c = kernel(model, res.x, len(years))
        fits[model] = {'loglik': round(float(-res.fun), 2), 'params': npar * NH,
                       'corrByLag': {h: [round(float(v), 3) for v in c[k]] for k, h in enumerate(SE.HIDDEN)}}
        if model == 'M':
            th = res.x.reshape(-1, NH); e = np.exp(th[:3]); w = e / (1 + e.sum(0))
            fits[model]['shares'] = {h: {'lasting': round(float(w[0][k]), 3), 'drifting': round(float(w[1][k]), 3), 'blip': round(float(1 - w[0][k] - w[1][k]), 3), 'rho': round(float(sig(th[3][k])), 3)} for k, h in enumerate(SE.HIDDEN)}
        print('model %s: log-likelihood %.2f (%d parameters)' % (model, -res.fun, npar * NH), file=sys.stderr)
    out['hidden'] = fits
    json.dump(out, open(os.path.join(HERE, 'persistence.json'), 'w'), indent=1)


if __name__ == '__main__':
    main([int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '2024,2025,2026').split(',')])
