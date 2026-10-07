# aa_league.py: the bat's attack angle on contact by pitch kind and height, against contact depth (42 days of 2025,
# bat 50+ mph, fouls and balls in play with tracking): mean attack, launch, launch minus attack ("vm") and depth about
# each hitter's own mean, by kind; then by height (share of his zone) within each kind; and the attack's slope on depth
# within kind. Model twin: aa_model.js.
import csv, glob, statistics as st
import numpy as np
K = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'CU': 'BR', 'ST': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['description'] not in ('foul', 'hit_into_play') or r['pitch_type'] not in K: continue
        try: bs, la, aa, dep, pz, top, bot = (float(r[k]) for k in ('bat_speed', 'launch_angle', 'attack_angle', 'intercept_ball_minus_batter_pos_y_inches', 'plate_z', 'sz_top', 'sz_bot'))
        except ValueError: continue
        if bs < 50: continue
        R.append({'b': r['batter'], 'k': K[r['pitch_type']], 'aa': aa, 'la': la, 'dep': dep, 'h': (pz - bot) / (top - bot), 'foul': r['description'] == 'foul'})
mu = {}
for x in R: mu.setdefault(x['b'], []).append(x['dep'])
mu = {b: st.mean(v) for b, v in mu.items()}
for x in R: x['dd'] = x['dep'] - mu[x['b']]
HB = ((-9, 0), (0, .25), (.25, .5), (.5, .75), (.75, 1), (1, 9))
print('LEAGUE contact (bat 50+ mph): by kind - n, attack, LA, vm, depth about his mean, in-play LA; then attack / depth by height (below, 0-.25 ... above); attack per inch of depth')
for k in ('FB', 'BR', 'OS'):
    v = [x for x in R if x['k'] == k]
    b = np.polyfit([x['dd'] for x in v], [x['aa'] for x in v], 1)[0]
    print('  %s n %5d  attack %5.1f  LA %5.1f  vm %5.1f  depth %+5.1f  in-play LA %5.1f  | attack/in %.2f' % (k, len(v), st.mean(x['aa'] for x in v), st.mean(x['la'] for x in v), st.mean(x['la'] - x['aa'] for x in v), st.mean(x['dd'] for x in v), st.mean(x['la'] for x in v if not x['foul']), b))
    print('     by height: ' + '  '.join('%5.1f/%+5.1f' % (st.mean(x['aa'] for x in w), st.mean(x['dd'] for x in w)) if w else '  -  ' for w in ([x for x in v if lo <= x['h'] < hi] for lo, hi in HB)))
