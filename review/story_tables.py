"""
story_tables.py · v0.1 · 2026-10-14

Two league tables from the 2026 regular season (statcast/raw/pitches/2026, read-only), for review/postseason_story.py:
  win expectancy: the home side's win chance (Statcast's home_win_exp) at the start of a plate appearance, by inning (9 =
    the ninth and later), half, outs, bases and the home lead (-6..6)
  hit chance: the share of balls in play that fell for a hit, and for extra bases, by exit speed (5 mph) and launch angle
    (5 deg), the league's own contact-to-outcome map
  python3 review/story_tables.py  -> diag_out/story/tables.json
"""
import glob, json, os
import pandas as pd, numpy as np
SRC = os.path.expanduser('~/bsim-wt/review/statcast/raw/pitches/2026')
cols = ['game_type', 'game_pk', 'at_bat_number', 'pitch_number', 'inning', 'inning_topbot', 'outs_when_up', 'on_1b', 'on_2b', 'on_3b', 'home_score', 'away_score',
        'home_win_exp', 'events', 'launch_speed', 'launch_angle', 'type']
D = pd.concat([pd.read_csv(f, usecols=lambda c: c in cols, low_memory=False) for f in sorted(glob.glob(SRC + '/*.csv'))], ignore_index=True)
D = D[D.game_type == 'R']
F = D.sort_values(['game_pk', 'at_bat_number', 'pitch_number']).groupby(['game_pk', 'at_bat_number']).first().reset_index()
F['inn'] = F.inning.clip(upper=9); F['half'] = (F.inning_topbot == 'Bot').astype(int)
F['b'] = F.on_1b.notna().astype(int) + 2 * F.on_2b.notna().astype(int) + 4 * F.on_3b.notna().astype(int)
F['lead'] = (F.home_score - F.away_score).clip(-6, 6)
we = F.dropna(subset=['home_win_exp']).groupby(['inn', 'half', 'outs_when_up', 'b', 'lead']).home_win_exp.agg(['mean', 'size']).reset_index()
WE = {'%d|%d|%d|%d|%d' % (r.inn, r.half, r.outs_when_up, r.b, r.lead): round(float(r.mean), 4) for r in we.rename(columns={'size': 'nn'}).itertuples() if r.nn >= 3}
L = D.sort_values(['game_pk', 'at_bat_number', 'pitch_number']).groupby(['game_pk', 'at_bat_number']).last().reset_index()
B = L[(L.type == 'X') & L.launch_speed.notna() & L.launch_angle.notna()].copy()
B['ev'] = (B.launch_speed // 5 * 5).clip(40, 115).astype(int); B['la'] = (B.launch_angle // 5 * 5).clip(-40, 70).astype(int)
B['hit'] = B.events.isin(['single', 'double', 'triple', 'home_run']); B['xbh'] = B.events.isin(['double', 'triple', 'home_run']); B['hr'] = B.events == 'home_run'
h = B.groupby(['ev', 'la']).agg(n=('hit', 'size'), hit=('hit', 'mean'), xbh=('xbh', 'mean'), hr=('hr', 'mean')).reset_index()
HIT = {'%d|%d' % (r.ev, r.la): [round(float(r.hit), 4), round(float(r.xbh), 4), round(float(r.hr), 4), int(r.n)] for r in h.itertuples()}
json.dump({'we': WE, 'hit': HIT, 'note': '2026 regular season (review/story_tables.py)'}, open(os.path.expanduser('~/bsim-wt/engdev/diag_out/story/tables.json'), 'w'))
print('win expectancy states %d, contact cells %d, plate appearances %d, balls in play %d' % (len(WE), len(HIT), len(F), len(B)))
