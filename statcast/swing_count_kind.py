"""
swing_count_kind.py · v0.1 · 2026-10-04

The league's swing rate by count x pitch kind x distance from the zone's edge, from
the pitch-level Statcast already on disk (statcast/raw/pitches/<year>/, written by
fetch_pitches.py). The bands are tools/fit_swing_policy.js's: distance from the
zone's edge in inches with the ball's edge counted, + outside (-99, -6, -4, -2, 0, 2,
4, 6, 9, 12, 99). Kinds: FB = FF SI FC; BR = SL CU ST KC SV; OS = CH FS FO. Bunts,
pitchouts and intentional balls are out.

Why: the swing policy's thresholds are fitted by count, and until engine v3.1 to the
count's curve over all kinds - which left breaking balls swung at .15 too rarely and
fastballs too often at every distance. The league takes breaking balls in the zone
more than fastballs only in hitters' counts (0-0: .45 against .57; 2-0: .48 against
.72); at 1-1 and with two strikes it swings at them alike, and it chases breaking
balls more than fastballs in every count.

Writes statcast/swing_count_kind_<year>.json and .js (`var SWING_CK = ...`): for each
'b-s|KIND' key, ten [swing rate, pitches] pairs.

Run:  python3 statcast/swing_count_kind.py [year]

CHANGED
  v0.1  first build (engine v3.1)
"""
import csv, glob, json, os, sys

YEAR = sys.argv[1] if len(sys.argv) > 1 else '2025'
HERE = os.path.dirname(os.path.abspath(__file__))
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'CU': 'BR', 'ST': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
SWINGS = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
EDGES = [-99, -6, -4, -2, 0, 2, 4, 6, 9, 12, 99]
HALF, R = (8.5 + 1.45) / 12, 1.45 / 12   # ft: the plate's half width plus a ball radius; a ball radius


def edge_in(x, z, bot, top):
    """Inches from the zone's edge, ball edge counted: - inside, + outside (the fitter's convention)."""
    lo, hi = bot - R, top + R
    dx, dz = abs(x) - HALF, max(lo - z, z - hi)
    if dx <= 0 and dz <= 0:
        return max(dx, dz) * 12
    return ((max(dx, 0) ** 2 + max(dz, 0) ** 2) ** 0.5) * 12


def main():
    tally = {}
    files = sorted(glob.glob(os.path.join(HERE, 'raw', 'pitches', YEAR, '*.csv')))
    for fn in files:
        for r in csv.DictReader(open(fn, encoding='utf-8')):
            kind, desc = KIND.get(r['pitch_type']), r['description']
            if not kind or 'bunt' in desc or desc in ('pitchout', 'intent_ball'):
                continue
            try:
                x, z, bot, top = float(r['plate_x']), float(r['plate_z']), float(r['sz_bot']), float(r['sz_top'])
                b, s = int(r['balls']), int(r['strikes'])
            except ValueError:
                continue
            e = edge_in(x, z, bot, top)
            j = next(i for i in range(len(EDGES) - 1) if EDGES[i] <= e < EDGES[i + 1])
            cell = tally.setdefault('%d-%d|%s' % (b, s, kind), [[0, 0] for _ in range(len(EDGES) - 1)])
            cell[j][0] += 1
            cell[j][1] += desc in SWINGS
    out = {k: [[round(v[1] / v[0], 4) if v[0] else None, v[0]] for v in arr] for k, arr in sorted(tally.items())}
    base = os.path.join(HERE, 'swing_count_kind_%s' % YEAR)
    json.dump(out, open(base + '.json', 'w'))
    with open(base + '.js', 'w') as f:
        f.write('// written by statcast/swing_count_kind.py from pitch-level %s; load before tools/fit_swing_policy.js\n' % YEAR)
        f.write('var SWING_CK = ' + json.dumps(out) + ';\n')
    print('%d files, %d count x kind cells -> %s.js' % (len(files), len(out), base))


if __name__ == '__main__':
    main()
