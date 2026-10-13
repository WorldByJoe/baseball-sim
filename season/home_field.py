"""
home_field.py · v0.1 · 2026-10-13

Is there a home-field advantage, and whose is it? (Joe, 2026-10-13: do pitchers pitch better at home, and hitters hit
better at home?) The engine has no home term: its replays gave the home team 50.1% of 2026's games, the real home teams
won 52.9%. From every regular-season pitch of 2025 and 2026 (statcast/raw/pitches), each measure regressed on a home
indicator with fixed effects for the batter, the pitcher and the park (the home team's park), so the edge is measured
within players and within parks: the same man at home against away, in the same park as the visitors. Standard errors
are clustered by game.

A plate appearance always pits a home player against a visitor, so its outcome cannot say whose the edge is: a home
hitter's gain and a visiting pitcher's loss are the same event. The outcomes (wOBA, strikeouts, walks, home runs, exit
speed) give the two together. Measures that belong to one side alone split it:
  pitcher   four-seam speed, extension, spin (pitcher and park effects): does he throw harder at home?
  hitter    bat speed (batter and park effects); chases and swings in the zone (batter, pitcher, park)
  umpire    a taken pitch called a strike, at the same spot (2-inch cells by the batter's zone) and count: are the home
            pitchers given more strikes? (2026 had the challenge system)
Then the runs and wins the outcome edge is worth: wOBA's edge / its scale (1.23) x 38 plate appearances a team-game.

  python3 season/home_field.py      -> season/home_field.json

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import glob, json, math, os, sys
import numpy as np, pandas as pd
import scipy.sparse as sp
from scipy.sparse.linalg import lsqr
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'statcast', 'raw', 'pitches')
COLS = ['game_pk', 'game_type', 'home_team', 'inning_topbot', 'batter', 'pitcher', 'events', 'description', 'woba_value', 'woba_denom', 'pitch_type',
        'release_speed', 'release_spin_rate', 'release_extension', 'bat_speed', 'plate_x', 'plate_z', 'sz_top', 'sz_bot', 'launch_speed', 'stand', 'zone', 'balls', 'strikes', 'type']
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play', 'foul_bunt', 'missed_bunt', 'bunt_foul_tip'}
TAKE = {'ball', 'blocked_ball', 'called_strike'}
K_EV = {'strikeout', 'strikeout_double_play'}
WOBA_SCALE, PA_GAME = 1.23, 38.0


def load(yr):
    D = pd.concat([pd.read_csv(f, usecols=lambda c: c in COLS, low_memory=False) for f in sorted(glob.glob(os.path.join(RAW, str(yr), '*.csv')))], ignore_index=True)
    D = D[D.game_type == 'R'].copy()
    D['batHome'] = (D.inning_topbot == 'Bot').astype(float)
    return D


def code(s): return pd.factorize(s)[0]


def fe(y, home, groups, cluster):
    """the home indicator's coefficient with the groups' fixed effects partialled out (Frisch-Waugh), se clustered"""
    y = np.asarray(y, float); h = np.asarray(home, float); n = len(y)
    X = sp.hstack([sp.csr_matrix((np.ones(n), (np.arange(n), g)), shape=(n, g.max() + 1)) for g in groups]).tocsr()
    res = lambda v: v - X @ lsqr(X, v, atol=1e-9, btol=1e-9, iter_lim=3000)[0]
    ry, rh = res(y - y.mean()), res(h - h.mean())
    b = (rh @ ry) / (rh @ rh); e = ry - b * rh
    s = pd.Series(rh * e).groupby(np.asarray(cluster)).sum().values
    return b, math.sqrt((s ** 2).sum()) / (rh @ rh), n


def main():
    out = {}
    for yr in (2025, 2026):
        D = load(yr); R = {}
        gb, gp, gk, gg = code(D.batter), code(D.pitcher), code(D.home_team), D.game_pk.values
        # plate-appearance outcomes: both sides together (home hitters' PAs against visiting hitters')
        pa = D[D.woba_denom == 1]
        sel = (D.woba_denom == 1).values
        for name, y in (('wOBA', pa.woba_value.values), ('K', pa.events.isin(K_EV).values), ('BB', (pa.events == 'walk').values), ('HR', (pa.events == 'home_run').values)):
            R[name] = fe(y, pa.batHome, [gb[sel], gp[sel], gk[sel]], gg[sel])
        bip = (D.type == 'X').values & D.launch_speed.notna().values
        R['exitSpeed'] = fe(D.launch_speed.values[bip], D.batHome.values[bip], [gb[bip], gp[bip], gk[bip]], gg[bip])
        # the pitcher's own: home = he is the home pitcher (the visitors bat)
        ff = (D.pitch_type == 'FF').values & D.release_speed.notna().values
        ph = 1 - D.batHome.values
        R['pitcher: four-seam mph'] = fe(D.release_speed.values[ff], ph[ff], [gp[ff], gk[ff]], gg[ff])
        ok = ff & D.release_extension.notna().values
        R['pitcher: extension ft'] = fe(D.release_extension.values[ok], ph[ok], [gp[ok], gk[ok]], gg[ok])
        ok = ff & D.release_spin_rate.notna().values
        R['pitcher: four-seam rpm'] = fe(D.release_spin_rate.values[ok], ph[ok], [gp[ok], gk[ok]], gg[ok])
        # the hitter's own
        sw = D.description.isin(SWING).values
        ok = sw & D.bat_speed.notna().values & (D.bat_speed.values > 50)
        R['hitter: bat speed mph'] = fe(D.bat_speed.values[ok], D.batHome.values[ok], [gb[ok], gk[ok]], gg[ok])
        z = D.zone.values
        out_z = np.isin(z, [11, 12, 13, 14]); in_z = np.isin(z, range(1, 10))
        R['hitter: chase'] = fe(sw[out_z], D.batHome.values[out_z], [gb[out_z], gp[out_z], gk[out_z]], gg[out_z])
        R['hitter: zone swing'] = fe(sw[in_z], D.batHome.values[in_z], [gb[in_z], gp[in_z], gk[in_z]], gg[in_z])
        # the umpire: a take at the same spot and count, called a strike, for the home pitcher
        tk = D.description.isin(TAKE).values & D.plate_x.notna().values & D.sz_top.notna().values
        T = D[tk]
        hgt = (T.plate_z - T.sz_bot) / (T.sz_top - T.sz_bot)
        xin = np.where(T.stand == 'R', T.plate_x, -T.plate_x) * 12
        cell = code(pd.Series(np.floor(xin / 2).astype(int).astype(str)) + '|' + pd.Series(np.floor(hgt.values / 0.08).astype(int).astype(str)) + '|' + T['balls'].astype(str).values + T['strikes'].astype(str).values)
        R['umpire: called strike'] = fe((T.description == 'called_strike').values, 1 - T.batHome.values, [cell, gb[tk], gp[tk]], gg[tk])
        games = D.groupby('game_pk').first()
        out[yr] = {k: {'home': round(b, 5), 'se': round(s, 5), 'n': n} for k, (b, s, n) in R.items()}
        w = R['wOBA']
        out[yr]['runsPerGame'] = round(w[0] / WOBA_SCALE * PA_GAME, 3); out[yr]['runsPerGameSe'] = round(w[1] / WOBA_SCALE * PA_GAME, 3)
        print('%d (%d games):' % (yr, len(games)))
        for k, (b, s, n) in R.items():
            print('  %-24s home minus away %+.5f (se %.5f, t %+.1f)  n %d' % (k, b, s, b / s, n))
        print('  home edge in runs a game (wOBA edge / %.2f x %d PA): %+.3f (se %.3f)' % (WOBA_SCALE, PA_GAME, out[yr]['runsPerGame'], out[yr]['runsPerGameSe']))
    json.dump(out, open(os.path.join(HERE, 'home_field.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
