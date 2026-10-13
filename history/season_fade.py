"""
season_fade.py · v0.1 · 2026-10-12

Do older players fade more within a season? For each player-season (regular season, history/pitches), the straight-line
trend from opening day to the season's end of:
  hitters    bat speed per swing (bunts out), exit speed per ball in play, expected wOBA per ball in play, strikeouts per PA
  pitchers   speed of his main fastball type per pitch, whiffs per swing, strikeouts per batter faced
then, across player-seasons, that trend against age (weighted by each trend's precision plus the real spread of trends
between players, estimated): trend = a + b (age - 30). a holds what the calendar does to everyone (summer heat, arms
building up); b is the age difference asked about. Reported as the change over a whole season (six months).

  python3 history/season_fade.py [years]       -> history/season_fade.json

CHANGED
  v0.1  first build (Joe, 2026-10-12: do older players have a stronger within-season decline?)
"""
import csv, gzip, glob, json, os, sys, datetime, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
NOT_PA = {'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home', 'pickoff_1b', 'pickoff_2b', 'pickoff_3b', 'stolen_base_2b', 'stolen_base_3b', 'wild_pitch',
          'passed_ball', 'other_advance', 'truncated_pa', 'game_advisory', 'ejection', 'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home'}


def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def slope(t, v, binary=False):
    t, v = np.array(t), np.array(v, float)
    if len(t) < 30 or t.std() < 0.5: return None
    tc = t - t.mean(); b = (tc @ (v - v.mean())) / (tc @ tc)
    res = v - v.mean() - b * tc; s2 = res @ res / (len(v) - 2)
    return b, math.sqrt(s2 / (tc @ tc)), len(v)


def main(years):
    birth = {p['id']: p.get('birthDate') for p in json.load(open(os.path.join(HERE, 'rosters.json')))['players']}
    stats = json.load(open(os.path.join(HERE, 'season_stats.json')))['players']
    series = {}   # measure -> list of (slope per month, se, n, age, sp)
    MIN = {'batSpeed': 300, 'ev': 150, 'xwoba': 150, 'K_h': 250, 'fbVelo': 300, 'whiff_p': 300, 'K_p': 200}
    for fn in sorted(glob.glob(os.path.join(HERE, 'pitches', '*.csv.gz'))):
        b = os.path.basename(fn)[:-7].split('_'); y, role, pid = int(b[0]), b[1], int(b[2])
        if y not in years or not birth.get(pid): continue
        open_day = datetime.date(y, 3, 20)
        rows = [r for r in csv.DictReader(gzip.open(fn, 'rt')) if r.get('game_type') == 'R']
        if not rows: continue
        bd = datetime.date.fromisoformat(birth[pid]); age = (datetime.date(y, 7, 1) - bd).days / 365.25
        T = lambda r: (datetime.date.fromisoformat(r['game_date']) - open_day).days / 30.44
        M = {}
        if role == 'batter':
            M['batSpeed'] = [(T(r), f(r['bat_speed'])) for r in rows if r['description'] in SWING and f(r.get('bat_speed')) and f(r['bat_speed']) > 40 and r.get('bunt') != '1']
            M['ev'] = [(T(r), f(r['launch_speed'])) for r in rows if r['type'] == 'X' and f(r.get('launch_speed'))]
            M['xwoba'] = [(T(r), f(r['estimated_woba_using_speedangle'])) for r in rows if r['type'] == 'X' and f(r.get('estimated_woba_using_speedangle')) is not None]
            M['K_h'] = [(T(r), 1.0 if r['events'].startswith('strikeout') else 0.0) for r in rows if r.get('events') and r['events'] not in NOT_PA]
            sp = None
        else:
            types = {}
            for r in rows:
                if r['pitch_type'] in ('FF', 'SI'): types[r['pitch_type']] = types.get(r['pitch_type'], 0) + 1
            if types:
                main_t = max(types, key=types.get)
                M['fbVelo'] = [(T(r), f(r['release_speed'])) for r in rows if r['pitch_type'] == main_t and f(r.get('release_speed'))]
            M['whiff_p'] = [(T(r), 1.0 if r['description'] in WHIFF else 0.0) for r in rows if r['description'] in SWING]
            M['K_p'] = [(T(r), 1.0 if r['events'].startswith('strikeout') else 0.0) for r in rows if r.get('events') and r['events'] not in NOT_PA]
            s_ = (stats.get(str(pid)) or {}).get('pitching_%d' % y) or {}
            sp = 1 if s_.get('G') and (s_.get('GS') or 0) >= 0.5 * s_['G'] else 0
        for k, pts in M.items():
            if len(pts) < MIN[k]: continue
            s = slope([p[0] for p in pts], [p[1] for p in pts])
            if s: series.setdefault(k, []).append((s[0], s[1], s[2], age, sp, pid, y))
    out = {}
    for k, L in series.items():
        A = np.array([[l[0], l[1], l[3], l[4] if l[4] is not None else 0] for l in L])
        s, se, age, sp = A[:, 0], A[:, 1], A[:, 2], A[:, 3]
        X = np.column_stack([np.ones_like(s), age - 30] + ([sp] if k in ('fbVelo', 'whiff_p', 'K_p') else []))
        tau2 = max(0.0, s.var() - (se ** 2).mean())
        for _ in range(10):
            w = 1 / (se ** 2 + tau2); beta = np.linalg.solve((X.T * w) @ X, (X.T * w) @ s); r = s - X @ beta
            tau2 = max(0.0, (w * (r ** 2 - se ** 2)).sum() / w.sum())
        V = np.linalg.inv((X.T * w) @ X); bse = np.sqrt(np.diag(V))
        six = lambda A_: (6 * (beta[0] + beta[1] * (A_ - 30)), 6 * math.sqrt(V[0, 0] + (A_ - 30) ** 2 * V[1, 1] + 2 * (A_ - 30) * V[0, 1]))
        out[k] = {'playerSeasons': len(L), 'perMonthAt30': [round(float(beta[0]), 5), round(float(bse[0]), 5)], 'agePerMonthPerYear': [round(float(beta[1]), 6), round(float(bse[1]), 6)],
                  'starterPerMonth': [round(float(beta[2]), 5), round(float(bse[2]), 5)] if X.shape[1] > 2 else None, 'trueSlopeSd': round(math.sqrt(tau2), 5),
                  'seasonChange': {str(A_): [round(six(A_)[0], 4), round(six(A_)[1], 4)] for A_ in (25, 30, 35)},
                  'ageT': round(float(beta[1] / bse[1]), 2)}
        print('%-9s %4d player-seasons | over a season: age 25 %+.3f (%.3f), 30 %+.3f, 35 %+.3f (%.3f) | age term per 10 years %+.3f a season (t %.1f)%s' % (
            k, len(L), six(25)[0], six(25)[1], six(30)[0], six(35)[0], six(35)[1], 60 * beta[1], beta[1] / bse[1],
            ' | starters vs relievers %+.3f a season (t %.1f)' % (6 * beta[2], beta[2] / bse[2]) if X.shape[1] > 2 else ''))
    json.dump(out, open(os.path.join(HERE, 'season_fade.json'), 'w'), indent=1)


if __name__ == '__main__':
    main([int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '2023,2024,2025,2026').split(',')])
