"""
bat_direction.py · v0.1 · 2026-10-03

The bat's horizontal direction at contact - Statcast's attack direction,
the direction of the sweet spot's path at the moment of contact (or where
contact would have been), recorded for every tracked swing - and where the
ball went. Statcast's sign is + toward the opposite field (pull% against it
-.71 between hitters; per ball in play, the ball's spray against it -.76), so
it is turned here to + = toward the pull side, the engine's sign.

Measures: the bat's pull direction over all tracked swings, over contact and
over balls in play (mean, sd); the spread of hitters' own means (hitters with
200+ tracked swings), within-hitter sd; and for balls in play by type (ground
balls under 10 deg, liners 10-25, flies 25-50) the bat's direction and the
ball's spray (from where it was fielded, + pulled). These are the targets for
the engine's pullBias (how far round the arc a batter's usual contact point
is, which sets the bat's direction) and the checks on spray
(headless/spray_check.js).

Writes statcast/bat_direction_<year>.json and .js (`var BATDIR = ...`).

  python3 statcast/bat_direction.py 2025

CHANGED
  v0.1  first build
"""
import csv, glob, json, math, os, statistics as st, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def msd(v):
    return {'n': len(v), 'mean': st.mean(v), 'sd': st.pstdev(v)} if len(v) > 1 else None


def main(year):
    allsw, con, bip, per = [], [], [], {}
    types = {'GB': ([], []), 'LD': ([], []), 'FB': ([], [])}
    for fn in sorted(glob.glob(os.path.join(HERE, 'raw', 'pitches', str(year), '*.csv'))):
        for r in csv.DictReader(open(fn, encoding='utf-8')):
            d = r['description']
            if d not in SWING or 'bunt' in (r.get('des') or '').lower(): continue
            ad = fl(r.get('attack_direction'))
            if ad is None: continue
            pull = -ad
            allsw.append(pull); per.setdefault(r['batter'], []).append(pull)
            if d not in ('swinging_strike', 'swinging_strike_blocked'): con.append(pull)
            if d == 'hit_into_play':
                bip.append(pull)
                hx, hy, la = fl(r['hc_x']), fl(r['hc_y']), fl(r['launch_angle'])
                if None in (hx, hy, la): continue
                sp = math.degrees(math.atan2(hx - 125.42, 198.27 - hy)); spray = -sp if r['stand'] == 'R' else sp
                k = 'GB' if la < 10 else 'LD' if la < 25 else 'FB' if la < 50 else None
                if k: types[k][0].append(pull); types[k][1].append(spray)
    hm = [st.mean(v) for v in per.values() if len(v) >= 200]
    within = [st.pstdev(v) for v in per.values() if len(v) >= 200]
    res = {'all_swings': msd(allsw), 'contact': msd(con), 'bip': msd(bip),
           'hitter_means': msd(hm), 'within_hitter_sd': st.mean(within),
           'by_type': {k: {'bat': msd(v[0]), 'spray': msd(v[1])} for k, v in types.items()}}
    print('bat pull direction (deg, + toward the pull side): all swings %.1f ± %.1f, contact %.1f ± %.1f, balls in play %.1f ± %.1f' % (
        res['all_swings']['mean'], res['all_swings']['sd'], res['contact']['mean'], res['contact']['sd'], res['bip']['mean'], res['bip']['sd']))
    print('hitters (200+ tracked swings, n %d): their means %.1f ± %.1f; within a hitter sd %.1f' % (len(hm), res['hitter_means']['mean'], res['hitter_means']['sd'], res['within_hitter_sd']))
    for k, v in res['by_type'].items():
        print('  %s: bat %.1f ± %.1f, ball spray %.1f ± %.1f (n %d)' % (k, v['bat']['mean'], v['bat']['sd'], v['spray']['mean'], v['spray']['sd'], v['bat']['n']))
    base = os.path.join(HERE, 'bat_direction_%s' % year)
    json.dump(res, open(base + '.json', 'w'), indent=1)
    with open(base + '.js', 'w') as f:
        f.write('// written by statcast/bat_direction.py from pitch-level %s; load before headless/spray_check.js\n' % year)
        f.write('var BATDIR = ' + json.dumps(res) + ';\n')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025')
