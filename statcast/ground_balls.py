"""
ground_balls.py · v0.1 · 2026-10-05

What happens to the league's ground balls and low liners (launch angle -30 to
15 deg), from pitch-level Statcast, for judging the model's bounces and the
infielder's intercept: hits per ball by launch angle (2-deg bands) and exit
speed (5-mph bands), by direction (the hit coordinates, home plate at 126.0,
205.0; + toward the batter's pull side) and by the fielder who handled it;
the share that were infield hits and errors; and how the outs were made (in
the air or on the ground, from the play descriptions). headless/ground_check.js
prints the model's tables in the same shape beside these.

Bunts are left out. A hit is a single, double, triple or home run; errors and
fielder's choices count as outs, as BABIP does not count them hits. The
league's 2025 infields played under the shift ban; the alignment field is
tabulated so the model's shifted infield can be compared with care.

Writes statcast/ground_balls_<year>.json and .js (`var GBL = ...`).

  python3 statcast/ground_balls.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build (the ground-balls brief, docs/briefs/2026-10-05_ground_balls.md)
"""
import json, math, os, sys, collections, re

HC_X0, HC_Y0 = 126.0, 205.0
HC_FT = 2.38        # ft per unit of the hit coordinates (fitted with the plate, statcast/bip.py v0.2)
# The league's average infield starting spots with the bases empty, 2025, standard alignment: [depth ft, angle deg from the
# centre-field line, + toward first base], by position and batter side (Baseball Savant fielder positioning, weighted by
# plate appearances; statcast/infield_positioning.py on branch men-on-base, commit 509eeee).
START = {'1B': {'R': [113.7, 29.8], 'L': [123.6, 37.8]}, '2B': {'R': [153.0, 6.8], 'L': [148.3, 19.0]},
         '3B': {'R': [122.3, -36.5], 'L': [116.0, -27.1]}, 'SS': {'R': [148.3, -18.1], 'L': [152.3, -6.0]}}
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load

LA_E = list(range(-30, 18, 2))                 # 2-deg bands, -30..16
LA5_E = [-30, -20, -10, -5, 0, 5, 10, 15]       # coarser bands for the direction and fielder tables
EV_E = [0, 70, 75, 80, 85, 90, 95, 100, 105, 110, 130]
DIR_E = [-60, -15, 15, 60]                      # opposite, middle, pull (+ pulled)
POS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
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


def how_out(des, events):
    """How the ball was put in play, from the play description: caught in the air, or fielded off the ground."""
    d = (des or '').lower()
    if re.search(r'\b(lines|flies|pops) (out|into)', d) or 'line drive double play' in d:
        return 'air'
    if re.search(r'\bground', d) or 'force out' in d or 'fielder\'s choice' in d or 'double play' in d:
        return 'ground'
    return 'other'


def rate(a, n):
    return a / n if n else None


def main(spec):
    rows = load(spec)
    B, days = [], set()
    for r in rows:
        if (r.get('game_type') or 'R') != 'R' or r.get('description') != 'hit_into_play':
            continue
        if 'bunt' in (r.get('des') or '').lower():
            continue
        ev, la = fl(r.get('launch_speed')), fl(r.get('launch_angle'))
        if ev is None or la is None or la < -30 or la >= 15:
            continue
        hx, hy = fl(r.get('hc_x')), fl(r.get('hc_y'))
        spray = None
        if hx is not None and hy is not None and hy < HC_Y0:
            spray = math.degrees(math.atan2(hx - HC_X0, HC_Y0 - hy))
            if r.get('stand') == 'R':
                spray = -spray
        loc = r.get('hit_location') or ''
        pos = POS[int(loc) - 1] if loc.isdigit() and 1 <= int(loc) <= 9 else None
        hit = HITS.get(r.get('events'))
        ranged = None
        if hit is None and pos in START and hx is not None and hy is not None and not (r.get('on_1b') or r.get('on_2b') or r.get('on_3b')) and r.get('if_fielding_alignment') == 'Standard':
            s = START[pos][r.get('stand') or 'R']
            ranged = math.hypot((hx - HC_X0) * HC_FT - s[0] * math.sin(math.radians(s[1])), (HC_Y0 - hy) * HC_FT - s[0] * math.cos(math.radians(s[1])))
        B.append({'ev': ev, 'la': la, 'spray': spray, 'pos': pos, 'hit': hit, 'err': r.get('events') == 'field_error', 'ranged': ranged,
                  'how': how_out(r.get('des'), r.get('events')), 'bb': r.get('bb_type'), 'align': r.get('if_fielding_alignment'),
                  'dist': fl(r.get('hit_distance_sc')), 'inf_hit': hit is not None and pos in ('P', 'C', '1B', '2B', '3B', 'SS')})
        days.add(r.get('game_date'))
    J = {'n': len(B), 'la_edges': LA_E, 'la5_edges': LA5_E, 'ev_edges': EV_E, 'dir_edges': DIR_E, 'pos': POS}
    md = ['balls in play at -30 to 15 deg: %d (%d days), bunts left out' % (len(B), len(days)), '']

    # 1. hits per ball by launch angle (2-deg bands): all, and by exit speed band
    md.append('1. HITS PER BALL BY LAUNCH ANGLE (2-deg bands, rows) AND EXIT SPEED (columns); n in brackets; blank under 20')
    md.append('%8s %12s ' % ('LA', 'all') + ' '.join('%11s' % l for l in lab(EV_E)))
    J['by_la'] = []
    for j, l in enumerate(lab(LA_E)):
        s = [b for b in B if band(b['la'], LA_E) == j]
        cells = []
        for i in range(len(EV_E) - 1):
            t = [b for b in s if band(b['ev'], EV_E) == i]
            cells.append([sum(b['hit'] is not None for b in t), len(t)])
        J['by_la'].append({'n': len(s), 'hits': sum(b['hit'] is not None for b in s), 'inf_hits': sum(b['inf_hit'] for b in s),
                           'err': sum(b['err'] for b in s), 'air': sum(b['how'] == 'air' and b['hit'] is None for b in s), 'cells': cells})
        md.append('%8s %5s (%5d) ' % (l, ('%.3f' % rate(J['by_la'][-1]['hits'], len(s))).lstrip('0') if len(s) >= 20 else '', len(s)) +
                  ' '.join('%5s (%4d)' % (('%.3f' % (a / n)).lstrip('0') if n >= 20 else '', n) for a, n in cells))
    md.append('')

    # 2. by exit speed: ground balls (LA < 10) and low liners (0..15) apart, and the share that were infield hits and errors
    md.append('2. BY EXIT SPEED: hits per ball, the share of balls that were infield hits (fielded by an infielder), and errors per ball')
    md.append('%10s %7s %6s %7s %6s   | %7s %6s %7s %6s' % ('EV', 'n(<10)', 'hit', 'infhit', 'err', 'n(0-15)', 'hit', 'infhit', 'err'))
    J['by_ev'] = []
    for i, l in enumerate(lab(EV_E)):
        g = [b for b in B if band(b['ev'], EV_E) == i and b['la'] < 10]
        q = [b for b in B if band(b['ev'], EV_E) == i and 0 <= b['la'] < 15]
        row = {'gb': [len(g), sum(b['hit'] is not None for b in g), sum(b['inf_hit'] for b in g), sum(b['err'] for b in g)],
               'll': [len(q), sum(b['hit'] is not None for b in q), sum(b['inf_hit'] for b in q), sum(b['err'] for b in q)]}
        J['by_ev'].append(row)
        f = lambda c: ('%7d %6.3f %7.3f %6.3f' % (c[0], c[1] / c[0], c[2] / c[0], c[3] / c[0])) if c[0] else '%7d' % 0
        md.append('%10s %s   | %s' % (l, f(row['gb']), f(row['ll'])))
    md.append('')

    # 3. by direction (the hit coordinates, + pulled) and launch angle band: hits per ball
    md.append('3. HITS PER BALL BY DIRECTION (hit coordinates, + pulled: opposite / middle / pull) AND LAUNCH ANGLE; n in brackets')
    md.append('%10s ' % 'LA' + ' '.join('%14s' % l for l in lab(DIR_E)) + '   %8s' % 'no coord')
    J['by_dir'] = []
    for j, l in enumerate(lab(LA5_E)):
        s = [b for b in B if band(b['la'], LA5_E) == j]
        cells = []
        for m in range(len(DIR_E) - 1):
            t = [b for b in s if b['spray'] is not None and band(b['spray'], DIR_E) == m]
            cells.append([sum(b['hit'] is not None for b in t), len(t)])
        nc = [b for b in s if b['spray'] is None]
        J['by_dir'].append({'cells': cells, 'none': [sum(b['hit'] is not None for b in nc), len(nc)]})
        md.append('%10s ' % l + ' '.join('%6s (%6d)' % (('%.3f' % (a / n)).lstrip('0') if n >= 20 else '', n) for a, n in cells) + '   %3d/%4d' % (J['by_dir'][-1]['none'][0], len(nc)))
    md.append('')

    # 4. by the fielder who handled it: share of balls, and hits per ball when he did
    md.append('4. BY THE FIELDER WHO HANDLED IT (hit_location): share of balls in the band, and hits per ball when he did; "OF" = through the infield')
    md.append('%10s %6s ' % ('LA', 'n') + ' '.join('%11s' % p for p in POS) + '  %7s' % 'none')
    J['by_pos'] = []
    for j, l in enumerate(lab(LA5_E)):
        s = [b for b in B if band(b['la'], LA5_E) == j]
        cells = {}
        for p in POS + [None]:
            t = [b for b in s if b['pos'] == p]
            cells[p or 'none'] = [sum(b['hit'] is not None for b in t), len(t)]
        J['by_pos'].append({'n': len(s), 'cells': cells})
        md.append('%10s %6d ' % (l, len(s)) + ' '.join('%4s %6s' % (('%.2f' % (cells[p][1] / len(s))).lstrip('0') if s else '', ('%.3f' % (cells[p][0] / cells[p][1])).lstrip('0') if cells[p][1] >= 20 else '') for p in POS) +
                  '  %3d/%3d' % (cells['none'][0], cells['none'][1]))
    md.append('')

    # 5. how the outs were made, by launch angle band: caught in the air, fielded off the ground
    md.append('5. HOW THE OUTS WERE MADE (play descriptions), share of balls in the band: caught in the air / off the ground / other; and Statcast bb_type line_drive share')
    md.append('%10s %6s %7s %7s %7s %8s' % ('LA', 'n', 'air', 'ground', 'other', 'LD type'))
    J['how'] = []
    for j, l in enumerate(lab(LA5_E)):
        s = [b for b in B if band(b['la'], LA5_E) == j]
        o = [b for b in s if b['hit'] is None]
        c = collections.Counter(b['how'] for b in o)
        ld = sum(b['bb'] == 'line_drive' for b in s)
        J['how'].append({'n': len(s), 'air': c['air'], 'ground': c['ground'], 'other': c['other'], 'ld_type': ld})
        md.append('%10s %6d %7.3f %7.3f %7.3f %8.3f' % (l, len(s), rate(c['air'], len(s)) or 0, rate(c['ground'], len(s)) or 0, rate(c['other'], len(s)) or 0, rate(ld, len(s)) or 0))
    md.append('')

    # 6. the infield's alignment on these balls
    md.append('6. THE INFIELD ALIGNMENT (2025, the shift ban): share of balls and hits per ball, ground balls (LA < 10)')
    al = collections.Counter(b['align'] for b in B if b['la'] < 10)
    J['align'] = {}
    for k, n in al.most_common():
        t = [b for b in B if b['la'] < 10 and b['align'] == k]
        J['align'][k or 'none'] = [sum(b['hit'] is not None for b in t), n]
        md.append('%16s %6d  share %.3f  hits per ball %.3f' % (k or 'none', n, n / max(1, sum(al.values())), sum(b['hit'] is not None for b in t) / n))
    md.append('')

    # 7. where ground balls were fielded (hit_distance_sc), by launch angle and exit speed: the median distance for outs made on the ground
    md.append('7. WHERE GROUND-BALL OUTS WERE FIELDED: median hit distance (ft, Statcast) of outs made off the ground, by launch angle (rows) and exit speed (columns); n in brackets')
    md.append('%10s ' % 'LA \\ EV' + ' '.join('%11s' % l for l in lab(EV_E)))
    J['field_dist'] = []
    for j, l in enumerate(lab(LA5_E)):
        row = []
        for i in range(len(EV_E) - 1):
            t = sorted(b['dist'] for b in B if band(b['la'], LA5_E) == j and band(b['ev'], EV_E) == i and b['hit'] is None and b['how'] == 'ground' and b['dist'] is not None)
            row.append([t[len(t) // 2], len(t)] if t else None)
        J['field_dist'].append(row)
        md.append('%10s ' % l + ' '.join('%5s (%4d)' % ('%.0f' % c[0], c[1]) if c and c[1] >= 10 else '%11s' % '' for c in row))
    md.append('')

    # 8. how far the infielders ranged to make ground outs: the fielding spot (hit coordinates, 2.38 ft a unit) less the
    #    league's average starting spot for that position and batter side with the bases empty (Baseball Savant fielder
    #    positioning, 2025, standard alignment; statcast/infield_positioning.py on branch men-on-base), by exit speed.
    #    Positioning varies pitch to pitch about the average, so these distances run wider than the fielder's own range.
    md.append('8. HOW FAR THE INFIELDERS RANGED ON GROUND OUTS (bases empty, standard alignment): distance (ft) from the league\'s average starting spot to the fielding spot, by exit speed; median / p75 / p90 (n)')
    md.append('%10s ' % 'EV' + ' '.join('%22s' % p for p in ('1B', '2B', '3B', 'SS')) + '%22s' % 'all four')
    J['ranged'] = []
    for i, l in enumerate(lab(EV_E)):
        row = {}
        for p in ('1B', '2B', '3B', 'SS', 'all'):
            t = sorted(b['ranged'] for b in B if band(b['ev'], EV_E) == i and b['la'] < 10 and b['ranged'] is not None and (p == 'all' or b['pos'] == p))
            row[p] = [t[len(t) // 2], t[3 * len(t) // 4], t[9 * len(t) // 10], len(t)] if t else None
        J['ranged'].append(row)
        md.append('%10s ' % l + ' '.join('%22s' % ('%4.0f /%4.0f /%4.0f (%4d)' % tuple(row[p]) if row[p] and row[p][3] >= 10 else '') for p in ('1B', '2B', '3B', 'SS', 'all')))
    md.append('')
    tot = [sum(b['hit'] is not None for b in B), len(B)]
    gb = [b for b in B if b['la'] < 10]
    J['totals'] = {'all': tot, 'gb': [sum(b['hit'] is not None for b in gb), len(gb)], 'gb_inf_hits': sum(b['inf_hit'] for b in gb), 'gb_err': sum(b['err'] for b in gb)}
    md.append('All -30..15: hits per ball %.3f (n %d); ground balls (<10): %.3f (n %d), infield hits %.3f of balls, errors %.3f' %
              (tot[0] / tot[1], tot[1], J['totals']['gb'][0] / len(gb), len(gb), J['totals']['gb_inf_hits'] / len(gb), J['totals']['gb_err'] / len(gb)))
    J['dates'] = sorted(d for d in days if d)
    year = J['dates'][0][:4] if J['dates'] else '2025'
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'ground_balls_%s.json' % year), 'w') as f:
        json.dump(J, f)
    with open(os.path.join(here, 'ground_balls_%s.js' % year), 'w') as f:
        f.write('// written by statcast/ground_balls.py from pitch-level %s; load before headless/ground_check.js\nvar GBL = %s;\n' % (year, json.dumps(J)))
    print('\n'.join(md))
    print('wrote statcast/ground_balls_%s.json and .js' % year)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
