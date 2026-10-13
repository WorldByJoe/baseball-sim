"""
injury_effects.py · v0.1 · 2026-10-13

Play before an injured-list stint and after it (Joe, 2026-10-13: is there a before/after effect, and a trend after the
return; the days on the list as an index of how bad the injury was). For every stint that opened and closed within one
season (season/injuries.json, 2025 and 2026), each of the man's games falls in a window by days: before he was placed
(60-31, 30-11, 10-1 days before) or after he came back (days 0-13, 14-27, 28-55, 56-120). Each measure, pitch by pitch or
plate appearance by plate appearance, is regressed on the windows (for each stint length: under 20 days, 20-59, 60 or
more) with fixed effects for the man's season (and pitch type, for speed) and for the calendar month league-wide (arms
build up, the weather warms), so a window's coefficient is his play in it against his own play away from the injury that
season. Standard errors clustered by player.
  pitchers   fastball speed (four-seam, sinker, cutter), whiffs per swing, strikeouts per batter faced, expected wOBA
             allowed per plate appearance (Statcast's from exit speed and angle on balls in play, the real value otherwise)
  hitters    bat speed per swing (bunts out), exit speed per ball in play, expected wOBA per plate appearance, strikeouts

  python3 season/injury_effects.py      -> season/injury_effects.json

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import glob, json, math, os, sys, datetime
import numpy as np, pandas as pd
import scipy.sparse as sp
from scipy.sparse.linalg import lsqr
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'statcast', 'raw', 'pitches')
COLS = ['game_date', 'game_pk', 'game_type', 'batter', 'pitcher', 'pitch_type', 'release_speed', 'bat_speed', 'description', 'events', 'woba_value', 'woba_denom',
        'estimated_woba_using_speedangle', 'launch_speed', 'type']
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
BINS = [('60-31 days before', -60, -31), ('30-11 days before', -30, -11), ('10-1 days before', -10, -1),
        ('days 0-13 back', 0, 13), ('days 14-27 back', 14, 27), ('days 28-55 back', 28, 55), ('days 56-120 back', 56, 120)]
SEV = [('under 20 days', 0, 19), ('20-59 days', 20, 59), ('60+ days', 60, 999)]


def windows(D, who, stints):
    """per row: the window index (bin, severity) or -1, from the man's (who: 'pitcher' or 'batter') within-season stints"""
    out = np.full(len(D), -1); best = np.full(len(D), 10 ** 6)
    dates = D.game_date.values.astype('datetime64[D]'); ids = D[who].values
    order = np.argsort(ids, kind='stable'); sid = ids[order]
    for st in stints:
        lo, hi = np.searchsorted(sid, st['id']), np.searchsorted(sid, st['id'], side='right')
        if lo == hi: continue
        rows = order[lo:hi]; d = dates[rows]
        P = np.datetime64(st['placed'][:10]); A = np.datetime64(st['activated'][:10])
        before = (d < P).astype(bool); rel = np.where(before, (d - P).astype(int), (d - A).astype(int))
        after = d >= A; ok = (before | after) & (d.astype('datetime64[Y]') == P.astype('datetime64[Y]'))
        s = next(k for k, (_, a, b) in enumerate(SEV) if a <= st['days'] <= b)
        for k, (_, a, b) in enumerate(BINS):
            m = ok & (rel >= a) & (rel <= b)
            idx = rows[m]; dist = np.abs(rel[m])
            take = dist < best[idx]
            out[idx[take]] = k * len(SEV) + s; best[idx[take]] = dist[take]
    return out


def fit(y, win, fe_groups, cluster):
    """y on the window dummies with the fixed effects partialled out; coefficients and player-clustered se"""
    y = np.asarray(y, float); n = len(y); K = len(BINS) * len(SEV)
    X = sp.hstack([sp.csr_matrix((np.ones(n), (np.arange(n), g)), shape=(n, g.max() + 1)) for g in fe_groups]).tocsr()
    res = lambda v: v - X @ lsqr(X, v, atol=1e-9, btol=1e-9, iter_lim=3000)[0]
    W = np.zeros((n, K)); m = win >= 0; W[np.arange(n)[m], win[m]] = 1
    keep = [k for k in range(K) if W[:, k].sum() >= 30]
    RW = np.column_stack([res(W[:, k] - W[:, k].mean()) for k in keep]); ry = res(y - y.mean())
    XtX = RW.T @ RW; b = np.linalg.solve(XtX, RW.T @ ry); e = ry - RW @ b
    S = pd.DataFrame(RW * e[:, None]).groupby(np.asarray(cluster)).sum().values
    V = np.linalg.solve(XtX, np.linalg.solve(XtX, S.T @ S).T)
    out = {}
    for j, k in enumerate(keep):
        out[k] = (float(b[j]), float(math.sqrt(max(V[j, j], 0))), int(W[:, k].sum()))
    return out


def main():
    D = pd.concat([pd.read_csv(f, usecols=lambda c: c in COLS, low_memory=False) for yr in (2025, 2026) for f in sorted(glob.glob(os.path.join(RAW, str(yr), '*.csv')))], ignore_index=True)
    D = D[D.game_type == 'R'].copy()
    D['game_date'] = pd.to_datetime(D.game_date); D['yr'] = D.game_date.dt.year; D['month'] = D.game_date.dt.year * 100 + D.game_date.dt.month
    S = [s for s in json.load(open(os.path.join(HERE, 'injuries.json')))['stints'] if s['days'] is not None and s['placed'][:4] == s['activated'][:4] and s['placed'][:4] in ('2025', '2026') and s['days'] >= 7]
    print('%d within-season stints in 2025-26 (%s)' % (len(S), ', '.join('%s %d' % (lab, sum(a <= s['days'] <= b for s in S)) for lab, a, b in SEV)))
    code = lambda *cols: pd.factorize(pd.Series(list(zip(*cols))))[0] if len(cols) > 1 else pd.factorize(cols[0])[0]
    swing = D.description.isin(SWING).values; pa = (D.woba_denom == 1).values
    xw = np.where(D.type.values == 'X', D.estimated_woba_using_speedangle.fillna(D.woba_value).values, D.woba_value.values)
    out = {}
    for who, measures in (('pitcher', [('fastball mph', (D.pitch_type.isin(['FF', 'SI', 'FC']) & D.release_speed.notna()).values, D.release_speed.values, True),
                                         ('whiffs per swing', swing, D.description.isin(WHIFF).values.astype(float), False),
                                         ('strikeouts per batter faced', pa, D.events.isin(['strikeout', 'strikeout_double_play']).values.astype(float), False),
                                         ('expected wOBA allowed', pa, xw, False)]),
                          ('batter', [('bat speed mph', swing & D.bat_speed.notna().values & (D.bat_speed.values > 50), D.bat_speed.values, False),
                                      ('exit speed mph', (D.type.values == 'X') & D.launch_speed.notna().values, D.launch_speed.values, False),
                                      ('expected wOBA', pa, xw, False),
                                      ('strikeouts per plate appearance', pa, D.events.isin(['strikeout', 'strikeout_double_play']).values.astype(float), False)])):
        win = windows(D, who, S)
        for name, sel, y, by_type in measures:
            sel = sel & np.isfinite(np.asarray(y, float))
            T = D[sel]
            g_player = code(T[who].values, T.yr.values, T.pitch_type.values) if by_type else code(T[who].values, T.yr.values)
            r = fit(np.asarray(y, float)[sel], win[sel], [g_player, code(T.month.values)], T[who].values)
            key = '%s: %s' % (who, name); out[key] = {}
            print('%s (rows %d)' % (key, sel.sum()))
            for k, (b, s_, n) in sorted(r.items()):
                bi, si = divmod(k, len(SEV))
                out[key]['%s | %s' % (BINS[bi][0], SEV[si][0])] = {'effect': round(b, 5), 'se': round(s_, 5), 'rows': n}
            for si, (slab, _, _) in enumerate(SEV):
                print('   %-14s ' % slab + '  '.join('%s %+.4f (%.4f)' % (BINS[bi][0].replace(' days', 'd').replace(' back', ''), r[bi * len(SEV) + si][0], r[bi * len(SEV) + si][1]) if bi * len(SEV) + si in r else '%s   -' % BINS[bi][0] for bi in range(len(BINS))))
    json.dump(out, open(os.path.join(HERE, 'injury_effects.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
