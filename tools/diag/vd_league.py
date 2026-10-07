# vd_league.py: the barrel's height against the ball by contact depth (VD), the league's side. Tracked contact (bat 50+
# mph, fouls and balls in play), depth about each hitter's own mean (+ out front), launch minus attack ("vm", + struck
# under the ball's middle). 1: the pitch's descent at the plate by kind; 2: vm by depth, by kind and height band;
# 3: does the slope of vm on depth depend on the pitch's descent? (least squares with a depth x descent term, within
# kind); 4: the same for launch angle and attack. Model twin: vd_model.js.
import pickle, statistics as st, numpy as np
R = pickle.load(open('diag_out/bc/league.pkl', 'rb'))
K = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
C = [x for x in R if x['description'] in ('foul', 'hit_into_play') and x['pitch_type'] in K and x['bat_speed'] and x['bat_speed'] >= 50 and x['attack_angle'] is not None
     and x['intercept_ball_minus_batter_pos_y_inches'] is not None and x['launch_angle'] is not None and x['sz_top'] and x['vaa'] is not None]
by = {}
for x in C: by.setdefault(x['batter'], []).append(x['intercept_ball_minus_batter_pos_y_inches'])
mu = {b: st.mean(v) for b, v in by.items()}
for x in C:
    x['dd'] = x['intercept_ball_minus_batter_pos_y_inches'] - mu[x['batter']]; x['h'] = (x['plate_z'] - x['sz_bot']) / (x['sz_top'] - x['sz_bot'])
    x['vm'] = x['launch_angle'] - x['attack_angle']; x['k'] = K[x['pitch_type']]
print('LEAGUE tracked contact n %d' % len(C))
print('1. descent at the plate (deg, - down): ' + '  '.join('%s %.1f' % (t, st.mean(x['vaa'] for x in C if x['pitch_type'] == t)) for t in ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS')))
DB = ((-99, -4), (-4, 0), (0, 4), (4, 8), (8, 12), (12, 99))
print('2. launch minus attack by depth (in): ' + '  '.join('%d..%d' % b for b in DB))
for k in ('FB', 'SLOW'):
    for hl, (lo, hi) in (('low', (-9, .33)), ('mid', (.33, .67)), ('high', (.67, 9)), ('all', (-9, 9))):
        v = [x for x in C if (x['k'] == 'FB') == (k == 'FB') and lo <= x['h'] < hi]
        row = []
        for a, b in DB:
            w = [x['vm'] for x in v if a <= x['dd'] < b]; row.append('%+6.1f' % st.mean(w) if len(w) > 40 else '   -  ')
        print('   %-4s %-4s n %5d  %s' % (k, hl, len(v), ' '.join(row)))
def fit(v, ycol, cols):
    X = np.array([[1] + [f(x) for f in cols] for x in v], float); y = np.array([x[ycol] for x in v]); return np.linalg.lstsq(X, y, rcond=None)[0]
print('3. vm = a + b depth + g depth x (descent - kind mean) + c height + k descent   (per inch, per deg)')
for k in ('FB', 'BR', 'OS'):
    v = [x for x in C if x['k'] == k]; m = st.mean(x['vaa'] for x in v)
    b = fit(v, 'vm', [lambda x: x['dd'], lambda x: x['dd'] * (x['vaa'] - m), lambda x: x['h'], lambda x: x['vaa'] - m])
    q = fit(v, 'vm', [lambda x: x['dd'], lambda x: x['dd'] ** 2, lambda x: x['h']])
    print('   %s  b %+.3f  g %+.4f  c %+.2f  k %+.2f   | quadratic: %+.3f depth %+.4f depth^2 %+.2f height' % (k, b[1], b[2], b[3], b[4], q[1], q[2], q[3]))
print('4. launch and attack on depth and height, by kind (per inch, per zone height)')
for k in ('FB', 'BR', 'OS'):
    v = [x for x in C if x['k'] == k]
    la = fit(v, 'launch_angle', [lambda x: x['dd'], lambda x: x['h']]); aa = fit(v, 'attack_angle', [lambda x: x['dd'], lambda x: x['h']])
    print('   %s  launch %+.3f /in %+.2f /h   attack %+.3f /in %+.2f /h' % (k, la[1], la[2], aa[1], aa[2]))
