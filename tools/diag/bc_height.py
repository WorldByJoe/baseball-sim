# bc_height.py: is the league's depth by pitch height the arc's phase or a shift of the whole arc? The bat's direction
# (attack_direction, + pull) follows the phase round the arc; if low pitches met out front are also pulled more at the
# same depth, depth is the phase. Joint least squares of attack, direction and tilt on depth, height, kind.
import pickle, statistics as st, numpy as np
R = pickle.load(open('diag_out/bc/league.pkl', 'rb'))
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
C = [x for x in R if x['description'] in ('foul', 'hit_into_play') and x['pitch_type'] in KIND and x['bat_speed'] and x['bat_speed'] >= 50
     and x['attack_angle'] is not None and x['attack_direction'] is not None and x['swing_path_tilt'] is not None and x['intercept_ball_minus_batter_pos_y_inches'] is not None and x['sz_top']]
by = {}
for x in C: by.setdefault(x['batter'], []).append(x)
mu = {b: st.mean(v['intercept_ball_minus_batter_pos_y_inches'] for v in L) for b, L in by.items()}
for x in C:
    x['dd'] = x['intercept_ball_minus_batter_pos_y_inches'] - mu[x['batter']]; x['h'] = (x['plate_z'] - x['sz_bot']) / (x['sz_top'] - x['sz_bot'])
    x['dir'] = -x['attack_direction']   # + toward his pull side (Savant's attack_direction is batter-relative, - pull; as fbdepth_league.py)
    x['ins'] = (x['plate_x'] if x['stand'] == 'R' else -x['plate_x']) * -12   # in toward him from the plate's centre: + inside
for k in ('attack_angle', 'dir', 'swing_path_tilt'):
    X = np.array([[1, x['dd'], x['h'], x['ins'], KIND[x['pitch_type']] == 'BR', KIND[x['pitch_type']] == 'OS'] for x in C], float); y = np.array([x[k] for x in C])
    b = np.linalg.lstsq(X, y, rcond=None)[0]
    print('%-16s = %6.2f %+.3f depth(in) %+6.2f height(zone) %+.3f inside(in) %+5.2f breaking %+5.2f off-speed' % ((k,) + tuple(b)))
print('direction by depth (sanity: + should rise out front):', ['%+.1f' % st.mean(x['dir'] for x in C if lo <= x['dd'] < lo + 4) for lo in range(-12, 12, 4)])
print('fastballs by height: n, depth, attack, direction, tilt')
for lo, hi in ((-9, 0), (0, .25), (.25, .5), (.5, .75), (.75, 1), (1, 9)):
    v = [x for x in C if KIND[x['pitch_type']] == 'FB' and lo <= x['h'] < hi]
    print('   %5.2f..%-5.2f %6d  %+5.1f  %5.1f  %+5.1f  %5.1f' % (lo, hi, len(v), st.mean(x['dd'] for x in v), st.mean(x['attack_angle'] for x in v), st.mean(x['dir'] for x in v), st.mean(x['swing_path_tilt'] for x in v)))
