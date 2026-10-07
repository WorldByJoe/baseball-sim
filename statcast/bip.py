"""
bip.py · v0.2 · 2026-10-04

What happens to a ball in play in the league, from pitch-level Statcast, for
judging the fielding layer apart from the contact that feeds it: the share of
balls in play that fall for hits by exit velocity and launch angle, what kind
of hit, how often a fly ball or liner is caught by how far it was hit and
toward which field, and how often a ground ball gets through by how hard and
where it was hit. headless/bip_check.js prints the model's tables in the same
shape beside these.

Spray is the angle of the hit coordinates from the plate, + toward the batter's
pull side. Bunts are left out. A hit is a single, double, triple or home run;
errors and fielder's choices count as outs, as BABIP does not count them hits.

Writes statcast/bip_<year>.json and statcast/bip_<year>.js (`var BIP = ...`)
for headless/bip_check.js.

  python3 statcast/bip.py 2025-05-05:2025-09-21

CHANGED
  v0.2  home plate in the hit coordinates fitted from fly-ball distances (126.0, 205.0; was 125.42, 198.27)
  v0.1  first build (the fielding layer's targets, carry, and Statcast's expected wOBA by exit velocity and launch angle)
"""
import json, math, os, sys, collections

# Home plate in Statcast's hit coordinates (hc_x, hc_y): fitted 2026-10-04 from 2025 balls in the air,
# their projected distance against the hit coordinates (caught flies, with and without a catch offset,
# and home runs: x0 125.97-126.03, y0 203.1-207.3, 2.36-2.41 ft per unit). The usual (125.42, 198.27)
# sits about 7 units too shallow and inflated the spray of short balls - ground balls most.
HC_X0, HC_Y0 = 126.0, 205.0
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load

EV_E = (0, 70, 80, 90, 95, 100, 105, 130)
LA_E = (-90, -10, 0, 10, 20, 30, 40, 50, 90)
DIST_E = (0, 150, 200, 250, 300, 350, 400, 600)
SPRAY_E = (-60, -30, -15, 0, 15, 30, 60)          # + pulled
GB_EV_E = (0, 70, 80, 90, 100, 130)
HITS = {'single': '1B', 'double': '2B', 'triple': '3B', 'home_run': 'HR'}


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def band(v, E):
    for i in range(len(E) - 1):
        if E[i] <= v < E[i + 1]:
            return i
    return None


def lab(E):
    return ['%g..%g' % (a, b) for a, b in zip(E, E[1:])]


def main(spec):
    rows = load(spec)
    B, days = [], set()
    for r in rows:
        if (r.get('game_type') or 'R') != 'R' or r.get('description') != 'hit_into_play':
            continue
        if 'bunt' in (r.get('des') or '').lower():
            continue
        ev, la = fl(r.get('launch_speed')), fl(r.get('launch_angle'))
        hx, hy, d = fl(r.get('hc_x')), fl(r.get('hc_y')), fl(r.get('hit_distance_sc'))
        if ev is None or la is None:
            continue
        spray = None
        if hx is not None and hy is not None and hy < HC_Y0:
            spray = math.degrees(math.atan2(hx - HC_X0, HC_Y0 - hy))     # + toward right field
            if r.get('stand') == 'R':
                spray = -spray                                             # + toward his pull side
        B.append({'ev': ev, 'la': la, 'spray': spray, 'dist': d, 'hit': HITS.get(r.get('events'), None), 'xw': fl(r.get('estimated_woba_using_speedangle'))})
        days.add(r.get('game_date'))
    J = {'n': len(B), 'ev_edges': EV_E, 'la_edges': LA_E, 'dist_edges': DIST_E, 'spray_edges': SPRAY_E, 'gb_ev_edges': GB_EV_E}
    md = ['balls in play %d (%d days), bunts left out' % (len(B), len(days)), '']
    # 1. hits per ball in play (home runs included) by EV x LA, and the share of each cell
    grid = [[[0, 0] for _ in LA_E[1:]] for _ in EV_E[1:]]
    for b in B:
        i, j = band(b['ev'], EV_E), band(b['la'], LA_E)
        if i is None or j is None:
            continue
        grid[i][j][1] += 1
        grid[i][j][0] += b['hit'] is not None
    J['hit_by_ev_la'] = grid
    md.append('1. HITS PER BALL IN PLAY BY EXIT VELOCITY (rows) AND LAUNCH ANGLE (columns), home runs included; (share of balls in play)')
    md.append('%10s ' % 'EV \\ LA' + ' '.join('%13s' % l for l in lab(LA_E)))
    for i, l in enumerate(lab(EV_E)):
        md.append('%10s ' % l + ' '.join('%5s (%5.3f)' % (('%.3f' % (c[0] / c[1])).lstrip('0') if c[1] >= 20 else '', c[1] / len(B)) for c in grid[i]))
    md.append('')
    # 2. by launch angle: what kind of hit
    J['by_la'] = []
    md.append('2. BY LAUNCH ANGLE: share of balls in play that became each hit')
    md.append('%10s %7s %6s %6s %6s %6s %7s' % ('LA', 'n', '1B', '2B', '3B', 'HR', 'BABIP'))
    for j, l in enumerate(lab(LA_E)):
        s = [b for b in B if band(b['la'], LA_E) == j]
        c = collections.Counter(b['hit'] for b in s)
        nhr = len(s) - c['HR']
        g = {'n': len(s), '1B': c['1B'] / len(s), '2B': c['2B'] / len(s), '3B': c['3B'] / len(s), 'HR': c['HR'] / len(s),
             'babip': (c['1B'] + c['2B'] + c['3B']) / nhr if nhr else None}
        J['by_la'].append(g)
        md.append('%10s %7d %6.3f %6.3f %6.3f %6.3f %7.3f' % (l, len(s), g['1B'], g['2B'], g['3B'], g['HR'], g['babip']))
    md.append('')
    # 3. fly balls and liners (LA 10-50) caught, by distance and by field
    air = [b for b in B if 10 <= b['la'] < 50 and b['dist'] is not None and b['hit'] != 'HR']
    J['air_by_dist'] = []
    md.append('3. FLY BALLS AND LINERS (LA 10-50, home runs out): hits per ball by distance (ft) and spray (+ pulled)')
    md.append('%10s %7s %6s ' % ('dist', 'n', 'all') + ' '.join('%9s' % l for l in lab(SPRAY_E)) + '   %6s %6s' % ('2B', '3B'))
    for k, l in enumerate(lab(DIST_E)):
        s = [b for b in air if band(b['dist'], DIST_E) == k]
        if not s:
            J['air_by_dist'].append(None); continue
        row = []
        for m in range(len(SPRAY_E) - 1):
            t = [b for b in s if b['spray'] is not None and band(b['spray'], SPRAY_E) == m]
            row.append([sum(b['hit'] is not None for b in t), len(t)])
        c = collections.Counter(b['hit'] for b in s)
        g = {'n': len(s), 'hit': sum(b['hit'] is not None for b in s) / len(s), 'spray': row, '2B': c['2B'] / len(s), '3B': c['3B'] / len(s)}
        J['air_by_dist'].append(g)
        md.append('%10s %7d %6.3f ' % (l, len(s), g['hit']) + ' '.join('%9s' % (('%.3f' % (a / n)) if n >= 20 else '') for a, n in row) + '   %6.3f %6.3f' % (g['2B'], g['3B']))
    md.append('')
    # 4. ground balls (LA < 10): hits by exit velocity and spray
    gb = [b for b in B if b['la'] < 10]
    J['gb'] = []
    md.append('4. GROUND BALLS (LA < 10): hits per ball by exit velocity and spray (+ pulled)')
    md.append('%10s %7s %6s ' % ('EV', 'n', 'all') + ' '.join('%9s' % l for l in lab(SPRAY_E)))
    for k, l in enumerate(lab(GB_EV_E)):
        s = [b for b in gb if band(b['ev'], GB_EV_E) == k]
        row = []
        for m in range(len(SPRAY_E) - 1):
            t = [b for b in s if b['spray'] is not None and band(b['spray'], SPRAY_E) == m]
            row.append([sum(b['hit'] is not None for b in t), len(t)])
        g = {'n': len(s), 'hit': sum(b['hit'] is not None for b in s) / len(s), 'spray': row}
        J['gb'].append(g)
        md.append('%10s %7d %6.3f ' % (l, len(s), g['hit']) + ' '.join('%9s' % (('%.3f' % (a / n)) if n >= 20 else '') for a, n in row))
    md.append('')
    # 5. how far balls in the air carried, by exit velocity and launch angle (hit_distance_sc; the model's landing distance)
    CEV, CLA = (90, 95, 100, 105, 110, 120), (15, 20, 25, 30, 35, 40, 45)
    carry = [[[] for _ in CLA[1:]] for _ in CEV[1:]]
    for b in B:
        i, j = band(b['ev'], CEV), band(b['la'], CLA)
        if i is not None and j is not None and b['dist'] is not None:
            carry[i][j].append(b['dist'])
    J['carry'] = {'ev_edges': CEV, 'la_edges': CLA, 'grid': [[[sum(c) / len(c), len(c)] if c else None for c in row] for row in carry]}
    md.append('5. CARRY: mean distance (ft) of balls in the air by exit velocity (rows) and launch angle (columns), n in brackets')
    md.append('%10s ' % 'EV \\ LA' + ' '.join('%11s' % l for l in lab(CLA)))
    for i, l in enumerate(lab(CEV)):
        md.append('%10s ' % l + ' '.join('%11s' % ('%.0f (%d)' % (sum(c) / len(c), len(c)) if len(c) >= 10 else '') for c in carry[i]))
    md.append('')
    # 6. Statcast's expected wOBA on contact by exit velocity and launch angle (estimated_woba_using_speedangle), for valuing the model's hitters
    XE, XL = list(range(40, 122, 4)), list(range(-90, 92, 4))
    xg = [[[0.0, 0] for _ in XL[1:]] for _ in XE[1:]]
    for b in B:
        i, j = band(b['ev'], XE), band(b['la'], XL)
        if i is not None and j is not None and b['xw'] is not None:
            xg[i][j][0] += b['xw']; xg[i][j][1] += 1
    J['xwoba'] = {'ev_edges': XE, 'la_edges': XL, 'grid': [[round(c[0] / c[1], 3) if c[1] >= 5 else None for c in row] for row in xg],
                  'mean': sum(b['xw'] for b in B if b['xw'] is not None) / max(1, sum(1 for b in B if b['xw'] is not None))}
    md.append('6. Expected wOBA on contact (Statcast) by 4 mph x 4 deg, written to the .js for tools/hitter_value.js; mean on contact %.3f' % J['xwoba']['mean'])
    md.append('')
    tot = collections.Counter(b['hit'] for b in B)
    J['totals'] = {'n': len(B), '1B': tot['1B'], '2B': tot['2B'], '3B': tot['3B'], 'HR': tot['HR']}
    nhr = len(B) - tot['HR']
    md.append('All balls in play: 1B %.3f  2B %.3f  3B %.3f  HR %.3f  BABIP %.3f' % (tot['1B'] / len(B), tot['2B'] / len(B), tot['3B'] / len(B), tot['HR'] / len(B), (tot['1B'] + tot['2B'] + tot['3B']) / nhr))
    J['dates'] = sorted(d for d in days if d)
    year = J['dates'][0][:4] if J['dates'] else '2025'
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'bip_%s.json' % year), 'w') as f:
        json.dump(J, f)
    with open(os.path.join(here, 'bip_%s.js' % year), 'w') as f:
        f.write('// written by statcast/bip.py from pitch-level %s; load before headless/bip_check.js\nvar BIP = %s;\n' % (year, json.dumps(J)))
    print('\n'.join(md))
    print('wrote statcast/bip_%s.json and .js' % year)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
