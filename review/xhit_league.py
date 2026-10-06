"""
xhit_league.py · v0.1 · 2026-10-06

What the league made of balls like each one in the review: for every batted
ball in review/game_review.js's output, the 40 nearest balls in play of 2025
(42 days, statcast/raw/pitches) in exit speed, launch angle and direction
(each ball in the batter's pull frame, so a left-handed batter's ball to right
field matches a right-handed batter's to left), and how they ended: an out, a
single, double, triple or home run, an error. That is an expected batting
average and wOBA that knows the ball's direction, which Statcast's do not, and
it carries the league's real positioning and fielders rather than the model's
(the field layer is being refitted: the model alone calls nearly every ball a
sure hit or a sure out).

Distance: (dEV / 2.5 mph)^2 + (dLA / 2.5 deg)^2 + (dSpray / 4 deg)^2.

  python3 review/xhit_league.py diag_out/rev_849839.jsonl   ->  diag_out/rev_849839_x.jsonl

CHANGED
  v0.1  first build (the Yankees-Rays review)
"""
import json, sys, math, os
import numpy as np
sys.path.insert(0, 'statcast')
from swing_geometry import load

WOBA = {'BB': 0.69, 'HBP': 0.72, '1B': 0.88, '2B': 1.25, '3B': 1.58, 'HR': 2.03, 'E': 0.88, 'OUT': 0.0}
CAT = {'single': '1B', 'double': '2B', 'triple': '3B', 'home_run': 'HR', 'field_error': 'E'}


def league():
    cache = 'diag_out/league_bip.npz'
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=True)
        return z['X'], z['C']
    X, C = [], []
    for r in load('2025-05-05:2025-09-21'):
        if r.get('description') != 'hit_into_play' or (r.get('game_type') or 'R') != 'R':
            continue
        try:
            ev, la, hx, hy = float(r['launch_speed']), float(r['launch_angle']), float(r['hc_x']), float(r['hc_y'])
        except (TypeError, ValueError, KeyError):
            continue
        spray = math.degrees(math.atan2(hx - 126.0, 205.0 - hy))
        pull = -spray if r.get('stand') == 'R' else spray   # + pulled
        X.append([ev, la, pull]); C.append(CAT.get(r.get('events'), 'OUT'))
    X, C = np.array(X), np.array(C)
    np.savez(cache, X=X, C=C)
    return X, C


def main(path):
    X, C = league()
    S = np.array([2.5, 2.5, 4.0])
    rows = [json.loads(l) for l in open(path)]
    rec = json.load(open('playoffs/players_measured.json')); rec = rec if isinstance(rec, list) else rec['players']
    bats = {r['id']: r['bats'] for r in rec}
    out = []
    for r in rows:
        b = r.get('bip')
        if b:
            side = bats.get(r['batterId'], 'R')
            pull = -b['spray'] if side == 'R' else b['spray']
            if side == 'S':   # a switch hitter bats opposite the pitcher; the pitcher's hand is not in the row, so take his usual frame
                pull = b['spray']
            d = (((X - np.array([b['ev'], b['la'], pull])) / S) ** 2).sum(1)
            idx = np.argsort(d)[:40]
            cats = {k: float(np.mean(C[idx] == k)) for k in ('OUT', '1B', '2B', '3B', 'HR', 'E')}
            b['league'] = {k: round(v, 3) for k, v in cats.items()}
            b['league']['pHit'] = round(cats['1B'] + cats['2B'] + cats['3B'] + cats['HR'], 3)
            b['league']['xwobacon'] = round(sum(WOBA[k] * v for k, v in cats.items()), 3)
            b['league']['reach'] = round(float(np.sqrt(d[idx[-1]])), 2)
        out.append(r)
    with open(path.replace('.jsonl', '_x.jsonl'), 'w') as f:
        for r in sorted(out, key=lambda r: r['i']):
            f.write(json.dumps(r) + '\n')
    print('%s: %d batted balls matched against %d league balls in play' % (path, sum(1 for r in out if r.get('bip')), len(X)))


if __name__ == '__main__':
    for p in sys.argv[1:]:
        main(p)
