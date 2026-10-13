"""
unhealed.py · v0.1 · 2026-10-13

Do injuries that are not healed drag on a player's late season? (Joe, 2026-10-13, on Ohtani's NLCS.) Two tests, 2025-26:
  1. The late-season change: for each player-season, his August-September level minus his June-July level (for a man
     back from an injured-list stint, June-July counts only from two weeks after his return, as the first two weeks back
     run low: season/injury_effects.py). Men back by July 15 from a stint that season against men with no stint at all;
     the difference is what the earlier injury adds to the usual late-season change (the calendar and the league's own
     late-season drift cancel). Each player-season weighted by its precision, with the real spread between them added
     (estimated); the difference regressed with his age as a covariate (older pitchers fade late: history/season_fade.py).
  2. Recurrence: how often a man back from an early stint goes back on the list from August on, and how often for the
     same body part, against the chance that a man with no early stint is placed from August on.
Measures: hitters expected wOBA per plate appearance, exit speed, bat speed; pitchers fastball speed (his own types),
strikeouts per batter faced, expected wOBA allowed. A player-season needs 40 plate appearances (or batters faced, or
swings, or balls in play, or fastballs) in each period.

  python3 season/unhealed.py      -> season/unhealed.json

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import glob, json, math, os, datetime
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'statcast', 'raw', 'pitches')
COLS = ['game_date', 'game_type', 'batter', 'pitcher', 'pitch_type', 'release_speed', 'bat_speed', 'description', 'events', 'woba_value', 'woba_denom',
        'estimated_woba_using_speedangle', 'launch_speed', 'type', 'age_bat', 'age_pit']
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
MIN_N = 40


def wls_diff(dv, se2, group, age):
    """dv = a + b group + c (age - 30), weights 1/(se2 + tau2); tau2 by moments; returns b, se(b), means"""
    X = np.column_stack([np.ones(len(dv)), group, age - 30])
    w = 1 / se2; b = np.linalg.lstsq(X * np.sqrt(w)[:, None], dv * np.sqrt(w), rcond=None)[0]
    r = dv - X @ b; tau2 = max(0.0, (np.sum(w * r ** 2) - (len(dv) - 3)) / (w.sum() - (w ** 2).sum() / w.sum()))
    w = 1 / (se2 + tau2); A = X.T @ (X * w[:, None]); b = np.linalg.solve(A, X.T @ (w * dv)); V = np.linalg.inv(A)
    return b[1], math.sqrt(V[1, 1]), b[0]


def main():
    D = pd.concat([pd.read_csv(f, usecols=lambda c: c in COLS, low_memory=False) for yr in (2025, 2026) for f in sorted(glob.glob(os.path.join(RAW, str(yr), '*.csv')))], ignore_index=True)
    D = D[D.game_type == 'R'].copy(); D['game_date'] = pd.to_datetime(D.game_date); D['yr'] = D.game_date.dt.year
    D['xw'] = np.where(D.type == 'X', D.estimated_woba_using_speedangle.fillna(D.woba_value), D.woba_value)
    D['k'] = D.events.isin(['strikeout', 'strikeout_double_play']).astype(float)
    S = [s for s in json.load(open(os.path.join(HERE, 'injuries.json')))['stints'] if s['placed'][:4] in ('2025', '2026') or (s['activated'] or '')[:4] in ('2025', '2026')]
    out = {}
    for yr in (2025, 2026):
        season_start = pd.Timestamp('%d-03-01' % yr)
        early = {}   # player -> (stint) back by July 15 from a stint of this season (placed from the spring on)
        late = {}    # player -> stints placed from August 1
        anyst = set()
        for s in S:
            p = pd.Timestamp(s['placed'][:10]); a = pd.Timestamp(s['activated'][:10]) if s['activated'] else None
            if a is not None and a < season_start: continue
            if p.year > yr or (a is None and p.year < yr): continue
            if p.year == yr or (a is not None and a.year == yr): anyst.add(s['id'])
            if a is not None and a.year == yr and a <= pd.Timestamp('%d-07-15' % yr) and p >= pd.Timestamp('%d-02-01' % yr): early.setdefault(s['id'], s)
            if p.year == yr and p >= pd.Timestamp('%d-08-01' % yr): late.setdefault(s['id'], []).append(s)
        Y = D[D.yr == yr]
        mid0, mid1, late0 = pd.Timestamp('%d-06-01' % yr), pd.Timestamp('%d-07-31' % yr), pd.Timestamp('%d-08-01' % yr)
        res = {}
        for who, measures in (('batter', [('expected wOBA', 'pa'), ('exit speed', 'bip'), ('bat speed', 'swing')]),
                              ('pitcher', [('fastball mph', 'ff'), ('strikeouts per batter faced', 'pa'), ('expected wOBA allowed', 'pa')])):
            agecol = 'age_bat' if who == 'batter' else 'age_pit'
            for name, kind in measures:
                if kind == 'pa': T = Y[Y.woba_denom == 1]; val = T.k if 'strikeouts' in name else T.xw
                elif kind == 'bip': T = Y[(Y.type == 'X') & Y.launch_speed.notna()]; val = T.launch_speed
                elif kind == 'swing': T = Y[Y.description.isin(SWING) & Y.bat_speed.notna() & (Y.bat_speed > 50)]; val = T.bat_speed
                else: T = Y[Y.pitch_type.isin(['FF', 'SI', 'FC']) & Y.release_speed.notna()]; val = T.release_speed
                T = T.assign(v=val.values)
                if kind == 'ff':   # his own pitch types: each type's speed as a deviation from his season mean of it
                    T = T.assign(v=T.v - T.groupby([who, 'pitch_type']).v.transform('mean'))
                rows = []
                for pid, g in T.groupby(who):
                    if pid in anyst and pid not in early: continue   # injured, but not an early stint he was back from
                    start = mid0
                    if pid in early: start = max(mid0, pd.Timestamp(early[pid]['activated'][:10]) + pd.Timedelta(days=14))
                    m = g[(g.game_date >= start) & (g.game_date <= mid1)].v; l = g[g.game_date >= late0].v
                    if len(m) < MIN_N or len(l) < MIN_N: continue
                    se2 = m.var(ddof=1) / len(m) + l.var(ddof=1) / len(l)
                    rows.append((l.mean() - m.mean(), se2, int(pid in early), float(g[agecol].median()), int(pid in early and pid in late),
                                 int(pid in early and any(x['part'] == early[pid]['part'] for x in late.get(pid, []))), int(pid in late)))
                R = np.array(rows)
                b, se, a = wls_diff(R[:, 0], R[:, 1], R[:, 2], R[:, 3])
                res['%s: %s' % (who, name)] = {'n_early': int(R[:, 2].sum()), 'n_none': int(len(R) - R[:, 2].sum()), 'usualChange': round(a, 4), 'extraAfterEarlyInjury': round(b, 4), 'se': round(se, 4)}
        # recurrence: back from an early stint -> placed again from August on (and for the same part), against men with none early
        ids = set(Y.batter) | set(Y.pitcher)
        pre = {s['id'] for s in S if pd.Timestamp(s['placed'][:10]) < late0 and (s['activated'] is None or pd.Timestamp(s['activated'][:10]) >= season_start)}   # on the list at some time before August
        ne = [i for i in ids if i in early]; nn = [i for i in ids if i not in pre]
        rec = sum(1 for i in ne if i in late); same = sum(1 for i in ne if any(x['part'] == early[i]['part'] for x in late.get(i, [])))
        base = sum(1 for i in nn if i in late)
        res['recurrence'] = {'backFromEarly': len(ne), 'placedAgainFromAugust': rec, 'sameBodyPart': same, 'othersPlacedFromAugust': base, 'others': len(nn)}
        out[yr] = res
        print(yr)
        for k, v in res.items():
            if k == 'recurrence':
                print('  recurrence: of %d men back from an early stint, %d (%.0f%%) went back on the list from August on, %d for the same body part (%.0f%%); of %d others, %d (%.0f%%) were placed from August on' % (
                    v['backFromEarly'], v['placedAgainFromAugust'], 100 * v['placedAgainFromAugust'] / max(1, v['backFromEarly']), v['sameBodyPart'], 100 * v['sameBodyPart'] / max(1, v['backFromEarly']),
                    v['others'], v['othersPlacedFromAugust'], 100 * v['othersPlacedFromAugust'] / max(1, v['others'])))
            else:
                print('  %-38s usual Jun-Jul -> Aug-Sep change %+.4f; extra after an early injury %+.4f (se %.4f, t %+.1f)  [%d back from early stints, %d without stints]' % (
                    k, v['usualChange'], v['extraAfterEarlyInjury'], v['se'], v['extraAfterEarlyInjury'] / v['se'], v['n_early'], v['n_none']))
    json.dump(out, open(os.path.join(HERE, 'unhealed.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
