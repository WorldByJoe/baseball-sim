# vd_causes.py: three candidate causes of the league's launch-minus-attack falling with contact depth (VD).
# (1) plane matching: at a given depth and height, does a pitch that descends more steeply get a steeper attack?
# (2) one cause for both: a pitch slower than its pitcher's usual for its type is met out front AND drops more than
#     expected; does the depth slope survive holding that speed deviation (and the descent)?
# (3) selection: the slope among balls in play and among fouls separately.
import pickle, statistics as st, numpy as np
R = pickle.load(open('diag_out/bc/league.pkl', 'rb'))
K = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
pt = {}
for x in R:
    if x['pitch_type'] in K and x['release_speed']: pt.setdefault((x['pitcher'], x['pitch_type']), []).append(x['release_speed'])
pt = {k: st.mean(v) for k, v in pt.items() if len(v) >= 20}
C = [x for x in R if x['description'] in ('foul', 'hit_into_play') and x['pitch_type'] in K and x['bat_speed'] and x['bat_speed'] >= 50 and x['attack_angle'] is not None
     and x['intercept_ball_minus_batter_pos_y_inches'] is not None and x['launch_angle'] is not None and x['sz_top'] and x['vaa'] is not None and (x['pitcher'], x['pitch_type']) in pt]
by = {}
for x in C: by.setdefault(x['batter'], []).append(x['intercept_ball_minus_batter_pos_y_inches'])
mu = {b: st.mean(v) for b, v in by.items()}
for x in C:
    x['dd'] = x['intercept_ball_minus_batter_pos_y_inches'] - mu[x['batter']]; x['h'] = (x['plate_z'] - x['sz_bot']) / (x['sz_top'] - x['sz_bot'])
    x['vm'] = x['launch_angle'] - x['attack_angle']; x['k'] = K[x['pitch_type']]; x['dv'] = x['release_speed'] - pt[(x['pitcher'], x['pitch_type'])]
def fit(v, y, cols):
    X = np.array([[1] + [f(x) for f in cols] for x in v], float); return np.linalg.lstsq(X, np.array([x[y] for x in v]), rcond=None)[0]
print('(1) attack = a + b depth + c height + p x descent (deg; - down), within kind: p = -1 would be a batter matching the pitch\'s plane')
for k in ('FB', 'BR', 'OS'):
    v = [x for x in C if x['k'] == k]; b = fit(v, 'attack_angle', [lambda x: x['dd'], lambda x: x['h'], lambda x: x['vaa']])
    print('   %s  depth %+.3f  height %+.2f  descent %+.3f' % (k, b[1], b[2], b[3]))
print('(2) vm = a + b depth + b2 depth^2 + c height + s x speed off his usual + q x descent, within kind')
for k in ('FB', 'BR', 'OS'):
    v = [x for x in C if x['k'] == k]
    b0 = fit(v, 'vm', [lambda x: x['dd'], lambda x: x['dd'] ** 2, lambda x: x['h']])
    b = fit(v, 'vm', [lambda x: x['dd'], lambda x: x['dd'] ** 2, lambda x: x['h'], lambda x: x['dv'], lambda x: x['vaa']])
    print('   %s  depth %+.3f (%+.3f without)  speed off usual %+.3f per mph  descent %+.3f per deg' % (k, b[1], b0[1], b[4], b[5]))
print('(3) the depth slope of vm among balls in play / fouls (height held), and the in-play launch by depth')
for k in ('FB', 'SLOW'):
    v = [x for x in C if (x['k'] == 'FB') == (k == 'FB')]
    bi = fit([x for x in v if x['description'] == 'hit_into_play'], 'vm', [lambda x: x['dd'], lambda x: x['h']])
    bf = fit([x for x in v if x['description'] == 'foul'], 'vm', [lambda x: x['dd'], lambda x: x['h']])
    print('   %-4s in play %+.3f  fouls %+.3f' % (k, bi[1], bf[1]))
