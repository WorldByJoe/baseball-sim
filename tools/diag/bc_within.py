# bc_within.py: what sets a slow pitch's contact depth - its gap to the pitcher's fastball, or how far it strays from
# his usual speed for that type? Within each type: depth (about each hitter's mean) on the pitcher's usual gap for the
# type (across pitchers), the pitch's own speed about his usual for the type (within pitcher), height and inside.
# A batter who times a recognised pitch from the fastball he expected meets both slopes alike; one who times it from
# the type's own usual speed meets the within-pitcher one and not the across-pitcher one.
import pickle, statistics as st, numpy as np
R = pickle.load(open('diag_out/bc/league.pkl', 'rb'))
TY = ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS')
C = [x for x in R if x['description'] in ('foul', 'hit_into_play') and x['pitch_type'] in TY and x['bat_speed'] and x['bat_speed'] >= 50
     and x['intercept_ball_minus_batter_pos_y_inches'] is not None and x['sz_top'] and x['gap'] is not None]
by = {}
for x in C: by.setdefault(x['batter'], []).append(x['intercept_ball_minus_batter_pos_y_inches'])
mu = {b: st.mean(v) for b, v in by.items()}
pt = {}
for x in R:
    if x['pitch_type'] in TY and x['release_speed'] and x['gap'] is not None: pt.setdefault((x['pitcher'], x['pitch_type']), []).append(x['gap'])
pt = {k: st.mean(v) for k, v in pt.items() if len(v) >= 20}
print('LEAGUE depth (in, + out front) = a + b_across x his usual gap + b_within x (this pitch - his usual) + c x height + d x inside   [mph, zone, in]')
print('  type     n   usual gap (sd)  b_across  b_within    c_h    d_in')
for t in TY:
    v = [x for x in C if x['pitch_type'] == t and (x['pitcher'], t) in pt]
    for x in v:
        x['dd'] = x['intercept_ball_minus_batter_pos_y_inches'] - mu[x['batter']]; x['g0'] = pt[(x['pitcher'], t)]; x['dv'] = x['gap'] - x['g0']
        x['h'] = (x['plate_z'] - x['sz_bot']) / (x['sz_top'] - x['sz_bot']); x['ins'] = -12 * (x['plate_x'] if x['stand'] == 'R' else -x['plate_x'])
    X = np.array([[1, x['g0'], x['dv'], x['h'], x['ins']] for x in v]); y = np.array([x['dd'] for x in v])
    b = np.linalg.lstsq(X, y, rcond=None)[0]
    print('  %-3s %6d   %+5.1f (%.1f)    %+5.2f     %+5.2f   %+5.2f  %+5.2f' % (t, len(v), st.mean(x['g0'] for x in v), st.pstdev(x['g0'] for x in v), b[1], b[2], b[3], b[4]))
W = [x for x in C if x['pitch_type'] in TY and (x['pitcher'], x['pitch_type']) in pt and 'g0' in x]
X = np.array([[1, x['g0'], min(x['g0'], -6), x['dv'], x['h'], x['ins']] + [x['pitch_type'] == t for t in TY[1:]] for x in W], float); y = np.array([x['dd'] for x in W])
b = np.linalg.lstsq(X, y, rcond=None)[0]
print('  all types (type intercepts): depth = %+.2f usual gap %+.2f x min(usual gap, -6) %+.2f within %+.2f height %+.3f inside' % tuple(b[1:6]))
X = np.array([[1, x['gap'], min(x['gap'], -6), x['h'], x['ins']] for x in W], float)
b = np.linalg.lstsq(X, y, rcond=None)[0]
print('  all types, no type terms:   depth = %+.2f gap %+.2f x min(gap, -6) [slope past -6 = %.2f] %+.2f height %+.3f inside' % (b[1], b[2], b[1] + b[2], b[3], b[4]))
