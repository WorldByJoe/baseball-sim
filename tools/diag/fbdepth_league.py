# fastball tracked contact (42 days of 2025), by contact depth about each hitter's mean: launch minus attack
# (vm), the bat's direction (+ pull), attack angle, bat speed about his mean, foul rate; the bat's direction
# scatter beyond what depth explains (the residual of a straight line in depth); and the distribution of the
# bat's direction on contact, fouls against balls in play.
import csv, glob, math, statistics as st
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in ('FF', 'SI', 'FC') or r['description'] not in ('foul', 'hit_into_play'): continue
        try: bs, la, aa, ad, dep = (float(r[k]) for k in ('bat_speed', 'launch_angle', 'attack_angle', 'attack_direction', 'intercept_ball_minus_batter_pos_y_inches'))
        except ValueError: continue
        if bs < 50: continue
        R.append({'b': r['batter'], 'foul': r['description'] == 'foul', 'bs': bs, 'vm': la - aa, 'aa': aa, 'dir': -ad, 'dep': dep, 'la': la})
by = {}
for x in R: by.setdefault(x['b'], []).append(x)
mu = {b: (st.mean(v['dep'] for v in L), st.mean(v['bs'] for v in L)) for b, L in by.items()}
for x in R: x['dd'] = x['dep'] - mu[x['b']][0]; x['dbs'] = x['bs'] - mu[x['b']][1]
n = len(R)
def m(v, k): return st.mean(x[k] for x in v)
print('LEAGUE fastball tracked contact n %d' % n)
print('  by depth about his mean (in; - deep):  share  vm    dir    attack  bat    foul   |  vm of fouls / in play')
for lo, hi in ((-99, -12), (-12, -8), (-8, -4), (-4, 0), (0, 4), (4, 8), (8, 12), (12, 99)):
    S = [x for x in R if lo <= x['dd'] < hi]
    if len(S) < 30: continue
    f = [x for x in S if x['foul']]; b = [x for x in S if not x['foul']]
    print('   %4d..%-3d  %.3f  %+5.1f  %+5.1f  %+5.1f  %+5.2f  %.3f  |  %+5.1f / %+5.1f' % (lo, hi, len(S) / n, m(S, 'vm'), m(S, 'dir'), m(S, 'aa'), m(S, 'dbs'), len(f) / len(S), m(f, 'vm') if f else 0, m(b, 'vm') if b else 0))
# straight lines in depth
def fit(k):
    xs = [x['dd'] for x in R]; ys = [x[k] for x in R]; mx, my = st.mean(xs), st.mean(ys)
    sxy = sum((a - mx) * (b - my) for a, b in zip(xs, ys)); sxx = sum((a - mx) ** 2 for a in xs)
    sl = sxy / sxx; res = [b - my - sl * (a - mx) for a, b in zip(xs, ys)]
    return sl, math.sqrt(sum(r * r for r in res) / len(res)), st.pstdev(ys), sxy / math.sqrt(sxx * sum((b - my) ** 2 for b in ys))
for k, nm in (('vm', 'launch minus attack'), ('dir', 'bat direction'), ('aa', 'attack angle')):
    sl, rs, sdy, r = fit(k)
    print('  %-20s per inch of depth %+.2f deg (r %.2f); sd %.1f, residual sd %.1f' % (nm, sl, r, sdy, rs))
F = [x for x in R if x['foul']]; B = [x for x in R if not x['foul']]
print('  bat direction (+ pull) on contact: mean %+.1f sd %.1f; fouls %+.1f sd %.1f; in play %+.1f sd %.1f' % (m(R, 'dir'), st.pstdev(x['dir'] for x in R), m(F, 'dir'), st.pstdev(x['dir'] for x in F), m(B, 'dir'), st.pstdev(x['dir'] for x in B)))
print('  share of contact by bat direction:  ' + '  '.join('%d..%d %.3f' % (lo, hi, sum(1 for x in R if lo <= x['dir'] < hi) / n) for lo, hi in ((-90, -30), (-30, -20), (-20, -10), (-10, 0), (0, 10), (10, 20), (20, 30), (30, 90))))
print('  foul rate by bat direction:         ' + '  '.join('%d..%d %.3f' % (lo, hi, sum(1 for x in R if lo <= x['dir'] < hi and x['foul']) / max(1, sum(1 for x in R if lo <= x['dir'] < hi))) for lo, hi in ((-90, -30), (-30, -20), (-20, -10), (-10, 0), (0, 10), (10, 20), (20, 30), (30, 90))))
# at the same depth band, the bat's direction of fouls against balls in play
print('  by depth band: bat direction of fouls / in play, and the direction sd within the band')
for lo, hi in ((-99, -8), (-8, -4), (-4, 0), (0, 4), (4, 8), (8, 99)):
    S = [x for x in R if lo <= x['dd'] < hi]; f = [x for x in S if x['foul']]; b = [x for x in S if not x['foul']]
    print('   %4d..%-3d  dir %+5.1f / %+5.1f   sd within band %.1f   n %d' % (lo, hi, m(f, 'dir'), m(b, 'dir'), st.pstdev(x['dir'] for x in S), len(S)))
# vm against bat direction, depth held: within depth bands
print('  vm by bat direction within the middle depth band (-4..4 in):')
S0 = [x for x in R if -4 <= x['dd'] < 4]
print('   ' + '  '.join('%d..%d %+.1f (foul %.2f, n %d)' % (lo, hi, m([x for x in S0 if lo <= x['dir'] < hi], 'vm'), sum(1 for x in S0 if lo <= x['dir'] < hi and x['foul']) / max(1, sum(1 for x in S0 if lo <= x['dir'] < hi)), sum(1 for x in S0 if lo <= x['dir'] < hi)) for lo, hi in ((-90, -20), (-20, -10), (-10, 0), (0, 10), (10, 20), (20, 90))))
