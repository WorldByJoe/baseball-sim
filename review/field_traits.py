"""
field_traits.py · v0.1 · 2026-10-14

Each real fielder's range and each catcher's framing, from Savant's fielding run value boards (the model review of
2026-10-14: real players were replayed with population draws for everything in the field but sprint speed and arm).
Range: range runs per out played (all positions; per position where he has 500+ outs), shrunk toward 0 by its
reliability n / (n + K), K fitted so that one season's rate predicts the other's (2025 against 2026, players with both),
then expressed in sd of true talent (z). Framing: framing runs per out caught, the same way. A replay maps z onto
the engine's traits at the same quantile (an assumption, not a fit): route + 0.7 z x its sd and react - 0.7 z x its
sd for range (both carry range in the engine), framing + z x its sd.

  python3 review/field_traits.py LEADERBOARDS_DIR YEARS OUT        e.g.  ... season/foldA_aaa/leaderboards 2025 review/field_traits.json
"""
import csv, json, sys, os, math
LB, YEARS, OUT = sys.argv[1], [int(y) for y in sys.argv[2].split(',')], sys.argv[3]
POS = {2: 'C', 3: '1B', 4: '2B', 5: '3B', 6: 'SS', 7: 'LF', 8: 'CF', 9: 'RF'}


def rows(name, y):
    f = os.path.join(LB, '%s_%d.csv' % (name, y))
    return list(csv.DictReader(open(f))) if os.path.exists(f) else []


def fl(x):
    try: return float(x)
    except Exception: return None


def collect(y):
    """per player: range runs and outs, all positions and by position; framing runs and catcher outs"""
    P = {}
    for r in rows('fielding_run_value', y):
        rr, n = fl(r['range_runs']), fl(r['outs_total'])
        if rr is None or not n: continue
        P.setdefault(r['id'], {})['all'] = (rr, n)
    for k, pos in POS.items():
        for r in rows('fielding_run_value_pos%d' % k, y):
            n = fl(r['outs_total']) or 0
            if not n: continue
            d = P.setdefault(r['id'], {})
            if pos == 'C':
                fr = fl(r['framing_runs'])
                if fr is not None: d['frame'] = (fr, n)
            else:
                rr = fl(r['range_runs'])
                if rr is not None: d[pos] = (rr, n)
    return P


def fit_k(A, B, key):
    """K such that the shrunk rate in one season best predicts the next: true-talent variance from the covariance of
    the two seasons' rates, sampling variance per out from the within-season spread"""
    pairs = [(A[i][key], B[i][key]) for i in A if i in B and key in A[i] and key in B[i] and A[i][key][1] > 200 and B[i][key][1] > 200]
    if len(pairs) < 15: return None, None
    x = [a[0] / a[1] for a, b in pairs]; z = [b[0] / b[1] for a, b in pairs]; n = [math.sqrt(a[1] * b[1]) for a, b in pairs]
    mx, mz = sum(x) / len(x), sum(z) / len(z)
    cov = sum((p - mx) * (q - mz) for p, q in zip(x, z)) / (len(x) - 1)
    vx = sum((p - mx) ** 2 for p in x) / (len(x) - 1)
    tau2 = max(cov, 1e-12); nbar = sum(n) / len(n); s2 = max(vx - tau2, 1e-12) * nbar   # observed variance = tau2 + s2 / n
    return s2 / tau2, math.sqrt(tau2)


S = {y: collect(y) for y in YEARS}
both = collect(2025), collect(2026)
K = {}
for key in ['all', 'frame']:
    K[key] = fit_k(both[0], both[1], key)
print('K (outs at which the rate is half signal) and true-talent sd per out:', {k: (round(v[0]) if v[0] else None, v[1]) for k, v in K.items()})
out = {'K': {k: v[0] for k, v in K.items()}, 'tauPerOut': {k: v[1] for k, v in K.items()}, 'years': YEARS, 'players': {}}
ids = set().union(*[set(S[y]) for y in YEARS])
for i in ids:
    rec = {}
    for key in ['all', 'frame'] + [p for p in POS.values() if p != 'C']:
        kk = 'frame' if key == 'frame' else 'all'
        if not K[kk][0]: continue
        runs = sum(S[y][i][key][0] for y in YEARS if i in S[y] and key in S[y][i]); n = sum(S[y][i][key][1] for y in YEARS if i in S[y] and key in S[y][i])
        if not n or (key not in ('all', 'frame') and n < 500): continue
        rate = runs / n; rel = n / (n + K[kk][0]); rec[key] = {'z': round(rel * rate / K[kk][1], 3), 'n': int(n), 'rel': round(rel, 3)}
    if rec: out['players'][i] = rec
json.dump(out, open(OUT, 'w'), indent=None, separators=(',', ':'))
zs = sorted(v['all']['z'] for v in out['players'].values() if 'all' in v)
print(len(out['players']), 'players; range z p10/p50/p90', zs[len(zs) // 10], zs[len(zs) // 2], zs[9 * len(zs) // 10] if zs else None)
