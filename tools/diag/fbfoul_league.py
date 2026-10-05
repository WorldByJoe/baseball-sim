# fastball contact (tracked): share and foul rate by launch minus attack band; foul rate by contact depth tercile
import csv, glob, statistics as st
B = [(-90, -40), (-40, -15), (-15, 5), (5, 25), (25, 40), (40, 60), (60, 99)]
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in ('FF', 'SI', 'FC') or r['description'] not in ('foul', 'hit_into_play'): continue
        try: vm = float(r['launch_angle']) - float(r['attack_angle']); dep = float(r['intercept_ball_minus_batter_pos_y_inches'])
        except ValueError: continue
        R.append((vm, r['description'] == 'foul', dep, r['batter']))
n = len(R); print('LEAGUE fastball tracked contact n %d, foul share %.3f' % (n, sum(x[1] for x in R) / n))
print('  vm band   share  foul')
for lo, hi in B:
    S = [x for x in R if lo <= x[0] < hi]; print('  %4d..%-4d %.3f  %.3f' % (lo, hi, len(S) / n, sum(x[1] for x in S) / len(S)))
by = {}
for x in R: by.setdefault(x[3], []).append(x[2])
mu = {b: st.mean(v) for b, v in by.items()}
D = sorted(x[2] - mu[x[3]] for x in R); t1, t2 = D[len(D) // 3], D[2 * len(D) // 3]
for nm, lo, hi in (('deep', -99, t1), ('middle', t1, t2), ('out front', t2, 99)):
    S = [x for x in R if lo <= x[2] - mu[x[3]] < hi]; print('  depth %-9s foul %.3f' % (nm, sum(x[1] for x in S) / len(S)))
