# df_fit.py [CSV]: the lambda fit of df_league.py on the league (no argument) or on df_model.js's rows (a CSV path):
# swing ~ logistic(count group, signed distance from the zone of actual + lambda x remaining), lambda by likelihood;
# and the swing rates by where breaking balls ended (inches below the zone's bottom) x their remaining up-down break.
import sys, math, pickle, statistics as st, numpy as np, warnings
warnings.filterwarnings('ignore')
HW, BR_, TAU = 0.708, 0.121, 0.175
if len(sys.argv) > 1:
    P = []
    for line in open(sys.argv[1]):
        f = line.strip().split(',')
        if len(f) != 10: continue
        P.append({'k': f[0], 'x': float(f[1]), 'z': float(f[2]), 'top': float(f[3]), 'bot': float(f[4]), 'sw': f[5] == '1', 'b': int(f[6]), 's': int(f[7]), 'r': (float(f[8]), float(f[9]))})
    lab = 'MODEL'
else:
    exec(open('tools/diag/df_league.py').read().split('print(\'pitches')[0])
    for p in P: p['r'] = p['rA']
    lab = 'LEAGUE'
def dist(x, z, top, bot):
    dx = abs(x) - (HW + BR_); dzl = (bot - BR_) - z; dzh = z - (top + BR_)
    if dx <= 0 and dzl <= 0 and dzh <= 0: return max(dx, dzl, dzh)
    return math.hypot(max(0, dx), max(0, dzl, dzh))
def grp(p): return 0 if (p['b'], p['s']) == (0, 0) else 1 if p['s'] == 2 else 2 if (p['b'], p['s']) == (3, 0) else 3 if p['b'] > p['s'] else 4
def loglik(V, lx, lz):
    X = []; y = []
    for p in V:
        d = dist(p['x'] + lx * p['r'][0], p['z'] + lz * p['r'][1], p['top'], p['bot']); g = [0] * 5; g[grp(p)] = 1
        X.append(g + [min(d, 0), max(d, 0), max(d, 0) ** 2]); y.append(1.0 if p['sw'] else 0.0)
    X = np.array(X, float); X[:, 5:] = np.clip(X[:, 5:], -3, 3); y = np.array(y); w = np.zeros(X.shape[1])
    def ll(w): eta = np.clip(X @ w, -30, 30); return float(np.sum(y * eta - np.log1p(np.exp(eta))))
    cur = ll(w)
    for _ in range(60):
        eta = np.clip(X @ w, -30, 30); mu = 1 / (1 + np.exp(-eta)); W = mu * (1 - mu) + 1e-9
        step = np.linalg.solve(X.T @ (X * W[:, None]) + 1e-4 * np.eye(X.shape[1]), X.T @ (y - mu)); t = 1.0
        while t > 1e-4:
            nw = w + t * step; v = ll(nw)
            if v >= cur - 1e-9: break
            t /= 2
        if abs(v - cur) < 1e-6: w, cur = nw, v; break
        w, cur = nw, v
    return cur
GRID = (0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5)
print('%s pitches %d; remaining up-down break (in): %s' % (lab, len(P), '  '.join('%s %+.1f' % (k, 12 * st.mean(p['r'][1] for p in P if p['k'] == k)) for k in ('FB', 'BR', 'OS'))))
for k in ('BR', 'OS'):
    V = [p for p in P if p['k'] == k]
    L = {(lx, lz): loglik(V, lx, lz) for lx in (0, 0.5, 1.0, 1.5) for lz in GRID}
    best = max(L, key=L.get); base = L[(0, 0)]
    print('  %s (n %d): best lambda across %.2f, up-down %.2f; up-down alone (across 0): %s' % (k, len(V), best[0], best[1], ' '.join('%.2f:%+.0f' % (lz, L[(0, lz)] - base) for lz in GRID)))
print('  breaking balls over the plate: swing rate by inches below the zone\'s bottom (- inside) x remaining up-down break < 2, 2-3, 3-4, 4+ in')
V = [p for p in P if p['k'] == 'BR' and abs(p['x']) < HW + BR_]
for lo, hi in ((-12, -6), (-6, -3), (-3, 0), (0, 3), (3, 6), (6, 9), (9, 12), (12, 18)):
    row = []
    for rl, rh in ((-99, 2), (2, 3), (3, 4), (4, 99)):
        w = [p for p in V if lo <= 12 * ((p['bot'] - BR_) - p['z']) < hi and rl <= 12 * p['r'][1] < rh]
        row.append('%.2f (%4d)' % (sum(p['sw'] for p in w) / len(w), len(w)) if len(w) >= 40 else '     -     ')
    print('   %+4d..%+3d  %s' % (lo, hi, '  '.join(row)))
