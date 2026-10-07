# fastball balls in play with tracking (42 days of 2025): the ball's spray (+ pull, from the hit coordinates) against
# the bat's direction (+ pull) WITHIN bands of contact depth about the hitter's mean - whether the ball follows the
# bat's direction more than one for one at a fixed depth (the face turned with the hands) or only across depths (the
# face lagging deep and leading out front); and by pitch height, the vertical miss and attack angle.
import csv, glob, math, statistics as st
HX, HY = 126.0, 205.0
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in ('FF', 'SI', 'FC') or r['description'] not in ('foul', 'hit_into_play'): continue
        try: bs, la, aa, ad, dep, px, pz, bot, top = (float(r[k]) for k in ('bat_speed', 'launch_angle', 'attack_angle', 'attack_direction', 'intercept_ball_minus_batter_pos_y_inches', 'plate_x', 'plate_z', 'sz_bot', 'sz_top'))
        except ValueError: continue
        if bs < 50: continue
        x = {'b': r['batter'], 'foul': r['description'] == 'foul', 'vm': la - aa, 'aa': aa, 'dir': -ad, 'dep': dep, 'h': (pz - bot) / (top - bot), 'la': la, 'inside': -px * 12 if r['stand'] == 'R' else px * 12}
        if r['description'] == 'hit_into_play':
            try:
                hx, hy = float(r['hc_x']), float(r['hc_y']); sp = math.degrees(math.atan2(hx - HX, HY - hy)); x['spray'] = -sp if r['stand'] == 'R' else sp
            except ValueError: pass
        R.append(x)
by = {}
for x in R: by.setdefault(x['b'], []).append(x['dep'])
mu = {b: st.mean(v) for b, v in by.items()}
for x in R: x['dd'] = x['dep'] - mu[x['b']]
def m(v, k): return st.mean(x[k] for x in v) if v else 0
def slope(v, kx, ky):
    mx, my = m(v, kx), m(v, ky); sxx = sum((x[kx] - mx) ** 2 for x in v)
    return sum((x[kx] - mx) * (x[ky] - my) for x in v) / sxx if sxx else 0
B = [x for x in R if 'spray' in x]
n = len(R)
print('LEAGUE fastball contact n %d, balls in play with a landing spot %d' % (n, len(B)))
print('  by pitch height (share of zone): share, vm, attack, foul, depth')
for lo, hi in ((-9, 0), (0, .25), (.25, .5), (.5, .75), (.75, 1), (1, 9)):
    S = [x for x in R if lo <= x['h'] < hi]
    print('   %5s..%-5s %.3f  vm %+5.1f  attack %+5.1f  foul %.3f  depth %+5.1f' % (lo, hi, len(S) / n, m(S, 'vm'), m(S, 'aa'), sum(x['foul'] for x in S) / len(S), m(S, 'dd')))
print('  balls in play: spray per degree of bat direction, within depth bands (and the mean spray, direction):')
for lo, hi in ((-99, -8), (-8, -4), (-4, 0), (0, 4), (4, 8), (8, 99)):
    S = [x for x in B if lo <= x['dd'] < hi]
    print('   %4d..%-3d  slope %.2f   spray %+5.1f  dir %+5.1f  spray - 1.5 dir %+5.1f   n %d' % (lo, hi, slope(S, 'dir', 'spray'), m(S, 'spray'), m(S, 'dir'), m(S, 'spray') - 1.5 * m(S, 'dir'), len(S)))
print('  balls in play, all: spray per degree of direction %.2f; spray per inch of depth %.2f; direction per inch %.2f' % (slope(B, 'dir', 'spray'), slope(B, 'dd', 'spray'), slope(B, 'dd', 'dir')))
# the same within bands of the pitch's horizontal location (inside +), to see the hands' turn apart from depth
print('  balls in play: spray per degree of direction within bands of pitch location (in, + inside):')
for lo, hi in ((-99, -6), (-6, -2), (-2, 2), (2, 6), (6, 99)):
    S = [x for x in B if lo <= x['inside'] < hi]
    print('   %4d..%-3d  slope %.2f   spray %+5.1f  dir %+5.1f  depth %+5.1f  n %d' % (lo, hi, slope(S, 'dir', 'spray'), m(S, 'spray'), m(S, 'dir'), m(S, 'dd'), len(S)))
# two-way: spray on direction and depth together (least squares)
mx, md, ms = m(B, 'dir'), m(B, 'dd'), m(B, 'spray')
sxx = sum((x['dir'] - mx) ** 2 for x in B); sdd = sum((x['dd'] - md) ** 2 for x in B); sxd = sum((x['dir'] - mx) * (x['dd'] - md) for x in B)
sxs = sum((x['dir'] - mx) * (x['spray'] - ms) for x in B); sds = sum((x['dd'] - md) * (x['spray'] - ms) for x in B)
det = sxx * sdd - sxd * sxd; b1 = (sxs * sdd - sds * sxd) / det; b2 = (sds * sxx - sxs * sxd) / det
print('  spray = %+.2f x direction %+.2f x depth (both at once, balls in play)' % (b1, b2))
