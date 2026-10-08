"""
contact_check.py · v0.1 · 2026-10-08

Does the model tell pitchers apart by the contact they allow? Each playoff pitcher's contact in the model
(review/check_contact.js, diag_out/contact/*.jsonl) against his own 2025-26 regular-season Statcast pitches
(playoffs/pitches/<year>_pitcher_<id>.csv.gz): the share of balls in play hit 95 mph or harder, the share on the
ground (launch under 10 degrees), mean exit speed, home runs a plate appearance; strikeouts and walks (fitted) for
reference. For each measure: the spread among pitchers that is real skill (the split-half reliability of his own
balls, odd against even, says how much of the spread repeats), and how well the model's numbers line up with his.

  python3 review/contact_check.py
"""
import json, glob, gzip, csv, os
import numpy as np

def real(pid):
    E = {'pa': 0, 'k': 0, 'bb': 0, 'hr': 0}; balls = []
    for yr in ('2025', '2026'):
        f = 'playoffs/pitches/%s_pitcher_%d.csv.gz' % (yr, pid)
        if not os.path.exists(f): continue
        for r in csv.DictReader(gzip.open(f, 'rt')):
            if r.get('game_type') != 'R': continue
            ev = r.get('events') or ''
            if ev and r.get('woba_denom') in ('1', '1.0'):
                E['pa'] += 1; E['k'] += ev.startswith('strikeout'); E['bb'] += ev in ('walk',); E['hr'] += ev == 'home_run'
            if r.get('type') == 'X' and r.get('launch_speed') and r.get('launch_angle'):
                balls.append((float(r['launch_speed']), float(r['launch_angle'])))
    return E, balls

def meas(balls):
    b = np.array(balls)
    return {'hard': np.mean(b[:, 0] >= 95), 'gb': np.mean(b[:, 1] < 10), 'ev': b[:, 0].mean()}

M = [json.loads(l) for f in glob.glob('diag_out/contact/*.jsonl') for l in open(f) if l.startswith('{')]
rows = []
for m in M:
    E, balls = real(m['id'])
    if len(balls) < 80 or E['pa'] < 100: continue
    r = meas(balls); a, b = meas(balls[0::2]), meas(balls[1::2])
    rows.append({'id': m['id'], 'name': m['name'], 'team': m['team'], 'nbip': len(balls), 'pa': E['pa'],
                 'real': dict(r, K=E['k'] / E['pa'], BB=E['bb'] / E['pa'], HR=E['hr'] / E['pa']), 'half': (a, b),
                 'model': {k: m[k] for k in ('hard', 'gb', 'ev', 'K', 'BB', 'HR')}})
print('%d pitchers with 80+ balls in play in 2025-26 (median %d)' % (len(rows), np.median([r['nbip'] for r in rows])))
print('%-28s %8s %8s %10s %10s %8s' % ('measure', 'real sd', 'model sd', 'split-half', 'model~real', 'slope'))
out = {}
for k, lab in (('K', 'strikeouts a PA (fitted)'), ('BB', 'walks a PA (fitted)'), ('hard', 'hard-hit share (95+ mph)'), ('gb', 'ground-ball share'), ('ev', 'mean exit speed'), ('HR', 'home runs a PA')):
    x = np.array([r['model'][k] for r in rows]); y = np.array([r['real'][k] for r in rows])
    w = np.array([r['nbip'] for r in rows], float)
    rel = None
    if k in ('hard', 'gb', 'ev'):
        h1 = np.array([r['half'][0][k] for r in rows]); h2 = np.array([r['half'][1][k] for r in rows])
        rh = np.corrcoef(h1, h2)[0, 1]; rel = 2 * rh / (1 + rh)   # Spearman-Brown: the whole sample's reliability
    c = np.corrcoef(x, y)[0, 1]; slope = np.polyfit(y, x, 1)[0]
    out[k] = {'real_sd': y.std(), 'model_sd': x.std(), 'reliability': rel, 'r': c, 'slope_model_on_real': slope}
    print('%-28s %8.3f %8.3f %10s %10.2f %8.2f' % (lab, y.std(), x.std(), '%.2f' % rel if rel is not None else '', c, slope))
json.dump({'rows': rows, 'summary': out}, open('review/contact_check.json', 'w'), indent=1, default=float)
# who the model misjudges most on hard contact
d = sorted(rows, key=lambda r: r['model']['hard'] - r['real']['hard'])
print('model softest vs real:', [(r['name'], r['team'], round(r['real']['hard'], 2), round(r['model']['hard'], 2)) for r in d[:4]])
print('model hardest vs real:', [(r['name'], r['team'], round(r['real']['hard'], 2), round(r['model']['hard'], 2)) for r in d[-4:]])
for t in ('MIL', 'LAD', 'TB', 'CWS'):
    T = [r for r in rows if r['team'] == t]; w = np.array([r['pa'] for r in T], float)
    v = [np.average([r[s][k] for r in T], weights=w) for k in ('hard', 'gb') for s in ('real', 'model')]
    print(t, 'hard-hit allowed: real %.3f, model %.3f | ground balls: real %.3f, model %.3f' % tuple(v))
