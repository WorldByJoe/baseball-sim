"""
misses.py · v0.3 · 2026-10-03

How far swings miss: Statcast's miss distance, the gap at closest approach
between the ball and the barrel half of the bat (label to tip), in inches,
recorded for whiffs (bat tracking, pitch-level). With the outcome of every
swing it gives the shape of a batter's scatter just beyond contact - most
whiffs are near misses - by pitch kind and, for four-seamers, by speed. These
are the targets for the batter's swing scatter (headless/miss_check.js).

By reach: the same by how far outside the zone the pitch crossed (inches
from the engine's zone - the plate's 17 in plus a ball's radius, the batter's
sz_bot/sz_top widened by a ball's radius; 0 inside it), for each kind: the
targets for how a swing's scatter grows when he reaches (the engine's
coverage).

Swing to swing: each tracked swing's bat speed against that hitter's own
mean (hitters with 150+ tracked swings): sd, quantiles, the share more than
10 and 20 mph below - the targets for the engine's swing-to-swing effort and
checked swings.

Swings are swinging strikes (blocked ones too: in the dirt), fouls, foul tips
and balls in play, bunts left out. Kinds: fastball FF SI FC, breaking SL CU
ST KC SV, off-speed CH FS FO.

Writes statcast/misses_<year>.json and misses_<year>.js (`var MISSES = ...`).

  python3 statcast/misses.py 2025

CHANGED
  v0.3  swing to swing: each swing's bat speed against the hitter's own mean (hitters with 150+ tracked swings)
  v0.2  by reach: whiffs and misses by how far outside the zone the pitch was (the engine's zone)
  v0.1  first build
"""
import csv, glob, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
KIND = {**{p: 'FB' for p in ('FF', 'SI', 'FC')}, **{p: 'BR' for p in ('SL', 'CU', 'ST', 'KC', 'SV')}, **{p: 'OS' for p in ('CH', 'FS', 'FO')}}
BANDS = [(0, 92, '<92'), (92, 94, '92-94'), (94, 96, '94-96'), (96, 98, '96-98'), (98, 200, '98+')]
EDGES = [0, 1, 3, 6, 999]
HALF, BALL_R = (8.5 + 1.45) / 12, 1.45 / 12
REACH = [(0, 1e-9, 'in zone'), (1e-9, 3, '0-3 in out'), (3, 6, '3-6 in out'), (6, 999, '6+ in out')]


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def summary(S):
    n = len(S); wh = [s for s in S if s[0] == 'whiff']; m = sorted(s[1] for s in wh if s[1] is not None)
    out = {'swings': n, 'whiff': len(wh) / n, 'foul': sum(s[0] == 'foul' for s in S) / n, 'bip': sum(s[0] == 'bip' for s in S) / n,
           'miss_q': [m[int(q * (len(m) - 1))] for q in (0.1, 0.25, 0.5, 0.75, 0.9)] if m else None,
           # share of SWINGS whose whiff missed by each band of distance (whiffs without a distance spread pro rata)
           'miss_share': [len(wh) / n * sum(a <= x < b for x in m) / max(1, len(m)) for a, b in zip(EDGES, EDGES[1:])]}
    return out


def main(year):
    S = {'all': [], 'FB': [], 'BR': [], 'OS': []}; F = {b[2]: [] for b in BANDS}
    Rch = {k: {b[2]: [] for b in REACH} for k in S}
    per = {}
    for fn in sorted(glob.glob(os.path.join(HERE, 'raw', 'pitches', str(year), '*.csv'))):
        for r in csv.DictReader(open(fn, encoding='utf-8')):
            d = r['description']
            if d not in SWING or 'bunt' in (r.get('des') or '').lower(): continue
            k = KIND.get(r['pitch_type'])
            o = ('whiff', fl(r.get('miss_distance'))) if d in WHIFF else ('foul', None) if d in ('foul', 'foul_tip') else ('bip', None)
            S['all'].append(o)
            if k: S[k].append(o)
            bs = fl(r.get('bat_speed'))
            if bs is not None: per.setdefault(r['batter'], []).append(bs)
            x, z, sb, st = fl(r['plate_x']), fl(r['plate_z']), fl(r['sz_bot']), fl(r['sz_top'])
            if None not in (x, z, sb, st):
                re_ = math.hypot(max(0, abs(x) - HALF), max(0, sb - BALL_R - z, z - st - BALL_R)) * 12
                lab = [b[2] for b in REACH if b[0] <= re_ < b[1]][0] if re_ > 0 else 'in zone'
                Rch['all'][lab].append(o)
                if k: Rch[k][lab].append(o)
            v = fl(r['release_speed'])
            if r['pitch_type'] == 'FF' and v:
                for a, b, lab in BANDS:
                    if a <= v < b: F[lab].append(o)
    dev = sorted(b - sum(v) / len(v) for v in per.values() if len(v) >= 150 for b in v)
    nd = len(dev); md = sum(dev) / nd
    bat_dev = {'n': nd, 'sd': (sum((x - md) ** 2 for x in dev) / nd) ** 0.5, 'q': {str(p): dev[int(p * (nd - 1))] for p in (0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99)},
               'below10': sum(x < -10 for x in dev) / nd, 'below20': sum(x < -20 for x in dev) / nd}
    res = {'bat_dev': bat_dev, 'edges_in': EDGES[:-1], 'by_kind': {k: summary(v) for k, v in S.items()}, 'ff_by_speed': {k: summary(v) for k, v in F.items()},
           'by_reach': {k: {lab: dict(summary(v), share=len(v) / sum(len(u) for u in D.values())) for lab, v in D.items()} for k, D in Rch.items()}}
    print('swings: whiff, foul, in play per swing; whiffs\' miss distance (in) p10 p25 p50 p75 p90; share of swings missing by 0-1, 1-3, 3-6, 6+ in')
    print('  swing to swing: bat speed against the hitter\'s own mean, %d swings: sd %.2f; quantiles %s; more than 10 below %.3f, 20 below %.3f' % (
        nd, bat_dev['sd'], ' '.join('%s:%.1f' % kv for kv in bat_dev['q'].items()), bat_dev['below10'], bat_dev['below20']))
    for k in ('FB', 'BR', 'OS'):
        for lab, sm in res['by_reach'][k].items():
            print('  reach     %-3s %-10s share of swings %.3f  whiff %.3f  missing 3+ in %.3f' % (k, lab, sm['share'], sm['whiff'], sm['miss_share'][2] + sm['miss_share'][3]))
    for grp, D in (('kind', res['by_kind']), ('FF speed', res['ff_by_speed'])):
        for k, s in D.items():
            print('  %-9s %-6s n %6d  whiff %.3f foul %.3f bip %.3f   miss %s   shares %s' % (grp, k, s['swings'], s['whiff'], s['foul'], s['bip'],
                  ' '.join('%.1f' % q for q in s['miss_q']), ' '.join('%.3f' % q for q in s['miss_share'])))
    base = os.path.join(HERE, 'misses_%s' % year)
    json.dump(res, open(base + '.json', 'w'), indent=1)
    with open(base + '.js', 'w') as f:
        f.write('// written by statcast/misses.py from pitch-level %s; load before headless/miss_check.js\n' % year)
        f.write('var MISSES = ' + json.dumps(res) + ';\n')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025')
