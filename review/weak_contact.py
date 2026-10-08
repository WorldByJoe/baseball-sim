"""
weak_contact.py · v0.1 · 2026-10-08

How do pitchers cause weak contact? For each playoff pitcher (2025-26 regular season, his own Statcast pitches,
playoffs/pitches/<year>_pitcher_<id>.csv.gz), the balls put in play against him split into the three things an
exit speed is made of: how fast the batter swung (bat_speed), how squarely he met the ball (the exit speed as a
share of the most that swing and that pitch can give, 1.23 bat speed + 0.23 pitch speed: 0.8 or more is
Statcast's "squared up"), and where he met it (intercept_ball_minus_batter_pos_y: inches out in front). For each,
how much of the spread among pitchers repeats (split-half reliability, odd balls against even) and how it lines up
with the hard-hit share he allows.

  python3 review/weak_contact.py
"""
import json, glob, gzip, csv, os
import numpy as np

def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None

def balls(pid):
    out = []
    for yr in ('2025', '2026'):
        p = 'playoffs/pitches/%s_pitcher_%d.csv.gz' % (yr, pid)
        if not os.path.exists(p): continue
        for r in csv.DictReader(gzip.open(p, 'rt')):
            if r.get('game_type') != 'R' or r.get('type') != 'X': continue
            ev, la, bs, ps, dep = f(r.get('launch_speed')), f(r.get('launch_angle')), f(r.get('bat_speed')), f(r.get('release_speed')), f(r.get('intercept_ball_minus_batter_pos_y_inches'))
            if ev is None or la is None: continue
            sq = ev / (1.23 * bs + 0.23 * 0.92 * ps) if bs and ps and bs > 40 else None   # pitch speed at the plate ~0.92 of release
            out.append({'ev': ev, 'la': la, 'hard': ev >= 95, 'bs': bs if bs and bs > 40 else None, 'sq': sq, 'sqd': (sq >= 0.8) if sq else None, 'dep': dep,
                        'kind': 'FB' if r.get('pitch_type') in ('FF', 'SI', 'FC') else 'BR' if r.get('pitch_type') in ('SL', 'ST', 'CU', 'KC', 'SV', 'CS') else 'OS'})
    return out

def mean(B, k): v = [b[k] for b in B if b[k] is not None]; return (float(np.mean(v)), len(v)) if v else (None, 0)

M = [json.loads(l) for fn in glob.glob('diag_out/contact/*.jsonl') for l in open(fn) if l.startswith('{')]
rows = []
for m in M:
    B = balls(m['id'])
    if len(B) < 120: continue
    row = {'id': m['id'], 'name': m['name'], 'team': m['team'], 'n': len(B)}
    for k in ('hard', 'ev', 'la', 'bs', 'sq', 'sqd', 'dep'):
        row[k] = mean(B, k)[0]; row[k + '_a'] = mean(B[0::2], k)[0]; row[k + '_b'] = mean(B[1::2], k)[0]
    row['n_bs'] = mean(B, 'bs')[1]
    rows.append(row)
print('%d pitchers, median %d balls in play, %d with bat tracking' % (len(rows), np.median([r['n'] for r in rows]), np.median([r['n_bs'] for r in rows])))
print('%-34s %8s %8s %11s %13s' % ('measure (balls in play)', 'mean', 'sd', 'repeats', 'r with hard%'))
hard = np.array([r['hard'] for r in rows])
res = {}
for k, lab in (('hard', 'hard-hit share'), ('ev', 'exit speed, mph'), ('bs', 'bat speed on contact, mph'), ('sq', 'squareness (EV / max)'), ('sqd', 'squared-up share'), ('dep', 'contact point, in out front'), ('la', 'launch angle')):
    ok = [r for r in rows if r[k] is not None and r[k + '_a'] is not None and r[k + '_b'] is not None]
    x = np.array([r[k] for r in ok]); a = np.array([r[k + '_a'] for r in ok]); b = np.array([r[k + '_b'] for r in ok])
    rh = np.corrcoef(a, b)[0, 1]; rel = 2 * rh / (1 + rh)
    rr = np.corrcoef(x, np.array([r['hard'] for r in ok]))[0, 1]
    res[k] = {'mean': x.mean(), 'sd': x.std(), 'reliability': rel, 'r_hard': rr}
    print('%-34s %8.3f %8.3f %11.2f %13.2f' % (lab, x.mean(), x.std(), rel, rr))
# how much of the pitchers' spread in exit speed each part carries: EV ~ bat speed + squareness (a regression across pitchers)
ok = [r for r in rows if r['bs'] and r['sq'] and r['dep'] is not None]
X = np.column_stack([np.ones(len(ok)), [r['bs'] for r in ok], [r['sq'] for r in ok], [r['dep'] for r in ok]]); y = np.array([r['ev'] for r in ok])
beta = np.linalg.lstsq(X, y, rcond=None)[0]; pred = X @ beta; r2 = 1 - np.var(y - pred) / np.var(y)
print('exit speed across pitchers = %.1f + %.2f bat speed + %.1f squareness + %.2f depth (R2 %.2f)' % tuple(list(beta) + [r2]))
for j, k in ((1, 'bs'), (2, 'sq'), (3, 'dep')):
    print('  share of the spread in exit speed from %s: %.2f' % (k, (beta[j] * np.std(X[:, j])) ** 2 / np.var(y)))
json.dump({'rows': rows, 'summary': res, 'ev_fit': {'beta': list(beta), 'r2': r2}}, open('review/weak_contact.json', 'w'), indent=1, default=float)
