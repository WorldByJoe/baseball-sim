"""
seasons.py · v0.1 · 2026-10-12

How much each hitter's hidden traits carry over from one season to the next, and each hitter's traits season by season
with that carry-over used.

Each season is fitted as review/fit_hitters.py fits the pooled 2025-26 numbers (the same linear emulator, the same
prior: the model's major leaguers, conditional on the traits measured that season), but the seasons are tied together:
  hidden traits in season s (standardised) = what that season's measured traits predict (m0_s) + the player's own
                                             deviation u_s
  u_s = S0^1/2 (phi^1/2 a + (1 - phi)^1/2 b_s)      a: his lasting part, b_s: that season's part, all N(0, 1)
so u_s has the prior's spread every season, and phi sets how much of it lasts: phi 1, the same trait every year; phi 0, a
new draw each year. The emulator's structural error (what no trait reaches) is a property of the player, so it is
shared by his seasons; the sampling error is not. phi (one per trait) is fitted by the marginal likelihood of every
player's seasons together, and reported as the year-to-year correlation of each trait it implies.

For the measured traits (bat speed, swing length, attack angle, swing tilt) the carry-over is read straight off the
seasons: the squared change between seasons against what the two seasons' standard errors account for.

Writes history/seasons.json: phi and the implied correlations with their bootstrap ranges, the measured traits'
carry-over, and per hitter and season three estimates of the hidden traits (mean and sd, natural units):
  alone     that season by itself (fit_hitters.py's posterior)
  through   that season and the ones before (what was known by that October: the replays use this)
  all       every season (the best estimate of that season's traits)

  python3 history/seasons.py [measured.json] [years, e.g. 2024,2025,2026] [bootstrap draws]

CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys, math
import numpy as np
from scipy.optimize import minimize
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'review'))
import fit_hitters as FH

KNOWN, HIDDEN, MEAS = FH.KNOWN, FH.HIDDEN, FH.MEAS
NK, NH = len(KNOWN), len(HIDDEN)


def view(o, s, years):
    """a record as season s alone: each year-keyed quantity's 'pooled' becomes season s's value (absent if he has none)"""
    ys = {str(y) for y in years}
    if isinstance(o, dict):
        if 'pooled' in o and ys & set(o):
            v = o.get(str(s))
            return {'pooled': view(v, s, years)} if v is not None else {}
        return {k: view(v, s, years) for k, v in o.items()}
    if isinstance(o, list):
        return [view(v, s, years) for v in o]
    return o


def season_rec(rec, s, years):
    r = view(rec, s, years)
    ss = rec.get('seasonStats') or {}
    r['seasonStats'] = {'hitting_2026': ss.get('hitting_%d' % s), 'hitting_2025': None, 'pitching_2026': ss.get('pitching_%d' % s)}
    return r


def pieces(rec, E):
    """fit_hitters.posterior's linear-Gaussian parts for one record (standardised hidden traits): the conditional prior
    (m0, S0), and the likelihood y = c0 + Bh z + e with e's sampling variance se2 and the measures' rows"""
    mu, sd, coef, X = E['mu'], E['sd'], E['coef'], E['X']
    kv = FH.known_of(rec, E)
    if (rec['traits'].get('batSpeed') or {}).get('pooled', {}).get('mean') is None:
        return None   # no bat tracking that season: nothing to condition on
    xk = np.array([kv[k] for k in KNOWN]); zk = (xk - mu[:NK]) / sd[:NK]
    Z = (X - mu) / sd; C = np.cov(Z.T)
    Ckk, Chk, Chh = C[:NK, :NK], C[NK:, :NK], C[NK:, NK:]
    m0 = Chk @ np.linalg.solve(Ckk, zk); S0 = Chh - Chk @ np.linalg.solve(Ckk, Chk.T)
    t = FH.target(rec)
    rows = [j for j, m in enumerate(MEAS) if t[m][0] is not None]
    if len(rows) < 8:
        return None
    y = np.array([t[MEAS[j]][0] for j in rows]); se2 = np.array([t[MEAS[j]][1] ** 2 for j in rows])
    c0 = coef[0, rows] + zk @ coef[1:NK + 1][:, rows]; Bh = coef[NK + 1:][:, rows].T
    return {'m0': m0, 'S0': S0, 'c0': c0, 'Bh': Bh, 'y': y, 'se2': se2, 'rows': rows, 'known': kv}


def sqrtm(S):
    w, V = np.linalg.eigh(S); return V @ np.diag(np.sqrt(np.clip(w, 0, None))) @ V.T


def ucov(S0h, phi, T):
    """Cov of (u_1..u_T): S0 within a season, S0^1/2 phi S0^1/2 between seasons"""
    within = S0h @ S0h; between = S0h @ np.diag(phi) @ S0h
    return np.block([[within if i == j else between for j in range(T)] for i in range(T)])


def stack(P, E):
    """one player's seasons stacked: mean, B, and the error covariance (sampling within a season; structural shared)"""
    T = len(P); n = [len(p['rows']) for p in P]; N = sum(n)
    mean = np.concatenate([p['c0'] + p['Bh'] @ p['m0'] for p in P]); y = np.concatenate([p['y'] for p in P])
    B = np.zeros((N, NH * T)); R = np.zeros((N, N)); o = 0
    offs = []
    for i, p in enumerate(P):
        B[o:o + n[i], NH * i:NH * (i + 1)] = p['Bh']; R[o:o + n[i], o:o + n[i]] += np.diag(p['se2']); offs.append(o); o += n[i]
    st = E['struct']
    for i, p in enumerate(P):
        for j, q in enumerate(P):
            for a, ra in enumerate(p['rows']):
                for b, rb in enumerate(q['rows']):
                    if ra == rb: R[offs[i] + a, offs[j] + b] += st[ra]
    return y, mean, B, R


def loglik(phi, players, E):
    tot = 0.0
    for P, S0h, (y, mean, B, R) in players:
        C = B @ ucov(S0h, phi, len(P)) @ B.T + R
        L = np.linalg.cholesky(C); r = np.linalg.solve(L, y - mean)
        tot += -0.5 * (r @ r) - np.log(np.diag(L)).sum()
    return tot


def fit_phi(players, E, start=None):
    multi = [p for p in players if len(p[0]) > 1]
    f = lambda th: -loglik(1 / (1 + np.exp(-th)), multi, E)
    th0 = np.zeros(NH) if start is None else np.log(start / (1 - start))
    res = minimize(f, th0, method='L-BFGS-B', bounds=[(-6, 6)] * NH, options={'maxiter': 200})
    return 1 / (1 + np.exp(-res.x)), res


def posterior_u(P, S0h, stacked, phi, upto=None):
    """u's posterior given the seasons with index <= upto (all when None): mean and covariance of every season's u"""
    y, mean, B, R = stacked; T = len(P)
    Cu = ucov(S0h, phi, T)
    if upto is not None:
        keep = np.concatenate([np.arange(sum(len(q['rows']) for q in P[:i]), sum(len(q['rows']) for q in P[:i + 1])) for i in range(upto + 1)])
        y, mean, B, R = y[keep], mean[keep], B[keep], R[np.ix_(keep, keep)]
    C = B @ Cu @ B.T + R
    K = Cu @ B.T @ np.linalg.inv(C)
    return K @ (y - mean), Cu - K @ B @ Cu


MEASURED = [('hitter', 'traits', k) for k in ('batSpeed', 'swingLenFt', 'attack', 'swingTilt', 'speed', 'armMph')] + \
           [('hitter', 'hitting', k) for k in ('K_pct', 'BB_pct', 'chaseRate', 'zoneSwingRate', 'exitVelo_bip', 'hardHit95_share')] + \
           [('pitcher', 'pitching_traits', k) for k in ('fbVelo', 'ext', 'armAngle')] + \
           [('pitcher', 'pitching', k) for k in ('K_pct', 'BB_pct', 'zoneRate', 'chaseRate')]


def measured_carryover(recs, years):
    """year-to-year correlation of each measured quantity's true value: the squared change between consecutive seasons,
    less what the two seasons' standard errors account for, against twice the spread of true values among players"""
    out = {}
    for who, where, k in MEASURED:
        vals, diffs = [], []
        for r in recs:
            o = (r['traits'].get(k) if where == 'traits' else (r['traits'].get('pitching') or {}).get(k) if where == 'pitching_traits'
                 else (r['summaries'].get(where) or {}).get(k)) or {}
            ser = [(y, o.get(str(y))) for y in years]
            ser = [(y, v['mean'], v.get('se')) for y, v in ser if isinstance(v, dict) and v.get('mean') is not None and v.get('se')]
            vals += [(m, se) for _, m, se in ser]
            diffs += [((b[1] - a[1]) ** 2, a[2] ** 2 + b[2] ** 2) for a, b in zip(ser, ser[1:]) if b[0] == a[0] + 1]
        if len(diffs) < 15: continue
        m = np.array([v for v, _ in vals]); se2 = np.array([e ** 2 for _, e in vals])
        true_var = m.var() - se2.mean()
        d2 = np.array([d for d, _ in diffs]); e2 = np.array([e for _, e in diffs])
        change = max((d2 - e2).mean() / 2, 0.0)
        out['%s %s' % (who, k)] = {'corr': round(float(1 - change / true_var), 3) if true_var > 0 else None, 'trueSd': round(float(math.sqrt(max(true_var, 0))), 4),
                                   'changeSd': round(float(math.sqrt(2 * change)), 4), 'medianSe': round(float(np.sqrt(np.median(se2))), 4), 'pairs': len(diffs)}
    return out


def main(path, years, nboot):
    E = FH.emulator(os.path.join(HERE, '..', 'diag_out', 'emu.jsonl'))
    recs = json.load(open(path)); recs = recs['players'] if isinstance(recs, dict) else recs
    mu, sd = E['mu'][NK:], E['sd'][NK:]
    players, meta = [], []
    for r in recs:
        if not (r['summaries'].get('hitting') or {}): continue
        P, ys = [], []
        for s in years:
            p = pieces(season_rec(r, s, years), E)
            if p: P.append(p); ys.append(s)
        if not P: continue
        S0h = sqrtm(P[0]['S0'])
        players.append((P, S0h, stack(P, E))); meta.append({'id': r['id'], 'name': r['name'], 'team': r['team'], 'seasons': ys})
    print('%d hitters; seasons: %s' % (len(players), {k: sum(1 for m in meta if len(m['seasons']) == k) for k in (1, 2, 3)}), file=sys.stderr)
    phi, res = fit_phi(players, E)
    S0h = players[0][1]; S0 = S0h @ S0h
    corr = lambda ph: np.diag(S0h @ np.diag(ph) @ S0h) / np.diag(S0)
    rng = np.random.default_rng(11); boots = []
    multi_idx = [i for i, p in enumerate(players) if len(p[0]) > 1]
    for b in range(nboot):
        pick = [players[i] for i in rng.choice(multi_idx, len(multi_idx), replace=True)]
        pb, _ = fit_phi(pick, E, start=np.clip(phi, 0.02, 0.98)); boots.append(corr(pb))
        print('  bootstrap %d/%d' % (b + 1, nboot), file=sys.stderr)
    boots = np.array(boots) if boots else None
    # how much the data say about each trait at all: the prior sd against the one-season posterior sd (median over players)
    shrink = []
    for P, S0h_, st_ in players:
        _, Cs = posterior_u(P[:1], S0h_, stack(P[:1], E), phi)
        shrink.append(np.sqrt(np.diag(Cs)[:NH] / np.diag(S0h_ @ S0h_)))
    shrink = np.median(np.array(shrink), axis=0)
    out = {'years': years, 'hitters': len(players), 'loglik': -res.fun,
           'hidden': {h: {'phi': round(float(phi[k]), 3), 'corr': round(float(corr(phi)[k]), 3),
                          'corr90': [round(float(np.percentile(boots[:, k], 5)), 3), round(float(np.percentile(boots[:, k], 95)), 3)] if boots is not None else None,
                          'oneSeasonSdOverPrior': round(float(shrink[k]), 3)} for k, h in enumerate(HIDDEN)},
           'measured': measured_carryover(recs, years), 'players': {}}
    for (P, S0h_, st_), m in zip(players, meta):
        rec = {'name': m['name'], 'team': m['team'], 'seasons': {}}
        ua, Ca = posterior_u(P, S0h_, st_, phi)
        for i, s in enumerate(m['seasons']):
            u1, C1 = posterior_u(P[i:i + 1], S0h_, stack(P[i:i + 1], E), phi)
            ut, Ct = posterior_u(P, S0h_, st_, phi, upto=i)
            sl = slice(NH * i, NH * (i + 1))
            def nat(u, Cm):
                z = P[i]['m0'] + u; zs = np.sqrt(np.clip(np.diag(Cm), 0, None))
                return {'mean': {h: round(float(mu[k] + sd[k] * z[k]), 4) for k, h in enumerate(HIDDEN)},
                        'sd': {h: round(float(sd[k] * zs[k]), 4) for k, h in enumerate(HIDDEN)},
                        'z': {h: round(float(z[k]), 3) for k, h in enumerate(HIDDEN)}, 'zsd': {h: round(float(zs[k]), 3) for k, h in enumerate(HIDDEN)}}
            rec['seasons'][str(s)] = {'known': {k: (round(float(v), 3) if v is not None else None) for k, v in P[i]['known'].items()},
                                      'alone': nat(u1[:NH], C1[:NH, :NH]), 'through': nat(ut[sl], Ct[sl, sl]), 'all': nat(ua[sl], Ca[sl, sl])}
        out['players'][str(m['id'])] = rec
    json.dump(out, open(os.path.join(HERE, 'seasons.json' if 'history' in path else 'seasons_test.json'), 'w'), indent=1)
    for k, v in out['measured'].items(): print('  %-26s year-to-year corr %s  (true sd %s, typical change %s, typical se %s, %d pairs)' % (k, v['corr'], v['trueSd'], v['changeSd'], v['medianSe'], v['pairs']), file=sys.stderr)
    for h, v in out['hidden'].items(): print('  %-9s year-to-year corr %.2f %s   one-season sd / prior sd %.2f' % (h, v['corr'], v['corr90'], v['oneSeasonSdOverPrior']), file=sys.stderr)


if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0] if a else os.path.join(HERE, 'players_measured.json'), [int(x) for x in (a[1] if len(a) > 1 else '2024,2025,2026').split(',')], int(a[2]) if len(a) > 2 else 0)
