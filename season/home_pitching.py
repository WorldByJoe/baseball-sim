"""
home_pitching.py · v0.1 · 2026-10-13

Do pitchers pitch differently at home? (Joe, 2026-10-13: the home edge went to the hitters; are there measurable
differences in pitching, speed or breaking-ball movement, and how likely are they to matter?) From every regular-season
pitch of 2025 and 2026, per pitch type: speed, induced vertical break (pfx_z), horizontal break toward his arm side
(pfx_x), spin, each regressed on "he is the home pitcher" with pitcher and park fixed effects (season/home_field.py's fe:
within the same man, within the same park, so the park's air and cameras cancel; clustered by game). Then his command:
the share of his pitches in the zone and on its edge (within 2 in of it, either side), with batter, pitcher and park
effects; and how steady his release is (the spread of his four-seam release height within a game, game by game).

  python3 season/home_pitching.py      -> season/home_pitching.json

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import glob, json, math, os, sys
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from home_field import fe, code, RAW
COLS = ['game_pk', 'game_type', 'home_team', 'inning_topbot', 'batter', 'pitcher', 'pitch_type', 'p_throws', 'release_speed', 'release_spin_rate', 'pfx_x', 'pfx_z',
        'release_pos_z', 'plate_x', 'plate_z', 'sz_top', 'sz_bot', 'zone']
TYPES = ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'KC', 'CH', 'FS')


def main():
    out = {}
    for yr in (2025, 2026):
        D = pd.concat([pd.read_csv(f, usecols=lambda c: c in COLS, low_memory=False) for f in sorted(glob.glob(os.path.join(RAW, str(yr), '*.csv')))], ignore_index=True)
        D = D[D.game_type == 'R'].copy()
        D['ph'] = (D.inning_topbot == 'Top').astype(float)   # the home team pitches in the top half
        D['ivb'] = D.pfx_z * 12; D['hb'] = D.pfx_x * 12 * np.where(D.p_throws == 'R', -1, 1)   # + toward his arm side
        gp, gk, gb, gg = code(D.pitcher), code(D.home_team), code(D.batter), D.game_pk.values
        R = {}
        for t in TYPES:
            sel = (D.pitch_type == t).values
            for col, lab in (('release_speed', 'mph'), ('ivb', 'vertical break in'), ('hb', 'arm-side break in'), ('release_spin_rate', 'rpm')):
                ok = sel & D[col].notna().values
                if ok.sum() < 5000: continue
                b, s, n = fe(D[col].values[ok], D.ph.values[ok], [gp[ok], gk[ok]], gg[ok])
                R['%s %s' % (t, lab)] = (b, s, n)
        # command: in the zone, and on its edge (2 in either side of it)
        ok = D.plate_x.notna().values & D.sz_top.notna().values
        X = np.abs(D.plate_x.values) * 12; Z = D.plate_z.values * 12; top = D.sz_top.values * 12; bot = D.sz_bot.values * 12
        half = 8.5 + 1.45
        dx = X - half; dz = np.maximum(bot - Z, Z - top); dist = np.maximum(dx, dz)   # inches outside the zone (negative inside)
        inz = (dist <= 0).astype(float); edge = (np.abs(dist) <= 2).astype(float)
        R['zone rate'] = fe(inz[ok], D.ph.values[ok], [gp[ok], gb[ok], gk[ok]], gg[ok])
        R['edge rate'] = fe(edge[ok], D.ph.values[ok], [gp[ok], gb[ok], gk[ok]], gg[ok])
        # release steadiness: his four-seam release height's spread within a game
        F = D[(D.pitch_type == 'FF') & D.release_pos_z.notna()]
        G = F.groupby(['game_pk', 'pitcher']).agg(sd=('release_pos_z', 'std'), n=('release_pos_z', 'size'), ph=('ph', 'first'), park=('home_team', 'first')).reset_index()
        G = G[G.n >= 15]
        R['FF release height spread within a game in'] = tuple(x * (12 if i < 2 else 1) for i, x in enumerate(fe(G.sd.values, G.ph.values, [code(G.pitcher), code(G.park)], G.game_pk.values)))
        out[yr] = {k: {'home': round(b, 5), 'se': round(s, 5), 'n': n} for k, (b, s, n) in R.items()}
        print('%d: home pitcher minus away pitcher (same man, same park)' % yr)
        for k, (b, s, n) in R.items():
            print('  %-34s %+8.4f (se %.4f, t %+5.1f)  n %d' % (k, b, s, b / s, n))
    json.dump(out, open(os.path.join(HERE, 'home_pitching.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
