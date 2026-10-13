"""
aging.py · v0.2 · 2026-10-13

How each trait changes with age, read only from changes within the same players across seasons (between players, older
men who are still in the majors are the ones who aged well, so comparing old with young flatters age). For every trait:
  value in season s = the player's own level + d (age_s - his mean age) + e ((age_s - 30)^2 - his mean of it) + noise
(the Mundlak form: the level carries g (his mean age - 30), so d and e come from within players only). The change a
season at age A is d + 2 e (A - 30). Reported in the trait's units and in units of the spread between players.
  measured traits   weighted least squares on the season means (weights from each season's standard error plus the
                    season-to-season blip, estimated), standard errors clustered by player
  hidden traits     generalised least squares (with a weak prior on the age terms) inside history/seasons.py's model (carry-over phi held at its fit): the age
                    terms move each season's prior mean, and their estimate is closed-form given the covariance

Writes history/aging.json (d, e, g with standard errors, and the change a season at 25, 30 and 34, per trait), which
history/fit_through.py and history/replay_view.py use to carry a player's traits from one season to the next.

  python3 history/aging.py [years]

CHANGED
  v0.2  HISTDATA: the data folder (season/league: every major leaguer, 2025-26)
  v0.1  first build (Joe, 2026-10-12: add an age trend to the trait projections; which traits does age move?)
"""
import json, os, sys, math, datetime
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
DATA = os.environ.get('HISTDATA') or HERE   # v0.2: another folder laid out like history/
import seasons as SE
from seasons import FH, NH, NK


# league-wide season shifts (Savant's custom leaderboards, every player with 50+ PA: history/league_seasons.json) taken out of
# the measures the environment moves: the zone (MLB's 2026 challenge-system zone: zone rate -3.2 points, chase +2.3), the walk
# and strikeout rates, and the ball (exit speed +0.5 mph in 2025, -0.6 in 2026). Not taken out of speeds, lengths and angles:
# the league's drift there (fastballs +0.3 mph a year) is turnover, new men throwing harder, which says nothing of how a man ages
LEAGUE_KEY = {('hitter', 'K_pct'): ('batter', 'k_percent', 100), ('hitter', 'BB_pct'): ('batter', 'bb_percent', 100), ('hitter', 'chaseRate'): ('batter', 'oz_swing_percent', 100),
              ('hitter', 'zoneSwingRate'): ('batter', 'z_swing_percent', 100), ('hitter', 'exitVelo_bip'): ('batter', 'exit_velocity_avg', 1),
              ('hitter', 'hardHit95_share'): ('batter', 'hard_hit_percent', 100), ('pitcher', 'K_pct'): ('pitcher', 'k_percent', 100),
              ('pitcher', 'BB_pct'): ('pitcher', 'bb_percent', 100), ('pitcher', 'zoneRate'): ('pitcher', 'in_zone_percent', 100), ('pitcher', 'chaseRate'): ('pitcher', 'oz_swing_percent', 100)}
# the hidden traits' measures that the same shifts move (fit_hitters.MEAS names)
MEAS_KEY = {'K': ('hitter', 'K_pct'), 'BB': ('hitter', 'BB_pct'), 'chase': ('hitter', 'chaseRate'), 'zoneSwing': ('hitter', 'zoneSwingRate'), 'ev': ('hitter', 'exitVelo_bip'), 'hardHit': ('hitter', 'hardHit95_share')}


def league_shift(years):
    L = json.load(open(os.path.join(DATA, 'league_seasons.json')))
    out = {}
    for key, (who, col, div) in LEAGUE_KEY.items():
        v = {y: L['%s_%d' % (who, y)][col] / div for y in years if col in L.get('%s_%d' % (who, y), {})}
        if len(v) == len(years):
            m = np.mean(list(v.values())); out[key] = {y: v[y] - m for y in years}
    return out


def age_at(birth, season):
    b = datetime.date.fromisoformat(birth); return (datetime.date(season, 7, 1) - b).days / 365.25


def design(ages):
    """per season of one player: [g (abar - 30), d (age - abar), e ((age-30)^2 - mean)] rows"""
    a = np.array(ages); ab = a.mean(); q = (a - 30) ** 2
    return np.column_stack([np.full_like(a, ab - 30), a - ab, q - q.mean()])


def at(d, e, A): return d + 2 * e * (A - 30)


def measured(recs, birth, years, carry):
    out = {}; LS = league_shift(years)
    for who, where, k in SE.MEASURED:
        rows = []
        for r in recs:
            b = birth.get(r['id'])
            if not b: continue
            o = (r['traits'].get(k) if where == 'traits' else (r['traits'].get('pitching') or {}).get(k) if where == 'pitching_traits'
                 else (r['summaries'].get(where) or {}).get(k)) or {}
            s = [(y, o[str(y)]['mean'], o[str(y)]['se']) for y in years if isinstance(o.get(str(y)), dict) and o[str(y)].get('mean') is not None and o[str(y)].get('se')]
            if len(s) >= 2: rows.append((r['id'], [age_at(b, y) for y, _, _ in s], [m for _, m, _ in s], [se for _, _, se in s], [y for y, _, _ in s]))
        if len(rows) < 30: continue
        # not centred on each season's mean: the same men are followed every season, so their mean ages a year a season too, and
        # centring would take out the very aging asked about (a league-wide measurement shift would be read as aging; none is assumed)
        ym = LS.get((who, k)) or {y: 0.0 for y in years}
        X, Y, W, G = [], [], [], []
        c = carry.get('%s %s' % (who, k)) or {}; blip = (c.get('trueSd') or 0) ** 2 * max(0.0, 1 - (c.get('corr') or 1)) / 1.0
        for i, (pid, ages, ms, ses, ys) in enumerate(rows):
            D = design(ages); m = np.array(ms) - np.array([ym[y] for y in ys])
            for j in range(len(ages)):
                X.append(np.concatenate([[1.0], D[j]])); Y.append(m[j]); W.append(1 / (ses[j] ** 2 + blip)); G.append(i)
        X, Y, W, G = np.array(X), np.array(Y), np.array(W), np.array(G)
        XtW = X.T * W; A = XtW @ X; beta = np.linalg.solve(A, XtW @ Y); res = Y - X @ beta
        Ai = np.linalg.inv(A); meat = np.zeros_like(A)
        for g in np.unique(G):
            s_ = (X[G == g].T * W[G == g]) @ res[G == g]; meat += np.outer(s_, s_)
        V = Ai @ meat @ Ai; se = np.sqrt(np.diag(V))
        _, g_, d, e = beta; sd_ = c.get('trueSd') or float(np.std(Y))
        def ch(Aage):
            v = np.array([0, 0, 1, 2 * (Aage - 30)]); return float(v @ beta), float(math.sqrt(v @ V @ v))
        out['%s %s' % (who, k)] = {'d': [round(float(d), 5), round(float(se[2]), 5)], 'e': [round(float(e), 6), round(float(se[3]), 6)], 'g': [round(float(g_), 5), round(float(se[1]), 5)],
                                   'players': len(rows), 'trueSd': sd_,
                                   'perSeason': {str(Aage): [round(ch(Aage)[0], 4), round(ch(Aage)[1], 4)] for Aage in (25, 30, 34)}}
    return out


def hidden(recs, birth, years, phi):
    LS = league_shift(years)
    E = FH.emulator(os.path.join(HERE, '..', 'diag_out', 'emu.jsonl'))
    XtCX = np.zeros((3 * NH, 3 * NH)); XtCr = np.zeros(3 * NH); n = 0
    for r in recs:
        if not (r['summaries'].get('hitting') or {}) or not birth.get(r['id']): continue
        P, ys = [], []
        for y in years:
            q = SE.pieces(SE.season_rec(r, y, years), E)
            if q:
                for i, j in enumerate(q['rows']):
                    sh = LS.get(MEAS_KEY.get(FH.MEAS[j]))
                    if sh: q['y'][i] -= sh[y]
                P.append(q); ys.append(y)
        if len(P) < 2: continue
        S0h = SE.sqrtm(P[0]['S0']); yv, mean, B, R = SE.stack(P, E)
        C = B @ SE.ucov(S0h, phi, len(P)) @ B.T + R
        D = design([age_at(birth[r['id']], y) for y in ys])           # (T, 3)
        # X maps beta (trait-major: [g_k, d_k, e_k] for k) to the stacked z: season t, trait k gets D[t] . beta_k
        X = np.zeros((NH * len(P), 3 * NH))
        for t in range(len(P)):
            for k in range(NH): X[NH * t + k, 3 * k:3 * k + 3] = D[t]
        Xt = B @ X; Ci = np.linalg.inv(C)
        XtCX += Xt.T @ Ci @ Xt; XtCr += Xt.T @ Ci @ (yv - mean); n += 1
    # a weak prior on the age terms (z units: level 0.1 sd a year of age, change 0.1 sd a season, its bend 0.005), so a trait the
    # measures barely see keeps its age effect near zero instead of wandering off with nothing to hold it
    XtCX += np.diag(np.tile([1 / 0.1 ** 2, 1 / 0.1 ** 2, 1 / 0.005 ** 2], NH))
    beta = np.linalg.solve(XtCX, XtCr); V = np.linalg.inv(XtCX); se = np.sqrt(np.diag(V))
    mu, sd = E['mu'][NK:], E['sd'][NK:]
    out = {}
    for k, h in enumerate(SE.HIDDEN):
        g_, d, e = beta[3 * k:3 * k + 3]; Vk = V[3 * k:3 * k + 3, 3 * k:3 * k + 3]
        def ch(A):
            v = np.array([0, 1, 2 * (A - 30)]); return float(v @ beta[3 * k:3 * k + 3]), float(math.sqrt(v @ Vk @ v))
        out[h] = {'z': {'g': [round(float(g_), 5), round(float(se[3 * k]), 5)], 'd': [round(float(d), 5), round(float(se[3 * k + 1]), 5)], 'e': [round(float(e), 6), round(float(se[3 * k + 2]), 6)]},
                  'sd': float(sd[k]), 'perSeasonZ': {str(A): [round(ch(A)[0], 4), round(ch(A)[1], 4)] for A in (25, 30, 34)}}
    return out, n


def main(years):
    recs = json.load(open(os.path.join(DATA, 'players_measured.json')))['players']
    birth = {p['id']: p['birthDate'] for p in json.load(open(os.path.join(DATA, 'rosters.json')))['players'] if p.get('birthDate')}
    S = json.load(open(os.path.join(DATA, 'seasons.json')))
    phi = np.array([S['hidden'][h]['phi'] for h in SE.HIDDEN])
    M = measured(recs, birth, years, S['measured'])
    H, n = hidden(recs, birth, years, phi)
    json.dump({'years': years, 'measured': M, 'hidden': H, 'hiddenPlayers': n}, open(os.path.join(DATA, 'aging.json'), 'w'), indent=1)
    rows = []
    for k, v in M.items():
        for A in ('25', '34'):
            c, s = v['perSeason'][A]; rows.append((k, A, c, s, c / v['trueSd'] if v['trueSd'] else float('nan')))
    for h, v in H.items():
        for A in ('25', '34'):
            c, s = v['perSeasonZ'][A]; rows.append(('hidden ' + h, A, c * v['sd'], s * v['sd'], c))
    print('%d hitters in the hidden-trait fit' % n)
    print('%-28s %4s %10s %8s %6s %10s' % ('trait', 'age', 'change/yr', 'se', 't', 'in sd/yr'))
    for k, A, c, s, z in sorted(rows, key=lambda r: -abs(r[2] / r[3]) if r[3] else 0):
        print('%-28s %4s %10.4f %8.4f %6.1f %10.3f' % (k, A, c, s, c / s if s else float('nan'), z))


if __name__ == '__main__':
    main([int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '2023,2024,2025,2026').split(',')])
