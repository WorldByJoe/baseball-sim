"""
fit_through.py · v0.1 · 2026-10-12

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
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys
import numpy as np
HIST = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIST); sys.path.insert(0, os.path.join(os.getcwd(), 'review'))
import fit_hitters as FH
import seasons as SE


def main(S, iters, npa):
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
    for p in part:
        if p['kind'] == 'pitcher': continue
        r = allrecs.get(p['id']); P, ys = [], []
        if r and (r['summaries'].get('hitting') or {}):
            for y in years:
                q = SE.pieces(SE.season_rec(r, y, (2024, 2025, 2026)), E)
                if q: P.append(q); ys.append(y)
        I = None
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
    print('%d hitters: %s' % (len(fits), kinds), file=sys.stderr)
    if iters:
        fits = FH.refine(fits, E, iters, npa, rng)
    json.dump(fits, open('review/hitters_fit.json', 'w'), indent=1)
    print('wrote review/hitters_fit.json', file=sys.stderr)


if __name__ == '__main__':
    a = sys.argv[1:]
    main(int(a[0]), int(a[1]) if len(a) > 1 else 4, int(a[2]) if len(a) > 2 else 1500)
