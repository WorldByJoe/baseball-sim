"""
air_balls.py · v0.1 · 2026-10-06

The league's liners and fly balls (launch angle 10 to 50 deg, home runs left out) for judging the fielder's
motion, and the balls the outfield fielded after they got through or fell in, for judging his route to a
rolling ball. From the 42 days of 2025 pitch data. headless/air_check.js prints the model's tables in the
same shape beside these.

How each quantity is measured:
- Where the ball came down: Statcast's projected distance (hit_distance_sc) along the direction of the hit
  coordinates (home plate at 126.0, 205.0; 2.38 ft a unit; + toward right field in the field frame).
- How far the nearest fielder had to go: the distance from that spot to the nearest of the seven fielders'
  average starting spots (1B, 2B, 3B, SS, LF, CF, RF) for the batter's side and the runners (none on, a man
  on first only, any other), Baseball Savant's fielder positioning for 2025 (statcast/infield_positioning.py).
  The league's fielders stood off their average spot by the pitch-to-pitch scatter of positioning, so this is
  a distance from the average spot, not from where each man stood; air_check.js measures the model the same way.
- Hang time, which the pitch data do not carry: the engine's own flight (statcast/hang_time.js, the parks'
  average air) with the model's typical backspin for the launch angle, its exit speed solved so the ball comes down
  at Statcast's distance. air_check.js runs the same solve on the model's balls against their true hang.
- Caught: an out made in the air (the play description: lines, flies or pops out or into a double play);
  an error is not caught.

Writes statcast/air_balls_<year>.json and .js (`var AIRL = ...`).

  python3 statcast/air_balls.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build (the field follow-up brief, docs/briefs/2026-10-06_field_followup.md)
"""
import json, math, os, sys, re, subprocess, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HC_X0, HC_Y0, HC_FT = 126.0, 205.0, 2.38
sys.path.insert(0, HERE)
from swing_geometry import load

HANG_E = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 8.0]
DIST_E = [0, 10, 20, 30, 45, 60, 75, 90, 110, 140, 400]          # ft from the nearest fielder's average spot
EV_E = [0, 80, 90, 95, 100, 105, 130]
LA3_E = [10, 20, 30, 50]
DIR_E = [-50, -30, -12, 12, 30, 50]                               # field frame, + toward right field: LF line, LF gap, centre, RF gap, RF line
FIELD7 = ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
POS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
HITS = {'single': '1B', 'double': '2B', 'triple': '3B', 'home_run': 'HR'}


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def band(v, E):
    if v is None:
        return None
    for i in range(len(E) - 1):
        if E[i] <= v < E[i + 1]:
            return i
    return None


def lab(E):
    return ['%g..%g' % (a, b) for a, b in zip(E, E[1:])]


def air_out(des):
    d = (des or '').lower()
    return bool(re.search(r'\b(lines|flies|pops) (out|into)', d) or 'line drive double play' in d or 'sacrifice fly' in d
                or re.search(r'\b(lines|flies|pops) into (a )?(double|triple) play', d))


def runners(r):
    a, b, c = bool(r.get('on_1b')), bool(r.get('on_2b')), bool(r.get('on_3b'))
    return 'none' if not (a or b or c) else 'first only' if a and not b and not c else 'other'


def logit_d50(pts):
    """Caught (1/0) against distance d (ft): p = 1 / (1 + exp(a + b d)) by Newton with step halving; returns [d50 = -a/b, scale 1/b, n]."""
    if len(pts) < 40 or all(y for _, y in pts) or not any(y for _, y in pts):
        return None
    def ll(a, b):
        t = 0.0
        for d, y in pts:
            z = max(-30, min(30, a + b * d))
            t += -math.log1p(math.exp(z)) if y else z - math.log1p(math.exp(z))
        return t
    ds = sorted(d for d, _ in pts)
    b = 0.1; a = -b * ds[len(ds) // 2]; cur = ll(a, b)
    for _ in range(100):
        g0 = g1 = h00 = h01 = h11 = 0.0
        for d, y in pts:
            z = max(-30, min(30, a + b * d)); p = 1 / (1 + math.exp(z)); w = p * (1 - p)
            g0 += p - y; g1 += (p - y) * d          # the log likelihood's gradient (dlogL/dz = p - y)
            h00 += w; h01 += w * d; h11 += w * d * d   # minus its Hessian
        det = h00 * h11 - h01 * h01
        if det <= 0:
            return None
        da = (h11 * g0 - h01 * g1) / det; db = (-h01 * g0 + h00 * g1) / det
        step = 1.0
        while step > 1e-4:
            na, nb = a + step * da, b + step * db
            new = ll(na, nb)
            if new >= cur:
                break
            step /= 2
        if step <= 1e-4:
            break
        a, b, cur = na, nb, new
        if abs(step * da) < 1e-6 and abs(step * db) < 1e-8:
            break
    if b <= 0:
        return None
    return [round(-a / b, 1), round(1 / b, 1), len(pts)]


def q(xs, f):
    s = sorted(xs)
    return s[min(len(s) - 1, int(f * len(s)))] if s else None


def hang_solve(balls):
    tmp = os.path.join(ROOT, 'diag_out', 'air_hang_in.js')
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    with open(tmp, 'w') as f:
        f.write('var HANG_IN = ' + json.dumps([[round(b['ev'], 1), round(b['la'], 1), round(b['dist'], 1)] for b in balls]) + ';\n')
    out = subprocess.run([os.path.join(ROOT, 'tools', 'diag', 'run.sh'), os.path.join(ROOT, 'bb_engine.js'), tmp, os.path.join(HERE, 'hang_time.js')],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out.strip().splitlines()[-1])


def main(spec):
    J0 = json.load(open(os.path.join(HERE, 'infield_positioning_2025.json')))['spots']
    spots = {k: [v['depth'], v['angle']] for k, v in J0.items()}
    xy = {k: (v[0] * math.sin(math.radians(v[1])), v[0] * math.cos(math.radians(v[1]))) for k, v in spots.items()}
    rows = load(spec)
    A, C, days = [], [], set()
    for r in rows:
        if (r.get('game_type') or 'R') != 'R' or r.get('description') != 'hit_into_play':
            continue
        if 'bunt' in (r.get('des') or '').lower():
            continue
        ev, la, d = fl(r.get('launch_speed')), fl(r.get('launch_angle')), fl(r.get('hit_distance_sc'))
        hx, hy = fl(r.get('hc_x')), fl(r.get('hc_y'))
        if ev is None or la is None or hx is None or hy is None or hy >= HC_Y0:
            continue
        ang = math.degrees(math.atan2(hx - HC_X0, HC_Y0 - hy))           # field frame, + toward right field
        fdist = math.hypot(hx - HC_X0, HC_Y0 - hy) * HC_FT                # where it was fielded or caught, ft from home
        hit = HITS.get(r.get('events'))
        loc = r.get('hit_location') or ''
        pos = POS[int(loc) - 1] if loc.isdigit() and 1 <= int(loc) <= 9 else None
        side = r.get('stand') or 'R'
        days.add(r.get('game_date'))
        if 10 <= la < 50 and hit != 'HR' and d is not None and d > 0:
            lx, ly = d * math.sin(math.radians(ang)), d * math.cos(math.radians(ang))
            run = runners(r)
            near, nd, way = None, 1e9, None
            for p in FIELD7:
                sx, sy = xy['%s|%s|%s' % (p, side, run)]
                dd = math.hypot(lx - sx, ly - sy)
                if dd < nd:
                    near, nd = p, dd
                    c = -((lx - sx) * sx + (ly - sy) * sy) / (max(dd, 1e-6) * math.hypot(sx, sy))   # his run against the line to home
                    way = 'in' if c > 0.5 else 'back' if c < -0.5 else 'side'
            caught = hit is None and air_out(r.get('des'))
            A.append({'ev': ev, 'la': la, 'dist': d, 'ang': ang, 'near': near, 'nd': nd, 'way': way, 'caught': caught, 'hit': hit,
                      'err': r.get('events') == 'field_error', 'pos': pos})
        # the balls the outfield fielded that were hits: where he picked it up
        if hit in ('1B', '2B', '3B') and pos in ('LF', 'CF', 'RF'):
            C.append({'ev': ev, 'la': la, 'ang': ang, 'fdist': fdist, 'land': d, 'hit': hit, 'pos': pos})
    H = hang_solve(A)
    for b, h in zip(A, H):
        b['hang'], b['flag'] = h[0], h[1]
    J = {'n_air': len(A), 'n_cut': len(C), 'days': len(days), 'hang_edges': HANG_E, 'dist_edges': DIST_E, 'ev_edges': EV_E, 'la3_edges': LA3_E,
         'dir_edges': DIR_E, 'spots': spots, 'hang_flags': dict(collections.Counter(b['flag'] for b in A))}
    md = ['liners and fly balls (10-50 deg, home runs out) %d; outfield-fielded hits %d (%d days)' % (len(A), len(C), len(days)),
          'hang solve flags (0 solved, -1 shorter than the slowest, 1 longer than the fastest): %s' % J['hang_flags'], '']

    # 1. by hang time
    J['by_hang'] = []
    md.append('1. BY HANG TIME: n, caught in the air, hits per ball, errors; liners (10-25) and flies (25-50) caught; who caught (infield / outfield share of catches)')
    md.append('%10s %6s %7s %7s %6s %8s %8s %7s' % ('hang', 'n', 'caught', 'hits', 'err', 'ld.cgt', 'fb.cgt', 'IF.sh'))
    for i, l in enumerate(lab(HANG_E)):
        s = [b for b in A if band(b['hang'], HANG_E) == i]
        ld = [b for b in s if b['la'] < 25]; fb = [b for b in s if b['la'] >= 25]
        cg = [b for b in s if b['caught']]
        row = {'n': len(s), 'caught': len(cg), 'hits': sum(b['hit'] is not None for b in s), 'err': sum(b['err'] for b in s),
               'ld': [sum(b['caught'] for b in ld), len(ld)], 'fb': [sum(b['caught'] for b in fb), len(fb)],
               'if_catch': sum(b['pos'] in ('P', 'C', '1B', '2B', '3B', 'SS') for b in cg)}
        J['by_hang'].append(row)
        f = lambda a, n: ('%.3f' % (a / n)).lstrip('0') if n >= 20 else ''
        md.append('%10s %6d %7s %7s %6s %8s %8s %7s' % (l, len(s), f(row['caught'], len(s)), f(row['hits'], len(s)), f(row['err'], len(s)),
                                                       f(*row['ld']), f(*row['fb']), f(row['if_catch'], len(cg))))
    md.append('')

    # 2. caught by hang time x distance from the nearest fielder's average spot
    J['grid'] = [[[0, 0] for _ in DIST_E[1:]] for _ in HANG_E[1:]]
    for b in A:
        i, j = band(b['hang'], HANG_E), band(b['nd'], DIST_E)
        if i is None or j is None:
            continue
        J['grid'][i][j][1] += 1
        J['grid'][i][j][0] += b['caught']
    md.append('2. CAUGHT BY HANG TIME (rows) AND DISTANCE FROM THE NEAREST FIELDER\'S AVERAGE SPOT (ft, columns); n in brackets; blank under 15')
    md.append('%10s ' % 'hang' + ' '.join('%12s' % l for l in lab(DIST_E)))
    for i, l in enumerate(lab(HANG_E)):
        md.append('%10s ' % l + ' '.join('%5s (%5d)' % (('%.3f' % (c[0] / c[1])).lstrip('0') if c[1] >= 15 else '', c[1]) for c in J['grid'][i]))
    md.append('')

    # 3. the distance at which half are caught, by hang time (logistic in distance within each hang band)
    J['d50'] = []
    md.append('3. THE DISTANCE (ft) AT WHICH HALF ARE CAUGHT, BY HANG TIME: logistic fit in distance within the band, d50 and its scale (ft), n; balls nearest an outfielder | an infielder')
    md.append('%10s %22s   | %22s' % ('hang', 'outfield d50 / s (n)', 'infield d50 / s (n)'))
    for i, l in enumerate(lab(HANG_E)):
        s = [b for b in A if band(b['hang'], HANG_E) == i]
        o = logit_d50([(b['nd'], 1 if b['caught'] else 0) for b in s if b['near'] in ('LF', 'CF', 'RF')])
        n = logit_d50([(b['nd'], 1 if b['caught'] else 0) for b in s if b['near'] not in ('LF', 'CF', 'RF')])
        J['d50'].append({'of': o, 'if': n})
        f = lambda v: '%6.1f / %5.1f (%5d)' % tuple(v) if v else ''
        md.append('%10s %22s   | %22s' % (l, f(o), f(n)))
    md.append('')
    J['d50_way'] = []
    md.append('3b. THE SAME FOR BALLS NEAREST AN OUTFIELDER, BY THE WAY HE RUNS: in (toward home), to the side, back; d50 / s (n)')
    md.append('%10s %22s %22s %22s' % ('hang', 'in', 'side', 'back'))
    for i, l in enumerate(lab(HANG_E)):
        s = [b for b in A if band(b['hang'], HANG_E) == i and b['near'] in ('LF', 'CF', 'RF')]
        row = [logit_d50([(b['nd'], 1 if b['caught'] else 0) for b in s if b['way'] == w]) for w in ('in', 'side', 'back')]
        J['d50_way'].append(row)
        f = lambda v: '%6.1f / %5.1f (%5d)' % tuple(v) if v else ''
        md.append('%10s %22s %22s %22s' % (l, f(row[0]), f(row[1]), f(row[2])))
    md.append('')

    # 4. totals
    ld = [b for b in A if b['la'] < 25]; fb = [b for b in A if b['la'] >= 25]
    J['totals'] = {'ld': [len(ld), sum(b['caught'] for b in ld), sum(b['hit'] is not None for b in ld)],
                   'fb': [len(fb), sum(b['caught'] for b in fb), sum(b['hit'] is not None for b in fb)]}
    md.append('4. TOTALS: liners (10-25 deg) n %d, caught %.3f, hits %.3f; flies (25-50) n %d, caught %.3f, hits %.3f' % (
        len(ld), J['totals']['ld'][1] / len(ld), J['totals']['ld'][2] / len(ld), len(fb), J['totals']['fb'][1] / len(fb), J['totals']['fb'][2] / len(fb)))
    md.append('')

    # 5. the cut-off: where the outfield picked up the hits that got through or fell in
    md.append('5. WHERE THE OUTFIELD PICKED UP THE HITS (ft from home, the hit coordinates): ground balls through (LA < 10) by exit speed and direction (field frame);')
    md.append('   median / p25 / p75 (n), and the share that went for doubles + triples')
    J['cut_gb'] = []
    md.append('%10s ' % 'EV' + ' '.join('%24s' % l for l in lab(DIR_E)))
    for i, l in enumerate(lab(EV_E)):
        row, cells = [], []
        for k in range(len(DIR_E) - 1):
            s = [b for b in C if b['la'] < 10 and band(b['ev'], EV_E) == i and band(b['ang'], DIR_E) == k]
            fd = [b['fdist'] for b in s]
            xb = sum(b['hit'] != '1B' for b in s)
            cells.append([q(fd, .5), q(fd, .25), q(fd, .75), len(s), xb])
            row.append('%4.0f /%4.0f /%4.0f (%4d) %4s' % (q(fd, .5), q(fd, .25), q(fd, .75), len(s), ('%.2f' % (xb / len(s))).lstrip('0')) if len(s) >= 15 else '%24s' % '')
        J['cut_gb'].append(cells)
        md.append('%10s ' % l + ' '.join(row))
    md.append('')
    md.append('6. LINERS AND FLIES THAT FELL FOR HITS (10-50 deg), fielded by an outfielder: by launch angle band (rows) and exit speed (columns):')
    md.append('   median distance picked up less the distance it came down (ft, the roll and carom) (n), share doubles + triples')
    J['cut_air'] = []
    md.append('%10s ' % 'LA' + ' '.join('%18s' % l for l in lab(EV_E)))
    for j, l in enumerate(lab(LA3_E)):
        row, cells = [], []
        for i in range(len(EV_E) - 1):
            s = [b for b in C if band(b['la'], LA3_E) == j and band(b['ev'], EV_E) == i and b['land']]
            dd = [b['fdist'] - b['land'] for b in s]
            xb = sum(b['hit'] != '1B' for b in s)
            cells.append([q(dd, .5), len(s), xb])
            row.append('%5.0f (%4d) %5s' % (q(dd, .5), len(s), ('%.2f' % (xb / len(s))).lstrip('0')) if len(s) >= 15 else '%18s' % '')
        J['cut_air'].append(cells)
        md.append('%10s ' % l + ' '.join(row))
    md.append('')
    md.append('7. DOUBLES AND TRIPLES BY WHERE THEY WERE PICKED UP: share of all outfield-fielded hits in each direction (field frame), and median distance picked up (ft)')
    J['xb_dir'] = []
    md.append('%10s ' % '' + ' '.join('%22s' % l for l in lab(DIR_E)))
    for h in ('1B', '2B', '3B'):
        cells = []
        for k in range(len(DIR_E) - 1):
            s = [b for b in C if band(b['ang'], DIR_E) == k]
            t = [b for b in s if b['hit'] == h]
            cells.append([len(t), len(s), q([b['fdist'] for b in t], .5)])
        J['xb_dir'].append(cells)
        md.append('%10s ' % h + ' '.join('%5.3f of %5d, %4.0f ft' % (c[0] / c[1], c[1], c[2] or 0) if c[1] else '%22s' % '' for c in cells))
    md.append('')
    yr = spec[:4]
    with open(os.path.join(HERE, 'air_balls_%s.json' % yr), 'w') as f:
        json.dump(J, f)
    with open(os.path.join(HERE, 'air_balls_%s.js' % yr), 'w') as f:
        f.write('// statcast/air_balls.py %s (generated)\nvar AIRL = %s;\n' % (spec, json.dumps(J)))
    print('\n'.join(md))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
