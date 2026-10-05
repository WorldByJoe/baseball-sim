# balls in play: the ball's direction left over after the bat's (spray - 1.5 x path, + pull), by launch minus attack band
# - how far contact struck under or over the ball's middle turns away from the bat's line (the barrel's tilt)
import csv, glob, math, statistics as st
HX, HY = 126.0, 205.0
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['description'] != 'hit_into_play': continue
        try: ad, la, aa, hx, hy = (float(r[k]) for k in ('attack_direction', 'launch_angle', 'attack_angle', 'hc_x', 'hc_y'))
        except ValueError: continue
        spray = math.degrees(math.atan2(hx - HX, HY - hy))   # + toward right field
        pull = spray if r['stand'] == 'L' else -spray
        R.append((-ad, pull, la - aa))
print('LEAGUE balls in play n %d: residual spray (pull - 1.5 x path) by launch minus attack band' % len(R))
for lo, hi in ((-90, -15), (-15, 5), (5, 25), (25, 40), (40, 99)):
    S = [x for x in R if lo <= x[2] < hi]
    print('  vm %4d..%-3d n %5d  residual %+5.1f  (mean path %+5.1f, mean spray %+5.1f)' % (lo, hi, len(S), st.mean(x[1] - 1.5 * x[0] for x in S), st.mean(x[0] for x in S), st.mean(x[1] for x in S)))
