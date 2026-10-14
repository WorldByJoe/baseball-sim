"""
swing_mix_real.py · v0.2 · 2026-10-13

What each swing came to in the league, 2026 regular season (Statcast), for review/swing_mix.js on the engine-dev
branch: per swing the share missed (swinging strikes, blocked or not), fouled (fouls and foul tips) and put in play,
overall and by pitch kind (fastballs, breaking balls, changeups and splitters), and the launch angles of the balls in
play in the run audit's bins. Bunts left out. For step 2 of the run audit (Joe, 2026-10-13).

  python3 season/swing_mix_real.py      -> season/swing_mix_real.json
"""
import glob, json, os
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'statcast', 'raw', 'pitches', '2026')
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CS': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS', 'SC': 'OS'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}; FOUL = {'foul', 'foul_tip'}; PLAY = {'hit_into_play'}
D = pd.concat([pd.read_csv(f, usecols=['game_type', 'description', 'pitch_type', 'launch_angle', 'bb_type'], low_memory=False) for f in sorted(glob.glob(os.path.join(RAW, '*.csv')))], ignore_index=True)
D = D[(D.game_type == 'R') & D.description.isin(WHIFF | FOUL | PLAY)]
D['c'] = np.where(D.description.isin(WHIFF), 'whiff', np.where(D.description.isin(FOUL), 'foul', 'play'))
D['kind'] = D.pitch_type.map(KIND)
out = {'perSwing': {}, 'laShares': {}}
for k, g in [('all', D)] + [(k, D[D.kind == k]) for k in ('FB', 'BR', 'OS')]:
    out['perSwing'][k] = {'swings': len(g), **{c: round(float((g.c == c).mean()), 4) for c in ('whiff', 'foul', 'play')}}
P = D[(D.c == 'play') & D.launch_angle.notna()]
bins = [-91, -10, 0, 10, 20, 30, 40, 50, 91]
h = np.histogram(P.launch_angle.clip(-90, 90), bins)[0] / len(P)
out['laShares'] = {'%d..%d' % (bins[i], bins[i + 1]): round(float(x), 4) for i, x in enumerate(h)}
json.dump(out, open(os.path.join(HERE, 'swing_mix_real.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))

# v0.2: the launch angles by pitch height in the batter's zone (0 its bottom, 1 its top: below, low, middle, high third,
# above) and kind, as review/swing_mix.js v0.2 splits them
P2 = pd.concat([pd.read_csv(f, usecols=['game_type', 'description', 'pitch_type', 'launch_angle', 'plate_z', 'sz_top', 'sz_bot'], low_memory=False) for f in sorted(glob.glob(os.path.join(RAW, '*.csv')))], ignore_index=True)
P2 = P2[(P2.game_type == 'R') & (P2.description == 'hit_into_play') & P2.launch_angle.notna() & P2.plate_z.notna() & P2.sz_top.notna()]
P2['kind'] = P2.pitch_type.map(KIND); P2['hz'] = (P2.plate_z - P2.sz_bot) / (P2.sz_top - P2.sz_bot)
P2['h'] = np.digitize(P2.hz, [0, 1 / 3, 2 / 3, 1])
out['laByHeight'] = {}
for (k, h), g in P2.groupby(['kind', 'h']):
    out['laByHeight']['%s h%d' % (k, h)] = {'n': len(g), 'shares': [round(float(x), 4) for x in np.histogram(g.launch_angle.clip(-90, 90), bins)[0] / len(g)]}
json.dump(out, open(os.path.join(HERE, 'swing_mix_real.json'), 'w'), indent=1)
