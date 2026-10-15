"""squared_real.py · v0.1 · 2026-10-15: the league's squared-up distribution on balls in play (2026 regular season, bat tracking):
q = exit speed / (1.23 x bat speed + 0.23 x pitch speed at the plate), Statcast's measure of how much of the swing's possible exit
speed the contact got; its quantiles and the share below each cut, overall and for grounders, with the weak-topped share. For the
mishit population (the model review, item 4)."""
import glob, os, json
import pandas as pd, numpy as np
cols = ['game_type', 'type', 'description', 'launch_speed', 'launch_angle', 'bat_speed', 'release_speed', 'effective_speed']
D = pd.concat([pd.read_csv(f, usecols=lambda c: c in cols, low_memory=False) for f in sorted(glob.glob(os.path.expanduser('~/bsim-wt/review/statcast/raw/pitches/2026/*.csv')))], ignore_index=True)
D = D[(D.game_type == 'R') & (D.type == 'X')].dropna(subset=['launch_speed', 'launch_angle', 'bat_speed', 'release_speed'])
D = D[D.bat_speed > 50]
plate = D.release_speed * 0.92   # about 8% lost to drag on the way in
D['q'] = D.launch_speed / (1.23 * D.bat_speed + 0.23 * plate)
qs = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9]; cuts = [0.4, 0.5, 0.6, 0.7, 0.8]
out = {'n': len(D), 'quantiles': {str(k): round(float(D.q.quantile(k)), 3) for k in qs}, 'below': {str(c): round(float((D.q < c).mean()), 4) for c in cuts},
       'gb_below': {str(c): round(float((D[D.launch_angle < 10].q < c).mean()), 4) for c in cuts},
       'weakTopped': round(float(((D.launch_speed < 70) & (D.launch_angle < -10)).mean()), 4), 'meanBat': round(float(D.bat_speed.mean()), 1)}
json.dump(out, open(os.path.expanduser('~/bsim-wt/engdev/diag_out/squared_real.json'), 'w'), indent=1); print(json.dumps(out))
