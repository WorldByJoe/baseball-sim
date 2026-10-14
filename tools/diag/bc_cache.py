# bc_cache.py: the league's pitches (42 days of 2025) cut to the fields the breaking-ball contact study (BC) needs,
# cached as diag_out/bc/league.pkl so bc_league.py can be rerun quickly. Adds each pitcher's primary fastball speed
# (his four-seamer, else his sinker, over the 42 days) so every pitch carries its speed gap.
import csv, glob, pickle, statistics as st
F = ['pitch_type', 'game_date', 'release_speed', 'batter', 'pitcher', 'description', 'stand', 'p_throws', 'balls', 'strikes',
     'plate_x', 'plate_z', 'sz_top', 'sz_bot', 'launch_speed', 'launch_angle', 'bat_speed', 'swing_length', 'attack_angle',
     'attack_direction', 'swing_path_tilt', 'intercept_ball_minus_batter_pos_x_inches', 'intercept_ball_minus_batter_pos_y_inches', 'bb_type']
NUM = set(F[2:3] + F[10:16] + F[16:23])
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        x = {}
        for k in F:
            v = r.get(k, '')
            if k in NUM:
                try: v = float(v)
                except ValueError: v = None
            x[k] = v
        R.append(x)
sp = {}
for x in R:
    if x['pitch_type'] in ('FF', 'SI') and x['release_speed']: sp.setdefault((x['pitcher'], x['pitch_type']), []).append(x['release_speed'])
fb = {}
for (p, t), v in sp.items():
    if len(v) < 10: continue
    if t == 'FF' or p not in fb: fb[p] = st.mean(v) if t == 'FF' or p not in fb else fb[p]
for x in R: x['gap'] = (x['release_speed'] - fb[x['pitcher']]) if x['release_speed'] and x['pitcher'] in fb else None
pickle.dump(R, open('diag_out/bc/league.pkl', 'wb'))
print(len(R), 'pitches;', len(fb), 'pitchers with a fastball')
