"""
fit_through.py · v0.4 · 2026-10-14

Each postseason hitter's hidden traits as they stood that October: history/seasons.py's carry-over model given his seasons
up to and including S (none after), then review/fit_hitters.py's refinement on the simulator itself (4 steps of 1,500
plate appearances, as the 2026 fits had), with the seasons before S as the prior for S. Run inside the October's own
worktree (history/replay_view.py has written its playoffs/players_measured.json there); writes review/hitters_fit.json
in fit_hitters.py's format.

A hitter with no season S in the data takes his last season's estimate; one with no seasons at all, the model's major
leaguers (the emulator's population). The carry-over (phi) was fitted on all three seasons: it is a fact about how traits
change, not about any one player, so using it for an earlier October borrows no player's later numbers.

  python3 HIST/fit_through.py 2025 [refinement steps] [PA a step]      (from the worktree's root)

CHANGED
  v0.4  CALLUP_LEVEL: a man with no data takes the farm's k-th pick's traits as his prior (off unless set; the model review)
  v0.3  a pitcher who appears in a batting order gets hitting traits (the population's, without hitting data)
  v0.2  the age trend (history/aging.py): each season's prior mean moves with his age, so the step from one season to the next
        carries a year of aging (off by default since Joe pinned it: python3 HIST/fit_through.py S steps PA age)
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys
import numpy as np
HIST = os.environ.get('HISTDATA') or os.path.dirname(os.path.abspath(__file__))   # the data (HISTDATA: another folder laid out like history/)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.getcwd(), 'review'))
import fit_hitters as FH
import seasons as SE
import datetime
# v0.4: CALLUP_LEVEL=k (with LEVEL_MEANS, the path of review/level_means.js's output): the prior of a man with no data
LEVEL = json.load(open(os.environ['LEVEL_MEANS']))[os.environ['CALLUP_LEVEL']] if os.environ.get('CALLUP_LEVEL') else None


def age_terms(ages, A):
    """history/aging.py's mean model for one player's seasons: per season, g (mean age - 30) + d (age - mean age) + e ((age - 30)^2 - its mean),
    per hidden trait (standardised units)"""
    a = np.array(ages); ab = a.mean(); q = (a - 30) ** 2
    return [np.array([A[h]['z']['g'][0] * (ab - 30) + A[h]['z']['d'][0] * (x - ab) + A[h]['z']['e'][0] * (qq - q.mean()) for h in SE.HIDDEN]) for x, qq in zip(a, q)]


def main(S, iters, npa, age=True):
    A = json.load(open(os.path.join(HIST, 'aging.json')))['hidden'] if age else None
    birth = {p['id']: p.get('birthDate') for p in json.load(open(os.path.join(HIST, 'rosters.json')))['players']}
    agesum = []
    E = FH.emulator('diag_out/emu.jsonl')
    mu, sd = E['mu'][SE.NK:], E['sd'][SE.NK:]
    phi = np.array([json.load(open(os.path.join(HIST, 'seasons.json')))['hidden'][h]['phi'] for h in SE.HIDDEN])
    allrecs = {r['id']: r for r in json.load(open(os.path.join(HIST, 'players_measured.json')))['players']}
    view = {r['id']: r for r in json.load(open('playoffs/players_measured.json'))['players']}
    part = json.load(open(os.path.join(HIST, 'participants_%d.json' % S)))['players']
    years = [y for y in (2024, 2025, 2026) if y <= S]
    Z = (E['X'] - E['mu']) / E['sd']; Cpop = np.cov(Z.T)[SE.NK:, SE.NK:]
    rng = np.random.default_rng(20261012); fits = {}; kinds = {'S': 0, 'earlier': 0, 'none': 0}
    clip = lambda k, v: min(max(v, FH.RANGE[k][0]), FH.RANGE[k][1])
    batted = {q['id'] for g in json.load(open(os.path.join(HIST, 'participants_%d.json' % S)))['games'] if os.path.exists('review/games/%d.json' % g['pk'])
              for side in ('away', 'home') for q in json.load(open('review/games/%d.json' % g['pk']))['lineups'][side]}
    for p in part:
        if p['kind'] == 'pitcher' and p['id'] not in batted: continue   # a pitcher in a batting order (his team lost the DH) needs hitting traits too
        r = allrecs.get(p['id']); P, ys = [], []
        if r and (r['summaries'].get('hitting') or {}):
            for y in years:
                q = SE.pieces(SE.season_rec(r, y, (2024, 2025, 2026)), E)
                if q: P.append(q); ys.append(y)
        I = None
        if P and A and birth.get(p['id']):
            b = datetime.date.fromisoformat(birth[p['id']]); ages = [(datetime.date(y, 7, 1) - b).days / 365.25 for y in ys]
            for q_, dz in zip(P, age_terms(ages, A)): q_['m0'] = q_['m0'] + dz
            agesum.append(float(np.abs(age_terms(ages, A)[-1]).max()))
        if P:
            S0h = SE.sqrtm(P[0]['S0']); st = SE.stack(P, E); i = len(P) - 1
            u, C = SE.posterior_u(P, S0h, st, phi); sl = slice(SE.NH * i, SE.NH * (i + 1))
            m = P[i]['m0'] + u[sl]; Cm = C[sl, sl]
            if ys[-1] == S:
                kinds['S'] += 1
                if i:
                    up, Cp = SE.posterior_u(P, S0h, st, phi, upto=i - 1); prior_m, prior_S = P[i]['m0'] + up[sl], Cp[sl, sl]
                else:
                    prior_m, prior_S = P[i]['m0'], S0h @ S0h
                I = {'m0': prior_m, 'S0': prior_S, 'rows': P[i]['rows'], 'y': P[i]['y'], 'se2': P[i]['se2'], 'Bh': P[i]['Bh'], 'm': m}
            else:
                kinds['earlier'] += 1
            known = P[i]['known']
        else:
            kinds['none'] += 1; m = np.zeros(SE.NH); Cm = Cpop
            known = {k: float(E['mu'][j]) for j, k in enumerate(SE.KNOWN)}
            if LEVEL:   # v0.4: a call-up with no major-league data is the farm's LEVEL-th pick, not its major leaguer (the model review)
                known = {k: LEVEL[k] for k in SE.KNOWN}
                m = np.array([(LEVEL[h] - mu[k]) / sd[k] for k, h in enumerate(SE.HIDDEN)])
            v = view.get(p['id']) or {}
            for k in ('heightIn', 'weightLb'):
                if v.get(k): known[k] = v[k]
        Cm = (Cm + Cm.T) / 2
        draws = rng.multivariate_normal(m, Cm, size=40) * sd + mu
        v = view.get(p['id']) or {'traits': {}}
        g = lambda k: ((v['traits'].get(k) or {}).get('pooled') or {}).get('mean')
        fits[str(p['id'])] = {'known': known, 'mean': {h: round(clip(h, float(mu[k] + sd[k] * m[k])), 4) for k, h in enumerate(SE.HIDDEN)},
                              'sd': {h: round(float(sd[k] * np.sqrt(max(Cm[k, k], 0))), 4) for k, h in enumerate(SE.HIDDEN)},
                              'draws': [{h: round(clip(h, float(x)), 4) for h, x in zip(SE.HIDDEN, d)} for d in draws],
                              'id': p['id'], 'name': p['name'], 'team': p['team'], 'bats': v.get('bats'), 'position': v.get('position'),
                              'speed': g('speed'), 'armMph': g('armMph'), 'seasons': ys, 'basis': 'through %d' % S}
        if I is not None: FH._INTERNAL[p['id']] = I
    print('%d hitters: %s; age trend %s (largest shift of a season\'s prior mean, median %.3f sd)' % (len(fits), kinds, 'on' if A else 'off', float(np.median(agesum)) if agesum else 0), file=sys.stderr)
    if iters:
        fits = FH.refine(fits, E, iters, npa, rng)
    json.dump(fits, open('review/hitters_fit.json', 'w'), indent=1)
    print('wrote review/hitters_fit.json', file=sys.stderr)


if __name__ == '__main__':
    a = sys.argv[1:]
    main(int(a[0]), int(a[1]) if len(a) > 1 else 4, int(a[2]) if len(a) > 2 else 1500, age='age' in a)   # the age trend is pinned for later (Joe, 2026-10-12): on only when asked
