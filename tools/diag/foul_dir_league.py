# fastball contact at launch 30-70 deg: fouls vs balls in play - the bat's direction (+ pull), contact depth about the
# batter's mean, launch minus attack angle, exit velocity
import csv, glob, statistics as st
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in ('FF', 'SI', 'FC') or r['description'] not in ('foul', 'hit_into_play'): continue
        try: ev, la, ad, aa, dep = (float(r[k]) for k in ('launch_speed', 'launch_angle', 'attack_direction', 'attack_angle', 'intercept_ball_minus_batter_pos_y_inches'))
        except ValueError: continue
        R.append((r['batter'], r['description'] == 'foul', ev, la, -ad, la - aa, dep))
by = {}
for x in R: by.setdefault(x[0], []).append(x[6])
mu = {b: st.mean(v) for b, v in by.items()}
for lo, hi in ((10, 30), (30, 50), (50, 70)):
    for foul in (True, False):
        S = [x for x in R if lo <= x[3] < hi and x[1] == foul]
        d = [x[4] for x in S]
        print('LEAGUE LA %d-%d %-5s n %5d  bat dir mean %+5.1f sd %4.1f (|dir|>15: %.2f)  depth %+5.1f  vm %+5.1f  EV %5.1f' % (lo, hi, 'foul' if foul else 'BIP', len(S), st.mean(d), st.pstdev(d), sum(1 for v in d if abs(v) > 15) / len(d), st.mean(x[6] - mu[x[0]] for x in S), st.mean(x[5] for x in S), st.mean(x[2] for x in S)))
