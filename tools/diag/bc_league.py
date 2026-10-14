# bc_league.py: the league's breaking-ball contact (BC), from diag_out/bc/league.pkl (bc_cache.py). Tracked contact,
# bat 50+ mph, fouls and balls in play; depth about each hitter's own mean (+ out front).
#  1. depth, attack, tilt, bat speed by pitch type, with its speed gap to the pitcher's fastball
#  2. depth by speed gap (all types pooled; and non-fastballs)
#  3. attack against depth: the slope within each type, and across the types' means, within bands of height
#  4. the breaking balls' foul share, pop-ups per contact, launch; contact per swing by gap (what contact selects)
# Model twin: bc_model.js.
import pickle, statistics as st, numpy as np
R = pickle.load(open('diag_out/bc/league.pkl', 'rb'))
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
SW = ('swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play')
C = [x for x in R if x['description'] in ('foul', 'hit_into_play') and x['pitch_type'] in KIND and x['bat_speed'] and x['bat_speed'] >= 50
     and x['attack_angle'] is not None and x['intercept_ball_minus_batter_pos_y_inches'] is not None and x['sz_top'] and x['launch_angle'] is not None]
by = {}
for x in C: by.setdefault(x['batter'], []).append(x)
mu = {b: (st.mean(v['intercept_ball_minus_batter_pos_y_inches'] for v in L), st.mean(v['bat_speed'] for v in L)) for b, L in by.items()}
for x in C:
    x['dd'] = x['intercept_ball_minus_batter_pos_y_inches'] - mu[x['batter']][0]; x['dbs'] = x['bat_speed'] - mu[x['batter']][1]
    x['h'] = (x['plate_z'] - x['sz_bot']) / (x['sz_top'] - x['sz_bot']); x['k'] = KIND[x['pitch_type']]
    x['pu'] = x['description'] == 'hit_into_play' and x['bb_type'] == 'popup'
def m(v, k): return st.mean(x[k] for x in v) if v else float('nan')
def slope(v, kx, ky):
    if len(v) < 30: return float('nan')
    return np.polyfit([x[kx] for x in v], [x[ky] for x in v], 1)[0]
print('LEAGUE tracked contact, bat 50+ mph: n %d' % len(C))
print('1. by type      n     gap    depth  attack  tilt   bat   LA    foul  PU/c   attack/in within')
for t in ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'KC', 'CH', 'FS'):
    v = [x for x in C if x['pitch_type'] == t]
    g = [x['gap'] for x in v if x['gap'] is not None]
    print('   %-3s  %6d  %+5.1f  %+5.1f  %5.1f  %5.1f  %+5.2f %5.1f  %.3f  %.3f  %.2f' % (t, len(v), st.mean(g), m(v, 'dd'), m(v, 'attack_angle'), m(v, 'swing_path_tilt'), m(v, 'dbs'), m(v, 'launch_angle'),
          sum(x['description'] == 'foul' for x in v) / len(v), sum(x['pu'] for x in v) / len(v), slope(v, 'dd', 'attack_angle')))
for k in ('FB', 'BR', 'OS'):
    v = [x for x in C if x['k'] == k]
    print('   %-3s  %6d  %+5.1f  %+5.1f  %5.1f  %5.1f  %+5.2f %5.1f  %.3f  %.3f  %.2f' % (k, len(v), st.mean(x['gap'] for x in v if x['gap'] is not None), m(v, 'dd'), m(v, 'attack_angle'), m(v, 'swing_path_tilt'), m(v, 'dbs'), m(v, 'launch_angle'),
          sum(x['description'] == 'foul' for x in v) / len(v), sum(x['pu'] for x in v) / len(v), slope(v, 'dd', 'attack_angle')))
print('2. depth by speed gap (mph to his fastball):  all contact  |  non-fastballs  (n, depth, attack, bat)')
G = [x for x in C if x['gap'] is not None]
for lo, hi in ((2, 9), (-1, 2), (-3, -1), (-5, -3), (-7, -5), (-9, -7), (-11, -9), (-13, -11), (-15, -13), (-18, -15), (-30, -18)):
    v = [x for x in G if lo <= x['gap'] < hi]; w = [x for x in v if x['k'] != 'FB']
    print('   %+4d..%+-4d  %6d %+5.1f %5.1f %+5.2f  |  %6d %+5.1f %5.1f %+5.2f' % (lo, hi, len(v), m(v, 'dd'), m(v, 'attack_angle'), m(v, 'dbs'), len(w), m(w, 'dd'), m(w, 'attack_angle'), m(w, 'dbs')))
print('3. attack per inch of depth, by height band: within FB / within BR / within OS / across the 9 types\' means (in the band)')
for lo, hi in ((-9, .25), (.25, .5), (.5, .75), (.75, 9), (-9, 9)):
    v = [x for x in C if lo <= x['h'] < hi]
    ws = [slope([x for x in v if x['k'] == k], 'dd', 'attack_angle') for k in ('FB', 'BR', 'OS')]
    pts = [(m([x for x in v if x['pitch_type'] == t], 'dd'), m([x for x in v if x['pitch_type'] == t], 'attack_angle')) for t in ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'KC', 'CH', 'FS')]
    a = np.polyfit([p[0] for p in pts], [p[1] for p in pts], 1)[0]
    print('   h %5.2f..%-5.2f  n %6d   %.2f  %.2f  %.2f   across %.2f' % (lo, hi, len(v), ws[0], ws[1], ws[2], a))
# a joint fit: attack on depth, height and the type's kind - is a breaking ball met at the same depth and height swung flatter?
X = np.array([[1, x['dd'], x['h'], x['k'] == 'BR', x['k'] == 'OS'] for x in C], float); y = np.array([x['attack_angle'] for x in C])
b = np.linalg.lstsq(X, y, rcond=None)[0]
print('   joint: attack = %.1f + %.2f depth + %.1f height %+.1f breaking %+.1f off-speed' % tuple(b))
X2 = np.array([[1, x['dd'], x['h'], x['dbs'], x['k'] == 'BR', x['k'] == 'OS'] for x in C], float)
b2 = np.linalg.lstsq(X2, y, rcond=None)[0]
print('   with bat speed about his mean: attack = %.1f + %.2f depth + %.1f height + %.2f bat %+.1f breaking %+.1f off-speed' % tuple(b2))
print('4. swings by speed gap: contact per swing, whiffs per swing, tracked contact\'s depth sd')
S = [x for x in R if x['description'] in SW and x['gap'] is not None and x['pitch_type'] in KIND]
for lo, hi in ((-1, 9), (-5, -1), (-9, -5), (-13, -9), (-30, -13)):
    v = [x for x in S if lo <= x['gap'] < hi]; c = [x for x in C if x['gap'] is not None and lo <= x['gap'] < hi]
    print('   %+4d..%+-4d  swings %6d  contact %.3f  depth sd %.1f' % (lo, hi, len(v), sum(x['description'] in ('foul', 'foul_tip', 'hit_into_play') for x in v) / len(v), st.pstdev(x['dd'] for x in c)))
