"""
fit_hitters.py · v0.1 · 2026-10-06

Each playoff hitter's hidden traits, with their uncertainty, from his measured
2025-26 numbers (playoffs/players_measured.json) through a linear emulator of
the engine (review/emulate_hitters.js).

1. The emulator: each measure (zone swing, chase, whiffs per swing by kind,
   fouls per swing, K%, BB%, exit speed, hard-hit share, the launch-angle mix,
   pulled spray) is regressed on the hitter's traits over the emulated major
   leaguers. What the traits do not explain beyond the emulated hitter's own
   sampling noise is the emulator's structural error.
2. The prior: the emulated major leaguers' traits, as a joint normal, taken
   conditional on the traits measured directly for each player (height,
   weight, swing length, bat speed, attack angle, swing tilt). The farm's
   selection correlates them (a slow bat that survives makes contact), and the
   conditional prior keeps that.
3. The posterior: linear-Gaussian. The likelihood's noise is the player's own
   sampling error (the measured se) plus the emulator's structural error.
   Fitted to his absolute numbers, so the model reproduces him as closely as
   its mechanics allow: the traits are the ones the model needs, and where the
   model's league is off (strikeouts low) his traits carry some of it.

Writes review/hitters_fit.json: per player, the posterior mean, sd and 40 draws
of the hidden traits, the measured traits used, and the fitted-vs-measured
table.

  python3 review/fit_hitters.py diag_out/emu.jsonl [refinement steps] [PA a step]

4. The refinement (optional): Gauss-Newton steps on the simulator itself
   (review/check_hitters.js), the emulator's slopes as the Jacobian, so the
   linear emulator's misfit (strikeouts and home runs most) is taken out.

CHANGED
  v0.1  first build (the Yankees-Rays review)
"""
import json, sys, math, random, warnings
import numpy as np
warnings.filterwarnings('ignore', category=RuntimeWarning)   # numpy 2.0's matmul on this Mac warns spuriously; results are checked finite

_INTERNAL = {}
KNOWN = ['heightIn', 'weightLb', 'swingLenFt', 'batSpeed', 'attack', 'swingTilt']
HIDDEN = ['motorIn', 'faceSD', 'undercut', 'timingSD', 'longSD', 'spotIn', 'eyeSD', 'aggr', 'commit', 'fbLean', 'pullBias', 'learn', 'coverage']
MEAS = ['zoneSwing', 'chase', 'whiffFB', 'whiffBR', 'whiffOS', 'foul', 'K', 'BB', 'HR', 'ev', 'hardHit', 'GB', 'LD', 'FBs', 'PU', 'pull']
# the emulated measure's sampling variance, from its count
NKEY = {'zoneSwing': 'zin', 'chase': 'zout', 'whiffFB': 'swFB', 'whiffBR': 'swBR', 'whiffOS': 'swOS', 'foul': 'sw', 'K': 'pa', 'BB': 'pa', 'HR': 'pa',
        'hardHit': 'bip', 'GB': 'bip', 'LD': 'bip', 'FBs': 'bip', 'PU': 'bip'}
RANGE = {'motorIn': (0.56, 1.4), 'faceSD': (4, 20), 'undercut': (-0.35, 1.15), 'timingSD': (6.26, 15.26), 'longSD': (1.9, 5.1),
         'spotIn': (2.7, 8.1), 'eyeSD': (3, 7.5), 'aggr': (-0.2, 0.2), 'commit': (0.2, 0.9), 'fbLean': (1, 3.6), 'pullBias': (-12, 14),
         'learn': (0.1, 0.6), 'coverage': (3.8, 10.5)}


def emulator(path):
    L = [json.loads(l) for l in open(path)]
    X = np.array([[r['t'][k] for k in KNOWN + HIDDEN] for r in L])
    Y = np.array([[r['y'][m] for m in MEAS] for r in L])
    ok = np.all(np.isfinite(Y), axis=1)
    X, Y, L = X[ok], Y[ok], [r for r, g in zip(L, ok) if g]
    mu, sd = X.mean(0), X.std(0)
    Z = (X - mu) / sd
    D = np.hstack([np.ones((len(Z), 1)), Z])
    coef, *_ = np.linalg.lstsq(D, Y, rcond=None)
    res = Y - D @ coef
    struct = []
    for j, m in enumerate(MEAS):
        if m in NKEY:
            samp = np.mean([Y[i, j] * (1 - Y[i, j]) / max(1, L[i]['n'][NKEY[m]]) for i in range(len(L))])
        elif m == 'ev':
            samp = np.mean([15.0 ** 2 / max(1, r['n']['bip']) for r in L])
        else:   # pulled spray: about 25 deg sd a ball
            samp = np.mean([25.0 ** 2 / max(1, r['n']['bip']) for r in L])
        struct.append(max(res[:, j].var() - samp, 0.05 * res[:, j].var()))
        r2 = 1 - res[:, j].var() / Y[:, j].var()
        print('  %-9s R2 %.2f   residual sd %.4f   of it structural %.4f' % (m, r2, res[:, j].std(), math.sqrt(struct[-1])), file=sys.stderr)
    return {'mu': mu, 'sd': sd, 'coef': coef, 'struct': np.array(struct), 'X': X}


def target(rec):
    """the player's measures: pooled mean and se, None where missing"""
    h = rec['summaries'].get('hitting') or {}
    def pooled(o):
        p = (o or {}).get('pooled') or {}
        return (p.get('mean'), p.get('se')) if p.get('mean') is not None and p.get('se') else (None, None)
    w, f, la = h.get('whiffPerSwing', {}), h.get('foulPerSwing', {}), h.get('launchAngleShare', {})
    t = {'zoneSwing': pooled(h.get('zoneSwingRate')), 'chase': pooled(h.get('chaseRate')),
         'whiffFB': pooled(w.get('FB')), 'whiffBR': pooled(w.get('BR')), 'whiffOS': pooled(w.get('OS')), 'foul': pooled(f.get('all')),
         'K': pooled(h.get('K_pct')), 'BB': pooled(h.get('BB_pct')), 'ev': pooled(h.get('exitVelo_bip')), 'hardHit': pooled(h.get('hardHit95_share')),
         'GB': pooled(la.get('GB')), 'LD': pooled(la.get('LD')), 'FBs': pooled(la.get('FB')), 'PU': pooled(la.get('PU'))}
    # home runs per plate appearance, pooled as the summaries are (2026 x1.0, 2025 x0.5)
    ss = rec.get('seasonStats') or {}
    hr = pa = 0.0
    for y, wgt in (('2026', 1.0), ('2025', 0.5)):
        s_ = ss.get('hitting_' + y) or {}
        if s_.get('PA'):
            hr += wgt * s_.get('HR', 0); pa += wgt * s_['PA']
    if pa >= 50:
        p_ = hr / pa
        t['HR'] = (p_, max(math.sqrt(p_ * (1 - p_) / pa), 0.004))
    else:
        t['HR'] = (None, None)
    sp = (rec['traits'].get('sprayPulledDeg_bip') or {}).get('pooled') or {}
    t['pull'] = (sp.get('mean'), sp.get('se')) if sp.get('mean') is not None and sp.get('se') else (None, None)
    return t


def known_of(rec, E):
    tr = rec['traits']
    def pm(k):
        p = (tr.get(k) or {}).get('pooled') or {}
        return p.get('mean')
    v = {'heightIn': rec.get('heightIn'), 'weightLb': rec.get('weightLb'), 'swingLenFt': pm('swingLenFt'), 'batSpeed': pm('batSpeed'),
         'attack': pm('attack'), 'swingTilt': pm('swingTilt')}
    for i, k in enumerate(KNOWN):   # missing: the emulated major leaguers' mean
        if v[k] is None:
            v[k] = float(E['mu'][i])
    return v


def posterior(rec, E, ndraw=40, rng=None):
    nk, nh = len(KNOWN), len(HIDDEN)
    mu, sd, coef, X = E['mu'], E['sd'], E['coef'], E['X']
    kv = known_of(rec, E)
    xk = np.array([kv[k] for k in KNOWN])
    # the prior: the emulated major leaguers, conditional on the known traits (standardised units)
    Z = (X - mu) / sd
    C = np.cov(Z.T)
    zk = (xk - mu[:nk]) / sd[:nk]
    Ckk, Chk, Chh = C[:nk, :nk], C[nk:, :nk], C[nk:, nk:]
    m0 = Chk @ np.linalg.solve(Ckk, zk)
    S0 = Chh - Chk @ np.linalg.solve(Ckk, Chk.T)
    # the likelihood: y = c0 + Bk zk + Bh zh + e
    t = target(rec)
    rows = [j for j, m in enumerate(MEAS) if t[m][0] is not None]
    if not rows:
        return None
    y = np.array([t[MEAS[j]][0] for j in rows])
    Rv = np.array([t[MEAS[j]][1] ** 2 + E['struct'][j] for j in rows])
    c0 = coef[0, rows] + zk @ coef[1:nk + 1][:, rows]
    Bh = coef[nk + 1:][:, rows].T          # (measures, hidden)
    Ri = np.diag(1 / Rv)
    S = np.linalg.inv(np.linalg.inv(S0) + Bh.T @ Ri @ Bh)
    m = S @ (np.linalg.solve(S0, m0) + Bh.T @ Ri @ (y - c0))
    pm_ = mu[nk:] + sd[nk:] * m
    psd = sd[nk:] * np.sqrt(np.diag(S))
    rng = rng or np.random.default_rng(1)
    draws = rng.multivariate_normal(m, S, size=ndraw) * sd[nk:] + mu[nk:]
    clip = lambda k, v: min(max(v, RANGE[k][0]), RANGE[k][1])
    fitted = c0 + Bh @ m
    _INTERNAL[rec['id']] = {'m0': m0, 'S0': S0, 'm': m, 'rows': rows, 'y': y, 'se2': np.array([t[MEAS[j]][1] ** 2 for j in rows]), 'Bh': Bh}
    return {'known': kv,
            'mean': {k: round(clip(k, float(v)), 4) for k, v in zip(HIDDEN, pm_)},
            'sd': {k: round(float(v), 4) for k, v in zip(HIDDEN, psd)},
            'prior_sd': {k: round(float(v), 4) for k, v in zip(HIDDEN, sd[nk:] * np.sqrt(np.diag(S0)))},
            'draws': [{k: round(clip(k, float(v)), 4) for k, v in zip(HIDDEN, d)} for d in draws],
            'check': {MEAS[j]: {'measured': round(float(y[i]), 4), 'se': round(float(t[MEAS[j]][1]), 4), 'fitted': round(float(fitted[i]), 4)}
                      for i, j in enumerate(rows)}}


def simulate(fits, npa, seed):
    """every hitter's model measures at his current refined mean (review/check_hitters.js, six jobs)"""
    import subprocess
    json.dump(fits, open('review/hitters_fit.json', 'w'), indent=1)
    procs = [subprocess.Popen(['tools/diag/run.sh', 'bb_engine.js', 'review/players.js', 'review/check_hitters.js', '--', str(npa), str(seed), str(k), '6'],
                              stdout=subprocess.PIPE, text=True) for k in range(6)]
    out = {}
    for pr in procs:
        for line in pr.communicate()[0].splitlines():
            r = json.loads(line); out[int(r['id'])] = r['y']
    return out


def refine(fits, E, iters, npa, rng):
    """Gauss-Newton on the simulator itself: the emulator's slopes as the Jacobian, the simulated measures as the
    model's value, the measured se plus the simulation's own noise (and a quarter of the emulator's structural
    variance, for what no trait can reach) as the noise; damped 0.7 a step"""
    nk, sd, mu = len(KNOWN), E['sd'], E['mu']
    for it in range(iters):
        for f in fits.values():
            f['refined'] = f.get('refined') or dict(f['mean'])
        sims = simulate(fits, npa, 100 + it)
        moved = []
        for key, f in fits.items():
            I = _INTERNAL.get(int(key)); ys = sims.get(int(key))
            if I is None or ys is None:
                continue
            rows, J = I['rows'], I['Bh']
            fsim = np.array([ys[MEAS[j]] for j in rows])
            simv = np.array([(fsim[i] * (1 - fsim[i]) / (npa * 3.4 if MEAS[j] in ('zoneSwing', 'chase') else npa * 1.6 if MEAS[j] in ('whiffFB', 'foul') else npa * 0.7 if MEAS[j] == 'whiffBR' else npa * 0.3 if MEAS[j] == 'whiffOS' else npa * 0.68 if MEAS[j] in ('hardHit', 'GB', 'LD', 'FBs', 'PU') else npa))
                             if MEAS[j] not in ('ev', 'pull') else (15.0 ** 2 if MEAS[j] == 'ev' else 25.0 ** 2) / (0.68 * npa) for i, j in enumerate(rows)])
            R = I['se2'] + simv + 0.25 * E['struct'][rows]
            Ri = np.diag(1 / R)
            mk = (np.array([f['refined'][h] for h in HIDDEN]) - mu[nk:]) / sd[nk:]
            S = np.linalg.inv(np.linalg.inv(I['S0']) + J.T @ Ri @ J)
            mg = I['m0'] + S @ (J.T @ Ri @ (I['y'] - fsim + J @ (mk - I['m0'])))
            mn = mk + 0.7 * (mg - mk)
            raw = mu[nk:] + sd[nk:] * mn
            f['refined'] = {h: round(min(max(float(v), RANGE[h][0]), RANGE[h][1]), 4) for h, v in zip(HIDDEN, raw)}
            I['S'] = S
            moved.append(float(np.sqrt(np.mean((mn - mk) ** 2))))
            f['check'] = {MEAS[j]: {'measured': round(float(I['y'][i]), 4), 'se': round(float(np.sqrt(I['se2'][i])), 4), 'simulated': round(float(fsim[i]), 4)}
                          for i, j in enumerate(rows)}
        print('  refinement %d: mean step %.3f sd' % (it + 1, np.mean(moved)), file=sys.stderr)
    for key, f in fits.items():   # the draws: about the refined mean, with the last step's covariance
        I = _INTERNAL.get(int(key))
        if I is None or 'S' not in I:
            continue
        mk = (np.array([f['refined'][h] for h in HIDDEN]) - mu[nk:]) / sd[nk:]
        d = rng.multivariate_normal(mk, I['S'], size=len(f['draws'])) * sd[nk:] + mu[nk:]
        f['draws'] = [{h: round(min(max(float(v), RANGE[h][0]), RANGE[h][1]), 4) for h, v in zip(HIDDEN, row)} for row in d]
        f['sd'] = {h: round(float(v), 4) for h, v in zip(HIDDEN, sd[nk:] * np.sqrt(np.diag(I['S'])))}
    return fits


def main(path, iters=0, npa=1500):
    E = emulator(path)
    recs = json.load(open('playoffs/players_measured.json'))
    recs = recs if isinstance(recs, list) else recs['players']
    out, rng = {}, np.random.default_rng(20261006)
    for r in recs:
        if r['kind'] == 'pitcher' and not (r['summaries'].get('hitting') or {}).get('K_pct'):
            continue
        p = posterior(r, E, rng=rng)
        if p is None:
            continue
        tr = r['traits']
        sp = ((tr.get('speed') or {}).get('pooled') or {}).get('mean')
        arm = ((tr.get('armMph') or {}).get('pooled') or {}).get('mean')
        p.update({'id': r['id'], 'name': r['name'], 'team': r['team'], 'bats': r['bats'], 'position': r['position'], 'speed': sp, 'armMph': arm})
        out[str(r['id'])] = p
    if iters:
        out = refine(out, E, iters, npa, rng)
    json.dump(out, open('review/hitters_fit.json', 'w'), indent=1)
    print('fitted %d hitters' % len(out), file=sys.stderr)


if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0] if a else 'diag_out/emu.jsonl', int(a[1]) if len(a) > 1 else 0, int(a[2]) if len(a) > 2 else 1500)
