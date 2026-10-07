# df_league.py: does the league swing where a pitch ENDED or where it looked HEADED at the commit point (DF)?
# For every pitch (42 days of 2025): its constant-acceleration flight (Statcast's 9 parameters), and where it would have
# ended had it kept the pitcher's own fastball's acceleration from the commit point (0.175 s before the plate):
#   A: he sees its place and motion at the commit point and assumes the fastball's acceleration after it,
#      remaining = (a_fb - a) tau^2 / 2
#   B: he sees only its place and assumes the fastball's whole path, remaining = (a_fb - a) ((T - tau) tau + tau^2 / 2)
# The swing decision is modelled as logistic in the signed distance from the zone of a pictured place
# actual + lambda x remaining (separate lambdas across and up-down), with count-group intercepts; lambda is chosen by
# likelihood. Then the swing rates that test it: breaking balls by where they ended x where they were headed.
import pickle, statistics as st, numpy as np, math
R = pickle.load(open('diag_out/bc/league.pkl', 'rb'))
K = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
SW = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
TK = {'called_strike', 'ball', 'blocked_ball'}
TAU = 0.175
fb = {}
for x in R:
    if x['pitch_type'] in ('FF', 'SI') and x['ax'] is not None: fb.setdefault((x['pitcher'], x['pitch_type']), []).append((x['ax'], x['az']))
FB = {}
for (p, t), v in fb.items():
    if len(v) < 10: continue
    if t == 'FF' or p not in FB: FB[p] = (st.mean(a for a, _ in v), st.mean(b for _, b in v)) if (t == 'FF' or p not in FB) else FB[p]
P = []
for x in R:
    if x['pitch_type'] not in K or x['pitcher'] not in FB or x['vy0'] is None or x['ay'] is None or not x['sz_top'] or x['plate_x'] is None: continue
    if x['description'] not in SW and x['description'] not in TK: continue
    vy0, ay = x['vy0'], x['ay']; disc = vy0 * vy0 - 2 * ay * (50 - 17 / 12)
    if disc <= 0: continue
    T = (-vy0 - math.sqrt(disc)) / ay + (60.5 - (x['release_extension'] or 6.3) - 50) / -vy0
    dax, daz = FB[x['pitcher']][0] - x['ax'], FB[x['pitcher']][1] - x['az']
    fa = TAU * TAU / 2; fb_ = (T - TAU) * TAU + TAU * TAU / 2
    P.append({'k': K[x['pitch_type']], 'x': x['plate_x'], 'z': x['plate_z'], 'top': x['sz_top'], 'bot': x['sz_bot'], 'sw': x['description'] in SW,
              'rA': (dax * fa, daz * fa), 'rB': (dax * fb_, daz * fb_), 'b': int(x['balls']), 's': int(x['strikes'])})
print('pitches %d; remaining up-down break, inches (A / B), mean by kind: %s' % (len(P), '  '.join('%s %+.1f / %+.1f' % (k, 12 * st.mean(p['rA'][1] for p in P if p['k'] == k), 12 * st.mean(p['rB'][1] for p in P if p['k'] == k)) for k in ('FB', 'BR', 'OS'))))
HW, BR_ = 0.708, 0.121
def dist(x, z, top, bot):   # ft, signed: - inside the zone (to the nearest edge), + outside
    dx = abs(x) - (HW + BR_); dzl = (bot - BR_) - z; dzh = z - (top + BR_)
    if dx <= 0 and dzl <= 0 and dzh <= 0: return max(dx, dzl, dzh)
    ox = max(0, dx); oz = max(0, dzl, dzh); return math.hypot(ox, oz)
def grp(p): return 0 if (p['b'], p['s']) == (0, 0) else 1 if p['s'] == 2 else 2 if (p['b'], p['s']) == (3, 0) else 3 if p['b'] > p['s'] else 4
def loglik(V, lx, lz, var):
    X = []; y = []
    for p in V:
        r = p[var]; d = dist(p['x'] + lx * r[0], p['z'] + lz * r[1], p['top'], p['bot'])
        g = [0] * 5; g[grp(p)] = 1
        X.append(g + [min(d, 0), max(d, 0), max(d, 0) ** 2]); y.append(1.0 if p['sw'] else 0.0)
    X = np.array(X, float); X[:, 5:] = np.clip(X[:, 5:], -3, 3); y = np.array(y); w = np.zeros(X.shape[1])
    def ll(w):
        eta = np.clip(X @ w, -30, 30); return float(np.sum(y * eta - np.log1p(np.exp(eta))))
    cur = ll(w)
    for _ in range(60):   # Newton with step halving
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
for k in ('BR', 'OS', 'FB'):
    V = [p for p in P if p['k'] == k]
    if k == 'FB': V = V[::3]
    for var in ('rA',):
        L = {(lx, lz): loglik(V, lx, lz, var) for lx in GRID for lz in GRID}
        best = max(L, key=L.get); base = L[(0, 0)]
        print('%s %s (n %d): best lambda across %.2f, up-down %.2f; log-lik gain over 0,0 %+.1f; up-down alone at across 0: %s' % (k, var, len(V), best[0], best[1], L[best] - base,
              ' '.join('%.2f:%+.0f' % (lz, L[(0, lz)] - base) for lz in GRID)))
# the direct test: breaking balls below the zone and in its lower part, by how far they were headed above where they ended
print('breaking balls: swing rate by where they ended (in below the zone\'s bottom, - inside) x remaining up-down break (variant B, in)')
V = [p for p in P if p['k'] == 'BR' and abs(p['x']) < HW + BR_]
for lo, hi in ((-6, -3), (-3, 0), (0, 3), (3, 6), (6, 9), (9, 12), (12, 18)):
    row = []
    for rl, rh in ((-99, 4), (4, 7), (7, 10), (10, 99)):
        w = [p for p in V if lo <= 12 * ((p['bot'] - BR_) - p['z']) < hi and rl <= 12 * p['rB'][1] < rh]
        row.append('%.2f (%4d)' % (sum(p['sw'] for p in w) / len(w), len(w)) if len(w) >= 40 else '   -       ')
    print('   %+3d..%+3d in below:  %s' % (lo, hi, '  '.join(row)))
print('   columns: remaining up-down break < 4, 4-7, 7-10, 10+ in (how far above its end it was headed)')
